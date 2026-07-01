"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
  suspended?: boolean;
  driverVerified?: boolean;
  verified?: boolean;
};

type Booking = {
  id: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  driverEmail?: string;
  passengerEmail?: string;
  createdAt?: any;
};

type Ride = {
  id: string;
  status?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  price?: number;
  seats?: number;
  createdAt?: any;
};

type SupportTicket = {
  id: string;
  subject?: string;
  priority?: string;
  status?: string;
  userEmail?: string;
  createdAt?: any;
};

type Dispute = {
  id: string;
  status?: string;
  priority?: string;
  amount?: number;
  userEmail?: string;
  driverEmail?: string;
  passengerEmail?: string;
  createdAt?: any;
};

type EmergencyAlert = {
  id: string;
  status?: string;
  priority?: string;
  userEmail?: string;
  createdAt?: any;
};

type Refund = {
  id: string;
  status?: string;
  priority?: string;
  amount?: number;
  userEmail?: string;
  createdAt?: any;
};

type FraudCase = {
  id: string;
  status?: string;
  riskScore?: number;
  userEmail?: string;
  createdAt?: any;
};

type Insight = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  action: string;
  metric: string;
};

export default function AdminAIAssistantPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [fraudCases, setFraudCases] = useState<FraudCase[]>([]);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("Loading AI assistant...");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    let unsubscribeMe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeMe = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const allowed =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          setMessage(allowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMe) unsubscribeMe();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  useEffect(() => {
    if (!adminAllowed) return;

    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserProfile[]);
      setMessage("");
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Booking[]);
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Ride[]);
    });

    const unsubTickets = onSnapshot(query(collection(db, "supportTickets")), (snapshot) => {
      setTickets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as SupportTicket[]);
    });

    const unsubDisputes = onSnapshot(query(collection(db, "disputes")), (snapshot) => {
      setDisputes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Dispute[]);
    });

    const unsubAlerts = onSnapshot(query(collection(db, "emergencyAlerts")), (snapshot) => {
      setAlerts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyAlert[]);
    });

    const unsubRefunds = onSnapshot(query(collection(db, "refundRequests")), (snapshot) => {
      setRefunds(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Refund[]);
    });

    const unsubFraud = onSnapshot(query(collection(db, "fraudCases")), (snapshot) => {
      setFraudCases(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as FraudCase[]);
    });

    return () => {
      unsubUsers();
      unsubBookings();
      unsubRides();
      unsubTickets();
      unsubDisputes();
      unsubAlerts();
      unsubRefunds();
      unsubFraud();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  const intelligence = useMemo(() => {
    const completedBookings = bookings.filter((item) => clean(item.status) === "completed");
    const cancelledBookings = bookings.filter((item) =>
      ["cancelled", "rejected", "no_show"].includes(clean(item.status))
    );

    const activeRides = rides.filter((item) => ["active", "full"].includes(clean(item.status)));
    const openTickets = tickets.filter((item) => clean(item.status) !== "closed");
    const urgentTickets = tickets.filter((item) => clean(item.priority) === "urgent");
    const openDisputes = disputes.filter((item) =>
      ["open", "reviewing", ""].includes(clean(item.status))
    );
    const urgentDisputes = disputes.filter((item) => clean(item.priority) === "urgent");
    const activeAlerts = alerts.filter((item) => clean(item.status) === "active");
    const criticalAlerts = alerts.filter((item) =>
      ["critical", "life_threatening"].includes(clean(item.priority))
    );
    const pendingRefunds = refunds.filter((item) =>
      ["pending", "approved"].includes(clean(item.status))
    );
    const urgentRefunds = refunds.filter((item) => clean(item.priority) === "urgent");
    const openFraudCases = fraudCases.filter((item) => clean(item.status) !== "reviewed");
    const highRiskFraud = fraudCases.filter((item) => Number(item.riskScore || 0) >= 70);
    const suspendedUsers = users.filter((item) => item.suspended).length;
    const verifiedDrivers = users.filter((item) => item.driverVerified).length;

    const grossRevenue = completedBookings.reduce(
      (total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const refundExposure = pendingRefunds.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const disputeExposure = openDisputes.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const cancellationRate =
      bookings.length > 0 ? (cancelledBookings.length / bookings.length) * 100 : 0;

    const supportLoadScore = Math.min(100, openTickets.length * 7 + urgentTickets.length * 15);
    const riskScore = Math.min(
      100,
      criticalAlerts.length * 25 +
        activeAlerts.length * 12 +
        highRiskFraud.length * 18 +
        openDisputes.length * 8 +
        urgentRefunds.length * 10 +
        cancellationRate
    );

    const growthScore = Math.max(
      0,
      Math.min(
        100,
        completedBookings.length * 4 +
          activeRides.length * 3 +
          verifiedDrivers * 2 -
          cancellationRate -
          supportLoadScore * 0.25
      )
    );

    const insights: Insight[] = [];

    if (criticalAlerts.length > 0) {
      insights.push({
        id: "critical-sos",
        title: "Critical SOS activity needs immediate review",
        description: `${criticalAlerts.length} critical emergency alert(s) are present. Safety cases should be handled before growth or finance tasks.`,
        category: "Safety",
        severity: "critical",
        action: "Open Admin SOS Center",
        metric: `${criticalAlerts.length} critical`,
      });
    }

    if (highRiskFraud.length > 0) {
      insights.push({
        id: "fraud-risk",
        title: "High-risk fraud cases detected",
        description: `${highRiskFraud.length} fraud case(s) have a risk score of seventy or higher. Review them before approving payouts.`,
        category: "Fraud",
        severity: "high",
        action: "Review Fraud Center",
        metric: `${highRiskFraud.length} high risk`,
      });
    }

    if (urgentTickets.length > 0) {
      insights.push({
        id: "urgent-support",
        title: "Urgent support tickets are waiting",
        description: `${urgentTickets.length} urgent ticket(s) may affect user trust and retention.`,
        category: "Support",
        severity: "high",
        action: "Prioritize Support Center",
        metric: `${urgentTickets.length} urgent`,
      });
    }

    if (openDisputes.length > 0) {
      insights.push({
        id: "open-disputes",
        title: "Disputes are increasing operational risk",
        description: `${openDisputes.length} open dispute(s) with estimated exposure of ${money(disputeExposure)}.`,
        category: "Disputes",
        severity: openDisputes.length >= 5 ? "high" : "medium",
        action: "Review Disputes",
        metric: money(disputeExposure),
      });
    }

    if (pendingRefunds.length > 0) {
      insights.push({
        id: "refund-exposure",
        title: "Refund exposure requires finance review",
        description: `${pendingRefunds.length} pending refund request(s) total ${money(refundExposure)}.`,
        category: "Finance",
        severity: refundExposure >= 500 ? "high" : "medium",
        action: "Open Refunds Center",
        metric: money(refundExposure),
      });
    }

    if (cancellationRate >= 20) {
      insights.push({
        id: "cancellations",
        title: "Cancellation rate is above healthy range",
        description: `Cancellation rate is ${cancellationRate.toFixed(1)}%. Review pricing, driver reliability and booking flow.`,
        category: "Operations",
        severity: "medium",
        action: "Review Trips and Pricing",
        metric: `${cancellationRate.toFixed(1)}%`,
      });
    }

    if (verifiedDrivers < 5) {
      insights.push({
        id: "drivers",
        title: "Driver supply needs attention",
        description: `Only ${verifiedDrivers} verified driver(s) found. Driver acquisition should be a priority before larger marketing campaigns.`,
        category: "Growth",
        severity: "medium",
        action: "Launch Driver Campaign",
        metric: `${verifiedDrivers} drivers`,
      });
    }

    if (grossRevenue > 0) {
      insights.push({
        id: "revenue",
        title: "Revenue engine is active",
        description: `Completed bookings generated ${money(grossRevenue)} gross revenue. Use Finance and Revenue Center to track growth.`,
        category: "Revenue",
        severity: "low",
        action: "Review Revenue Center",
        metric: money(grossRevenue),
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "healthy",
        title: "No urgent AI recommendations",
        description: "RoadLink looks stable based on current support, safety, finance and fraud signals.",
        category: "System",
        severity: "low",
        action: "Continue monitoring",
        metric: "Stable",
      });
    }

    return {
      completedBookings,
      activeRides,
      openTickets,
      urgentTickets,
      openDisputes,
      activeAlerts,
      criticalAlerts,
      pendingRefunds,
      openFraudCases,
      highRiskFraud,
      suspendedUsers,
      verifiedDrivers,
      grossRevenue,
      refundExposure,
      disputeExposure,
      cancellationRate,
      supportLoadScore,
      riskScore,
      growthScore,
      insights,
    };
  }, [users, bookings, rides, tickets, disputes, alerts, refunds, fraudCases]);

  const filteredInsights = useMemo(() => {
    if (filter === "all") return intelligence.insights;
    return intelligence.insights.filter(
      (item) => clean(item.category) === filter || item.severity === filter
    );
  }, [intelligence.insights, filter]);

  async function saveInsight(insight: Insight) {
    try {
      setSavingId(insight.id);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "aiRecommendations"), {
        ...insight,
        createdAt: now,
        createdBy: auth.currentUser?.email || "",
        status: "open",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "AI Recommendation Saved",
        targetType: "aiRecommendation",
        targetId: insight.id,
        details: insight.description,
        severity: insight.severity === "critical" ? "critical" : insight.severity === "high" ? "warning" : "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: insight.severity === "low",
      });

      setMessage("AI recommendation saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save recommendation.");
    } finally {
      setSavingId("");
    }
  }

  function severityClass(value: string) {
    if (value === "critical") return "severity critical";
    if (value === "high") return "severity high";
    if (value === "medium") return "severity medium";
    return "severity low";
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>AI <span>Assistant</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/fraud-center" className="navButton">Fraud</Link>
          <Link href="/admin/moderation" className="navButton">Moderation</Link>
          <Link href="/admin/support-center" className="navButton">Support</Link>
          <Link href="/admin/revenue" className="navButton">Revenue</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Executive AI</p>
            <h1>Admin <span>AI Assistant</span></h1>
            <p className="subtitle">
              Intelligent operations center for safety, fraud, support, finance, growth,
              disputes, refunds and platform health recommendations.
            </p>
          </div>

          <div className={intelligence.riskScore >= 70 ? "aiOrb dangerOrb" : "aiOrb"}>
            <strong>{Math.round(intelligence.riskScore)}</strong>
            <span>Risk Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚨" label="Critical SOS" value={String(intelligence.criticalAlerts.length)} />
          <Metric icon="🛡️" label="High Fraud" value={String(intelligence.highRiskFraud.length)} />
          <Metric icon="🎧" label="Open Support" value={String(intelligence.openTickets.length)} />
          <Metric icon="⚖️" label="Disputes" value={String(intelligence.openDisputes.length)} />
          <Metric icon="🔄" label="Refund Exposure" value={money(intelligence.refundExposure)} />
          <Metric icon="📉" label="Cancel Rate" value={`${intelligence.cancellationRate.toFixed(1)}%`} />
          <Metric icon="🚗" label="Verified Drivers" value={String(intelligence.verifiedDrivers)} />
          <Metric icon="📈" label="Growth Score" value={`${Math.round(intelligence.growthScore)}/100`} />
        </section>

        <section className="controls">
          <div>
            <p className="eyebrow">AI Filters</p>
            <h2>Recommendation Feed</h2>
          </div>

          <div className="filterGrid">
            {[
              ["all", "🌐 All"],
              ["critical", "🚨 Critical"],
              ["high", "🔥 High"],
              ["medium", "⚠️ Medium"],
              ["safety", "🛡️ Safety"],
              ["finance", "💰 Finance"],
              ["growth", "📈 Growth"],
              ["support", "🎧 Support"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "filterButton activeFilter" : "filterButton"}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">AI Summary</p>
            <h2>Executive Brief</h2>

            <div className="briefBox">
              <strong>Priority Focus</strong>
              <p>
                {intelligence.riskScore >= 70
                  ? "RoadLink should focus on safety, fraud and urgent support before scaling growth."
                  : intelligence.growthScore >= 70
                  ? "RoadLink shows healthy growth signals. Continue monitoring risk while improving revenue."
                  : "RoadLink is stable but needs more driver supply, completed trips and growth activity."}
              </p>
            </div>

            <Info label="Risk Score" value={`${Math.round(intelligence.riskScore)}/100`} />
            <Info label="Support Load" value={`${Math.round(intelligence.supportLoadScore)}/100`} />
            <Info label="Growth Score" value={`${Math.round(intelligence.growthScore)}/100`} />
            <Info label="Gross Revenue" value={money(intelligence.grossRevenue)} />
            <Info label="Refund Exposure" value={money(intelligence.refundExposure)} />
            <Info label="Dispute Exposure" value={money(intelligence.disputeExposure)} />
          </section>

          <section className="panel">
            <p className="eyebrow">AI Action Map</p>
            <h2>Recommended Navigation</h2>

            <div className="actionLinks">
              <Link href="/admin-sos">🚨 SOS Center</Link>
              <Link href="/admin/fraud-center">🛡️ Fraud Center</Link>
              <Link href="/admin/moderation">🧹 Moderation</Link>
              <Link href="/admin/support-center">🎧 Support</Link>
              <Link href="/admin/disputes">⚖️ Disputes</Link>
              <Link href="/admin/refunds">🔄 Refunds</Link>
              <Link href="/admin/revenue">💰 Revenue</Link>
              <Link href="/admin/campaigns">📢 Campaigns</Link>
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">AI Recommendations</p>
          <h2>{filteredInsights.length} Insights</h2>

          <div className="insightList">
            {filteredInsights.map((insight) => (
              <article key={insight.id} className="insightCard">
                <div className="insightTop">
                  <div>
                    <span className="category">{insight.category}</span>
                    <h3>{insight.title}</h3>
                  </div>

                  <span className={severityClass(insight.severity)}>
                    {insight.severity}
                  </span>
                </div>

                <p>{insight.description}</p>

                <div className="insightMeta">
                  <strong>{insight.metric}</strong>
                  <span>{insight.action}</span>
                </div>

                <button onClick={() => saveInsight(insight)} disabled={savingId === insight.id}>
                  {savingId === insight.id ? "Saving..." : "Save Recommendation"}
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <Styles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 130px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 35%),
          radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container { max-width: 1240px; margin: auto; }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .hero,
      .metric,
      .panel,
      .controls,
      .insightCard,
      .locked {
        background: rgba(8,13,25,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 35px;
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
      }

      .eyebrow {
        color: #22c55e;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 { margin: 0 0 16px; font-size: 60px; line-height: 1; }

      h1 span,
      h2,
      .metric strong,
      .aiOrb strong,
      .insightMeta strong {
        color: #22c55e;
      }

      .subtitle,
      .locked p,
      .briefBox p,
      .insightCard p {
        color: #a1a1aa;
        line-height: 1.5;
        margin: 0;
      }

      .aiOrb {
        min-width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .dangerOrb {
        background: rgba(239,68,68,0.13);
        border-color: rgba(239,68,68,0.35);
      }

      .dangerOrb strong { color: #fca5a5; }
      .aiOrb strong { font-size: 42px; }
      .aiOrb span { color: #d4d4d8; font-weight: 900; font-size: 12px; }

      .message { color: #22c55e; text-align: center; font-weight: 900; }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric { padding: 18px; border-radius: 22px; }
      .metricIcon { font-size: 24px; margin-bottom: 8px; }
      .metric span { display: block; color: #a1a1aa; font-size: 12px; font-weight: 900; margin-bottom: 6px; }
      .metric strong { font-size: 22px; overflow-wrap: anywhere; }

      .controls {
        border-radius: 30px;
        padding: 22px;
        margin-bottom: 20px;
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 14px;
        align-items: center;
      }

      .filterGrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      button {
        width: 100%;
        padding: 14px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .filterButton {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .activeFilter {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      button:disabled { opacity: 0.55; cursor: not-allowed; }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      .briefBox {
        padding: 18px;
        border-radius: 20px;
        background: rgba(34,197,94,0.08);
        border: 1px solid rgba(34,197,94,0.28);
        margin-bottom: 18px;
      }

      .briefBox strong {
        display: block;
        color: #22c55e;
        margin-bottom: 8px;
      }

      .info {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        margin-bottom: 10px;
      }

      .info span {
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
      }

      .info strong {
        color: white;
        overflow-wrap: anywhere;
      }

      .actionLinks {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .actionLinks a {
        text-decoration: none;
        color: white;
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        font-weight: 900;
      }

      .insightList {
        display: grid;
        gap: 14px;
      }

      .insightCard {
        border-radius: 24px;
        padding: 22px;
        box-shadow: none;
      }

      .insightTop {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .category {
        color: #22c55e;
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .insightCard h3 {
        margin: 6px 0 0;
        font-size: 22px;
      }

      .severity {
        padding: 8px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        text-transform: capitalize;
        white-space: nowrap;
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

      .insightMeta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        margin: 16px 0;
      }

      .insightMeta span {
        color: #a1a1aa;
        font-weight: 900;
      }

      @media (max-width: 1050px) {
        .hero,
        .controls,
        .grid,
        .insightTop,
        .insightMeta {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .filterGrid,
        .actionLinks {
          grid-template-columns: 1fr;
        }

        h1 { font-size: 44px; }
      }

      @media (max-width: 650px) {
        .page { padding: 16px; padding-bottom: 120px; }

        .hero,
        .panel,
        .controls {
          padding: 22px;
          border-radius: 26px;
        }

        .info {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
            }
