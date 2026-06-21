"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type DealStage = "lead" | "qualified" | "proposal" | "negotiating" | "won" | "lost";
type DealSource = "corporate" | "university" | "airport" | "government" | "partnership" | "other";

type SalesDeal = {
  id: string;
  name?: string;
  source?: DealSource;
  stage?: DealStage;
  contactName?: string;
  contactEmail?: string;
  city?: string;
  state?: string;
  expectedRevenue?: number;
  probability?: number;
  closeDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminSalesPipelinePage() {
  const [deals, setDeals] = useState<SalesDeal[]>([]);
  const [message, setMessage] = useState("Loading sales pipeline...");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [source, setSource] = useState<DealSource>("corporate");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [expectedRevenue, setExpectedRevenue] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "salesPipeline")),
      (snapshot) => {
        setDeals(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as SalesDeal[]);
        setMessage("");
      },
      () => {
        setDeals([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const lead = deals.filter((item) => !item.stage || item.stage === "lead");
    const qualified = deals.filter((item) => item.stage === "qualified");
    const proposal = deals.filter((item) => item.stage === "proposal");
    const negotiating = deals.filter((item) => item.stage === "negotiating");
    const won = deals.filter((item) => item.stage === "won");
    const lost = deals.filter((item) => item.stage === "lost");

    const pipelineValue = deals
      .filter((item) => item.stage !== "lost")
      .reduce((total, item) => total + Number(item.expectedRevenue || 0), 0);

    const weightedForecast = deals
      .filter((item) => item.stage !== "lost")
      .reduce(
        (total, item) =>
          total + Number(item.expectedRevenue || 0) * (Number(item.probability || stageProbability(item.stage)) / 100),
        0
      );

    const wonRevenue = won.reduce((total, item) => total + Number(item.expectedRevenue || 0), 0);
    const closeRate = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

    return {
      lead,
      qualified,
      proposal,
      negotiating,
      won,
      lost,
      pipelineValue,
      weightedForecast,
      wonRevenue,
      closeRate,
    };
  }, [deals]);

  async function createDeal() {
    if (!name.trim()) {
      setMessage("Deal name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `deal-${Date.now()}`;

      await setDoc(
        doc(db, "salesPipeline", id),
        {
          name: name.trim(),
          source,
          stage: "lead",
          contactName: contactName.trim() || "Not assigned",
          contactEmail: contactEmail.trim() || "No email",
          expectedRevenue: Number(expectedRevenue || 0),
          probability: 10,
          city: "",
          state: "",
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setName("");
      setSource("corporate");
      setContactName("");
      setContactEmail("");
      setExpectedRevenue("");
      setMessage("Sales deal created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create sales deal.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStage(id: string, stage: DealStage) {
    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "salesPipeline", id),
        {
          stage,
          probability: stageProbability(stage),
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `sales-${id}-${Date.now()}`),
        {
          action: "Sales Deal Stage Updated",
          targetId: id,
          targetType: "salesDeal",
          details: `Stage changed to ${stage}`,
          severity: stage === "won" ? "success" : stage === "lost" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Sales stage updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update deal.");
    }
  }

  function stageProbability(stage?: DealStage) {
    if (stage === "won") return 100;
    if (stage === "negotiating") return 75;
    if (stage === "proposal") return 55;
    if (stage === "qualified") return 30;
    if (stage === "lost") return 0;
    return 10;
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function stageLabel(stage?: DealStage) {
    if (stage === "qualified") return "Qualified";
    if (stage === "proposal") return "Proposal";
    if (stage === "negotiating") return "Negotiating";
    if (stage === "won") return "Won";
    if (stage === "lost") return "Lost";
    return "Lead";
  }

  function sourceLabel(value?: DealSource) {
    if (value === "corporate") return "Corporate";
    if (value === "university") return "University";
    if (value === "airport") return "Airport";
    if (value === "government") return "Government";
    if (value === "partnership") return "Partnership";
    return "Other";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/partnerships" className="miniButton">Partnerships</Link>
          <Link href="/admin/corporate-accounts" className="miniButton">Corporate</Link>
          <Link href="/admin/university-program" className="miniButton">University</Link>
          <Link href="/admin/government-contracts" className="miniButton">Government</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Sales Engine</p>
            <h1>Sales <span>Pipeline</span></h1>
            <p className="subtitle">
              Track enterprise leads, qualified opportunities, proposals, negotiations,
              won deals, lost deals, pipeline value and sales forecast.
            </p>
          </div>

          <div className={metrics.pipelineValue > 0 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{money(metrics.weightedForecast)}</strong>
            <span>Forecast</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🌱" label="Leads" value={String(metrics.lead.length)} />
          <Metric icon="✅" label="Qualified" value={String(metrics.qualified.length)} />
          <Metric icon="📄" label="Proposals" value={String(metrics.proposal.length)} />
          <Metric icon="🗣️" label="Negotiating" value={String(metrics.negotiating.length)} />
          <Metric icon="🏆" label="Won" value={String(metrics.won.length)} />
          <Metric icon="💰" label="Pipeline" value={money(metrics.pipelineValue)} />
          <Metric icon="📈" label="Forecast" value={money(metrics.weightedForecast)} />
          <Metric icon="🎯" label="Close Rate" value={`${metrics.closeRate}%`} />
        </section>

        <section className="card">
          <p className="eyebrow">Create Sales Deal</p>
          <h2>New Opportunity</h2>

          <div className="formGrid">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deal or company name" />

            <select value={source} onChange={(e) => setSource(e.target.value as DealSource)}>
              <option value="corporate">Corporate</option>
              <option value="university">University</option>
              <option value="airport">Airport</option>
              <option value="government">Government</option>
              <option value="partnership">Partnership</option>
              <option value="other">Other</option>
            </select>

            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" />
            <input value={expectedRevenue} onChange={(e) => setExpectedRevenue(e.target.value)} placeholder="Expected revenue" type="number" />
          </div>

          <button className="saveButton" onClick={createDeal} disabled={saving}>
            {saving ? "Creating..." : "Create Sales Deal"}
          </button>
        </section>

        <section className="pipelineGrid">
          {(["lead", "qualified", "proposal", "negotiating", "won", "lost"] as DealStage[]).map((stage) => {
            const stageDeals = deals.filter((item) => (item.stage || "lead") === stage);

            return (
              <section key={stage} className="column">
                <div className="columnHeader">
                  <h2>{stageLabel(stage)}</h2>
                  <span>{stageDeals.length}</span>
                </div>

                {stageDeals.length === 0 ? (
                  <div className="emptySmall">No deals</div>
                ) : (
                  <div className="dealList">
                    {stageDeals.map((item) => (
                      <section key={item.id} className="dealCard">
                        <div className="dealTop">
                          <h3>{item.name || "Unknown Deal"}</h3>
                          <span className={`pill ${item.stage || "lead"}`}>{stageLabel(item.stage)}</span>
                        </div>

                        <p>{item.contactEmail || "No email"}</p>

                        <div className="infoGrid">
                          <Info label="Source" value={sourceLabel(item.source)} />
                          <Info label="Expected" value={money(Number(item.expectedRevenue || 0))} />
                          <Info label="Probability" value={`${Number(item.probability || stageProbability(item.stage))}%`} />
                          <Info label="Forecast" value={money(Number(item.expectedRevenue || 0) * (Number(item.probability || stageProbability(item.stage)) / 100))} />
                        </div>

                        <div className="actions">
                          <button onClick={() => updateStage(item.id, "qualified")}>Qualify</button>
                          <button onClick={() => updateStage(item.id, "proposal")}>Proposal</button>
                          <button onClick={() => updateStage(item.id, "negotiating")}>Negotiate</button>
                          <button onClick={() => updateStage(item.id, "won")}>Won</button>
                          <button className="dangerButton" onClick={() => updateStage(item.id, "lost")}>Lost</button>
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
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
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1450px; margin: auto; }

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
        .column,
        .dealCard {
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
        h2 { font-size: 26px; margin: 0 0 14px; }

        .subtitle,
        .dealCard p {
          color: #a1a1aa;
          line-height: 1.5;
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

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
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
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
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

        select option { color: black; }

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

        .pipelineGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .column {
          border-radius: 28px;
          padding: 18px;
          min-height: 360px;
        }

        .columnHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .columnHeader span {
          min-width: 32px;
          height: 32px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34,197,94,0.13);
          color: #22c55e;
          font-weight: 900;
        }

        .dealList {
          display: grid;
          gap: 12px;
        }

        .dealCard {
          border-radius: 20px;
          padding: 16px;
          box-shadow: none;
        }

        .dealTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .dealCard h3 {
          margin: 0 0 8px;
          font-size: 18px;
          overflow-wrap: anywhere;
        }

        .dealCard p {
          margin: 0 0 12px;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.lost {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .infoBox {
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .infoBox strong {
          display: block;
          overflow-wrap: anywhere;
          font-size: 13px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .actions button {
          padding: 10px 12px;
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

        .emptySmall {
          padding: 18px;
          border-radius: 18px;
          color: #a1a1aa;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1180px) {
          .pipelineGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .stats {
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
          .formGrid,
          .pipelineGrid,
          .infoGrid {
            grid-template-columns: 1fr;
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
