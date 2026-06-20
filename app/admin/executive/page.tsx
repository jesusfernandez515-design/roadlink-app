"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ExecutiveStatus = "national_ready" | "regional_ready" | "beta_ready" | "not_ready";

type BasicItem = {
  id: string;
  status?: string;
  amount?: number;
  price?: number;
  seatsBooked?: number;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  priority?: string;
  createdAt?: string;
};

type ExecutiveAlert = {
  id: string;
  icon: string;
  title: string;
  value: string;
  href: string;
  danger?: boolean;
};

export default function AdminExecutiveCommandPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [payouts, setPayouts] = useState<BasicItem[]>([]);
  const [reports, setReports] = useState<BasicItem[]>([]);
  const [alerts, setAlerts] = useState<BasicItem[]>([]);
  const [verifications, setVerifications] = useState<BasicItem[]>([]);
  const [disputes, setDisputes] = useState<BasicItem[]>([]);
  const [message, setMessage] = useState("Loading executive command center...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => setter([])
      );

    const unsubUsers = listen<BasicItem>("users", setUsers);
    const unsubRides = listen<BasicItem>("rides", setRides);
    const unsubBookings = listen<BasicItem>("bookings", setBookings);
    const unsubPayouts = listen<BasicItem>("payoutRequests", setPayouts);
    const unsubReports = listen<BasicItem>("reports", setReports);
    const unsubAlerts = listen<BasicItem>("emergencyAlerts", setAlerts);
    const unsubVerifications = listen<BasicItem>("driverVerifications", setVerifications);
    const unsubDisputes = listen<BasicItem>("disputes", setDisputes);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubReports();
      unsubAlerts();
      unsubVerifications();
      unsubDisputes();
    };
  }, []);

  const executive = useMemo(() => {
    const activeRides = rides.filter(
      (item) =>
        item.status === "active" ||
        item.status === "open" ||
        item.status === "full" ||
        item.status === "in_progress"
    );

    const completedRides = rides.filter((item) => item.status === "completed");

    const activeBookings = bookings.filter(
      (item) =>
        item.status === "pending" ||
        item.status === "reserved" ||
        item.status === "confirmed"
    );

    const completedBookings = bookings.filter((item) => item.status === "completed");

    const cancelledBookings = bookings.filter(
      (item) =>
        item.status === "cancelled" ||
        item.status === "rejected" ||
        item.status === "no_show"
    );

    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified);
    const suspendedUsers = users.filter((item) => item.suspended);

    const pendingPayouts = payouts.filter(
      (item) => item.status === "pending" || item.status === "approved"
    );

    const pendingVerifications = verifications.filter(
      (item) => !item.status || item.status === "pending" || item.status === "reviewing"
    );

    const openReports = reports.filter((item) => !item.status || item.status === "open");

    const urgentReports = reports.filter(
      (item) => item.priority === "urgent" || item.priority === "critical"
    );

    const activeSOS = alerts.filter((item) => item.status === "active");

    const openDisputes = disputes.filter((item) => !item.status || item.status === "open");

    const grossRevenue = bookings.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    const platformRevenue = grossRevenue * 0.12;
    const processingFees = grossRevenue * 0.03;
    const netEstimate = platformRevenue - processingFees;

    const payoutExposure = pendingPayouts.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const monthlyRevenue = grossRevenue;
    const annualRunRate = grossRevenue * 12;
    const platformARR = platformRevenue * 12;

    const conversionRate =
      users.length > 0 ? Math.round((bookings.length / users.length) * 100) : 0;

    const completionRate =
      bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;

    const cancellationRate =
      bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;

    let executiveScore = 100;

    executiveScore += grossRevenue >= 1000 ? 12 : grossRevenue >= 250 ? 7 : grossRevenue > 0 ? 3 : 0;
    executiveScore += users.length >= 100 ? 10 : users.length >= 25 ? 6 : users.length >= 5 ? 3 : 0;
    executiveScore += verifiedDrivers.length >= 20 ? 8 : verifiedDrivers.length >= 5 ? 5 : verifiedDrivers.length > 0 ? 2 : 0;
    executiveScore += completedBookings.length >= 50 ? 10 : completedBookings.length >= 10 ? 6 : completedBookings.length > 0 ? 3 : 0;

    executiveScore -= activeSOS.length * 25;
    executiveScore -= urgentReports.length * 12;
    executiveScore -= openReports.length * 5;
    executiveScore -= openDisputes.length * 5;
    executiveScore -= suspendedUsers.length * 4;
    executiveScore -= pendingVerifications.length > 10 ? 8 : 0;
    executiveScore -= cancellationRate >= 35 ? 10 : cancellationRate >= 20 ? 5 : 0;
    executiveScore -= payoutExposure > grossRevenue && grossRevenue > 0 ? 10 : 0;

    executiveScore = Math.max(Math.min(executiveScore, 100), 0);

    const launchStatus: ExecutiveStatus =
      executiveScore >= 88 && users.length >= 100 && verifiedDrivers.length >= 20
        ? "national_ready"
        : executiveScore >= 75 && users.length >= 25 && verifiedDrivers.length >= 5
        ? "regional_ready"
        : executiveScore >= 55 && users.length >= 5 && verifiedDrivers.length >= 1
        ? "beta_ready"
        : "not_ready";

    const smartAlerts: ExecutiveAlert[] = [
      {
        id: "sos",
        icon: "🚨",
        title: "Active SOS Alerts",
        value: String(activeSOS.length),
        href: "/admin/emergency",
        danger: activeSOS.length > 0,
      },
      {
        id: "reports",
        icon: "⚠️",
        title: "Open Reports",
        value: String(openReports.length),
        href: "/admin/reports",
        danger: openReports.length > 0,
      },
      {
        id: "disputes",
        icon: "⚖️",
        title: "Open Disputes",
        value: String(openDisputes.length),
        href: "/admin/disputes",
        danger: openDisputes.length > 0,
      },
      {
        id: "payouts",
        icon: "🏦",
        title: "Pending Payouts",
        value: String(pendingPayouts.length),
        href: "/admin/payouts",
        danger: pendingPayouts.length > 0,
      },
      {
        id: "verifications",
        icon: "🛡️",
        title: "Pending Verifications",
        value: String(pendingVerifications.length),
        href: "/admin/verification-queue",
        danger: pendingVerifications.length > 0,
      },
      {
        id: "suspended",
        icon: "⛔",
        title: "Suspended Users",
        value: String(suspendedUsers.length),
        href: "/admin/users",
        danger: suspendedUsers.length > 0,
      },
    ];

    return {
      activeRides,
      completedRides,
      activeBookings,
      completedBookings,
      cancelledBookings,
      verifiedDrivers,
      suspendedUsers,
      pendingPayouts,
      pendingVerifications,
      openReports,
      urgentReports,
      activeSOS,
      openDisputes,
      grossRevenue,
      platformRevenue,
      processingFees,
      netEstimate,
      payoutExposure,
      monthlyRevenue,
      annualRunRate,
      platformARR,
      conversionRate,
      completionRate,
      cancellationRate,
      executiveScore,
      launchStatus,
      smartAlerts,
    };
  }, [users, rides, bookings, payouts, reports, alerts, verifications, disputes]);

  async function saveExecutiveSnapshot() {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "executiveCommandSnapshots", `executive-${Date.now()}`),
        {
          executiveScore: executive.executiveScore,
          launchStatus: executive.launchStatus,
          users: users.length,
          rides: rides.length,
          bookings: bookings.length,
          verifiedDrivers: executive.verifiedDrivers.length,
          grossRevenue: executive.grossRevenue,
          platformRevenue: executive.platformRevenue,
          netEstimate: executive.netEstimate,
          annualRunRate: executive.annualRunRate,
          platformARR: executive.platformARR,
          activeSOS: executive.activeSOS.length,
          openReports: executive.openReports.length,
          pendingPayouts: executive.pendingPayouts.length,
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `executive-command-${Date.now()}`),
        {
          action: "Executive Command Snapshot Saved",
          targetId: "executive-command-center",
          targetType: "executiveSnapshot",
          details: `Executive score: ${executive.executiveScore}/100`,
          severity: executive.executiveScore < 55 ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Executive snapshot saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save executive snapshot.");
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function launchLabel(value: ExecutiveStatus) {
    if (value === "national_ready") return "National Ready";
    if (value === "regional_ready") return "Regional Ready";
    if (value === "beta_ready") return "Beta Ready";
    return "Not Ready";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/ceo-dashboard" className="miniButton">CEO</Link>
          <Link href="/admin/investor-board" className="miniButton">Investor</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue</Link>
          <Link href="/admin/safety-intelligence" className="miniButton dangerLink">Safety</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise Command</p>
            <h1>Executive <span>Command</span></h1>
            <p className="subtitle">
              The master dashboard for RoadLink company health, growth, revenue,
              safety, investor readiness, launch readiness and executive alerts.
            </p>
          </div>

          <div className={executive.executiveScore < 70 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{executive.executiveScore}</strong>
            <span>{launchLabel(executive.launchStatus)}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🚘" label="Drivers" value={String(executive.verifiedDrivers.length)} />
          <Metric icon="🛣️" label="Active Trips" value={String(executive.activeRides.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="✅" label="Completed" value={String(executive.completedBookings.length)} />
          <Metric icon="💰" label="GMV" value={money(executive.grossRevenue)} />
          <Metric icon="🏦" label="Platform ARR" value={money(executive.platformARR)} />
          <Metric icon="🚨" label="SOS" value={String(executive.activeSOS.length)} danger={executive.activeSOS.length > 0} />
        </section>

        <section className="commandGrid">
          <section className="panel">
            <p className="eyebrow">Executive Intelligence</p>
            <h2>Company Overview</h2>

            <div className="infoGrid">
              <Info label="Executive Score" value={`${executive.executiveScore}/100`} />
              <Info label="Launch Readiness" value={launchLabel(executive.launchStatus)} />
              <Info label="Gross Marketplace Volume" value={money(executive.grossRevenue)} />
              <Info label="Platform Revenue" value={money(executive.platformRevenue)} />
              <Info label="Net Estimate" value={money(executive.netEstimate)} />
              <Info label="Monthly Revenue" value={money(executive.monthlyRevenue)} />
              <Info label="Annual Run Rate" value={money(executive.annualRunRate)} />
              <Info label="Platform ARR" value={money(executive.platformARR)} />
              <Info label="Conversion Rate" value={`${executive.conversionRate}%`} />
              <Info label="Completion Rate" value={`${executive.completionRate}%`} />
              <Info label="Cancellation Rate" value={`${executive.cancellationRate}%`} />
              <Info label="Payout Exposure" value={money(executive.payoutExposure)} />
            </div>

            <button className="saveButton" onClick={saveExecutiveSnapshot} disabled={saving}>
              {saving ? "Saving..." : "Save Executive Snapshot"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Executive Alerts</p>
            <h2>Priority Signals</h2>

            <div className="alertList">
              {executive.smartAlerts.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={item.danger ? "alertCard dangerCard" : "alertCard"}
                >
                  <div className="alertIcon">{item.icon}</div>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.value}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Executive Quick Actions</p>
          <h2>Open Control Centers</h2>

          <div className="quickLinks">
            <Link href="/admin/ceo-dashboard">👑 CEO Dashboard</Link>
            <Link href="/admin/investor-board">💼 Investor Board</Link>
            <Link href="/admin/revenue-intelligence">💰 Revenue Intelligence</Link>
            <Link href="/admin/profitability">📈 Profitability</Link>
            <Link href="/admin/financial-forecast">🏦 Financial Forecast</Link>
            <Link href="/admin/safety-intelligence">🛡️ Safety Intelligence</Link>
            <Link href="/admin/demand-heatmap">🔥 Demand Heatmap</Link>
            <Link href="/admin/ai-risk">🤖 AI Risk</Link>
            <Link href="/admin/driver-performance">🚘 Driver Performance</Link>
            <Link href="/admin/passenger-intelligence">🧠 Passenger Intelligence</Link>
            <Link href="/admin/dispatch">📡 Dispatch</Link>
            <Link href="/admin/emergency">🚨 Emergency</Link>
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(250,204,21,0.18), transparent 32%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1280px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .dangerLink {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .hero,
        .metric,
        .panel,
        .quickCard {
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
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle {
          max-width: 820px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }

        .scoreOrb {
          min-width: 112px;
          height: 112px;
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
          font-size: 34px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          line-height: 1.2;
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
          margin-bottom: 24px;
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

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          display: block;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .commandGrid {
          display: grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .panel,
        .quickCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .infoBox,
        .alertCard {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          display: block;
          overflow-wrap: anywhere;
        }

        .saveButton {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .alertList {
          display: grid;
          gap: 12px;
        }

        .alertCard {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          align-items: center;
          color: white;
          text-decoration: none;
        }

        .dangerCard {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .alertIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .dangerCard .alertIcon {
          background: rgba(239,68,68,0.16);
        }

        .alertCard strong,
        .alertCard span {
          display: block;
        }

        .alertCard span {
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
          margin-top: 4px;
        }

        .dangerCard span {
          color: #ef4444;
        }

        .quickLinks {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .quickLinks a {
          padding: 15px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1100px) {
          .stats,
          .quickLinks {
            grid-template-columns: repeat(2, 1fr);
          }

          .commandGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
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
            font-size: 44px;
          }

          .stats,
          .infoGrid,
          .quickLinks {
            grid-template-columns: 1fr;
          }

          .panel,
          .quickCard {
            padding: 24px;
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
