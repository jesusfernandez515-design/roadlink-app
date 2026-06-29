"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Booking = {
  id: string;
  rideId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
  distanceText?: string;
  durationMinutes?: number;
  durationText?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

type PayoutRequest = {
  id: string;
  userId?: string;
  email?: string;
  amount?: number;
  status?: "pending" | "approved" | "rejected" | "paid";
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
};

type Rating = {
  id: string;
  driverId?: string;
  rating?: number;
  stars?: number;
  createdAt?: string;
};

type FilterKey = "all" | "completed" | "pending" | "cancelled" | "paid";

export default function DriverEarningsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [status, setStatus] = useState("Loading driver earnings...");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setStatus("Please sign in to view driver earnings.");
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

    const unsubscribeBookings = onSnapshot(
      query(collection(db, "bookings"), where("driverId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Booking[];

        data.sort((a, b) =>
          String(b.completedAt || b.updatedAt || b.createdAt || "").localeCompare(
            String(a.completedAt || a.updatedAt || a.createdAt || "")
          )
        );

        setBookings(data);
      },
      (error) => setStatus(error.message)
    );

    const unsubscribePayouts = onSnapshot(
      query(collection(db, "payoutRequests"), where("userId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as PayoutRequest[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setPayouts(data);
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeRatings = onSnapshot(
      query(collection(db, "ratings"), where("driverId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Rating[];

        setRatings(data);
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeBookings();
      unsubscribePayouts();
      unsubscribeRatings();
    };
  }, [userId]);

  function normalizeStatus(value?: string) {
    return String(value || "pending").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getAmount(booking: Booking) {
    return Number(booking.price || 0) * Number(booking.seatsBooked || 1);
  }

  function getDate(value?: string) {
    if (!value) return new Date(0);

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function formatDate(value?: string) {
    const date = getDate(value);

    if (date.getTime() === 0) return "Recently";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isToday(value?: string) {
    const date = getDate(value);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  }

  function isThisWeek(value?: string) {
    const date = getDate(value);
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    return date >= sevenDaysAgo && date <= now;
  }

  function isThisMonth(value?: string) {
    const date = getDate(value);
    const now = new Date();

    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  const stats = useMemo(() => {
    const completed = bookings.filter((item) => normalizeStatus(item.status) === "completed");
    const pending = bookings.filter((item) =>
      ["reserved", "confirmed", "pending"].includes(normalizeStatus(item.status))
    );
    const cancelled = bookings.filter((item) => normalizeStatus(item.status) === "cancelled");

    const gross = completed.reduce((total, item) => total + getAmount(item), 0);
    const roadLinkFee = Math.round(gross * 0.12);
    const net = Math.max(gross - roadLinkFee, 0);

    const paidOut = payouts
      .filter((item) => item.status === "paid")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const activePayouts = payouts
      .filter((item) => item.status === "pending" || item.status === "approved")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const available = Math.max(net - paidOut - activePayouts, 0);

    const today = completed
      .filter((item) => isToday(item.completedAt || item.updatedAt || item.createdAt))
      .reduce((total, item) => total + getAmount(item), 0);

    const week = completed
      .filter((item) => isThisWeek(item.completedAt || item.updatedAt || item.createdAt))
      .reduce((total, item) => total + getAmount(item), 0);

    const month = completed
      .filter((item) => isThisMonth(item.completedAt || item.updatedAt || item.createdAt))
      .reduce((total, item) => total + getAmount(item), 0);

    const totalMiles = completed.reduce(
      (total, item) => total + Number(item.distanceMiles || 0),
      0
    );

    const totalSeats = completed.reduce(
      (total, item) => total + Number(item.seatsBooked || 1),
      0
    );

    const avgPerTrip = completed.length ? gross / completed.length : 0;
    const avgPerMile = totalMiles ? gross / totalMiles : 0;

    const fuelEstimate = totalMiles * 0.18;
    const profitEstimate = Math.max(net - fuelEstimate, 0);

    const avgRating = ratings.length
      ? ratings.reduce((total, item) => total + Number(item.stars || item.rating || 0), 0) /
        ratings.length
      : 0;

    return {
      completed,
      pending,
      cancelled,
      gross,
      roadLinkFee,
      net,
      paidOut,
      activePayouts,
      available,
      today,
      week,
      month,
      totalMiles,
      totalSeats,
      avgPerTrip,
      avgPerMile,
      fuelEstimate,
      profitEstimate,
      avgRating,
    };
  }, [bookings, payouts, ratings]);

  const visibleBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const bookingStatus = normalizeStatus(booking.status);

      if (filter === "all") return true;
      if (filter === "completed") return bookingStatus === "completed";
      if (filter === "pending") return ["reserved", "confirmed", "pending"].includes(bookingStatus);
      if (filter === "cancelled") return bookingStatus === "cancelled";
      if (filter === "paid") return bookingStatus === "completed";

      return true;
    });
  }, [bookings, filter]);

  const driverLevel = useMemo(() => {
    const completed = stats.completed.length;

    if (completed >= 100 && stats.avgRating >= 4.8) return "Elite Driver";
    if (completed >= 50 && stats.avgRating >= 4.5) return "Premium Driver";
    if (completed >= 15) return "Trusted Driver";
    if (completed >= 1) return "Active Driver";

    return "New Driver";
  }, [stats.avgRating, stats.completed.length]);

  async function requestPayout() {
    if (!userId) return;

    if (stats.available <= 0) {
      setStatus("No available balance to request.");
      return;
    }

    const hasActive = payouts.some(
      (item) => item.status === "pending" || item.status === "approved"
    );

    if (hasActive) {
      setStatus("You already have an active payout request.");
      return;
    }

    try {
      setRequesting(true);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "payoutRequests"), {
        userId,
        email: userEmail,
        driverEmail: userEmail,
        amount: Number(stats.available.toFixed(2)),
        status: "pending",
        source: "driver_earnings",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "payout",
        title: "Payout Requested",
        message: `Your driver payout request for ${money(stats.available)} was submitted.`,
        read: false,
        createdAt: now,
        actionUrl: "/driver-earnings",
      });

      setStatus("Payout request submitted.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not request payout.");
    } finally {
      setRequesting(false);
    }
  }

  const filters: { key: FilterKey; label: string; icon: string }[] = [
    { key: "all", label: "All", icon: "🌐" },
    { key: "completed", label: "Completed", icon: "✅" },
    { key: "pending", label: "Pending", icon: "⏳" },
    { key: "cancelled", label: "Cancelled", icon: "❌" },
    { key: "paid", label: "Payable", icon: "💵" },
  ];

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/wallet" className="navButton">Wallet</Link>
          <Link href="/trip-history" className="navButton">Trip History</Link>
          <Link href="/my-rides" className="navButton">My Rides</Link>
          <Link href="/reviews" className="navButton">Reviews</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Driver Finance</p>
            <h1>Driver <span>Earnings</span></h1>
            <p className="subtitle">
              Track real-time driver revenue, net profit, payout balance, miles, passengers,
              ratings and financial performance.
            </p>
          </div>

          <div className="levelOrb">
            <strong>{driverLevel}</strong>
            <span>{stats.completed.length} trips</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="balanceCard">
          <div>
            <p className="eyebrow">Available Balance</p>
            <h2>{money(stats.available)}</h2>
            <p>
              Net earnings minus paid payouts and active payout requests.
            </p>
          </div>

          <button onClick={requestPayout} disabled={requesting || stats.available <= 0}>
            {requesting ? "Requesting..." : "Request Payout"}
          </button>
        </section>

        <section className="stats">
          <Metric icon="💰" label="Gross Earnings" value={money(stats.gross)} />
          <Metric icon="🧾" label="RoadLink Fee" value={money(stats.roadLinkFee)} />
          <Metric icon="✅" label="Net Earnings" value={money(stats.net)} />
          <Metric icon="🏦" label="Paid Out" value={money(stats.paidOut)} />
          <Metric icon="📅" label="Today" value={money(stats.today)} />
          <Metric icon="📆" label="This Week" value={money(stats.week)} />
          <Metric icon="🗓️" label="This Month" value={money(stats.month)} />
          <Metric icon="📈" label="Profit Est." value={money(stats.profitEstimate)} />
          <Metric icon="🚗" label="Completed Trips" value={String(stats.completed.length)} />
          <Metric icon="👥" label="Passengers" value={String(stats.totalSeats)} />
          <Metric icon="🛣️" label="Miles" value={`${stats.totalMiles.toFixed(1)} mi`} />
          <Metric icon="⭐" label="Rating" value={stats.avgRating ? stats.avgRating.toFixed(1) : "New"} />
        </section>

        <section className="analyticsGrid">
          <section className="panel">
            <p className="eyebrow">Performance</p>
            <h2>Driver Metrics</h2>

            <Info label="Average per trip" value={money(stats.avgPerTrip)} />
            <Info label="Average per mile" value={money(stats.avgPerMile)} />
            <Info label="Estimated fuel cost" value={money(stats.fuelEstimate)} />
            <Info label="Estimated profit" value={money(stats.profitEstimate)} />
            <Info label="Pending bookings" value={String(stats.pending.length)} />
            <Info label="Cancelled bookings" value={String(stats.cancelled.length)} />
          </section>

          <section className="panel">
            <p className="eyebrow">Driver Level</p>
            <h2>{driverLevel}</h2>

            <div className="levelBox">
              <strong>{stats.completed.length}</strong>
              <span>Completed Trips</span>
            </div>

            <p className="muted">
              Keep completing rides and maintaining high reviews to unlock higher RoadLink driver levels.
            </p>
          </section>
        </section>

        <section className="filters">
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
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Trip Earnings</p>
              <h2>{visibleBookings.length} Records</h2>
            </div>
          </div>

          {visibleBookings.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">💰</div>
              <h3>No earnings yet</h3>
              <p>Completed driver bookings will appear here.</p>
            </div>
          ) : (
            <div className="list">
              {visibleBookings.map((booking) => {
                const amount = getAmount(booking);
                const bookingStatus = normalizeStatus(booking.status);

                return (
                  <article key={booking.id} className="earningCard">
                    <div className="earningIcon">
                      {bookingStatus === "completed" ? "✅" : bookingStatus === "cancelled" ? "❌" : "⏳"}
                    </div>

                    <div className="earningContent">
                      <div className="earningTop">
                        <div>
                          <h3>{booking.from || "Origin"} → {booking.to || "Destination"}</h3>
                          <p>{booking.passengerEmail || "Passenger"}</p>
                        </div>

                        <strong>{money(amount)}</strong>
                      </div>

                      <div className="meta">
                        <span>{booking.status || "pending"}</span>
                        <span>{booking.seatsBooked || 1} seat</span>
                        {booking.distanceText && <span>{booking.distanceText}</span>}
                        {booking.durationText && <span>{booking.durationText}</span>}
                        <span>{formatDate(booking.completedAt || booking.updatedAt || booking.createdAt)}</span>
                      </div>

                      <div className="actions">
                        {booking.rideId && (
                          <Link href={`/ride-details?rideId=${booking.rideId}`} className="actionButton">
                            Ride Details
                          </Link>
                        )}

                        {booking.rideId && (
                          <Link href={`/live-trip?rideId=${booking.rideId}&bookingId=${booking.id}`} className="actionButton greenButton">
                            Live Trip
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
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
        .balanceCard,
        .metric,
        .panel,
        .filters,
        .earningCard {
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
        .levelOrb strong,
        .balanceCard h2 {
          color: #22c55e;
        }

        .subtitle,
        .muted,
        .balanceCard p {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .levelOrb {
          min-width: 140px;
          height: 140px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
          text-align: center;
          padding: 18px;
        }

        .levelOrb strong {
          font-size: 18px;
        }

        .levelOrb span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
          margin-top: 5px;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .balanceCard {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .balanceCard h2 {
          font-size: 56px;
          margin: 0 0 8px;
        }

        .balanceCard button {
          border: none;
          border-radius: 999px;
          padding: 16px 22px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
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

        .analyticsGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        .info {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          margin-bottom: 10px;
        }

        .info span {
          color: #a1a1aa;
          font-weight: 900;
        }

        .info strong {
          color: #e5e7eb;
        }

        .levelBox {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          margin-bottom: 18px;
        }

        .levelBox strong {
          color: #22c55e;
          font-size: 38px;
        }

        .levelBox span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
        }

        .filters {
          border-radius: 26px;
          padding: 14px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
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

        .list {
          display: grid;
          gap: 14px;
        }

        .earningCard {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          padding: 20px;
          border-radius: 24px;
          box-shadow: none;
        }

        .earningIcon {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(34,197,94,0.14);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
        }

        .earningTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .earningTop h3 {
          margin: 0 0 5px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .earningTop p {
          color: #a1a1aa;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .earningTop strong {
          color: #22c55e;
          font-size: 24px;
          white-space: nowrap;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .meta span {
          color: #d4d4d8;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 13px;
          font-weight: 900;
          text-transform: capitalize;
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
          .stats,
          .analyticsGrid,
          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .hero,
          .balanceCard,
          .earningTop {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          h1 {
            font-size: 44px;
          }

          .earningCard {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .balanceCard,
          .panel,
          .earningCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .analyticsGrid,
          .filters {
            grid-template-columns: 1fr;
          }

          .balanceCard h2 {
            font-size: 42px;
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
