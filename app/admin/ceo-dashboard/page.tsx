"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Status = "excellent" | "healthy" | "watch" | "critical";

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

type ExecutiveSignal = {
  id: string;
  title: string;
  value: string;
  status: Status;
  insight: string;
};

export default function AdminCEODashboardPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [payouts, setPayouts] = useState<BasicItem[]>([]);
  const [reports, setReports] = useState<BasicItem[]>([]);
  const [alerts, setAlerts] = useState<BasicItem[]>([]);
  const [verifications, setVerifications] = useState<BasicItem[]>([]);
  const [message, setMessage] = useState("Loading CEO dashboard...");
  const [loading, setLoading] = useState(false);

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

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubReports();
      unsubAlerts();
      unsubVerifications();
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

    const completedBookings = bookings.filter((item) => item.status === "completed");

    const cancelledBookings = bookings.filter(
      (item) =>
        item.status === "cancelled" ||
        item.status === "rejected" ||
        item.status === "no_show"
    );

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

    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified);

    const suspendedUsers = users.filter((item) => item.suspended);

    const grossRevenue = bookings.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    const platformFees = grossRevenue * 0.12;

    const payoutExposure = pendingPayouts.reduce(
      (total, payout) => total + Number(payout.amount || 0),
      0
    );

    const netEstimate = platformFees - grossRevenue * 0.03;

    let companyScore = 100;

    companyScore += completedBookings.length > 0 ? 5 : 0;
    companyScore += grossRevenue >= 500 ? 10 : grossRevenue >= 100 ? 5 : 0;
    companyScore += verifiedDrivers.length >= 5 ? 8 : verifiedDrivers.length >= 1 ? 4 : 0;

    companyScore -= activeSOS.length * 25;
    companyScore -= urgentReports.length * 12;
    companyScore -= openReports.length * 5;
    companyScore -= cancelledBookings.length * 4;
    companyScore -= suspendedUsers.length * 5;
    companyScore -= pendingVerifications.length > 10 ? 8 : 0;
    companyScore -= payoutExposure > grossRevenue && grossRevenue > 0 ? 12 : 0;

    companyScore = Math.max(Math.min(companyScore, 100), 0);

    const companyStatus: Status =
      companyScore >= 85
        ? "excellent"
        : companyScore >= 70
        ? "healthy"
        : companyScore >= 45
        ? "watch"
        : "critical";

    const signals: ExecutiveSignal[] = [
      {
        id: "company-score",
        title: "Company Health",
        value: `${companyScore}/100`,
        status: companyStatus,
        insight:
          companyStatus === "excellent"
            ? "RoadLink is showing strong executive health."
            : companyStatus === "healthy"
            ? "RoadLink is stable with manageable operational signals."
            : companyStatus === "watch"
            ? "RoadLink needs closer monitoring before scaling aggressively."
            : "RoadLink has critical signals that require immediate review.",
      },
      {
        id: "revenue",
        title: "Gross Revenue",
        value: money(grossRevenue),
        status: grossRevenue >= 500 ? "excellent" : grossRevenue >= 100 ? "healthy" : "watch",
        insight: "Revenue is calculated from booking price, amount and seats booked.",
      },
      {
        id: "profit",
        title: "Net Estimate",
        value: money(netEstimate),
        status: netEstimate > 100 ? "excellent" : netEstimate > 0 ? "healthy" : "watch",
        insight: "Net estimate uses platform fees minus estimated processing fees.",
      },
      {
        id: "safety",
        title: "Safety Load",
        value: String(activeSOS.length + urgentReports.length),
        status:
          activeSOS.length > 0
            ? "critical"
            : urgentReports.length > 0
            ? "watch"
            : "excellent",
        insight: "Safety load combines active SOS alerts and urgent reports.",
      },
      {
        id: "drivers",
        title: "Verified Drivers",
        value: String(verifiedDrivers.length),
        status: verifiedDrivers.length >= 10 ? "excellent" : verifiedDrivers.length >= 3 ? "healthy" : "watch",
        insight: "Driver supply determines how fast RoadLink can scale.",
      },
      {
        id: "bookings",
        title: "Completed Bookings",
        value: String(completedBookings.length),
        status: completedBookings.length >= 25 ? "excellent" : completedBookings.length >= 5 ? "healthy" : "watch",
        insight: "Completed bookings are the strongest product-market signal.",
      },
    ];

    return {
      activeRides,
      completedBookings,
      cancelledBookings,
      pendingPayouts,
      pendingVerifications,
      openReports,
      urgentReports,
      activeSOS,
      verifiedDrivers,
      suspendedUsers,
      grossRevenue,
      platformFees,
      payoutExposure,
      netEstimate,
      companyScore,
      companyStatus,
      signals,
    };
  }, [users, rides, bookings, payouts, reports, alerts, verifications]);

  async function saveExecutiveSnapshot() {
    try {
      setLoading(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "executiveSnapshots", `ceo-dashboard-${Date.now()}`),
        {
          companyScore: executive.companyScore,
          companyStatus: executive.companyStatus,
          grossRevenue: executive.grossRevenue,
          platformFees: executive.platformFees,
          payoutExposure: executive.payoutExposure,
          netEstimate: executive.netEstimate,
          users: users.length,
          rides: rides.length,
          bookings: bookings.length,
          activeRides: executive.activeRides.length,
          completedBookings: executive.completedBookings.length,
          activeSOS: executive.activeSOS.length,
          openReports: executive.openReports.length,
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `ceo-snapshot-${Date.now()}`),
        {
          action: "CEO Dashboard Snapshot Saved",
          targetId: "ceo-dashboard",
          targetType: "executiveSnapshot",
          details: `Company score: ${executive.companyScore}/100`,
          severity: executive.companyStatus === "critical" ? "danger" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("CEO snapshot saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save CEO snapshot.");
    } finally {
      setLoading(false);
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: Status) {
    if (status === "excellent") return "Excellent";
    if (status === "healthy") return "Healthy";
    if (status === "watch") return "Watch";
    return "Critical";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue Intel</Link>
          <Link href="/admin/profitability" className="miniButton">Profitability</Link>
          <Link href="/admin/safety-intelligence" className="miniButton">Safety Intel</Link>
          <Link href="/admin/financial-forecast" className="miniButton">Forecast</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Executive Command</p>
            <h1>CEO <span>Dashboard</span></h1>
            <p className="subtitle">
              Executive overview for company health, revenue, growth, safety,
              driver supply, payout exposure, bookings and launch readiness.
            </p>
          </div>

          <div className={executive.companyScore < 70 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{executive.companyScore}</strong>
            <span>{statusLabel(executive.companyStatus)}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🚘" label="Active Rides" value={String(executive.activeRides.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="✅" label="Completed" value={String(executive.completedBookings.length)} />
          <Metric icon="💰" label="Gross Revenue" value={money(executive.grossRevenue)} />
          <Metric icon="💵" label="Net Estimate" value={money(executive.netEstimate)} />
          <Metric icon="🏦" label="Payout Exposure" value={money(executive.payoutExposure)} danger={executive.payoutExposure > 0} />
          <Metric icon="🚨" label="Active SOS" value={String(executive.activeSOS.length)} danger={executive.activeSOS.length > 0} />
        </section>

        <section className="executiveGrid">
          {executive.signals.map((item) => (
            <section key={item.id} className={`signalCard ${item.status}`}>
              <div className="signalTop">
                <span>{statusLabel(item.status)}</span>
                <strong>{item.value}</strong>
              </div>

              <h2>{item.title}</h2>
              <p>{item.insight}</p>
            </section>
          ))}
        </section>

        <section className="boardGrid">
          <section className="panel">
            <p className="eyebrow">CEO Summary</p>
            <h2>Executive Snapshot</h2>

            <div className="infoGrid">
              <Info label="Company Score" value={`${executive.companyScore}/100`} />
              <Info label="Company Status" value={statusLabel(executive.companyStatus)} />
              <Info label="Gross Revenue" value={money(executive.grossRevenue)} />
              <Info label="Platform Fees" value={money(executive.platformFees)} />
              <Info label="Net Estimate" value={money(executive.netEstimate)} />
              <Info label="Payout Exposure" value={money(executive.payoutExposure)} />
              <Info label="Verified Drivers" value={String(executive.verifiedDrivers.length)} />
              <Info label="Pending Verifications" value={String(executive.pendingVerifications.length)} />
              <Info label="Open Reports" value={String(executive.openReports.length)} />
              <Info label="Urgent Reports" value={String(executive.urgentReports.length)} />
              <Info label="Suspended Users" value={String(executive.suspendedUsers.length)} />
              <Info label="Cancelled Bookings" value={String(executive.cancelledBookings.length)} />
            </div>

            <button className="saveButton" onClick={saveExecutiveSnapshot} disabled={loading}>
              {loading ? "Saving..." : "Save CEO Snapshot"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Recommended Focus</p>
            <h2>Next CEO Actions</h2>

            <div className="actionList">
              <Link href="/admin/safety-intelligence" className={executive.activeSOS.length > 0 ? "action dangerAction" : "action"}>
                <strong>Safety Review</strong>
                <span>Review SOS, reports and risky signals.</span>
              </Link>

              <Link href="/admin/profitability" className="action">
                <strong>Profitability</strong>
                <span>Review margins, costs and payout exposure.</span>
              </Link>

              <Link href="/admin/driver-performance" className="action">
                <strong>Driver Performance</strong>
                <span>Identify your strongest and weakest drivers.</span>
              </Link>

              <Link href="/admin/financial-forecast" className="action">
                <strong>Financial Forecast</strong>
                <span>Review monthly and yearly projections.</span>
              </Link>

              <Link href="/admin/launch" className="action">
                <strong>Launch Readiness</strong>
                <span>Confirm RoadLink is ready to scale.</span>
              </Link>
            </div>
          </section>
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

        .hero,
        .metric,
        .signalCard,
        .panel {
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }
        h1 span, h2, .metricValue { color: #22c55e; }
        h2 { font-size: 30px; margin: 0 0 14px; }

        .subtitle,
        .signalCard p,
        .action span {
          color: #a1a1aa;
          line-height: 1.5;
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

        .warningScore strong { color: #fca5a5; }

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
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .dangerMetric .metricValue { color: #ef4444; }

        .executiveGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .signalCard {
          border-radius: 28px;
          padding: 24px;
        }

        .signalCard.critical,
        .signalCard.watch {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 42%),
            rgba(8,13,25,0.92);
        }

        .signalTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .signalTop span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .signalTop strong {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
        }

        .signalCard.critical .signalTop strong,
        .signalCard.watch .signalTop strong {
          color: #fca5a5;
        }

        .boardGrid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 24px;
        }

        .panel {
          border-radius: 30px;
          padding: 28px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .infoBox {
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
          color: white;
          font-weight: 900;
          cursor: pointer;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .actionList {
          display: grid;
          gap: 12px;
        }

        .action {
          display: block;
          padding: 16px;
          border-radius: 18px;
          color: white;
          text-decoration: none;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .dangerAction {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .action strong,
        .action span {
          display: block;
        }

        .action span {
          margin-top: 6px;
          font-size: 13px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1100px) {
          .stats,
          .executiveGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .boardGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats,
          .executiveGrid,
          .infoGrid {
            grid-template-columns: 1fr;
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
      }
