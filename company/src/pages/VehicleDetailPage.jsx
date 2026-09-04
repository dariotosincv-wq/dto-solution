import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { canManageVehicles } from "../access.js";
import {
  createCompanyDamageWithPhoto,
  loadDamagePhoto,
  loadCompanyVehicles,
  loadVehicleDamages,
  loadVehicleReports,
  resolveVehicleReport,
  updateCompanyVehicle,
  updateVehicleDamage,
} from "../lib/companySupabase.js";
import { COMPANY_ROUTES } from "../routes.js";
import DamageMap from "../components/DamageMap.jsx";
import { damageClickKey, removeOperationalDamage, reserveDamageClick, restoreOperationalDamage, selectDamageTool, updateDamageOptimistically } from "../lib/damageMapState.js";
import { toggleVehicleStatusOptimistically } from "../lib/vehicleStatusState.js";
import { VEHICLE_REPORT_LABELS, resolveReportOptimistically } from "../lib/vehicleReports.js";
const damageStatusLabel = { PENDING: "In attesa", CONFIRMED: "Confermato", REJECTED: "Annullato", REPAIRED: "Riparato", REMOVED: "Rimosso" };
export default function VehicleDetailPage() {
  const { vehicleId } = useParams(),
    { access, session } = useAuth(),
    [vehicle, setVehicle] = useState(null),
    [damages, setDamages] = useState([]),
    [reports, setReports] = useState([]),
    [view, setView] = useState("FRONT"),
    [tool, setTool] = useState("SCRATCH"),
    [selected, setSelected] = useState(null),
    [moving, setMoving] = useState(false),
    [draft, setDraft] = useState(null),
    [draftPhoto, setDraftPhoto] = useState(null),
    [draftPhotoUrl, setDraftPhotoUrl] = useState(""),
    [photoModal, setPhotoModal] = useState(null),
    [savingDraft, setSavingDraft] = useState(false),
    [statusUpdating, setStatusUpdating] = useState(false),
    [decisionNote, setDecisionNote] = useState(""),
    [error, setError] = useState("");
  const pendingAdds = useRef(new Set());
  const toolRef = useRef("SCRATCH");
  const movingRef = useRef(null);
  const photoCache = useRef(new Map());
  const photoRequests = useRef(new Map());
  const cameraInputRef = useRef(null);
  const pickerInputRef = useRef(null);
  const refresh = useCallback(async () => {
    try {
      const [v, d, technical] = await Promise.all([
        loadCompanyVehicles(session.access_token),
        loadVehicleDamages(session.access_token, vehicleId),
        loadVehicleReports(session.access_token, vehicleId),
      ]);
      setVehicle(v.items.find((x) => x.vehicle_id === vehicleId));
      setDamages(d.items);
      setReports(technical.items);
    } catch {
      setError("Dati veicolo non disponibili.");
    }
  }, [session.access_token, vehicleId]);
  useEffect(() => {
    if (!canManageVehicles(access)) return undefined;
    const timeoutId = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [access, refresh]);
  useEffect(() => {
    if (!photoModal) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setPhotoModal(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [photoModal]);
  useEffect(() => {
    let url = "";
    const timeoutId = window.setTimeout(() => {
      if (!draftPhoto) { setDraftPhotoUrl(""); return; }
      url = URL.createObjectURL(draftPhoto);
      setDraftPhotoUrl(url);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      if (url) URL.revokeObjectURL(url);
    };
  }, [draftPhoto]);
  if (!canManageVehicles(access))
    return <Navigate to={COMPANY_ROUTES.dashboard} replace />;
  if (!vehicle)
    return <div className="company-page">{error || "Caricamento…"}</div>;
  const add = async (x, y) => {
    if (vehicle.status !== "active") return;
    const activeTool = toolRef.current;
    const key = damageClickKey(view, activeTool, x, y); if (!reserveDamageClick(pendingAdds.current, key)) return;
    setDraft({ vehicle_id: vehicleId, damage_type: activeTool, vehicle_view: view, normalized_x: x, normalized_y: y, clientId: crypto.randomUUID(), key }); setDraftPhoto(null);
  };
  const saveDraft = async () => { if (!draftPhoto || savingDraft) return; setSavingDraft(true); setError(""); try { const saved = await createCompanyDamageWithPhoto(session.access_token, draft, draftPhoto, draft.clientId); setDamages((items) => [...items, saved]); pendingAdds.current.delete(draft.key); setDraft(null); setDraftPhoto(null) } catch { setError("Caricamento foto non riuscito. Puoi riprovare.") } finally { setSavingDraft(false) } };
  const positionDamage = (x, y) => { const damage = movingRef.current; if (damage) { movingRef.current = null; setMoving(false); void patch({ ...damage, normalized_x: x, normalized_y: y }) } else void add(x, y) };
  const patch = async (value) => {
    const removing = value.action === "REMOVE";
    if (vehicle.status !== "active" && !removing) return;
    setError("");
    if (!value.action) {
      try { const saved = await updateDamageOptimistically({ items: damages, damage: selected, changes: value, setItems: setDamages, request: (optimistic) => updateVehicleDamage(session.access_token, optimistic) }); setSelected(saved); movingRef.current = null; setMoving(false) } catch { setError("Modifica marker non riuscita.") } return;
    }
    if (removing) {
      setDamages((items) => removeOperationalDamage(items, value.damage_id));
      setSelected(null);
      setMoving(false);
    }
    try {
      const saved = await updateVehicleDamage(session.access_token, value);
      setDamages((items) => saved.status === "REMOVED" ? removeOperationalDamage(items, saved.damage_id) : items.map((item) => item.damage_id === saved.damage_id ? saved : item));
      setSelected(null);
      setMoving(false);
    } catch {
      if (removing) {
        setDamages((items) => restoreOperationalDamage(items, value));
        setSelected(value);
      }
      setError("Modifica marker non riuscita.");
    }
  };
  const toggleVehicleStatus = async () => {
    if (statusUpdating) return;
    await toggleVehicleStatusOptimistically({
      vehicle,
      setVehicle,
      setUpdating: setStatusUpdating,
      setError,
      request: (optimistic) => updateCompanyVehicle(session.access_token, vehicleId, optimistic),
    });
  };
  const resolveTechnicalReport=async(report)=>{if(!window.confirm('Confermare che la segnalazione è stata risolta?'))return;setError('');try{await resolveReportOptimistically({report,items:reports,setItems:setReports,request:()=>resolveVehicleReport(session.access_token,report.report_id)})}catch{setError('Risoluzione segnalazione non riuscita.')}};
  const viewPhoto = async (damage, force = false) => {
    setPhotoModal({ damageId: damage.damage_id, status: "loading", url: "" });
    try {
      const cached = photoCache.current.get(damage.damage_id);
      if (!force && cached?.expiresAt > Date.now()) { setPhotoModal({ damageId: damage.damage_id, status: "image-loading", url: cached.url }); return; }
      let request = photoRequests.current.get(damage.damage_id);
      if (!request) { request = loadDamagePhoto(session.access_token, damage.damage_id).finally(() => photoRequests.current.delete(damage.damage_id)); photoRequests.current.set(damage.damage_id, request); }
      const { signedUrl, expiresIn } = await request;
      photoCache.current.set(damage.damage_id, { url: signedUrl, expiresAt: Date.now() + Math.max(30, expiresIn - 15) * 1000 });
      setPhotoModal({ damageId: damage.damage_id, status: "image-loading", url: signedUrl });
    } catch {
      setPhotoModal({ damageId: damage.damage_id, status: "error", url: "" });
    }
  };
  return (
    <div className="company-page">
      <header>
        <Link to={COMPANY_ROUTES.vehicles}>← Veicoli</Link>
        <p className="company-kicker">{vehicle.silhouette_category}</p>
        <h1>
          {vehicle.internal_code} · {vehicle.plate}
        </h1>
      </header>
      {error && <p className="notice notice--error">{error}</p>}
      {vehicle.status !== "active" && <p className="notice notice--warning"><strong>Veicolo disattivato.</strong> Resta consultabile nello storico, ma non può ricevere nuovi danni finché non viene riattivato.</p>}
      <div className="vehicle-controls">
        <label>
          Categoria sagoma
          <select
            aria-label="Categoria sagoma"
            value={vehicle.silhouette_category}
            onChange={async (event) => {
              await updateCompanyVehicle(session.access_token, vehicleId, {
                ...vehicle,
                silhouette_category: event.target.value,
              });
              await refresh();
            }}
          >
            <option>EXTRA_SMALL</option>
            <option>SMALL</option>
            <option>MEDIUM</option>
            <option>LARGE</option>
          </select>
        </label>
        <button className="vehicle-disable" onClick={toggleVehicleStatus} disabled={statusUpdating} aria-busy={statusUpdating}>
          {vehicle.status === "active" ? "Disattiva veicolo" : "Riattiva veicolo"}
        </button>
      </div>
      <div className="damage-tools">
        <button
          className={tool === "SCRATCH" ? "active" : ""}
          disabled={vehicle.status !== "active"}
          onClick={() => selectDamageTool(toolRef, setTool, "SCRATCH")}
        >
          X Graffio
        </button>
        <button
          className={tool === "DENT" ? "active" : ""}
          disabled={vehicle.status !== "active"}
          onClick={() => selectDamageTool(toolRef, setTool, "DENT")}
        >
          O Ammaccatura
        </button>
      </div>
      <DamageMap
        category={vehicle.silhouette_category}
        damages={damages}
        view={view}
        onView={setView}
        onAdd={positionDamage}
        onMove={positionDamage}
          onSelect={(damage) => { setSelected(damage); setMoving(false); setDecisionNote(damage.decision_note || ""); }}
        selected={selected}
        moving={moving}
        disabled={vehicle.status !== "active"}
      />
      <section className="vehicle-reports"><h2>Segnalazioni aperte</h2>{reports.filter(item=>item.status==='OPEN').length?reports.filter(item=>item.status==='OPEN').map(item=><article className="vehicle-report vehicle-report--open" key={item.report_id}><strong>🔴 {VEHICLE_REPORT_LABELS[item.report_type]||item.report_type}</strong>{item.description&&<p>{item.description}</p>}<small>Segnalato: {new Date(item.reported_at).toLocaleString('it-IT')}{item.driver?` · Driver: ${item.driver}`:''}</small><button onClick={()=>void resolveTechnicalReport(item)}>Segna come risolta</button></article>):<p>Nessuna segnalazione aperta.</p>}<h2>Storico segnalazioni</h2>{reports.filter(item=>item.status==='RESOLVED').map(item=><article className="vehicle-report" key={item.report_id}><strong>{VEHICLE_REPORT_LABELS[item.report_type]||item.report_type}</strong>{item.description&&<p>{item.description}</p>}<small>Segnalato {new Date(item.reported_at).toLocaleDateString('it-IT')} · Risolto {new Date(item.resolved_at).toLocaleDateString('it-IT')}</small></article>)}</section>
      {selected && (
        <section className="damage-editor">
          <h2>Marker {selected.status}</h2>
          {selected.photo_available && <button onClick={() => viewPhoto(selected)}>Vedi foto</button>}
          {vehicle.status === "active" && selected.status === "PENDING" && <button onClick={() => { movingRef.current = selected; setMoving(true); }}>Sposta</button>}
          {moving && <button onClick={() => { movingRef.current = null; setMoving(false); }}>Annulla spostamento</button>}
          {moving && <p>Seleziona la nuova posizione sulla sagoma.</p>}
          {vehicle.status === "active" && selected.status === "PENDING" && (
            <>
              <label>Nota del responsabile (facoltativa)<textarea value={decisionNote} maxLength={1000} onChange={(event) => setDecisionNote(event.target.value)} /></label>
              <button onClick={() => patch({ ...selected, action: "APPROVE", note: decisionNote })}>
                Approva
              </button>
              <button onClick={() => patch({ ...selected, action: "REJECT", note: decisionNote })}>
                Rifiuta
              </button>
            </>
          )}
          {vehicle.status === "active" && selected.status === "CONFIRMED" && (
            <button onClick={() => patch({ ...selected, action: "REPAIR" })}>Segna come riparato</button>
          )}
          {selected.status === "PENDING" && vehicle.status === "active" && (
            <>
              <button
                onClick={() =>
                  patch({
                    ...selected,
                    damage_type:
                      selected.damage_type === "SCRATCH" ? "DENT" : "SCRATCH",
                  })
                }
              >
                Cambia tipo
              </button>
            </>
          )}
          {["PENDING", "CONFIRMED", "REPAIRED"].includes(selected.status) && (
            <button className="damage-action--danger" onClick={() => {
              if (window.confirm("Eliminare questo danno dalla mappa operativa?")) void patch({ ...selected, action: "REMOVE" });
            }}>{selected.status === "PENDING" ? "Annulla segnalazione" : "Elimina"}</button>
          )}
          <button onClick={() => { setSelected(null); setMoving(false); }}>Chiudi</button>
        </section>
      )}
      <section className="table-card">
        <h2>Storico danni</h2>
        <ul className="damage-history">
          {damages.filter((d) => ["CONFIRMED", "REPAIRED"].includes(d.status)).map((d) => (
            <li key={d.damage_id}>
              <strong>
                {d.damage_type} · {d.vehicle_view}
              </strong>
              <span
                className={`damage-status damage-status--${d.status.toLowerCase()}`}
              >
                {damageStatusLabel[d.status] || d.status}
              </span>
              <small>{new Date(d.reported_at).toLocaleString("it-IT")}</small>
              <div className="damage-history__actions">
                {vehicle.status === "active" && d.status === "REPAIRED" && (
                  <button
                    className="damage-action--reopen"
                    onClick={() => {
                      if (window.confirm("Annullare la riparazione? Il danno tornerà attivo sulla sagoma.")) void patch({ ...d, action: "REOPEN" });
                    }}
                  >
                    Annulla riparazione
                  </button>
                )}
                <button
                  className="damage-action--delete"
                  onClick={() => {
                    if (window.confirm("Eliminare questo danno dalla mappa operativa?")) void patch({ ...d, action: "REMOVE" });
                  }}
                >
                  Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {draft && <div className="damage-photo-modal" role="dialog" aria-modal="true" aria-labelledby="damage-photo-title"><section><h2 id="damage-photo-title">Aggiungi foto del danno</h2><p>Scegli come aggiungere la foto richiesta.</p><div className="damage-photo-source-actions"><button type="button" disabled={savingDraft} onClick={() => cameraInputRef.current?.click()}>Scatta foto</button><button type="button" disabled={savingDraft} onClick={() => pickerInputRef.current?.click()}>Scegli foto</button></div><input ref={cameraInputRef} className="visually-hidden" aria-label="Scatta foto del danno" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { setDraftPhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} /><input ref={pickerInputRef} className="visually-hidden" aria-label="Scegli foto dalla galleria" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setDraftPhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} />{draftPhotoUrl && <div className="damage-photo-preview"><strong>Foto selezionata</strong><img src={draftPhotoUrl} alt="Anteprima foto danno" /><small>{draftPhoto?.name}</small></div>}<div><button disabled={!draftPhoto || savingDraft} onClick={() => void saveDraft()}>{savingDraft ? "Salvataggio…" : "Salva danno"}</button><button disabled={savingDraft} onClick={() => { pendingAdds.current.delete(draft.key); setDraft(null); setDraftPhoto(null); }}>Annulla</button></div></section></div>}
      {photoModal && <div className="damage-photo-modal damage-photo-viewer" role="dialog" aria-modal="true" aria-label="Foto del danno" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoModal(null); }}><section onMouseDown={(event) => event.stopPropagation()}><button className="damage-photo-close" aria-label="Chiudi foto" onClick={() => setPhotoModal(null)}>×</button>{["loading", "image-loading"].includes(photoModal.status) && <p className="damage-photo-loading">Caricamento foto…</p>}{photoModal.url && <img className={photoModal.status === "success" ? "is-ready" : ""} src={photoModal.url} alt="Foto del danno" onLoad={() => setPhotoModal((current) => current ? { ...current, status: "success" } : current)} onError={() => setPhotoModal((current) => current ? { ...current, status: "error", url: "" } : current)} />}{photoModal.status === "error" && <div className="damage-photo-error"><p>Impossibile caricare la foto. Riprova.</p><button onClick={() => { const damage = damages.find((item) => item.damage_id === photoModal.damageId); if (damage) void viewPhoto(damage, true); }}>Riprova</button></div>}</section></div>}
    </div>
  );
}
