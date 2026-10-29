"use client";
import { GuestPassengerSummary } from "../components/GuestPassenger";

import { useAppExperience } from "../components/AppExperience";
import Link from "../components/AppLink";
import RequireSession from "../components/RequireSession";
import { canPayBooking } from "../../lib/booking-payment";
import ProfileIdentity from "../components/ProfileIdentity";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Booking = {
  guest?: { name: string; phone: string; notes: string } | null;
  travelFor?: string;
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  status?: string;
  paymentStatus?: string;
  paymentId?: string;
  stripeCheckoutSessionId?: string;
  createdAt?: string;
};

export default function MyBookingsPage() {
  return <RequireSession purpose="Entra en tu cuenta para consultar y gestionar tus reservas."><Suspense fallback={<p role="status">Cargando reservas…</p>}><MyBookingsContent /></Suspense></RequireSession>;
}

function MyBookingsContent() {
  const appExperience = useAppExperience();
  const [userId, setUserId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("reserva");
  const filter = ["activas", "historial", "todas"].includes(searchParams.get("vista") || "") ? searchParams.get("vista")! : "activas";
  const requestedPage = Math.max(1, Number(searchParams.get("pagina")) || 1);
  const isHistory = (booking: Booking) => ["completed", "cancelled", "rejected"].includes(booking.status || "") || ["refunded", "partially_refunded"].includes(booking.paymentStatus || "");
  const filtered = bookings.filter(booking => filter === "todas" || (filter === "historial" ? isHistory(booking) : !isHistory(booking)));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 3));
  const page = Math.min(pageCount, Math.floor(Number.isFinite(requestedPage) ? requestedPage : 1));
  const listUrl = `/my-bookings?vista=${filter}&pagina=${page}`;
  const visibleBookings = selectedId ? bookings.filter(booking => booking.id === selectedId) : filtered.slice((page - 1) * 3, page * 3);
  const [message, setMessage] = useState("Cargando tus reservas…");
  const [payingId, setPayingId] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState<{ bookingId: string; text: string } | null>(null);

  useEffect(() => {
    let unsubscribeByUid: (() => void) | undefined;
    let unsubscribeByEmail: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeByUid?.();
      unsubscribeByEmail?.();
      unsubscribeByUid = undefined;
      unsubscribeByEmail = undefined;
      setBookings([]);
      setUserId(user?.uid || "");
      if (!user) {
        setMessage("Inicia sesión para ver tus reservas.");
        setBookings([]);
        return;
      }

      const email = user.email || "";

      setUserId(user.uid);

      const mergeBookings = (uidBookings: Booking[], emailBookings: Booking[]) => {
        if (auth.currentUser?.uid !== user.uid) return;
        const map = new Map<string, Booking>();

        [...uidBookings, ...emailBookings].forEach((booking) => {
          map.set(booking.id, booking);
        });

        const merged = Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.createdAt || "").getTime() -
            new Date(a.createdAt || "").getTime()
        );

        setBookings(merged);
        setMessage("");
      };

      let uidResults: Booking[] = [];
      let emailResults: Booking[] = [];

      const uidQuery = query(
        collection(db, "bookings"),
        where("passengerId", "==", user.uid)
      );

      unsubscribeByUid = onSnapshot(
        uidQuery,
        (snapshot) => {
          uidResults = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[];

          mergeBookings(uidResults, emailResults);
        },
        (error) => setMessage(error.message)
      );

      if (email) {
        const emailQuery = query(
          collection(db, "bookings"),
          where("passengerEmail", "==", email)
        );

        unsubscribeByEmail = onSnapshot(
          emailQuery,
          (snapshot) => {
            emailResults = snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as Booking[];

            mergeBookings(uidResults, emailResults);
          },
          (error) => setMessage(error.message)
        );
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeByUid) unsubscribeByUid();
      if (unsubscribeByEmail) unsubscribeByEmail();
    };
  }, []);

  async function startPayment(booking: Booking) {
    if (!userId) {
      setMessage("Inicia sesión primero.");
      return;
    }

    if (!booking.id) return;
    if (!canPayBooking(booking)) {
      setPaymentFeedback({ bookingId: booking.id, text: "Esta reserva ya no admite pagos. Actualiza la página para consultar su estado." });
      return;
    }

    try {
      setPayingId(booking.id);
      setMessage("Abriendo el pago seguro…");
      setPaymentFeedback({ bookingId: booking.id, text: "Abriendo el pago seguro de Stripe…" });

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Inicia sesión primero.");
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: booking.id, appExperience,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "No se pudo preparar el pago seguro.");
      }

      window.location.href = data.url;
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "No se pudo abrir el pago seguro.";
      setMessage(text);
      setPaymentFeedback({ bookingId: booking.id, text });
      setPayingId("");
    }
  }

  async function cancelBooking(booking: Booking) {
    if (!booking.id) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Inicia sesión primero.");
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cancelar la reserva.");
      setMessage("Reserva cancelada.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar la reserva.");
    }
  }

  function bookingTotal(booking: Booking) {
    return Number(booking.amount || booking.price || 0) * Number(booking.seatsBooked || 1);
  }

  function money(value: number) {
    return new Intl.NumberFormat("es-PR", { style: "currency", currency: "USD" }).format(value);
  }

  function statusLabel(status?: string, paymentStatus?: string) {
    if (paymentStatus === "refunded") return "Reembolsado";
    if (paymentStatus === "partially_refunded") return "Reembolso parcial";
    if (status === "completed") return "Completado";
    if (paymentStatus === "paid") return "Pagado";
    if (paymentStatus === "pending") return "Pago pendiente";
    if (status === "payment_pending") return "Pago pendiente";
    if (status === "confirmed") return "Confirmado";
    if (status === "completed") return "Completado";
    if (status === "cancelled") return "Cancelado";
    if (status === "rejected") return "Rechazado";
    if (status === "paid") return "Pagado";
    if (status === "reserved") return "Reservado";
    if (status === "pending") return "Pendiente";
    return "Sin datos";
  }

  function statusClass(status?: string, paymentStatus?: string) {
    if (["refunded", "partially_refunded"].includes(paymentStatus || "")) return "done";
    if (paymentStatus === "paid" || status === "paid") return "paid";
    if (paymentStatus === "pending" || status === "payment_pending") return "pending";
    if (status === "cancelled" || status === "rejected") return "bad";
    if (status === "completed") return "done";
    return "active";
  }

  return (
    <main className="page">
      <section className="container">
        <header className="bookingHeader">
          {selectedId && <Link href={listUrl} className="backLink">← Mis reservas</Link>}
          <h1>{selectedId ? "Detalle de reserva" : "Mis reservas"}</h1>
          {!selectedId && <p>{bookings.length} reservas · Consulta un viaje para ver sus detalles.</p>}
        </header>
        {message && <p className="message" role="status">{message}</p>}
        {!selectedId && <nav className="bookingTabs" aria-label="Filtrar reservas">
          {([['activas', 'Activas'], ['historial', 'Historial'], ['todas', 'Todas']] as const).map(([value, label]) =>
            <Link key={value} href={`/my-bookings?vista=${value}`} aria-current={filter === value ? "page" : undefined}>{label}</Link>
          )}
        </nav>}
        <section className="bookingsPanel" aria-label={selectedId ? "Detalle de reserva" : "Lista de reservas"}>
          {visibleBookings.length === 0 ? (
            <section className="empty">
              <h2>{selectedId ? "Reserva no disponible" : "No hay reservas en esta página"}</h2>
              <p>{selectedId ? "Vuelve a la lista para consultar tus reservas." : "Prueba otra sección o busca tu próximo viaje."}</p>
              <Link href="/find-ride" className="emptyButton">Buscar un viaje</Link>
            </section>
          ) : (
            <div className="bookingGrid">
              {visibleBookings.map((booking) => {
                const total = bookingTotal(booking);
                const platformFee = Math.round(total * 0.12 * 100) / 100;
                const driverAmount = Math.max(total - platformFee, 0);
                const isPaid = booking.paymentStatus === "paid" || booking.status === "paid";
                const isCancelled = booking.status === "cancelled" || booking.status === "rejected";

                return (
                  <section key={booking.id} className={`bookingCard ${selectedId ? "bookingDetail" : "bookingPreview"}`}>
                    <div className="cardTop">
                      <div>
                        <h3>{booking.from || "Origen"} → {booking.to || "Destino"}</h3>
                        <p>{booking.date || "Fecha pendiente"} • {booking.time || "Hora pendiente"}</p>
                      </div>

                      <span className={`pill ${statusClass(booking.status, booking.paymentStatus)}`}>
                        {statusLabel(booking.status, booking.paymentStatus)}
                      </span>
                    </div>

                    {!selectedId ? <div className="compactFooter">
                      <strong>{money(total)}</strong>
                      <Link className="linkButton" href={`${listUrl}&reserva=${encodeURIComponent(booking.id)}`}>Ver detalle →</Link>
                    </div> : <>
                    <GuestPassengerSummary guest={booking.guest} />
                    <div className="routeBox">
                      <div>
                        <span>Origen</span>
                        <strong>{booking.from || "No disponible"}</strong>
                      </div>
                      <div>
                        <span>Destino</span>
                        <strong>{booking.to || "No disponible"}</strong>
                      </div>
                    </div>

                    <div className="infoGrid">
                      <Info label="Asientos" value={String(booking.seatsBooked || 1)} />
                      <Info label="Total del viaje" value={money(total)} />
                      <Info label="Comisión de la plataforma" value={money(platformFee)} />
                      <Info label="Importe del conductor" value={money(driverAmount)} />
                    </div>
                    <div className="driverIdentity"><ProfileIdentity uid={booking.driverId} name={booking.driverEmail} role="Conductor" /></div>
                    <details className="paymentReference"><summary>Referencia del pago</summary><p>{booking.paymentId || "Sin crear"}</p></details>
                    <div>
                    </div>

                    {paymentFeedback?.bookingId === booking.id && <p role="status" aria-live="polite">{paymentFeedback.text}</p>}
                    <div className="actions">
                      {canPayBooking(booking) && (
                        <button
                          className="payButton"
                          onClick={() => startPayment(booking)}
                          disabled={payingId === booking.id}
                        >
                          {payingId === booking.id ? "Abriendo pago…" : "Pagar ahora"}
                        </button>
                      )}

                      {!isCancelled && booking.status !== "completed" && !isPaid && (
                        <button
                          className="dangerButton"
                          onClick={() => cancelBooking(booking)}
                          disabled={payingId === booking.id}
                        >
                          Cancelar
                        </button>
                      )}

                      {booking.rideId && (
                        <Link href={`/chat?rideId=${booking.rideId}`} className="linkButton">
                          Escribir al conductor
                        </Link>
                      )}
                    </div>
                    </>}
                  </section>
                );
              })}
            </div>
          )}
        </section>
        {!selectedId && filtered.length > 0 && <nav className="pagination" aria-label="Páginas de reservas">
          {page > 1 ? <Link href={`/my-bookings?vista=${filter}&pagina=${page - 1}`} className="linkButton">← Anterior</Link> : <span />}
          <span aria-live="polite">Página {page} de {pageCount}</span>
          {page < pageCount ? <Link href={`/my-bookings?vista=${filter}&pagina=${page + 1}`} className="linkButton">Siguiente →</Link> : <span />}
        </nav>}
      </section>

      <style>{`
        .page { min-height:100vh; padding:20px 16px 130px; color:#f3f0e8; background:#070d11; }
        .page .container { max-width:760px; margin:auto; }
        .page .bookingHeader { margin-bottom:18px; }
        .page h1 { font-size:30px; margin:8px 0; }
        .page .bookingHeader p { color:#a9b0ad; font-size:14px; margin:0; }
        .page .backLink { color:#d9c39d; font-size:14px; }
        .page .bookingTabs { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
        .page .bookingTabs a { text-align:center; padding:12px 8px; border:1px solid #cdb68c44; border-radius:8px; color:#b3bab5; text-decoration:none; }
        .page .bookingTabs a[aria-current] { background:#cdb68c22; color:#d9c39d; border-color:#d9c39d; }
        .page .bookingGrid { display:grid; gap:12px; }
        .page .bookingCard { padding:16px; min-width:0; }
        .page .cardTop { display:flex; flex-direction:column-reverse; align-items:flex-start; gap:10px; }
        .page .cardTop > div { min-width:0; width:100%; }
        .page .bookingCard h3 { font-size:19px; margin:0 0 8px; overflow-wrap:anywhere; }
        .page .bookingPreview h3 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .page .bookingCard p { color:#a9b0ad; font-size:14px; margin:0; line-height:1.5; }
        .page .pill { font-size:12px; padding:5px 9px; border-radius:6px; background:#d9c39d1a; color:#d9c39d; }
        .page .pill.pending { color:#facc15; background:#facc151a; }
        .page .pill.bad { color:#fca5a5; background:#ef44441a; }
        .page .pill.paid,.page .pill.done { color:#86efac; background:#22c55e1a; }
        .page .compactFooter { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:14px; }
        .page .compactFooter strong { font-size:20px; color:#d9c39d; }
        .page .linkButton,.page .emptyButton,.page .actions button { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:10px 14px; border:1px solid #cdb68c44; border-radius:6px; color:#f3f0e8; background:#111e25; text-decoration:none; font-size:14px; cursor:pointer; }
        .page .routeBox,.page .infoGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:16px 0; }
        .page .routeBox div,.page .infoBox { padding:10px; border:1px solid #ffffff18; border-radius:8px; min-width:0; }
        .page .routeBox span,.page .infoBox span { display:block; color:#a9b0ad; font-size:12px; margin-bottom:6px; }
        .page .routeBox strong,.page .infoBox strong { font-size:14px; overflow-wrap:anywhere; }
        .page .driverIdentity { margin:16px 0; }
        .page .paymentReference { margin:16px 0; font-size:14px; overflow-wrap:anywhere; }
        .page summary { min-height:44px; cursor:pointer; }
        .page .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
        .page .dangerButton { color:#fca5a5; background:#ef44441a; }
        .page button:disabled { opacity:.6; cursor:not-allowed; }
        .page .pagination { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:10px; margin-top:16px; font-size:13px; }
        .page .pagination > :last-child { justify-self:end; }
        .page .message { color:#d9c39d; font-size:14px; }
        .page .empty { padding:20px; border:1px solid #cdb68c44; border-radius:12px; }
        .page .empty h2 { font-size:22px; }
        @media(max-width:380px) { .page .pagination { gap:6px; } .page .pagination .linkButton { padding:10px 8px; font-size:12px; } }
      `}</style>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "No disponible"}</strong>
    </div>
  );
}
