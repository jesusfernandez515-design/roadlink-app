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
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status: string;
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
          booking.status === "reserved" || booking.status === "confirmed"
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
          });
        }
      }

      setBookings((current) =>
        current.filter((item) => item.id !== booking.id)
      );

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

  const totalSpent = bookings.reduce(
    (total, booking) => total + Number(booking.price || 0),
    0
  );

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
          Manage your reserved rides, view trip details, and cancel bookings when needed.
        </p>
      </section>

      <section className="stats">
        <Metric icon="🎟️" label="Active Bookings" value={String(bookings.length)} />
        <Metric icon="💵" label="Reserved Value" value={`$${totalSpent}`} />
        <Metric icon="🛡️" label="Status" value="Protected" />
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

        {bookings.map((booking) => (
          <div key={booking.id} className="bookingCard">
            <div className="routeHeader">
              <div>
                <p className="eyebrow">Reserved Trip</p>
                <h2>
                  {booking.from} <span>→</span> {booking.to}
                </h2>
              </div>

              <div className="priceBox">
                <small>PRICE</small>
                <strong>${booking.price || 0}</strong>
              </div>
            </div>

            <div className="chips">
              <div className="chip">📅 {booking.date}</div>
              <div className="chip">🕒 {booking.time}</div>
              <div className="chip active">● {booking.status}</div>
            </div>

            <div className="infoGrid">
              <Info icon="👤" label="Driver" value={booking.driverEmail || "RoadLink Driver"} />
              <Info icon="🧾" label="Booking ID" value={booking.id} />
              <Info icon="🚗" label="Ride ID" value={booking.rideId || "Not available"} />
            </div>

            <div className="cardButtons">
              <Link
                href={`/ride-details?rideId=${booking.rideId}`}
                className="outlineButton"
              >
                View Ride Details
              </Link>

              <Link href="/find-ride" className="outlineButton">
                Find More Rides
              </Link>
            </div>

            <button
              className="cancelButton"
              onClick={() => cancelReservation(booking)}
              disabled={loadingId === booking.id}
            >
              {loadingId === booking.id ? "Cancelling..." : "Cancel Reservation"}
            </button>
          </div>
        ))}
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
        .metric {
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
        .metricValue {
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

        .messageBox {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
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
          padding: 28px;
          margin-bottom: 24px;
        }

        .routeHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0;
        }

        .priceBox {
          min-width: 110px;
          padding: 16px;
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
          font-size: 32px;
          font-weight: 900;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .infoGrid {
          display: grid;
          gap: 10px;
        }

        .infoRow {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .infoIcon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
        }

        .infoText strong {
          display: block;
          color: #e5e7eb;
          margin-bottom: 4px;
        }

        .infoText span {
          color: #a1a1aa;
          overflow-wrap: anywhere;
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 24px;
        }

        .outlineButton {
          display: block;
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
        }

        .cancelButton {
          width: 100%;
          padding: 18px;
          margin-top: 16px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color: white;
          font-weight: 900;
          font-size: 17px;
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
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 50px;
          }

          h2 {
            font-size: 32px;
          }

          .stats,
          .routeHeader,
          .cardButtons {
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

function Info({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="infoRow">
      <div className="infoIcon">{icon}</div>
      <div className="infoText">
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}
