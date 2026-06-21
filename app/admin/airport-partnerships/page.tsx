"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type AirportStatus = "active" | "pilot" | "negotiating" | "lead" | "paused";

type AirportItem = {
  id: string;
  airportName?: string;
  code?: string;
  status?: AirportStatus;
  contactName?: string;
  contactEmail?: string;
  city?: string;
  state?: string;
  monthlyPassengers?: number;
  estimatedRoadLinkUsers?: number;
  monthlyRides?: number;
  monthlyRevenue?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminAirportPartnershipsPage() {
  const [airports, setAirports] = useState<AirportItem[]>([]);
  const [message, setMessage] = useState("Loading airport partnerships...");
  const [saving, setSaving] = useState(false);

  const [airportName, setAirportName] = useState("");
  const [code, setCode] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "airportPartnerships")),
      (snapshot) => {
        setAirports(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as AirportItem[]
        );
        setMessage("");
      },
      () => {
        setAirports([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const active = airports.filter((item) => item.status === "active");
    const pilot = airports.filter((item) => item.status === "pilot");
    const negotiating = airports.filter((item) => item.status === "negotiating");
    const leads = airports.filter((item) => !item.status || item.status === "lead");

    const passengers = airports.reduce((total, item) => total + Number(item.monthlyPassengers || 0), 0);
    const users = airports.reduce((total, item) => total + Number(item.estimatedRoadLinkUsers || 0), 0);
    const rides = airports.reduce((total, item) => total + Number(item.monthlyRides || 0), 0);
    const revenue = airports.reduce((total, item) => total + Number(item.monthlyRevenue || 0), 0);

    const airportScore = Math.max(
      Math.min(
        active.length * 28 +
          pilot.length * 18 +
          negotiating.length * 12 +
          leads.length * 5 +
          rides * 2 +
          Math.round(revenue / 250),
        100
      ),
      0
    );

    return {
      active,
      pilot,
      negotiating,
      leads,
      passengers,
      users,
      rides,
      revenue,
      airportScore,
    };
  }, [airports]);

  async function createAirport() {
    if (!airportName.trim()) {
      setMessage("Airport name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `airport-${Date.now()}`;

      await setDoc(
        doc(db, "airportPartnerships", id),
        {
          airportName: airportName.trim(),
          code: code.trim().toUpperCase(),
          status: "lead",
          contactName: contactName.trim() || "Ground Transportation Office",
          contactEmail: contactEmail.trim() || "No email",
          city: city.trim() || "Unknown City",
          state: stateValue.trim() || "Unknown State",
          monthlyPassengers: 0,
          estimatedRoadLinkUsers: 0,
          monthlyRides: 0,
          monthlyRevenue: 0,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setAirportName("");
      setCode("");
      setContactName("");
      setContactEmail("");
      setCity("");
      setStateValue("");

      setMessage("Airport lead created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create airport lead.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: AirportStatus) {
    try {
      await setDoc(
        doc(db, "airportPartnerships", id),
        {
          status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `airport-${id}-${Date.now()}`),
        {
          action: "Airport Partnership Status Updated",
          targetId: id,
          targetType: "airportPartnership",
          details: `Status changed to ${status}`,
          severity: status === "active" ? "success" : "info",
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("Airport status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update airport.");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: AirportStatus) {
    if (status === "active") return "Active";
    if (status === "pilot") return "Pilot";
    if (status === "negotiating") return "Negotiating";
    if (status === "paused") return "Paused";
    return "Lead";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/partnerships" className="miniButton">Partnerships</Link>
          <Link href="/admin/corporate-accounts" className="miniButton">Corporate</Link>
          <Link href="/admin/market-intelligence" className="miniButton">Market</Link>
          <Link href="/admin/route-intelligence" className="miniButton">Routes</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Travel Growth</p>
            <h1>Airport <span>Partnerships</span></h1>
            <p className="subtitle">
              Manage airport partnerships, ground transportation leads, traveler demand,
              monthly rides, estimated RoadLink users and airport revenue potential.
            </p>
          </div>

          <div className={metrics.airportScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.airportScore}</strong>
            <span>Airport Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="✈️" label="Airports" value={String(airports.length)} />
          <Metric icon="✅" label="Active" value={String(metrics.active.length)} />
          <Metric icon="🧪" label="Pilot" value={String(metrics.pilot.length)} />
          <Metric icon="🗣️" label="Negotiating" value={String(metrics.negotiating.length)} />
          <Metric icon="👥" label="Est. Users" value={metrics.users.toLocaleString()} />
          <Metric icon="🚘" label="Monthly Rides" value={metrics.rides.toLocaleString()} />
          <Metric icon="🧳" label="Passengers" value={metrics.passengers.toLocaleString()} />
          <Metric icon="💰" label="Monthly Revenue" value={money(metrics.revenue)} />
        </section>

        <section className="card">
          <p className="eyebrow">Create Airport Lead</p>
          <h2>New Airport Partner</h2>

          <div className="formGrid">
            <input value={airportName} onChange={(e) => setAirportName(e.target.value)} placeholder="Airport name" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Airport code, example SJU" />
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            <input value={stateValue} onChange={(e) => setStateValue(e.target.value)} placeholder="State" />
          </div>

          <button className="saveButton" onClick={createAirport} disabled={saving}>
            {saving ? "Creating..." : "Create Airport Lead"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">Airport Pipeline</p>
          <h2>Airport Accounts</h2>

          {airports.length === 0 ? (
            <div className="empty">
              <h3>No airports yet</h3>
              <p>Create your first airport lead to begin transportation partnerships.</p>
            </div>
          ) : (
            <div className="accountGrid">
              {airports.map((item) => (
                <section key={item.id} className="accountCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.airportName || "Unknown Airport"} {item.code ? `(${item.code})` : ""}</h3>
                      <p>{item.contactEmail || "No email"}</p>
                    </div>

                    <span className={`pill ${item.status || "lead"}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Contact" value={item.contactName || "Not assigned"} />
                    <Info label="Location" value={`${item.city || ""} ${item.state || ""}`.trim() || "Not set"} />
                    <Info label="Monthly Passengers" value={String(item.monthlyPassengers || 0)} />
                    <Info label="Estimated Users" value={String(item.estimatedRoadLinkUsers || 0)} />
                    <Info label="Monthly Rides" value={String(item.monthlyRides || 0)} />
                    <Info label="Monthly Revenue" value={money(Number(item.monthlyRevenue || 0))} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(item.id, "negotiating")}>Negotiate</button>
                    <button onClick={() => updateStatus(item.id, "pilot")}>Pilot</button>
                    <button onClick={() => updateStatus(item.id, "active")}>Activate</button>
                    <button className="dangerButton" onClick={() => updateStatus(item.id, "paused")}>Pause</button>
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
            radial-gradient(circle at top right, rgba(59,130,246,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
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
        .card,
        .accountCard {
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
        .accountCard p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 104px;
          height: 104px;
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

        .accountGrid {
          display: grid;
          gap: 16px;
        }

        .accountCard {
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

        .accountCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
        }

        .accountCard p {
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

        @media (max-width: 1100px) {
          .stats,
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
