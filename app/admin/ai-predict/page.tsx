"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  driverVerified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type PredictionItem = {
  id: string;
  confidence?: number;
  users30?: number;
  users90?: number;
  users365?: number;
  revenue30?: number;
  revenue90?: number;
  revenue365?: number;
  fraudRisk?: number;
  demandScore?: number;
  supplyScore?: number;
  recommendation?: string;
  createdAt?: string;
  createdBy?: string;
};

export default function AdminAIPredictPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [message, setMessage] = useState("Loading AI predictive analytics...");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
      setMessage("");
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
    });

    const unsubPredictions = onSnapshot(query(collection(db, "aiPredictions")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PredictionItem[];
      data.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      setPredictions(data);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubPayouts();
      unsubPredictions();
    };
  }, []);

  const forecast = useMemo(() => {
    const verifiedDrivers = users.filter((user) => user.driverVerified);
    const suspendedUsers = users.filter((user) => user.suspended);
    const activeRides = rides.filter((ride) =>
      ["active", "open", "full", "in_progress"].includes(String(ride.status || ""))
    );

    const completedBookings = bookings.filter((booking) => booking.status === "completed");
    const cancelledBookings = bookings.filter((booking) =>
      ["cancelled", "rejected", "no_show"].includes(String(booking.status || ""))
    );

    const openReports = reports.filter((report) => !report.status || report.status === "open");
    const urgentReports = reports.filter((report) => report.priority === "urgent" || report.priority === "critical");

    const pendingPayouts = payouts.filter((payout) => payout.status === "pending" || payout.status === "approved");

    const revenue = completedBookings.reduce(
      (total, booking) =>
        total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
      0
    );

    const growthBase = Math.max(users.length, 1);
    const rideDensity = activeRides.length + completedBookings.length;
    const marketplaceBalance =
      verifiedDrivers.length > 0
        ? Math.min(100, Math.round((activeRides.length / verifiedDrivers.length) * 35 + verifiedDrivers.length * 8))
        : 0;

    const fraudRisk = Math.max(
      0,
      Math.min(
        100,
        urgentReports.length * 18 +
          openReports.length * 6 +
          suspendedUsers.length * 10 +
          cancelledBookings.length * 3
      )
    );

    const demandScore = Math.min(100, bookings.length * 8 + activeRides.length * 6 + users.length * 2);
    const supplyScore = Math.min(100, verifiedDrivers.length * 18 + activeRides.length * 8);

    const users30 = Math.round(growthBase * 1.25 + rideDensity * 1.5);
    const users90 = Math.round(growthBase * 1.9 + rideDensity * 4);
    const users365 = Math.round(growthBase * 6.5 + rideDensity * 18);

    const revenue30 = Math.max(0, revenue * 1.35 + completedBookings.length * 8);
    const revenue90 = Math.max(0, revenue * 2.4 + completedBookings.length * 25);
    const revenue365 = Math.max(0, revenue * 9.2 + completedBookings.length * 120);

    const confidence = Math.max(
      35,
      Math.min(
        97,
        55 +
          Math.min(users.length, 20) +
          Math.min(rides.length * 2, 18) +
          Math.min(bookings.length * 2, 18) -
          urgentReports.length * 4
      )
    );

    const recommendation =
      fraudRisk >= 50
        ? "Reduce fraud and safety risk before scaling paid acquisition."
        : verifiedDrivers.length < 3
        ? "Recruit more verified drivers to improve supply and launch readiness."
        : activeRides.length < 3
        ? "Increase active rides to strengthen marketplace liquidity."
        : completedBookings.length === 0
        ? "Focus on completing first bookings to validate revenue."
        : "RoadLink has positive early growth signals. Focus on retention and route density.";

    return {
      verifiedDrivers,
      suspendedUsers,
      activeRides,
      completedBookings,
      cancelledBookings,
      openReports,
      urgentReports,
      pendingPayouts,
      revenue,
      marketplaceBalance,
      fraudRisk,
      demandScore,
      supplyScore,
      users30,
      users90,
      users365,
      revenue30,
      revenue90,
      revenue365,
      confidence,
      recommendation,
    };
  }, [users, rides, bookings, reports, payouts]);

  async function generatePrediction() {
    try {
      setGenerating(true);
      setMessage("");

      const now = new Date().toISOString();

      const payload = {
        confidence: forecast.confidence,
        users30: forecast.users30,
        users90: forecast.users90,
        users365: forecast.users365,
        revenue30: forecast.revenue30,
        revenue90: forecast.revenue90,
        revenue365: forecast.revenue365,
        fraudRisk: forecast.fraudRisk,
        demandScore: forecast.demandScore,
        supplyScore: forecast.supplyScore,
        marketplaceBalance: forecast.marketplaceBalance,
        recommendation: forecast.recommendation,
        createdAt: now,
        createdBy: auth.currentUser?.email || "admin",
        source: "ai-predict",
      };

      await addDoc(collection(db, "aiPredictions"), payload);
      await addDoc(collection(db, "forecastHistory"), payload);
      await addDoc(collection(db, "aiRecommendations"), {
        title: "AI Growth Recommendation",
        description: forecast.recommendation,
        priority: forecast.fraudRisk >= 50 ? "high" : "medium",
        createdAt: now,
        createdBy: auth.currentUser?.email || "admin",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "AI Prediction Generated",
        targetType: "aiPrediction",
        details: `AI forecast generated with ${forecast.confidence}% confidence.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("AI prediction generated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not generate prediction.");
    } finally {
      setGenerating(false);
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  const latest = predictions[0];

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/mission-control" className="miniButton">Mission Control</Link>
          <Link href="/admin/business-intelligence" className="miniButton">Business Intelligence</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink AI</p>
            <h1>AI Predictive <span>Analytics</span></h1>
            <p className="subtitle">
              Forecast users, revenue, demand, supply, fraud risk, marketplace balance and growth opportunities using RoadLink data.
            </p>
          </div>

          <div className={forecast.confidence >= 75 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{forecast.confidence}</strong>
            <span>AI Confidence</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users 30d" value={String(forecast.users30)} />
          <Metric icon="📈" label="Users 90d" value={String(forecast.users90)} />
          <Metric icon="🚀" label="Users 365d" value={String(forecast.users365)} />
          <Metric icon="💰" label="Revenue 30d" value={money(forecast.revenue30)} />
          <Metric icon="🏦" label="Revenue 90d" value={money(forecast.revenue90)} />
          <Metric icon="💎" label="Revenue 365d" value={money(forecast.revenue365)} />
          <Metric icon="🚨" label="Fraud Risk" value={`${forecast.fraudRisk}%`} danger={forecast.fraudRisk >= 50} />
          <Metric icon="⚖️" label="Balance" value={`${forecast.marketplaceBalance}%`} />
        </section>

        <section className="actionCard">
          <div>
            <p className="eyebrow">Generate Forecast</p>
            <h2>New AI Prediction</h2>
            <p>
              Save a new prediction into Firestore collections: aiPredictions,
              forecastHistory and aiRecommendations.
            </p>
          </div>

          <button onClick={generatePrediction} disabled={generating}>
            {generating ? "Generating..." : "Generate New Prediction"}
          </button>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Forecast Scores</p>
            <h2>Marketplace Prediction</h2>

            <Score label="Demand Forecast" value={forecast.demandScore} />
            <Score label="Driver Supply Forecast" value={forecast.supplyScore} />
            <Score label="Marketplace Balance" value={forecast.marketplaceBalance} />
            <Score label="Fraud Risk Forecast" value={forecast.fraudRisk} danger />
          </section>

          <section className="panel">
            <p className="eyebrow">AI Recommendation</p>
            <h2>Growth Guidance</h2>

            <div className={forecast.fraudRisk >= 50 ? "aiBox dangerBox" : "aiBox"}>
              <strong>{forecast.fraudRisk >= 50 ? "High Risk Detected" : "AI Growth Insight"}</strong>
              <p>{forecast.recommendation}</p>
            </div>

            <div className="infoGrid">
              <Info label="Current Users" value={String(users.length)} />
              <Info label="Verified Drivers" value={String(forecast.verifiedDrivers.length)} />
              <Info label="Active Rides" value={String(forecast.activeRides.length)} />
              <Info label="Completed Bookings" value={String(forecast.completedBookings.length)} />
              <Info label="Open Reports" value={String(forecast.openReports.length)} />
              <Info label="Pending Payouts" value={String(forecast.pendingPayouts.length)} />
            </div>
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Revenue Forecast</p>
            <h2>Projected Growth</h2>

            <div className="projectionBox">
              <div>
                <span>30 Days</span>
                <strong>{money(forecast.revenue30)}</strong>
              </div>

              <div>
                <span>90 Days</span>
                <strong>{money(forecast.revenue90)}</strong>
              </div>

              <div>
                <span>365 Days</span>
                <strong>{money(forecast.revenue365)}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Latest Saved Prediction</p>
            <h2>Forecast History</h2>

            {latest ? (
              <div className="latestBox">
                <strong>{latest.confidence || 0}% confidence</strong>
                <p>{latest.recommendation || "No recommendation saved."}</p>

                <div className="infoGrid">
                  <Info label="Users 30d" value={String(latest.users30 || 0)} />
                  <Info label="Users 90d" value={String(latest.users90 || 0)} />
                  <Info label="Revenue 30d" value={money(Number(latest.revenue30 || 0))} />
                  <Info label="Revenue 90d" value={money(Number(latest.revenue90 || 0))} />
                  <Info label="Fraud Risk" value={`${latest.fraudRisk || 0}%`} />
                  <Info label="Created" value={latest.createdAt || "Not available"} />
                </div>
              </div>
            ) : (
              <div className="empty">
                <h3>No predictions yet</h3>
                <p>Generate the first AI prediction to start building forecast history.</p>
              </div>
            )}
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Prediction History</p>
          <h2>Saved AI Forecasts</h2>

          {predictions.length === 0 ? (
            <div className="empty">
              <h3>No forecast records</h3>
              <p>AI prediction records will appear here.</p>
            </div>
          ) : (
            <div className="historyList">
              {predictions.slice(0, 12).map((item) => (
                <article key={item.id} className="historyItem">
                  <div>
                    <strong>{item.confidence || 0}% AI Confidence</strong>
                    <span>{item.recommendation || "Forecast generated."}</span>
                  </div>

                  <em>{money(Number(item.revenue90 || 0))} / 90d</em>
                </article>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1240px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .panel,
        .actionCard {
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
          font-size: 60px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong,
        .projectionBox strong,
        .latestBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .actionCard p,
        .aiBox p,
        .latestBox p,
        .empty p,
        .historyItem span {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0;
        }

        .scoreOrb {
          min-width: 116px;
          height: 116px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong { color: #fca5a5; }

        .scoreOrb strong {
          font-size: 36px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.20);
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          margin-bottom: 10px;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          display: block;
          margin-bottom: 6px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .actionCard {
          border-radius: 28px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
          margin-bottom: 22px;
        }

        button {
          padding: 15px 22px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 24px;
        }

        .scoreList {
          display: grid;
          gap: 14px;
        }

        .scoreRow {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .scoreRow.dangerScore {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .scoreTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          font-weight: 900;
        }

        .scoreTop strong {
          color: #22c55e;
        }

        .dangerScore .scoreTop strong {
          color: #fca5a5;
        }

        .bar {
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .dangerScore .bar div {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        .aiBox,
        .latestBox,
        .empty {
          padding: 20px;
          border-radius: 22px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.28);
          margin-bottom: 18px;
        }

        .dangerBox {
          background: rgba(127,29,29,0.18);
          border-color: rgba(239,68,68,0.35);
        }

        .aiBox strong {
          color: #22c55e;
          display: block;
          margin-bottom: 8px;
        }

        .dangerBox strong {
          color: #fca5a5;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .info {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .projectionBox {
          display: grid;
          gap: 12px;
        }

        .projectionBox div {
          padding: 18px;
          border-radius: 18px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .projectionBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .projectionBox strong {
          font-size: 32px;
          font-weight: 900;
        }

        .historyList {
          display: grid;
          gap: 10px;
        }

        .historyItem {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .historyItem strong,
        .historyItem span {
          display: block;
          overflow-wrap: anywhere;
        }

        .historyItem em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
        }

        @media (max-width: 1050px) {
          .hero,
          .grid,
          .actionCard {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 { font-size: 46px; }
        }

        @media (max-width: 650px) {
          .page { padding: 16px; padding-bottom: 120px; }

          .hero,
          .panel,
          .actionCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .infoGrid,
          .historyItem {
            grid-template-columns: 1fr;
          }

          .actionCard button {
            width: 100%;
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
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}

function Score({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "scoreRow dangerScore" : "scoreRow"}>
      <div className="scoreTop">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="bar">
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
                                         }
