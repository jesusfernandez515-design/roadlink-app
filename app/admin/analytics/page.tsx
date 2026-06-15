"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seats?: number;
  driverId?: string;
  driverEmail?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type SupportTicket = {
  id: string;
  status?: string;
  priority?: string;
  category?: string;
  createdAt?: string;
};

type DisputeItem = {
  id: string;
  status?: string;
  priority?: string;
  amount?: number;
  createdAt?: string;
};

type EmergencyAlert = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

export default function AdminAnalyticsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [message, setMessage] = useState("Loading analytics...");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubSupport = onSnapshot(
      query(collection(db, "supportTickets")),
      (snapshot) => {
        setSupportTickets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as SupportTicket[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubDisputes = onSnapshot(
      query(collection(db, "disputes")),
      (snapshot) => {
        setDisputes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as DisputeItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubEmergencies = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        setEmergencies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyAlert[]);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubSupport();
      unsubDisputes();
      unsubEmergencies();
    };
  }, []);

  function money(value: number) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function isToday(value?: string) {
    if (!value) return false;

    const date = new Date(value);
    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function isThisWeek(value?: string) {
    if (!value) return false;

    const date = new Date(value);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }

  const analytics = useMemo(() => {
    const totalUsers = users.length;
    const newUsersToday = users.filter((item) => isToday(item.createdAt)).length;
    const newUsersWeek = users.filter((item) => isThisWeek(item.createdAt)).length;
    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified).length;
    const suspendedUsers = users.filter((item) => item.suspended).length;

    const totalRides = rides.length;
    const activeRides = rides.filter((item) => item.status === "active" || item.status === "open").length;
    const completedRides = rides.filter((item) => item.status === "completed").length;

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter((item) => item.status === "confirmed").length;
    const completedBookings = bookings.filter((item) => item.status === "completed").length;
    const cancelledBookings = bookings.filter((item) => item.status === "cancelled" || item.status === "rejected").length;

    const grossBookingValue = bookings.reduce(
      (sum, item) => sum + Number(item.price || item.amount || 0),
      0
    );

    const estimatedFees = grossBookingValue * 0.12;

    const pendingPayoutAmount = payouts
      .filter((item) => item.status === "pending" || item.status === "approved")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const paidOutAmount = payouts
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const openSupport = supportTickets.filter((item) => item.status !== "resolved" && item.status !== "closed").length;
    const urgentSupport = supportTickets.filter((item) => item.priority === "urgent").length;

    const openDisputes = disputes.filter((item) => item.status !== "resolved" && item.status !== "closed").length;
    const urgentDisputes = disputes.filter((item) => item.priority === "urgent").length;

    const activeEmergencies = emergencies.filter((item) => item.status === "active").length;
    const criticalEmergencies = emergencies.filter((item) => item.priority === "critical").length;

    const conversionRate =
      totalRides > 0 ? Math.round((totalBookings / totalRides) * 100) : 0;

    return {
      totalUsers,
      newUsersToday,
      newUsersWeek,
      verifiedDrivers,
      suspendedUsers,
      totalRides,
      activeRides,
      completedRides,
      totalBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      grossBookingValue,
      estimatedFees,
      pendingPayoutAmount,
      paidOutAmount,
      openSupport,
      urgentSupport,
      openDisputes,
      urgentDisputes,
      activeEmergencies,
      criticalEmergencies,
      conversionRate,
    };
  }, [users, rides, bookings, payouts, supportTickets, disputes, emergencies]);

  const topRoutes = useMemo(() => {
    const routeMap = new Map<string, number>();

    rides.forEach((ride) => {
      const from = ride.from || "Unknown";
      const to = ride.to || "Unknown";
      const key = `${from} → ${to}`;
      routeMap.set(key, (routeMap.get(key) || 0) + 1);
    });

    return Array.from(routeMap.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rides]);

  const healthScore = useMemo(() => {
    let score = 100;

    if (analytics.activeEmergencies > 0) score -= 20;
    if (analytics.openDisputes > 0) score -= Math.min(20, analytics.openDisputes * 5);
    if (analytics.urgentSupport > 0) score -= Math.min(15, analytics.urgentSupport * 5);
    if (analytics.suspendedUsers > 0) score -= Math.min(15, analytics.suspendedUsers * 3);
    if (analytics.verifiedDrivers === 0 && analytics.totalUsers > 0) score -= 15;

    return Math.max(score, 0);
  }, [analytics]);

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Analytics <span>Dashboard</span></h1>
            <p className="subtitle">
              Monitor growth, rides, bookings, revenue, safety, payouts, and platform health.
            </p>
          </div>

          <div className="scoreOrb">
            <strong>{healthScore}</strong>
            <span>Health Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="kpiGrid">
          <Metric icon="👥" label="Total Users" value={String(analytics.totalUsers)} />
          <Metric icon="🆕" label="New Today" value={String(analytics.newUsersToday)} />
          <Metric icon="🚘" label="Total Rides" value={String(analytics.totalRides)} />
          <Metric icon="🎟️" label="Bookings" value={String(analytics.totalBookings)} />
          <Metric icon="💰" label="Gross Value" value={money(analytics.grossBookingValue)} />
          <Metric icon="🏦" label="Est. Fees" value={money(analytics.estimatedFees)} />
          <Metric icon="✅" label="Verified Drivers" value={String(analytics.verifiedDrivers)} />
          <Metric icon="🚨" label="Active SOS" value={String(analytics.activeEmergencies)} danger={analytics.activeEmergencies > 0} />
        </section>

        <section className="gridTwo">
          <div className="panel">
            <p className="eyebrow">Growth</p>
            <h2>User Growth</h2>

            <div className="miniStats">
              <Info label="Users This Week" value={String(analytics.newUsersWeek)} />
              <Info label="Suspended Users" value={String(analytics.suspendedUsers)} />
              <Info label="Driver Verification Rate" value={`${analytics.totalUsers ? Math.round((analytics.verifiedDrivers / analytics.totalUsers) * 100) : 0}%`} />
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Trips</p>
            <h2>Ride Activity</h2>

            <div className="miniStats">
              <Info label="Active Rides" value={String(analytics.activeRides)} />
              <Info label="Completed Rides" value={String(analytics.completedRides)} />
              <Info label="Booking / Ride Ratio" value={`${analytics.conversionRate}%`} />
            </div>
          </div>
        </section>

        <section className="gridTwo">
          <div className="panel">
            <p className="eyebrow">Bookings</p>
            <h2>Booking Status</h2>

            <div className="statusList">
              <StatusRow label="Confirmed" value={analytics.confirmedBookings} />
              <StatusRow label="Completed" value={analytics.completedBookings} />
              <StatusRow label="Cancelled" value={analytics.cancelledBookings} danger={analytics.cancelledBookings > 0} />
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Money</p>
            <h2>Payouts</h2>

            <div className="miniStats">
              <Info label="Pending Payouts" value={money(analytics.pendingPayoutAmount)} />
              <Info label="Paid Out" value={money(analytics.paidOutAmount)} />
              <Info label="Estimated Platform Fees" value={money(analytics.estimatedFees)} />
            </div>
          </div>
        </section>

        <section className="gridTwo">
          <div className="panel dangerPanel">
            <p className="eyebrow">Safety</p>
            <h2>Risk Center</h2>

            <div className="miniStats">
              <Info label="Active SOS Alerts" value={String(analytics.activeEmergencies)} />
              <Info label="Critical SOS Alerts" value={String(analytics.criticalEmergencies)} />
              <Info label="Open Disputes" value={String(analytics.openDisputes)} />
              <Info label="Urgent Support" value={String(analytics.urgentSupport)} />
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Routes</p>
            <h2>Top Routes</h2>

            {topRoutes.length === 0 ? (
              <div className="empty">
                <h3>No routes yet</h3>
                <p>Popular routes will appear when drivers publish rides.</p>
              </div>
            ) : (
              <div className="routeList">
                {topRoutes.map((route) => (
                  <div className="routeRow" key={route.route}>
                    <span>{route.route}</span>
                    <strong>{route.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        html,
        body {
          overflow-x: hidden;
        }

        .page {
          width: 100%;
          min-height: 100vh;
          color: white;
          padding: 14px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 32%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 36%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          width: 100%;
          max-width: 1180px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .miniButton {
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
        }

        .dangerLink {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .hero,
        .metric,
        .panel {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 16px 44px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 26px;
          padding: 22px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #22c55e;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 42px;
          line-height: 0.98;
          margin: 0 0 10px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 14px;
          line-height: 1.45;
          margin: 0;
        }

        .scoreOrb {
          min-width: 96px;
          height: 96px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 30px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 18px;
          padding: 13px;
          min-height: 92px;
        }

        .metricIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          margin-bottom: 8px;
        }

        .dangerMetric .metricIcon {
          background: rgba(239,68,68,0.16);
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .metricValue {
          display: block;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .gridTwo {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .panel {
          border-radius: 22px;
          padding: 18px;
          overflow: hidden;
        }

        .dangerPanel {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 40%),
            rgba(8,13,25,0.92);
        }

        .panel h2 {
          font-size: 24px;
          margin: 0 0 14px;
        }

        .miniStats {
          display: grid;
          gap: 9px;
        }

        .infoBox {
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .infoBox strong {
          display: block;
          color: white;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .statusList,
        .routeList {
          display: grid;
          gap: 10px;
        }

        .statusRow,
        .routeRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .statusRow span,
        .routeRow span {
          color: #d4d4d8;
          font-size: 13px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .statusRow strong,
        .routeRow strong {
          color: #22c55e;
          font-size: 18px;
          font-weight: 900;
        }

        .dangerStatus strong {
          color: #ef4444;
        }

        .empty {
          padding: 18px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }

        .empty p {
          color: #a1a1aa;
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .hero {
            align-items: flex-start;
          }

          h1 {
            font-size: 34px;
          }

          .scoreOrb {
            min-width: 78px;
            height: 78px;
          }

          .kpiGrid,
          .gridTwo {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .page {
            padding: 12px;
            padding-bottom: 150px;
          }

          .hero {
            border-radius: 22px;
            padding: 18px;
            display: grid;
            grid-template-columns: 1fr auto;
          }

          .scoreOrb {
            min-width: 66px;
            width: 66px;
            height: 66px;
          }

          .scoreOrb strong {
            font-size: 22px;
          }

          .scoreOrb span {
            font-size: 8px;
          }

          h1 {
            font-size: 30px;
          }

          .subtitle {
            font-size: 13px;
          }

          .kpiGrid,
          .gridTwo {
            grid-template-columns: 1fr;
          }

          .metric {
            min-height: 72px;
            display: grid;
            grid-template-columns: 38px 1fr auto;
            align-items: center;
            gap: 10px;
          }

          .metricIcon {
            margin-bottom: 0;
          }

          .metricValue {
            font-size: 20px;
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
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <strong className="metricValue">{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}

function StatusRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "statusRow dangerStatus" : "statusRow"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
