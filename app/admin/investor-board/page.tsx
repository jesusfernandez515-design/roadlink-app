"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type SignalStatus = "excellent" | "strong" | "watch" | "risk";

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

type InvestorKPI = {
  id: string;
  title: string;
  value: string;
  status: SignalStatus;
  insight: string;
};

export default function AdminInvestorBoardPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [payouts, setPayouts] = useState<BasicItem[]>([]);
  const [reports, setReports] = useState<BasicItem[]>([]);
  const [alerts, setAlerts] = useState<BasicItem[]>([]);
  const [verifications, setVerifications] = useState<BasicItem[]>([]);
  const [message, setMessage] = useState("Loading investor board...");
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

  const investor = useMemo(() => {
    const activeRides = rides.filter(
      (item) =>
        item.status === "active" ||
        item.status === "open" ||
        item.status === "full" ||
        item.status === "in_progress"
    );

    const completedRides = rides.filter((item) => item.status === "completed");

    const completedBookings = bookings.filter((item) => item.status === "completed");

    const activeBookings = bookings.filter(
      (item) =>
        item.status === "pending" ||
        item.status === "reserved" ||
        item.status === "confirmed"
    );

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

    const openReports = reports.filter((item) => !item.status || item.status === "open");

    const urgentReports = reports.filter(
      (item) => item.priority === "urgent" || item.priority === "critical"
    );

    const activeSOS = alerts.filter((item) => item.status === "active");

    const pendingVerifications = verifications.filter(
      (item) => !item.status || item.status === "pending" || item.status === "reviewing"
    );

    const grossRevenue = bookings.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    const platformRevenue = grossRevenue * 0.12;

    const payoutExposure = pendingPayouts.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const netEstimate = platformRevenue - grossRevenue * 0.03;

    const conversionRate =
      users.length > 0 ? Math.round((bookings.length / users.length) * 100) : 0;

    const driverRatio =
      users.length > 0 ? Math.round((verifiedDrivers.length / users.length) * 100) : 0;

    const completionRate =
      bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;

    const cancellationRate =
      bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;

    const annualRevenueRunRate = grossRevenue * 12;
    const annualPlatformRunRate = platformRevenue * 12;

    const estimatedValuationLow = annualPlatformRunRate * 3;
    const estimatedValuationHigh = annualPlatformRunRate * 8;

    let investorScore = 100;

    investorScore += grossRevenue >= 1000 ? 12 : grossRevenue >= 250 ? 7 : grossRevenue > 0 ? 3 : 0;
    investorScore += users.length >= 100 ? 10 : users.length >= 25 ? 6 : users.length >= 5 ? 3 : 0;
    investorScore += completedBookings.length >= 50 ? 10 : completedBookings.length >= 10 ? 6 : completedBookings.length > 0 ? 3 : 0;
    investorScore += verifiedDrivers.length >= 20 ? 8 : verifiedDrivers.length >= 5 ? 5 : verifiedDrivers.length > 0 ? 2 : 0;

    investorScore -= activeSOS.length * 20;
    investorScore -= urgentReports.length * 10;
    investorScore -= openReports.length * 4;
    investorScore -= suspendedUsers.length * 3;
    investorScore -= cancellationRate >= 35 ? 10 : cancellationRate >= 20 ? 5 : 0;
    investorScore -= payoutExposure > grossRevenue && grossRevenue > 0 ? 8 : 0;

    investorScore = Math.max(Math.min(investorScore, 100), 0);

    const investorStatus: SignalStatus =
      investorScore >= 85
        ? "excellent"
        : investorScore >= 70
        ? "strong"
        : investorScore >= 45
        ? "watch"
        : "risk";

    const kpis: InvestorKPI[] = [
      {
        id: "investor-score",
        title: "Investor Readiness",
        value: `${investorScore}/100`,
        status: investorStatus,
        insight:
          investorStatus === "excellent"
            ? "RoadLink is showing strong investor readiness signals."
            : investorStatus === "strong"
            ? "RoadLink has promising signals but still needs more traction."
            : investorStatus === "watch"
            ? "RoadLink needs stronger traction, revenue or safety stability before pitching."
            : "RoadLink is not ready for investor presentation yet.",
      },
      {
        id: "gross-revenue",
        title: "Gross Revenue",
        value: money(grossRevenue),
        status: grossRevenue >= 1000 ? "excellent" : grossRevenue >= 250 ? "strong" : "watch",
        insight: "Total booking revenue before platform fees and payout exposure.",
      },
      {
        id: "platform-revenue",
        title: "Platform Revenue Estimate",
        value: money(platformRevenue),
        status: platformRevenue >= 250 ? "excellent" : platformRevenue >= 50 ? "strong" : "watch",
        insight: "Estimated RoadLink platform revenue using a twelve percent platform fee.",
      },
      {
        id: "run-rate",
        title: "Annual Revenue Run Rate",
        value: money(annualRevenueRunRate),
        status: annualRevenueRunRate >= 12000 ? "excellent" : annualRevenueRunRate >= 3000 ? "strong" : "watch",
        insight: "Simple annualized revenue estimate based on current gross revenue.",
      },
      {
        id: "users",
        title: "Users",
        value: String(users.length),
        status: users.length >= 100 ? "excellent" : users.length >= 25 ? "strong" : "watch",
        insight: "User count is a key investor traction metric.",
      },
      {
        id: "drivers",
        title: "Verified Drivers",
        value: String(verifiedDrivers.length),
        status: verifiedDrivers.length >= 20 ? "excellent" : verifiedDrivers.length >= 5 ? "strong" : "watch",
        insight: "Driver supply is essential for marketplace liquidity.",
      },
      {
        id: "bookings",
        title: "Completed Bookings",
        value: String(completedBookings.length),
        status: completedBookings.length >= 50 ? "excellent" : completedBookings.length >= 10 ? "strong" : "watch",
        insight: "Completed bookings prove real marketplace usage.",
      },
      {
        id: "safety",
        title: "Safety Risk",
        value: String(activeSOS.length + urgentReports.length),
        status: activeSOS.length > 0 ? "risk" : urgentReports.length > 0 ? "watch" : "excellent",
        insight: "Investor confidence depends on safety controls and incident response.",
      },
    ];

    return {
      activeRides,
      completedRides,
      completedBookings,
      activeBookings,
      cancelledBookings,
      verifiedDrivers,
      suspendedUsers,
      pendingPayouts,
      openReports,
      urgentReports,
      activeSOS,
      pendingVerifications,
      grossRevenue,
      platformRevenue,
      payoutExposure,
      netEstimate,
      conversionRate,
      driverRatio,
      completionRate,
      cancellationRate,
      annualRevenueRunRate,
      annualPlatformRunRate,
      estimatedValuationLow,
      estimatedValuationHigh,
      investorScore,
      investorStatus,
      kpis,
    };
  }, [users, rides, bookings, payouts, reports, alerts, verifications]);

  async function saveInvestorSnapshot() {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "investorSnapshots", `investor-board-${Date.now()}`),
        {
          investorScore: investor.investorScore,
          investorStatus: investor.investorStatus,
          users: users.length,
          rides: rides.length,
          bookings: bookings.length,
          completedBookings: investor.completedBookings.length,
          verifiedDrivers: investor.verifiedDrivers.length,
          grossRevenue: investor.grossRevenue,
          platformRevenue: investor.platformRevenue,
          annualRevenueRunRate: investor.annualRevenueRunRate,
          annualPlatformRunRate: investor.annualPlatformRunRate,
          estimatedValuationLow: investor.estimatedValuationLow,
          estimatedValuationHigh: investor.estimatedValuationHigh,
          activeSOS: investor.activeSOS.length,
          openReports: investor.openReports.length,
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `investor-board-${Date.now()}`),
        {
          action: "Investor Board Snapshot Saved",
          targetId: "investor-board",
          targetType: "investorSnapshot",
          details: `Investor score: ${investor.investorScore}/100`,
          severity: investor.investorStatus === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Investor snapshot saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save investor snapshot.");
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: SignalStatus) {
    if (status === "excellent") return "Excellent";
    if (status === "strong") return "Strong";
    if (status === "watch") return "Watch";
    return "Risk";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/ceo-dashboard" className="miniButton">CEO</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue Intel</Link>
          <Link href="/admin/profitability" className="miniButton">Profitability</Link>
          <Link href="/admin/financial-forecast" className="miniButton">Forecast</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Executive Capital</p>
            <h1>Investor <span>Board</span></h1>
            <p className="subtitle">
              Investor-ready snapshot for traction, revenue, growth, marketplace liquidity,
              safety, valuation estimates, run rate and executive KPIs.
            </p>
          </div>

          <div className={investor.investorScore < 70 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{investor.investorScore}</strong>
            <span>{statusLabel(investor.investorStatus)}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🚘" label="Drivers" value={String(investor.verifiedDrivers.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="✅" label="Completed" value={String(investor.completedBookings.length)} />
          <Metric icon="💰" label="Gross Revenue" value={money(investor.grossRevenue)} />
          <Metric icon="📈" label="Annual Run Rate" value={money(investor.annualRevenueRunRate)} />
          <Metric icon="🏦" label="Platform ARR" value={money(investor.annualPlatformRunRate)} />
          <Metric icon="💼" label="Valuation Range" value={`${money(investor.estimatedValuationLow)} - ${money(investor.estimatedValuationHigh)}`} />
        </section>

        <section className="kpiGrid">
          {investor.kpis.map((item) => (
            <section key={item.id} className={`kpiCard ${item.status}`}>
              <div className="kpiTop">
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
            <p className="eyebrow">Investor Metrics</p>
            <h2>Traction Snapshot</h2>

            <div className="infoGrid">
              <Info label="Investor Score" value={`${investor.investorScore}/100`} />
              <Info label="Investor Status" value={statusLabel(investor.investorStatus)} />
              <Info label="Gross Revenue" value={money(investor.grossRevenue)} />
              <Info label="Platform Revenue" value={money(investor.platformRevenue)} />
              <Info label="Net Estimate" value={money(investor.netEstimate)} />
              <Info label="Payout Exposure" value={money(investor.payoutExposure)} />
              <Info label="Annual Gross Run Rate" value={money(investor.annualRevenueRunRate)} />
              <Info label="Annual Platform Run Rate" value={money(investor.annualPlatformRunRate)} />
              <Info label="Estimated Valuation Low" value={money(investor.estimatedValuationLow)} />
              <Info label="Estimated Valuation High" value={money(investor.estimatedValuationHigh)} />
              <Info label="Conversion Rate" value={`${investor.conversionRate}%`} />
              <Info label="Driver Ratio" value={`${investor.driverRatio}%`} />
              <Info label="Completion Rate" value={`${investor.completionRate}%`} />
              <Info label="Cancellation Rate" value={`${investor.cancellationRate}%`} />
              <Info label="Open Reports" value={String(investor.openReports.length)} />
              <Info label="Active SOS" value={String(investor.activeSOS.length)} />
            </div>

            <button className="saveButton" onClick={saveInvestorSnapshot} disabled={saving}>
              {saving ? "Saving..." : "Save Investor Snapshot"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Pitch Readiness</p>
            <h2>Investor Narrative</h2>

            <div className="pitchBox">
              <strong>RoadLink is building a long-distance ride-sharing marketplace.</strong>
              <p>
                The strongest investor signals are completed bookings, verified drivers,
                revenue growth, low safety incidents and healthy marketplace activity.
              </p>
            </div>

            <div className="actionList">
              <Link href="/admin/ceo-dashboard" className="action">
                <strong>CEO Dashboard</strong>
                <span>Review executive company health.</span>
              </Link>

              <Link href="/admin/revenue-intelligence" className="action">
                <strong>Revenue Intelligence</strong>
                <span>Review revenue routes and driver revenue.</span>
              </Link>

              <Link href="/admin/profitability" className="action">
                <strong>Profitability</strong>
                <span>Review margin and profit signals.</span>
              </Link>

              <Link href="/admin/safety-intelligence" className={investor.activeSOS.length > 0 ? "action dangerAction" : "action"}>
                <strong>Safety Intelligence</strong>
                <span>Review incidents before pitching.</span>
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
        .kpiCard,
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
        .kpiCard p,
        .pitchBox p,
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
          font-size: 20px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .kpiCard {
          border-radius: 28px;
          padding: 24px;
        }

        .kpiCard.risk,
        .kpiCard.watch {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 42%),
            rgba(8,13,25,0.92);
        }

        .kpiTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .kpiTop span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .kpiTop strong {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .kpiCard.risk .kpiTop strong,
        .kpiCard.watch .kpiTop strong {
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

        .infoBox,
        .pitchBox,
        .action {
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

        .pitchBox {
          margin-bottom: 16px;
        }

        .pitchBox strong,
        .pitchBox p {
          display: block;
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
          color: white;
          text-decoration: none;
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
          .kpiGrid {
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
          .kpiGrid,
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
            }
