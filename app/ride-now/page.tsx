"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import RequireSession from "../components/RequireSession";
import Link from "../components/AppLink";
import { useAppRouter } from "../components/useAppRouter";
import { GuestPassengerForm, emptyGuestChoice, type GuestChoice } from "../components/GuestPassenger";
import styles from "./ride-now.module.css";

type Offer = { id: string; vehicle: string; price: number; pickupMinutes: number; durationMinutes: number; expiresAt: string };
type InstantRequest = {
  id: string; version: string; from: string; to: string; status: string; expiresAt: string; bookingId?: string; forGuest?: boolean; travelFor?: string;
  offer?: Offer; offers?: Offer[];
};
async function api(body?: object) {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para continuar.");
  const response = await fetch("/api/ride-now", { method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "No se pudo actualizar la solicitud.");
  return value;
}
export default function RideNowPage() {
  return <RequireSession purpose="Entra en tu cuenta para solicitar o atender un viaje inmediato."><RideNowContent /></RequireSession>;
}
function RideNowContent() {
  const router = useAppRouter();
  const [requests, setRequests] = useState<InstantRequest[]>([]);
  const [driver, setDriver] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Buscando solicitudes…");
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [guest, setGuest] = useState<GuestChoice>(emptyGuestChoice);
  const refresh = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    try { const value = await api(); if (auth.currentUser?.uid !== uid) return;
      setRequests(value.requests); setDriver(value.driver); setReady(true); setMessage("");
    } catch (error) { if (auth.currentUser?.uid === uid) setMessage(error instanceof Error ? error.message : "No se pudo cargar."); }
  }, []);
  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("guest") === "1") setGuest({ ...emptyGuestChoice, travelFor: "guest" });
    const unsubscribe = onAuthStateChanged(auth, () => { void refresh(); });
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [refresh]);
  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await api(body);
      if (result.bookingId) { router.push("/my-bookings"); return; }
      await refresh();
      setMessage(body.action === "request" ? "Solicitud enviada a todos los conductores autorizados. Espera sus propuestas; todavía no tienes un conductor asignado." : body.action === "offer" ? "Propuesta enviada. Espera que el pasajero la acepte." : body.action === "decline" ? "Solicitud rechazada. Otros conductores pueden atenderla." : "Solicitud cancelada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar."); }
    finally { setBusy(false); }
  }
  const open = requests.some(r => r.status === "open" && Date.parse(r.expiresAt) > Date.now());
  return <main className={styles.page}>
    <header className={styles.hero}>
      <Link href="/dashboard">← Mi panel</Link>
      <p className={styles.eyebrow}>ROADLINK · PARA AHORA</p>
      <h1>{driver ? "Solicitudes de viajes de último minuto" : "Solicitar viaje de último minuto"}</h1>
      <p>{driver ? "Alguien necesita viajar de inmediato. Puedes aceptar la solicitud con una propuesta o rechazarla." : "Indica dónde recoger al pasajero y adónde va. Revisa la propuesta del conductor antes de reservar."}</p>
      <p className={styles.notice}>Piloto privado · pagos de prueba. Se avisa a todos los conductores autorizados dentro de la app. El pasajero elige una propuesta antes de reservar. No hay disponibilidad garantizada ni seguimiento GPS en esta sección.</p>
      <button type="button" disabled={busy} onClick={() => void refresh()}>Actualizar solicitudes</button>
    </header>
    {message && <p role="status" aria-live="polite" className={styles.feedback}>{message}</p>}
    {ready && !driver && !open && <form className={styles.card} onSubmit={e => { e.preventDefault(); void act({ action: "request", from, to, ...guest }); }}>
      <h2>¿Dónde necesitas la recogida?</h2>
      <label>Punto exacto de recogida<input required minLength={3} maxLength={200} value={from} onChange={e => setFrom(e.target.value)} placeholder="Dirección y punto de encuentro" /></label>
      <label>Destino<input required minLength={3} maxLength={200} value={to} onChange={e => setTo(e.target.value)} placeholder="Dirección de destino" /></label>
      <GuestPassengerForm value={guest} onChange={setGuest} />
      <button disabled={busy} type="submit">{busy ? "Enviando…" : "Solicitar viaje de último minuto"}</button>
      <p>La solicitud vence en 15 minutos. No se cobra ni reserva un asiento al enviarla.</p>
    </form>}
    <section aria-label={driver ? "Solicitudes de viajes de último minuto" : "Mi solicitud"} className={styles.list}>
      {ready && driver && !requests.length && <div className={styles.card}><h2>No hay solicitudes abiertas</h2><p>Las nuevas solicitudes aparecerán aquí. Recibirás una alerta dentro de la app mientras esté abierta.</p></div>}
      {requests.map(request => <RequestCard key={request.version} request={request} driver={driver} busy={busy} act={act} />)}
    </section>
    <nav className={styles.links}><Link href="/find-ride">Viajes programados</Link><Link href="/my-bookings">Mis reservas</Link><Link href="/my-rides">Mis viajes</Link></nav>
  </main>;
}
function RequestCard({ request, driver, busy, act }: { request: InstantRequest; driver: boolean; busy: boolean; act: (body: Record<string, unknown>) => Promise<void> }) {
  const [price, setPrice] = useState(""), [vehicle, setVehicle] = useState(""), [pickup, setPickup] = useState("10"), [duration, setDuration] = useState("20");
  const expired = Date.parse(request.expiresAt) <= Date.now(), open = request.status === "open" && !expired;
  const liveOffers = (driver ? (request.offer ? [request.offer] : []) : (request.offers || (request.offer ? [request.offer] : []))).filter(offer => Date.parse(offer.expiresAt) > Date.now());
  return <article className={styles.card}>
    <p className={styles.eyebrow}>{request.forGuest || request.travelFor === "guest" ? "RECOGIDA PARA INVITADO" : "SOLICITUD DE RECOGIDA"}</p>
    <h2>{request.from} → {request.to}</h2>
    <p>{request.status === "accepted" ? "Conductor asignado. Continúa en Mis reservas para el pago de prueba." : request.status === "cancelled" ? "Solicitud cancelada." : expired ? "Solicitud caducada. Puedes enviar una nueva." : "Esperando propuesta y aceptación."}</p>
    {request.status === "accepted" && <Link href="/my-bookings">Ver reserva y pagar en pruebas</Link>}
    {open && liveOffers.map(offer => <div key={offer.id} className={styles.quote}>
      <h3>Propuesta: ${offer.price.toFixed(2)} por el viaje</h3>
      <p>{offer.vehicle} · recogida estimada en {offer.pickupMinutes} minutos · recorrido de {offer.durationMinutes} minutos.</p>
      <p>La propuesta vence a las {new Date(offer.expiresAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Puerto_Rico" })}.</p>
      {!driver && <button disabled={busy} onClick={() => void act({ action: "accept", version: request.version, offerId: offer.id, offerExpiresAt: offer.expiresAt })}>Aceptar propuesta y reservar · ${offer.price.toFixed(2)}</button>}
    </div>)}
    {driver && open && <form onSubmit={e => { e.preventDefault(); void act({ action: "offer", requestId: request.id, version: request.version, price: Number(price), vehicle, pickupMinutes: Number(pickup), durationMinutes: Number(duration) }); }}>
      <label>Precio total de prueba ($)<input required type="number" min="0.50" max="1000" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label>
      <label>Vehículo<input required minLength={2} maxLength={80} value={vehicle} onChange={e => setVehicle(e.target.value)} /></label>
      <div className={styles.columns}><label>Minutos hasta recoger<input required type="number" min="2" max="30" value={pickup} onChange={e => setPickup(e.target.value)} /></label><label>Duración del recorrido (min)<input required type="number" min="5" max="240" value={duration} onChange={e => setDuration(e.target.value)} /></label></div>
      <button disabled={busy} type="submit">Aceptar solicitud y enviar propuesta</button>
      <p>Revisa tus tiempos antes de ofrecerte. No se asigna el viaje hasta que el pasajero acepte.</p>
    </form>}
    {driver && open && <button className={styles.secondary} disabled={busy} onClick={() => void act({ action: "decline", requestId: request.id, version: request.version })}>Rechazar solicitud</button>}
    {!driver && open && <button className={styles.secondary} disabled={busy} onClick={() => void act({ action: "cancel", version: request.version })}>Cancelar solicitud</button>}
  </article>;
}
