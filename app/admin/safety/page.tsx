"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type RiskLevel = "low" | "medium" | "high" | "critical";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  suspended?: boolean;
  driverVerified?: boolean;
  fraudRiskLevel?: RiskLevel;
  driverRiskLevel?: RiskLevel;
};

type ReportItem = {
  id: string;
  reporterEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  reason?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
};

type EmergencyItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  priority?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

type DisputeItem = {
  id: string;
  userEmail?: string;
  driverEmail?: string;
  passengerEmail?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
};

type SafetyCase = {
  id: string;
  type: "sos" | "report" | "dispute" | "user";
  title: string;
  subtitle: string;
  priority: RiskLevel;
  status: string;
  createdAt: string;
  href: string;
};

export default function AdminSafetyPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [message, setMessage] = useState("Loading safety center...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubReports = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
      },
      () => setReports([])
    );

    const unsubEmergencies = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        setEmergencies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyItem[]);
      },
      () => setEmergencies([])
    );

    const unsubDisputes = onSnapshot(
      query(collection(db, "disputes")),
      (snapshot) => {
        setDisputes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as DisputeItem[]);
      },
      () => setDisputes([])
    );

    return () => {
      unsubUsers();
      unsubReports();
      unsubEmergencies();
      unsubDisputes();
    };
  }, []);

  const safety = useMemo(() => {
    const activeSOS = emergencies.filter((item) => item.status === "active");
    const criticalSOS = activeSOS.filter((item) => item.priority === "critical" || !item.priority);

    const openReports = reports.filter((item) => !item.status || item.status === "open");
    const urgentReports = openReports.filter(
      (item) => item.priority === "urgent" || item.priority === "critical"
    );

    const openDisputes = disputes.filter((item) => !item.status || item.status === "open");
    const urgentDisputes = openDisputes.filter(
      (item) => item.priority === "urgent" || item.priority === "critical"
    );

    const suspendedUsers = users.filter((item) => item.suspended);
    const riskyUsers = users.filter(
      (item) =>
        item.fraudRiskLevel === "high" ||
        item.fraudRiskLevel === "critical" ||
        item.driverRiskLevel === "high" ||
        item.driverRiskLevel === "critical"
    );

    let safetyScore = 100;

    safetyScore -= criticalSOS.length * 25;
    safetyScore -= activeSOS.length * 15;
    safetyScore -= urgentReports.length * 8;
    safetyScore -= urgentDisputes.length * 8;
    safetyScore -= riskyUsers.length * 4;
    safetyScore -= suspendedUsers.length * 2;

    safetyScore = Math.max(safetyScore, 0);

    const cases: SafetyCase[] = [
      ...activeSOS.map(
        (item): SafetyCase => ({
          id: `sos-${item.id}`,
          type: "sos",
          title: item.userEmail || "Active SOS Alert",
          subtitle: item.latitude && item.longitude ? "Location available" : "Location missing",
          priority: "critical",
          status: item.status || "active",
          createdAt: item.createdAt || "",
          href: "/admin/emergency",
        })
      ),
      ...openReports.map(
        (item): SafetyCase => ({
          id: `report-${item.id}`,
          type: "report",
          title: item.reason || "Safety Report",
          subtitle: item.targetUserEmail || item.reporterEmail || "User report",
          priority: normalizePriority(item.priority),
          status: item.status || "open",
          createdAt: item.createdAt || "",
          href: "/admin/reports",
        })
      ),
      ...openDisputes.map(
        (item): SafetyCase => ({
          id: `dispute-${item.id}`,
          type: "dispute",
          title: "Open Dispute",
          subtitle: item.userEmail || item.driverEmail || item.passengerEmail || "Dispute case",
          priority: normalizePriority(item.priority),
          status: item.status || "open",
          createdAt: item.createdAt || "",
          href: "/admin/disputes",
        })
      ),
      ...riskyUsers.map(
        (item): SafetyCase => ({
          id: `user-${item.id}`,
          type: "user",
          title: item.name || "Risk User",
          subtitle: item.email || item.id,
          priority:
            item.fraudRiskLevel === "critical" || item.driverRiskLevel === "critical"
              ? "critical"
              : "high",
          status: item.suspended ? "suspended" : "review",
          createdAt: "",
          href: "/admin/user-intelligence",
        })
      ),
    ];

    return {
      activeSOS,
      criticalSOS,
      openReports,
      urgentReports,
      openDisputes,
      urgentDisputes,
      suspendedUsers,
      riskyUsers,
      safetyScore,
      cases: cases.sort(
        (a, b) =>
          priorityWeight(b.priority) - priorityWeight(a.priority) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    };
  }, [users, reports, emergencies, disputes]);

  async function activateEmergencyMode() {
    const confirmed = window.confirm("Activate emergency mode for RoadLink?");
    if (!confirmed) return;

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "platformSettings", "main"),
        {
          emergencyMode: true,
          allowBookings: false,
          allowNewRides: false,
          allowPayouts: false,
          platformNotice: "RoadLink is temporarily under safety review.",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `safety-emergency-${Date.now()}`),
        {
          userId: "admin",
          userEmail: "admin@getroadlink.com",
          action: "Emergency Mode Activated",
          targetId: "platformSettings/main",
          targetType: "platformSettings",
          details: "Safety Center activated emergency restrictions.",
          severity: "danger",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Emergency mode activated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not activate emergency mode.");
    } finally {
      setSaving(false);
    }
  }

  async function restoreNormalMode() {
    const confirmed = window.confirm("Restore normal RoadLink safety operations?");
    if (!confirmed) return;

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "platformSettings", "main"),
        {
          emergencyMode: false,
          allowBookings: true,
          allowNewRides: true,
          allowPayouts: true,
          platformNotice: "",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `safety-normal-${Date.now()}`),
        {
          userId: "admin",
          userEmail: "admin@getroadlink.com",
          action: "Normal Mode Restored",
          targetId: "platformSettings/main",
          targetType: "platformSettings",
          details: "Safety Center restored normal platform operations.",
          severity: "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Normal operations restored.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not restore normal mode.");
    } finally {
      setSaving(false);
    }
  }

  function statusText() {
    if (safety.criticalSOS.length > 0) return "Critical";
    if (safety.safetyScore >= 90) return "Safe";
    if (safety.safetyScore >= 75) return "Watch";
    if (safety.safetyScore >= 60) return "Review";
    return "Danger";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/platform-control" className="miniButton">Platform Control</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Safety</p>
            <h1>Safety <span>Center</span></h1>
            <p className="subtitle">
              Monitor emergency alerts, reports, disputes, risky users, suspended users and safety operations.
            </p>
          </div>

          <div className={safety.safetyScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{safety.safetyScore}</strong>
            <span>{statusText()}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className={safety.criticalSOS.length > 0 ? "statusCard dangerStatus" : "statusCard"}>
          <div className="liveDot"></div>
          <div>
            <strong>{statusText()}</strong>
            <span>
              {safety.criticalSOS.length > 0
                ? "Critical emergency alerts require immediate action."
                : "Safety monitoring is active."}
            </span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="🚨" label="Active SOS" value={String(safety.activeSOS.length)} danger={safety.activeSOS.length > 0} />
          <Metric icon="🔥" label="Critical SOS" value={String(safety.criticalSOS.length)} danger={safety.criticalSOS.length > 0} />
          <Metric icon="⚠️" label="Open Reports" value={String(safety.openReports.length)} danger={safety.openReports.length > 0} />
          <Metric icon="⚖️" label="Open Disputes" value={String(safety.openDisputes.length)} danger={safety.openDisputes.length > 0} />
          <Metric icon="🕵️" label="Risky Users" value={String(safety.riskyUsers.length)} danger={safety.riskyUsers.length > 0} />
          <Metric icon="⛔" label="Suspended" value={String(safety.suspendedUsers.length)} danger={safety.suspendedUsers.length > 0} />
        </section>

        <section className="actionCard">
          <div>
            <p className="eyebrow">Emergency Controls</p>
            <h2>Safety Lockdown</h2>
            <p>Emergency mode pauses bookings, new rides and payouts while keeping safety review active.</p>
          </div>

          <div className="actionButtons">
            <button className="dangerButton" onClick={activateEmergencyMode} disabled={saving}>
              Activate Emergency Mode
            </button>
            <button className="safeButton" onClick={restoreNormalMode} disabled={saving}>
              Restore Normal Mode
            </button>
          </div>
        </section>

        <section className="gridTwo">
          <Panel title="Priority Safety Queue" eyebrow="Realtime Cases" icon="📡" danger={safety.cases.some((item) => item.priority === "critical" || item.priority === "high")}>
            {safety.cases.length === 0 ? (
              <div className="empty">
                <h3>No safety cases</h3>
                <p>Safety queue is clear right now.</p>
              </div>
            ) : (
              <div className="list">
                {safety.cases.slice(0, 14).map((item) => (
                  <Link key={item.id} href={item.href} className={item.priority === "critical" || item.priority === "high" ? "row dangerRow" : "row"}>
                    <div className="rowIcon">{iconFor(item.type)}</div>
                    <div className="rowText">
                      <strong>{shortText(item.title)}</strong>
                      <span>{shortText(item.subtitle)}</span>
                    </div>
                    <em className={`priority ${item.priority}`}>{item.priority}</em>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Safety Snapshot" eyebrow="Trust Overview" icon="🛡️" danger={safety.safetyScore < 80}>
            <Info label="Safety Score" value={String(safety.safetyScore)} />
            <Info label="Status" value={statusText()} />
            <Info label="Urgent Reports" value={String(safety.urgentReports.length)} />
            <Info label="Urgent Disputes" value={String(safety.urgentDisputes.length)} />
            <Info label="Total Safety Cases" value={String(safety.cases.length)} />
            <Info label="Users Monitored" value={String(users.length)} />
          </Panel>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Safety Shortcuts</p>
          <h2>Open Safety Tools</h2>

          <div className="quickLinks">
            <Link href="/admin/emergency">🚨 Emergency Center</Link>
            <Link href="/admin/reports">⚠️ Reports</Link>
            <Link href="/admin/disputes">⚖️ Disputes</Link>
            <Link href="/admin/fraud">🕵️ Fraud</Link>
            <Link href="/admin/driver-risk">🚘 Driver Risk</Link>
            <Link href="/admin/user-intelligence">👥 User Intelligence</Link>
            <Link href="/admin/platform-control">🎛️ Platform Control</Link>
            <Link href="/admin/logs">🧾 Audit Logs</Link>
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 16px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
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
        .statusCard,
        .actionCard,
        .panel,
        .quickCard {
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
        .metricValue {
          color: #22c55e;
        }

        h2 {
          margin: 0;
          font-size: 24px;
        }

        .subtitle,
        .actionCard p,
        .empty p {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
        }

        .scoreOrb {
          min-width: 84px;
          width: 84px;
          height: 84px;
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
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 9px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .statusCard {
          border-radius: 18px;
          padding: 14px;
          display: grid;
          grid-template-columns: 14px 1fr;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .dangerStatus,
        .dangerPanel {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 40%),
            rgba(8,13,25,0.92);
        }

        .liveDot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 1.3s infinite;
        }

        .dangerStatus .liveDot {
          background: #ef4444;
        }

        .statusCard strong,
        .statusCard span {
          display: block;
        }

        .statusCard span {
          color: #a1a1aa;
          font-size: 12px;
          margin-top: 3px;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 16px;
          padding: 11px;
          min-height: 58px;
          display: grid;
          grid-template-columns: 34px 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

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

        .dangerMetric .metricIcon {
          background: rgba(239,68,68,0.16);
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .metricValue {
          font-size: 19px;
          font-weight: 900;
        }

        .actionCard {
          border-radius: 22px;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-bottom: 12px;
        }

        .actionButtons {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .dangerButton,
        .safeButton {
          border: none;
          border-radius: 999px;
          padding: 13px;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        .safeButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .gridTwo {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .panel,
        .quickCard {
          border-radius: 22px;
          padding: 16px;
          overflow: hidden;
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

        .list,
        .infoStack {
          display: grid;
          gap: 8px;
        }

        .row,
        .infoBox {
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .row {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          gap: 10px;
          padding: 12px;
          color: white;
          text-decoration: none;
          align-items: center;
        }

        .dangerRow {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .rowIcon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .dangerRow .rowIcon {
          background: rgba(239,68,68,0.16);
        }

        .rowText {
          min-width: 0;
        }

        .rowText strong,
        .rowText span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rowText strong {
          font-size: 13px;
        }

        .rowText span {
          color: #a1a1aa;
          font-size: 11px;
        }

        .priority {
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 10px;
          font-style: normal;
          font-weight: 900;
          text-transform: capitalize;
        }

        .priority.critical,
        .priority.high {
          color: #fca5a5;
          background: rgba(239,68,68,0.14);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .priority.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.14);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .priority.low {
          color: #22c55e;
          background: rgba(34,197,94,0.14);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .infoBox {
          padding: 12px;
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
          margin-top: 14px;
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

        @media (max-width: 430px) {
          h1 {
            font-size: 31px;
          }

          .row {
            grid-template-columns: 40px 1fr;
          }

          .priority {
            grid-column: 2;
            width: fit-content;
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

          .stats {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }

          .actionCard {
            grid-template-columns: 1fr auto;
            align-items: center;
          }

          .actionButtons {
            grid-template-columns: 1fr 1fr;
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

function normalizePriority(value?: string): RiskLevel {
  if (value === "critical") return "critical";
  if (value === "urgent" || value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function priorityWeight(value: RiskLevel) {
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function iconFor(type: SafetyCase["type"]) {
  if (type === "sos") return "🚨";
  if (type === "report") return "⚠️";
  if (type === "dispute") return "⚖️";
  return "👥";
}

function shortText(value: string, max = 42) {
  if (!value) return "Not available";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
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
