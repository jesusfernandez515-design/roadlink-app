"use client";

import { useState } from "react";
import { auth } from "../../lib/firebase";
import { useAppRouter } from "./useAppRouter";
import { GuestPassengerForm, type GuestChoice } from "./GuestPassenger";

export default function LastMinuteRequest({ guest, onChange }: { guest: GuestChoice; onChange: (value: GuestChoice) => void }) {
  const router = useAppRouter();
  const [expanded, setExpanded] = useState(false), [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!expanded) { setExpanded(true); return; }
    setBusy(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Inicia sesión para solicitar el viaje.");
      const response = await fetch("/api/ride-now", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", from, to, ...guest }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo enviar la solicitud.");
      router.push("/ride-now");
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo enviar la solicitud."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="lastMinuteRequest">
    {!expanded && <button className="primaryButton" type="button" aria-expanded={false} onClick={() => setExpanded(true)}>Solicitar viaje de último minuto</button>}
    {expanded && <div id="last-minute-route">
      <h2>Solicitar viaje de último minuto</h2>
      <p>Se avisa a todos los conductores autorizados. Tú eliges una propuesta antes de reservar.</p>
      <label>Punto exacto de recogida<input required minLength={3} maxLength={200} value={from} onChange={e => setFrom(e.target.value)} placeholder="Dirección y punto de encuentro" /></label>
      <label>Destino<input required minLength={3} maxLength={200} value={to} onChange={e => setTo(e.target.value)} placeholder="Dirección de destino" /></label>
    </div>}
    <GuestPassengerForm value={guest} onChange={onChange} />
    {expanded && <>
      <button className="primaryButton" disabled={busy} type="submit">{busy ? "Enviando…" : "Solicitar viaje de último minuto"}</button>
      <p>La solicitud vence en 15 minutos. No se realiza ningún cobro al enviarla.</p>
      <button className="outlineButton" disabled={busy} type="button" onClick={() => setExpanded(false)}>Volver a viajes programados</button>
    </>}
    {error && <p role="alert">{error}</p>}
    <style>{`.lastMinuteRequest{margin:0 0 24px;padding:20px;border:1px solid #43514c;border-radius:18px;background:#101b1f}.lastMinuteRequest>button{width:100%;min-height:48px}.lastMinuteRequest label{display:block;margin:14px 0}.lastMinuteRequest input:not([type=radio]):not([type=checkbox]),.lastMinuteRequest textarea{display:block;box-sizing:border-box;width:100%;padding:14px;margin-top:8px;color:#fff;background:#091216;border:1px solid #5a6a6b;border-radius:10px;font:inherit}.lastMinuteRequest p{line-height:1.6}.lastMinuteRequest button:disabled{opacity:.6}`}</style>
  </form>;
}
