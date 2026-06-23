"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  suspended?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  verificationStatus?: string;
  trustScore?: number;
  safetyScore?: number;
  reportsCount?: number;
  fraudScore?: number;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  reporterEmail?: string;
  reportedEmail?: string;
  targetUserId?: string;
  type?: string;
  category?: string;
  status?: string;
  severity?: string;
  message?: string;
  createdAt?: string;
};

type SOSEvent = {
  id: string;
  email?: string;
  userId?: string;
  status?: string;
  severity?: string;
  message?: string;
  createdAt?: string;
};

type VerificationItem = {
  id: string;
  email?: string;
  userId?: string;
  status?: string;
  verificationStatus?: string;
  type?: string;
  createdAt?: string;
};

type FraudItem = {
  id: string;
  email?: string;
  userId?: string;
  status?: string;
  riskLevel?: string;
  fraudScore?: number;
  reason?: string;
  createdAt?: string;
};

export default function AdminTrustSafetyCenterPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [fraudSignals, setFraudSignals] = useState<FraudItem[]>([]);
  const [message, setMessage] = useState("Loading Trust & Safety center...");
  const [processingId, setProcessingId] = useState("");

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => {
          setter([]);
          setMessage("");
        }
      );

    const unsubUsers = listen<UserItem>("users", setUsers);
    const unsubReports = listen<ReportItem>("reports", setReports);
    const unsubSOS = listen<SOSEvent>("sosEvents", setSosEvents);
    const unsubVerifications = listen<VerificationItem>("driverVerifications", setVerifications);
    const unsubFraud = listen<FraudItem>("fraudSignals", setFraudSignals);

    return () => {
      unsubUsers();
      unsubReports();
      unsubSOS();
      unsubVerifications();
      unsubFraud();
    };
  }, []);

  const metrics = useMemo(() => {
    const suspendedUsers = users.filter((item) => item.suspended || item.status === "suspended");
    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified || item.verificationStatus === "approved");

    const openReports = reports.filter((item) => !item.status || item.status === "open");
    const criticalReports = reports.filter((item) => item.severity === "critical" || item.severity === "high");
    const resolvedReports = reports.filter((item) => item.status === "resolved" || item.status === "closed");

    const activeSOS = sosEvents.filter((item) => !item.status || item.status === "open" || item.status === "active");
    const criticalSOS = sosEvents.filter((item) => item.severity === "critical" || item.severity === "high");

    const pendingVerifications = verifications.filter(
      (item) => !item.status || item.status === "pending" || item.verificationStatus === "pending"
    );

    const approvedVerifications = verifications.filter(
      (item) => item.status === "approved" || item.verificationStatus === "approved"
    );

    const highFraud = fraudSignals.filter(
      (item) => item.riskLevel === "high" || item.riskLevel === "critical" || Number(item.fraudScore || 0) >= 70
    );

    const openFraud = fraudSignals.filter((item) => !item.status || item.status === "open" || item.status === "review");

    const averageTrust =
      users.length > 0
        ? Math.round(
            users.reduce(
              (total, item) => total + Number(item.trustScore || item.safetyScore || 65),
              0
            ) / users.length
          )
        : 0;

    const safetyScore = Math.max(
      Math.min(
        100 +
          verifiedDrivers.length * 2 +
          approvedVerifications.length * 2 +
          resolvedReports.length -
          suspendedUsers.length * 8 -
          openReports.length * 6 -
          criticalReports.length * 8 -
          activeSOS.length * 12 -
          criticalSOS.length * 15 -
          highFraud.length * 12 -
          pendingVerifications.length * 2,
        100
      ),
      0
    );

    return {
      suspendedUsers,
      verifiedDrivers,
      openReports,
      criticalReports,
      resolvedReports,
      activeSOS,
      criticalSOS,
      pendingVerifications,
      approvedVerifications,
      highFraud,
      openFraud,
      averageTrust,
      safetyScore,
    };
  }, [users, reports, sosEvents, verifications, fraudSignals]);

  async function suspendUser(user: UserItem) {
    try {
      setProcessingId(user.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", user.id),
        {
          suspended: true,
          status: "suspended",
          safetyStatus: "suspended",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `safety-suspend-${user.id}-${Date.now()}`),
        {
          action: "User Suspended",
          targetId: user.id,
          targetType: "user",
          details: `${user.email || "User"} suspended by Trust & Safety.`,
          severity: "warning",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("User suspended.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not suspend user.");
    } finally {
      setProcessingId("");
    }
  }

  async function restoreUser(user: UserItem) {
    try {
      setProcessingId(user.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", user.id),
        {
          suspended: false,
          status: "active",
          safetyStatus: "clear",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `safety-restore-${user.id}-${Date.now()}`),
        {
          action: "User Restored",
          targetId: user.id,
          targetType: "user",
          details: `${user.email || "User"} restored by Trust & Safety.`,
          severity: "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("User restored.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not restore user.");
    } finally {
      setProcessingId("");
    }
  }

  async function updateReport(report: ReportItem, status: string) {
    try {
      setProcessingId(report.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "reports", report.id),
        {
          status,
          updatedAt: now,
          ...(status === "resolved" || status === "closed" ? { resolvedAt: now } : {}),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `safety-report-${report.id}-${Date.now()}`),
        {
          action: "Safety Report Updated",
          targetId: report.id,
          targetType: "report",
          details: `Report changed to ${status}`,
          severity: status === "resolved" ? "success" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Report updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update report.");
    } finally {
      setProcessingId("");
    }
  }

  async function updateVerification(item: VerificationItem, status: string) {
    try {
      setProcessingId(item.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "driverVerifications", item.id),
        {
          status,
          verificationStatus: status,
          updatedAt: now,
        },
        { merge: true }
      );

      if (item.userId) {
        await setDoc(
          doc(db, "users", item.userId),
          {
            driverVerified: status === "approved",
            verificationStatus: status,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      await setDoc(
        doc(db, "auditLogs", `safety-verification-${item.id}-${Date.now()}`),
        {
          action: "Driver Verification Updated",
          targetId: item.id,
          targetType: "driverVerification",
          details: `Verification changed to ${status}`,
          severity: status === "approved" ? "success" : status === "rejected" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Verification updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update verification.");
    } finally {
      setProcessingId("");
    }
  }

  function statusClass(status?: string, severity?: string) {
    if (status === "resolved" || status === "closed" || status === "approved" || status === "active") return "good";
    if (status === "suspended" || status === "rejected" || severity === "critical" || severity === "high") return "bad";
    return "pending";
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/emergency" className="miniButton">Emergency</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/verification-queue" className="miniButton">Verification Queue</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Trust & Safety</p>
            <h1>Trust & <span>Safety</span></h1>
            <p className="subtitle">
              Monitor SOS, reports, suspended users, driver verification, fraud signals,
              incidents, safety scores and platform protection.
            </p>
          </div>

          <div className={metrics.safetyScore >= 70 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.safetyScore}</strong>
            <span>Safety Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🛡️" label="Average Trust" value={`${metrics.averageTrust}/100`} />
          <Metric icon="🚫" label="Suspended Users" value={String(metrics.suspendedUsers.length)} />
          <Metric icon="✅" label="Verified Drivers" value={String(metrics.verifiedDrivers.length)} />
          <Metric icon="📋" label="Open Reports" value={String(metrics.openReports.length)} />
          <Metric icon="🚨" label="Active SOS" value={String(metrics.activeSOS.length)} />
          <Metric icon="⚠️" label="Critical Incidents" value={String(metrics.criticalReports.length + metrics.criticalSOS.length)} />
          <Metric icon="🔎" label="Pending Verifications" value={String(metrics.pendingVerifications.length)} />
          <Metric icon="🧠" label="Fraud Signals" value={String(metrics.highFraud.length)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Safety Risk</p>
            <h2>High Priority Signals</h2>

            <div className="riskList">
              <Risk label="Open Reports" value={metrics.openReports.length} />
              <Risk label="Active SOS" value={metrics.activeSOS.length} />
              <Risk label="High Fraud" value={metrics.highFraud.length} />
              <Risk label="Suspensions" value={metrics.suspendedUsers.length} />
              <Risk label="Pending Verification" value={metrics.pendingVerifications.length} />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Safety Actions</p>
            <h2>Operations Links</h2>

            <div className="linkGrid">
              <Link href="/admin/emergency" className="actionLink">Emergency Command</Link>
              <Link href="/admin/fraud" className="actionLink">Fraud Detection</Link>
              <Link href="/admin/reports" className="actionLink">Reports Center</Link>
              <Link href="/admin/verification-queue" className="actionLink">Verification Queue</Link>
              <Link href="/admin/live-map" className="actionLink">Live Map</Link>
              <Link href="/admin/dispatch" className="actionLink">Dispatch</Link>
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">User Safety Control</p>
          <h2>Users & Suspensions</h2>

          {users.length === 0 ? (
            <div className="empty">
              <h3>No users found</h3>
              <p>Users will appear here when accounts are created.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {users.slice(0, 40).map((user) => (
                <section key={user.id} className="itemCard">
                  <div className="cardTop">
                    <div>
                      <h3>{user.name || user.email || "User"}</h3>
                      <p>{user.role || "member"} • Trust {Number(user.trustScore || user.safetyScore || 65)}/100</p>
                    </div>

                    <span className={`pill ${statusClass(user.suspended ? "suspended" : user.status)}`}>
                      {user.suspended ? "Suspended" : user.status || "Active"}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Email" value={user.email || "Not available"} />
                    <Info label="Driver Verified" value={user.driverVerified || user.verified ? "Yes" : "No"} />
                    <Info label="Reports" value={String(user.reportsCount || 0)} />
                    <Info label="Fraud Score" value={`${Number(user.fraudScore || 0)}/100`} />
                  </div>

                  <div className="actions">
                    {!user.suspended ? (
                      <button className="dangerButton" onClick={() => suspendUser(user)} disabled={processingId === user.id}>
                        Suspend
                      </button>
                    ) : (
                      <button className="goodButton" onClick={() => restoreUser(user)} disabled={processingId === user.id}>
                        Restore
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Incident Review</p>
          <h2>Reports</h2>

          {reports.length === 0 ? (
            <div className="empty">
              <h3>No reports found</h3>
              <p>User reports and incidents will appear here.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {reports.slice(0, 30).map((report) => (
                <section key={report.id} className="itemCard">
                  <div className="cardTop">
                    <div>
                      <h3>{report.type || report.category || "Safety Report"}</h3>
                      <p>{report.message || "No message provided"}</p>
                    </div>

                    <span className={`pill ${statusClass(report.status, report.severity)}`}>
                      {report.status || "open"}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Reporter" value={report.reporterEmail || "Not available"} />
                    <Info label="Reported" value={report.reportedEmail || "Not available"} />
                    <Info label="Severity" value={report.severity || "medium"} />
                    <Info label="Created" value={formatDate(report.createdAt)} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateReport(report, "reviewing")} disabled={processingId === report.id}>
                      Review
                    </button>
                    <button className="goodButton" onClick={() => updateReport(report, "resolved")} disabled={processingId === report.id}>
                      Resolve
                    </button>
                    <button className="dangerButton" onClick={() => updateReport(report, "closed")} disabled={processingId === report.id}>
                      Close
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Driver Verification Safety</p>
          <h2>Pending Verifications</h2>

          {metrics.pendingVerifications.length === 0 ? (
            <div className="empty">
              <h3>No pending verifications</h3>
              <p>Driver verification requests will appear here.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {metrics.pendingVerifications.map((item) => (
                <section key={item.id} className="itemCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.email || "Driver Verification"}</h3>
                      <p>{item.type || "driver"} • {formatDate(item.createdAt)}</p>
                    </div>

                    <span className="pill pending">Pending</span>
                  </div>

                  <div className="actions">
                    <button className="goodButton" onClick={() => updateVerification(item, "approved")} disabled={processingId === item.id}>
                      Approve
                    </button>
                    <button className="dangerButton" onClick={() => updateVerification(item, "rejected")} disabled={processingId === item.id}>
                      Reject
                    </button>
                    <button onClick={() => updateVerification(item, "reviewing")} disabled={processingId === item.id}>
                      Review
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
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
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1450px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton,
        .actionLink {
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
        .panel,
        .itemCard {
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

        .subtitle,
        .empty p,
        .itemCard p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
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
          background: rgba(239,68,68,0.14);
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
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        .panel {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .riskList,
        .linkGrid {
          display: grid;
          gap: 12px;
        }

        .riskBox {
          padding: 14px;
          border-radius: 18px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .riskBox span {
          color: #a1a1aa;
          font-weight: 900;
        }

        .riskBox strong {
          color: #22c55e;
          font-size: 22px;
        }

        .actionLink {
          display: block;
          text-align: center;
        }

        .cardGrid {
          display: grid;
          gap: 16px;
        }

        .itemCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .itemCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .itemCard p {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.pending {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .pill.bad {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
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

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .actions button {
          padding: 12px 16px;
          border-radius: 999px;
          border: none;
          font-weight: 900;
          color: white;
          cursor: pointer;
          background: rgba(59,130,246,0.14);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .actions .goodButton {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.35);
        }

        .actions .dangerButton {
          background: rgba(239,68,68,0.14);
          border-color: rgba(239,68,68,0.35);
          color: #fca5a5;
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1180px) {
          .stats,
          .infoGrid,
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 780px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .cardTop {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .infoGrid,
          .grid {
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

function Risk({ label, value }: { label: string; value: number }) {
  return (
    <section className="riskBox">
      <span>{label}</span>
      <strong>{value}</strong>
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
