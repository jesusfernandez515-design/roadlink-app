"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ForecastStatus = "strong" | "stable" | "watch" | "risk";

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type PaymentItem = {
  id: string;
  status?: string;
  amount?: number;
  platformFee?: number;
  processorFee?: number;
  fee?: number;
  createdAt?: string;
};

type ForecastProfile = {
  id: string;
  title: string;
  period: string;
  grossRevenue: number;
  platformFees: number;
  payoutExposure: number;
  processingFees: number;
  netForecast: number;
  projectedMonthly: number;
  projectedYearly: number;
  bookings: number;
  completed: number;
  cancelled: number;
  growthScore: number;
  status: ForecastStatus;
  insight: string;
};

export default function AdminFinancialForecastPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [selected, setSelected] = useState<ForecastProfile | null>(null);
  const [filter, setFilter] = useState<"all" | ForecastStatus>("all");
  const [message, setMessage] = useState("Loading financial forecast...");
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

    const unsubBookings = listen<BookingItem>("bookings", setBookings);
    const unsubPayouts = listen<PayoutItem>("payoutRequests", setPayouts);
    const unsubPayments = listen<PaymentItem>("payments", setPayments);

    return () => {
      unsubBookings();
      unsubPayouts();
      unsubPayments();
    };
  }, []);

  const forecasts = useMemo<ForecastProfile[]>(() => {
    const now = Date.now();

    const periods = [
      { id: "today", title: "Today Forecast", days: 1 },
      { id: "seven-days", title: "7 Day Forecast", days: 7 },
      { id: "thirty-days", title: "30 Day Forecast", days: 30 },
      { id: "ninety-days", title: "90 Day Forecast", days: 90 },
    ];

    return periods.map((period) => {
      const start = now - period.days * 24 * 60 * 60 * 1000;

      const periodBookings = bookings.filter((item) => {
        if (!item.createdAt) return false;
        const time = new Date(item.createdAt).getTime();
        return !Number.isNaN(time) && time >= start;
      });

      const periodPayments = payments.filter((item) => {
        if (!item.createdAt) return false;
        const time = new Date(item.createdAt).getTime();
        return !Number.isNaN(time) && time >= start;
      });

      const grossRevenue = periodBookings.reduce(
        (total, booking) =>
          total +
          Number(booking.price || booking.amount || 0) *
            Number(booking.seatsBooked || 1),
        0
      );

      const platformFees =
        periodPayments.reduce(
          (total, payment) => total + Number(payment.platformFee || payment.fee || 0),
          0
        ) || grossRevenue * 0.12;

      const processingFees =
        periodPayments.reduce(
          (total, payment) => total + Number(payment.processorFee || 0),
          0
        ) || grossRevenue * 0.03;

      const payoutExposure = payouts
        .filter((item) => item.status === "pending" || item.status === "approved")
        .reduce((total, item) => total + Number(item.amount || 0), 0);

      const completed = periodBookings.filter((item) => item.status === "completed").length;

      const cancelled = periodBookings.filter(
        (item) =>
          item.status === "cancelled" ||
          item.status === "rejected" ||
          item.status === "no_show"
      ).length;

      const netForecast = platformFees - processingFees;
      const dailyAverage = grossRevenue / Math.max(period.days, 1);
      const projectedMonthly = dailyAverage * 30;
      const projectedYearly = dailyAverage * 365;

      let growthScore = 0;

      growthScore += periodBookings.length * 7;
      growthScore += grossRevenue >= 100 ? 15 : 0;
      growthScore += grossRevenue >= 500 ? 20 : 0;
      growthScore += completed * 5;
      growthScore -= cancelled * 8;
      growthScore -= payoutExposure > grossRevenue && grossRevenue > 0 ? 20 : 0;

      growthScore = Math.max(Math.min(growthScore, 100), 0);

      const status: ForecastStatus =
        netForecast < 0 || payoutExposure > grossRevenue * 2
          ? "risk"
          : growthScore >= 75
          ? "strong"
          : growthScore >= 45
          ? "stable"
          : "watch";

      const insight =
        status === "strong"
          ? "Strong financial forecast. Revenue momentum looks healthy."
          : status === "stable"
          ? "Stable forecast. Keep monitoring bookings, payouts and margins."
          : status === "risk"
          ? "Financial risk detected. Payout exposure or weak net forecast needs review."
          : "Low financial activity. More bookings are needed for reliable forecasting.";

      return {
        id: period.id,
        title: period.title,
        period: `${period.days} day${period.days === 1 ? "" : "s"}`,
        grossRevenue,
        platformFees,
        payoutExposure,
        processingFees,
        netForecast,
        projectedMonthly,
        projectedYearly,
        bookings: periodBookings.length,
        completed,
        cancelled,
        growthScore,
        status,
        insight,
      };
    });
  }, [bookings, payouts, payments]);

  const filteredForecasts = useMemo(() => {
    if (filter === "all") return forecasts;
    return forecasts.filter((item) => item.status === filter);
  }, [forecasts, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredForecasts.length === 0) return null;
      if (!current) return filteredForecasts[0];
      return filteredForecasts.find((item) => item.id === current.id) || filteredForecasts[0];
    });
  }, [filteredForecasts]);

  const monthly = forecasts.find((item) => item.id === "thirty-days");
  const yearly = monthly?.projectedYearly || 0;
  const strong = forecasts.filter((item) => item.status === "strong").length;
  const stable = forecasts.filter((item) => item.status === "stable").length;
  const watch = forecasts.filter((item) => item.status === "watch").length;
  const risk = forecasts.filter((item) => item.status === "risk").length;

  async function saveForecast(item: ForecastProfile) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "financialForecasts", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `financial-forecast-${item.id}-${Date.now()}`),
        {
          action: "Financial Forecast Saved",
          targetId: item.id,
          targetType: "financialForecast",
          details: item.insight,
          severity: item.status === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Financial forecast saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save forecast.");
    } finally {
      setLoadingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: ForecastStatus) {
    if (status === "strong") return "Strong";
    if (status === "stable") return "Stable";
    if (status === "risk") return "Risk";
    return "Watch";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue Intel</Link>
          <Link href="/admin/profitability" className="miniButton">Profitability</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Financial Intelligence</p>
            <h1>Financial <span>Forecast</span></h1>
            <p className="subtitle">
              Forecast RoadLink revenue, platform fees, payout exposure, net earnings,
              monthly projections and yearly financial potential.
            </p>
          </div>

          <div className={risk > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{money(yearly)}</strong>
            <span>Year Forecast</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📈" label="Strong" value={String(strong)} />
          <Metric icon="✅" label="Stable" value={String(stable)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="🚨" label="Risk" value={String(risk)} danger={risk > 0} />
          <Metric icon="💰" label="Monthly Projection" value={money(monthly?.projectedMonthly || 0)} />
          <Metric icon="🏦" label="Year Projection" value={money(yearly)} />
        </section>

        <section className="filters">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | ForecastStatus)}
          >
            <option value="all">All forecasts</option>
            <option value="strong">Strong</option>
            <option value="stable">Stable</option>
            <option value="watch">Watch</option>
            <option value="risk">Risk</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="forecastCard">
            <p className="eyebrow">Forecast Periods</p>
            <h2>Financial Projections</h2>

            <div className="forecastList">
              {filteredForecasts.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={selected?.id === item.id ? "forecastRow activeForecast" : "forecastRow"}
                >
                  <div className={`forecastIcon ${item.status}`}>
                    {item.status === "strong"
                      ? "📈"
                      : item.status === "stable"
                      ? "✅"
                      : item.status === "watch"
                      ? "👀"
                      : "🚨"}
                  </div>

                  <div className="forecastInfo">
                    <strong>{item.title}</strong>
                    <span>{item.period} • {item.bookings} booking(s)</span>
                    <small>{money(item.grossRevenue)} gross • {money(item.netForecast)} net</small>
                  </div>

                  <em className={`status ${item.status}`}>{statusLabel(item.status)}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Forecast</p>
                    <h2>{selected.title}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Projected Monthly Revenue</span>
                  <strong>{money(selected.projectedMonthly)}</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.growthScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Period" value={selected.period} />
                  <Info label="Growth Score" value={`${selected.growthScore}/100`} />
                  <Info label="Gross Revenue" value={money(selected.grossRevenue)} />
                  <Info label="Platform Fees" value={money(selected.platformFees)} />
                  <Info label="Processing Fees" value={money(selected.processingFees)} />
                  <Info label="Payout Exposure" value={money(selected.payoutExposure)} />
                  <Info label="Net Forecast" value={money(selected.netForecast)} />
                  <Info label="Monthly Projection" value={money(selected.projectedMonthly)} />
                  <Info label="Yearly Projection" value={money(selected.projectedYearly)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed" value={String(selected.completed)} />
                  <Info label="Cancelled" value={String(selected.cancelled)} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Forecast Summary</p>
                  <h2>{selected.status === "risk" ? "Review financial exposure" : "Forecast ready"}</h2>
                  <p>
                    This forecast uses bookings, payments, platform fees, payout exposure and recent financial activity.
                  </p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveForecast(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Forecast
                  </button>

                  <Link href="/admin/revenue-intelligence" className="linkButton">Revenue Intel</Link>
                  <Link href="/admin/profitability" className="linkButton">Profitability</Link>
                  <Link href="/admin/payouts" className="dangerButton">Payouts</Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select forecast</h3>
                <p>Choose a forecast period to view details.</p>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
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

        .hero,
        .metric,
        .filters,
        .forecastCard,
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
          padding: 10px;
        }

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 24px;
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

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .dangerMetric .metricValue { color: #ef4444; }

        .filters {
          display: grid;
          grid-template-columns: 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

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

        .forecastCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .forecastList {
          display: grid;
          gap: 12px;
        }

        .forecastRow {
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

        .activeForecast {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .forecastIcon {
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

        .forecastIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .forecastIcon.risk {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .forecastInfo { min-width: 0; }

        .forecastInfo strong,
        .forecastInfo span,
        .forecastInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .forecastInfo span,
        .forecastInfo small {
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

        .status.strong,
        .status.stable,
        .statusPill.strong,
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

        .status.risk,
        .statusPill.risk {
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

        .insightBox.risk {
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
        .insightBox.risk strong { color: #fca5a5; }

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

          .forecastRow {
            grid-template-columns: 46px 1fr;
          }

          .forecastRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .forecastIcon {
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
