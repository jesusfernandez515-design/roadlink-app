"use client";

import Link from "next/link";
import ProfileIdentity from "../components/ProfileIdentity";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { isPendingBooking, retainedPayment } from "../../lib/wallet-totals";

type PaymentRow = Parameters<typeof retainedPayment>[0] & { bookingId?: string; rideId?: string };

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  seats?: number;
  originalSeats?: number;
  status?: string;
  driverId?: string;
  driverEmail?: string;
  distanceText?: string;
  durationText?: string;
  mapUrl?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  paymentStatus?: string;
  paymentId?: string;
  seatsBooked?: number;
  price?: number;
  amount?: number;
  platformFee?: number;
  driverAmount?: number;
  createdAt?: string;
};

export default function RidePassengersPage() {
  return (
    <Suspense fallback={<main className="page">Loading passengers...</main>}>
      <RidePassengersContent />
    </Suspense>
  );
}

function RidePassengersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get("rideId") || "";

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [ownRides, setOwnRides] = useState<Ride[]>([]);
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading passengers...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;
    let unsubscribePayments: (() => void) | undefined;
    let disposed = false;
    let authVersion = 0;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const version = ++authVersion;
      unsubscribeBookings?.();
      unsubscribeBookings = undefined;
      unsubscribePayments?.();
      unsubscribePayments = undefined;
      setPayments([]);
      setPaymentsLoaded(false);
      setPaymentsError("");
      setRide(null);
      setBookings([]);
      setOwnRides([]);
      setCurrentUser(user);
      setMessage("Cargando viajes…");
      if (!user) {
        router.push("/login");
        return;
      }

      if (!rideId) {
        unsubscribeBookings = onSnapshot(query(collection(db, "rides"), where("driverId", "==", user.uid)), snapshot => {
          if (disposed || version !== authVersion) return;
          const rows = snapshot.docs.map(item => ({ ...item.data(), id: item.id } as Ride));
          rows.sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`));
          setOwnRides(rows);
          setMessage(rows.length ? "" : "Todavía no has publicado viajes.");
        }, error => { if (!disposed && version === authVersion) setMessage(error.message); });
        return;
      }

      try {
        const rideSnap = await getDoc(doc(db, "rides", rideId));

        if (disposed || version !== authVersion) return;
        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        const rideData = {
          ...rideSnap.data(),
          id: rideSnap.id,
        } as Ride;

        if (rideData.driverId !== user.uid) {
          setMessage("You can only manage passengers for your own rides.");
          return;
        }

        setRide(rideData);
        unsubscribePayments = onSnapshot(query(collection(db, "walletTransactions"), where("driverId", "==", user.uid)), snapshot => {
          if (disposed || version !== authVersion) return;
          setPayments(snapshot.docs.map(item => item.data() as PaymentRow).filter(item => item.rideId === rideId));
          setPaymentsLoaded(true);
          setPaymentsError("");
        }, () => {
          if (disposed || version !== authVersion) return;
          setPaymentsLoaded(false);
          setPaymentsError("No se pudieron consultar los pagos registrados. Recarga la página para reintentar.");
        });

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", rideId),
          where("driverId", "==", user.uid)
        );

        unsubscribeBookings = onSnapshot(
          bookingsQuery,
          (snapshot) => {
            if (disposed || version !== authVersion) return;
            const data = snapshot.docs.map((document) => ({
              ...document.data(),
              id: document.id,
            })) as Booking[];

            data.sort((a, b) =>
              String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
            );

            setBookings(data);
            setMessage(data.length ? "" : "No passengers yet.");
          },
          (error) => setMessage(error.message)
        );
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => {
      disposed = true;
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
      unsubscribePayments?.();
    };
  }, [rideId, router]);

  const metrics = useMemo(() => {
    const active = bookings.filter(
      (booking) => !["cancelled", "rejected"].includes(String(booking.status || ""))
    );

    const confirmed = bookings.filter((booking) => booking.status === "confirmed");
    const paid = bookings.filter(
      (booking) => booking.paymentStatus === "paid" || booking.status === "paid"
    );
    const pendingPayment = bookings.filter(isPendingBooking);
    const cancelled = bookings.filter((booking) =>
      ["cancelled", "rejected"].includes(String(booking.status || ""))
    );

    const seats = active.reduce(
      (total, booking) => total + Number(booking.seatsBooked || 1),
      0
    );

    const totals = payments.reduce((sum, payment) => {
      const retained = retainedPayment(payment);
      return { gross: sum.gross + retained.gross, fee: sum.fee + retained.fee, net: sum.net + retained.net };
    }, { gross: 0, fee: 0, net: 0 });
    const gross = totals.gross;
    const platformFees = totals.fee;
    const driverNet = totals.net;

    return {
      active,
      confirmed,
      paid,
      pendingPayment,
      cancelled,
      seats,
      gross,
      platformFees,
      driverNet,
    };
  }, [bookings, payments]);

  function bookingTotal(booking: Booking) {
    return (
      Number(booking.amount ?? (Number(booking.price ?? ride?.price ?? 0) * Number(booking.seatsBooked ?? 1)))
    );
  }

  function formatMoney(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusClass(status?: string, paymentStatus?: string) {
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled" || status === "rejected") return "status cancelledStatus";
    if (paymentStatus === "paid" || status === "paid") return "status paidStatus";
    if (status === "reserved") return "status reservedStatus";
    if (status === "confirmed") return "status confirmedStatus";
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled" || status === "rejected") return "status cancelledStatus";
    if (status === "payment_pending" || paymentStatus === "pending") return "status pendingStatus";
    return "status";
  }

  function statusLabel(booking: Booking) {
    if (["completed", "cancelled", "rejected", "confirmed"].includes(booking.status || "")) return booking.status;
    if (booking.paymentStatus === "refunded") return "Reembolsado";
    if (booking.paymentStatus === "paid") return "paid";
    if (booking.paymentStatus === "pending") return "payment pending";
    return booking.status || "reserved";
  }

  async function updateBookingStatus(booking: Booking, status: "confirmed" | "completed") {
    if (!ride || !currentUser || loadingId) return;
    if (!window.confirm(status === "confirmed" ? "¿Confirmar esta reserva pagada?" : "¿Confirmas que este pasajero terminó el viaje?")) return;
    setLoadingId(`${booking.id}-${status}`);
    setMessage("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/bookings/driver-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: booking.id, action: status === "confirmed" ? "confirm" : "complete" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar la reserva.");
      const latest = await getDoc(doc(db, "rides", ride.id));
      if (latest.exists()) setRide({ ...latest.data(), id: latest.id } as Ride);
      setMessage(status === "confirmed" ? "Reserva confirmada." : "Viaje del pasajero terminado; importe habilitado en la cartera de pruebas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la reserva.");
    } finally { setLoadingId(""); }
  }

  async function cancelRide() {
    if (!ride || !currentUser || loadingId) return;
    if (!window.confirm("¿Cancelar este viaje? Los pagos y reembolsos deben estar resueltos antes de cancelarlo.")) return;
    setLoadingId("ride-cancelled");
    setMessage("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/rides/cancel", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rideId: ride.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cancelar el viaje.");
      setRide({ ...ride, status: "cancelled" });
      setMessage("Viaje cancelado. Ya no admite nuevas reservas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar el viaje.");
    } finally { setLoadingId(""); }
  }

  async function openChat(booking: Booking) {
    if (!currentUser || !ride || !booking.passengerId) return;

    try {
      setLoadingId(`chat-${booking.id}`);
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/chat", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "open", bookingId: booking.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo abrir el chat.");
      const chatId = result.chatId;
      router.push(`/chat?chatId=${chatId}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not open chat.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <section className="hero">
          <div className="topActions">
            <button className="miniButton" onClick={() => router.back()}>← Back</button>
            <Link href="/my-rides" className="miniButton">My Rides</Link>
            <Link href="/messages" className="miniButton">Messages</Link>
            <Link href="/wallet" className="miniButton">Wallet</Link>
            <Link href="/dashboard" className="miniButton">Dashboard</Link>
          </div>

          <div className="logo">Road<span>Link</span></div>

          <p className="eyebrow">Ride Passengers Center</p>

          <h1>Passenger <span>Control</span></h1>

          {ride && (
            <p className="subtitle">
              {ride.from || "Origin"} → {ride.to || "Destination"}
            </p>
          )}
        </section>

        {!rideId && (
          <section className="results" aria-label="Selecciona un viaje">
            <h2>Selecciona un viaje</h2>
            <p>Abre una ruta para consultar sus pasajeros y gestionar las reservas.</p>
            {message && <p role="status">{message}</p>}
            {ownRides.map(item => (
              <article className="passengerCard" key={item.id}>
                <h3>{item.from || "Origen"} → {item.to || "Destino"}</h3>
                <p>{item.date} · {item.time} · {item.status === "completed" ? "Terminado" : item.status === "cancelled" ? "Cancelado" : "Activo"}</p>
                <Link className="outlineButton" href={`/ride-passengers?rideId=${encodeURIComponent(item.id)}`}>Ver pasajeros</Link>
              </article>
            ))}
            {!ownRides.length && !message.startsWith("Cargando") && <Link className="miniButton" href="/offer-ride">Ofrecer un viaje</Link>}
          </section>
        )}

        {ride && <section className="stats">
          <Metric label="Passengers" value={String(metrics.active.length)} icon="👥" />
          <Metric label="Seats Booked" value={String(metrics.seats)} icon="💺" />
          <Metric label="Paid" value={String(metrics.paid.length)} icon="💳" />
          <Metric label="Pending Pay" value={String(metrics.pendingPayment.length)} icon="⏳" />
          <Metric label="Pagos retenidos" value={paymentsLoaded ? formatMoney(metrics.gross) : "—"} icon="💰" />
          <Metric label="Neto del conductor" value={paymentsLoaded ? formatMoney(metrics.driverNet) : "—"} icon="🏦" />
          <Metric label="Comisión retenida" value={paymentsLoaded ? formatMoney(metrics.platformFees) : "—"} icon="📊" />
          <Metric label="Cancelled" value={String(metrics.cancelled.length)} icon="❌" />
        </section>}

        {ride && (
          <section className="rideSummary">
            <Mini label="Date" value={ride.date || "N/A"} />
            <Mini label="Time" value={ride.time || "N/A"} />
            <Mini label="Distance" value={ride.distanceText || "N/A"} />
            <Mini label="Duration" value={ride.durationText || "N/A"} />
            <Mini label="Seats Left" value={String(ride.seats || 0)} />
            <Mini label="Original Seats" value={String(ride.originalSeats || "N/A")} />
            <Mini label="Price" value={formatMoney(ride.price)} />
            <Mini label="Status" value={ride.status || "active"} />
          </section>
        )}

        {ride && (
          <section className="rideActions">
            {ride.mapUrl && (
              <a href={ride.mapUrl} target="_blank" rel="noopener noreferrer" className="mapButton">
                Open Route
              </a>
            )}

            {["active", "full"].includes(ride.status || "") && (
              <button className="cancelRideButton" onClick={cancelRide} disabled={!!loadingId}>
                {loadingId === "ride-cancelled" ? "Procesando…" : "Cancelar mi viaje"}
              </button>
            )}
            <p>Confirma y finaliza cada reserva pagada desde la tarjeta del pasajero. Solo puedes finalizar después de la llegada prevista.</p>
          </section>
        )}

        {rideId && <section className="results">
          {message && <p className="message">{message}</p>}
          {paymentsError && <p role="alert" className="message">{paymentsError}</p>}

          {!ride ? null : metrics.active.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">👥</div>
              <h2>No passengers yet</h2>
              <p>When someone reserves this ride, they will appear here.</p>
            </div>
          ) : (
            metrics.active.map((booking) => (
              <article key={booking.id} className="passengerCard">
                <div className="passengerTop">
                  <Link href={`/passenger-profile?passengerId=${booking.passengerId || ""}`} aria-label="Ver perfil del pasajero"><ProfileIdentity uid={booking.passengerId} name={booking.passengerEmail} role="Pasajero" showName={false} /></Link>

                  <div>
                    <p className="eyebrow">Passenger</p>
                    <h2>{booking.passengerEmail || "RoadLink Passenger"}</h2>
                  </div>
                </div>

                <div className="passengerInfo">
                  <span>💺 {booking.seatsBooked || 1} seat</span>
                  <span>💵 {formatMoney(bookingTotal(booking))}</span>
                  <span>🏦 Neto retenido {paymentsLoaded ? formatMoney(payments.filter(item => item.bookingId === booking.id).reduce((sum, item) => sum + retainedPayment(item).net, 0)) : "—"}</span>
                  <span className={getStatusClass(booking.status, booking.paymentStatus)}>
                    ● {statusLabel(booking)}
                  </span>
                </div>

                <div className="bookingMeta">
                  <Mini label="Booking ID" value={booking.id} />
                  <Mini label="Passenger ID" value={booking.passengerId || "N/A"} />
                  <Mini label="Payment ID" value={booking.paymentId || "Not paid"} />
                  <Mini label="Created" value={booking.createdAt || "N/A"} />
                </div>

                <div className="buttons">
                  <button
                    className="chatButton"
                    onClick={() => openChat(booking)}
                    disabled={loadingId === `chat-${booking.id}` || !booking.passengerId}
                  >
                    {loadingId === `chat-${booking.id}` ? "Opening..." : "Chat"}
                  </button>

                  {booking.status === "paid" && booking.paymentStatus === "paid" && ["active", "full"].includes(ride?.status || "") && (
                    <button
                      className="confirmButton"
                      onClick={() => updateBookingStatus(booking, "confirmed")}
                      disabled={!!loadingId}
                    >
                      {loadingId === `${booking.id}-confirmed` ? "Updating..." : "Confirmar reserva"}
                    </button>
                  )}

                  {booking.status === "confirmed" && booking.paymentStatus === "paid" && ["active", "full"].includes(ride?.status || "") && (
                    <button
                      className="completeButton"
                      onClick={() => updateBookingStatus(booking, "completed")}
                      disabled={!!loadingId}
                    >
                      {loadingId === `${booking.id}-completed` ? "Updating..." : "Finalizar viaje del pasajero"}
                    </button>
                  )}

                  <Link href={`/ride-details?rideId=${rideId}`} className="outlineButton">
                    Ride Details
                  </Link>

                  <Link href={`/driver-profile?driverId=${ride?.driverId || ""}`} className="outlineButton">
                    Driver Profile
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 18px;
          padding-bottom: 120px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1080px;
          margin: auto;
        }

        .hero,
        .metric,
        .rideSummary,
        .rideActions,
        .passengerCard,
        .empty {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 18px 55px rgba(0,0,0,0.38);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 30px;
          padding: 26px;
          margin-bottom: 14px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 22px;
        }

        .miniButton {
          padding: 10px 15px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
          font-size: 13px;
        }

        .logo {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .logo span,
        h1 span,
        .eyebrow,
        .metricValue {
          color: #22c55e;
        }

        .eyebrow {
          margin: 0 0 7px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 48px;
          line-height: 1;
          margin: 0 0 12px;
        }

        h2 {
          margin: 0;
          font-size: 20px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 17px;
          line-height: 1.4;
          margin: 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 18px;
          padding: 14px;
        }

        .metricIcon {
          font-size: 22px;
          margin-bottom: 8px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .metricValue {
          font-size: 20px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .rideSummary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          border-radius: 22px;
          padding: 14px;
          margin-bottom: 12px;
        }

        .miniInfo {
          padding: 10px;
          border-radius: 14px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .miniInfo small {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .miniInfo strong {
          display: block;
          color: white;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .rideActions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          border-radius: 22px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0;
        }

        .passengerCard {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 12px;
        }

        .passengerTop {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          margin-bottom: 14px;
        }

        .avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 900;
          color: #22c55e;
        }

        .passengerInfo {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .passengerInfo span,
        .status {
          padding: 9px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
          color: #d1d5db;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
          text-transform: capitalize;
        }

        .reservedStatus {
          color: #22c55e;
          border-color: rgba(34,197,94,0.35);
        }

        .confirmedStatus {
          color: #38bdf8;
          border-color: rgba(56,189,248,0.35);
        }

        .completedStatus {
          color: #a78bfa;
          border-color: rgba(167,139,250,0.35);
        }

        .paidStatus {
          color: #facc15;
          border-color: rgba(250,204,21,0.35);
        }

        .pendingStatus {
          color: #fb923c;
          border-color: rgba(251,146,60,0.35);
        }

        .cancelledStatus {
          color: #fca5a5;
          border-color: rgba(239,68,68,0.35);
        }

        .bookingMeta {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .buttons {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
        }

        .chatButton,
        .confirmButton,
        .cancelButton,
        .outlineButton,
        .mapButton,
        .completeButton,
        .cancelRideButton {
          width: 100%;
          padding: 13px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
          color: white;
          cursor: pointer;
        }

        .chatButton,
        .completeButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        .confirmButton {
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          border: none;
        }

        .cancelButton,
        .cancelRideButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          border: none;
        }

        .outlineButton {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .mapButton {
          color: #22c55e;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.28);
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .empty {
          border-radius: 22px;
          padding: 32px;
          text-align: center;
        }

        .emptyIcon {
          width: 72px;
          height: 72px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
        }

        .empty p {
          color: #a1a1aa;
        }

        @media (max-width: 900px) {
          .stats,
          .rideSummary,
          .passengerInfo,
          .bookingMeta {
            grid-template-columns: repeat(2, 1fr);
          }

          .rideActions,
          .buttons {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          h1 {
            font-size: 40px;
          }

          .stats,
          .rideSummary,
          .passengerInfo,
          .bookingMeta {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="miniInfo">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
                                                        }
