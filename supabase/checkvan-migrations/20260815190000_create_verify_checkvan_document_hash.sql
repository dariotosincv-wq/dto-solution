-- Target project: Driver Utility / CheckVan (xlsrikqeqxwgzjakgmhz).
-- Apply this migration only to that project, never to the DTO Solution project.

begin;

create or replace function public.verify_checkvan_document_hash(p_sha256 text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'INVALID_SHA256';
  end if;

  return exists (
    select 1
    from public.checkvan_document_certifications as certification
    where certification.document_hash = p_sha256
      and certification.status = 'active'
      and certification.revoked_at is null
  );
end;
$$;

comment on function public.verify_checkvan_document_hash(text) is
  'Read-only exact SHA-256 lookup for active, non-revoked CheckVan document certifications.';

revoke all on function public.verify_checkvan_document_hash(text) from public;
revoke all on function public.verify_checkvan_document_hash(text) from authenticated;
revoke all on function public.verify_checkvan_document_hash(text) from anon;
grant execute on function public.verify_checkvan_document_hash(text) to anon;

commit;
