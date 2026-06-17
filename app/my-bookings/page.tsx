"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Booking = {
  id: string;
  rideId: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price?: number;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status: string;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  durationMinutes?: number;
  mapUrl?: string;
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading bookings...");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loadingId, setLoadingId] = useState("");

  async function loadBookings(userId: string) {
    const q = query(
      collection(db, "bookings"),
      where("passengerId", "==", userId)
    );

    const snapshot = await getDocs(q);

    const bookingData = snapshot.docs
      .map((document) => ({
        id: document.id,
        ...document.data(),
      }))
      .filter(
        (booking: any) =>
          booking.status === "reserved" ||
          booking.status === "confirmed" ||
          booking.status === "completed"
      ) as Booking[];

    setBookings(bookingData);
    setMessage(bookingData.length ? "" : "You have no bookings yet.");
  }

  async function cancelReservation(booking: Booking) {
    try {
      setLoadingId(booking.id);
      setMessage("");

      await updateDoc(doc(db, "bookings", booking.id), {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });

      if (booking.rideId) {
        const rideRef = doc(db, "rides", booking.rideId);
        const rideSnap = await getDoc(rideRef);

        if (rideSnap.exists()) {
          const rideData = rideSnap.data();
          const currentSeats = Number(rideData.seats || 0);

          await updateDoc(rideRef, {
            seats: currentSeats + 1,
            status: "active",
            updatedAt: new Date().toISOString(),
          });
        }
      }

      setBookings((current) => current.filter((item) => item.id !== booking.id));
      setMessage("Reservation cancelled successfully.");

      if (currentUserId) {
        await loadBookings(currentUserId);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setBookings([]);
        setCurrentUserId("");
        setMessage("Please sign in to view your bookings.");
        return;
      }

      setCurrentUserId(user.uid);

      try {
        await loadBookings(user.uid);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  const activeBookings = bookings.filter(
    (booking) => booking.status === "reserved" || booking.status === "confirmed"
  );

  const completedBookings = bookings.filter(
    (booking) => booking.status === "completed"
  );

  const totalSpent = bookings.reduce(
    (total, booking) => total + Number(booking.price || 0),
    0
  );

  function formatMoney(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function statusClass(status: string) {
    if (status === "completed") return "chip completed";
    if (status === "confirmed") return "chip confirmed";
    if (status === "reserved") return "chip active";
    return "chip";
  }

  function BookingCard({ booking }: { booking: Booking }) {
    const canCancel =
      booking.status === "reserved" || booking.status === "confirmed";

    const canRate = booking.status === "completed";

    return (
      <div className="bookingCard">
        <div className="routeHeader">
          <div>
            <p className="eyebrow">
              {booking.status === "completed" ? "Completed Trip" : "Reserved Trip"}
            </p>

            <h2>
              {booking.from || "Origin"} <span>→</span> {booking.to || "Destination"}
            </h2>
          </div>

          <div className="priceBox">
            <small>PRICE</small>
            <strong>{formatMoney(booking.price)}</strong>
          </div>
        </div>

        <div className="chips">
          <div className="chip">📅 {booking.date || "N/A"}</div>
          <div className="chip">🕒 {booking.time || "N/A"}</div>
          <div className={statusClass(booking.status)}>● {booking.status}</div>
        </div>

        <div className="miniGrid">
          <Mini label="Driver" value={booking.driverEmail || "RoadLink Driver"} />
          <Mini label="Distance" value={booking.distanceText || "N/A"} />
          <Mini label="Duration" value={booking.durationText || "N/A"} />
        </div>

        <div className="cardButtons">
          <Link
            href={`/ride-details?rideId=${booking.rideId}`}
            className="outlineButton"
          >
            Ride Details
          </Link>

          {booking.mapUrl ? (
            <a
              href={booking.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="outlineButton mapButton"
            >
              Google Maps
            </a>
          ) : (
            <Link href="/find-ride" className="outlineButton">
              Find More
            </Link>
          )}

          {canRate && (
            <Link
              href={`/rate-driver?rideId=${booking.rideId}${
                booking.driverId ? `&driverId=${booking.driverId}` : ""
              }`}
              className="rateButton"
            >
              Rate Driver
            </Link>
          )}
        </div>

        {canCancel && (
          <button
            className="cancelButton"
            onClick={() => cancelReservation(booking)}
            disabled={loadingId === booking.id}
          >
            {loadingId === booking.id ? "Cancelling..." : "Cancel Reservation"}
          </button>
        )}
      </div>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/find-ride" className="miniButton">
            Find Ride
          </Link>

          <Link href="/offer-ride" className="miniButton">
            Offer Ride
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>
          My <span>Bookings</span>
        </h1>

        <p className="subtitle">
          Manage your reservations, view trip details, and rate completed drivers.
        </p>
      </section>

      <section className="stats">
        <Metric icon="🎟️" label="Active" value={String(activeBookings.length)} />
        <Metric icon="✅" label="Completed" value={String(completedBookings.length)} />
        <Metric icon="💵" label="Total Value" value={formatMoney(totalSpent)} />
      </section>

      <section className="results">
        {message && (
          <div className="messageBox">
            <p className="message">{message}</p>

            {message.toLowerCase().includes("sign in") && (
              <Link href="/login" className="loginButton">
                Sign In
              </Link>
            )}
          </div>
        )}

        {activeBookings.length > 0 && (
          <>
            <h2 className="sectionTitle">Active Bookings</h2>
            {activeBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </>
        )}

        {completedBookings.length > 0 && (
          <>
            <h2 className="sectionTitle">Completed Trips</h2>
            {completedBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </>
        )}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .results {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .bookingCard,
        .metric,
        .messageBox {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 22px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 30px;
        }

        .miniButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h2 span,
        .active,
        .eyebrow,
        .priceBox strong,
        .metricValue,
        .sectionTitle {
          color: #22c55e;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 22px;
        }

        .metricIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 28px;
          font-weight: 900;
        }

        .sectionTitle {
          font-size: 28px;
          margin: 28px 0 14px;
        }

        .messageBox {
          border-radius: 24px;
          padding: 24px;
          text-align: center;
          margin-bottom: 24px;
        }

        .message {
          color: #22c55e;
          font-size: 19px;
          font-weight: 900;
          margin: 0;
        }

        .loginButton {
          display: block;
          margin-top: 18px;
          padding: 16px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
        }

        .bookingCard {
          border-radius: 30px;
          padding: 24px;
          margin-bottom: 18px;
        }

        .routeHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 18px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h2 {
          font-size: 30px;
          line-height: 1.15;
          margin: 0;
        }

        .priceBox {
          min-width: 105px;
          padding: 15px;
          border-radius: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          text-align: center;
        }

        .priceBox small {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .priceBox strong {
          font-size: 28px;
          font-weight: 900;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
          text-transform: capitalize;
        }

        .confirmed {
          color: #38bdf8;
          border-color: rgba(56,189,248,0.35);
        }

        .completed {
          color: #a78bfa;
          border-color: rgba(167,139,250,0.35);
        }

        .miniGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
        }

        .miniInfo {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .miniInfo small {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .miniInfo strong {
          display: block;
          color: #e5e7eb;
          overflow-wrap: anywhere;
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }

        .outlineButton,
        .rateButton {
          display: block;
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
        }

        .outlineButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .mapButton {
          color: #22c55e;
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.08);
        }

        .rateButton {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        .cancelButton {
          width: 100%;
          padding: 16px;
          margin-top: 14px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color: white;
          font-weight: 900;
          font-size: 16px;
          cursor: pointer;
        }

        .cancelButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero,
          .bookingCard {
            padding: 22px;
            border-radius: 28px;
          }

          h1 {
            font-size: 48px;
          }

          h2 {
            font-size: 28px;
          }

          .stats,
          .routeHeader,
          .cardButtons,
          .miniGrid {
            grid-template-columns: 1fr;
          }

          .priceBox {
            text-align: left;
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
