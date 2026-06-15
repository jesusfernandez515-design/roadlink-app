"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type RiskLevel = "low" | "medium" | "high";
type RiskFilter = "all" | RiskLevel;

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  suspended?: boolean;
  driverVerified?: boolean;
};

type BookingItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
};

type ReportItem = {
  id: string;
  targetUserId?: string;
  targetUserEmail?: string;
  reporterId?: string;
  reporterEmail?: string;
  priority?: string;
};

type DisputeItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  priority?: string;
};

type PayoutItem = {
  id: string;
  userId?: string;
  driverEmail?: string;
  email?: string;
  status?: string;
};

type FraudCase = {
  id: string;
  userId: string;
  email: string;
  reason: string;
  risk: RiskLevel;
  score: number;
  details: string;
  reports: number;
  disputes: number;
  cancellations: number;
  payouts: number;
  suspended: boolean;
};

export default function AdminFraudPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [selected, setSelected] = useState<FraudCase | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [message, setMessage] = useState("Loading fraud center...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
      },
      () => setBookings([])
    );

    const unsubReports = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
      },
      () => setReports([])
    );

    const unsubDisputes = onSnapshot(
      query(collection(db, "disputes")),
      (snapshot) => {
        setDisputes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as DisputeItem[]);
      },
      () => setDisputes([])
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
      },
      () => setPayouts([])
    );

    return () => {
      unsubUsers();
      unsubBookings();
      unsubReports();
      unsubDisputes();
      unsubPayouts();
    };
  }, []);

  const fraudCases = useMemo<FraudCase[]>(() => {
    return users
      .map((user) => {
        const userEmail = user.email || "No email";

        const userReports = reports.filter(
          (item) =>
            item.targetUserId === user.id ||
            item.targetUserEmail === user.email ||
            item.reporterId === user.id ||
            item.reporterEmail === user.email
        );

        const userDisputes = disputes.filter(
          (item) =>
            item.driverId === user.id ||
            item.passengerId === user.id ||
            item.driverEmail === user.email ||
            item.passengerEmail === user.email ||
            item.userId === user.id ||
            item.userEmail === user.email
        );

        const userBookings = bookings.filter(
          (item) =>
            item.driverId === user.id ||
            item.passengerId === user.id ||
            item.driverEmail === user.email ||
            item.passengerEmail === user.email
        );

        const cancelledBookings = userBookings.filter(
          (item) =>
            item.status === "cancelled" ||
            item.status === "rejected" ||
            item.status === "no_show"
        );

        const userPayouts = payouts.filter(
          (item) =>
            item.userId === user.id ||
            item.driverEmail === user.email ||
            item.email === user.email
        );

        const urgentReports = userReports.filter((item) => item.priority === "urgent").length;
        const urgentDisputes = userDisputes.filter((item) => item.priority === "urgent").length;
        const pendingPayouts = userPayouts.filter(
          (item) => item.status === "pending" || item.status === "approved"
        ).length;

        let score =
          userReports.length * 18 +
          userDisputes.length * 20 +
          cancelledBookings.length * 10 +
          urgentReports * 20 +
          urgentDisputes * 20 +
          pendingPayouts * 8;

        if (user.suspended) score += 25;
        if (!user.driverVerified && userPayouts.length > 0) score += 20;

        score = Math.min(score, 100);

        const risk: RiskLevel =
          score >= 70 ? "high" : score >= 35 ? "medium" : "low";

        const reasons: string[] = [];

        if (userReports.length > 0) reasons.push(`${userReports.length} report(s)`);
        if (userDisputes.length > 0) reasons.push(`${userDisputes.length} dispute(s)`);
        if (cancelledBookings.length > 0) reasons.push(`${cancelledBookings.length} cancellation(s)`);
        if (pendingPayouts > 0) reasons.push(`${pendingPayouts} pending payout(s)`);
        if (user.suspended) reasons.push("account suspended");
        if (!user.driverVerified && userPayouts.length > 0) reasons.push("payout without verification");

        return {
          id: user.id,
          userId: user.id,
          email: userEmail,
          reason: reasons.length > 0 ? reasons.join(", ") : "No major risk signals",
          risk,
          score,
          details:
            score >= 70
              ? "High risk user. Review reports, disputes, payouts, cancellations, and account history."
              : score >= 35
              ? "Medium risk user. Monitor activity and recent complaints."
              : "Low risk user. No major fraud pattern detected.",
          reports: userReports.length,
          disputes: userDisputes.length,
          cancellations: cancelledBookings.length,
          payouts: userPayouts.length,
          suspended: Boolean(user.suspended),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [users, bookings, reports, disputes, payouts]);

  const filteredCases = useMemo<FraudCase[]>(() => {
    const value = search.toLowerCase().trim();

    return fraudCases.filter((item) => {
      const matchesSearch =
        !value ||
        item.email.toLowerCase().includes(value) ||
        item.userId.toLowerCase().includes(value) ||
        item.reason.toLowerCase().includes(value);

      const matchesRisk = riskFilter === "all" || item.risk === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [fraudCases, search, riskFilter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredCases.length === 0) return null;
      if (!current) return filteredCases[0];
      return filteredCases.find((item) => item.id === current.id) || filteredCases[0];
    });
  }, [filteredCases]);

  const highRiskCount = fraudCases.filter((item) => item.risk === "high").length;
  const mediumRiskCount = fraudCases.filter((item) => item.risk === "medium").length;
  const lowRiskCount = fraudCases.filter((item) => item.risk === "low").length;
  const suspendedCount = fraudCases.filter((item) => item.suspended).length;

  const fraudHealth = Math.max(
    100 - highRiskCount * 20 - mediumRiskCount * 8 - suspendedCount * 5,
    0
  );

  async function updateUserSuspension(item: FraudCase, suspended: boolean) {
    try {
      setLoadingId(item.userId);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.userId),
        {
          suspended,
          fraudReviewStatus: suspended ? "suspended_by_admin" : "cleared_by_admin",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `fraud-${item.userId}-${Date.now()}`),
        {
          userId: item.userId,
          userEmail: item.email,
          action: suspended ? "User Suspended From Fraud Center" : "User Cleared From Fraud Center",
          targetId: item.userId,
          targetType: "user",
          details: item.reason,
          severity: suspended ? "danger" : "success",
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "notifications", `${item.userId}-fraud-${Date.now()}`),
        {
          userId: item.userId,
          type: "account",
          title: suspended ? "Account Suspended" : "Account Reactivated",
          message: suspended
            ? "Your RoadLink account was suspended after an admin review."
            : "Your RoadLink account was reactivated after an admin review.",
          read: false,
          createdAt: now,
          actionUrl: "/profile",
        },
        { merge: true }
      );

      setMessage(suspended ? "User suspended successfully." : "User reactivated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function markForReview(item: FraudCase) {
    try {
      setLoadingId(item.userId);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.userId),
        {
          fraudReviewStatus: "manual_review",
          fraudRiskScore: item.score,
          fraudRiskLevel: item.risk,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `fraud-review-${item.userId}-${Date.now()}`),
        {
          userId: item.userId,
          userEmail: item.email,
          action: "User Marked For Fraud Review",
          targetId: item.userId,
          targetType: "user",
          details: item.reason,
          severity: item.risk === "high" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("User marked for manual review.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not mark user for review.");
    } finally {
      setLoadingId("");
    }
  }

  function riskLabel(risk: RiskLevel) {
    if (risk === "high") return "High Risk";
    if (risk === "medium") return "Medium Risk";
    return "Low Risk";
  }

  function shortText(value: string, max = 34) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/disputes" className="miniButton">Disputes</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/logs" className="miniButton">Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Fraud <span>Center</span></h1>
            <p className="subtitle">
              Detect risky users, suspicious payouts, cancelled bookings and safety reports.
            </p>
          </div>

          <div className={fraudHealth < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{fraudHealth}</strong>
            <span>Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚨" label="High" value={String(highRiskCount)} danger={highRiskCount > 0} />
          <Metric icon="⚠️" label="Medium" value={String(mediumRiskCount)} danger={mediumRiskCount > 0} />
          <Metric icon="✅" label="Low" value={String(lowRiskCount)} />
          <Metric icon="⛔" label="Suspended" value={String(suspendedCount)} danger={suspendedCount > 0} />
          <Metric icon="👥" label="Scanned" value={String(fraudCases.length)} />
          <Metric icon="📋" label="Filtered" value={String(filteredCases.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search email, UID, reason..."
          />

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
          >
            <option value="all">All risk levels</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
            <option value="low">Low risk</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="fraudCard">
            <p className="eyebrow">Risk Queue</p>
            <h2>Suspicious Accounts</h2>

            {filteredCases.length === 0 ? (
              <div className="empty">
                <h3>No fraud cases found</h3>
                <p>No suspicious accounts match your filters.</p>
              </div>
            ) : (
              <div className="fraudList">
                {filteredCases.map((item) => (
                  <button
                    key={item.id}
                    className={selected?.id === item.id ? "fraudRow activeFraud" : "fraudRow"}
                    onClick={() => setSelected(item)}
                  >
                    <div className={`fraudIcon ${item.risk}`}>
                      {item.risk === "high" ? "🚨" : item.risk === "medium" ? "⚠️" : "✅"}
                    </div>

                    <div className="fraudInfo">
                      <strong>{shortText(item.email, 32)}</strong>
                      <span>{shortText(item.reason, 48)}</span>
                      <small>Score {item.score}/100</small>
                    </div>

                    <em className={`risk ${item.risk}`}>{riskLabel(item.risk)}</em>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Account</p>
                    <h2>{shortText(selected.email, 36)}</h2>
                    <p className="email">{shortText(selected.userId, 40)}</p>
                  </div>

                  <span className={`riskPill ${selected.risk}`}>
                    {riskLabel(selected.risk)}
                  </span>
                </div>

                <div className="scoreBox">
                  <span>Fraud Risk Score</span>
                  <strong>{selected.score}/100</strong>
                </div>

                <div className="detailsBox">
                  <strong>Risk Summary</strong>
                  <p>{selected.details}</p>
                  <p>{selected.reason}</p>
                </div>

                <div className="infoGrid">
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="Disputes" value={String(selected.disputes)} />
                  <Info label="Cancellations" value={String(selected.cancellations)} />
                  <Info label="Payouts" value={String(selected.payouts)} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Risk Level" value={riskLabel(selected.risk)} />
                  <Info label="Email" value={selected.email} />
                  <Info label="User ID" value={selected.userId} />
                </div>

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => markForReview(selected)}
                    disabled={loadingId === selected.userId}
                  >
                    Review
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() => updateUserSuspension(selected, true)}
                    disabled={loadingId === selected.userId}
                  >
                    Suspend
                  </button>

                  <button
                    className="approveButton"
                    onClick={() => updateUserSuspension(selected, false)}
                    disabled={loadingId === selected.userId}
                  >
                    Reactivate
                  </button>

                  <Link href="/admin/users" className="linkButton">
                    Users
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select an account</h3>
                <p>Choose a suspicious account to review risk details.</p>
              </div>
            )}
          </div>
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
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 12px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
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

        .hero,
        .metric,
        .filters,
        .fraudCard,
        .detailsCard {
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
        .scoreBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 24px;
          margin: 0 0 12px;
          overflow-wrap: anywhere;
        }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.45;
          font-size: 13px;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 74px;
          width: 74px;
          height: 74px;
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
          font-size: 9px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 10px 0;
          font-size: 13px;
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

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .metricValue {
          display: block;
          font-size: 20px;
          font-weight: 900;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          border-radius: 18px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .filters input,
        .filters select {
          width: 100%;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 13px;
          outline: none;
        }

        .filters option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .fraudCard,
        .detailsCard {
          border-radius: 22px;
          padding: 16px;
          overflow: hidden;
        }

        .fraudList {
          display: grid;
          gap: 8px;
        }

        .fraudRow {
          width: 100%;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
          overflow: hidden;
        }

        .activeFraud {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .fraudIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .fraudIcon.high {
          background: rgba(239,68,68,0.13);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .fraudIcon.medium {
          background: rgba(250,204,21,0.13);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .fraudIcon.low {
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .fraudInfo {
          min-width: 0;
        }

        .fraudInfo strong,
        .fraudInfo span,
        .fraudInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fraudInfo strong {
          font-size: 13px;
        }

        .fraudInfo span,
        .fraudInfo small {
          color: #a1a1aa;
          margin-top: 4px;
          font-size: 11px;
        }

        .risk {
          grid-column: 2;
          width: fit-content;
        }

        .risk,
        .riskPill {
          border-radius: 999px;
          padding: 7px 10px;
          font-style: normal;
          font-weight: 900;
          font-size: 10px;
          white-space: nowrap;
        }

        .risk.high,
        .riskPill.high {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .risk.medium,
        .riskPill.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .risk.low,
        .riskPill.low {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .sectionHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .scoreBox,
        .detailsBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 12px;
        }

        .scoreBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          font-size: 11px;
          margin-bottom: 6px;
        }

        .scoreBox strong {
          font-size: 30px;
          font-weight: 900;
        }

        .detailsBox strong {
          display: block;
          color: #22c55e;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .detailsBox p {
          color: #e5e7eb;
          line-height: 1.45;
          margin: 0 0 7px;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }

        .infoBox {
          padding: 11px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
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
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .reviewButton,
        .approveButton,
        .rejectButton,
        .linkButton {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 10px;
          border-radius: 999px;
          border: none;
          color: white;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .reviewButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .rejectButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        .linkButton {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        @media (min-width: 900px) {
          .page {
            padding: 24px;
            padding-bottom: 80px;
          }

          .stats {
            grid-template-columns: repeat(6, 1fr);
          }

          .filters {
            grid-template-columns: 1fr 220px;
            padding: 18px;
          }

          .adminGrid {
            grid-template-columns: 0.9fr 1.4fr;
            gap: 24px;
          }

          .fraudCard,
          .detailsCard {
            padding: 28px;
          }

          .fraudRow {
            grid-template-columns: 52px 1fr auto;
          }

          .risk {
            grid-column: auto;
          }

          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .actionRow {
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}
