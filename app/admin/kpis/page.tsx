"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
  driverVerified?: boolean;
  verified?: boolean;
  createdAt?: any;
};

type Booking = {
  id: string;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
  durationMinutes?: number;
  createdAt?: any;
  completedAt?: any;
};

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  seats?: number;
  originalSeats?: number;
  distanceMiles?: number;
  durationMinutes?: number;
  createdAt?: any;
};

type Rating = {
  id: string;
  driverId?: string;
  rating?: number;
  stars?: number;
};

type EmergencyAlert = {
  id: string;
  status?: string;
  priority?: string;
};

export default function AdminKPIsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [period, setPeriod] = useState("all");
  const [message, setMessage] = useState("Loading KPI center...");

  useEffect(() => {
    let unsubscribeMe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeMe = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const allowed =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          setMessage(allowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMe) unsubscribeMe();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  useEffect(() => {
    if (!adminAllowed) return;

    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserProfile[]);
      setMessage("");
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Booking[]);
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Ride[]);
    });

    const unsubRatings = onSnapshot(query(collection(db, "ratings")), (snapshot) => {
      setRatings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Rating[]);
    });

    const unsubAlerts = onSnapshot(query(collection(db, "emergencyAlerts")), (snapshot) => {
      setAlerts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyAlert[]);
    });

    return () => {
      unsubUsers();
      unsubBookings();
      unsubRides();
      unsubRatings();
      unsubAlerts();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function percent(value: number) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function getDate(value?: any) {
    if (!value) return new Date(0);
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function inPeriod(value?: any) {
    if (period === "all") return true;

    const date = getDate(value);
    const now = new Date();

    if (period === "today") {
      return date.toDateString() === now.toDateString();
    }

    if (period === "week") {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      return date >= start && date <= now;
    }

    if (period === "month") {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }

    if (period === "year") {
      return date.getFullYear() === now.getFullYear();
    }

    return true;
  }

  const kpis = useMemo(() => {
    const periodUsers = users.filter((item) => inPeriod(item.createdAt));
    const periodBookings = bookings.filter((item) => inPeriod(item.completedAt || item.createdAt));
    const periodRides = rides.filter((item) => inPeriod(item.createdAt));

    const completedBookings = periodBookings.filter((item) => clean(item.status) === "completed");
    const cancelledBookings = periodBookings.filter((item) =>
      ["cancelled", "rejected"].includes(clean(item.status))
    );

    const activeBookings = periodBookings.filter((item) =>
      ["pending", "reserved", "confirmed"].includes(clean(item.status))
    );

    const grossRevenue = completedBookings.reduce(
      (total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const roadLinkRevenue = grossRevenue * 0.12;
    const driverEarnings = grossRevenue * 0.88;

    const totalSeatsBooked = completedBookings.reduce(
      (total, item) => total + Number(item.seatsBooked || 1),
      0
    );

    const totalDistance = completedBookings.reduce(
      (total, item) => total + Number(item.distanceMiles || 0),
      0
    );

    const totalMinutes = completedBookings.reduce(
      (total, item) => total + Number(item.durationMinutes || 0),
      0
    );

    const totalRideSeats = periodRides.reduce(
      (total, item) => total + Number(item.originalSeats || item.seats || 0),
      0
    );

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((total, item) => total + Number(item.stars || item.rating || 0), 0) /
          ratings.length
        : 0;

    const drivers = users.filter(
      (item) => item.role === "driver" || item.driverVerified || item.verified
    );

    const passengers = users.filter((item) => item.role !== "driver");

    const conversionRate =
      periodRides.length > 0 ? (completedBookings.length / periodRides.length) * 100 : 0;

    const cancellationRate =
      periodBookings.length > 0 ? (cancelledBookings.length / periodBookings.length) * 100 : 0;

    const occupancyRate =
      totalRideSeats > 0 ? (totalSeatsBooked / totalRideSeats) * 100 : 0;

    const paymentSuccessRate =
      periodBookings.length > 0 ? (completedBookings.length / periodBookings.length) * 100 : 0;

    const activeSOS = alerts.filter((item) => clean(item.status) === "active").length;
    const criticalSOS = alerts.filter((item) =>
      ["critical", "life_threatening"].includes(clean(item.priority))
    ).length;

    const safetyScore = Math.max(0, Math.min(100, 100 - activeSOS * 8 - criticalSOS * 15));

    const growthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          periodUsers.length * 2 +
            completedBookings.length * 3 +
            roadLinkRevenue * 0.08 +
            averageRating * 8 -
            cancellationRate
        )
      )
    );

    const driverLeaderboard = Object.entries(
      completedBookings.reduce<Record<string, { trips: number; revenue: number }>>((acc, item) => {
        const email = item.driverEmail || item.driverId || "RoadLink Driver";
        if (!acc[email]) acc[email] = { trips: 0, revenue: 0 };
        acc[email].trips += 1;
        acc[email].revenue += Number(item.price || 0) * Number(item.seatsBooked || 1);
        return acc;
      }, {})
    )
      .map(([email, data]) => ({ email, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const cityLeaderboard = Object.entries(
      periodRides.reduce<Record<string, number>>((acc, item) => {
        const city = String(item.from || "Unknown").split(",")[0] || "Unknown";
        acc[city] = (acc[city] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalUsers: users.length,
      newUsers: periodUsers.length,
      drivers: drivers.length,
      passengers: passengers.length,
      totalRides: periodRides.length,
      completedTrips: completedBookings.length,
      activeBookings: activeBookings.length,
      cancelledTrips: cancelledBookings.length,
      grossRevenue,
      roadLinkRevenue,
      driverEarnings,
      averageRating,
      averageTripDistance: completedBookings.length ? totalDistance / completedBookings.length : 0,
      averageTripDuration: completedBookings.length ? totalMinutes / completedBookings.length : 0,
      averageBookingValue: completedBookings.length ? grossRevenue / completedBookings.length : 0,
      occupancyRate,
      conversionRate,
      cancellationRate,
      paymentSuccessRate,
      safetyScore,
      growthScore,
      activeSOS,
      criticalSOS,
      driverLeaderboard,
      cityLeaderboard,
    };
  }, [users, bookings, rides, ratings, alerts, period]);

  const maxDriverRevenue = Math.max(...kpis.driverLeaderboard.map((item) => item.revenue), 1);
  const maxCityCount = Math.max(...kpis.cityLeaderboard.map((item) => item.count), 1);

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>KPI <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/analytics" className="navButton">Analytics</Link>
          <Link href="/admin/revenue" className="navButton">Revenue</Link>
          <Link href="/admin/finance" className="navButton">Finance</Link>
          <Link href="/admin/system-health" className="navButton">System Health</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Executive Intelligence</p>
            <h1>KPI <span>Center</span></h1>
            <p className="subtitle">
              Executive dashboard for growth, revenue, users, bookings, conversion, cancellation,
              occupancy, safety and marketplace performance.
            </p>
          </div>

          <div className={kpis.growthScore >= 70 ? "kpiOrb" : "kpiOrb warningOrb"}>
            <strong>{kpis.growthScore}</strong>
            <span>Growth Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="controls">
          <div>
            <p className="eyebrow">Executive Filter</p>
            <h2>Period</h2>
          </div>

          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>

          <div className="exportBox">
            <strong>Export Ready</strong>
            <span>CSV / Excel / PDF prepared</span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="👥" label="Total Users" value={String(kpis.totalUsers)} />
          <Metric icon="🆕" label="New Users" value={String(kpis.newUsers)} />
          <Metric icon="🚗" label="Drivers" value={String(kpis.drivers)} />
          <Metric icon="🧍" label="Passengers" value={String(kpis.passengers)} />
          <Metric icon="🛣️" label="Total Rides" value={String(kpis.totalRides)} />
          <Metric icon="✅" label="Completed Trips" value={String(kpis.completedTrips)} />
          <Metric icon="📌" label="Active Bookings" value={String(kpis.activeBookings)} />
          <Metric icon="❌" label="Cancelled Trips" value={String(kpis.cancelledTrips)} />
          <Metric icon="💰" label="Gross Revenue" value={money(kpis.grossRevenue)} />
          <Metric icon="🏛️" label="RoadLink Revenue" value={money(kpis.roadLinkRevenue)} />
          <Metric icon="🚙" label="Driver Earnings" value={money(kpis.driverEarnings)} />
          <Metric icon="🎟️" label="Avg Booking" value={money(kpis.averageBookingValue)} />
          <Metric icon="⭐" label="Avg Rating" value={kpis.averageRating ? kpis.averageRating.toFixed(1) : "New"} />
          <Metric icon="🛣️" label="Avg Distance" value={`${kpis.averageTripDistance.toFixed(1)} mi`} />
          <Metric icon="⏱️" label="Avg Duration" value={`${kpis.averageTripDuration.toFixed(1)} min`} />
          <Metric icon="💺" label="Occupancy" value={percent(kpis.occupancyRate)} />
          <Metric icon="📊" label="Conversion" value={percent(kpis.conversionRate)} />
          <Metric icon="🚨" label="Cancel Rate" value={percent(kpis.cancellationRate)} />
          <Metric icon="💳" label="Payment Success" value={percent(kpis.paymentSuccessRate)} />
          <Metric icon="🛡️" label="Safety Score" value={`${kpis.safetyScore}/100`} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Marketplace Health</p>
            <h2>Performance Ratios</h2>

            <Bar label="Occupancy Rate" value={kpis.occupancyRate} max={100} suffix="%" />
            <Bar label="Booking Conversion" value={kpis.conversionRate} max={100} suffix="%" />
            <Bar label="Payment Success" value={kpis.paymentSuccessRate} max={100} suffix="%" />
            <Bar label="Safety Score" value={kpis.safetyScore} max={100} suffix="/100" />
            <Bar label="Growth Score" value={kpis.growthScore} max={100} suffix="/100" />
          </section>

          <section className="panel">
            <p className="eyebrow">Risk Signals</p>
            <h2>Operational Risk</h2>

            <Info label="Cancellation Rate" value={percent(kpis.cancellationRate)} />
            <Info label="Active SOS" value={String(kpis.activeSOS)} />
            <Info label="Critical SOS" value={String(kpis.criticalSOS)} />
            <Info label="Safety Score" value={`${kpis.safetyScore}/100`} />
            <Info label="Growth Score" value={`${kpis.growthScore}/100`} />
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Top Drivers</p>
            <h2>Revenue Leaders</h2>

            {kpis.driverLeaderboard.length === 0 ? (
              <Empty text="No completed driver revenue yet." />
            ) : (
              kpis.driverLeaderboard.map((driver) => (
                <Bar
                  key={driver.email}
                  label={`${driver.email} · ${driver.trips} trips`}
                  value={driver.revenue}
                  max={maxDriverRevenue}
                  money
                />
              ))
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Top Cities</p>
            <h2>Marketplace Demand</h2>

            {kpis.cityLeaderboard.length === 0 ? (
              <Empty text="No city activity yet." />
            ) : (
              kpis.cityLeaderboard.map((city) => (
                <Bar
                  key={city.city}
                  label={city.city}
                  value={city.count}
                  max={maxCityCount}
                />
              ))
            )}
          </section>
        </section>
      </section>

      <Styles />
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

function Bar({
  label,
  value,
  max,
  suffix,
  money: isMoney,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  money?: boolean;
}) {
  const width = Math.max(4, Math.min(100, Math.round((value / max) * 100)));

  return (
    <div className="barRow">
      <div className="barTop">
        <span>{label}</span>
        <strong>
          {isMoney ? `$${Number(value || 0).toFixed(2)}` : `${Number(value || 0).toFixed(1)}${suffix || ""}`}
        </strong>
      </div>

      <div className="bar">
        <div style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <h3>No data</h3>
      <p>{text}</p>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 130px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 35%),
          radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1240px;
        margin: auto;
      }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .hero,
      .metric,
      .panel,
      .controls,
      .locked {
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

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
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
      .kpiOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .empty p,
      .locked p {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .kpiOrb {
        min-width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .warningOrb {
        background: rgba(234,179,8,0.13);
        border-color: rgba(234,179,8,0.35);
      }

      .warningOrb strong {
        color: #fde68a;
      }

      .kpiOrb strong {
        font-size: 42px;
      }

      .kpiOrb span {
        color: #d4d4d8;
        font-weight: 900;
        font-size: 12px;
      }

      .message {
        color: #22c55e;
        text-align: center;
        font-weight: 900;
      }

      .controls {
        border-radius: 30px;
        padding: 22px;
        margin-bottom: 20px;
        display: grid;
        grid-template-columns: 1fr 220px auto;
        gap: 14px;
        align-items: center;
      }

      select {
        width: 100%;
        padding: 15px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
      }

      option {
        color: black;
      }

      .exportBox {
        padding: 13px 16px;
        border-radius: 18px;
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
      }

      .exportBox strong {
        display: block;
        color: #22c55e;
      }

      .exportBox span {
        color: #a1a1aa;
        font-size: 12px;
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

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
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

      .info span,
      .barTop span {
        color: #a1a1aa;
        font-weight: 900;
        overflow-wrap: anywhere;
      }

      .info strong,
      .barTop strong {
        color: #e5e7eb;
        white-space: nowrap;
      }

      .barRow {
        margin-bottom: 18px;
      }

      .barTop {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .bar {
        height: 13px;
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        overflow: hidden;
      }

      .bar div {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }

      .empty {
        min-height: 180px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-radius: 20px;
        padding: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .empty h3 {
        margin: 0 0 8px;
      }

      @media (max-width: 1050px) {
        .hero,
        .controls,
        .grid {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats {
          grid-template-columns: repeat(2, 1fr);
        }

        h1 {
          font-size: 44px;
        }
      }

      @media (max-width: 650px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel,
        .controls {
          padding: 22px;
          border-radius: 26px;
        }

        .stats {
          grid-template-columns: 1fr;
        }

        .info,
        .barTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .info strong,
        .barTop strong {
          white-space: normal;
        }
      }
    `}</style>
  );
      }
