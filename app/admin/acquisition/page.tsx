"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type BuyerType =
  | "mobility"
  | "rideshare"
  | "transportation"
  | "travel"
  | "enterprise"
  | "strategic"
  | "other";

type AcquisitionStatus =
  | "target"
  | "contacted"
  | "interested"
  | "diligence"
  | "offer"
  | "closed"
  | "passed";

type AcquisitionTarget = {
  id: string;
  buyerName?: string;
  buyerType?: BuyerType;
  status?: AcquisitionStatus;
  contactName?: string;
  contactEmail?: string;
  estimatedOffer?: number;
  strategicFit?: number;
  closeProbability?: number;
  diligenceScore?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminAcquisitionCenterPage() {
  const [targets, setTargets] = useState<AcquisitionTarget[]>([]);
  const [message, setMessage] = useState("Loading acquisition center...");
  const [saving, setSaving] = useState(false);

  const [buyerName, setBuyerName] = useState("");
  const [buyerType, setBuyerType] = useState<BuyerType>("mobility");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [estimatedOffer, setEstimatedOffer] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "acquisitionTargets")),
      (snapshot) => {
        setTargets(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as AcquisitionTarget[]
        );
        setMessage("");
      },
      () => {
        setTargets([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const target = targets.filter((item) => !item.status || item.status === "target");
    const contacted = targets.filter((item) => item.status === "contacted");
    const interested = targets.filter((item) => item.status === "interested");
    const diligence = targets.filter((item) => item.status === "diligence");
    const offer = targets.filter((item) => item.status === "offer");
    const closed = targets.filter((item) => item.status === "closed");
    const passed = targets.filter((item) => item.status === "passed");

    const totalOfferValue = targets.reduce(
      (total, item) => total + Number(item.estimatedOffer || 0),
      0
    );

    const weightedValue = targets.reduce(
      (total, item) =>
        total +
        Number(item.estimatedOffer || 0) *
          (Number(item.closeProbability || statusProbability(item.status)) / 100),
      0
    );

    const averageFit =
      targets.length > 0
        ? Math.round(
            targets.reduce((total, item) => total + Number(item.strategicFit || buyerFit(item.buyerType)), 0) /
              targets.length
          )
        : 0;

    const averageDiligence =
      targets.length > 0
        ? Math.round(
            targets.reduce((total, item) => total + Number(item.diligenceScore || statusDiligence(item.status)), 0) /
              targets.length
          )
        : 0;

    const acquisitionScore = Math.max(
      Math.min(
        closed.length * 40 +
          offer.length * 28 +
          diligence.length * 18 +
          interested.length * 12 +
          contacted.length * 7 +
          target.length * 3 +
          Math.round(weightedValue / 50000),
        100
      ),
      0
    );

    return {
      target,
      contacted,
      interested,
      diligence,
      offer,
      closed,
      passed,
      totalOfferValue,
      weightedValue,
      averageFit,
      averageDiligence,
      acquisitionScore,
    };
  }, [targets]);

  async function createTarget() {
    if (!buyerName.trim()) {
      setMessage("Buyer name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `acquisition-${Date.now()}`;
      const fit = buyerFit(buyerType);

      await setDoc(
        doc(db, "acquisitionTargets", id),
        {
          buyerName: buyerName.trim(),
          buyerType,
          status: "target",
          contactName: contactName.trim() || "Not assigned",
          contactEmail: contactEmail.trim() || "No email",
          estimatedOffer: Number(estimatedOffer || 0),
          strategicFit: fit,
          closeProbability: 10,
          diligenceScore: 15,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setBuyerName("");
      setBuyerType("mobility");
      setContactName("");
      setContactEmail("");
      setEstimatedOffer("");

      setMessage("Acquisition target created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create acquisition target.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: AcquisitionTarget, status: AcquisitionStatus) {
    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "acquisitionTargets", item.id),
        {
          status,
          closeProbability: statusProbability(status),
          diligenceScore: statusDiligence(status),
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `acquisition-${item.id}-${Date.now()}`),
        {
          action: "Acquisition Target Status Updated",
          targetId: item.id,
          targetType: "acquisitionTarget",
          details: `${item.buyerName || "Buyer"} changed to ${status}`,
          severity: status === "closed" ? "success" : status === "passed" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Acquisition status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update acquisition status.");
    }
  }

  function statusProbability(status?: AcquisitionStatus) {
    if (status === "closed") return 100;
    if (status === "offer") return 75;
    if (status === "diligence") return 50;
    if (status === "interested") return 30;
    if (status === "contacted") return 18;
    if (status === "passed") return 0;
    return 10;
  }

  function statusDiligence(status?: AcquisitionStatus) {
    if (status === "closed") return 100;
    if (status === "offer") return 85;
    if (status === "diligence") return 65;
    if (status === "interested") return 40;
    if (status === "contacted") return 25;
    if (status === "passed") return 10;
    return 15;
  }

  function buyerFit(type?: BuyerType) {
    if (type === "mobility") return 90;
    if (type === "rideshare") return 88;
    if (type === "transportation") return 82;
    if (type === "travel") return 75;
    if (type === "enterprise") return 70;
    if (type === "strategic") return 85;
    return 50;
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: AcquisitionStatus) {
    if (status === "contacted") return "Contacted";
    if (status === "interested") return "Interested";
    if (status === "diligence") return "Diligence";
    if (status === "offer") return "Offer";
    if (status === "closed") return "Closed";
    if (status === "passed") return "Passed";
    return "Target";
  }

  function typeLabel(type?: BuyerType) {
    if (type === "mobility") return "Mobility";
    if (type === "rideshare") return "Rideshare";
    if (type === "transportation") return "Transportation";
    if (type === "travel") return "Travel";
    if (type === "enterprise") return "Enterprise";
    if (type === "strategic") return "Strategic";
    return "Other";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/venture-capital" className="miniButton">Venture Capital</Link>
          <Link href="/admin/funding" className="miniButton">Funding</Link>
          <Link href="/admin/investor-relations" className="miniButton">Investor Relations</Link>
          <Link href="/admin/enterprise-revenue" className="miniButton">Enterprise Revenue</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink M&A Strategy</p>
            <h1>Acquisition <span>Center</span></h1>
            <p className="subtitle">
              Manage strategic buyers, mobility companies, transportation groups,
              acquisition offers, M&A diligence, buyer fit, close probability and exit value.
            </p>
          </div>

          <div className={metrics.acquisitionScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.acquisitionScore}</strong>
            <span>M&A Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎯" label="Targets" value={String(metrics.target.length)} />
          <Metric icon="📞" label="Contacted" value={String(metrics.contacted.length)} />
          <Metric icon="👀" label="Interested" value={String(metrics.interested.length)} />
          <Metric icon="🔎" label="Diligence" value={String(metrics.diligence.length)} />
          <Metric icon="📄" label="Offers" value={String(metrics.offer.length)} />
          <Metric icon="🤝" label="Closed" value={String(metrics.closed.length)} />
          <Metric icon="💰" label="Weighted Value" value={money(metrics.weightedValue)} />
          <Metric icon="🏷️" label="Total Offer Value" value={money(metrics.totalOfferValue)} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Strategic Buyer Fit</p>
            <h2>{metrics.averageFit}/100</h2>
            <p>Average fit between RoadLink and tracked strategic buyers.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Diligence Readiness</p>
            <h2>{metrics.averageDiligence}/100</h2>
            <p>Estimated readiness signal for M&A diligence and buyer review.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Exit Value</p>
            <h2>{money(metrics.weightedValue)}</h2>
            <p>Probability weighted acquisition value from current buyer pipeline.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Create Acquisition Target</p>
          <h2>New Strategic Buyer</h2>

          <div className="formGrid">
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Buyer name" />

            <select value={buyerType} onChange={(e) => setBuyerType(e.target.value as BuyerType)}>
              <option value="mobility">Mobility</option>
              <option value="rideshare">Rideshare</option>
              <option value="transportation">Transportation</option>
              <option value="travel">Travel</option>
              <option value="enterprise">Enterprise</option>
              <option value="strategic">Strategic</option>
              <option value="other">Other</option>
            </select>

            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" />
            <input value={estimatedOffer} onChange={(e) => setEstimatedOffer(e.target.value)} placeholder="Estimated offer value" type="number" />
          </div>

          <button className="saveButton" onClick={createTarget} disabled={saving}>
            {saving ? "Creating..." : "Create Acquisition Target"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">M&A Pipeline</p>
          <h2>Strategic Buyers</h2>

          {targets.length === 0 ? (
            <div className="empty">
              <h3>No acquisition targets yet</h3>
              <p>Create your first strategic buyer or M&A opportunity.</p>
            </div>
          ) : (
            <div className="targetGrid">
              {targets.map((item) => (
                <section key={item.id} className="targetCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.buyerName || "Unknown Buyer"}</h3>
                      <p>{item.contactEmail || "No email"}</p>
                    </div>

                    <span className={`pill ${item.status || "target"}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Buyer Type" value={typeLabel(item.buyerType)} />
                    <Info label="Contact" value={item.contactName || "Not assigned"} />
                    <Info label="Estimated Offer" value={money(Number(item.estimatedOffer || 0))} />
                    <Info label="Strategic Fit" value={`${Number(item.strategicFit || buyerFit(item.buyerType))}/100`} />
                    <Info label="Close Probability" value={`${Number(item.closeProbability || statusProbability(item.status))}%`} />
                    <Info label="Weighted Value" value={money(Number(item.estimatedOffer || 0) * (Number(item.closeProbability || statusProbability(item.status)) / 100))} />
                    <Info label="Diligence Score" value={`${Number(item.diligenceScore || statusDiligence(item.status))}/100`} />
                    <Info label="Notes" value={item.notes || "No notes"} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(item, "contacted")}>Contacted</button>
                    <button onClick={() => updateStatus(item, "interested")}>Interested</button>
                    <button onClick={() => updateStatus(item, "diligence")}>Diligence</button>
                    <button onClick={() => updateStatus(item, "offer")}>Offer</button>
                    <button onClick={() => updateStatus(item, "closed")}>Closed</button>
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
        .targetCard,
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
        .targetCard p,
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

        .targetGrid {
          display: grid;
          gap: 16px;
        }

        .targetCard {
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

        .targetCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .targetCard p {
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
