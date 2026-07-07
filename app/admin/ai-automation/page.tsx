"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type AutomationRule = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  risk?: "low" | "medium" | "high" | "critical";
  trigger?: string;
  action?: string;
  runs?: number;
  lastRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type UserItem = {
  id: string;
  driverVerified?: boolean;
  suspended?: boolean;
};

type RideItem = {
  id: string;
  status?: string;
};

type BookingItem = {
  id: string;
  status?: string;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
};

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "driver-recruiting",
    title: "Driver Recruiting Campaign",
    description: "Launch recruiting when verified driver supply is low.",
    category: "growth",
    enabled: true,
    risk: "medium",
    trigger: "Verified drivers below 5",
    action: "Create driver recruiting task",
  },
  {
    id: "low-bookings-coupon",
    title: "Low Booking Coupon",
    description: "Create a promo task when booking activity drops.",
    category: "marketing",
    enabled: true,
    risk: "low",
    trigger: "Bookings below target",
    action: "Create coupon campaign task",
  },
  {
    id: "critical-report-escalation",
    title: "Critical Report Escalation",
    description: "Escalate urgent safety reports automatically.",
    category: "safety",
    enabled: true,
    risk: "critical",
    trigger: "Urgent report detected",
    action: "Create critical admin task",
  },
  {
    id: "inactive-user-campaign",
    title: "Inactive User Campaign",
    description: "Create reactivation campaign tasks for inactive users.",
    category: "retention",
    enabled: false,
    risk: "low",
    trigger: "Inactive users detected",
    action: "Create reactivation task",
  },
  {
    id: "daily-ai-report",
    title: "Daily AI Admin Report",
    description: "Generate daily AI summary for administrators.",
    category: "ai",
    enabled: true,
    risk: "medium",
    trigger: "Daily schedule",
    action: "Save AI automation report",
  },
  {
    id: "incident-auto-escalation",
    title: "Incident Auto Escalation",
    description: "Escalate platform problems when risk is high.",
    category: "operations",
    enabled: true,
    risk: "high",
    trigger: "Risk score high",
    action: "Create incident task",
  },
];

