"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  status?: string;
  price?: number;
  vehicle?: string;
  seats?: number;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  mapUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

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
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  mapUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TripItem = {
  id: string;
  type: "driver" | "passenger";
  rideId?: string;
  bookingId?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  status?: string;
  price?: number;
  seats?: number;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  mapUrl?: string;
  otherEmail?: string;
  vehicle?: string;
  createdAt?: string;
};

type FilterKey = "all" | "driver" | "passenger" | "active" | "completed" | "cancelled";

export default function TripHistoryPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading trip history...");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setStatus("Please sign in to view trip history.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribeDriverRides = onSnapshot(
      query(collection(db, "rides"), where("driverId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Ride[];

        setDriverRides(data);
      },
      (error) => setStatus(error.message)
    );

    const unsubscribePassengerBookings = onSnapshot(
      query(collection(db, "bookings"), where("passengerId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Booking[];

        setPassengerBookings(data);
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeDriverBookings = onSnapshot(
      query(collection(db, "bookings"), where("driverId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Booking[];

        setDriverBookings(data);
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeDriverRides();
      unsubscribePassengerBookings();
      unsubscribeDriverBookings();
    };
  }, [userId]);

  function getDateValue(value?: string) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function formatDate(value?: string) {
    if (!value) return "Recently";

    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function normalizeStatus(value?: string) {
    return String(value || "active").toLowerCase();
  }

  function getStatusClass(value?: string) {
    const clean = normalizeStatus(value);

    if (clean === "completed") return "statusPill completed";
    if (clean === "cancelled" || clean === "rejected") return "statusPill cancelled";
    if (clean === "confirmed") return "statusPill confirmed";
    if (clean === "reserved" || clean === "pending") return "statusPill reserved";

    return "statusPill active";
  }

  const trips = useMemo(() => {
    const driverTripItems: TripItem[] = driverRides.map((ride) => ({
      id: `driver-${ride.id}`,
      type: "driver",
      rideId: ride.id,
      from: ride.from,
      to: ride.to,
      date: ride.date,
      time: ride.time,
      status: ride.status || "active",
      price: Number(ride.price || 0),
      seats: Number(ride.seats || 0),
      distanceText: ride.distanceText,
      durationText: ride.durationText,
      distanceMiles: Number(ride.distanceMiles || 0),
      mapUrl: ride.mapUrl,
      otherEmail: ride.driverEmail,
      vehicle: ride.vehicle,
      createdAt: ride.createdAt || ride.updatedAt,
    }));

    const passengerTripItems: TripItem[] = passengerBookings.map((booking) => ({
      id: `passenger-${booking.id}`,
      type: "passenger",
      rideId: booking.rideId,
      bookingId: booking.id,
      from: booking.from,
      to: booking.to,
      date: booking.date,
      time: booking.time,
      status: booking.status || "reserved",
      price: Number(booking.price || 0),
      seats: Number(booking.seatsBooked || 1),
      distanceText: booking.distanceText,
      durationText: booking.durationText,
      distanceMiles: Number(booking.distanceMiles || 0),
      mapUrl: booking.mapUrl,
      otherEmail: booking.driverEmail,
      createdAt: booking.createdAt || booking.updatedAt,
    }));

    return [...driverTripItems, ...passengerTripItems].sort(
      (a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt)
    );
  }, [driverRides, passengerBookings]);

  const filteredTrips = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return trips.filter((trip) => {
      const tripStatus = normalizeStatus(trip.status);

      const matchesFilter =
        filter === "all" ||
        trip.type === filter ||
        tripStatus === filter ||
        (filter === "active" &&
          ["active", "reserved", "confirmed", "pending", "full"].includes(tripStatus));

      const text = `${trip.from || ""} ${trip.to || ""} ${trip.otherEmail || ""} ${
        trip.vehicle || ""
      } ${trip.status || ""}`.toLowerCase();

      const matchesSearch = !cleanSearch || text.includes(cleanSearch);

      return matchesFilter && matchesSearch;
    });
  }, [filter, search, trips]);

  const stats = useMemo(() => {
    const completedTrips = trips.filter((trip) => normalizeStatus(trip.status) === "completed");
    const cancelledTrips = trips.filter((trip) => normalizeStatus(trip.status) === "cancelled");

    const driverRevenue = driverBookings
      .filter((booking) => normalizeStatus(booking.status) === "completed")
      .reduce(
        (total, booking) =>
          total + Number(booking.price || 0) * Number(booking.seatsBooked || 1),
        0
      );

    const passengerSpent = passengerBookings
      .filter((booking) => normalizeStatus(booking.status) === "completed")
      .reduce(
        (total, booking) =>
          total + Number(booking.price || 0) * Number(booking.seatsBooked || 1),
        0
      );

    const totalMiles = trips.reduce(
      (total, trip) => total + Number(trip.distanceMiles || 0),
      0
    );

    return {
      totalTrips: trips.length,
      driverTrips: trips.filter((trip) => trip.type === "driver").length,
      passengerTrips: trips.filter((trip) => trip.type === "passenger").length,
      completedTrips: completedTrips.length,
      cancelledTrips: cancelledTrips.length,
      driverRevenue,
      passengerSpent,
      totalMiles,
    };
  }, [trips, driverBookings, passengerBookings]);

  const filters: { key: FilterKey; label: string; icon: string }[] = [
    { key: "all", label: "All", icon: "🌐" },
    { key: "driver", label: "Driver", icon: "🚗" },
    { key: "passenger", label: "Passenger", icon: "🎟️" },
    { key: "active", label: "Active", icon: "🟢" },
    { key: "completed", label: "Completed", icon: "✅" },
    { key: "cancelled", label: "Cancelled", icon: "❌" },
  ];

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/my-rides" className="navButton">My Rides</Link>
          <Link href="/my-bookings" className="navButton">My Bookings</Link>
          <Link href="/wallet" className="navButton">Wallet</Link>
          <Link href="/reviews" className="navButton">Reviews</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Travel Records</p>
            <h1>Trip <span>History</span></h1>
            <p className="subtitle">
              Complete premium timeline of your driver trips, passenger bookings, earnings,
              spending, distance and completed activity.
            </p>
          </div>

          <div className="liveOrb">
            <strong>{stats.totalTrips}</strong>
            <span>Total Trips</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="🌐" label="Total Trips" value={String(stats.totalTrips)} />
          <Metric icon="🚗" label="Driver Trips" value={String(stats.driverTrips)} />
          <Metric icon="🎟️" label="Passenger Trips" value={String(stats.passengerTrips)} />
          <Metric icon="✅" label="Completed" value={String(stats.completedTrips)} />
          <Metric icon="💰" label="Earned" value={money(stats.driverRevenue)} />
          <Metric icon="💳" label="Spent" value={money(stats.passengerSpent)} />
          <Metric icon="🛣️" label="Miles" value={`${stats.totalMiles.toFixed(1)} mi`} />
          <Metric icon="❌" label="Cancelled" value={String(stats.cancelledTrips)} />
        </section>

        <section className="controls">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Search Trip History</h2>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by route, email, vehicle or status..."
          />

          <div className="filterGrid">
            {filters.map((item) => (
              <button
                key={item.key}
                className={filter === item.key ? "filterButton activeFilter" : "filterButton"}
                onClick={() => setFilter(item.key)}
              >
                <span>{item.icon}</span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="timelinePanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>{filteredTrips.length} Trips Showing</h2>
            </div>
          </div>

          {filteredTrips.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🛣️</div>
              <h3>No trips found</h3>
              <p>Your rides and bookings will appear here once RoadLink activity begins.</p>
            </div>
          ) : (
            <div className="timeline">
              {filteredTrips.map((trip) => (
                <article key={trip.id} className="tripCard">
                  <div className={trip.type === "driver" ? "tripIcon driverIcon" : "tripIcon"}>
                    {trip.type === "driver" ? "🚗" : "🎟️"}
                  </div>

                  <div className="tripContent">
                    <div className="tripTop">
                      <div>
                        <p className="tripType">
                          {trip.type === "driver" ? "Driver Trip" : "Passenger Booking"}
                        </p>
                        <h3>{trip.from || "Origin"} → {trip.to || "Destination"}</h3>
                      </div>

                      <span className={getStatusClass(trip.status)}>
                        {trip.status || "active"}
                      </span>
                    </div>

                    <div className="tripMeta">
                      <span>📅 {trip.date || "Date pending"}</span>
                      <span>🕒 {trip.time || "Time pending"}</span>
                      <span>💵 {money(trip.price)}</span>
                      <span>💺 {trip.seats || 1} seat{Number(trip.seats || 1) === 1 ? "" : "s"}</span>
                      {trip.distanceText && <span>🛣️ {trip.distanceText}</span>}
                      {trip.durationText && <span>⏱️ {trip.durationText}</span>}
                    </div>

                    <div className="infoGrid">
                      <Info label={trip.type === "driver" ? "Driver" : "Driver Email"} value={trip.otherEmail || userEmail || "RoadLink User"} />
                      <Info label="Vehicle" value={trip.vehicle || "Not specified"} />
                      <Info label="Created" value={formatDate(trip.createdAt)} />
                    </div>

                    <div className="actions">
                      {trip.mapUrl && (
                        <a href={trip.mapUrl} target="_blank" rel="noopener noreferrer" className="actionButton">
                          Open Map
                        </a>
                      )}

                      {trip.rideId && (
                        <Link href={`/ride-details?rideId=${trip.rideId}`} className="actionButton">
                          Ride Details
                        </Link>
                      )}

                      {trip.rideId && (
                        <Link href={`/live-trip?rideId=${trip.rideId}&bookingId=${trip.bookingId || ""}`} className="actionButton greenButton">
                          Live Trip
                        </Link>
                      )}

                      {normalizeStatus(trip.status) === "completed" && trip.type === "passenger" && (
                        <Link href={`/rate-driver?rideId=${trip.rideId || ""}&bookingId=${trip.bookingId || ""}`} className="actionButton greenButton">
                          Rate Driver
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 24px;
          padding-bottom: 120px;
          color: white;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topBar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .navButton,
        .actionButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: inline-flex;
          justify-content: center;
        }

        .hero,
        .metric,
        .controls,
        .timelinePanel,
        .tripCard {
          background: rgba(8,13,25,0.9);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 35px;
          border-radius: 32px;
          margin-bottom: 20px;
        }

        .eyebrow {
          color: #22c55e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 13px;
          margin: 0 0 10px;
        }

        h1 {
          margin: 0 0 16px;
          font-size: 60px;
          line-height: 1;
        }

        h1 span,
        h2,
        .metric strong,
        .liveOrb strong {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .liveOrb {
          min-width: 128px;
          height: 128px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
          text-align: center;
        }

        .liveOrb strong {
          font-size: 36px;
        }

        .liveOrb span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .metric {
          padding: 18px;
          border-radius: 22px;
        }

        .metricIcon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .metric span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .metric strong {
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .controls,
        .timelinePanel {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        input {
          width: 100%;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
          margin: 16px 0;
        }

        .filterGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }

        .filterButton {
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeFilter {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.4);
        }

        .filterButton span {
          display: block;
          font-size: 24px;
          margin-bottom: 6px;
        }

        .filterButton strong {
          display: block;
        }

        .sectionHeader {
          margin-bottom: 20px;
        }

        .timeline {
          display: grid;
          gap: 16px;
        }

        .tripCard {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          border-radius: 26px;
          padding: 22px;
          box-shadow: none;
        }

        .tripIcon {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(59,130,246,0.14);
          border: 1px solid rgba(59,130,246,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
        }

        .driverIcon {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.35);
        }

        .tripTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .tripType {
          color: #22c55e;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 12px;
          margin: 0 0 6px;
        }

        .tripTop h3 {
          margin: 0;
          font-size: 24px;
          overflow-wrap: anywhere;
        }

        .statusPill {
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-transform: capitalize;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .statusPill.active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .statusPill.completed {
          color: #a78bfa;
          background: rgba(167,139,250,0.12);
          border-color: rgba(167,139,250,0.35);
        }

        .statusPill.cancelled {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .statusPill.confirmed {
          color: #38bdf8;
          background: rgba(56,189,248,0.12);
          border-color: rgba(56,189,248,0.35);
        }

        .statusPill.reserved {
          color: #fde68a;
          background: rgba(234,179,8,0.12);
          border-color: rgba(234,179,8,0.35);
        }

        .tripMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
        }

        .tripMeta span {
          color: #d4d4d8;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 13px;
          font-weight: 900;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .info {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          display: block;
          color: #e5e7eb;
          overflow-wrap: anywhere;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .greenButton {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .empty {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          margin-bottom: 16px;
        }

        .empty p {
          color: #a1a1aa;
        }

        @media (max-width: 1000px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .filterGrid,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          .hero,
          .tripTop {
            flex-direction: column;
            align-items: flex-start;
          }

          h1 {
            font-size: 44px;
          }

          .tripCard {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .controls,
          .timelinePanel,
          .tripCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .actions {
            display: grid;
          }

          .actionButton {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
      }
