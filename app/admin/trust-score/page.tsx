"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  verified?: boolean;
  driverVerified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
};

type BookingItem = {
  id: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
};

type ReportItem = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  priority?: string;
  status?: string;
};

type RatingItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  driverId?: string;
  driverEmail?: string;
  rating?: number;
};

type SupportTicket = {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  priority?: string;
};

type TrustProfile = {
  id: string;
  name: string;
  email: string;
  score: number;
  level: "excellent" | "good" | "watch" | "risk" | "critical";
  verified: boolean;
  driverVerified: boolean;
  suspended: boolean;
  rides: number;
  completedRides: number;
  bookings: number;
  completedBookings: number;
  cancelledActivity: number;
  reportsAgainst: number;
  reportsMade: number;
  averageRating: number;
  supportTickets: number;
  reason: string;
};

export default function AdminTrustScorePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<TrustProfile | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | TrustProfile["level"]>("all");
  const [message, setMessage] = useState("Loading trust scores...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const listen = (name: string, setter: (items: any[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
          setMessage("");
        },
        () => setter([])
      );

    const unsubUsers = listen("users", setUsers);
    const unsubRides = listen("rides", setRides);
    const unsubBookings = listen("bookings", setBookings);
    const unsubReports = listen("reports", setReports);
    const unsubRatings = listen("ratings", setRatings);
    const unsubTickets = listen("supportTickets", setTickets);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubRatings();
      unsubTickets();
    };
  }, []);

  const profiles = useMemo<TrustProfile[]>(() => {
    return users
      .map((user) => {
        const email = user.email || "No email";

        const userRides = rides.filter(
          (ride) => ride.driverId === user.id || ride.driverEmail === user.email
        );

        const completedRides = userRides.filter((ride) => ride.status === "completed");

        const userBookings = bookings.filter(
          (booking) =>
            booking.passengerId === user.id ||
            booking.passengerEmail === user.email ||
            booking.driverId === user.id ||
            booking.driverEmail === user.email
        );

        const completedBookings = userBookings.filter(
          (booking) => booking.status === "completed"
        );

        const cancelledActivity = userBookings.filter(
          (booking) =>
            booking.status === "cancelled" ||
            booking.status === "rejected" ||
            booking.status === "no_show"
        ).length;

        const reportsAgainst = reports.filter(
          (report) =>
            report.targetUserId === user.id ||
            report.targetUserEmail === user.email
        );

        const reportsMade = reports.filter(
          (report) =>
            report.reporterId === user.id ||
            report.reporterEmail === user.email
        );

        const userRatings = ratings.filter(
          (rating) =>
            rating.userId === user.id ||
            rating.userEmail === user.email ||
            rating.driverId === user.id ||
            rating.driverEmail === user.email
        );

        const averageRating =
          userRatings.length > 0
            ? userRatings.reduce((total, item) => total + Number(item.rating || 0), 0) /
              userRatings.length
            : 5;

        const userTickets = tickets.filter(
          (ticket) => ticket.userId === user.id || ticket.userEmail === user.email
        );

        let score = 70;

        if (user.verified) score += 8;
        if (user.driverVerified) score += 10;
        if (completedBookings.length > 0) score += Math.min(8, completedBookings.length * 2);
        if (completedRides.length > 0) score += Math.min(8, completedRides.length * 2);
        if (averageRating >= 4.8) score += 8;
        else if (averageRating >= 4.5) score += 5;
        else if (averageRating < 4) score -= 12;
        else if (averageRating < 4.5) score -= 6;

        score -= reportsAgainst.length * 14;
        score -= cancelledActivity * 7;
        score -= userTickets.filter((ticket) => ticket.priority === "urgent").length * 5;

        if (user.suspended) score -= 35;

        score = Math.max(Math.min(score, 100), 0);

        const level: TrustProfile["level"] =
          score >= 90
            ? "excellent"
            : score >= 78
            ? "good"
            : score >= 62
            ? "watch"
            : score >= 40
            ? "risk"
            : "critical";

        const reasons: string[] = [];

        if (user.verified) reasons.push("verified account");
        if (user.driverVerified) reasons.push("verified driver");
        if (completedBookings.length > 0) reasons.push(`${completedBookings.length} completed booking(s)`);
        if (completedRides.length > 0) reasons.push(`${completedRides.length} completed ride(s)`);
        if (reportsAgainst.length > 0) reasons.push(`${reportsAgainst.length} report(s) against user`);
        if (cancelledActivity > 0) reasons.push(`${cancelledActivity} cancellation/no-show signal(s)`);
        if (user.suspended) reasons.push("account suspended");
        if (reasons.length === 0) reasons.push("new or limited activity profile");

        return {
          id: user.id,
          name: user.name || "RoadLink User",
          email,
          score,
          level,
          verified: Boolean(user.verified),
          driverVerified: Boolean(user.driverVerified),
          suspended: Boolean(user.suspended),
          rides: userRides.length,
          completedRides: completedRides.length,
          bookings: userBookings.length,
          completedBookings: completedBookings.length,
          cancelledActivity,
          reportsAgainst: reportsAgainst.length,
          reportsMade: reportsMade.length,
          averageRating,
          supportTickets: userTickets.length,
          reason: reasons.join(", "),
        };
      })
      .sort((a, b) => a.score - b.score);
  }, [users, rides, bookings, reports, ratings, tickets]);

  const filteredProfiles = useMemo(() => {
    const text = search.toLowerCase().trim();

    return profiles.filter((item) => {
      const matchesSearch =
        !text ||
        item.name.toLowerCase().includes(text) ||
        item.email.toLowerCase().includes(text) ||
        item.id.toLowerCase().includes(text) ||
        item.reason.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || item.level === filter;

      return matchesSearch && matchesFilter;
    });
  }, [profiles, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredProfiles.length === 0) return null;
      if (!current) return filteredProfiles[0];
      return filteredProfiles.find((item) => item.id === current.id) || filteredProfiles[0];
    });
  }, [filteredProfiles]);

  const excellent = profiles.filter((item) => item.level === "excellent").length;
  const good = profiles.filter((item) => item.level === "good").length;
  const watch = profiles.filter((item) => item.level === "watch").length;
  const risk = profiles.filter((item) => item.level === "risk").length;
  const critical = profiles.filter((item) => item.level === "critical").length;

  const averageTrust =
    profiles.length === 0
      ? 100
      : Math.round(profiles.reduce((total, item) => total + item.score, 0) / profiles.length);

  async function saveTrustScore(item: TrustProfile) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.id),
        {
          trustScore: item.score,
          trustLevel: item.level,
          trustReason: item.reason,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `trust-score-${item.id}-${Date.now()}`),
        {
          userId: item.id,
          userEmail: item.email,
          action: "Trust Score Saved",
          targetId: item.id,
          targetType: "user",
          details: `Trust score ${item.score}/100. ${item.reason}`,
          severity: item.level === "critical" || item.level === "risk" ? "warning" : "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Trust score saved to user profile.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save trust score.");
    } finally {
      setLoadingId("");
    }
  }

  async function markForReview(item: TrustProfile) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.id),
        {
          trustScore: item.score,
          trustLevel: item.level,
          trustReviewStatus: "manual_review",
          trustReason: item.reason,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `trust-review-${item.id}-${Date.now()}`),
        {
          userId: item.id,
          userEmail: item.email,
          action: "User Marked For Trust Review",
          targetId: item.id,
          targetType: "user",
          details: item.reason,
          severity: item.level === "critical" || item.level === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("User marked for trust review.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not mark for review.");
    } finally {
      setLoadingId("");
    }
  }

  function levelLabel(level: TrustProfile["level"]) {
    if (level === "excellent") return "Excellent";
    if (level === "good") return "Good";
    if (level === "watch") return "Watch";
    if (level === "risk") return "Risk";
    return "Critical";
  }

  function shortText(value?: string, max = 42) {
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
          <Link href="/admin/user-intelligence" className="miniButton">User Intelligence</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/reports" className="miniButton dangerLink">Reports</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Trust & Safety</p>
            <h1>Trust <span>Score</span></h1>
            <p className="subtitle">
              Calculate trust scores using verification, rides, bookings, ratings, reports,
              cancellations, support activity and account status.
            </p>
          </div>

          <div className={averageTrust < 75 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{averageTrust}</strong>
            <span>Average Trust</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users Scanned" value={String(profiles.length)} />
          <Metric icon="🏅" label="Excellent" value={String(excellent)} />
          <Metric icon="✅" label="Good" value={String(good)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="⚠️" label="Risk" value={String(risk)} danger={risk > 0} />
          <Metric icon="🚨" label="Critical" value={String(critical)} danger={critical > 0} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user, email, UID or reason..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | TrustProfile["level"])}
          >
            <option value="all">All levels</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="watch">Watch</option>
            <option value="risk">Risk</option>
            <option value="critical">Critical</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="queueCard">
            <p className="eyebrow">Trust Queue</p>
            <h2>User Trust Profiles</h2>

            {filteredProfiles.length === 0 ? (
              <div className="empty">
                <h3>No trust profiles found</h3>
                <p>No users match this search or filter.</p>
              </div>
            ) : (
              <div className="profileList">
                {filteredProfiles.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "profileRow activeProfile" : "profileRow"}
                  >
                    <div className={`profileIcon ${item.level}`}>
                      {item.level === "excellent"
                        ? "🏅"
                        : item.level === "good"
                        ? "✅"
                        : item.level === "watch"
                        ? "👀"
                        : item.level === "risk"
                        ? "⚠️"
                        : "🚨"}
                    </div>

                    <div className="profileInfo">
                      <strong>{shortText(item.name)}</strong>
                      <span>{shortText(item.email)}</span>
                      <small>Score {item.score}/100 • {item.reason}</small>
                    </div>

                    <em className={`level ${item.level}`}>{levelLabel(item.level)}</em>
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
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`levelPill ${selected.level}`}>
                    {levelLabel(selected.level)}
                  </span>
                </div>

                <div className={`trustBox ${selected.level}`}>
                  <span>Trust Score</span>
                  <strong>{selected.score}/100</strong>
                  <p>{selected.reason}</p>
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.id} />
                  <Info label="Verified" value={selected.verified ? "Yes" : "No"} />
                  <Info label="Driver Verified" value={selected.driverVerified ? "Yes" : "No"} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Total Rides" value={String(selected.rides)} />
                  <Info label="Completed Rides" value={String(selected.completedRides)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed Bookings" value={String(selected.completedBookings)} />
                  <Info label="Cancellations / No Shows" value={String(selected.cancelledActivity)} />
                  <Info label="Reports Against" value={String(selected.reportsAgainst)} />
                  <Info label="Reports Made" value={String(selected.reportsMade)} />
                  <Info label="Average Rating" value={selected.averageRating.toFixed(1)} />
                  <Info label="Support Tickets" value={String(selected.supportTickets)} />
                  <Info label="Trust Level" value={levelLabel(selected.level)} />
                </div>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveTrustScore(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Score
                  </button>

                  <button
                    className="reviewButton"
                    onClick={() => markForReview(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Manual Review
                  </button>

                  <Link href={`/admin/users?user=${selected.id}`} className="linkButton">
                    Open User
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a user</h3>
                <p>Choose a user to view their trust score.</p>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container { max-width: 1280px; margin: auto; }

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

        .dangerLink {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .hero,
        .metric,
        .filters,
        .queueCard,
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
        .email,
        .empty p,
        .trustBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 96px;
          height: 96px;
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

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
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

        .metricValue {
          font-size: 24px;
          font-weight: 900;
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

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

        select option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .queueCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .profileList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .profileRow {
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

        .activeProfile {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .profileIcon {
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

        .profileIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .profileIcon.risk,
        .profileIcon.critical {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .profileInfo { min-width: 0; }

        .profileInfo strong,
        .profileInfo span,
        .profileInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profileInfo span,
        .profileInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .level,
        .levelPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .level.excellent,
        .levelPill.excellent,
        .level.good,
        .levelPill.good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .level.watch,
        .levelPill.watch {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .level.risk,
        .levelPill.risk,
        .level.critical,
        .levelPill.critical {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .trustBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .trustBox.watch {
          background: rgba(250,204,21,0.1);
          border-color: rgba(250,204,21,0.35);
        }

        .trustBox.risk,
        .trustBox.critical {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .trustBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .trustBox strong {
          color: #22c55e;
          font-size: 46px;
          font-weight: 900;
        }

        .trustBox.risk strong,
        .trustBox.critical strong {
          color: #fca5a5;
        }

        .trustBox.watch strong {
          color: #fde68a;
        }

        .trustBox p {
          margin-bottom: 0;
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
          display: block;
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .saveButton,
        .reviewButton,
        .linkButton {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .saveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .reviewButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
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
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 16px;
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
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

          .profileRow {
            grid-template-columns: 46px 1fr;
          }

          .profileRow .level {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .profileIcon {
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
