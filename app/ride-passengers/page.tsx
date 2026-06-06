"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  seats?: number;
  vehicle?: string;
  status?: string;
  driverId?: string;
  driverEmail?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  seatsBooked?: number;
  createdAt?: string;
};

export default function RidePassengersPage() {
  const router = useRouter();

  const [rideId, setRideId] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [message, setMessage] = useState("Loading passengers...");

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view passengers.");
        router.push("/login");
        return;
      }

      setCurrentUserId(user.uid);

      const params = new URLSearchParams(window.location.search);
      const currentRideId = params.get("rideId") || "";

      if (!currentRideId) {
        setMessage("No ride selected.");
        return;
      }

      setRideId(currentRideId);

      try {
        const rideRef = doc(db, "rides", currentRideId);
        const rideSnap = await getDoc(rideRef);

        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        const rideData = {
          id: rideSnap.id,
          ...rideSnap.data(),
        } as Ride;

        setRide(rideData);

        if (rideData.driverId && rideData.driverId !== user.uid) {
          setMessage("Only the driver can view passengers for this ride.");
          return;
        }

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", currentRideId)
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
            setMessage(data.length ? "" : "No passengers have reserved this ride yet.");
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
  }, [router]);

  const confirmed = bookings.filter((booking) => booking.status === "reserved").length;
  const completed = bookings.filter((booking) => booking.status === "completed").length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;

  const totalSeatsBooked = bookings.reduce(
    (total, booking) => total + Number(booking.seatsBooked || 1),
    0
  );

  const estimatedRevenue = useMemo(() => {
    return bookings
      .filter((booking) => booking.status === "reserved" || booking.status === "completed")
      .reduce(
        (total, booking) =>
          total + Number(ride?.price || 0) * Number(booking.seatsBooked || 1),
        0
      );
  }, [bookings, ride]);

  function formatDate(value?: string) {
    if (!value) return "Recently";

    try {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function getStatusClass(status?: string) {
    if (status === "reserved") return "status reserved";
    if (status === "completed") return "status completed";
    if (status === "cancelled") return "status cancelled";
    return "status";
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/my-rides" className="miniButton">
            My Rides
          </Link>

          <Link href="/messages" className="miniButton">
            Messages
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <p className="eyebrow">Driver Passenger Center</p>

        <h1>
          Ride <span>Passengers</span>
        </h1>

        <p className="subtitle">
          View all passengers, booking status, reserved seats, messages, and ride details.
        </p>
      </section>

      {ride && (
        <section className="rideSummary">
          <div>
            <p className="eyebrow">Trip</p>
            <h2>
              {ride.from || "Starting point"} <span>→</span> {ride.to || "Destination"}
            </h2>

            <div className="chips">
              <div className="chip">📅 {ride.date || "Date"}</div>
              <div className="chip">🕒 {ride.time || "Time"}</div>
              <div className="chip">💵 ${ride.price || 0}</div>
              <div className="chip">🚘 {ride.vehicle || "Vehicle"}</div>
              <div className="chip active">● {ride.status || "active"}</div>
            </div>
          </div>
        </section>
      )}

      <section className="stats">
        <Metric icon="👥" label="Passengers" value={String(bookings.length)} />
        <Metric icon="🎟️" label="Confirmed" value={String(confirmed)} />
        <Metric icon="✅" label="Completed" value={String(completed)} />
        <Metric icon="❌" label="Cancelled" value={String(cancelled)} />
        <Metric icon="💺" label="Seats Booked" value={String(totalSeatsBooked)} />
        <Metric icon="💵" label="Revenue" value={`$${estimatedRevenue}`} />
      </section>

      <section className="passengerSection">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Passenger List</p>
            <h2>Reservations</h2>
          </div>

          <div className="liveBadge">Live</div>
        </div>

        {message && <p className="message">{message}</p>}

        {bookings.length === 0 ? (
          <div className="empty">
            <div className="emptyIcon">👥</div>
            <h3>No passengers yet</h3>
            <p>When passengers reserve this ride, they will appear here.</p>
          </div>
        ) : (
          <div className="passengerGrid">
            {bookings.map((booking) => (
              <article key={booking.id} className="passengerCard">
                <div className="passengerTop">
                  <div className="avatar">
                    {(booking.passengerEmail || "P").charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3>{booking.passengerEmail || "RoadLink Passenger"}</h3>
                    <p>{formatDate(booking.createdAt)}</p>
                  </div>
                </div>

                <div className="details">
                  <Info icon="🎟️" label="Booking Status" value={booking.status || "reserved"} />
                  <Info icon="💺" label="Seats Booked" value={String(booking.seatsBooked || 1)} />
                  <Info icon="📍" label="Route" value={`${ride?.from || "From"} → ${ride?.to || "To"}`} />
                  <Info icon="💵" label="Trip Price" value={`$${ride?.price || 0}`} />
                </div>

                <div className={getStatusClass(booking.status)}>
                  ● {booking.status || "reserved"}
                </div>

                <div className="cardButtons">
                  <Link
                    href={`/chat?rideId=${rideId}&driverId=${ride?.driverId || currentUserId}&passengerId=${booking.passengerId || ""}`}
                    className="primaryButton"
                  >
                    Message Passenger
                  </Link>

                  <Link
                    href={`/rate-driver?rideId=${rideId}&driverId=${ride?.driverId || currentUserId}`}
                    className="outlineButton"
                  >
                    Rating Page
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.11), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .rideSummary,
        .stats,
        .passengerSection {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .rideSummary,
        .metric,
        .passengerSection,
        .passengerCard,
        .empty {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
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
          cursor: pointer;
        }

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h2 span,
        .eyebrow,
        .metricValue,
        .active {
          color: #22c55e;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
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

        .rideSummary {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 22px;
        }

        .rideSummary h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0 0 18px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 20px;
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
          font-size: 26px;
          font-weight: 900;
        }

        .passengerSection {
          border-radius: 30px;
          padding: 28px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
        }

        .sectionHeader h2 {
          font-size: 34px;
          margin: 0;
        }

        .liveBadge {
          padding: 10px 15px;
          border-radius: 999px;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          font-weight: 900;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 24px 0;
        }

        .passengerGrid {
          display: grid;
          gap: 16px;
        }

        .passengerCard {
          border-radius: 26px;
          padding: 22px;
        }

        .passengerTop {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
        }

        .avatar {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 900;
          box-shadow: 0 12px 35px rgba(34,197,94,0.25);
        }

        .passengerTop h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .passengerTop p {
          color: #a1a1aa;
          margin: 0;
          font-weight: 800;
        }

        .details {
          display: grid;
          gap: 10px;
          margin-bottom: 16px;
        }

        .infoRow {
          display: grid;
          grid-template-columns: 42px 1fr auto;
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

        .infoLabel {
          color: #e5e7eb;
          font-weight: 900;
        }

        .infoValue {
          color: #a1a1aa;
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .status {
          display: inline-flex;
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 900;
          margin-bottom: 16px;
        }

        .reserved {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .completed {
          color: #38bdf8;
          background: rgba(56,189,248,0.12);
          border: 1px solid rgba(56,189,248,0.35);
        }

        .cancelled {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .primaryButton,
        .outlineButton {
          display: block;
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
        }

        .primaryButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .outlineButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
        }

        .empty {
          border-radius: 26px;
          padding: 34px;
          text-align: center;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          margin: 0 auto 18px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
        }

        .empty h3 {
          font-size: 28px;
          margin: 0 0 10px;
        }

        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 700px) {
          .page { padding: 16px; }

          .hero,
          .rideSummary,
          .passengerSection,
          .empty {
            padding: 24px;
            border-radius: 28px;
          }

          h1 { font-size: 48px; }

          .stats,
          .cardButtons {
            grid-template-columns: 1fr;
          }

          .sectionHeader {
            flex-direction: column;
            align-items: flex-start;
          }

          .infoRow {
            grid-template-columns: 42px 1fr;
          }

          .infoValue {
            grid-column: 2;
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
      <div className="infoLabel">{label}</div>
      <div className="infoValue">{value}</div>
    </div>
  );
 }
