"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type RiskLevel = "low" | "medium" | "high" | "critical";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  verified?: boolean;
  driverVerified?: boolean;
  suspended?: boolean;
  online?: boolean;
  lastSeen?: string;
  createdAt?: string;
};

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
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

type DisputeItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  priority?: string;
  status?: string;
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

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  rideId?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type LiveLocation = {
  id: string;
  userId?: string;
  userEmail?: string;
  rideId?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
  createdAt?: string;
};

type AIRiskCase = {
  id: string;
  userId: string;
  name: string;
  email: string;
  score: number;
  risk: RiskLevel;
  category: "fraud" | "safety" | "payment" | "gps" | "trust";
  recommendation: string;
  reason: string;
  reports: number;
  disputes: number;
  cancellations: number;
  pendingPayoutAmount: number;
  activeSOS: number;
  gpsWarnings: number;
  suspended: boolean;
};

export default function AdminAIRiskPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [selected, setSelected] = useState<AIRiskCase | null>(null);
  const [filter, setFilter] = useState<"all" | RiskLevel | AIRiskCase["category"]>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading AI risk engine...");
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
    const unsubDisputes = listen("disputes", setDisputes);
    const unsubPayouts = listen("payoutRequests", setPayouts);
    const unsubAlerts = listen("emergencyAlerts", setAlerts);
    const unsubLocations = listen("liveLocations", setLocations);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubDisputes();
      unsubPayouts();
      unsubAlerts();
      unsubLocations();
    };
  }, []);

  const riskCases = useMemo<AIRiskCase[]>(() => {
    return users
      .map((user) => {
        const email = user.email || "No email";

        const userReports = reports.filter(
          (item) =>
            item.targetUserId === user.id ||
            item.targetUserEmail === user.email ||
            item.reporterId === user.id ||
            item.reporterEmail === user.email
        );

        const reportsAgainst = reports.filter(
          (item) => item.targetUserId === user.id || item.targetUserEmail === user.email
        );

        const userDisputes = disputes.filter(
          (item) =>
            item.userId === user.id ||
            item.userEmail === user.email ||
            item.driverId === user.id ||
            item.driverEmail === user.email ||
            item.passengerId === user.id ||
            item.passengerEmail === user.email
        );

        const userBookings = bookings.filter(
          (item) =>
            item.passengerId === user.id ||
            item.passengerEmail === user.email ||
            item.driverId === user.id ||
            item.driverEmail === user.email
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

        const pendingPayouts = userPayouts.filter(
          (item) => item.status === "pending" || item.status === "approved"
        );

        const pendingPayoutAmount = pendingPayouts.reduce(
          (total, item) => total + Number(item.amount || 0),
          0
        );

        const userAlerts = alerts.filter(
          (item) =>
            item.status === "active" &&
            (item.userId === user.id || item.userEmail === user.email)
        );

        const userLocations = locations.filter(
          (item) => item.userId === user.id || item.userEmail === user.email
        );

        const gpsWarnings = userLocations.filter((item) => {
          const hasGps =
            typeof item.latitude === "number" && typeof item.longitude === "number";

          if (!hasGps) return true;

          const value = item.updatedAt || item.createdAt;
          if (!value) return true;

          const age = Date.now() - new Date(value).getTime();
          return !Number.isNaN(age) && age > 45 * 60 * 1000;
        }).length;

        const urgentReports = userReports.filter(
          (item) => item.priority === "urgent" || item.priority === "critical"
        ).length;

        const urgentDisputes = userDisputes.filter(
          (item) => item.priority === "urgent" || item.priority === "critical"
        ).length;

        let score = 0;

        score += reportsAgainst.length * 16;
        score += userDisputes.length * 14;
        score += cancelledBookings.length * 9;
        score += urgentReports * 18;
        score += urgentDisputes * 18;
        score += pendingPayouts.length * 7;
        score += userAlerts.length * 35;
        score += gpsWarnings * 8;

        if (pendingPayoutAmount >= 300) score += 12;
        if (pendingPayoutAmount >= 700) score += 18;
        if (user.suspended) score += 30;
        if (!user.driverVerified && userPayouts.length > 0) score += 15;
        if (!user.verified && userBookings.length > 3) score += 7;

        score = Math.min(score, 100);

        const risk: RiskLevel =
          score >= 90 ? "critical" : score >= 70 ? "high" : score >= 35 ? "medium" : "low";

        let category: AIRiskCase["category"] = "trust";

        if (userAlerts.length > 0 || urgentReports > 0) category = "safety";
        else if (pendingPayoutAmount >= 300 || (!user.driverVerified && userPayouts.length > 0)) category = "payment";
        else if (gpsWarnings > 0) category = "gps";
        else if (userDisputes.length > 0 || cancelledBookings.length > 1) category = "fraud";

        const reasons: string[] = [];

        if (reportsAgainst.length > 0) reasons.push(`${reportsAgainst.length} report(s) against user`);
        if (userDisputes.length > 0) reasons.push(`${userDisputes.length} dispute(s)`);
        if (cancelledBookings.length > 0) reasons.push(`${cancelledBookings.length} cancellation/no-show signal(s)`);
        if (pendingPayouts.length > 0) reasons.push(`${pendingPayouts.length} pending payout(s)`);
        if (pendingPayoutAmount >= 300) reasons.push(`payout exposure $${Math.round(pendingPayoutAmount)}`);
        if (userAlerts.length > 0) reasons.push(`${userAlerts.length} active SOS alert(s)`);
        if (gpsWarnings > 0) reasons.push(`${gpsWarnings} GPS warning(s)`);
        if (user.suspended) reasons.push("account suspended");
        if (reasons.length === 0) reasons.push("no major AI risk pattern detected");

        const recommendation =
          risk === "critical"
            ? "Suspend or review immediately before allowing trips or payouts."
            : risk === "high"
            ? "Manual review required before payouts, driving, or high-value bookings."
            : risk === "medium"
            ? "Monitor account and review recent reports, disputes, GPS and bookings."
            : "No immediate action needed.";

        return {
          id: user.id,
          userId: user.id,
          name: user.name || "RoadLink User",
          email,
          score,
          risk,
          category,
          recommendation,
          reason: reasons.join(", "),
          reports: reportsAgainst.length,
          disputes: userDisputes.length,
          cancellations: cancelledBookings.length,
          pendingPayoutAmount,
          activeSOS: userAlerts.length,
          gpsWarnings,
          suspended: Boolean(user.suspended),
        };
      })
      .filter(
        (item) =>
          item.score > 0 ||
          item.reports > 0 ||
          item.disputes > 0 ||
          item.cancellations > 0 ||
          item.activeSOS > 0 ||
          item.gpsWarnings > 0 ||
          item.suspended
      )
      .sort((a, b) => b.score - a.score);
  }, [users, bookings, reports, disputes, payouts, alerts, locations]);

  const filteredCases = useMemo(() => {
    const text = search.toLowerCase().trim();

    return riskCases.filter((item) => {
      const matchesSearch =
        !text ||
        item.name.toLowerCase().includes(text) ||
        item.email.toLowerCase().includes(text) ||
        item.userId.toLowerCase().includes(text) ||
        item.reason.toLowerCase().includes(text) ||
        item.category.toLowerCase().includes(text);

      const matchesFilter =
        filter === "all" || item.risk === filter || item.category === filter;

      return matchesSearch && matchesFilter;
    });
  }, [riskCases, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredCases.length === 0) return null;
      if (!current) return filteredCases[0];
      return filteredCases.find((item) => item.id === current.id) || filteredCases[0];
    });
  }, [filteredCases]);

  const critical = riskCases.filter((item) => item.risk === "critical").length;
  const high = riskCases.filter((item) => item.risk === "high").length;
  const medium = riskCases.filter((item) => item.risk === "medium").length;
  const low = riskCases.filter((item) => item.risk === "low").length;

  const platformRisk =
    riskCases.length === 0
      ? 0
      : Math.round(riskCases.reduce((total, item) => total + item.score, 0) / riskCases.length);

  async function saveRiskCase(item: AIRiskCase) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "aiRiskCases", item.id),
        {
          ...item,
          status: "open",
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", item.userId),
        {
          aiRiskScore: item.score,
          aiRiskLevel: item.risk,
          aiRiskCategory: item.category,
          aiRiskReason: item.reason,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `ai-risk-${item.id}-${Date.now()}`),
        {
          userId: item.userId,
          userEmail: item.email,
          action: "AI Risk Case Saved",
          targetId: item.id,
          targetType: "aiRisk",
          details: item.reason,
          severity: item.risk === "critical" || item.risk === "high" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("AI risk case saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save AI risk case.");
    } finally {
      setLoadingId("");
    }
  }

  async function markForReview(item: AIRiskCase) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.userId),
        {
          aiReviewStatus: "manual_review",
          aiRiskScore: item.score,
          aiRiskLevel: item.risk,
          aiRiskCategory: item.category,
          aiRiskReason: item.reason,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `ai-risk-review-${item.id}-${Date.now()}`),
        {
          userId: item.userId,
          userEmail: item.email,
          action: "User Marked For AI Risk Review",
          targetId: item.id,
          targetType: "user",
          details: item.reason,
          severity: item.risk === "critical" || item.risk === "high" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("User marked for AI risk review.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not mark user for review.");
    } finally {
      setLoadingId("");
    }
  }

  function riskLabel(risk: RiskLevel) {
    if (risk === "critical") return "Critical";
    if (risk === "high") return "High Risk";
    if (risk === "medium") return "Medium Risk";
    return "Low Risk";
  }

  function categoryLabel(value: AIRiskCase["category"]) {
    if (value === "fraud") return "Fraud";
    if (value === "safety") return "Safety";
    if (value === "payment") return "Payment";
    if (value === "gps") return "GPS";
    return "Trust";
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
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/trust-score" className="miniButton">Trust Score</Link>
          <Link href="/admin/geofence" className="miniButton">Geofence</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink AI Safety</p>
            <h1>AI Risk <span>Center</span></h1>
            <p className="subtitle">
              Detect high-risk users using reports, disputes, cancellations, payouts,
              GPS warnings, SOS alerts, verification status and trust signals.
            </p>
          </div>

          <div className={platformRisk >= 60 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{platformRisk}</strong>
            <span>Risk Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🤖" label="Risk Cases" value={String(riskCases.length)} />
          <Metric icon="🚨" label="Critical" value={String(critical)} danger={critical > 0} />
          <Metric icon="⚠️" label="High" value={String(high)} danger={high > 0} />
          <Metric icon="👀" label="Medium" value={String(medium)} danger={medium > 0} />
          <Metric icon="✅" label="Low" value={String(low)} />
          <Metric icon="📊" label="Platform Risk" value={String(platformRisk)} danger={platformRisk >= 60} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user, email, reason or category..."
          />

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as "all" | RiskLevel | AIRiskCase["category"])
            }
          >
            <option value="all">All cases</option>
            <option value="critical">Critical</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
            <option value="low">Low risk</option>
            <option value="fraud">Fraud</option>
            <option value="safety">Safety</option>
            <option value="payment">Payment</option>
            <option value="gps">GPS</option>
            <option value="trust">Trust</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="queueCard">
            <p className="eyebrow">AI Risk Queue</p>
            <h2>Detected Risk Cases</h2>

            {filteredCases.length === 0 ? (
              <div className="empty">
                <h3>No AI risk cases</h3>
                <p>No users match this search or risk filter.</p>
              </div>
            ) : (
              <div className="caseList">
                {filteredCases.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "caseRow activeCase" : "caseRow"}
                  >
                    <div className={`caseIcon ${item.risk}`}>
                      {item.risk === "critical"
                        ? "🚨"
                        : item.risk === "high"
                        ? "⚠️"
                        : item.risk === "medium"
                        ? "👀"
                        : "🤖"}
                    </div>

                    <div className="caseInfo">
                      <strong>{shortText(item.email)}</strong>
                      <span>{categoryLabel(item.category)} • Score {item.score}/100</span>
                      <small>{item.reason}</small>
                    </div>

                    <em className={`risk ${item.risk}`}>{riskLabel(item.risk)}</em>
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
                    <p className="eyebrow">Selected AI Case</p>
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`riskPill ${selected.risk}`}>
                    {riskLabel(selected.risk)}
                  </span>
                </div>

                <div className={`riskBox ${selected.risk}`}>
                  <span>{categoryLabel(selected.category)} Risk</span>
                  <strong>{selected.score}/100</strong>
                  <p>{selected.recommendation}</p>
                </div>

                <div className="reasonBox">
                  <strong>AI Reason</strong>
                  <p>{selected.reason}</p>
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.userId} />
                  <Info label="Category" value={categoryLabel(selected.category)} />
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="Disputes" value={String(selected.disputes)} />
                  <Info label="Cancellations / No Shows" value={String(selected.cancellations)} />
                  <Info label="Pending Payout Exposure" value={`$${Math.round(selected.pendingPayoutAmount)}`} />
                  <Info label="Active SOS" value={String(selected.activeSOS)} />
                  <Info label="GPS Warnings" value={String(selected.gpsWarnings)} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Risk Level" value={riskLabel(selected.risk)} />
                </div>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveRiskCase(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Case
                  </button>

                  <button
                    className="reviewButton"
                    onClick={() => markForReview(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Manual Review
                  </button>

                  <Link href={`/admin/users?user=${selected.userId}`} className="linkButton">
                    Open User
                  </Link>

                  <Link href="/admin/fraud" className="dangerButton">
                    Fraud Center
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a risk case</h3>
                <p>Choose a case to view AI risk details.</p>
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
          color: #ef4444;
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
          color: #ef4444;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .email,
        .empty p,
        .riskBox p,
        .reasonBox p {
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
          background: rgba(239,68,68,0.13);
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

        .caseList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .caseRow {
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

        .activeCase {
          border-color: rgba(239,68,68,0.45);
          background: rgba(239,68,68,0.1);
        }

        .caseIcon {
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

        .caseIcon.medium {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .caseIcon.high,
        .caseIcon.critical {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .caseInfo { min-width: 0; }

        .caseInfo strong,
        .caseInfo span,
        .caseInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .caseInfo span,
        .caseInfo small {
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

        .risk.low,
        .riskPill.low {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .risk.medium,
        .riskPill.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .risk.high,
        .riskPill.high,
        .risk.critical,
        .riskPill.critical {
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

        .riskBox,
        .reasonBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .riskBox.medium {
          background: rgba(250,204,21,0.1);
          border-color: rgba(250,204,21,0.35);
        }

        .riskBox.high,
        .riskBox.critical {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .reasonBox {
          background: rgba(59,130,246,0.1);
          border-color: rgba(59,130,246,0.35);
        }

        .riskBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .riskBox strong {
          color: #22c55e;
          font-size: 46px;
          font-weight: 900;
        }

        .riskBox.medium strong {
          color: #fde68a;
        }

        .riskBox.high strong,
        .riskBox.critical strong {
          color: #fca5a5;
        }

        .reasonBox strong {
          display: block;
          color: #93c5fd;
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
          display: block;
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .saveButton,
        .reviewButton,
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

        .reviewButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .linkButton {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
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

          .caseRow {
            grid-template-columns: 46px 1fr;
          }

          .caseRow .risk {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .caseIcon {
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
