"use client";

import { useAppExperience } from "../components/AppExperience";
import Link from "../components/AppLink";
import RequireSession from "../components/RequireSession";
import { canPayBooking } from "../../lib/booking-payment";
import ProfileIdentity from "../components/ProfileIdentity";
import { useEffect, useMemo, useState } from "react";
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
  return <RequireSession purpose="Entra en tu cuenta para consultar y gestionar tus reservas."><MyBookingsContent /></RequireSession>;
}

function MyBookingsContent() {
  const appExperience = useAppExperience();
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
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
      setUserEmail(user?.email || "");
      if (!user) {
        setMessage("Inicia sesión para ver tus reservas.");
        setBookings([]);
        return;
      }

      const email = user.email || "";

      setUserId(user.uid);
      setUserEmail(email);

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

  const metrics = useMemo(() => {
    const active = bookings.filter((item) =>
      ["reserved", "confirmed", "payment_pending", "paid"].includes(item.status || "")
    );

    const completed = bookings.filter((item) => item.status === "completed");

    const cancelled = bookings.filter((item) =>
      ["cancelled", "rejected"].includes(item.status || "")
    );

    const pendingPayment = bookings.filter(
      (item) => item.status === "payment_pending" || item.paymentStatus === "pending"
    );

    const paid = bookings.filter(
      (item) => item.paymentStatus === "paid" || item.status === "paid"
    );

    const totalValue = bookings.reduce((total, item) => total + bookingTotal(item), 0);

    return { active, completed, cancelled, pendingPayment, paid, totalValue };
  }, [bookings]);

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
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Mi panel</Link>
          <Link href="/find-ride" className="miniButton">Buscar viaje</Link>
          <Link href="/wallet" className="miniButton">Cartera</Link>
          <Link href="/profile" className="miniButton">Perfil</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Pasajero</p>
            <h1>Mis <span>reservas</span></h1>
            <p className="subtitle">
              Consulta tus reservas, pagos, historial de viajes y mensajes del conductor.
            </p>
          </div>

          <div className="scoreOrb">
            <strong translate="no">{bookings.length}</strong>
            <span>Total de reservas</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎟️" label="Reservas" value={String(bookings.length)} />
          <Metric icon="✅" label="Activas" value={String(metrics.active.length)} />
          <Metric icon="💳" label="Pago pendiente" value={String(metrics.pendingPayment.length)} />
          <Metric icon="💰" label="Pagado" value={String(metrics.paid.length)} />
          <Metric icon="🏁" label="Completado" value={String(metrics.completed.length)} />
          <Metric icon="❌" label="Cancelado" value={String(metrics.cancelled.length)} />
          <Metric icon="📊" label="Valor total" value={money(metrics.totalValue)} />
          <Metric icon="👤" label="Pasajero" value={userEmail || "Sin sesión"} />
        </section>

        <section className="bookingsPanel">
          <div className="sectionTop">
            <div>
              <p className="eyebrow">Reservas</p>
              <h2>Centro de reservas</h2>
            </div>
          </div>

          {bookings.length === 0 ? (
            <section className="empty">
              <h3>Aún no tienes reservas</h3>
              <p>Busca un viaje y reserva tu asiento para comenzar a viajar con RoadLink.</p>
              <Link href="/find-ride" className="emptyButton">Buscar un viaje</Link>
            </section>
          ) : (
            <div className="bookingGrid">
              {bookings.map((booking) => {
                const total = bookingTotal(booking);
                const platformFee = Math.round(total * 0.12 * 100) / 100;
                const driverAmount = Math.max(total - platformFee, 0);
                const isPaid = booking.paymentStatus === "paid" || booking.status === "paid";
                const isCancelled = booking.status === "cancelled" || booking.status === "rejected";

                return (
                  <section key={booking.id} className="bookingCard">
                    <div className="cardTop">
                      <div>
                        <h3>{booking.from || "Origen"} → {booking.to || "Destino"}</h3>
                        <p>{booking.date || "Fecha pendiente"} • {booking.time || "Hora pendiente"}</p>
                      </div>

                      <span className={`pill ${statusClass(booking.status, booking.paymentStatus)}`}>
                        {statusLabel(booking.status, booking.paymentStatus)}
                      </span>
                    </div>

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
                      <ProfileIdentity uid={booking.driverId} name={booking.driverEmail} role="Conductor" />
                      <Info label="Referencia del pago" value={booking.paymentId || "Sin crear"} />
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
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 20px;
          padding-bottom: 130px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(217,195,157,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #070d11, #0b1217, #10191e);
        }

        .container { max-width: 1180px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }

        .miniButton,
        .linkButton,
        .emptyButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
        }

        .miniButton { padding: 10px 15px; }

        .hero,
        .metric,
        .bookingsPanel,
        .bookingCard,
        .empty {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 22px 70px rgba(0,0,0,0.5);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 32px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 18px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d9c39d;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 { font-size: 52px; line-height: 1; margin: 0 0 12px; }
        h1 span, h2, .metricValue { color: #d9c39d; }
        h2 { margin: 0; font-size: 30px; }

        .subtitle,
        .bookingCard p,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 104px;
          height: 104px;
          border-radius: 50%;
          background: rgba(217,195,157,0.12);
          border: 1px solid rgba(217,195,157,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }

        .scoreOrb strong {
          color: #d9c39d;
          font-size: 34px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #d9c39d;
          font-weight: 900;
          margin: 14px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
        }

        .metricIcon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(217,195,157,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          font-size: 21px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .metricValue {
          display: block;
          font-size: 20px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .bookingsPanel {
          border-radius: 30px;
          padding: 24px;
        }

        .sectionTop { margin-bottom: 18px; }
        .bookingGrid { display: grid; gap: 14px; }

        .bookingCard {
          border-radius: 24px;
          padding: 20px;
          box-shadow: none;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .bookingCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .bookingCard p { margin: 0; }

        .pill {
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.active {
          color: #d9c39d;
          background: rgba(217,195,157,0.12);
          border: 1px solid rgba(217,195,157,0.35);
        }

        .pill.pending {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .pill.paid,
        .pill.done {
          color: #60a5fa;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .pill.bad {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .routeBox {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 14px;
        }

        .routeBox div,
        .infoBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .routeBox span,
        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .routeBox strong,
        .infoBox strong {
          display: block;
          overflow-wrap: anywhere;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .actions button,
        .linkButton,
        .emptyButton {
          padding: 12px 16px;
          cursor: pointer;
          border-radius: 999px;
          font-weight: 900;
        }

        .actions button {
          border: none;
          color: white;
        }

        .payButton {
          background: linear-gradient(135deg, #d9c39d, #b89b69);
        }

        .dangerButton {
          color: #fca5a5 !important;
          background: rgba(239,68,68,0.14);
          border: 1px solid rgba(239,68,68,0.35) !important;
        }

        .linkButton {
          display: inline-flex;
          align-items: center;
          background: rgba(255,255,255,0.05);
        }

        .empty {
          padding: 24px;
          border-radius: 24px;
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        .emptyButton {
          display: inline-block;
          margin-top: 12px;
          background: linear-gradient(135deg, #d9c39d, #b89b69);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 980px) {
          .stats,
          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 680px) {
          .page {
            padding: 16px;
            padding-bottom: 130px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 24px;
          }

          h1 { font-size: 42px; }

          .stats,
          .routeBox,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          .bookingsPanel { padding: 18px; }
          .cardTop { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue" translate="no"><span key={value}>{value}</span></div>
    </div>
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
