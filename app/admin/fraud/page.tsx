"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  status?: string;
  suspended?: boolean;
  fraudScore?: number;
  trustScore?: number;
  reportsCount?: number;
  createdAt?: string;
};

type PaymentItem = {
  id: string;
  amount?: number;
  status?: string;
  passengerEmail?: string;
  driverEmail?: string;
  provider?: string;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  reporterEmail?: string;
  reportedEmail?: string;
  targetUserId?: string;
  status?: string;
  severity?: string;
  type?: string;
  message?: string;
  createdAt?: string;
};

type FraudSignal = {
  id: string;
  userId?: string;
  email?: string;
  status?: string;
  riskLevel?: string;
  fraudScore?: number;
  reason?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminFraudDetectionCenterPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [signals, setSignals] = useState<FraudSignal[]>([]);
  const [message, setMessage] = useState("Loading fraud detection center...");
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
    const unsubPayments = listen<PaymentItem>("payments", setPayments);
    const unsubReports = listen<ReportItem>("reports", setReports);
    const unsubSignals = listen<FraudSignal>("fraudSignals", setSignals);

    return () => {
      unsubUsers();
      unsubPayments();
      unsubReports();
      unsubSignals();
    };
  }, []);

  const data = useMemo(() => {
    const highRiskUsers = users.filter(
      (item) =>
        item.suspended ||
        item.status === "suspended" ||
        Number(item.fraudScore || 0) >= 70 ||
        Number(item.reportsCount || 0) >= 3
    );

    const suspiciousPayments = payments.filter(
      (item) =>
        item.status === "failed" ||
        item.status === "refunded" ||
        item.status === "cancelled" ||
        Number(item.amount || 0) >= 500
    );

    const criticalReports = reports.filter(
      (item) =>
        item.severity === "critical" ||
        item.severity === "high" ||
        item.status === "open"
    );

    const openSignals = signals.filter(
      (item) => !item.status || item.status === "open" || item.status === "review"
    );

    const highSignals = signals.filter(
      (item) =>
        item.riskLevel === "high" ||
        item.riskLevel === "critical" ||
        Number(item.fraudScore || 0) >= 70
    );

    const resolvedSignals = signals.filter(
      (item) => item.status === "resolved" || item.status === "closed"
    );

    const fraudScore = Math.max(
      Math.min(
        100 -
          highRiskUsers.length * 10 -
          suspiciousPayments.length * 7 -
          criticalReports.length * 8 -
          highSignals.length * 12 +
          resolvedSignals.length * 3,
        100
      ),
      0
    );

    const riskVolume = suspiciousPayments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    return {
      highRiskUsers,
      suspiciousPayments,
      criticalReports,
      openSignals,
      highSignals,
      resolvedSignals,
      fraudScore,
      riskVolume,
    };
  }, [users, payments, reports, signals]);

  async function createFraudSignalFromUser(user: UserItem) {
    try {
      setProcessingId(user.id);
      const now = new Date().toISOString();
      const id = `fraud-user-${user.id}-${Date.now()}`;
      const score = Number(user.fraudScore || user.reportsCount ? Number(user.fraudScore || 0) : 75);

      await setDoc(
        doc(db, "fraudSignals", id),
        {
          userId: user.id,
          email: user.email || "",
          status: "open",
          riskLevel: score >= 85 ? "critical" : "high",
          fraudScore: score || 75,
          reason: "High risk user flagged by admin.",
          source: "user_review",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `fraud-user-${user.id}-${Date.now()}`),
        {
          action: "Fraud Signal Created",
          targetId: user.id,
          targetType: "user",
          details: `${user.email || "User"} flagged for fraud review.`,
          severity: "warning",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Fraud signal created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create fraud signal.");
    } finally {
      setProcessingId("");
    }
  }

  async function suspendUser(user: UserItem) {
    try {
      setProcessingId(user.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", user.id),
        {
          suspended: true,
          status: "suspended",
          fraudStatus: "suspended",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `fraud-suspend-${user.id}-${Date.now()}`),
        {
          action: "User Suspended For Fraud",
          targetId: user.id,
          targetType: "user",
          details: `${user.email || "User"} suspended by Fraud Detection.`,
          severity: "warning",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("User suspended for fraud review.");
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
          fraudStatus: "clear",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `fraud-restore-${user.id}-${Date.now()}`),
        {
          action: "User Restored From Fraud Review",
          targetId: user.id,
          targetType: "user",
          details: `${user.email || "User"} restored by Fraud Detection.`,
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

  async function updateSignal(signal: FraudSignal, status: string, riskLevel?: string) {
    try {
      setProcessingId(signal.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "fraudSignals", signal.id),
        {
          status,
          riskLevel: riskLevel || signal.riskLevel || "medium",
          updatedAt: now,
          ...(status === "resolved" || status === "closed" ? { resolvedAt: now } : {}),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `fraud-signal-${signal.id}-${Date.now()}`),
        {
          action: "Fraud Signal Updated",
          targetId: signal.id,
          targetType: "fraudSignal",
          details: `${signal.email || "Signal"} changed to ${status}`,
          severity: status === "resolved" ? "success" : riskLevel === "critical" ? "critical" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Fraud signal updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update fraud signal.");
    } finally {
      setProcessingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusClass(status?: string, riskLevel?: string, score?: number) {
    if (status === "resolved" || status === "closed" || status === "active") return "good";
    if (status === "suspended" || riskLevel === "critical" || riskLevel === "high" || Number(score || 0) >= 70) return "bad";
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
          <Link href="/admin/safety" className="miniButton">Trust & Safety</Link>
          <Link href="/admin/payments" className="miniButton">Payments</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Risk Operations</p>
            <h1>Fraud Detection <span>Center</span></h1>
            <p className="subtitle">
              Monitor suspicious users, risky payments, reports, fraud signals, suspensions,
              chargebacks, refunds and platform abuse.
            </p>
          </div>

          <div className={data.fraudScore >= 70 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{data.fraudScore}</strong>
            <span>Fraud Safety</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🧠" label="Fraud Signals" value={String(signals.length)} />
          <Metric icon="🚩" label="Open Signals" value={String(data.openSignals.length)} />
          <Metric icon="🔥" label="High Risk Signals" value={String(data.highSignals.length)} />
          <Metric icon="👤" label="High Risk Users" value={String(data.highRiskUsers.length)} />
          <Metric icon="💳" label="Suspicious Payments" value={String(data.suspiciousPayments.length)} />
          <Metric icon="💵" label="Risk Volume" value={money(data.riskVolume)} />
          <Metric icon="📋" label="Critical Reports" value={String(data.criticalReports.length)} />
          <Metric icon="✅" label="Resolved Signals" value={String(data.resolvedSignals.length)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Risk Breakdown</p>
            <h2>Fraud Signals</h2>

            <div className="riskList">
              <Risk label="Open Fraud Signals" value={data.openSignals.length} />
              <Risk label="High Risk Users" value={data.highRiskUsers.length} />
              <Risk label="Suspicious Payments" value={data.suspiciousPayments.length} />
              <Risk label="Critical Reports" value={data.criticalReports.length} />
              <Risk label="Resolved Signals" value={data.resolvedSignals.length} />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Fraud Actions</p>
            <h2>Operations Links</h2>

            <div className="linkGrid">
              <Link href="/admin/safety" className="actionLink">Trust & Safety</Link>
              <Link href="/admin/payments" className="actionLink">Payments Center</Link>
              <Link href="/admin/stripe" className="actionLink">Stripe Center</Link>
              <Link href="/admin/reports" className="actionLink">Reports Center</Link>
              <Link href="/admin/users" className="actionLink">Users</Link>
              <Link href="/admin/audit-logs" className="actionLink">Audit Logs</Link>
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Fraud Signal Queue</p>
          <h2>Active Signals</h2>

          {signals.length === 0 ? (
            <div className="empty">
              <h3>No fraud signals yet</h3>
              <p>Fraud signals can be created from users, payments, reports or automated risk checks.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {signals.map((signal) => (
                <section key={signal.id} className={`itemCard ${statusClass(signal.status, signal.riskLevel, signal.fraudScore)}`}>
                  <div className="cardTop">
                    <div>
                      <h3>{signal.email || "Fraud Signal"}</h3>
                      <p>{signal.reason || "Risk signal detected"} • {signal.source || "system"}</p>
                    </div>

                    <span className={`pill ${statusClass(signal.status, signal.riskLevel, signal.fraudScore)}`}>
                      {signal.riskLevel || "medium"} • {signal.status || "open"}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Fraud Score" value={`${Number(signal.fraudScore || 0)}/100`} />
                    <Info label="Risk Level" value={signal.riskLevel || "medium"} />
                    <Info label="Status" value={signal.status || "open"} />
                    <Info label="User ID" value={signal.userId || "Not linked"} />
                    <Info label="Created" value={formatDate(signal.createdAt)} />
                    <Info label="Updated" value={formatDate(signal.updatedAt)} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateSignal(signal, "review", signal.riskLevel)} disabled={processingId === signal.id}>
                      Review
                    </button>
                    <button className="dangerButton" onClick={() => updateSignal(signal, "open", "critical")} disabled={processingId === signal.id}>
                      Critical
                    </button>
                    <button className="goodButton" onClick={() => updateSignal(signal, "resolved", "low")} disabled={processingId === signal.id}>
                      Resolve
                    </button>
                    <button onClick={() => updateSignal(signal, "closed", signal.riskLevel)} disabled={processingId === signal.id}>
                      Close
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">High Risk Users</p>
          <h2>User Risk Review</h2>

          {data.highRiskUsers.length === 0 ? (
            <div className="empty">
              <h3>No high risk users found</h3>
              <p>Users with high fraud score, many reports, or suspension status will appear here.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {data.highRiskUsers.map((user) => (
                <section key={user.id} className={`itemCard ${statusClass(user.status, undefined, user.fraudScore)}`}>
                  <div className="cardTop">
                    <div>
                      <h3>{user.name || user.email || "User"}</h3>
                      <p>Trust {Number(user.trustScore || 65)}/100 • Reports {Number(user.reportsCount || 0)}</p>
                    </div>

                    <span className={`pill ${statusClass(user.status, undefined, user.fraudScore)}`}>
                      Fraud {Number(user.fraudScore || 0)}/100
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Email" value={user.email || "Not available"} />
                    <Info label="Status" value={user.suspended ? "suspended" : user.status || "active"} />
                    <Info label="Created" value={formatDate(user.createdAt)} />
                    <Info label="User ID" value={user.id} />
                  </div>

                  <div className="actions">
                    <button onClick={() => createFraudSignalFromUser(user)} disabled={processingId === user.id}>
                      Flag
                    </button>

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
          <p className="eyebrow">Payment Risk</p>
          <h2>Suspicious Payments</h2>

          {data.suspiciousPayments.length === 0 ? (
            <div className="empty">
              <h3>No suspicious payments</h3>
              <p>Failed, refunded, cancelled or unusually high payments will appear here.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {data.suspiciousPayments.map((payment) => (
                <section key={payment.id} className={`itemCard ${statusClass(payment.status)}`}>
                  <div className="cardTop">
                    <div>
                      <h3>{money(Number(payment.amount || 0))} Payment</h3>
                      <p>{payment.passengerEmail || "Passenger"} → {payment.driverEmail || "Driver"}</p>
                    </div>

                    <span className={`pill ${statusClass(payment.status)}`}>
                      {payment.status || "unknown"}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Provider" value={payment.provider || "Not available"} />
                    <Info label="Amount" value={money(Number(payment.amount || 0))} />
                    <Info label="Created" value={formatDate(payment.createdAt)} />
                    <Info label="Payment ID" value={payment.id} />
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
            radial-gradient(circle at top right, rgba(239,68,68,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
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

        .itemCard.bad {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 42%),
            rgba(8,13,25,0.92);
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
          grid-template-columns: repeat(3, 1fr);
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
