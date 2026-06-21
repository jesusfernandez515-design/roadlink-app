"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UniversityStatus = "active" | "pilot" | "qualified" | "lead" | "paused";

type UniversityItem = {
  id: string;
  name?: string;
  status?: UniversityStatus;
  contactName?: string;
  contactEmail?: string;
  city?: string;
  state?: string;
  students?: number;
  activeUsers?: number;
  monthlyRides?: number;
  monthlyRevenue?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminUniversityProgramPage() {
  const [universities, setUniversities] = useState<UniversityItem[]>([]);
  const [message, setMessage] = useState("Loading university program...");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "universityPrograms")),
      (snapshot) => {
        setUniversities(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UniversityItem[]
        );
        setMessage("");
      },
      () => {
        setUniversities([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const active = universities.filter((item) => item.status === "active");
    const pilot = universities.filter((item) => item.status === "pilot");
    const qualified = universities.filter((item) => item.status === "qualified");
    const leads = universities.filter((item) => !item.status || item.status === "lead");

    const students = universities.reduce((total, item) => total + Number(item.students || 0), 0);
    const activeUsers = universities.reduce((total, item) => total + Number(item.activeUsers || 0), 0);
    const monthlyRides = universities.reduce((total, item) => total + Number(item.monthlyRides || 0), 0);
    const monthlyRevenue = universities.reduce((total, item) => total + Number(item.monthlyRevenue || 0), 0);

    const programScore = Math.max(
      Math.min(
        active.length * 25 +
          pilot.length * 15 +
          qualified.length * 10 +
          leads.length * 4 +
          monthlyRides * 2 +
          Math.round(monthlyRevenue / 200),
        100
      ),
      0
    );

    return {
      active,
      pilot,
      qualified,
      leads,
      students,
      activeUsers,
      monthlyRides,
      monthlyRevenue,
      programScore,
    };
  }, [universities]);

  async function createUniversity() {
    if (!name.trim()) {
      setMessage("University name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `university-${Date.now()}`;

      await setDoc(
        doc(db, "universityPrograms", id),
        {
          name: name.trim(),
          status: "lead",
          contactName: contactName.trim() || "Not assigned",
          contactEmail: contactEmail.trim() || "No email",
          city: city.trim() || "Unknown City",
          state: stateValue.trim() || "Unknown State",
          students: 0,
          activeUsers: 0,
          monthlyRides: 0,
          monthlyRevenue: 0,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setName("");
      setContactName("");
      setContactEmail("");
      setCity("");
      setStateValue("");

      setMessage("University lead created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create university lead.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: UniversityStatus) {
    try {
      await setDoc(
        doc(db, "universityPrograms", id),
        {
          status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `university-${id}-${Date.now()}`),
        {
          action: "University Program Status Updated",
          targetId: id,
          targetType: "universityProgram",
          details: `Status changed to ${status}`,
          severity: status === "active" ? "success" : "info",
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("University status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update university.");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: UniversityStatus) {
    if (status === "active") return "Active";
    if (status === "pilot") return "Pilot";
    if (status === "qualified") return "Qualified";
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
          <Link href="/admin/growth-intelligence" className="miniButton">Growth</Link>
          <Link href="/admin/market-intelligence" className="miniButton">Market</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Campus Growth</p>
            <h1>University <span>Program</span></h1>
            <p className="subtitle">
              Manage university partnerships, campus pilots, student travel programs,
              monthly rides, active users and campus revenue potential.
            </p>
          </div>

          <div className={metrics.programScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.programScore}</strong>
            <span>Program Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎓" label="Universities" value={String(universities.length)} />
          <Metric icon="✅" label="Active" value={String(metrics.active.length)} />
          <Metric icon="🧪" label="Pilot" value={String(metrics.pilot.length)} />
          <Metric icon="🌱" label="Leads" value={String(metrics.leads.length)} />
          <Metric icon="👥" label="Students" value={metrics.students.toLocaleString()} />
          <Metric icon="🚘" label="Monthly Rides" value={metrics.monthlyRides.toLocaleString()} />
          <Metric icon="🟢" label="Active Users" value={metrics.activeUsers.toLocaleString()} />
          <Metric icon="💰" label="Monthly Revenue" value={money(metrics.monthlyRevenue)} />
        </section>

        <section className="card">
          <p className="eyebrow">Create University Lead</p>
          <h2>New Campus Partner</h2>

          <div className="formGrid">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="University name" />
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            <input value={stateValue} onChange={(e) => setStateValue(e.target.value)} placeholder="State" />
          </div>

          <button className="saveButton" onClick={createUniversity} disabled={saving}>
            {saving ? "Creating..." : "Create University Lead"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">Campus Pipeline</p>
          <h2>University Accounts</h2>

          {universities.length === 0 ? (
            <div className="empty">
              <h3>No universities yet</h3>
              <p>Create your first university lead to begin campus growth.</p>
            </div>
          ) : (
            <div className="accountGrid">
              {universities.map((item) => (
                <section key={item.id} className="accountCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.name || "Unknown University"}</h3>
                      <p>{item.contactEmail || "No email"}</p>
                    </div>

                    <span className={`pill ${item.status || "lead"}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Contact" value={item.contactName || "Not assigned"} />
                    <Info label="Location" value={`${item.city || ""} ${item.state || ""}`.trim() || "Not set"} />
                    <Info label="Students" value={String(item.students || 0)} />
                    <Info label="Active Users" value={String(item.activeUsers || 0)} />
                    <Info label="Monthly Rides" value={String(item.monthlyRides || 0)} />
                    <Info label="Monthly Revenue" value={money(Number(item.monthlyRevenue || 0))} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(item.id, "qualified")}>Qualify</button>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
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

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

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

        .warningScore strong {
          color: #fca5a5;
        }

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
