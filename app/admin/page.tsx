"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

type BasicItem = {
  id: string;
  status?: string;
  amount?: number;
  price?: number;
  seatsBooked?: number;
  priority?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
};

type AdminModule = {
  href: string;
  icon: string;
  title: string;
  text: string;
  badge?: number;
  danger?: boolean;
};

export default function AdminPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [payouts, setPayouts] = useState<BasicItem[]>([]);
  const [verifications, setVerifications] = useState<BasicItem[]>([]);
  const [reports, setReports] = useState<BasicItem[]>([]);
  const [emergencies, setEmergencies] = useState<BasicItem[]>([]);
  const [disputes, setDisputes] = useState<BasicItem[]>([]);
  const [message, setMessage] = useState("Loading admin dashboard...");

  useEffect(() => {
    const listen = (name: string, setter: (items: BasicItem[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as BasicItem[]);
          setMessage("");
        },
        (error) => setMessage(error.message)
      );

    const unsubUsers = listen("users", setUsers);
    const unsubRides = listen("rides", setRides);
    const unsubBookings = listen("bookings", setBookings);
    const unsubPayouts = listen("payoutRequests", setPayouts);
    const unsubVerifications = listen("driverVerifications", setVerifications);
    const unsubReports = listen("reports", setReports);
    const unsubEmergencies = listen("emergencyAlerts", setEmergencies);
    const unsubDisputes = listen("disputes", setDisputes);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubVerifications();
      unsubReports();
      unsubEmergencies();
      unsubDisputes();
    };
  }, []);

  const metrics = useMemo(() => {
    const activeRides = rides.filter(
      (item) =>
        item.status === "active" ||
        item.status === "open" ||
        item.status === "full" ||
        item.status === "in_progress"
    );

    const activeBookings = bookings.filter(
      (item) =>
        item.status === "pending" ||
        item.status === "reserved" ||
        item.status === "confirmed"
    );

    const completedBookings = bookings.filter((item) => item.status === "completed");

    const pendingPayouts = payouts.filter(
      (item) => item.status === "pending" || item.status === "approved"
    );

    const pendingPayoutAmount = pendingPayouts.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const pendingVerifications = verifications.filter(
      (item) => !item.status || item.status === "pending" || item.status === "reviewing"
    );

    const openReports = reports.filter((item) => !item.status || item.status === "open");

    const activeSOS = emergencies.filter((item) => item.status === "active");

    const openDisputes = disputes.filter((item) => !item.status || item.status === "open");

    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified);

    const suspendedUsers = users.filter((item) => item.suspended);

    const grossRevenue = bookings.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    return {
      activeRides,
      activeBookings,
      completedBookings,
      pendingPayouts,
      pendingPayoutAmount,
      pendingVerifications,
      openReports,
      activeSOS,
      openDisputes,
      verifiedDrivers,
      suspendedUsers,
      grossRevenue,
    };
  }, [users, rides, bookings, payouts, verifications, reports, emergencies, disputes]);

  const platformScore = useMemo(() => {
    let score = 100;

    score += metrics.grossRevenue >= 1000 ? 8 : metrics.grossRevenue >= 250 ? 4 : 0;
    score += metrics.completedBookings.length >= 10 ? 6 : metrics.completedBookings.length > 0 ? 3 : 0;
    score += metrics.verifiedDrivers.length >= 5 ? 5 : metrics.verifiedDrivers.length > 0 ? 2 : 0;

    score -= metrics.activeSOS.length * 25;
    score -= metrics.openReports.length * 5;
    score -= metrics.openDisputes.length * 5;
    score -= metrics.suspendedUsers.length * 4;
    score -= metrics.pendingVerifications.length > 10 ? 8 : 0;
    score -= metrics.pendingPayouts.length > 10 ? 6 : 0;

    return Math.max(Math.min(score, 100), 0);
  }, [metrics]);

  const modules: AdminModule[] = [
    { href: "/admin/executive", icon: "👑", title: "Executive Command", text: "Master command center for RoadLink health, growth, revenue and safety." },
    { href: "/admin/ceo-dashboard", icon: "🏛️", title: "CEO Dashboard", text: "Executive company health, KPIs and next actions." },
    { href: "/admin/investor-board", icon: "💼", title: "Investor Board", text: "Investor-ready traction, valuation and revenue metrics." },
    { href: "/admin/growth-intelligence", icon: "📈", title: "Growth Intelligence", text: "Acquisition, activation, retention and growth signals." },

    { href: "/admin/market-intelligence", icon: "🌎", title: "Market Intelligence", text: "Routes, cities, states and expansion opportunities." },
    { href: "/admin/revenue-intelligence", icon: "💰", title: "Revenue Intelligence", text: "Route revenue, driver revenue and financial leaks." },
    { href: "/admin/profitability", icon: "📊", title: "Profitability", text: "Margins, costs, profit signals and payout exposure." },
    { href: "/admin/financial-forecast", icon: "🏦", title: "Financial Forecast", text: "Monthly and yearly financial projections." },

    { href: "/admin/safety-intelligence", icon: "🛡️", title: "Safety Intelligence", text: "Safety score, reports, SOS and risk signals.", badge: metrics.activeSOS.length, danger: metrics.activeSOS.length > 0 },
    { href: "/admin/ai-risk", icon: "🤖", title: "AI Risk", text: "AI-powered risk scoring and safety warnings." },
    { href: "/admin/trust-score", icon: "⭐", title: "Trust Score", text: "Trust scoring for users, drivers and passengers." },
    { href: "/admin/emergency", icon: "🚨", title: "Emergency Center", text: "Monitor active SOS alerts and GPS location.", badge: metrics.activeSOS.length, danger: metrics.activeSOS.length > 0 },

    { href: "/admin/dispatch", icon: "📡", title: "Dispatch Center", text: "Assign drivers, monitor trips and respond to issues." },
    { href: "/admin/live-trips", icon: "🛣️", title: "Live Trips", text: "Monitor trips in real time." },
    { href: "/admin/fleet", icon: "🚘", title: "Fleet Tracking", text: "Track drivers, vehicles and live fleet activity." },
    { href: "/admin/geofence", icon: "📍", title: "Geofence Center", text: "Monitor zones, locations and geofence intelligence." },

    { href: "/admin/demand-heatmap", icon: "🔥", title: "Demand Heatmap", text: "Find high-demand routes and markets." },
    { href: "/admin/route-intelligence", icon: "🧭", title: "Route Intelligence", text: "Analyze route performance and demand." },
    { href: "/admin/driver-performance", icon: "🏆", title: "Driver Performance", text: "Rank drivers by safety, revenue and reliability." },
    { href: "/admin/passenger-intelligence", icon: "🧠", title: "Passenger Intelligence", text: "Analyze passengers, spending and trust signals." },

    { href: "/admin/live", icon: "🟢", title: "Live Center", text: "Realtime users, rides, bookings and SOS activity." },
    { href: "/admin/operations", icon: "📡", title: "Operations Center", text: "Daily operations command center." },
    { href: "/admin/activity", icon: "📶", title: "Activity Center", text: "Realtime activity timeline." },
    { href: "/admin/system-health", icon: "🩺", title: "System Health", text: "Firebase, Stripe, APIs and service status." },

    { href: "/admin/users", icon: "👥", title: "Users", text: "Manage users, drivers and account status.", badge: metrics.suspendedUsers.length, danger: metrics.suspendedUsers.length > 0 },
    { href: "/admin/user-intelligence", icon: "🧠", title: "User Intelligence", text: "User trust, revenue, reports and activity." },
    { href: "/admin/driver-risk", icon: "🚘", title: "Driver Risk", text: "Driver risk scoring and safety indicators." },
    { href: "/admin/fraud", icon: "🕵️", title: "Fraud Detection", text: "Suspicious accounts, disputes and payout risk." },

    { href: "/admin/rides", icon: "🚗", title: "Rides", text: "Monitor active, completed and cancelled rides.", badge: metrics.activeRides.length },
    { href: "/admin/bookings", icon: "🎟️", title: "Bookings", text: "Review passenger bookings and reservations.", badge: metrics.activeBookings.length },
    { href: "/admin/messages", icon: "💬", title: "Messages", text: "Platform messaging and chat activity." },
    { href: "/admin/reviews", icon: "⭐", title: "Reviews", text: "Ratings, feedback and trust reputation." },

    { href: "/admin/verification-queue", icon: "🛡️", title: "Verification Queue", text: "Approve driver documents and applications.", badge: metrics.pendingVerifications.length },
    { href: "/admin/verifications", icon: "✅", title: "Verifications", text: "Verification records and approval status." },
    { href: "/admin/payouts", icon: "🏦", title: "Payouts", text: "Approve, reject and mark payouts as paid.", badge: metrics.pendingPayouts.length },
    { href: "/admin/payments", icon: "💳", title: "Payments", text: "Payment records and transaction activity." },

    { href: "/admin/revenue", icon: "💵", title: "Revenue", text: "Revenue, fees, earnings and financial overview." },
    { href: "/admin/stripe", icon: "💎", title: "Stripe", text: "Stripe settings, payments and checkout tools." },
    { href: "/admin/reports", icon: "⚠️", title: "Reports", text: "Safety reports and platform issues.", badge: metrics.openReports.length, danger: metrics.openReports.length > 0 },
    { href: "/admin/disputes", icon: "⚖️", title: "Disputes", text: "Handle disputes between drivers and passengers.", badge: metrics.openDisputes.length, danger: metrics.openDisputes.length > 0 },

    { href: "/admin/support", icon: "🎧", title: "Support", text: "Support tickets and user help desk." },
    { href: "/admin/notifications", icon: "🔔", title: "Notifications", text: "Send announcements and user notifications." },
    { href: "/admin/analytics", icon: "📊", title: "Analytics", text: "Growth, users, bookings and platform metrics." },
    { href: "/admin/marketing", icon: "📣", title: "Marketing", text: "Campaigns, acquisition and growth tools." },

    { href: "/admin/coupons", icon: "🎁", title: "Coupons", text: "Discount codes and promotions." },
    { href: "/admin/platform-control", icon: "🎛️", title: "Platform Control", text: "Turn features on or off from one panel." },
    { href: "/admin/settings", icon: "⚙️", title: "Settings", text: "Fees, support info and security rules." },
    { href: "/admin/feature-flags", icon: "🚦", title: "Feature Flags", text: "Enable or disable experimental features." },

    { href: "/admin/ai-command", icon: "🤖", title: "AI Command", text: "AI assistant tools for admin operations." },
    { href: "/admin/map-center", icon: "🗺️", title: "Map Center", text: "Map tools and location intelligence." },
    { href: "/admin/audit-logs", icon: "🧾", title: "Audit Logs", text: "Admin actions, security events and changes." },
    { href: "/admin/launch", icon: "🚀", title: "Launch Center", text: "Readiness checklist for public launch." },
  ];

  return (
    <main className="page">
      <section className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise Admin</p>
            <h1>Command <span>Center</span></h1>
            <p className="subtitle">
              Manage RoadLink users, rides, bookings, revenue, safety, growth,
              investors, dispatch, intelligence, operations and platform controls.
            </p>
          </div>

          <div className={platformScore < 75 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{platformScore}</strong>
            <span>Admin Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🛡️" label="Drivers" value={String(metrics.verifiedDrivers.length)} />
          <Metric icon="🚘" label="Active Rides" value={String(metrics.activeRides.length)} />
          <Metric icon="🎟️" label="Active Bookings" value={String(metrics.activeBookings.length)} />
          <Metric icon="💰" label="Gross Revenue" value={`$${Math.round(metrics.grossRevenue).toLocaleString()}`} />
          <Metric icon="🏦" label="Pending Payouts" value={String(metrics.pendingPayouts.length)} />
          <Metric icon="⚠️" label="Reports" value={String(metrics.openReports.length)} danger={metrics.openReports.length > 0} />
          <Metric icon="🚨" label="Active SOS" value={String(metrics.activeSOS.length)} danger={metrics.activeSOS.length > 0} />
        </section>

        <section className="sectionTitle">
          <div>
            <p className="eyebrow">Admin Modules</p>
            <h2>Control Panels</h2>
          </div>

          <Link href="/dashboard" className="dashboardButton">
            Back to Dashboard
          </Link>
        </section>

        <section className="adminGrid">
          {modules.map((item) => (
            <AdminCard key={item.href} {...item} />
          ))}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1360px;
          margin: auto;
        }

        .hero,
        .metric,
        .adminCard {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #22c55e;
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

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          margin: 0;
          font-size: 32px;
        }

        .subtitle {
          max-width: 850px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }

        .scoreOrb {
          min-width: 104px;
          height: 104px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 10px;
        }

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 28px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 12px;
        }

        .dangerMetric .metricIcon {
          background: rgba(239,68,68,0.16);
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .sectionTitle {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
        }

        .dashboardButton {
          padding: 12px 18px;
          border-radius: 999px;
          color: white;
          text-decoration: none;
          font-weight: 900;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          white-space: nowrap;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .adminCard {
          position: relative;
          min-height: 198px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          text-decoration: none;
          overflow: hidden;
          transition: all 0.25s ease;
        }

        .adminCard:hover {
          transform: translateY(-4px);
          border-color: rgba(34,197,94,0.45);
        }

        .dangerCard {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 42%),
            rgba(8,13,25,0.92);
        }

        .adminIcon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 27px;
          margin-bottom: 16px;
        }

        .dangerCard .adminIcon {
          background: rgba(239,68,68,0.14);
          border-color: rgba(239,68,68,0.35);
        }

        .adminCard h3 {
          font-size: 20px;
          line-height: 1.1;
          margin: 0 0 10px;
        }

        .adminCard p {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
        }

        .badge {
          position: absolute;
          top: 16px;
          right: 16px;
          min-width: 26px;
          height: 26px;
          padding: 0 8px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          font-size: 12px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 18px rgba(239,68,68,0.75);
        }

        @media (max-width: 1180px) {
          .stats,
          .adminGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 42px;
          }

          .stats,
          .adminGrid {
            grid-template-columns: 1fr;
          }

          .sectionTitle {
            flex-direction: column;
            align-items: flex-start;
          }

          .dashboardButton {
            width: 100%;
            text-align: center;
          }

          .adminCard {
            min-height: 165px;
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
      <div className="metricValue">{value}</div>
    </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  text,
  badge,
  danger,
}: AdminModule) {
  return (
    <Link href={href} className={danger ? "adminCard dangerCard" : "adminCard"}>
      {badge !== undefined && badge > 0 && <span className="badge">{badge}</span>}
      <div className="adminIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </Link>
  );
      }
