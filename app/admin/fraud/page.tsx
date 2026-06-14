"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  suspended?: boolean;
  driverVerified?: boolean;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  price?: number;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  targetUserId?: string;
  targetUserEmail?: string;
  reporterId?: string;
  reporterEmail?: string;
  status?: string;
  priority?: string;
};

type DisputeItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  subject?: string;
  description?: string;
  category?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  priority?: string;
  amount?: number;
};

type PayoutItem = {
  id: string;
  userId?: string;
  driverEmail?: string;
  email?: string;
  amount?: number;
  status?: string;
};

type FraudCase = {
  id: string;
  userId: string;
  email: string;
  reason: string;
  risk: "low" | "medium" | "high";
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
  const [riskFilter, setRiskFilter] = useState("all");
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
      (error) => setMessage(error.message)
    );

    const unsubReports = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubDisputes = onSnapshot(
      query(collection(db, "disputes")),
      (snapshot) => {
        setDisputes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as DisputeItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubUsers();
      unsubBookings();
      unsubReports();
      unsubDisputes();
      unsubPayouts();
    };
  }, []);

  const fraudCases = useMemo(() => {
    const cases = users.map((user) => {
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

      const risk: "low" | "medium" | "high" =
        score >= 70 ? "high" : score >= 35 ? "medium" : "low";

      const reasons: string[] = [];

      if (userReports.length > 0) reasons.push(`${userReports.length} report(s)`);
      if (userDisputes.length > 0) reasons.push(`${userDisputes.length} dispute(s)`);
      if (cancelledBookings.length > 0) reasons.push(`${cancelledBookings.length} cancellation(s)`);
      if (pendingPayouts > 0) reasons.push(`${pendingPayouts} pending payout(s)`);
      if (user.suspended) reasons.push("account suspended");
      if (!user.driverVerified && userPayouts.length > 0) {
        reasons.push("payout activity without verified driver status");
      }

      return {
        id: user.id,
        userId: user.id,
        email: userEmail,
        reason: reasons.length > 0 ? reasons.join(", ") : "No major risk signals",
        risk,
        score,
        details:
          score >= 70
            ? "High risk user. Review reports, disputes, payouts, cancellations, and account history before allowing more activity."
            : score >= 35
            ? "Medium risk user. Monitor activity and review recent complaints, disputes, or cancellations."
            : "Low risk user. No major fraud pattern detected.",
        reports: userReports.length,
        disputes: userDisputes.length,
        cancellations: cancelledBookings.length,
        payouts: userPayouts.length,
        suspended: Boolean(user.suspended),
      } as FraudCase;
    });

    return cases.sort((a, b) => b.score - a.score);
  }, [users, bookings, reports, disputes, payouts]);

  const filteredCases = useMemo(() => {
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
      if (!current) return filteredCases[0] || null;
      return filteredCases.find((item) => item.id === current.id) || filteredCases[0] || null;
    });
  }, [filteredCases]);

  const highRiskCount = fraudCases.filter((item) => item.risk === "high").length;
  const mediumRiskCount = fraudCases.filter((item) => item.risk === "medium").length;
  const lowRiskCount = fraudCases.filter((item) => item.risk === "low").length;
  const suspendedCount = fraudCases.filter((item) => item.suspended).length;

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
          action: suspended
            ? "User Suspended From Fraud Center"
            : "User Cleared From Fraud Center",
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

  function riskLabel(risk: string) {
    if (risk === "high") return "High Risk";
    if (risk === "medium") return "Medium Risk";
    return "Low Risk";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
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
              Detect risky accounts using reports, disputes, cancellations, payout activity,
              suspended status, and driver verification signals.
            </p>
          </div>

          <div className="heroIcon">🚨</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚨" label="High Risk" value={String(highRiskCount)} />
          <Metric icon="⚠️" label="Medium Risk" value={String(mediumRiskCount)} />
          <Metric icon="✅" label="Low Risk" value={String(lowRiskCount)} />
          <Metric icon="⛔" label="Suspended" value={String(suspendedCount)} />
          <Metric icon="👥" label="Users Scanned" value={String(fraudCases.length)} />
          <Metric icon="📋" label="Filtered" value={String(filteredCases.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, UID, or fraud reason..."
          />

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
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
                <p>No suspicious accounts match your current filters.</p>
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
                      <strong>{item.email}</strong>
                      <span>{item.reason}</span>
                      <small>Risk score: {item.score}/100</small>
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
                    <h2>{selected.email}</h2>
                    <p className="email">{selected.userId}</p>
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
                  <Info label="User ID" value={selected.userId} />
                  <Info label="Email" value={selected.email} />
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="Disputes" value={String(selected.disputes)} />
                  <Info label="Cancellations" value={String(selected.cancellations)} />
                  <Info label="Payout Records" value={String(selected.payouts)} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Risk Level" value={riskLabel(selected.risk)} />
                </div>

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => markForReview(selected)}
                    disabled={loadingId === selected.userId}
                  >
                    Mark Review
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
                    Open Users
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

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

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
        .filters,
        .fraudCard,
        .detailsCard {
          background: rgba(8, 13, 25, 0.92);
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
        .metricValue,
        .scoreBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 8px;
        }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
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
          font-size: 24px;
          font-weight: 900;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        .filters input,
        .filters select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .filters option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .fraudCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .fraudList {
          display: grid;
          gap: 12px;
        }

        .fraudRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeFraud {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .fraudIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
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

        .fraudInfo span,
        .fraudInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .risk,
        .riskPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
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
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .scoreBox,
        .detailsBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .scoreBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .scoreBox strong {
          font-size: 44px;
          font-weight: 900;
        }

        .detailsBox strong {
          display: block;
          color: #22c55e;
          margin-bottom: 8px;
        }

        .detailsBox p {
          color: #e5e7eb;
          line-height: 1.5;
          margin-bottom: 8px;
          overflow-wrap: anywhere;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
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
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .reviewButton,
        .approveButton,
        .rejectButton,
        .linkButton {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
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
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }

          .actionRow {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .fraudCard,
          .detailsCard {
            padding: 24px;
          }

          .fraudRow {
            grid-template-columns: 46px 1fr;
          }

          .fraudRow .risk {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .fraudIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
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
