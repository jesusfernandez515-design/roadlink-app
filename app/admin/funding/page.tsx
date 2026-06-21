"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type FundingType =
  | "angel"
  | "seed"
  | "series_a"
  | "series_b"
  | "grant"
  | "sba"
  | "revenue_based"
  | "other";

type FundingStatus =
  | "target"
  | "contacted"
  | "meeting"
  | "committed"
  | "received"
  | "declined";

type FundingRound = {
  id: string;
  investorName?: string;
  fundingType?: FundingType;
  status?: FundingStatus;
  contactName?: string;
  contactEmail?: string;
  requestedAmount?: number;
  committedAmount?: number;
  receivedAmount?: number;
  valuation?: number;
  runwayMonths?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminFundingCenterPage() {
  const [rounds, setRounds] = useState<FundingRound[]>([]);
  const [message, setMessage] = useState("Loading funding center...");
  const [saving, setSaving] = useState(false);

  const [investorName, setInvestorName] = useState("");
  const [fundingType, setFundingType] = useState<FundingType>("angel");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [valuation, setValuation] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "fundingRounds")),
      (snapshot) => {
        setRounds(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as FundingRound[]
        );
        setMessage("");
      },
      () => {
        setRounds([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const targets = rounds.filter((item) => !item.status || item.status === "target");
    const contacted = rounds.filter((item) => item.status === "contacted");
    const meetings = rounds.filter((item) => item.status === "meeting");
    const committed = rounds.filter((item) => item.status === "committed");
    const received = rounds.filter((item) => item.status === "received");
    const declined = rounds.filter((item) => item.status === "declined");

    const requested = rounds.reduce(
      (total, item) => total + Number(item.requestedAmount || 0),
      0
    );

    const committedAmount = rounds.reduce(
      (total, item) => total + Number(item.committedAmount || 0),
      0
    );

    const receivedAmount = rounds.reduce(
      (total, item) => total + Number(item.receivedAmount || 0),
      0
    );

    const averageValuation =
      rounds.length > 0
        ? Math.round(
            rounds.reduce((total, item) => total + Number(item.valuation || 0), 0) /
              rounds.length
          )
        : 0;

    const investorPipeline = rounds.filter((item) => item.status !== "declined").length;

    const fundingHealthScore = Math.max(
      Math.min(
        received.length * 30 +
          committed.length * 20 +
          meetings.length * 12 +
          contacted.length * 7 +
          targets.length * 3 +
          Math.round(committedAmount / 10000) +
          Math.round(receivedAmount / 10000),
        100
      ),
      0
    );

    const readinessScore = Math.max(
      Math.min(
        investorPipeline * 6 +
          Math.round(requested / 25000) +
          Math.round(averageValuation / 100000) +
          committed.length * 10 +
          received.length * 15,
        100
      ),
      0
    );

    const runwayMonths =
      receivedAmount > 0 ? Math.max(Math.round(receivedAmount / 8000), 1) : 0;

    return {
      targets,
      contacted,
      meetings,
      committed,
      received,
      declined,
      requested,
      committedAmount,
      receivedAmount,
      averageValuation,
      investorPipeline,
      fundingHealthScore,
      readinessScore,
      runwayMonths,
    };
  }, [rounds]);

  async function createFundingRound() {
    if (!investorName.trim()) {
      setMessage("Investor name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `funding-${Date.now()}`;

      await setDoc(
        doc(db, "fundingRounds", id),
        {
          investorName: investorName.trim(),
          fundingType,
          status: "target",
          contactName: contactName.trim() || "Not assigned",
          contactEmail: contactEmail.trim() || "No email",
          requestedAmount: Number(requestedAmount || 0),
          committedAmount: 0,
          receivedAmount: 0,
          valuation: Number(valuation || 0),
          runwayMonths: 0,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setInvestorName("");
      setFundingType("angel");
      setContactName("");
      setContactEmail("");
      setRequestedAmount("");
      setValuation("");

      setMessage("Funding target created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create funding target.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(round: FundingRound, status: FundingStatus) {
    try {
      const now = new Date().toISOString();
      const requested = Number(round.requestedAmount || 0);

      const updateData: Partial<FundingRound> = {
        status,
        updatedAt: now,
      };

      if (status === "committed") {
        updateData.committedAmount = requested;
      }

      if (status === "received") {
        updateData.committedAmount = requested;
        updateData.receivedAmount = requested;
        updateData.runwayMonths = requested > 0 ? Math.max(Math.round(requested / 8000), 1) : 0;
      }

      await setDoc(doc(db, "fundingRounds", round.id), updateData, { merge: true });

      await setDoc(
        doc(db, "auditLogs", `funding-${round.id}-${Date.now()}`),
        {
          action: "Funding Round Status Updated",
          targetId: round.id,
          targetType: "fundingRound",
          details: `${round.investorName || "Investor"} changed to ${status}`,
          severity: status === "received" ? "success" : status === "declined" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Funding status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update funding status.");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function typeLabel(type?: FundingType) {
    if (type === "angel") return "Angel Investor";
    if (type === "seed") return "Seed";
    if (type === "series_a") return "Series A";
    if (type === "series_b") return "Series B";
    if (type === "grant") return "Grant";
    if (type === "sba") return "SBA";
    if (type === "revenue_based") return "Revenue Based";
    return "Other";
  }

  function statusLabel(status?: FundingStatus) {
    if (status === "contacted") return "Contacted";
    if (status === "meeting") return "Meeting";
    if (status === "committed") return "Committed";
    if (status === "received") return "Received";
    if (status === "declined") return "Declined";
    return "Target";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/investor-relations" className="miniButton">Investor Relations</Link>
          <Link href="/admin/investor-board" className="miniButton">Investor Board</Link>
          <Link href="/admin/enterprise-revenue" className="miniButton">Enterprise Revenue</Link>
          <Link href="/admin/crm" className="miniButton">CRM</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Capital Strategy</p>
            <h1>Funding <span>Center</span></h1>
            <p className="subtitle">
              Track angel investors, seed funding, grants, SBA programs, revenue based financing,
              capital requested, committed capital, received capital, valuation and runway.
            </p>
          </div>

          <div className={metrics.fundingHealthScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.fundingHealthScore}</strong>
            <span>Funding Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎯" label="Targets" value={String(metrics.targets.length)} />
          <Metric icon="📞" label="Contacted" value={String(metrics.contacted.length)} />
          <Metric icon="📅" label="Meetings" value={String(metrics.meetings.length)} />
          <Metric icon="🤝" label="Committed" value={String(metrics.committed.length)} />
          <Metric icon="💰" label="Received" value={money(metrics.receivedAmount)} />
          <Metric icon="📊" label="Requested" value={money(metrics.requested)} />
          <Metric icon="🏦" label="Committed $" value={money(metrics.committedAmount)} />
          <Metric icon="⏳" label="Runway" value={`${metrics.runwayMonths} mo`} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Readiness</p>
            <h2>{metrics.readinessScore}/100</h2>
            <p>Investor readiness based on pipeline, requested capital, valuation and funding progress.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Average Valuation</p>
            <h2>{money(metrics.averageValuation)}</h2>
            <p>Average valuation across funding targets and investor conversations.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Investor Pipeline</p>
            <h2>{metrics.investorPipeline}</h2>
            <p>Active funding opportunities excluding declined investors.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Create Funding Target</p>
          <h2>New Investor / Capital Source</h2>

          <div className="formGrid">
            <input value={investorName} onChange={(e) => setInvestorName(e.target.value)} placeholder="Investor, grant or funding source" />

            <select value={fundingType} onChange={(e) => setFundingType(e.target.value as FundingType)}>
              <option value="angel">Angel Investor</option>
              <option value="seed">Seed Funding</option>
              <option value="series_a">Series A</option>
              <option value="series_b">Series B</option>
              <option value="grant">Grant</option>
              <option value="sba">SBA Program</option>
              <option value="revenue_based">Revenue Based Financing</option>
              <option value="other">Other</option>
            </select>

            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" />
            <input value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} placeholder="Requested amount" type="number" />
            <input value={valuation} onChange={(e) => setValuation(e.target.value)} placeholder="RoadLink valuation" type="number" />
          </div>

          <button className="saveButton" onClick={createFundingRound} disabled={saving}>
            {saving ? "Creating..." : "Create Funding Target"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">Funding Pipeline</p>
          <h2>Capital Opportunities</h2>

          {rounds.length === 0 ? (
            <div className="empty">
              <h3>No funding targets yet</h3>
              <p>Create your first investor, grant or funding opportunity.</p>
            </div>
          ) : (
            <div className="roundGrid">
              {rounds.map((round) => (
                <section key={round.id} className="roundCard">
                  <div className="cardTop">
                    <div>
                      <h3>{round.investorName || "Unknown Investor"}</h3>
                      <p>{round.contactEmail || "No email"}</p>
                    </div>

                    <span className={`pill ${round.status || "target"}`}>
                      {statusLabel(round.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Funding Type" value={typeLabel(round.fundingType)} />
                    <Info label="Contact" value={round.contactName || "Not assigned"} />
                    <Info label="Requested" value={money(Number(round.requestedAmount || 0))} />
                    <Info label="Committed" value={money(Number(round.committedAmount || 0))} />
                    <Info label="Received" value={money(Number(round.receivedAmount || 0))} />
                    <Info label="Valuation" value={money(Number(round.valuation || 0))} />
                    <Info label="Runway" value={`${Number(round.runwayMonths || 0)} months`} />
                    <Info label="Notes" value={round.notes || "No notes"} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(round, "contacted")}>Contacted</button>
                    <button onClick={() => updateStatus(round, "meeting")}>Meeting</button>
                    <button onClick={() => updateStatus(round, "committed")}>Committed</button>
                    <button onClick={() => updateStatus(round, "received")}>Received</button>
                    <button className="dangerButton" onClick={() => updateStatus(round, "declined")}>Declined</button>
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
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
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
        .roundCard,
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
        .roundCard p,
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

        .roundGrid {
          display: grid;
          gap: 16px;
        }

        .roundCard {
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

        .roundCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .roundCard p {
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

        .pill.declined {
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
