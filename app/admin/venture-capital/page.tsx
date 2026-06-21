"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type VCStatus = "target" | "warm_intro" | "pitched" | "diligence" | "term_sheet" | "passed";
type VCFit = "excellent" | "strong" | "medium" | "low";

type VCItem = {
  id: string;
  firmName?: string;
  partnerName?: string;
  partnerEmail?: string;
  status?: VCStatus;
  portfolioFit?: VCFit;
  fundSize?: number;
  targetCheckSize?: number;
  investmentProbability?: number;
  unicornPotential?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminVentureCapitalPage() {
  const [vcFirms, setVcFirms] = useState<VCItem[]>([]);
  const [message, setMessage] = useState("Loading venture capital center...");
  const [saving, setSaving] = useState(false);

  const [firmName, setFirmName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [fundSize, setFundSize] = useState("");
  const [targetCheckSize, setTargetCheckSize] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "ventureCapital")),
      (snapshot) => {
        setVcFirms(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as VCItem[]);
        setMessage("");
      },
      () => {
        setVcFirms([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const targets = vcFirms.filter((item) => !item.status || item.status === "target");
    const warmIntro = vcFirms.filter((item) => item.status === "warm_intro");
    const pitched = vcFirms.filter((item) => item.status === "pitched");
    const diligence = vcFirms.filter((item) => item.status === "diligence");
    const termSheet = vcFirms.filter((item) => item.status === "term_sheet");
    const passed = vcFirms.filter((item) => item.status === "passed");

    const totalFundSize = vcFirms.reduce((total, item) => total + Number(item.fundSize || 0), 0);
    const totalTargetChecks = vcFirms.reduce((total, item) => total + Number(item.targetCheckSize || 0), 0);

    const weightedFunding = vcFirms.reduce(
      (total, item) =>
        total +
        Number(item.targetCheckSize || 0) *
          (Number(item.investmentProbability || statusProbability(item.status)) / 100),
      0
    );

    const averageProbability =
      vcFirms.length > 0
        ? Math.round(
            vcFirms.reduce(
              (total, item) => total + Number(item.investmentProbability || statusProbability(item.status)),
              0
            ) / vcFirms.length
          )
        : 0;

    const unicornPotential =
      vcFirms.length > 0
        ? Math.round(
            vcFirms.reduce((total, item) => total + Number(item.unicornPotential || fitScore(item.portfolioFit)), 0) /
              vcFirms.length
          )
        : 0;

    const vcPipelineScore = Math.max(
      Math.min(
        termSheet.length * 35 +
          diligence.length * 24 +
          pitched.length * 14 +
          warmIntro.length * 9 +
          targets.length * 4 +
          Math.round(weightedFunding / 50000),
        100
      ),
      0
    );

    return {
      targets,
      warmIntro,
      pitched,
      diligence,
      termSheet,
      passed,
      totalFundSize,
      totalTargetChecks,
      weightedFunding,
      averageProbability,
      unicornPotential,
      vcPipelineScore,
    };
  }, [vcFirms]);

  async function createVCFirm() {
    if (!firmName.trim()) {
      setMessage("VC firm name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `vc-${Date.now()}`;

      await setDoc(
        doc(db, "ventureCapital", id),
        {
          firmName: firmName.trim(),
          partnerName: partnerName.trim() || "Not assigned",
          partnerEmail: partnerEmail.trim() || "No email",
          status: "target",
          portfolioFit: "medium",
          fundSize: Number(fundSize || 0),
          targetCheckSize: Number(targetCheckSize || 0),
          investmentProbability: 10,
          unicornPotential: 50,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setFirmName("");
      setPartnerName("");
      setPartnerEmail("");
      setFundSize("");
      setTargetCheckSize("");
      setMessage("VC firm created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create VC firm.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: VCItem, status: VCStatus) {
    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "ventureCapital", item.id),
        {
          status,
          investmentProbability: statusProbability(status),
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `vc-${item.id}-${Date.now()}`),
        {
          action: "VC Status Updated",
          targetId: item.id,
          targetType: "ventureCapital",
          details: `${item.firmName || "VC Firm"} changed to ${status}`,
          severity: status === "term_sheet" ? "success" : status === "passed" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("VC status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update VC status.");
    }
  }

  function statusProbability(status?: VCStatus) {
    if (status === "term_sheet") return 85;
    if (status === "diligence") return 55;
    if (status === "pitched") return 30;
    if (status === "warm_intro") return 18;
    if (status === "passed") return 0;
    return 10;
  }

  function fitScore(fit?: VCFit) {
    if (fit === "excellent") return 95;
    if (fit === "strong") return 80;
    if (fit === "medium") return 55;
    return 30;
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: VCStatus) {
    if (status === "warm_intro") return "Warm Intro";
    if (status === "pitched") return "Pitched";
    if (status === "diligence") return "Diligence";
    if (status === "term_sheet") return "Term Sheet";
    if (status === "passed") return "Passed";
    return "Target";
  }

  function fitLabel(fit?: VCFit) {
    if (fit === "excellent") return "Excellent";
    if (fit === "strong") return "Strong";
    if (fit === "medium") return "Medium";
    return "Low";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/funding" className="miniButton">Funding</Link>
          <Link href="/admin/investor-relations" className="miniButton">Investor Relations</Link>
          <Link href="/admin/investor-board" className="miniButton">Investor Board</Link>
          <Link href="/admin/enterprise-revenue" className="miniButton">Enterprise Revenue</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Fundraising</p>
            <h1>Venture Capital <span>Center</span></h1>
            <p className="subtitle">
              Manage VC firms, partner contacts, warm introductions, pitch status,
              diligence, term sheets, fund size, target check size and investment probability.
            </p>
          </div>

          <div className={metrics.vcPipelineScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.vcPipelineScore}</strong>
            <span>VC Pipeline</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎯" label="Targets" value={String(metrics.targets.length)} />
          <Metric icon="🤝" label="Warm Intros" value={String(metrics.warmIntro.length)} />
          <Metric icon="📣" label="Pitched" value={String(metrics.pitched.length)} />
          <Metric icon="🔎" label="Diligence" value={String(metrics.diligence.length)} />
          <Metric icon="📄" label="Term Sheets" value={String(metrics.termSheet.length)} />
          <Metric icon="💰" label="Weighted Funding" value={money(metrics.weightedFunding)} />
          <Metric icon="🎲" label="Avg Probability" value={`${metrics.averageProbability}%`} />
          <Metric icon="🦄" label="Unicorn Potential" value={`${metrics.unicornPotential}/100`} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Total Fund Size</p>
            <h2>{money(metrics.totalFundSize)}</h2>
            <p>Total size of VC funds tracked in RoadLink pipeline.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Target Checks</p>
            <h2>{money(metrics.totalTargetChecks)}</h2>
            <p>Total target check size from all VC firms in the pipeline.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">RoadLink Unicorn Potential</p>
            <h2>{metrics.unicornPotential}/100</h2>
            <p>Estimated VC-fit signal based on portfolio fit and investor pipeline quality.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Create VC Target</p>
          <h2>New VC Firm</h2>

          <div className="formGrid">
            <input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="VC firm name" />
            <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Partner name" />
            <input value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} placeholder="Partner email" />
            <input value={fundSize} onChange={(e) => setFundSize(e.target.value)} placeholder="Fund size" type="number" />
            <input value={targetCheckSize} onChange={(e) => setTargetCheckSize(e.target.value)} placeholder="Target check size" type="number" />
          </div>

          <button className="saveButton" onClick={createVCFirm} disabled={saving}>
            {saving ? "Creating..." : "Create VC Target"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">VC Pipeline</p>
          <h2>Venture Capital Firms</h2>

          {vcFirms.length === 0 ? (
            <div className="empty">
              <h3>No VC firms yet</h3>
              <p>Create your first VC target to begin tracking fundraising opportunities.</p>
            </div>
          ) : (
            <div className="vcGrid">
              {vcFirms.map((item) => (
                <section key={item.id} className="vcCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.firmName || "Unknown VC Firm"}</h3>
                      <p>{item.partnerEmail || "No email"}</p>
                    </div>

                    <span className={`pill ${item.status || "target"}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Partner" value={item.partnerName || "Not assigned"} />
                    <Info label="Portfolio Fit" value={fitLabel(item.portfolioFit)} />
                    <Info label="Fund Size" value={money(Number(item.fundSize || 0))} />
                    <Info label="Target Check" value={money(Number(item.targetCheckSize || 0))} />
                    <Info label="Probability" value={`${Number(item.investmentProbability || statusProbability(item.status))}%`} />
                    <Info label="Weighted Value" value={money(Number(item.targetCheckSize || 0) * (Number(item.investmentProbability || statusProbability(item.status)) / 100))} />
                    <Info label="Unicorn Potential" value={`${Number(item.unicornPotential || fitScore(item.portfolioFit))}/100`} />
                    <Info label="Notes" value={item.notes || "No notes"} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(item, "warm_intro")}>Warm Intro</button>
                    <button onClick={() => updateStatus(item, "pitched")}>Pitched</button>
                    <button onClick={() => updateStatus(item, "diligence")}>Diligence</button>
                    <button onClick={() => updateStatus(item, "term_sheet")}>Term Sheet</button>
                    <button className="dangerButton" onClick={() => updateStatus(item, "passed")}>Passed</button>
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
            radial-gradient(circle at bottom left, rgba(147,51,234,0.16), transparent 35%),
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
        .vcCard,
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
        .vcCard p,
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

        input {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
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

        .vcGrid {
          display: grid;
          gap: 16px;
        }

        .vcCard {
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

        .vcCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .vcCard p {
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

        .pill.passed {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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
