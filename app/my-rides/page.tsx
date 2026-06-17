"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  price: number;
  suggestedPrice?: number;
  vehicle: string;
  notes?: string;
  status: string;
  driverId?: string;
  driverEmail?: string;
  createdAt?: string;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  durationMinutes?: number;
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
  const [loadingRideId, setLoadingRideId] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCurrentUser(null);
        setMessage("Please sign in to view your rides.");
        router.push("/login");
        return;
      }

      setCurrentUser(user);
      setMessage("Loading your rides...");

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

  const activeRides = groupedRides.active.length;
  const completedRides = groupedRides.completed.length;
  const cancelledRides = groupedRides.cancelled.length;

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

  function getStatusClass(status: string) {
    if (status === "active") return "status activeStatus";
    if (status === "full") return "status fullStatus";
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled") return "status cancelledStatus";
    return "status";
  }

  async function updateRideStatus(
    ride: Ride,
    status: "completed" | "cancelled" | "active"
  ) {
    if (!currentUser) return;

    const confirmed = confirm(`Are you sure you want to ${status} this ride?`);
    if (!confirmed) return;

    try {
      setLoadingRideId(ride.id);
      setMessage("");

      await updateDoc(doc(db, "rides", ride.id), {
        status,
        updatedAt: new Date().toISOString(),
      });

      const ridePassengers = getPassengersForRide(ride.id);

      await Promise.all(
        ridePassengers.map(async (booking) => {
          await updateDoc(doc(db, "bookings", booking.id), {
            status,
            updatedAt: new Date().toISOString(),
          });

          if (booking.passengerId) {
            await addDoc(collection(db, "notifications"), {
              userId: booking.passengerId,
              type: "ride",
              title:
                status === "completed"
                  ? "Ride Completed"
                  : status === "cancelled"
                  ? "Ride Cancelled"
                  : "Ride Updated",
              message:
                status === "completed"
                  ? `Your trip from ${ride.from} to ${ride.to} was completed.`
                  : status === "cancelled"
                  ? `Your trip from ${ride.from} to ${ride.to} was cancelled.`
                  : `Your trip from ${ride.from} to ${ride.to} was updated.`,
              read: false,
              createdAt: new Date().toISOString(),
            });
          }
        })
      );

      setMessage(`Ride ${status} successfully.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingRideId("");
    }
  }

  function RideCard({ ride }: { ride: Ride }) {
    const passengers = getPassengersForRide(ride.id);
    const isLoading = loadingRideId === ride.id;
    const isFinal = ride.status === "completed" || ride.status === "cancelled";

    return (
      <div className="rideCard">
        <div className="cardTop">
          <div>
            <p className="eyebrow">Route</p>
            <h2>
              {ride.from} <span>→</span> {ride.to}
            </h2>
          </div>

          <div className="priceBox">
            <small>Price</small>
            <strong>{formatMoney(ride.price)}</strong>
          </div>
        </div>

        <div className="quickGrid">
          <MiniInfo label="Date" value={ride.date || "N/A"} />
          <MiniInfo label="Time" value={ride.time || "N/A"} />
          <MiniInfo label="Seats" value={`${ride.seats || 0} left`} />
          <MiniInfo label="Passengers" value={String(passengers.length)} />
          <MiniInfo label="Distance" value={ride.distanceText || "N/A"} />
          <MiniInfo label="Duration" value={ride.durationText || "N/A"} />
        </div>

        <div className="statusRow">
          <div className={getStatusClass(ride.status)}>● {ride.status}</div>
          <span>{ride.vehicle || "Vehicle not specified"}</span>
        </div>

        {passengers.length > 0 && (
          <div className="passengerPreview">
            <strong>Passenger:</strong>{" "}
            {passengers[0]?.passengerEmail || "RoadLink Passenger"}
            {passengers.length > 1 && ` +${passengers.length - 1} more`}
          </div>
        )}

        <div className="buttons">
          <Link href={`/ride-details?rideId=${ride.id}`} className="outlineButton">
            Details
          </Link>

          <Link href={`/ride-passengers?rideId=${ride.id}`} className="outlineButton">
            Passengers
          </Link>

          <Link href={`/edit-ride?rideId=${ride.id}`} className="outlineButton">
            Edit
          </Link>

          {ride.mapUrl && (
            <a
              href={ride.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mapButton"
            >
              Maps
            </a>
          )}

          {!isFinal && (
            <button
              className="completeButton"
              onClick={() => updateRideStatus(ride, "completed")}
              disabled={isLoading}
            >
              {isLoading ? "..." : "Complete"}
            </button>
          )}

          {!isFinal && (
            <button
              className="cancelButton"
              onClick={() => updateRideStatus(ride, "cancelled")}
              disabled={isLoading}
            >
              {isLoading ? "..." : "Cancel"}
            </button>
          )}

          {ride.status === "cancelled" && (
            <button
              className="reactivateButton"
              onClick={() => updateRideStatus(ride, "active")}
              disabled={isLoading}
            >
              {isLoading ? "..." : "Reactivate"}
            </button>
          )}
        </div>
      </div>
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
          Manage your routes, passengers, trip status, and map details.
        </p>

        <Link href="/offer-ride" className="primaryButton">
          Offer New Ride
        </Link>
      </section>

      <section className="stats">
        <Metric label="Total" value={String(rides.length)} />
        <Metric label="Active" value={String(activeRides)} />
        <Metric label="Done" value={String(completedRides)} />
        <Metric label="Cancel" value={String(cancelledRides)} />
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
            radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.1), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 18px;
          font-family: Arial, sans-serif;
          padding-bottom: 110px;
        }

        .hero,
        .stats,
        .results {
          max-width: 900px;
          margin: 0 auto;
        }

        .hero,
        .rideCard,
        .metric,
        .empty {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 22px 70px rgba(0,0,0,0.42);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 30px;
          padding: 24px;
          margin-bottom: 16px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 10px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
        }

        .logo {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 20px;
        }

        .logo span,
        h1 span,
        h2 span,
        .eyebrow,
        .metricValue {
          color: #22c55e;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 48px;
          line-height: 1;
          margin: 0 0 14px;
        }

        h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1.15;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 17px;
          line-height: 1.45;
          margin: 0 0 22px;
        }

        .primaryButton {
          display: block;
          width: 100%;
          padding: 17px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-size: 16px;
          font-weight: 900;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          border: none;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }

        .metric {
          border-radius: 20px;
          padding: 16px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 20px 0;
        }

        .groupHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 24px 0 12px;
        }

        .groupHeader h2 {
          font-size: 28px;
        }

        .groupPill {
          min-width: 36px;
          height: 36px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          font-weight: 900;
        }

        .rideCard {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 14px;
        }

        .cardTop {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }

        .priceBox {
          padding: 14px;
          border-radius: 18px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.28);
        }

        .priceBox small {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .priceBox strong {
          color: #22c55e;
          font-size: 26px;
        }

        .quickGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }

        .miniInfo {
          padding: 11px;
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
          font-size: 14px;
          color: white;
          overflow-wrap: anywhere;
        }

        .statusRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .statusRow span {
          color: #a1a1aa;
          font-weight: 800;
          font-size: 13px;
          text-align: right;
        }

        .status {
          padding: 8px 12px;
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

        .passengerPreview {
          padding: 12px;
          border-radius: 16px;
          background: rgba(34,197,94,0.07);
          border: 1px solid rgba(34,197,94,0.18);
          color: #d1d5db;
          font-size: 13px;
          margin-bottom: 12px;
          overflow-wrap: anywhere;
        }

        .passengerPreview strong {
          color: #22c55e;
        }

        .buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
        }

        .outlineButton,
        .completeButton,
        .cancelButton,
        .reactivateButton,
        .mapButton {
          width: 100%;
          padding: 12px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
          color: white;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
        }

        .mapButton {
          color: #22c55e;
          background: rgba(34,197,94,0.08);
          border-color: rgba(34,197,94,0.28);
        }

        .completeButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        .cancelButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          border: none;
        }

        .reactivateButton {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          border: none;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .empty {
          border-radius: 24px;
          padding: 28px;
          text-align: center;
        }

        .empty p {
          color: #a1a1aa;
        }

        @media (min-width: 760px) {
          .cardTop {
            grid-template-columns: 1fr 170px;
          }

          .quickGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .buttons {
            grid-template-columns: repeat(6, 1fr);
          }
        }

        @media (max-width: 430px) {
          .page {
            padding: 14px;
            padding-bottom: 110px;
          }

          h1 {
            font-size: 42px;
          }

          h2 {
            font-size: 21px;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .hero {
            padding: 22px;
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

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="miniInfo">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
