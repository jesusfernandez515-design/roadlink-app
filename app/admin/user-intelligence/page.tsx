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
  role?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  from?: string;
  to?: string;
  price?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  priority?: string;
  status?: string;
  reason?: string;
  createdAt?: string;
};

type SupportTicket = {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  priority?: string;
  subject?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  userId?: string;
  driverEmail?: string;
  email?: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type RedemptionItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  couponCode?: string;
  discountAmount?: number;
  createdAt?: string;
};

type UserIntelligence = {
  id: string;
  name: string;
  email: string;
  trustScore: number;
  riskLevel: RiskLevel;
  role: string;
  verified: boolean;
  driverVerified: boolean;
  suspended: boolean;
  bookings: number;
  rides: number;
  reportsMade: number;
  reportsAgainst: number;
  supportTickets: number;
  payouts: number;
  couponUses: number;
  revenue: number;
  reason: string;
};

export default function AdminUserIntelligencePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionItem[]>([]);
  const [selected, setSelected] = useState<UserIntelligence | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [message, setMessage] = useState("Loading user intelligence...");
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

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    const unsubTickets = onSnapshot(query(collection(db, "supportTickets")), (snapshot) => {
      setTickets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as SupportTicket[]);
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
    });

    const unsubRedemptions = onSnapshot(query(collection(db, "couponRedemptions")), (snapshot) => {
      setRedemptions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RedemptionItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubTickets();
      unsubPayouts();
      unsubRedemptions();
    };
  }, []);

  const intelligence = useMemo<UserIntelligence[]>(() => {
    return users
      .map((user): UserIntelligence => {
        const userEmail = user.email || "No email";

        const userBookings = bookings.filter(
          (item) =>
            item.passengerId === user.id ||
            item.driverId === user.id ||
            item.passengerEmail === user.email ||
            item.driverEmail === user.email
        );

        const userRides = rides.filter(
          (item) => item.driverId === user.id || item.driverEmail === user.email
        );

        const reportsMade = reports.filter(
          (item) => item.reporterId === user.id || item.reporterEmail === user.email
        );

        const reportsAgainst = reports.filter(
          (item) => item.targetUserId === user.id || item.targetUserEmail === user.email
        );

        const userTickets = tickets.filter(
          (item) => item.userId === user.id || item.userEmail === user.email
        );

        const userPayouts = payouts.filter(
          (item) =>
            item.userId === user.id ||
            item.driverEmail === user.email ||
            item.email === user.email
        );

        const userRedemptions = redemptions.filter(
          (item) => item.userId === user.id || item.userEmail === user.email
        );

        const completedBookings = userBookings.filter((item) => item.status === "completed");

        const cancelledBookings = userBookings.filter(
          (item) =>
            item.status === "cancelled" ||
            item.status === "rejected" ||
            item.status === "no_show"
        );

        const revenue = completedBookings.reduce((total, item) => {
          return total + Number(item.price || item.amount || 0) * Number(item.seatsBooked || 1);
        }, 0);

        let trustScore = 100;

        trustScore -= reportsAgainst.length * 15;
        trustScore -= cancelledBookings.length * 8;
        trustScore -= userTickets.filter((item) => item.priority === "urgent").length * 6;

        if (user.suspended) trustScore -= 35;
        if (user.verified) trustScore += 5;
        if (user.driverVerified) trustScore += 8;
        if (completedBookings.length > 0) trustScore += Math.min(10, completedBookings.length * 2);

        trustScore = Math.max(Math.min(trustScore, 100), 0);

        const riskLevel: RiskLevel =
          trustScore < 55 ? "high" : trustScore < 78 ? "medium" : "low";

        const reasons: string[] = [];

        if (reportsAgainst.length > 0) reasons.push(`${reportsAgainst.length} report(s) against user`);
        if (cancelledBookings.length > 0) reasons.push(`${cancelledBookings.length} cancellation(s)`);
        if (userTickets.length > 0) reasons.push(`${userTickets.length} support ticket(s)`);
        if (user.suspended) reasons.push("account suspended");
        if (reasons.length === 0) reasons.push("healthy account activity");

        return {
          id: user.id,
          name: user.name || "RoadLink User",
          email: userEmail,
          trustScore,
          riskLevel,
          role: user.role || "member",
          verified: Boolean(user.verified),
          driverVerified: Boolean(user.driverVerified),
          suspended: Boolean(user.suspended),
          bookings: userBookings.length,
          rides: userRides.length,
          reportsMade: reportsMade.length,
          reportsAgainst: reportsAgainst.length,
          supportTickets: userTickets.length,
          payouts: userPayouts.length,
          couponUses: userRedemptions.length,
          revenue,
          reason: reasons.join(", "),
        };
      })
      .sort((a, b) => a.trustScore - b.trustScore);
  }, [users, rides, bookings, reports, tickets, payouts, redemptions]);

  const filteredUsers = useMemo(() => {
    const text = search.toLowerCase().trim();

    return intelligence.filter((item) => {
      const matchesSearch =
        !text ||
        item.name.toLowerCase().includes(text) ||
        item.email.toLowerCase().includes(text) ||
        item.id.toLowerCase().includes(text) ||
        item.reason.toLowerCase().includes(text);

      const matchesRisk = riskFilter === "all" || item.riskLevel === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [intelligence, search, riskFilter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredUsers.length === 0) return null;
      if (!current) return filteredUsers[0];
      return filteredUsers.find((item) => item.id === current.id) || filteredUsers[0];
    });
  }, [filteredUsers]);

  const highRisk = intelligence.filter((item) => item.riskLevel === "high").length;
  const mediumRisk = intelligence.filter((item) => item.riskLevel === "medium").length;
  const lowRisk = intelligence.filter((item) => item.riskLevel === "low").length;
  const suspended = intelligence.filter((item) => item.suspended).length;

  async function updateUserSuspension(item: UserIntelligence, suspendedStatus: boolean) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.id),
        {
          suspended: suspendedStatus,
          trustScore: item.trustScore,
          riskLevel: item.riskLevel,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `user-intel-${item.id}-${Date.now()}`),
        {
          userId: item.id,
          userEmail: item.email,
          action: suspendedStatus
            ? "User Suspended From Intelligence Center"
            : "User Cleared From Intelligence Center",
          targetId: item.id,
          targetType: "user",
          details: item.reason,
          severity: suspendedStatus ? "danger" : "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage(suspendedStatus ? "User suspended successfully." : "User cleared successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function markManualReview(item: UserIntelligence) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.id),
        {
          reviewStatus: "manual_review",
          trustScore: item.trustScore,
          riskLevel: item.riskLevel,
          reviewReason: item.reason,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `user-review-${item.id}-${Date.now()}`),
        {
          userId: item.id,
          userEmail: item.email,
          action: "User Marked For Manual Review",
          targetId: item.id,
          targetType: "user",
          details: item.reason,
          severity: item.riskLevel === "high" ? "warning" : "info",
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

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function riskLabel(value: RiskLevel) {
    if (value === "high") return "High Risk";
    if (value === "medium") return "Medium Risk";
    return "Low Risk";
  }

  function shortText(value: string, max = 38) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/driver-risk" className="miniButton">Driver Risk</Link>
          <Link href="/admin/operations" className="miniButton">Operations</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Intelligence</p>
            <h1>User <span>Intelligence</span></h1>
            <p className="subtitle">
              View complete user intelligence using trips, bookings, reports,
              support tickets, payouts, coupons, revenue and trust signals.
            </p>
          </div>

          <div className={highRisk > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{highRisk}</strong>
            <span>High Risk</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users Scanned" value={String(intelligence.length)} />
          <Metric icon="🚨" label="High Risk" value={String(highRisk)} danger={highRisk > 0} />
          <Metric icon="⚠️" label="Medium Risk" value={String(mediumRisk)} danger={mediumRisk > 0} />
          <Metric icon="✅" label="Low Risk" value={String(lowRisk)} />
          <Metric icon="⛔" label="Suspended" value={String(suspended)} danger={suspended > 0} />
          <Metric icon="📋" label="Filtered" value={String(filteredUsers.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user, email, UID, reason..."
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
          <section className="usersCard">
            <p className="eyebrow">User Queue</p>
            <h2>Intelligence List</h2>

            {filteredUsers.length === 0 ? (
              <div className="empty">
                <h3>No users found</h3>
                <p>No users match this search or risk filter.</p>
              </div>
            ) : (
              <div className="userList">
                {filteredUsers.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "userRow activeUser" : "userRow"}
                  >
                    <div className={`userIcon ${item.riskLevel}`}>
                      {item.riskLevel === "high" ? "🚨" : item.riskLevel === "medium" ? "⚠️" : "✅"}
                    </div>

                    <div className="userInfo">
                      <strong>{shortText(item.name)}</strong>
                      <span>{shortText(item.email)}</span>
                      <small>Trust {item.trustScore}/100 • {item.reason}</small>
                    </div>

                    <em className={`risk ${item.riskLevel}`}>{riskLabel(item.riskLevel)}</em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected User</p>
                    <h2>{shortText(selected.name)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`riskPill ${selected.riskLevel}`}>
                    {riskLabel(selected.riskLevel)}
                  </span>
                </div>

                <div className="scoreBox">
                  <span>Trust Score</span>
                  <strong>{selected.trustScore}/100</strong>
                </div>

                <div className="detailsBox">
                  <strong>Intelligence Summary</strong>
                  <p>{selected.reason}</p>
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.id} />
                  <Info label="Role" value={selected.role} />
                  <Info label="Verified" value={selected.verified ? "Yes" : "No"} />
                  <Info label="Driver Verified" value={selected.driverVerified ? "Yes" : "No"} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Rides" value={String(selected.rides)} />
                  <Info label="Reports Made" value={String(selected.reportsMade)} />
                  <Info label="Reports Against" value={String(selected.reportsAgainst)} />
                  <Info label="Support Tickets" value={String(selected.supportTickets)} />
                  <Info label="Payouts" value={String(selected.payouts)} />
                  <Info label="Coupon Uses" value={String(selected.couponUses)} />
                  <Info label="Completed Revenue" value={money(selected.revenue)} />
                  <Info label="Risk Level" value={riskLabel(selected.riskLevel)} />
                </div>

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => markManualReview(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Review
                  </button>

                  <Link href={`/admin/users?user=${selected.id}`} className="linkButton">
                    Open User
                  </Link>

                  <button
                    className="suspendButton"
                    onClick={() => updateUserSuspension(selected, true)}
                    disabled={loadingId === selected.id}
                  >
                    Suspend
                  </button>

                  <button
                    className="clearButton"
                    onClick={() => updateUserSuspension(selected, false)}
                    disabled={loadingId === selected.id}
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a user</h3>
                <p>Choose a user to view intelligence details.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(59,130,246,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container { max-width: 1180px; margin: auto; }

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
        .usersCard,
        .detailsCard {
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
        h1 span, h2, .metricValue, .scoreBox strong { color: #22c55e; }
        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p,
        .detailsBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 92px;
          height: 92px;
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
          font-size: 30px;
          font-weight: 900;
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

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

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
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

        .metricValue { font-size: 24px; font-weight: 900; }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        input,
        select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        select option { color: black; }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.4fr;
          gap: 24px;
        }

        .usersCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .userList {
          display: grid;
          gap: 12px;
        }

        .userRow {
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

        .activeUser {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .userIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .userIcon.high {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .userIcon.medium {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .userInfo { min-width: 0; }

        .userInfo strong,
        .userInfo span,
        .userInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .userInfo span,
        .userInfo small {
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
          font-size: 46px;
          font-weight: 900;
        }

        .detailsBox strong {
          display: block;
          margin-bottom: 8px;
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
        .suspendButton,
        .clearButton,
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

        .reviewButton { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
        .suspendButton { background: linear-gradient(135deg, #ef4444, #991b1b); }
        .clearButton { background: linear-gradient(135deg, #22c55e, #16a34a); }

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
          .stats { grid-template-columns: repeat(3, 1fr); }
          .adminGrid { grid-template-columns: 1fr; }
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
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .userRow {
            grid-template-columns: 46px 1fr;
          }

          .userRow .risk {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .userIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader { flex-direction: column; }
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