export default function AdminAIAutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [message, setMessage] = useState("Loading AI automation...");
  const [runningId, setRunningId] = useState("");

  useEffect(() => {
    const unsubRules = onSnapshot(query(collection(db, "aiAutomationRules")), async (snapshot) => {
      if (snapshot.empty) {
        const now = new Date().toISOString();

        await Promise.all(
          DEFAULT_RULES.map((rule) =>
            setDoc(doc(db, "aiAutomationRules", rule.id), {
              ...rule,
              runs: 0,
              createdAt: now,
              updatedAt: now,
            })
          )
        );

        return;
      }

      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as AutomationRule[];

      setRules(data.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""))));
      setMessage("");
    });

    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
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

    return () => {
      unsubRules();
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
    };
  }, []);

  const ai = useMemo(() => {
    const enabled = rules.filter((rule) => rule.enabled);
    const disabled = rules.filter((rule) => !rule.enabled);
    const critical = rules.filter((rule) => rule.risk === "critical");
    const verifiedDrivers = users.filter((user) => user.driverVerified);
    const suspendedUsers = users.filter((user) => user.suspended);
    const activeRides = rides.filter((ride) =>
      ["active", "open", "full", "in_progress"].includes(String(ride.status || ""))
    );
    const activeBookings = bookings.filter((booking) =>
      ["pending", "reserved", "confirmed"].includes(String(booking.status || ""))
    );
    const completedBookings = bookings.filter((booking) => booking.status === "completed");
    const urgentReports = reports.filter(
      (report) => report.priority === "urgent" || report.priority === "critical"
    );

    const riskScore = Math.max(
      0,
      Math.min(
        100,
        urgentReports.length * 22 +
          suspendedUsers.length * 10 +
          Math.max(0, 5 - verifiedDrivers.length) * 8 +
          Math.max(0, 3 - activeRides.length) * 6
      )
    );

    const automationHealth = Math.max(
      0,
      Math.min(100, 80 + enabled.length * 4 - urgentReports.length * 8 - disabled.length * 2)
    );

    return {
      enabled,
      disabled,
      critical,
      verifiedDrivers,
      suspendedUsers,
      activeRides,
      activeBookings,
      completedBookings,
      urgentReports,
      riskScore,
      automationHealth,
    };
  }, [rules, users, rides, bookings, reports]);

  async function toggleRule(rule: AutomationRule) {
    const now = new Date().toISOString();

    await setDoc(
      doc(db, "aiAutomationRules", rule.id),
      {
        ...rule,
        enabled: !rule.enabled,
        updatedAt: now,
      },
      { merge: true }
    );

    await addDoc(collection(db, "auditLogs"), {
      action: "AI Automation Rule Updated",
      targetType: "aiAutomationRule",
      targetId: rule.id,
      details: `${rule.title || rule.id} ${!rule.enabled ? "enabled" : "disabled"}.`,
      severity: "info",
      adminEmail: auth.currentUser?.email || "",
      createdAt: now,
      resolved: true,
    });
  }

  async function runRule(rule: AutomationRule) {
    try {
      setRunningId(rule.id);
      setMessage("");

      const now = new Date().toISOString();
      let taskTitle = rule.title || "AI Automation";
      let taskDescription = rule.description || "AI automation executed.";

      if (rule.id === "driver-recruiting") {
        taskTitle = "Recruit more verified drivers";
        taskDescription = `AI detected ${ai.verifiedDrivers.length} verified driver(s). Recruit more drivers before scaling.`;
      }

      if (rule.id === "low-bookings-coupon") {
        taskTitle = "Launch booking coupon campaign";
        taskDescription = `AI detected ${ai.activeBookings.length} active booking(s). Create a coupon to increase reservations.`;
      }

      if (rule.id === "critical-report-escalation") {
        taskTitle = "Resolve urgent safety reports";
        taskDescription = `AI detected ${ai.urgentReports.length} urgent report(s). Review immediately.`;
      }

      await addDoc(collection(db, "adminTasks"), {
        title: taskTitle,
        description: taskDescription,
        category: rule.category || "ai",
        priority:
          rule.risk === "critical" ? "critical" : rule.risk === "high" ? "high" : "medium",
        status: "open",
        source: "ai-automation",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "aiAutomationHistory"), {
        ruleId: rule.id,
        ruleTitle: rule.title || rule.id,
        status: "completed",
        action: rule.action || "Automation executed",
        createdAt: now,
        createdBy: auth.currentUser?.email || "admin",
      });

      await setDoc(
        doc(db, "aiAutomationRules", rule.id),
        {
          runs: Number(rule.runs || 0) + 1,
          lastRunAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "AI Automation Executed",
        targetType: "aiAutomationRule",
        targetId: rule.id,
        details: `${rule.title || rule.id} executed.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage(`${rule.title || "Automation"} executed.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not run automation.");
    } finally {
      setRunningId("");
    }
  }

  async function runAllEnabled() {
    for (const rule of rules.filter((item) => item.enabled)) {
      await runRule(rule);
    }
  }

  function riskClass(risk?: string) {
    if (risk === "critical") return "pill critical";
    if (risk === "high") return "pill high";
    if (risk === "medium") return "pill medium";
    return "pill low";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/automation-center" className="miniButton">Automation Center</Link>
          <Link href="/admin/ai-decision-center" className="miniButton">AI Decision</Link>
          <Link href="/admin/ai-copilot" className="miniButton">AI Copilot</Link>
          <Link href="/admin/tasks" className="miniButton">Tasks</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink AI Operations</p>
            <h1>AI <span>Automation</span></h1>
            <p className="subtitle">
              Automate driver recruiting, safety escalations, coupon campaigns,
              admin reports, retention tasks and operational decisions.
            </p>
          </div>

          <div className={ai.automationHealth >= 75 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{ai.automationHealth}</strong>
            <span>Automation Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🤖" label="Rules" value={String(rules.length)} />
          <Metric icon="🟢" label="Enabled" value={String(ai.enabled.length)} />
          <Metric icon="⛔" label="Disabled" value={String(ai.disabled.length)} />
          <Metric icon="🚨" label="Critical Rules" value={String(ai.critical.length)} />
          <Metric icon="🚘" label="Drivers" value={String(ai.verifiedDrivers.length)} />
          <Metric icon="🛣️" label="Active Rides" value={String(ai.activeRides.length)} />
          <Metric icon="🎟️" label="Active Bookings" value={String(ai.activeBookings.length)} />
          <Metric icon="⚠️" label="Risk Score" value={`${ai.riskScore}%`} danger={ai.riskScore >= 50} />
        </section>

        <section className="actionCard">
          <div>
            <p className="eyebrow">Manual AI Run</p>
            <h2>Run Enabled Automations</h2>
            <p>
              Executes all active AI automation rules and creates admin tasks when action is needed.
            </p>
          </div>

          <button onClick={runAllEnabled} disabled={Boolean(runningId)}>
            {runningId ? "Running..." : "Run All Enabled"}
          </button>
        </section>

        <section className="grid">
          {rules.map((rule) => (
            <article key={rule.id} className={rule.enabled ? "ruleCard enabled" : "ruleCard"}>
              <div className="ruleTop">
                <div>
                  <p className="eyebrow">{rule.category || "AI"}</p>
                  <h2>{rule.title || "Automation Rule"}</h2>
                </div>

                <span className={riskClass(rule.risk)}>{rule.risk || "low"}</span>
              </div>

              <p className="description">{rule.description}</p>

              <div className="infoGrid">
                <Info label="Trigger" value={rule.trigger || "Not configured"} />
                <Info label="Action" value={rule.action || "Not configured"} />
                <Info label="Runs" value={String(rule.runs || 0)} />
                <Info label="Last Run" value={rule.lastRunAt || "Never"} />
              </div>

              <div className="actions">
                <button onClick={() => runRule(rule)} disabled={runningId === rule.id}>
                  {runningId === rule.id ? "Running..." : "Run"}
                </button>

                <button
                  className={rule.enabled ? "dangerButton" : "secondaryButton"}
                  onClick={() => toggleRule(rule)}
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </article>
          ))}
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
        .actionCard,
        .ruleCard {
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
          font-size: 28px;
          margin: 0 0 12px;
        }

        .subtitle,
        .description,
        .actionCard p {
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

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .ruleCard {
          border-radius: 28px;
          padding: 24px;
        }

        .ruleCard.enabled {
          border-color: rgba(34,197,94,0.35);
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.10), transparent 38%),
            rgba(8,13,25,0.92);
        }

        .ruleTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .pill {
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-transform: capitalize;
        }

        .critical {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .high {
          color: #fb923c;
          background: rgba(249,115,22,0.12);
          border: 1px solid rgba(249,115,22,0.35);
        }

        .medium {
          color: #fde68a;
          background: rgba(234,179,8,0.12);
          border: 1px solid rgba(234,179,8,0.35);
        }

        .low {
          color: #86efac;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin: 16px 0;
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

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
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

        .secondaryButton {
          background: rgba(59,130,246,0.18);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1050px) {
          .hero,
          .actionCard,
          .grid {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 { font-size: 46px; }
        }

        @media (max-width: 650px) {
          .page { padding: 16px; padding-bottom: 120px; }

          .hero,
          .actionCard,
          .ruleCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .infoGrid,
          .actions {
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
