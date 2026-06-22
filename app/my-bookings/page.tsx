"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
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
  createdAt?: string;
};

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export default function MyBookingsPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading your bookings...");
  const [payingId, setPayingId] = useState("");

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setMessage("Please sign in to view your bookings.");
        setBookings([]);
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      const bookingsQuery = query(
        collection(db, "bookings"),
        where("passengerId", "==", user.uid)
      );

      unsubscribeBookings = onSnapshot(
        bookingsQuery,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[];

          setBookings(
            data.sort(
              (a, b) =>
                new Date(b.createdAt || "").getTime() -
                new Date(a.createdAt || "").getTime()
            )
          );

          setMessage("");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
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
      (item) =>
        item.status === "payment_pending" ||
        item.paymentStatus === "pending"
    );

    const paid = bookings.filter(
      (item) => item.paymentStatus === "paid" || item.status === "paid"
    );

    const totalValue = bookings.reduce(
      (total, item) => total + bookingTotal(item),
      0
    );

    return {
      active,
      completed,
      cancelled,
      pendingPayment,
      paid,
      totalValue,
    };
  }, [bookings]);

  async function startPayment(booking: Booking) {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    if (!booking.id) return;

    try {
      setPayingId(booking.id);
      setMessage("");

      const now = new Date().toISOString();
      const total = bookingTotal(booking);
      const platformFee = Math.round(total * 0.12 * 100) / 100;
      const driverAmount = Math.max(total - platformFee, 0);

      const paymentRef = await addDoc(collection(db, "payments"), {
        bookingId: booking.id,
        rideId: booking.rideId || "",
        passengerId: userId,
        passengerEmail: userEmail || booking.passengerEmail || "",
        driverId: booking.driverId || "",
        driverEmail: booking.driverEmail || "",
        amount: total,
        platformFee,
        driverAmount,
        currency: "USD",
        provider: "manual_stripe_ready",
        status: "pending" as PaymentStatus,
        type: "booking_payment",
        description: `RoadLink booking payment from ${booking.from || "Origin"} to ${booking.to || "Destination"}`,
        createdAt: now,
        updatedAt: now,
      });

      await updateDoc(doc(db, "bookings", booking.id), {
        status: "payment_pending",
        paymentStatus: "pending",
        paymentId: paymentRef.id,
        amount: total,
        platformFee,
        driverAmount,
        updatedAt: now,
      });

      if (booking.rideId) {
        await addDoc(collection(db, "notifications"), {
          userId: booking.driverId || "",
          email: booking.driverEmail || "",
          title: "Payment pending",
          message: `${userEmail || "Passenger"} started payment for a booking.`,
          type: "payment",
          read: false,
          bookingId: booking.id,
          rideId: booking.rideId,
          createdAt: now,
        });
      }

      await addDoc(collection(db, "auditLogs"), {
        action: "Booking Payment Started",
        targetId: booking.id,
        targetType: "booking",
        details: `Payment pending for ${money(total)}`,
        severity: "info",
        createdAt: now,
      });

      setMessage("Payment started. Stripe checkout can be connected next.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not start payment.");
    } finally {
      setPayingId("");
    }
  }

  async function markAsPaid(booking: Booking) {
    if (!booking.id) return;

    try {
      setPayingId(booking.id);
      setMessage("");

      const now = new Date().toISOString();
      const total = bookingTotal(booking);
      const platformFee = Math.round(total * 0.12 * 100) / 100;
      const driverAmount = Math.max(total - platformFee, 0);

      let paymentId = booking.paymentId || "";

      if (!paymentId) {
        const paymentRef = await addDoc(collection(db, "payments"), {
          bookingId: booking.id,
          rideId: booking.rideId || "",
          passengerId: userId,
          passengerEmail: userEmail || booking.passengerEmail || "",
          driverId: booking.driverId || "",
          driverEmail: booking.driverEmail || "",
          amount: total,
          platformFee,
          driverAmount,
          currency: "USD",
          provider: "manual_admin_ready",
          status: "paid" as PaymentStatus,
          type: "booking_payment",
          createdAt: now,
          updatedAt: now,
        });

        paymentId = paymentRef.id;
      } else {
        await updateDoc(doc(db, "payments", paymentId), {
          status: "paid",
          paidAt: now,
          updatedAt: now,
        });
      }

      await updateDoc(doc(db, "bookings", booking.id), {
        status: "paid",
        paymentStatus: "paid",
        paymentId,
        amount: total,
        platformFee,
        driverAmount,
        paidAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "walletTransactions"), {
        bookingId: booking.id,
        rideId: booking.rideId || "",
        driverId: booking.driverId || "",
        driverEmail: booking.driverEmail || "",
        passengerId: userId,
        passengerEmail: userEmail || booking.passengerEmail || "",
        amount: driverAmount,
        platformFee,
        grossAmount: total,
        type: "ride_payment",
        status: "pending_payout",
        description: `Ride payment from ${booking.from || "Origin"} to ${booking.to || "Destination"}`,
        createdAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId: booking.driverId || "",
        email: booking.driverEmail || "",
        title: "Booking paid",
        message: `A passenger paid ${money(total)}. Driver balance updated.`,
        type: "payment",
        read: false,
        bookingId: booking.id,
        rideId: booking.rideId || "",
        createdAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Booking Payment Completed",
        targetId: booking.id,
        targetType: "booking",
        details: `Payment completed for ${money(total)}`,
        severity: "success",
        createdAt: now,
      });

      setMessage("Payment marked as paid and driver wallet updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not complete payment.");
    } finally {
      setPayingId("");
    }
  }

  async function cancelBooking(booking: Booking) {
    if (!booking.id) return;

    try {
      const now = new Date().toISOString();

      await updateDoc(doc(db, "bookings", booking.id), {
        status: "cancelled",
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId: booking.driverId || "",
        email: booking.driverEmail || "",
        title: "Booking cancelled",
        message: `${userEmail || "Passenger"} cancelled a booking.`,
        type: "booking",
        read: false,
        bookingId: booking.id,
        rideId: booking.rideId || "",
        createdAt: now,
      });

      setMessage("Booking cancelled.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not cancel booking.");
    }
  }

  function bookingTotal(booking: Booking) {
    return (
      Number(booking.amount || booking.price || 0) *
      Number(booking.seatsBooked || 1)
    );
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: string, paymentStatus?: string) {
    if (paymentStatus === "paid") return "Paid";
    if (paymentStatus === "pending") return "Payment Pending";
    if (status === "payment_pending") return "Payment Pending";
    if (status === "confirmed") return "Confirmed";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "rejected") return "Rejected";
    if (status === "paid") return "Paid";
    return status || "Reserved";
  }

  function statusClass(status?: string, paymentStatus?: string) {
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
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/find-ride" className="miniButton">Find Ride</Link>
          <Link href="/wallet" className="miniButton">Wallet</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Passenger</p>
            <h1>My <span>Bookings</span></h1>
            <p className="subtitle">
              Manage your reservations, payment status, booking history, receipts and trip progress.
            </p>
          </div>

          <div className="scoreOrb">
            <strong>{bookings.length}</strong>
            <span>Total Bookings</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="✅" label="Active" value={String(metrics.active.length)} />
          <Metric icon="💳" label="Pending Payment" value={String(metrics.pendingPayment.length)} />
          <Metric icon="💰" label="Paid" value={String(metrics.paid.length)} />
          <Metric icon="🏁" label="Completed" value={String(metrics.completed.length)} />
          <Metric icon="❌" label="Cancelled" value={String(metrics.cancelled.length)} />
          <Metric icon="📊" label="Total Value" value={money(metrics.totalValue)} />
          <Metric icon="👤" label="Passenger" value={userEmail || "Signed out"} />
        </section>

        <section className="bookingsPanel">
          <div className="sectionTop">
            <div>
              <p className="eyebrow">Reservations</p>
              <h2>Booking Center</h2>
            </div>
          </div>

          {bookings.length === 0 ? (
            <section className="empty">
              <h3>No bookings yet</h3>
              <p>Find a ride and reserve your seat to start traveling with RoadLink.</p>
              <Link href="/find-ride" className="emptyButton">Find a Ride</Link>
            </section>
          ) : (
            <div className="bookingGrid">
              {bookings.map((booking) => {
                const total = bookingTotal(booking);
                const platformFee = Math.round(total * 0.12 * 100) / 100;
                const driverAmount = Math.max(total - platformFee, 0);
                const isPaid =
                  booking.paymentStatus === "paid" || booking.status === "paid";
                const isCancelled =
                  booking.status === "cancelled" || booking.status === "rejected";

                return (
                  <section key={booking.id} className="bookingCard">
                    <div className="cardTop">
                      <div>
                        <h3>{booking.from || "Origin"} → {booking.to || "Destination"}</h3>
                        <p>{booking.date || "Date pending"} • {booking.time || "Time pending"}</p>
                      </div>

                      <span className={`pill ${statusClass(booking.status, booking.paymentStatus)}`}>
                        {statusLabel(booking.status, booking.paymentStatus)}
                      </span>
                    </div>

                    <div className="routeBox">
                      <div>
                        <span>From</span>
                        <strong>{booking.from || "Not available"}</strong>
                      </div>
                      <div>
                        <span>To</span>
                        <strong>{booking.to || "Not available"}</strong>
                      </div>
                    </div>

                    <div className="infoGrid">
                      <Info label="Seats" value={String(booking.seatsBooked || 1)} />
                      <Info label="Trip Total" value={money(total)} />
                      <Info label="Platform Fee" value={money(platformFee)} />
                      <Info label="Driver Amount" value={money(driverAmount)} />
                      <Info label="Driver" value={booking.driverEmail || "Not assigned"} />
                      <Info label="Payment ID" value={booking.paymentId || "Not created"} />
                    </div>

                    <div className="actions">
                      {!isPaid && !isCancelled && (
                        <button
                          className="payButton"
                          onClick={() => startPayment(booking)}
                          disabled={payingId === booking.id}
                        >
                          {payingId === booking.id ? "Processing..." : "Pay Now"}
                        </button>
                      )}

                      {!isPaid && !isCancelled && (
                        <button
                          className="paidButton"
                          onClick={() => markAsPaid(booking)}
                          disabled={payingId === booking.id}
                        >
                          Mark Paid
                        </button>
                      )}

                      {!isCancelled && booking.status !== "completed" && (
                        <button
                          className="dangerButton"
                          onClick={() => cancelBooking(booking)}
                          disabled={payingId === booking.id}
                        >
                          Cancel
                        </button>
                      )}

                      {booking.rideId && (
                        <Link href={`/chat?rideId=${booking.rideId}`} className="linkButton">
                          Message Driver
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

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

        .miniButton {
          padding: 10px 15px;
        }

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
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 52px;
          line-height: 1;
          margin: 0 0 12px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          margin: 0;
          font-size: 30px;
        }

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
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 34px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
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
          background: rgba(34,197,94,0.13);
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

        .sectionTop {
          margin-bottom: 18px;
        }

        .bookingGrid {
          display: grid;
          gap: 14px;
        }

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

        .bookingCard p {
          margin: 0;
        }

        .pill {
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
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
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .paidButton {
          background: rgba(59,130,246,0.18);
          border: 1px solid rgba(59,130,246,0.35) !important;
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
          background: linear-gradient(135deg, #22c55e, #16a34a);
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

          h1 {
            font-size: 42px;
          }

          .stats,
          .routeBox,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          .bookingsPanel {
            padding: 18px;
          }

          .cardTop {
            flex-direction: column;
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
          }
