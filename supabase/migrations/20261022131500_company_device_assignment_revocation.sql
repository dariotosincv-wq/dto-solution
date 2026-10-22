-- A device is a cryptographic identity, distinct from its current company
-- assignment.  Retain historical assignments while allowing a company admin
-- to release its own device and the same key to enroll again later.
begin;

do $$
begin
  if exists (
    select 1
    from public.checkvan_device_assignments
    where status = 'active'
    group by device_id
    having count(*) > 1
  ) then
    raise exception 'ACTIVE_DEVICE_ASSIGNMENT_CONFLICT';
  end if;
end
$$;

alter table public.checkvan_device_assignments
  drop constraint if exists checkvan_device_assignments_license_id_device_id_key;

do $$
begin
  if to_regclass('public.checkvan_one_active_assignment_per_device') is null then
    create unique index checkvan_one_active_assignment_per_device
      on public.checkvan_device_assignments(device_id)
      where status = 'active';
  end if;
end
$$;

create or replace function public.internal_admin_revoke_company_device(
  p_auth_subject uuid,
  p_organization_id uuid,
  p_device_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.checkvan_device_assignments%rowtype;
  revoked_sessions integer := 0;
  revoked_push_registrations integer := 0;
  normalized_reason text := nullif(btrim(p_reason), '');
begin
  if p_auth_subject is null or p_organization_id is null or p_device_id is null then
    raise exception using errcode = '22023', message = 'INVALID_DEVICE_REVOCATION_INPUT';
  end if;
  if normalized_reason is not null and char_length(normalized_reason) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_REVOCATION_REASON';
  end if;

  perform 1
  from public.checkvan_area_memberships membership
  where membership.auth_subject = p_auth_subject
    and membership.organization_id = p_organization_id
    and membership.role = 'COMPANY_ADMIN'
    and membership.status = 'active';
  if not found then
    raise exception using errcode = '42501', message = 'COMPANY_ADMIN_REQUIRED';
  end if;

  select assignment.*
  into assignment_row
  from public.checkvan_device_assignments assignment
  join public.checkvan_licenses license on license.id = assignment.license_id
  where assignment.device_id = p_device_id
    and assignment.status = 'active'
    and license.organization_id = p_organization_id
  for update of assignment;

  if not found then
    if exists (
      select 1
      from public.checkvan_device_assignments assignment
      join public.checkvan_licenses license on license.id = assignment.license_id
      where assignment.device_id = p_device_id
        and assignment.status = 'revoked'
        and license.organization_id = p_organization_id
    ) then
      return jsonb_build_object('device_id', p_device_id, 'status', 'revoked', 'idempotent', true);
    end if;
    raise exception using errcode = 'P0002', message = 'DEVICE_NOT_ASSIGNED';
  end if;

  update public.checkvan_device_assignments
  set status = 'revoked', released_at = now()
  where id = assignment_row.id;

  update public.checkvan_device_driver_sessions session
  set revoked_at = now()
  where session.device_id = p_device_id
    and session.organization_id = p_organization_id
    and session.revoked_at is null;
  get diagnostics revoked_sessions = row_count;

  update public.checkvan_device_push_registrations registration
  set active = false, revoked_at = now(), updated_at = now()
  where registration.device_id = p_device_id
    and registration.organization_id = p_organization_id
    and registration.active = true;
  get diagnostics revoked_push_registrations = row_count;

  insert into public.checkvan_license_audit(event_type, organization_id, license_id, device_id, metadata)
  values (
    'company_device_revoked',
    p_organization_id,
    assignment_row.license_id,
    p_device_id,
    jsonb_build_object(
      'actor_subject', p_auth_subject,
      'assignment_id', assignment_row.id,
      'previous_status', assignment_row.status,
      'reason', normalized_reason,
      'revoked_driver_sessions', revoked_sessions,
      'revoked_push_registrations', revoked_push_registrations
    )
  );

  return jsonb_build_object(
    'device_id', p_device_id,
    'status', 'revoked',
    'idempotent', false,
    'revoked_driver_sessions', revoked_sessions,
    'revoked_push_registrations', revoked_push_registrations
  );
end
$$;

revoke all on function public.internal_admin_revoke_company_device(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.internal_admin_revoke_company_device(uuid, uuid, uuid, text) to service_role;

commit;
