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
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  price?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  passengerEmail?: string;
  driverEmail?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
  reason?: string;
  reporterEmail?: string;
  targetUserEmail?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  driverEmail?: string;
  createdAt?: string;
};

type Decision = {
  id: string;
  icon: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  action: string;
  href: string;
};

export default function AdminAIDecisionCenterPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [message, setMessage] = useState("Loading AI Decision Center...");
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
    const drivers = users.filter((item) => item.driverVerified);
    const passengers = users.filter((item) => !item.driverVerified);
    const suspendedUsers = users.filter((item) => item.suspended);

    const activeRides = rides.filter((item) =>
      ["active", "open", "full", "in_progress"].includes(String(item.status || ""))
    );

    const completedBookings = bookings.filter((item) => item.status === "completed");
    const cancelledBookings = bookings.filter((item) =>
      ["cancelled", "rejected", "no_show"].includes(String(item.status || ""))
    );

    const openReports = reports.filter((item) => !item.status || item.status === "open");
    const urgentReports = reports.filter((item) => item.priority === "urgent" || item.priority === "critical");
    const pendingPayouts = payouts.filter((item) => item.status === "pending" || item.status === "approved");

    const revenue = completedBookings.reduce(
      (total, booking) =>
        total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
      0
    );

    const demandScore = Math.min(100, bookings.length * 8 + activeRides.length * 6 + users.length * 2);
    const supplyScore = Math.min(100, drivers.length * 18 + activeRides.length * 8);
    const safetyScore = Math.max(0, 100 - urgentReports.length * 18 - openReports.length * 6 - suspendedUsers.length * 8);
    const financialScore = Math.min(100, revenue * 2 + completedBookings.length * 8);
    const operationsScore = Math.max(0, 100 - pendingPayouts.length * 4 - cancelledBookings.length * 5);
    const expansionScore = Math.min(100, activeRides.length * 10 + drivers.length * 8 + passengers.length * 2);
    const satisfactionScore = Math.max(0, 100 - cancelledBookings.length * 7 - openReports.length * 4);

    const globalScore = Math.round(
      (demandScore + supplyScore + safetyScore + financialScore + operationsScore + expansionScore + satisfactionScore) / 7
    );

    const decisions: Decision[] = [];

    if (urgentReports.length > 0) {
      decisions.push({
        id: "urgent-reports",
        icon: "🚨",
        title: "Resolve urgent safety reports",
        description: "Urgent reports can reduce trust and block launch readiness.",
        priority: "critical",
        category: "Safety",
        action: "Open Reports Center and resolve critical cases first.",
        href: "/admin/reports",
      });
    }

    if (drivers.length < 3) {
      decisions.push({
        id: "driver-supply",
        icon: "🚘",
        title: "Recruit more verified drivers",
        description: "Marketplace supply is too low for strong booking activity.",
        priority: "high",
        category: "Growth",
        action: "Recruit at least three to ten verified drivers in your first target city.",
        href: "/admin/verifications",
      });
    }

    if (activeRides.length < 3) {
      decisions.push({
        id: "active-rides",
        icon: "🛣️",
        title: "Increase active routes",
        description: "Passengers need available trips before paid promotion.",
        priority: "high",
        category: "Marketplace",
        action: "Push drivers to publish routes and seed key corridors.",
        href: "/admin/rides",
      });
    }

    if (completedBookings.length === 0) {
      decisions.push({
        id: "first-revenue",
        icon: "💰",
        title: "Complete first revenue cycle",
        description: "RoadLink needs completed bookings to validate marketplace value.",
        priority: "high",
        category: "Finance",
        action: "Test the full trip flow from booking to completed trip.",
        href: "/admin/bookings",
      });
    }

    if (cancelledBookings.length > completedBookings.length && bookings.length > 0) {
      decisions.push({
        id: "cancel-risk",
        icon: "📉",
        title: "Reduce cancellation risk",
        description: "Cancellations are higher than completed bookings.",
        priority: "medium",
        category: "Retention",
        action: "Add reminders, cancellation rules and reliability scoring.",
        href: "/admin/operations",
      });
    }

    if (pendingPayouts.length > 0) {
      decisions.push({
        id: "payouts",
        icon: "🏦",
        title: "Review pending payouts",
        description: "Pending driver payouts can affect driver trust.",
        priority: "medium",
        category: "Finance",
        action: "Review payout queue and approve valid requests.",
        href: "/admin/payouts",
      });
    }

    if (decisions.length === 0) {
      decisions.push({
        id: "scale",
        icon: "🚀",
        title: "Scale controlled launch",
        description: "No major blockers detected. Focus on route density and retention.",
        priority: "low",
        category: "Growth",
        action: "Launch a small campaign in your strongest city corridor.",
        href: "/admin/launch-readiness",
      });
    }

    return {
      drivers,
      passengers,
      suspendedUsers,
      activeRides,
      completedBookings,
      cancelledBookings,
      openReports,
      urgentReports,
      pendingPayouts,
      revenue,
      demandScore,
      supplyScore,
      safetyScore,
      financialScore,
      operationsScore,
      expansionScore,
      satisfactionScore,
      globalScore,
      decisions: decisions.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority)),
    };
  }, [users, rides, bookings, reports, payouts]);

  async function saveDailyReport() {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "aiDecisionReports"), {
        globalScore: ai.globalScore,
        demandScore: ai.demandScore,
        supplyScore: ai.supplyScore,
        safetyScore: ai.safetyScore,
        financialScore: ai.financialScore,
        operationsScore: ai.operationsScore,
        expansionScore: ai.expansionScore,
        satisfactionScore: ai.satisfactionScore,
        recommendations: ai.decisions,
        createdAt: now,
        createdBy: auth.currentUser?.email || "admin",
      });

      await addDoc(collection(db, "adminTasks"), {
        title: "Review AI Decision Report",
        description: `AI generated ${ai.decisions.length} recommendation(s).`,
        category: "ai",
        priority: ai.decisions.some((item) => item.priority === "critical") ? "critical" : "medium",
        status: "open",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "AI Decision Report Saved",
        targetType: "aiDecisionReport",
        details: `AI Decision Center saved report with global score ${ai.globalScore}.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("AI decision report saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save AI report.");
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/ai-predict" className="miniButton">AI Predict</Link>
          <Link href="/admin/mission-control" className="miniButton">Mission Control</Link>
          <Link href="/admin/business-intelligence" className="miniButton">Business Intelligence</Link>
          <Link href="/admin/tasks" className="miniButton">Tasks</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink AI Brain</p>
            <h1>AI Decision <span>Center</span></h1>
            <p className="subtitle">
              Prioritize growth, safety, pricing, supply, demand, risk and admin actions from one executive AI engine.
            </p>
          </div>

          <div className={ai.globalScore >= 75 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{ai.globalScore}</strong>
            <span>Global AI Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📈" label="Growth" value={`${ai.demandScore}%`} />
          <Metric icon="🚘" label="Supply" value={`${ai.supplyScore}%`} />
          <Metric icon="🛡️" label="Safety" value={`${ai.safetyScore}%`} danger={ai.safetyScore < 70} />
          <Metric icon="💰" label="Financial" value={`${ai.financialScore}%`} />
          <Metric icon="⚙️" label="Operations" value={`${ai.operationsScore}%`} />
          <Metric icon="🌎" label="Expansion" value={`${ai.expansionScore}%`} />
          <Metric icon="⭐" label="Satisfaction" value={`${ai.satisfactionScore}%`} />
          <Metric icon="🏦" label="Revenue" value={money(ai.revenue)} />
        </section>

        <section className="actionCard">
          <div>
            <p className="eyebrow">Executive AI Report</p>
            <h2>RoadLink Daily AI Summary</h2>
            <p>
              Save the current AI recommendations into Firestore and create an admin task for review.
            </p>
          </div>

          <button onClick={saveDailyReport} disabled={saving}>
            {saving ? "Saving..." : "Save AI Report"}
          </button>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Priority Engine</p>
            <h2>Recommended Actions</h2>

            <div className="decisionList">
              {ai.decisions.map((item) => (
                <Link key={item.id} href={item.href} className={`decision ${item.priority}`}>
                  <div className="decisionIcon">{item.icon}</div>

                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <small>{item.action}</small>
                  </div>

                  <em>{item.priority}</em>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Risk Engine</p>
            <h2>AI Risk Analysis</h2>

            <div className="infoGrid">
              <Info label="Urgent Reports" value={String(ai.urgentReports.length)} />
              <Info label="Open Reports" value={String(ai.openReports.length)} />
              <Info label="Suspended Users" value={String(ai.suspendedUsers.length)} />
              <Info label="Cancelled Bookings" value={String(ai.cancelledBookings.length)} />
              <Info label="Pending Payouts" value={String(ai.pendingPayouts.length)} />
              <Info label="Active Rides" value={String(ai.activeRides.length)} />
            </div>

            <div className={ai.safetyScore < 70 ? "summaryBox dangerBox" : "summaryBox"}>
              <strong>{ai.safetyScore < 70 ? "Risk needs attention" : "Risk is under control"}</strong>
              <p>
                {ai.safetyScore < 70
                  ? "Safety reports, cancellations or suspended users are lowering RoadLink's AI score."
                  : "No critical risk pattern is dominating the current platform state."}
              </p>
            </div>
          </section>
        </section>

        <section className="grid">
          <Panel title="Growth AI" eyebrow="Expansion" icon="🚀">
            <Info label="Users" value={String(users.length)} />
            <Info label="Passengers" value={String(ai.passengers.length)} />
            <Info label="Drivers" value={String(ai.drivers.length)} />
            <Info label="Active Routes" value={String(ai.activeRides.length)} />
          </Panel>

          <Panel title="Financial AI" eyebrow="Revenue" icon="💰">
            <Info label="Revenue" value={money(ai.revenue)} />
            <Info label="Completed Bookings" value={String(ai.completedBookings.length)} />
            <Info label="Pending Payouts" value={String(ai.pendingPayouts.length)} />
            <Info label="Financial Score" value={`${ai.financialScore}%`} />
          </Panel>
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
        .scoreOrb strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .actionCard p,
        .decision p,
        .decision small,
        .summaryBox p {
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

        .decisionList {
          display: grid;
          gap: 12px;
        }

        .decision {
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

        .decision.critical {
          border-color: rgba(239,68,68,0.4);
          background: rgba(127,29,29,0.22);
        }

        .decision.high {
          border-color: rgba(249,115,22,0.4);
          background: rgba(124,45,18,0.18);
        }

        .decision.medium {
          border-color: rgba(234,179,8,0.35);
          background: rgba(113,63,18,0.14);
        }

        .decision.low {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.08);
        }

        .decisionIcon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .decision strong,
        .decision p,
        .decision small {
          display: block;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .decision p {
          margin-top: 5px;
          font-size: 13px;
        }

        .decision small {
          margin-top: 5px;
          font-size: 12px;
        }

        .decision em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
          text-transform: capitalize;
        }

        .infoGrid,
        .infoStack {
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

        .summaryBox {
          padding: 20px;
          border-radius: 22px;
          margin-top: 18px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.28);
        }

        .dangerBox {
          background: rgba(127,29,29,0.18);
          border-color: rgba(239,68,68,0.35);
        }

        .summaryBox strong {
          display: block;
          color: #22c55e;
          margin-bottom: 8px;
        }

        .dangerBox strong {
          color: #fca5a5;
        }

        .panelIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
          margin-bottom: 14px;
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
          .infoGrid,
          .infoStack {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 {
            font-size: 46px;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .panel,
          .actionCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .infoGrid,
          .infoStack,
          .decision {
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

function priorityWeight(priority: string) {
  if (priority === "critical") return 1;
  if (priority === "high") return 2;
  if (priority === "medium") return 3;
  return 4;
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

function Panel({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panelIcon">{icon}</div>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <div className="infoStack">{children}</div>
    </section>
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
