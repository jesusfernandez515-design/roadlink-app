"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type FranchiseStatus = "lead" | "qualified" | "training" | "active" | "paused";
type TerritoryType = "city" | "state" | "region" | "airport" | "university";

type FranchisePartner = {
  id: string;
  partnerName?: string;
  territoryName?: string;
  territoryType?: TerritoryType;
  status?: FranchiseStatus;
  contactEmail?: string;
  franchiseFee?: number;
  monthlyRoyalty?: number;
  activeDrivers?: number;
  monthlyRides?: number;
  territoryValue?: number;
  readinessScore?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminFranchiseCenterPage() {
  const [partners, setPartners] = useState<FranchisePartner[]>([]);
  const [message, setMessage] = useState("Loading franchise center...");
  const [saving, setSaving] = useState(false);

  const [partnerName, setPartnerName] = useState("");
  const [territoryName, setTerritoryName] = useState("");
  const [territoryType, setTerritoryType] = useState<TerritoryType>("city");
  const [contactEmail, setContactEmail] = useState("");
  const [franchiseFee, setFranchiseFee] = useState("");
  const [territoryValue, setTerritoryValue] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "franchisePartners")),
      (snapshot) => {
        setPartners(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as FranchisePartner[]
        );
        setMessage("");
      },
      () => {
        setPartners([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const leads = partners.filter((item) => !item.status || item.status === "lead");
    const qualified = partners.filter((item) => item.status === "qualified");
    const training = partners.filter((item) => item.status === "training");
    const active = partners.filter((item) => item.status === "active");
    const paused = partners.filter((item) => item.status === "paused");

    const fees = partners.reduce((total, item) => total + Number(item.franchiseFee || 0), 0);
    const royalties = partners.reduce((total, item) => total + Number(item.monthlyRoyalty || 0), 0);
    const drivers = partners.reduce((total, item) => total + Number(item.activeDrivers || 0), 0);
    const rides = partners.reduce((total, item) => total + Number(item.monthlyRides || 0), 0);
    const value = partners.reduce((total, item) => total + Number(item.territoryValue || 0), 0);

    const avgReadiness =
      partners.length > 0
        ? Math.round(
            partners.reduce(
              (total, item) => total + Number(item.readinessScore || statusScore(item.status)),
              0
            ) / partners.length
          )
        : 0;

    const franchiseScore = Math.max(
      Math.min(
        active.length * 30 +
          training.length * 18 +
          qualified.length * 12 +
          leads.length * 5 +
          Math.round(royalties / 500) +
          Math.round(avgReadiness / 2),
        100
      ),
      0
    );

    return {
      leads,
      qualified,
      training,
      active,
      paused,
      fees,
      royalties,
      drivers,
      rides,
      value,
      avgReadiness,
      franchiseScore,
    };
  }, [partners]);

  async function createPartner() {
    if (!partnerName.trim() || !territoryName.trim()) {
      setMessage("Partner name and territory are required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `franchise-${Date.now()}`;

      await setDoc(
        doc(db, "franchisePartners", id),
        {
          partnerName: partnerName.trim(),
          territoryName: territoryName.trim(),
          territoryType,
          status: "lead",
          contactEmail: contactEmail.trim() || "No email",
          franchiseFee: Number(franchiseFee || 0),
          monthlyRoyalty: 0,
          activeDrivers: 0,
          monthlyRides: 0,
          territoryValue: Number(territoryValue || 0),
          readinessScore: 20,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setPartnerName("");
      setTerritoryName("");
      setTerritoryType("city");
      setContactEmail("");
      setFranchiseFee("");
      setTerritoryValue("");

      setMessage("Franchise partner created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create franchise partner.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: FranchisePartner, status: FranchiseStatus) {
    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "franchisePartners", item.id),
        {
          status,
          readinessScore: statusScore(status),
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `franchise-${item.id}-${Date.now()}`),
        {
          action: "Franchise Status Updated",
          targetId: item.id,
          targetType: "franchisePartner",
          details: `${item.partnerName || "Partner"} changed to ${status}`,
          severity: status === "active" ? "success" : status === "paused" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Franchise status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update franchise status.");
    }
  }

  function statusScore(status?: FranchiseStatus) {
    if (status === "active") return 100;
    if (status === "training") return 70;
    if (status === "qualified") return 50;
    if (status === "paused") return 10;
    return 20;
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: FranchiseStatus) {
    if (status === "qualified") return "Qualified";
    if (status === "training") return "Training";
    if (status === "active") return "Active";
    if (status === "paused") return "Paused";
    return "Lead";
  }

  function territoryLabel(type?: TerritoryType) {
    if (type === "city") return "City";
    if (type === "state") return "State";
    if (type === "region") return "Region";
    if (type === "airport") return "Airport";
    return "University";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/expansion" className="miniButton">Expansion</Link>
          <Link href="/admin/enterprise-revenue" className="miniButton">Enterprise Revenue</Link>
          <Link href="/admin/partnerships" className="miniButton">Partnerships</Link>
          <Link href="/admin/corporate-accounts" className="miniButton">Corporate</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Regional Operators</p>
            <h1>Franchise <span>Center</span></h1>
            <p className="subtitle">
              Manage franchise partners, territories, regional operators, franchise fees,
              monthly royalties, territory value, active drivers, rides and regional growth.
            </p>
          </div>

          <div className={metrics.franchiseScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.franchiseScore}</strong>
            <span>Franchise Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🌱" label="Leads" value={String(metrics.leads.length)} />
          <Metric icon="✅" label="Qualified" value={String(metrics.qualified.length)} />
          <Metric icon="🎓" label="Training" value={String(metrics.training.length)} />
          <Metric icon="🚀" label="Active" value={String(metrics.active.length)} />
          <Metric icon="💵" label="Franchise Fees" value={money(metrics.fees)} />
          <Metric icon="👑" label="Monthly Royalties" value={money(metrics.royalties)} />
          <Metric icon="🚗" label="Drivers" value={metrics.drivers.toLocaleString()} />
          <Metric icon="🚘" label="Monthly Rides" value={metrics.rides.toLocaleString()} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Territory Value</p>
            <h2>{money(metrics.value)}</h2>
            <p>Total estimated value across all franchise territories.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Franchise Readiness</p>
            <h2>{metrics.avgReadiness}/100</h2>
            <p>Average readiness across franchise partners and regional operators.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Recurring Royalties</p>
            <h2>{money(metrics.royalties)}</h2>
            <p>Potential monthly recurring revenue from franchise partners.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Create Franchise Partner</p>
          <h2>New Territory Operator</h2>

          <div className="formGrid">
            <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Partner name" />
            <input value={territoryName} onChange={(e) => setTerritoryName(e.target.value)} placeholder="Territory name" />

            <select value={territoryType} onChange={(e) => setTerritoryType(e.target.value as TerritoryType)}>
              <option value="city">City</option>
              <option value="state">State</option>
              <option value="region">Region</option>
              <option value="airport">Airport</option>
              <option value="university">University</option>
            </select>

            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" />
            <input value={franchiseFee} onChange={(e) => setFranchiseFee(e.target.value)} placeholder="Franchise fee" type="number" />
            <input value={territoryValue} onChange={(e) => setTerritoryValue(e.target.value)} placeholder="Territory value" type="number" />
          </div>

          <button className="saveButton" onClick={createPartner} disabled={saving}>
            {saving ? "Creating..." : "Create Franchise Partner"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">Franchise Pipeline</p>
          <h2>Regional Operators</h2>

          {partners.length === 0 ? (
            <div className="empty">
              <h3>No franchise partners yet</h3>
              <p>Create your first territory operator to begin franchise expansion.</p>
            </div>
          ) : (
            <div className="partnerGrid">
              {partners.map((item) => (
                <section key={item.id} className="partnerCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.partnerName || "Unknown Partner"}</h3>
                      <p>{item.territoryName || "No territory"} • {territoryLabel(item.territoryType)}</p>
                    </div>

                    <span className={`pill ${item.status || "lead"}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Territory" value={item.territoryName || "Not set"} />
                    <Info label="Territory Type" value={territoryLabel(item.territoryType)} />
                    <Info label="Contact Email" value={item.contactEmail || "No email"} />
                    <Info label="Franchise Fee" value={money(Number(item.franchiseFee || 0))} />
                    <Info label="Monthly Royalty" value={money(Number(item.monthlyRoyalty || 0))} />
                    <Info label="Active Drivers" value={String(item.activeDrivers || 0)} />
                    <Info label="Monthly Rides" value={String(item.monthlyRides || 0)} />
                    <Info label="Territory Value" value={money(Number(item.territoryValue || 0))} />
                    <Info label="Readiness" value={`${Number(item.readinessScore || statusScore(item.status))}/100`} />
                    <Info label="Notes" value={item.notes || "No notes"} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(item, "qualified")}>Qualify</button>
                    <button onClick={() => updateStatus(item, "training")}>Training</button>
                    <button onClick={() => updateStatus(item, "active")}>Activate</button>
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
        .partnerCard,
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
        .partnerCard p,
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

        .partnerGrid {
          display: grid;
          gap: 16px;
        }

        .partnerCard {
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

        .partnerCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .partnerCard p {
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
          grid-template-columns: repeat(2, 1fr);
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
