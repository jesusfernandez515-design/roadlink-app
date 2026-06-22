"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ExpansionStatus = "target" | "research" | "ready" | "launched" | "paused";
type ExpansionType = "state" | "city" | "university" | "airport" | "corporate" | "regional";

type ExpansionMarket = {
  id: string;
  marketName?: string;
  expansionType?: ExpansionType;
  status?: ExpansionStatus;
  state?: string;
  estimatedPopulation?: number;
  estimatedDrivers?: number;
  estimatedRiders?: number;
  launchCost?: number;
  monthlyRevenuePotential?: number;
  readinessScore?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminExpansionCenterPage() {
  const [markets, setMarkets] = useState<ExpansionMarket[]>([]);
  const [message, setMessage] = useState("Loading expansion center...");
  const [saving, setSaving] = useState(false);

  const [marketName, setMarketName] = useState("");
  const [expansionType, setExpansionType] = useState<ExpansionType>("city");
  const [stateValue, setStateValue] = useState("");
  const [population, setPopulation] = useState("");
  const [launchCost, setLaunchCost] = useState("");
  const [revenuePotential, setRevenuePotential] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "expansionMarkets")),
      (snapshot) => {
        setMarkets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ExpansionMarket[]);
        setMessage("");
      },
      () => {
        setMarkets([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const target = markets.filter((item) => !item.status || item.status === "target");
    const research = markets.filter((item) => item.status === "research");
    const ready = markets.filter((item) => item.status === "ready");
    const launched = markets.filter((item) => item.status === "launched");
    const paused = markets.filter((item) => item.status === "paused");

    const population = markets.reduce(
      (total, item) => total + Number(item.estimatedPopulation || 0),
      0
    );

    const drivers = markets.reduce(
      (total, item) => total + Number(item.estimatedDrivers || 0),
      0
    );

    const riders = markets.reduce(
      (total, item) => total + Number(item.estimatedRiders || 0),
      0
    );

    const cost = markets.reduce(
      (total, item) => total + Number(item.launchCost || 0),
      0
    );

    const revenue = markets.reduce(
      (total, item) => total + Number(item.monthlyRevenuePotential || 0),
      0
    );

    const avgReadiness =
      markets.length > 0
        ? Math.round(
            markets.reduce(
              (total, item) => total + Number(item.readinessScore || statusScore(item.status)),
              0
            ) / markets.length
          )
        : 0;

    const roi =
      cost > 0 ? Math.round(((revenue * 12 - cost) / cost) * 100) : 0;

    const expansionScore = Math.max(
      Math.min(
        launched.length * 30 +
          ready.length * 22 +
          research.length * 10 +
          target.length * 5 +
          Math.round(revenue / 1000) +
          Math.round(avgReadiness / 2),
        100
      ),
      0
    );

    return {
      target,
      research,
      ready,
      launched,
      paused,
      population,
      drivers,
      riders,
      cost,
      revenue,
      avgReadiness,
      roi,
      expansionScore,
    };
  }, [markets]);

  async function createMarket() {
    if (!marketName.trim()) {
      setMessage("Market name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `expansion-${Date.now()}`;

      await setDoc(
        doc(db, "expansionMarkets", id),
        {
          marketName: marketName.trim(),
          expansionType,
          status: "target",
          state: stateValue.trim() || "Not set",
          estimatedPopulation: Number(population || 0),
          estimatedDrivers: 0,
          estimatedRiders: 0,
          launchCost: Number(launchCost || 0),
          monthlyRevenuePotential: Number(revenuePotential || 0),
          readinessScore: 20,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setMarketName("");
      setExpansionType("city");
      setStateValue("");
      setPopulation("");
      setLaunchCost("");
      setRevenuePotential("");

      setMessage("Expansion market created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create expansion market.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: ExpansionMarket, status: ExpansionStatus) {
    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "expansionMarkets", item.id),
        {
          status,
          readinessScore: statusScore(status),
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `expansion-${item.id}-${Date.now()}`),
        {
          action: "Expansion Market Status Updated",
          targetId: item.id,
          targetType: "expansionMarket",
          details: `${item.marketName || "Market"} changed to ${status}`,
          severity: status === "launched" ? "success" : status === "paused" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Expansion status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update expansion status.");
    }
  }

  function statusScore(status?: ExpansionStatus) {
    if (status === "launched") return 100;
    if (status === "ready") return 75;
    if (status === "research") return 45;
    if (status === "paused") return 10;
    return 20;
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: ExpansionStatus) {
    if (status === "research") return "Research";
    if (status === "ready") return "Ready";
    if (status === "launched") return "Launched";
    if (status === "paused") return "Paused";
    return "Target";
  }

  function typeLabel(type?: ExpansionType) {
    if (type === "state") return "State";
    if (type === "city") return "City";
    if (type === "university") return "University";
    if (type === "airport") return "Airport";
    if (type === "corporate") return "Corporate";
    return "Regional";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/market-intelligence" className="miniButton">Market</Link>
          <Link href="/admin/growth-intelligence" className="miniButton">Growth</Link>
          <Link href="/admin/enterprise-revenue" className="miniButton">Enterprise Revenue</Link>
          <Link href="/admin/partnerships" className="miniButton">Partnerships</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Market Expansion</p>
            <h1>Expansion <span>Center</span></h1>
            <p className="subtitle">
              Track target states, cities, universities, airports, corporate regions,
              launch cost, market readiness, rider potential, driver supply and revenue potential.
            </p>
          </div>

          <div className={metrics.expansionScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.expansionScore}</strong>
            <span>Expansion Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎯" label="Targets" value={String(metrics.target.length)} />
          <Metric icon="🔎" label="Research" value={String(metrics.research.length)} />
          <Metric icon="✅" label="Ready" value={String(metrics.ready.length)} />
          <Metric icon="🚀" label="Launched" value={String(metrics.launched.length)} />
          <Metric icon="👥" label="Population" value={metrics.population.toLocaleString()} />
          <Metric icon="🚗" label="Drivers" value={metrics.drivers.toLocaleString()} />
          <Metric icon="🧍" label="Riders" value={metrics.riders.toLocaleString()} />
          <Metric icon="💰" label="Revenue Potential" value={money(metrics.revenue)} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Launch Cost</p>
            <h2>{money(metrics.cost)}</h2>
            <p>Total estimated launch cost across expansion markets.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Market Readiness</p>
            <h2>{metrics.avgReadiness}/100</h2>
            <p>Average readiness across all target and launched markets.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Projected ROI</p>
            <h2>{metrics.roi}%</h2>
            <p>Annualized estimated ROI based on revenue potential and launch cost.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Create Expansion Market</p>
          <h2>New Market</h2>

          <div className="formGrid">
            <input value={marketName} onChange={(e) => setMarketName(e.target.value)} placeholder="Market name, city or state" />

            <select value={expansionType} onChange={(e) => setExpansionType(e.target.value as ExpansionType)}>
              <option value="city">City</option>
              <option value="state">State</option>
              <option value="university">University</option>
              <option value="airport">Airport</option>
              <option value="corporate">Corporate</option>
              <option value="regional">Regional</option>
            </select>

            <input value={stateValue} onChange={(e) => setStateValue(e.target.value)} placeholder="State / Region" />
            <input value={population} onChange={(e) => setPopulation(e.target.value)} placeholder="Estimated population" type="number" />
            <input value={launchCost} onChange={(e) => setLaunchCost(e.target.value)} placeholder="Launch cost" type="number" />
            <input value={revenuePotential} onChange={(e) => setRevenuePotential(e.target.value)} placeholder="Monthly revenue potential" type="number" />
          </div>

          <button className="saveButton" onClick={createMarket} disabled={saving}>
            {saving ? "Creating..." : "Create Expansion Market"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">Expansion Pipeline</p>
          <h2>Target Markets</h2>

          {markets.length === 0 ? (
            <div className="empty">
              <h3>No expansion markets yet</h3>
              <p>Create your first market to begin RoadLink expansion planning.</p>
            </div>
          ) : (
            <div className="marketGrid">
              {markets.map((item) => (
                <section key={item.id} className="marketCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.marketName || "Unknown Market"}</h3>
                      <p>{typeLabel(item.expansionType)} • {item.state || "No region"}</p>
                    </div>

                    <span className={`pill ${item.status || "target"}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Expansion Type" value={typeLabel(item.expansionType)} />
                    <Info label="State / Region" value={item.state || "Not set"} />
                    <Info label="Population" value={String(item.estimatedPopulation || 0)} />
                    <Info label="Estimated Drivers" value={String(item.estimatedDrivers || 0)} />
                    <Info label="Estimated Riders" value={String(item.estimatedRiders || 0)} />
                    <Info label="Launch Cost" value={money(Number(item.launchCost || 0))} />
                    <Info label="Monthly Revenue" value={money(Number(item.monthlyRevenuePotential || 0))} />
                    <Info label="Readiness" value={`${Number(item.readinessScore || statusScore(item.status))}/100`} />
                    <Info label="Notes" value={item.notes || "No notes"} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(item, "research")}>Research</button>
                    <button onClick={() => updateStatus(item, "ready")}>Ready</button>
                    <button onClick={() => updateStatus(item, "launched")}>Launch</button>
                    <button className="dangerButton" onClick={() => updateStatus(item, "paused")}>Pause</button>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1380px; margin: auto; }

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
        .card,
        .marketCard,
        .scoreCard {
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
        .empty p,
        .marketCard p,
        .scoreCard p {
          color: #a1a1aa;
          line-height: 1.5;
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

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats,
        .scoreGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .scoreGrid {
          grid-template-columns: repeat(3, 1fr);
        }

        .metric,
        .scoreCard {
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
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .scoreCard h2 {
          font-size: 38px;
        }

        .card {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
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

        .saveButton {
          width: 100%;
          margin-top: 16px;
          padding: 16px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .marketGrid {
          display: grid;
          gap: 16px;
        }

        .marketCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .marketCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .marketCard p {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.paused {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
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
          .scoreGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .infoGrid {
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
          .scoreGrid,
          .formGrid,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          .cardTop {
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
