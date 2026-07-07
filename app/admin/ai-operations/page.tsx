"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  driverVerified?: boolean;
  suspended?: boolean;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  price?: number;
};

type BookingItem = {
  id: string;
  status?: string;
  passengerEmail?: string;
  driverEmail?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
  reason?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
};

type Insight = {
  id: string;
  icon: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  recommendation: string;
  href: string;
};

export default function AdminAIOperationsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [message, setMessage] = useState("Loading AI Operations...");
  const [saving, setSaving] = useState(false);

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

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubPayouts();
    };
  }, []);

  const ai = useMemo(() => {
    const drivers = users.filter((user) => user.driverVerified);
    const passengers = users.filter((user) => !user.driverVerified);
    const suspendedUsers = users.filter((user) => user.suspended);

    const activeRides = rides.filter((ride) =>
      ["active", "open", "full", "in_progress"].includes(String(ride.status || ""))
    );

    const completedBookings = bookings.filter((booking) => booking.status === "completed");
    const cancelledBookings = bookings.filter((booking) =>
      ["cancelled", "rejected", "no_show"].includes(String(booking.status || ""))
    );

    const activeBookings = bookings.filter((booking) =>
      ["pending", "reserved", "confirmed"].includes(String(booking.status || ""))
    );

    const openReports = reports.filter((report) => !report.status || report.status === "open");
    const urgentReports = reports.filter(
      (report) => report.priority === "urgent" || report.priority === "critical"
    );

    const pendingPayouts = payouts.filter(
      (payout) => payout.status === "pending" || payout.status === "approved"
    );

    const revenue = completedBookings.reduce(
      (total, booking) =>
        total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
      0
    );

    const cancellationRate =
      bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;

    const driverSupplyScore = Math.min(100, drivers.length * 18 + activeRides.length * 8);
    const demandScore = Math.min(100, bookings.length * 8 + activeBookings.length * 6 + users.length * 2);
    const safetyScore = Math.max(
      0,
      100 - urgentReports.length * 20 - openReports.length * 6 - suspendedUsers.length * 10
    );
    const revenueScore = Math.min(100, revenue * 2 + completedBookings.length * 8);
    const operationsScore = Math.max(
      0,
      100 - pendingPayouts.length * 5 - cancellationRate - urgentReports.length * 10
    );
    const marketplaceScore = Math.round((driverSupplyScore + demandScore + operationsScore) / 3);
    const aiHealthScore = Math.round(
      (driverSupplyScore + demandScore + safetyScore + revenueScore + operationsScore + marketplaceScore) / 6
    );

    const routeMap = rides.reduce<Record<string, number>>((acc, ride) => {
      const route = `${ride.from || "Unknown"} → ${ride.to || "Unknown"}`;
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {});

    const topRoutes = Object.entries(routeMap)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const insights: Insight[] = [];

    if (urgentReports.length > 0) {
      insights.push({
        id: "urgent-safety",
        icon: "🚨",
        title: "Urgent safety risk detected",
        description: `${urgentReports.length} urgent report(s) need immediate review.`,
        severity: "critical",
        confidence: 96,
        recommendation: "Open Reports and resolve urgent cases before scaling traffic.",
        href: "/admin/reports",
      });
    }

    if (drivers.length < 3) {
      insights.push({
        id: "driver-shortage",
        icon: "🚘",
        title: "Driver supply is too low",
        description: "RoadLink needs more verified drivers before a strong public launch.",
        severity: "high",
        confidence: 91,
        recommendation: "Recruit at least three to ten verified drivers in the first target city.",
        href: "/admin/verifications",
      });
    }

    if (activeRides.length < 3) {
      insights.push({
        id: "route-density",
        icon: "🛣️",
        title: "Route density is weak",
        description: "Passengers need more active routes to convert into bookings.",
        severity: "high",
        confidence: 88,
        recommendation: "Seed your strongest city corridor with multiple active rides.",
        href: "/admin/rides",
      });
    }

    if (cancellationRate >= 20) {
      insights.push({
        id: "cancel-risk",
        icon: "📉",
        title: "Cancellation risk is elevated",
        description: `Cancellation rate is ${cancellationRate}%.`,
        severity: "medium",
        confidence: 84,
        recommendation: "Add reminders, reliability scoring and cancellation rules.",
        href: "/admin/bookings",
      });
    }

    if (pendingPayouts.length > 0) {
      insights.push({
        id: "payout-risk",
        icon: "🏦",
        title: "Pending payout queue needs review",
        description: `${pendingPayouts.length} payout request(s) are waiting.`,
        severity: "medium",
        confidence: 79,
        recommendation: "Review payout requests to protect driver trust.",
        href: "/admin/payouts",
      });
    }

    if (completedBookings.length === 0 && bookings.length > 0) {
      insights.push({
        id: "booking-completion",
        icon: "🎟️",
        title: "Bookings exist but no completed revenue",
        description: "The marketplace has booking activity but no completed trips yet.",
        severity: "medium",
        confidence: 82,
        recommendation: "Test the trip completion flow and move completed rides into completed status.",
        href: "/admin/bookings",
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "healthy",
        icon: "✅",
        title: "Operations look stable",
        description: "No major AI operations issue detected.",
        severity: "low",
        confidence: 87,
        recommendation: "Continue building driver supply, route density and repeat passenger activity.",
        href: "/admin/mission-control",
      });
    }

    return {
      drivers,
      passengers,
      suspendedUsers,
      activeRides,
      activeBookings,
      completedBookings,
      cancelledBookings,
      openReports,
      urgentReports,
      pendingPayouts,
      revenue,
      cancellationRate,
      driverSupplyScore,
      demandScore,
      safetyScore,
      revenueScore,
      operationsScore,
      marketplaceScore,
      aiHealthScore,
      topRoutes,
      insights,
      revenue30: revenue * 1.4 + completedBookings.length * 10,
      revenue90: revenue * 2.6 + completedBookings.length * 32,
      revenue365: revenue * 9.5 + completedBookings.length * 140,
    };
  }, [users, rides, bookings, reports, payouts]);

  async function saveInsights() {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await Promise.all(
        ai.insights.map((insight) =>
          addDoc(collection(db, "aiInsights"), {
            type: "operations",
            title: insight.title,
            description: insight.description,
            severity: insight.severity,
            confidence: insight.confidence,
            recommendation: insight.recommendation,
            href: insight.href,
            resolved: false,
            createdAt: now,
            createdBy: auth.currentUser?.email || "admin",
          })
        )
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "AI Operations Insights Saved",
        targetType: "aiInsights",
        details: `${ai.insights.length} AI operation insight(s) saved.`,
        severity: ai.insights.some((item) => item.severity === "critical") ? "critical" : "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("AI insights saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save AI insights.");
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function severityClass(value: string) {
    if (value === "critical") return "pill critical";
    if (value === "high") return "pill high";
    if (value === "medium") return "pill medium";
    return "pill low";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/mission-control" className="miniButton">Mission Control</Link>
          <Link href="/admin/ai-copilot" className="miniButton">AI Copilot</Link>
          <Link href="/admin/ai-predict" className="miniButton">AI Predict</Link>
          <Link href="/admin/workflow-builder" className="miniButton">Workflow Builder</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink AI Command</p>
            <h1>AI Operations <span>Center</span></h1>
            <p className="subtitle">
              AI-powered operations intelligence for safety, fraud risk, demand, supply,
              cancellations, revenue, payouts, routes and executive actions.
            </p>
          </div>

          <div className={ai.aiHealthScore >= 75 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{ai.aiHealthScore}</strong>
            <span>AI Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🧠" label="AI Health" value={`${ai.aiHealthScore}%`} />
          <Metric icon="🚘" label="Supply" value={`${ai.driverSupplyScore}%`} />
          <Metric icon="📈" label="Demand" value={`${ai.demandScore}%`} />
          <Metric icon="🛡️" label="Safety" value={`${ai.safetyScore}%`} danger={ai.safetyScore < 70} />
          <Metric icon="💰" label="Revenue AI" value={`${ai.revenueScore}%`} />
          <Metric icon="⚙️" label="Operations" value={`${ai.operationsScore}%`} />
          <Metric icon="🌎" label="Marketplace" value={`${ai.marketplaceScore}%`} />
          <Metric icon="🚨" label="Urgent Reports" value={String(ai.urgentReports.length)} danger={ai.urgentReports.length > 0} />
        </section>

        <section className="actionCard">
          <div>
            <p className="eyebrow">AI Insight Engine</p>
            <h2>Save Current AI Insights</h2>
            <p>
              Saves detected issues and recommendations into Firestore collection
              <strong> aiInsights</strong>.
            </p>
          </div>

          <button onClick={saveInsights} disabled={saving}>
            {saving ? "Saving..." : "Save AI Insights"}
          </button>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">AI Alerts</p>
            <h2>Recommended Actions</h2>

            <div className="insightList">
              {ai.insights.map((insight) => (
                <Link key={insight.id} href={insight.href} className={`insight ${insight.severity}`}>
                  <div className="insightIcon">{insight.icon}</div>

                  <div>
                    <strong>{insight.title}</strong>
                    <p>{insight.description}</p>
                    <small>{insight.recommendation}</small>
                  </div>

                  <em>{insight.confidence}%</em>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Forecast</p>
            <h2>Revenue Projection</h2>

            <div className="projectionBox">
              <div>
                <span>30 Days</span>
                <strong>{money(ai.revenue30)}</strong>
              </div>

              <div>
                <span>90 Days</span>
                <strong>{money(ai.revenue90)}</strong>
              </div>

              <div>
                <span>365 Days</span>
                <strong>{money(ai.revenue365)}</strong>
              </div>
            </div>
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Marketplace</p>
            <h2>Live AI Metrics</h2>

            <div className="infoGrid">
              <Info label="Users" value={String(users.length)} />
              <Info label="Drivers" value={String(ai.drivers.length)} />
              <Info label="Passengers" value={String(ai.passengers.length)} />
              <Info label="Active Rides" value={String(ai.activeRides.length)} />
              <Info label="Active Bookings" value={String(ai.activeBookings.length)} />
              <Info label="Completed Bookings" value={String(ai.completedBookings.length)} />
              <Info label="Cancellation Rate" value={`${ai.cancellationRate}%`} />
              <Info label="Pending Payouts" value={String(ai.pendingPayouts.length)} />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Hotspots</p>
            <h2>Top Route Demand</h2>

            {ai.topRoutes.length === 0 ? (
              <div className="empty">
                <h3>No route data</h3>
                <p>Routes will appear here when drivers publish rides.</p>
              </div>
            ) : (
              <div className="rankList">
                {ai.topRoutes.map((route, index) => (
                  <div key={route.route} className="rankItem">
                    <em>#{index + 1}</em>
                    <div>
                      <strong>{route.route}</strong>
                      <span>{route.count} ride(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1240px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .panel,
        .actionCard {
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
          font-size: 60px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong,
        .projectionBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .actionCard p,
        .insight p,
        .insight small,
        .rankItem span,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0;
        }

        .scoreOrb {
          min-width: 116px;
          height: 116px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong { color: #fca5a5; }

        .scoreOrb strong {
          font-size: 36px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.20);
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          margin-bottom: 10px;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          display: block;
          margin-bottom: 6px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .actionCard {
          border-radius: 28px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
          margin-bottom: 22px;
        }

        button {
          padding: 15px 22px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 24px;
        }

        .insightList {
          display: grid;
          gap: 12px;
        }

        .insight {
          display: grid;
          grid-template-columns: 50px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 15px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: white;
          text-decoration: none;
        }

        .insight.critical {
          border-color: rgba(239,68,68,0.4);
          background: rgba(127,29,29,0.22);
        }

        .insight.high {
          border-color: rgba(249,115,22,0.4);
          background: rgba(124,45,18,0.18);
        }

        .insight.medium {
          border-color: rgba(234,179,8,0.35);
          background: rgba(113,63,18,0.14);
        }

        .insight.low {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.08);
        }

        .insightIcon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .insight strong,
        .insight p,
        .insight small {
          display: block;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .insight p,
        .insight small {
          margin-top: 5px;
        }

        .insight em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
          white-space: nowrap;
        }

        .projectionBox {
          display: grid;
          gap: 12px;
        }

        .projectionBox div {
          padding: 18px;
          border-radius: 18px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .projectionBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .projectionBox strong {
          font-size: 32px;
          font-weight: 900;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
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
          color: white;
          overflow-wrap: anywhere;
        }

        .rankList {
          display: grid;
          gap: 10px;
        }

        .rankItem {
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .rankItem em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
          font-size: 18px;
        }

        .rankItem strong,
        .rankItem span {
          display: block;
          overflow-wrap: anywhere;
        }

        .empty {
          padding: 24px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .empty h3 {
          margin: 0 0 8px;
        }

        @media (max-width: 1050px) {
          .hero,
          .grid,
          .actionCard {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 { font-size: 46px; }
        }

        @media (max-width: 650px) {
          .page { padding: 16px; padding-bottom: 120px; }

          .hero,
          .panel,
          .actionCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .infoGrid,
          .insight {
            grid-template-columns: 1fr;
          }

          .actionCard button {
            width: 100%;
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
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
       }
