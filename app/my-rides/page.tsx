"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  price: number;
  status: string;
  vehicle?: string;
  driverId?: string;
  driverEmail?: string;
  createdAt?: string;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  mapUrl?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  seatsBooked?: number;
};

export default function MyRidesPage() {
  const router = useRouter();

  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading your rides...");

  useEffect(() => {
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setMessage("Please sign in to view your rides.");
        router.push("/login");
        return;
      }

      const ridesQuery = query(
        collection(db, "rides"),
        where("driverId", "==", user.uid)
      );

      unsubscribeRides = onSnapshot(
        ridesQuery,
        (snapshot) => {
          const ridesData = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[];

          ridesData.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setRides(ridesData);
          setMessage(ridesData.length ? "" : "You have not published any rides yet.");
        },
        (error) => setMessage(error.message)
      );

      const bookingsQuery = query(
        collection(db, "bookings"),
        where("driverId", "==", user.uid)
      );

      unsubscribeBookings = onSnapshot(
        bookingsQuery,
        (snapshot) => {
          const bookingData = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          setBookings(bookingData);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, [router]);

  const groupedRides = useMemo(() => {
    return {
      active: rides.filter((ride) => ride.status === "active" || ride.status === "full"),
      completed: rides.filter((ride) => ride.status === "completed"),
      cancelled: rides.filter((ride) => ride.status === "cancelled"),
    };
  }, [rides]);

  const reservedSeats = bookings
    .filter((booking) => booking.status === "reserved")
    .reduce((total, booking) => total + Number(booking.seatsBooked || 1), 0);

  const estimatedEarnings = bookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce((total, booking) => {
      const ride = rides.find((item) => item.id === booking.rideId);
      return total + Number(ride?.price || 0) * Number(booking.seatsBooked || 1);
    }, 0);

  function getPassengersForRide(rideId: string) {
    return bookings.filter(
      (booking) => booking.rideId === rideId && booking.status !== "cancelled"
    );
  }

  function formatMoney(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function shortText(value: string, max = 24) {
    if (!value) return "N/A";
    return value.length > max ? `${value.slice(0, max)}...` : value;
  }

  function getStatusClass(status: string) {
    if (status === "active") return "status activeStatus";
    if (status === "full") return "status fullStatus";
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled") return "status cancelledStatus";
    return "status";
  }

  function RideCard({ ride }: { ride: Ride }) {
    const passengers = getPassengersForRide(ride.id);

    return (
      <article className="rideCard">
        <div className="rideTop">
          <div>
            <p className="eyebrow">Route</p>
            <h2>
              {shortText(ride.from)} <span>→</span> {shortText(ride.to)}
            </h2>
          </div>

          <strong className="price">{formatMoney(ride.price)}</strong>
        </div>

        <div className="compactInfo">
          <span>📅 {ride.date || "N/A"}</span>
          <span>🕒 {ride.time || "N/A"}</span>
          <span>🛣️ {ride.distanceText || "N/A"}</span>
          <span>⏱️ {ride.durationText || "N/A"}</span>
          <span>💺 {ride.seats || 0} seats</span>
          <span>👥 {passengers.length} passengers</span>
        </div>

        <div className="rideBottom">
          <div className={getStatusClass(ride.status)}>● {ride.status}</div>

          <div className="actions">
            <Link href={`/ride-details?rideId=${ride.id}`} className="manageButton">
              Manage
            </Link>

            {ride.mapUrl && (
              <a
                href={ride.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mapButton"
              >
                Map
              </a>
            )}
          </div>
        </div>
      </article>
    );
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
          <Link href="/offer-ride" className="miniButton">
            Offer
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <p className="eyebrow">Driver Center</p>

        <h1>
          My <span>Rides</span>
        </h1>

        <p className="subtitle">
          Compact view of your routes, passengers, earnings, and trip status.
        </p>

        <Link href="/offer-ride" className="primaryButton">
          Offer New Ride
        </Link>
      </section>

      <section className="stats">
        <Metric label="Total" value={String(rides.length)} />
        <Metric label="Active" value={String(groupedRides.active.length)} />
        <Metric label="Done" value={String(groupedRides.completed.length)} />
        <Metric label="Cancel" value={String(groupedRides.cancelled.length)} />
        <Metric label="Seats" value={String(reservedSeats)} />
        <Metric label="Earned" value={formatMoney(estimatedEarnings)} />
      </section>

      <section className="results">
        {message && <p className="message">{message}</p>}

        {rides.length === 0 ? (
          <div className="empty">
            <h2>No rides yet</h2>
            <p>Publish your first ride and start receiving passengers.</p>
            <Link href="/offer-ride" className="primaryButton">
              Offer Your First Ride
            </Link>
          </div>
        ) : (
          <>
            {groupedRides.active.length > 0 && (
              <RideGroup title="Active" count={groupedRides.active.length}>
                {groupedRides.active.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </RideGroup>
            )}

            {groupedRides.completed.length > 0 && (
              <RideGroup title="Completed" count={groupedRides.completed.length}>
                {groupedRides.completed.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </RideGroup>
            )}

            {groupedRides.cancelled.length > 0 && (
              <RideGroup title="Cancelled" count={groupedRides.cancelled.length}>
                {groupedRides.cancelled.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </RideGroup>
            )}
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
            radial-gradient(circle at top right, rgba(34,197,94,0.14), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.1), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 16px;
          padding-bottom: 105px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .results {
          max-width: 860px;
          margin: 0 auto;
        }

        .hero,
        .rideCard,
        .metric,
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
        h2 span,
        .eyebrow,
        .metricValue,
        .price {
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
          font-size: 44px;
          line-height: 1;
          margin: 0 0 12px;
        }

        h2 {
          margin: 0;
          font-size: 21px;
          line-height: 1.18;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 16px;
          line-height: 1.4;
          margin: 0 0 18px;
        }

        .primaryButton {
          display: block;
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          border: none;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
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

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0;
        }

        .groupHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 22px 0 10px;
        }

        .groupHeader h2 {
          font-size: 26px;
        }

        .groupPill {
          min-width: 32px;
          height: 32px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.28);
          font-weight: 900;
        }

        .rideCard {
          border-radius: 22px;
          padding: 15px;
          margin-bottom: 10px;
        }

        .rideTop {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: start;
          margin-bottom: 12px;
        }

        .price {
          min-width: 82px;
          text-align: center;
          padding: 10px 12px;
          border-radius: 16px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.25);
          font-size: 20px;
        }

        .compactInfo {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 7px;
          margin-bottom: 12px;
        }

        .compactInfo span {
          padding: 9px 10px;
          border-radius: 13px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
          color: #d1d5db;
          font-size: 12px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .rideBottom {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
        }

        .status {
          width: fit-content;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          font-weight: 900;
          font-size: 12px;
          text-transform: capitalize;
        }

        .activeStatus {
          color: #22c55e;
          border-color: rgba(34,197,94,0.35);
        }

        .fullStatus {
          color: #fbbf24;
          border-color: rgba(251,191,36,0.35);
        }

        .completedStatus {
          color: #38bdf8;
          border-color: rgba(56,189,248,0.35);
        }

        .cancelledStatus {
          color: #fca5a5;
          border-color: rgba(239,68,68,0.35);
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .manageButton,
        .mapButton {
          padding: 10px 14px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          font-size: 12px;
          color: white;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          white-space: nowrap;
        }

        .mapButton {
          color: #22c55e;
          background: rgba(34,197,94,0.08);
          border-color: rgba(34,197,94,0.28);
        }

        .empty {
          border-radius: 24px;
          padding: 26px;
          text-align: center;
        }

        .empty p {
          color: #a1a1aa;
        }

        @media (min-width: 760px) {
          .compactInfo {
            grid-template-columns: repeat(6, 1fr);
          }
        }

        @media (max-width: 430px) {
          .page {
            padding: 13px;
            padding-bottom: 105px;
          }

          h1 {
            font-size: 40px;
          }

          h2 {
            font-size: 19px;
          }

          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .metric {
            padding: 11px;
          }

          .metricValue {
            font-size: 18px;
          }

          .rideTop {
            grid-template-columns: 1fr;
          }

          .price {
            width: 100%;
          }

          .rideBottom {
            grid-template-columns: 1fr;
          }

          .actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function RideGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="groupHeader">
        <h2>{title}</h2>
        <div className="groupPill">{count}</div>
      </div>
      {children}
    </section>
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
