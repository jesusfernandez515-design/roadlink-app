"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
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
  seatsBooked?: number;
  price?: number;
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
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading passengers...");
  const [loadingChatId, setLoadingChatId] = useState("");

  useEffect(() => {
    if (!rideId) {
      setMessage("Missing ride ID.");
      return;
    }

    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUser(user);

      try {
        const rideSnap = await getDoc(doc(db, "rides", rideId));

        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        const rideData = {
          id: rideSnap.id,
          ...rideSnap.data(),
        } as Ride;

        if (rideData.driverId && rideData.driverId !== user.uid) {
          setMessage("You can only view passengers for your own rides.");
          return;
        }

        setRide(rideData);

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", rideId),
          where("driverId", "==", user.uid)
        );

        unsubscribeBookings = onSnapshot(
          bookingsQuery,
          (snapshot) => {
            const data = snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
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
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, [rideId, router]);

  const activePassengers = bookings.filter(
    (booking) => booking.status !== "cancelled"
  );

  const totalSeats = activePassengers.reduce(
    (total, booking) => total + Number(booking.seatsBooked || 1),
    0
  );

  const estimatedEarnings = activePassengers.reduce(
    (total, booking) =>
      total + Number(booking.price || ride?.price || 0) * Number(booking.seatsBooked || 1),
    0
  );

  function formatMoney(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusClass(status?: string) {
    if (status === "reserved") return "status reservedStatus";
    if (status === "confirmed") return "status confirmedStatus";
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled") return "status cancelledStatus";
    return "status";
  }

  async function openChat(booking: Booking) {
    if (!currentUser || !ride || !booking.passengerId) return;

    try {
      const chatId = `${ride.id}_${currentUser.uid}_${booking.passengerId}`;
      setLoadingChatId(booking.id);

      await setDoc(
        doc(db, "chats", chatId),
        {
          id: chatId,
          rideId: ride.id,
          driverId: currentUser.uid,
          driverEmail: currentUser.email || ride.driverEmail || "",
          passengerId: booking.passengerId,
          passengerEmail: booking.passengerEmail || "",
          participants: [currentUser.uid, booking.passengerId],
          participantEmails: [
            currentUser.email || ride.driverEmail || "",
            booking.passengerEmail || "",
          ],
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      router.push(`/chat?chatId=${chatId}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not open chat.");
    } finally {
      setLoadingChatId("");
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/my-rides" className="miniButton">
            My Rides
          </Link>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <p className="eyebrow">Ride Passengers</p>

        <h1>
          Passenger <span>List</span>
        </h1>

        {ride && (
          <p className="subtitle">
            {ride.from || "Origin"} → {ride.to || "Destination"}
          </p>
        )}
      </section>

      <section className="stats">
        <Metric label="Passengers" value={String(activePassengers.length)} />
        <Metric label="Seats" value={String(totalSeats)} />
        <Metric label="Earnings" value={formatMoney(estimatedEarnings)} />
      </section>

      {ride && (
        <section className="rideSummary">
          <div>
            <small>Date</small>
            <strong>{ride.date || "N/A"}</strong>
          </div>

          <div>
            <small>Time</small>
            <strong>{ride.time || "N/A"}</strong>
          </div>

          <div>
            <small>Distance</small>
            <strong>{ride.distanceText || "N/A"}</strong>
          </div>

          <div>
            <small>Duration</small>
            <strong>{ride.durationText || "N/A"}</strong>
          </div>
        </section>
      )}

      <section className="results">
        {message && <p className="message">{message}</p>}

        {activePassengers.length === 0 ? (
          <div className="empty">
            <h2>No passengers yet</h2>
            <p>When someone reserves this ride, they will appear here.</p>
          </div>
        ) : (
          activePassengers.map((booking) => (
            <article key={booking.id} className="passengerCard">
              <div className="passengerTop">
                <div className="avatar">👤</div>

                <div>
                  <p className="eyebrow">Passenger</p>
                  <h2>{booking.passengerEmail || "RoadLink Passenger"}</h2>
                </div>
              </div>

              <div className="passengerInfo">
                <span>💺 {booking.seatsBooked || 1} seat</span>
                <span>💵 {formatMoney(booking.price || ride?.price)}</span>
                <span className={getStatusClass(booking.status)}>
                  ● {booking.status || "reserved"}
                </span>
              </div>

              <div className="buttons">
                <button
                  className="chatButton"
                  onClick={() => openChat(booking)}
                  disabled={loadingChatId === booking.id || !booking.passengerId}
                >
                  {loadingChatId === booking.id ? "Opening..." : "Chat"}
                </button>

                <Link
                  href={`/ride-details?rideId=${rideId}`}
                  className="outlineButton"
                >
                  Ride Details
                </Link>
              </div>
            </article>
          ))
        )}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.1), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 16px;
          padding-bottom: 105px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .rideSummary,
        .results {
          max-width: 860px;
          margin: 0 auto;
        }

        .hero,
        .metric,
        .rideSummary,
        .passengerCard,
        .empty {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 18px 55px rgba(0,0,0,0.38);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 14px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
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
          font-size: 32px;
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
          font-size: 42px;
          line-height: 1;
          margin: 0 0 12px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 16px;
          line-height: 1.4;
          margin: 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 18px;
          padding: 13px;
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
        }

        .rideSummary {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          border-radius: 22px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .rideSummary div {
          padding: 10px;
          border-radius: 14px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .rideSummary small {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .rideSummary strong {
          color: white;
          font-size: 13px;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0;
        }

        .passengerCard {
          border-radius: 22px;
          padding: 15px;
          margin-bottom: 10px;
        }

        .passengerTop {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .passengerInfo {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
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

        .cancelledStatus {
          color: #fca5a5;
          border-color: rgba(239,68,68,0.35);
        }

        .buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .chatButton,
        .outlineButton {
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

        .chatButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        .outlineButton {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .empty {
          border-radius: 22px;
          padding: 26px;
          text-align: center;
        }

        .empty p {
          color: #a1a1aa;
        }

        @media (max-width: 430px) {
          h1 {
            font-size: 38px;
          }

          .stats,
          .passengerInfo {
            grid-template-columns: 1fr;
          }

          .rideSummary {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}
