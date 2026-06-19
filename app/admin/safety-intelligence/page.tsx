"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type SafetyStatus = "safe" | "stable" | "watch" | "critical";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  suspended?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverId?: string;
  driverEmail?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  rideId?: string;
  priority?: string;
  status?: string;
  reason?: string;
  createdAt?: string;
};

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  rideId?: string;
  status?: string;
  priority?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
};

type RatingItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  driverId?: string;
  driverEmail?: string;
  rating?: number;
  createdAt?: string;
};

type SafetySignal = {
  id: string;
  title: string;
  type: "platform" | "route" | "user";
  score: number;
  status: SafetyStatus;
  reports: number;
  urgentReports: number;
  activeSOS: number;
  cancelledTrips: number;
  lowRatings: number;
  suspendedUsers: number;
  affectedRides: number;
  insight: string;
};

export default function AdminSafetyIntelligencePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [selected, setSelected] = useState<SafetySignal | null>(null);
  const [filter, setFilter] = useState<"all" | SafetyStatus>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading safety intelligence...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => setter([])
      );

    const unsubUsers = listen<UserItem>("users", setUsers);
    const unsubRides = listen<RideItem>("rides", setRides);
    const unsubBookings = listen<BookingItem>("bookings", setBookings);
    const unsubReports = listen<ReportItem>("reports", setReports);
    const unsubAlerts = listen<EmergencyAlert>("emergencyAlerts", setAlerts);
    const unsubRatings = listen<RatingItem>("ratings", setRatings);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubAlerts();
      unsubRatings();
    };
  }, []);

  const signals = useMemo<SafetySignal[]>(() => {
    function getStatus(score: number): SafetyStatus {
      if (score >= 85) return "safe";
      if (score >= 70) return "stable";
      if (score >= 45) return "watch";
      return "critical";
    }

    function getInsight(status: SafetyStatus, type: string) {
      if (status === "safe") return `${type} safety looks strong. Continue monitoring normally.`;
      if (status === "stable") return `${type} safety is stable, but keep reviewing reports and ratings.`;
      if (status === "watch") return `${type} needs attention due to reports, SOS alerts or cancellations.`;
      return `${type} is critical. Review immediately and consider operational restrictions.`;
    }

    const activeSOS = alerts.filter((item) => item.status === "active");
    const urgentReports = reports.filter(
      (item) => item.priority === "urgent" || item.priority === "critical"
    );
    const openReports = reports.filter((item) => !item.status || item.status === "open");
    const cancelledTrips = rides.filter(
      (item) => item.status === "cancelled" || item.status === "rejected"
    );
    const lowRatings = ratings.filter((item) => Number(item.rating || 5) < 4);
    const suspendedUsers = users.filter((item) => item.suspended);

    let platformScore = 100;
    platformScore -= activeSOS.length * 22;
    platformScore -= urgentReports.length * 14;
    platformScore -= openReports.length * 6;
    platformScore -= cancelledTrips.length * 4;
    platformScore -= lowRatings.length * 4;
    platformScore -= suspendedUsers.length * 6;
    platformScore = Math.max(Math.min(platformScore, 100), 0);

    const platformStatus = getStatus(platformScore);

    const platformSignal: SafetySignal = {
      id: "platform-safety",
      title: "RoadLink Platform Safety",
      type: "platform",
      score: platformScore,
      status: platformStatus,
      reports: openReports.length,
      urgentReports: urgentReports.length,
      activeSOS: activeSOS.length,
      cancelledTrips: cancelledTrips.length,
      lowRatings: lowRatings.length,
      suspendedUsers: suspendedUsers.length,
      affectedRides: rides.length,
      insight: getInsight(platformStatus, "Platform"),
    };

    const routeMap = new Map<string, RideItem[]>();

    rides.forEach((ride) => {
      const route = `${ride.from || "Origin"} → ${ride.to || "Destination"}`;
      if (!routeMap.has(route)) routeMap.set(route, []);
      routeMap.get(route)?.push(ride);
    });

    const routeSignals: SafetySignal[] = Array.from(routeMap.entries()).map(([route, routeRides]) => {
      const rideIds = routeRides.map((ride) => ride.id);

      const routeReports = reports.filter((report) => rideIds.includes(report.rideId || ""));
      const routeUrgentReports = routeReports.filter(
        (report) => report.priority === "urgent" || report.priority === "critical"
      );
      const routeSOS = alerts.filter(
        (alert) => alert.status === "active" && rideIds.includes(alert.rideId || "")
      );
      const routeCancelled = routeRides.filter(
        (ride) => ride.status === "cancelled" || ride.status === "rejected"
      );

      let score = 100;
      score -= routeSOS.length * 28;
      score -= routeUrgentReports.length * 16;
      score -= routeReports.length * 8;
      score -= routeCancelled.length * 8;

      score = Math.max(Math.min(score, 100), 0);

      const status = getStatus(score);

      return {
        id: `route-${route.toLowerCase().replaceAll("/", "-")}`,
        title: route,
        type: "route",
        score,
        status,
        reports: routeReports.length,
        urgentReports: routeUrgentReports.length,
        activeSOS: routeSOS.length,
        cancelledTrips: routeCancelled.length,
        lowRatings: 0,
        suspendedUsers: 0,
        affectedRides: routeRides.length,
        insight: getInsight(status, "Route"),
      };
    });

    const userSignals: SafetySignal[] = users
      .map((user) => {
        const userReports = reports.filter(
          (report) =>
            report.targetUserId === user.id ||
            report.targetUserEmail === user.email ||
            report.reporterId === user.id ||
            report.reporterEmail === user.email
        );

        const userUrgentReports = userReports.filter(
          (report) => report.priority === "urgent" || report.priority === "critical"
        );

        const userSOS = alerts.filter(
          (alert) =>
            alert.status === "active" &&
            (alert.userId === user.id || alert.userEmail === user.email)
        );

        const userRatings = ratings.filter(
          (rating) =>
            rating.userId === user.id ||
            rating.userEmail === user.email ||
            rating.driverId === user.id ||
            rating.driverEmail === user.email
        );

        const userLowRatings = userRatings.filter((rating) => Number(rating.rating || 5) < 4);

        const userRides = rides.filter(
          (ride) => ride.driverId === user.id || ride.driverEmail === user.email
        );

        const userBookings = bookings.filter(
          (booking) =>
            booking.passengerId === user.id ||
            booking.passengerEmail === user.email ||
            booking.driverId === user.id ||
            booking.driverEmail === user.email
        );

        if (
          userReports.length === 0 &&
          userSOS.length === 0 &&
          userLowRatings.length === 0 &&
          !user.suspended
        ) {
          return null;
        }

        let score = 100;
        score -= userSOS.length * 30;
        score -= userUrgentReports.length * 18;
        score -= userReports.length * 10;
        score -= userLowRatings.length * 8;
        score -= user.suspended ? 35 : 0;

        score = Math.max(Math.min(score, 100), 0);

        const status = getStatus(score);

        return {
          id: `user-${user.id}`,
          title: user.name || user.email || "RoadLink User",
          type: "user",
          score,
          status,
          reports: userReports.length,
          urgentReports: userUrgentReports.length,
          activeSOS: userSOS.length,
          cancelledTrips: 0,
          lowRatings: userLowRatings.length,
          suspendedUsers: user.suspended ? 1 : 0,
          affectedRides: userRides.length + userBookings.length,
          insight: getInsight(status, "User"),
        };
      })
      .filter(Boolean) as SafetySignal[];

    return [platformSignal, ...routeSignals, ...userSignals].sort((a, b) => a.score - b.score);
  }, [users, rides, bookings, reports, alerts, ratings]);

  const filteredSignals = useMemo(() => {
    const text = search.toLowerCase().trim();

    return signals.filter((item) => {
      const matchesSearch =
        !text ||
        item.title.toLowerCase().includes(text) ||
        item.type.toLowerCase().includes(text) ||
        item.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [signals, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredSignals.length === 0) return null;
      if (!current) return filteredSignals[0];
      return filteredSignals.find((item) => item.id === current.id) || filteredSignals[0];
    });
  }, [filteredSignals]);

  const platform = signals.find((item) => item.id === "platform-safety");
  const safe = signals.filter((item) => item.status === "safe").length;
  const stable = signals.filter((item) => item.status === "stable").length;
  const watch = signals.filter((item) => item.status === "watch").length;
  const critical = signals.filter((item) => item.status === "critical").length;

  async function saveSafetyInsight(item: SafetySignal) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "safetyIntelligenceInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `safety-intel-${item.id}-${Date.now()}`),
        {
          action: "Safety Intelligence Insight Saved",
          targetId: item.id,
          targetType: "safetyIntelligence",
          details: item.insight,
          severity: item.status === "critical" ? "danger" : item.status === "watch" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Safety intelligence insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save safety insight.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status: SafetyStatus) {
    if (status === "safe") return "Safe";
    if (status === "stable") return "Stable";
    if (status === "watch") return "Watch";
    return "Critical";
  }

  function shortText(value?: string, max = 44) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/safety" className="miniButton">Safety</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/trust-score" className="miniButton">Trust Score</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Safety Intelligence</p>
            <h1>Safety <span>Intelligence</span></h1>
            <p className="subtitle">
              Analyze platform safety, SOS alerts, reports, risky routes, user safety signals,
              low ratings, cancellations and suspended accounts.
            </p>
          </div>

          <div className={critical > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{platform?.score || 100}</strong>
            <span>Safety Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🛡️" label="Safe" value={String(safe)} />
          <Metric icon="✅" label="Stable" value={String(stable)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="🚨" label="Critical" value={String(critical)} danger={critical > 0} />
          <Metric icon="⚠️" label="Reports" value={String(platform?.reports || 0)} danger={(platform?.reports || 0) > 0} />
          <Metric icon="🆘" label="Active SOS" value={String(platform?.activeSOS || 0)} danger={(platform?.activeSOS || 0) > 0} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search safety signal, route, user or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | SafetyStatus)}
          >
            <option value="all">All safety signals</option>
            <option value="safe">Safe</option>
            <option value="stable">Stable</option>
            <option value="watch">Watch</option>
            <option value="critical">Critical</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="safetyCard">
            <p className="eyebrow">Safety Board</p>
            <h2>Risk Signals</h2>

            {filteredSignals.length === 0 ? (
              <div className="empty">
                <h3>No safety signals found</h3>
                <p>Safety signals will appear after reports, SOS alerts or risky activity.</p>
              </div>
            ) : (
              <div className="safetyList">
                {filteredSignals.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "safetyRow activeSafety" : "safetyRow"}
                  >
                    <div className={`safetyIcon ${item.status}`}>
                      {item.status === "safe"
                        ? "🛡️"
                        : item.status === "stable"
                        ? "✅"
                        : item.status === "watch"
                        ? "👀"
                        : "🚨"}
                    </div>

                    <div className="safetyInfo">
                      <strong>{shortText(item.title)}</strong>
                      <span>{item.type.toUpperCase()} • Score {item.score}/100</span>
                      <small>{item.reports} report(s) • {item.activeSOS} SOS</small>
                    </div>

                    <em className={`status ${item.status}`}>
                      {statusLabel(item.status)}
                    </em>
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
                    <p className="eyebrow">Selected Safety Signal</p>
                    <h2>{shortText(selected.title, 54)}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Safety Score</span>
                  <strong>{selected.score}/100</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.score}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Type" value={selected.type} />
                  <Info label="Safety Score" value={`${selected.score}/100`} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="Urgent Reports" value={String(selected.urgentReports)} />
                  <Info label="Active SOS" value={String(selected.activeSOS)} />
                  <Info label="Cancelled Trips" value={String(selected.cancelledTrips)} />
                  <Info label="Low Ratings" value={String(selected.lowRatings)} />
                  <Info label="Suspended Users" value={String(selected.suspendedUsers)} />
                  <Info label="Affected Rides / Activity" value={String(selected.affectedRides)} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Safety Recommendation</p>
                  <h2>
                    {selected.status === "critical"
                      ? "Immediate review required"
                      : selected.status === "watch"
                      ? "Monitor closely"
                      : "Normal monitoring"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveSafetyInsight(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/emergency" className="dangerButton">SOS</Link>
                  <Link href="/admin/reports" className="linkButton">Reports</Link>
                  <Link href="/admin/trust-score" className="linkButton">Trust Score</Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select safety signal</h3>
                <p>Choose a safety signal to view details.</p>
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
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 35%),
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
        .safetyCard,
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
        h1 span, h2, .metricValue { color: #22c55e; }
        h2 { font-size: 30px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p,
        .insightBox p,
        .summaryBox p {
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

        .warningScore strong { color: #fca5a5; }

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
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .dangerMetric .metricValue { color: #ef4444; }

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
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .safetyCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .safetyList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .safetyRow {
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

        .activeSafety {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .safetyIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .safetyIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .safetyIcon.critical {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .safetyInfo { min-width: 0; }

        .safetyInfo strong,
        .safetyInfo span,
        .safetyInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .safetyInfo span,
        .safetyInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .status.safe,
        .status.stable,
        .statusPill.safe,
        .statusPill.stable {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.watch,
        .statusPill.watch {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.critical,
        .statusPill.critical {
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

        .insightBox,
        .summaryBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .insightBox.watch {
          background: rgba(250,204,21,0.1);
          border-color: rgba(250,204,21,0.35);
        }

        .insightBox.critical {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .insightBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .insightBox strong {
          color: #22c55e;
          font-size: 42px;
          font-weight: 900;
        }

        .insightBox.watch strong { color: #fde68a; }
        .insightBox.critical strong { color: #fca5a5; }

        .scoreBar {
          width: 100%;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .scoreBar div {
          height: 100%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 999px;
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
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .saveButton,
        .linkButton,
        .dangerButton {
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

        .linkButton {
          background: rgba(59,130,246,0.13);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
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

          .safetyRow {
            grid-template-columns: 46px 1fr;
          }

          .safetyRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .safetyIcon {
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
