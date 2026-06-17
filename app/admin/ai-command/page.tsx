"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  status?: string;
  from?: string;
  to?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type EmergencyItem = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type VerificationItem = {
  id: string;
  status?: string;
  createdAt?: string;
  submittedAt?: string;
};

type Recommendation = {
  id: string;
  icon: string;
  title: string;
  description: string;
  action: string;
  impact: string;
  severity: "good" | "warning" | "danger";
  href: string;
};

export default function AdminAICommandPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [message, setMessage] = useState("Loading AI command center...");

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
      setMessage("");
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
    });

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    const unsubEmergencies = onSnapshot(query(collection(db, "emergencyAlerts")), (snapshot) => {
      setEmergencies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyItem[]);
    });

    const unsubVerifications = onSnapshot(query(collection(db, "driverVerifications")), (snapshot) => {
      setVerifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as VerificationItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubReports();
      unsubEmergencies();
      unsubVerifications();
    };
  }, []);

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function bookingValue(item: BookingItem) {
    return Number(item.price || item.amount || 0) * Number(item.seatsBooked || 1);
  }

  const ai = useMemo(() => {
    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified).length;
    const suspendedUsers = users.filter((item) => item.suspended).length;

    const activeRides = rides.filter(
      (item) => item.status === "active" || item.status === "open" || item.status === "in_progress"
    ).length;

    const completedRides = rides.filter((item) => item.status === "completed").length;

    const completedBookings = bookings.filter((item) => item.status === "completed");
    const cancelledBookings = bookings.filter(
      (item) => item.status === "cancelled" || item.status === "rejected" || item.status === "no_show"
    );

    const activeBookings = bookings.filter(
      (item) => item.status === "pending" || item.status === "reserved" || item.status === "confirmed"
    ).length;

    const grossRevenue = completedBookings.reduce((total, item) => total + bookingValue(item), 0);
    const roadLinkRevenue = grossRevenue * 0.12;

    const pendingPayouts = payouts.filter(
      (item) => item.status === "pending" || item.status === "approved"
    );
    const pendingPayoutAmount = pendingPayouts.reduce((total, item) => total + Number(item.amount || 0), 0);

    const openReports = reports.filter((item) => !item.status || item.status === "open").length;
    const urgentReports = reports.filter((item) => item.priority === "urgent" || item.priority === "critical").length;

    const activeSOS = emergencies.filter((item) => item.status === "active").length;
    const criticalSOS = emergencies.filter(
      (item) => item.status === "active" && (item.priority === "critical" || !item.priority)
    ).length;

    const pendingVerifications = verifications.filter((item) => item.status === "pending").length;

    const completionRate = bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;
    const cancellationRate = bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;
    const driverRatio = users.length > 0 ? Math.round((verifiedDrivers / users.length) * 100) : 0;

    let healthScore = 100;
    healthScore -= activeSOS * 18;
    healthScore -= urgentReports * 8;
    healthScore -= suspendedUsers * 4;
    healthScore -= Math.min(cancellationRate, 25);
    healthScore -= pendingVerifications > 0 ? 5 : 0;

    let growthScore = 35;
    growthScore += Math.min(users.length * 3, 25);
    growthScore += Math.min(rides.length * 4, 20);
    growthScore += Math.min(bookings.length * 3, 20);

    let revenueScore = 20;
    revenueScore += Math.min(grossRevenue / 10, 40);
    revenueScore += completedBookings.length > 0 ? 20 : 0;
    revenueScore -= pendingPayoutAmount > roadLinkRevenue && grossRevenue > 0 ? 10 : 0;

    let safetyScore = 100;
    safetyScore -= activeSOS * 25;
    safetyScore -= urgentReports * 12;
    safetyScore -= openReports * 5;
    safetyScore -= suspendedUsers * 5;

    let launchScore = 25;
    if (users.length > 0) launchScore += 10;
    if (verifiedDrivers > 0) launchScore += 15;
    if (rides.length > 0) launchScore += 15;
    if (bookings.length > 0) launchScore += 15;
    if (reports.length >= 0) launchScore += 5;
    if (verifications.length > 0 || verifiedDrivers > 0) launchScore += 10;
    if (grossRevenue > 0) launchScore += 10;

    const recommendations: Recommendation[] = [];

    if (verifiedDrivers < 3) {
      recommendations.push({
        id: "drivers",
        icon: "🚘",
        title: "Driver supply is too low",
        description: "RoadLink needs more verified drivers before scaling user acquisition.",
        action: "Recruit and verify at least 3 to 10 drivers in your first target city.",
        impact: "+25% launch readiness",
        severity: "warning",
        href: "/admin/users",
      });
    }

    if (activeRides === 0) {
      recommendations.push({
        id: "rides",
        icon: "🛣️",
        title: "No active rides available",
        description: "Passengers need available rides to understand the value of the platform.",
        action: "Create or recruit drivers to publish active routes.",
        impact: "+30% marketplace activity",
        severity: "warning",
        href: "/admin/rides",
      });
    }

    if (cancellationRate >= 20) {
      recommendations.push({
        id: "cancellations",
        icon: "⚠️",
        title: "Cancellation rate is high",
        description: "A high cancellation rate can damage trust and reduce passenger retention.",
        action: "Add cancellation rules, driver reliability score, and passenger reminders.",
        impact: "-18% cancellations",
        severity: "danger",
        href: "/admin/bookings",
      });
    }

    if (activeSOS > 0) {
      recommendations.push({
        id: "sos",
        icon: "🚨",
        title: "Active SOS alert detected",
        description: "Emergency alerts should be reviewed immediately by an admin.",
        action: "Open the SOS center and resolve active emergency alerts.",
        impact: "Critical safety protection",
        severity: "danger",
        href: "/admin/emergency",
      });
    }

    if (pendingVerifications > 0) {
      recommendations.push({
        id: "verifications",
        icon: "🛡️",
        title: "Driver verifications pending",
        description: "Pending driver approvals slow down marketplace supply.",
        action: "Review pending verification requests today.",
        impact: "+15% driver activation",
        severity: "warning",
        href: "/admin/verifications",
      });
    }

    if (grossRevenue === 0 && bookings.length > 0) {
      recommendations.push({
        id: "revenue",
        icon: "💰",
        title: "Bookings exist but revenue is not completed",
        description: "The platform has booking activity but no completed revenue yet.",
        action: "Move completed trips to completed status and review payment flow.",
        impact: "Unlock revenue tracking",
        severity: "warning",
        href: "/admin/revenue",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: "good",
        icon: "✅",
        title: "Platform is stable",
        description: "No critical risks detected right now.",
        action: "Continue growing drivers, rides, bookings, and revenue.",
        impact: "Healthy operations",
        severity: "good",
        href: "/admin/analytics",
      });
    }

    return {
      verifiedDrivers,
      suspendedUsers,
      activeRides,
      activeBookings,
      completedRides,
      grossRevenue,
      roadLinkRevenue,
      pendingPayoutAmount,
      pendingPayouts: pendingPayouts.length,
      openReports,
      urgentReports,
      activeSOS,
      criticalSOS,
      pendingVerifications,
      completionRate,
      cancellationRate,
      driverRatio,
      healthScore: Math.max(Math.min(Math.round(healthScore), 100), 0),
      growthScore: Math.max(Math.min(Math.round(growthScore), 100), 0),
      revenueScore: Math.max(Math.min(Math.round(revenueScore), 100), 0),
      safetyScore: Math.max(Math.min(Math.round(safetyScore), 100), 0),
      launchScore: Math.max(Math.min(Math.round(launchScore), 100), 0),
      recommendations,
    };
  }, [users, rides, bookings, payouts, reports, emergencies, verifications]);

  const commandStatus =
    ai.healthScore >= 85 && ai.launchScore >= 80
      ? "Ready"
      : ai.healthScore >= 70
      ? "Monitor"
      : "Action Needed";

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/live" className="miniButton">Live</Link>
          <Link href="/admin/launch" className="miniButton">Launch</Link>
          <Link href="/admin/fraud" className="miniButton dangerLink">Fraud</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink CEO AI</p>
            <h1>AI Command <span>Center</span></h1>
            <p className="subtitle">
              Executive intelligence for growth, revenue, launch readiness, safety, fraud and operations.
            </p>
          </div>

          <div className={ai.healthScore < 75 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{ai.healthScore}</strong>
            <span>{commandStatus}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="scoreGrid">
          <ScoreCard icon="🩺" label="Health Score" value={ai.healthScore} />
          <ScoreCard icon="📈" label="Growth Score" value={ai.growthScore} />
          <ScoreCard icon="💰" label="Revenue Score" value={ai.revenueScore} />
          <ScoreCard icon="🛡️" label="Safety Score" value={ai.safetyScore} danger={ai.safetyScore < 75} />
          <ScoreCard icon="🚀" label="Launch Score" value={ai.launchScore} />
        </section>

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🚘" label="Active Rides" value={String(ai.activeRides)} />
          <Metric icon="🎟️" label="Active Bookings" value={String(ai.activeBookings)} />
          <Metric icon="🛡️" label="Drivers" value={String(ai.verifiedDrivers)} />
          <Metric icon="💵" label="Gross Revenue" value={money(ai.grossRevenue)} />
          <Metric icon="🏦" label="RoadLink Fees" value={money(ai.roadLinkRevenue)} />
          <Metric icon="🚨" label="Active SOS" value={String(ai.activeSOS)} danger={ai.activeSOS > 0} />
          <Metric icon="⚠️" label="Reports" value={String(ai.openReports)} danger={ai.openReports > 0} />
        </section>

        <section className="gridTwo">
          <Panel title="AI Recommendations" eyebrow="Executive Actions" icon="🤖">
            <div className="recommendationList">
              {ai.recommendations.map((item) => (
                <Link
                  href={item.href}
                  key={item.id}
                  className={`recommendation ${item.severity}`}
                >
                  <div className="recommendationIcon">{item.icon}</div>

                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <small>{item.action}</small>
                  </div>

                  <em>{item.impact}</em>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Operational Intelligence" eyebrow="AI Summary" icon="🧠">
            <Info label="Completion Rate" value={`${ai.completionRate}%`} />
            <Info label="Cancellation Rate" value={`${ai.cancellationRate}%`} />
            <Info label="Driver Ratio" value={`${ai.driverRatio}%`} />
            <Info label="Pending Verifications" value={String(ai.pendingVerifications)} />
            <Info label="Pending Payouts" value={money(ai.pendingPayoutAmount)} />
            <Info label="Suspended Users" value={String(ai.suspendedUsers)} />
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Risk Radar" eyebrow="Trust & Safety" icon="📡" danger={ai.activeSOS > 0 || ai.urgentReports > 0}>
            <Info label="Active SOS Alerts" value={String(ai.activeSOS)} />
            <Info label="Critical SOS" value={String(ai.criticalSOS)} />
            <Info label="Open Reports" value={String(ai.openReports)} />
            <Info label="Urgent Reports" value={String(ai.urgentReports)} />
          </Panel>

          <Panel title="CEO Quick Access" eyebrow="Command Links" icon="⚡">
            <div className="quickLinks">
              <Link href="/admin/live">🟢 Live</Link>
              <Link href="/admin/launch">🚀 Launch</Link>
              <Link href="/admin/revenue">💰 Revenue</Link>
              <Link href="/admin/fraud">🕵️ Fraud</Link>
              <Link href="/admin/emergency">🚨 SOS</Link>
              <Link href="/admin/users">👥 Users</Link>
              <Link href="/admin/rides">🚘 Rides</Link>
              <Link href="/admin/analytics">📊 Analytics</Link>
            </div>
          </Panel>
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
          padding: 12px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 32%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 36%),
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
        .scoreCard,
        .panel {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 16px 44px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
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
          font-size: 34px;
          line-height: 0.98;
          margin: 0 0 10px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreValue {
          color: #22c55e;
        }

        h2 {
          margin: 0;
          font-size: 24px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
        }

        .scoreOrb {
          min-width: 82px;
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 8px;
        }

        .warningScore {
          background: rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fde68a;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 8px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .scoreGrid,
        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .scoreCard,
        .metric {
          border-radius: 16px;
          padding: 12px;
        }

        .scoreCard {
          min-height: 96px;
        }

        .scoreTop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }

        .scoreIcon,
        .metricIcon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
        }

        .scoreValue {
          font-size: 24px;
          font-weight: 900;
        }

        .scoreLabel,
        .metricLabel {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .bar {
          height: 10px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,0.08);
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .dangerScore {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .metric {
          min-height: 58px;
          display: grid;
          grid-template-columns: 34px 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .metricValue {
          display: block;
          font-size: 19px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .gridTwo {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .panel {
          border-radius: 22px;
          padding: 16px;
          overflow: hidden;
        }

        .dangerPanel {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 40%),
            rgba(8,13,25,0.92);
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .panelIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .infoStack,
        .recommendationList {
          display: grid;
          gap: 8px;
        }

        .infoBox,
        .recommendation {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .recommendation {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 10px;
          color: white;
          text-decoration: none;
        }

        .recommendation.warning {
          border-color: rgba(250,204,21,0.35);
          background: rgba(250,204,21,0.08);
        }

        .recommendation.danger {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .recommendationIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .recommendation strong,
        .recommendation p,
        .recommendation small,
        .recommendation em {
          display: block;
        }

        .recommendation p,
        .recommendation small {
          color: #a1a1aa;
          line-height: 1.4;
        }

        .recommendation p {
          margin: 5px 0;
          font-size: 12px;
        }

        .recommendation small {
          font-size: 11px;
        }

        .recommendation em {
          grid-column: 2;
          color: #22c55e;
          font-size: 11px;
          font-style: normal;
          font-weight: 900;
          margin-top: 5px;
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

        .quickLinks {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
        }

        .quickLinks a {
          padding: 13px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
          text-align: center;
        }

        @media (max-width: 430px) {
          h1 {
            font-size: 31px;
          }

          .scoreGrid,
          .stats {
            grid-template-columns: 1fr;
          }

          .quickLinks {
            grid-template-columns: 1fr;
          }
        }

        @media (min-width: 900px) {
          .page {
            padding: 24px;
            padding-bottom: 80px;
          }

          .scoreGrid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .stats {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .gridTwo {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .quickLinks {
            grid-template-columns: repeat(4, 1fr);
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

function ScoreCard({
  icon,
  label,
  value,
  danger,
}: {
  icon: string;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "scoreCard dangerScore" : "scoreCard"}>
      <div className="scoreTop">
        <div className="scoreIcon">{icon}</div>
        <strong className="scoreValue">{value}</strong>
      </div>

      <div className="scoreLabel">{label}</div>

      <div className="bar">
        <div style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  icon,
  children,
  danger,
}: {
  title: string;
  eyebrow: string;
  icon: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={danger ? "panel dangerPanel" : "panel"}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>

        <div className="panelIcon">{icon}</div>
      </div>

      <div className="infoStack">{children}</div>
    </section>
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
