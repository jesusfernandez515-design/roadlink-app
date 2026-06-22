"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type IPOStatus = "not_started" | "in_progress" | "ready" | "risk";
type IPOCategory =
  | "governance"
  | "financial_controls"
  | "compliance"
  | "revenue"
  | "audit"
  | "risk"
  | "board"
  | "transparency";

type IPOItem = {
  id: string;
  title?: string;
  category?: IPOCategory;
  status?: IPOStatus;
  score?: number;
  owner?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminIPOReadinessPage() {
  const [items, setItems] = useState<IPOItem[]>([]);
  const [message, setMessage] = useState("Loading IPO readiness center...");
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IPOCategory>("governance");
  const [owner, setOwner] = useState("");
  const [score, setScore] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "ipoReadiness")),
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as IPOItem[]);
        setMessage("");
      },
      () => {
        setItems([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const defaultChecklist: IPOItem[] = [
    { id: "default-governance", title: "Board governance structure", category: "governance", status: "not_started", score: 20, owner: "CEO", notes: "Define board roles, voting rights and reporting cadence." },
    { id: "default-financial-controls", title: "Financial controls and reporting", category: "financial_controls", status: "not_started", score: 20, owner: "Finance", notes: "Prepare monthly financial statements, controls and approval flow." },
    { id: "default-compliance", title: "Compliance readiness", category: "compliance", status: "not_started", score: 20, owner: "Legal", notes: "Review policies, contracts, privacy, safety and operational compliance." },
    { id: "default-revenue", title: "Revenue stability", category: "revenue", status: "not_started", score: 20, owner: "Growth", notes: "Track recurring revenue, enterprise revenue and growth consistency." },
    { id: "default-audit", title: "Audit readiness", category: "audit", status: "not_started", score: 20, owner: "Finance", notes: "Prepare documents, logs, expenses and revenue records for audit." },
    { id: "default-risk", title: "Risk management program", category: "risk", status: "not_started", score: 20, owner: "Operations", notes: "Track safety, fraud, insurance, driver verification and legal risk." },
    { id: "default-board", title: "Board and investor transparency", category: "board", status: "not_started", score: 20, owner: "CEO", notes: "Create investor updates, board reports and executive dashboards." },
    { id: "default-transparency", title: "Public company transparency", category: "transparency", status: "not_started", score: 20, owner: "Executive", notes: "Standardize reporting and disclosure discipline." },
  ];

  const readinessItems = useMemo<IPOItem[]>(() => {
    const savedIds = new Set(items.map((item) => item.id));
    const missingDefaults = defaultChecklist.filter((item) => !savedIds.has(item.id));
    return [...items, ...missingDefaults];
  }, [items]);

  const metrics = useMemo(() => {
    const ready = readinessItems.filter((item) => item.status === "ready");
    const inProgress = readinessItems.filter((item) => item.status === "in_progress");
    const risk = readinessItems.filter((item) => item.status === "risk");
    const notStarted = readinessItems.filter((item) => !item.status || item.status === "not_started");

    const ipoScore =
      readinessItems.length > 0
        ? Math.round(
            readinessItems.reduce(
              (total, item) =>
                total +
                Number(item.score || 0) *
                  (item.status === "ready"
                    ? 1
                    : item.status === "in_progress"
                    ? 0.65
                    : item.status === "risk"
                    ? 0.25
                    : 0.1),
              0
            ) / readinessItems.length
          )
        : 0;

    const governanceScore = categoryScore("governance");
    const financialScore = categoryScore("financial_controls");
    const complianceScore = categoryScore("compliance");
    const auditScore = categoryScore("audit");
    const riskScore = categoryScore("risk");
    const transparencyScore = categoryScore("transparency");

    function categoryScore(cat: IPOCategory) {
      const group = readinessItems.filter((item) => item.category === cat);
      if (group.length === 0) return 0;
      return Math.round(
        group.reduce(
          (total, item) =>
            total +
            Number(item.score || 0) *
              (item.status === "ready"
                ? 1
                : item.status === "in_progress"
                ? 0.65
                : item.status === "risk"
                ? 0.25
                : 0.1),
          0
        ) / group.length
      );
    }

    return {
      ready,
      inProgress,
      risk,
      notStarted,
      ipoScore,
      governanceScore,
      financialScore,
      complianceScore,
      auditScore,
      riskScore,
      transparencyScore,
    };
  }, [readinessItems]);

  async function createIPOItem() {
    if (!title.trim()) {
      setMessage("Checklist title required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `ipo-${Date.now()}`;

      await setDoc(
        doc(db, "ipoReadiness", id),
        {
          title: title.trim(),
          category,
          status: "not_started",
          score: Number(score || 25),
          owner: owner.trim() || "Not assigned",
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setTitle("");
      setCategory("governance");
      setOwner("");
      setScore("");
      setMessage("IPO checklist item created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create IPO checklist item.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: IPOItem, status: IPOStatus) {
    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "ipoReadiness", item.id),
        {
          title: item.title || "IPO Checklist Item",
          category: item.category || "governance",
          status,
          score: Number(item.score || 25),
          owner: item.owner || "Not assigned",
          notes: item.notes || "",
          updatedAt: now,
          createdAt: item.createdAt || now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `ipo-${item.id}-${Date.now()}`),
        {
          action: "IPO Readiness Status Updated",
          targetId: item.id,
          targetType: "ipoReadiness",
          details: `${item.title || "IPO item"} changed to ${status}`,
          severity: status === "ready" ? "success" : status === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("IPO readiness status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update IPO readiness.");
    }
  }

  function statusLabel(status?: IPOStatus) {
    if (status === "ready") return "Ready";
    if (status === "in_progress") return "In Progress";
    if (status === "risk") return "Risk";
    return "Not Started";
  }

  function categoryLabel(cat?: IPOCategory) {
    if (cat === "governance") return "Governance";
    if (cat === "financial_controls") return "Financial Controls";
    if (cat === "compliance") return "Compliance";
    if (cat === "revenue") return "Revenue";
    if (cat === "audit") return "Audit";
    if (cat === "risk") return "Risk";
    if (cat === "board") return "Board";
    return "Transparency";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/investor-relations" className="miniButton">Investor Relations</Link>
          <Link href="/admin/funding" className="miniButton">Funding</Link>
          <Link href="/admin/venture-capital" className="miniButton">Venture Capital</Link>
          <Link href="/admin/acquisition" className="miniButton">Acquisition</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Public Company Readiness</p>
            <h1>IPO Readiness <span>Center</span></h1>
            <p className="subtitle">
              Track IPO readiness, governance, financial controls, compliance, audit,
              public company transparency, board readiness and risk management.
            </p>
          </div>

          <div className={metrics.ipoScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.ipoScore}</strong>
            <span>IPO Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="✅" label="Ready" value={String(metrics.ready.length)} />
          <Metric icon="🛠️" label="In Progress" value={String(metrics.inProgress.length)} />
          <Metric icon="⚠️" label="Risk" value={String(metrics.risk.length)} />
          <Metric icon="⏳" label="Not Started" value={String(metrics.notStarted.length)} />
          <Metric icon="🏛️" label="Governance" value={`${metrics.governanceScore}/100`} />
          <Metric icon="💵" label="Financial" value={`${metrics.financialScore}/100`} />
          <Metric icon="📜" label="Compliance" value={`${metrics.complianceScore}/100`} />
          <Metric icon="🔍" label="Audit" value={`${metrics.auditScore}/100`} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Risk Management</p>
            <h2>{metrics.riskScore}/100</h2>
            <p>Risk program readiness for safety, fraud, legal and operational controls.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Transparency</p>
            <h2>{metrics.transparencyScore}/100</h2>
            <p>Investor reporting, board updates and public company discipline.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Listing Readiness</p>
            <h2>{metrics.ipoScore}/100</h2>
            <p>Overall IPO readiness across governance, controls, compliance and audit.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Create IPO Checklist Item</p>
          <h2>New Readiness Task</h2>

          <div className="formGrid">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Checklist title" />

            <select value={category} onChange={(e) => setCategory(e.target.value as IPOCategory)}>
              <option value="governance">Governance</option>
              <option value="financial_controls">Financial Controls</option>
              <option value="compliance">Compliance</option>
              <option value="revenue">Revenue</option>
              <option value="audit">Audit</option>
              <option value="risk">Risk</option>
              <option value="board">Board</option>
              <option value="transparency">Transparency</option>
            </select>

            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" />
            <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="Weight / score" type="number" />
          </div>

          <button className="saveButton" onClick={createIPOItem} disabled={saving}>
            {saving ? "Creating..." : "Create IPO Item"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">IPO Checklist</p>
          <h2>Public Company Readiness</h2>

          <div className="checklistGrid">
            {readinessItems.map((item) => (
              <section key={item.id} className="checkCard">
                <div className="cardTop">
                  <div>
                    <h3>{item.title || "IPO Checklist Item"}</h3>
                    <p>{categoryLabel(item.category)} • {item.owner || "Not assigned"}</p>
                  </div>

                  <span className={`pill ${item.status || "not_started"}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>

                <div className="infoGrid">
                  <Info label="Category" value={categoryLabel(item.category)} />
                  <Info label="Owner" value={item.owner || "Not assigned"} />
                  <Info label="Score" value={`${Number(item.score || 0)}/100`} />
                  <Info label="Status" value={statusLabel(item.status)} />
                  <Info label="Notes" value={item.notes || "No notes"} />
                  <Info label="ID" value={item.id} />
                </div>

                <div className="actions">
                  <button onClick={() => updateStatus(item, "not_started")}>Not Started</button>
                  <button onClick={() => updateStatus(item, "in_progress")}>In Progress</button>
                  <button onClick={() => updateStatus(item, "ready")}>Ready</button>
                  <button className="dangerButton" onClick={() => updateStatus(item, "risk")}>Risk</button>
                </div>
              </section>
            ))}
          </div>
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
        .checkCard,
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
        .checkCard p,
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

        .checklistGrid {
          display: grid;
          gap: 16px;
        }

        .checkCard {
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

        .checkCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .checkCard p {
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

        .pill.risk {
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
