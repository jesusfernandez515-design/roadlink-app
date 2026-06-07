"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  vehicle: string;
  notes?: string;
  status: string;
  driverId?: string;
  driverEmail?: string;
  createdAt?: string;
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
            ...document.data(),
            id: document.id,
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
            ...document.data(),
            id: document.id,
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

  const activeRides = rides.filter((ride) => ride.status === "active").length;
  const completedRides = rides.filter((ride) => ride.status === "completed").length;
  const cancelledRides = rides.filter((ride) => ride.status === "cancelled").length;

  const reservedSeats = bookings
    .filter((booking) => booking.status === "reserved")
    .reduce((total, booking) => total + Number(booking.seatsBooked || 1), 0);

  const estimatedEarnings = bookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce((total, booking) => {
      const ride = rides.find((item) => item.id === booking.rideId);
      return total + Number(ride?.price || 0) * Number(booking.seatsBooked || 1);
    }, 0);

  const groupedRides = useMemo(() => {
    return {
      active: rides.filter((ride) => ride.status === "active" || ride.status === "full"),
      completed: rides.filter((ride) => ride.status === "completed"),
      cancelled: rides.filter((ride) => ride.status === "cancelled"),
    };
  }, [rides]);

  function getPassengersForRide(rideId: string) {
    return bookings.filter(
      (booking) => booking.rideId === rideId && booking.status !== "cancelled"
    );
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

  function getStatusClass(status: string) {
    if (status === "active") return "status activeStatus";
    if (status === "full") return "status fullStatus";
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled") return "status cancelledStatus";
    return "status";
  }

  function RideCard({ ride }: { ride: Ride }) {
    const passengers = getPassengersForRide(ride.id);
    const isLoading = loadingRideId === ride.id;
    const isFinal = ride.status === "completed" || ride.status === "cancelled";

    return (
      <div className="rideCard">
        <div className="routeHeader">
          <div>
            <p className="eyebrow">Published Ride</p>
            <h2>
              {ride.from} <span>→</span> {ride.to}
            </h2>
          </div>

          <div className="priceBox">
            <small>PRICE</small>
            <strong>${ride.price}</strong>
          </div>
        </div>

        <div className="chips">
          <div className="chip">📅 {ride.date}</div>
          <div className="chip">🕒 {ride.time}</div>
          <div className="chip">💺 {ride.seats} seats left</div>
          <div className="chip">
            🎟️ {passengers.length} passenger{passengers.length === 1 ? "" : "s"}
          </div>
          <div className={getStatusClass(ride.status)}>● {ride.status}</div>
        </div>

        <div className="infoGrid">
          <Info icon="🚘" label="Vehicle" value={ride.vehicle || "Not specified"} />
          <Info
            icon="👤"
            label="Driver"
            value={ride.driverEmail || currentUser?.email || "RoadLink Driver"}
          />
          {ride.notes && <Info icon="📝" label="Notes" value={ride.notes} />}
        </div>

        {passengers.length > 0 && (
          <div className="passengerBox">
            <p className="eyebrow">Reserved Passengers</p>

            {passengers.slice(0, 3).map((booking) => (
              <div key={booking.id} className="passengerRow">
                <span>👤 {booking.passengerEmail || "RoadLink Passenger"}</span>
                <strong>{booking.status || "reserved"}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="cardButtons">
          <Link href={`/ride-details?rideId=${ride.id}`} className="outlineButton">
            View Details
          </Link>

          <Link href={`/ride-passengers?rideId=${ride.id}`} className="outlineButton">
            View Passengers
          </Link>

          <Link href={`/edit-ride?rideId=${ride.id}`} className="outlineButton">
            Edit Ride
          </Link>

          {!isFinal && (
            <button
              className="completeButton"
              onClick={() => updateRideStatus(ride, "completed")}
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Complete Ride"}
            </button>
          )}

          {!isFinal && (
            <button
              className="cancelButton"
              onClick={() => updateRideStatus(ride, "cancelled")}
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Cancel Ride"}
            </button>
          )}

          {ride.status === "cancelled" && (
            <button
              className="reactivateButton"
              onClick={() => updateRideStatus(ride, "active")}
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Reactivate Ride"}
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

        <p className="eyebrow">Driver Control Center</p>

        <h1>
          My <span>Rides</span>
        </h1>

        <p className="subtitle">
          Manage your published routes, passengers, availability, completed trips,
          and cancellations.
        </p>

        <div className="mainActions">
          <Link href="/offer-ride" className="primaryButton">
            Offer New Ride
          </Link>

          <Link href="/dashboard" className="secondaryTopButton">
            Back to Dashboard
          </Link>
        </div>
      </section>

      <section className="stats">
        <Metric icon="🚘" label="Total Rides" value={String(rides.length)} />
        <Metric icon="🟢" label="Active" value={String(activeRides)} />
        <Metric icon="✅" label="Completed" value={String(completedRides)} />
        <Metric icon="❌" label="Cancelled" value={String(cancelledRides)} />
        <Metric icon="🎟️" label="Reserved Seats" value={String(reservedSeats)} />
        <Metric icon="💵" label="Estimated" value={`$${estimatedEarnings}`} />
      </section>

      <section className="results">
        {message && <p className="message">{message}</p>}

        {rides.length === 0 ? (
          <div className="empty">
            <div className="emptyIcon">🚘</div>
            <h2>No rides published yet</h2>
            <p>Publish your first ride and start connecting with passengers.</p>

            <Link href="/offer-ride" className="primaryButton">
              Offer Your First Ride
            </Link>
          </div>
        ) : (
          <>
            {groupedRides.active.length > 0 && (
              <RideGroup title="Active Rides" count={groupedRides.active.length}>
                {groupedRides.active.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </RideGroup>
            )}

            {groupedRides.completed.length > 0 && (
              <RideGroup title="Completed Rides" count={groupedRides.completed.length}>
                {groupedRides.completed.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </RideGroup>
            )}

            {groupedRides.cancelled.length > 0 && (
              <RideGroup title="Cancelled Rides" count={groupedRides.cancelled.length}>
                {groupedRides.cancelled.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </RideGroup>
            )}
          </>
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

        .hero, .stats, .results {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero, .rideCard, .metric, .empty {
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
        .priceBox strong,
        .metricValue {
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
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .mainActions,
        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 30px;
        }

        .primaryButton,
        .secondaryTopButton {
          width: 100%;
          padding: 18px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-size: 17px;
          font-weight: 900;
        }

        .primaryButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          border: none;
        }

        .secondaryTopButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
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

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 26px 0;
        }

        .groupHeader {
          display: flex;
          justify-content: space-between;
          margin: 30px 0 16px;
        }

        .groupHeader h2 {
          font-size: 32px;
          margin: 0;
        }

        .groupPill {
          padding: 10px 15px;
          border-radius: 999px;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          font-weight: 900;
        }

        .rideCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .routeHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          margin-bottom: 20px;
        }

        .priceBox {
          min-width: 110px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          text-align: center;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .chip,
        .status {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
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

        .infoText span {
          color: #a1a1aa;
          overflow-wrap: anywhere;
        }

        .passengerBox {
          margin-top: 18px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.06);
          border: 1px solid rgba(34,197,94,0.18);
        }

        .passengerRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
        }

        .passengerRow strong {
          color: #22c55e;
        }

        .outlineButton,
        .completeButton,
        .cancelButton,
        .reactivateButton {
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          color: white;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
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
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          border: none;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .empty {
          border-radius: 30px;
          padding: 38px;
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

        .empty h2 {
          font-size: 30px;
          margin: 0 0 10px;
        }

        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0 0 22px;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero,
          .rideCard,
          .empty {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 50px;
          }

          .stats,
          .routeHeader,
          .cardButtons,
          .mainActions {
            grid-template-columns: 1fr;
          }

          .groupHeader {
            flex-direction: column;
            gap: 10px;
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
  children: React.ReactNode;
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
