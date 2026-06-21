"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type RevenueSource =
  | "corporate"
  | "university"
  | "airport"
  | "government"
  | "partnership"
  | "other";

type RevenueStatus = "active" | "forecast" | "pending" | "paused";

type RevenueAccount = {
  id: string;
  name?: string;
  source?: RevenueSource;
  status?: RevenueStatus;
  monthlyRevenue?: number;
  annualRevenue?: number;
  clients?: number;
  activeUsers?: number;
  monthlyRides?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type BasicRevenueItem = {
  id: string;
  companyName?: string;
  name?: string;
  agencyName?: string;
  airportName?: string;
  status?: string;
  monthlyRevenue?: number;
  estimatedMonthlyRevenue?: number;
  contractValue?: number;
  activeUsers?: number;
  monthlyRides?: number;
  estimatedUsers?: number;
};

export default function AdminEnterpriseRevenuePage() {
  const [manualRevenue, setManualRevenue] = useState<RevenueAccount[]>([]);
  const [corporateAccounts, setCorporateAccounts] = useState<BasicRevenueItem[]>([]);
  const [universityPrograms, setUniversityPrograms] = useState<BasicRevenueItem[]>([]);
  const [airportPartnerships, setAirportPartnerships] = useState<BasicRevenueItem[]>([]);
  const [governmentContracts, setGovernmentContracts] = useState<BasicRevenueItem[]>([]);
  const [partnerships, setPartnerships] = useState<BasicRevenueItem[]>([]);
  const [message, setMessage] = useState("Loading enterprise revenue...");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [source, setSource] = useState<RevenueSource>("corporate");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [clients, setClients] = useState("");
  const [activeUsers, setActiveUsers] = useState("");
  const [monthlyRides, setMonthlyRides] = useState("");

  useEffect(() => {
    const listen = <T,>(collectionName: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, collectionName)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => setter([])
      );

    const unsubManual = listen<RevenueAccount>("enterpriseRevenue", setManualRevenue);
    const unsubCorporate = listen<BasicRevenueItem>("corporateAccounts", setCorporateAccounts);
    const unsubUniversity = listen<BasicRevenueItem>("universityPrograms", setUniversityPrograms);
    const unsubAirport = listen<BasicRevenueItem>("airportPartnerships", setAirportPartnerships);
    const unsubGovernment = listen<BasicRevenueItem>("governmentContracts", setGovernmentContracts);
    const unsubPartnerships = listen<BasicRevenueItem>("partnerships", setPartnerships);

    return () => {
      unsubManual();
      unsubCorporate();
      unsubUniversity();
      unsubAirport();
      unsubGovernment();
      unsubPartnerships();
    };
  }, []);

  const revenueAccounts = useMemo<RevenueAccount[]>(() => {
    const corporate = corporateAccounts.map((item) => ({
      id: `corporate-${item.id}`,
      name: item.companyName || item.name || "Corporate Account",
      source: "corporate" as RevenueSource,
      status: item.status === "active" ? "active" : "forecast",
      monthlyRevenue: Number(item.monthlyRevenue || 0),
      annualRevenue: Number(item.monthlyRevenue || 0) * 12,
      clients: 1,
      activeUsers: Number(item.activeUsers || 0),
      monthlyRides: Number(item.monthlyRides || 0),
      notes: "Imported from Corporate Accounts",
    }));

    const universities = universityPrograms.map((item) => ({
      id: `university-${item.id}`,
      name: item.name || "University Program",
      source: "university" as RevenueSource,
      status: item.status === "active" ? "active" : "forecast",
      monthlyRevenue: Number(item.monthlyRevenue || 0),
      annualRevenue: Number(item.monthlyRevenue || 0) * 12,
      clients: 1,
      activeUsers: Number(item.activeUsers || 0),
      monthlyRides: Number(item.monthlyRides || 0),
      notes: "Imported from University Program",
    }));

    const airports = airportPartnerships.map((item) => ({
      id: `airport-${item.id}`,
      name: item.airportName || "Airport Partnership",
      source: "airport" as RevenueSource,
      status: item.status === "active" ? "active" : "forecast",
      monthlyRevenue: Number(item.monthlyRevenue || 0),
      annualRevenue: Number(item.monthlyRevenue || 0) * 12,
      clients: 1,
      activeUsers: Number(item.estimatedUsers || 0),
      monthlyRides: Number(item.monthlyRides || 0),
      notes: "Imported from Airport Partnerships",
    }));

    const government = governmentContracts.map((item) => ({
      id: `government-${item.id}`,
      name: item.agencyName || "Government Contract",
      source: "government" as RevenueSource,
      status: item.status === "awarded" ? "active" : "forecast",
      monthlyRevenue: Number(item.monthlyRevenue || 0),
      annualRevenue: Number(item.monthlyRevenue || 0) * 12,
      clients: 1,
      activeUsers: Number(item.estimatedUsers || 0),
      monthlyRides: Number(item.monthlyRides || 0),
      notes: `Contract value ${money(Number(item.contractValue || 0))}`,
    }));

    const partnerRevenue = partnerships.map((item) => ({
      id: `partnership-${item.id}`,
      name: item.name || "Partnership",
      source: "partnership" as RevenueSource,
      status: item.status === "signed" ? "active" : "forecast",
      monthlyRevenue: Number(item.estimatedMonthlyRevenue || item.monthlyRevenue || 0),
      annualRevenue: Number(item.estimatedMonthlyRevenue || item.monthlyRevenue || 0) * 12,
      clients: 1,
      activeUsers: Number(item.estimatedUsers || 0),
      monthlyRides: Number(item.monthlyRides || 0),
      notes: "Imported from Partnerships",
    }));

    return [
      ...manualRevenue,
      ...corporate,
      ...universities,
      ...airports,
      ...government,
      ...partnerRevenue,
    ].sort((a, b) => Number(b.monthlyRevenue || 0) - Number(a.monthlyRevenue || 0));
  }, [
    manualRevenue,
    corporateAccounts,
    universityPrograms,
    airportPartnerships,
    governmentContracts,
    partnerships,
  ]);

  const metrics = useMemo(() => {
    const active = revenueAccounts.filter((item) => item.status === "active");
    const forecast = revenueAccounts.filter((item) => item.status === "forecast");
    const pending = revenueAccounts.filter((item) => item.status === "pending");

    const mrr = active.reduce((total, item) => total + Number(item.monthlyRevenue || 0), 0);
    const forecastMrr = revenueAccounts
      .filter((item) => item.status !== "paused")
      .reduce((total, item) => total + Number(item.monthlyRevenue || 0), 0);

    const arr = mrr * 12;
    const forecastArr = forecastMrr * 12;

    const activeUsersTotal = revenueAccounts.reduce(
      (total, item) => total + Number(item.activeUsers || 0),
      0
    );

    const monthlyRidesTotal = revenueAccounts.reduce(
      (total, item) => total + Number(item.monthlyRides || 0),
      0
    );

    const clients = revenueAccounts.reduce((total, item) => total + Number(item.clients || 0), 0);

    const enterpriseScore = Math.max(
      Math.min(
        active.length * 20 +
          forecast.length * 8 +
          pending.length * 4 +
          Math.round(mrr / 500) +
          Math.round(monthlyRidesTotal / 10),
        100
      ),
      0
    );

    const bySource = {
      corporate: revenueAccounts.filter((item) => item.source === "corporate"),
      university: revenueAccounts.filter((item) => item.source === "university"),
      airport: revenueAccounts.filter((item) => item.source === "airport"),
      government: revenueAccounts.filter((item) => item.source === "government"),
      partnership: revenueAccounts.filter((item) => item.source === "partnership"),
      other: revenueAccounts.filter((item) => item.source === "other"),
    };

    return {
      active,
      forecast,
      pending,
      mrr,
      forecastMrr,
      arr,
      forecastArr,
      activeUsersTotal,
      monthlyRidesTotal,
      clients,
      enterpriseScore,
      bySource,
    };
  }, [revenueAccounts]);

  async function createRevenueAccount() {
    if (!name.trim()) {
      setMessage("Revenue account name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `enterprise-revenue-${Date.now()}`;
      const monthly = Number(monthlyRevenue || 0);

      await setDoc(
        doc(db, "enterpriseRevenue", id),
        {
          name: name.trim(),
          source,
          status: "forecast",
          monthlyRevenue: monthly,
          annualRevenue: monthly * 12,
          clients: Number(clients || 1),
          activeUsers: Number(activeUsers || 0),
          monthlyRides: Number(monthlyRides || 0),
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setName("");
      setSource("corporate");
      setMonthlyRevenue("");
      setClients("");
      setActiveUsers("");
      setMonthlyRides("");

      setMessage("Enterprise revenue account created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create revenue account.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: RevenueStatus) {
    const cleanId = id.replace("corporate-", "").replace("university-", "").replace("airport-", "").replace("government-", "").replace("partnership-", "");

    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "enterpriseRevenue", cleanId),
        {
          status,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `enterprise-revenue-${cleanId}-${Date.now()}`),
        {
          action: "Enterprise Revenue Status Updated",
          targetId: cleanId,
          targetType: "enterpriseRevenue",
          details: `Revenue status changed to ${status}`,
          severity: status === "active" ? "success" : status === "paused" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Enterprise revenue status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update revenue account.");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function sourceLabel(value?: RevenueSource) {
    if (value === "corporate") return "Corporate";
    if (value === "university") return "University";
    if (value === "airport") return "Airport";
    if (value === "government") return "Government";
    if (value === "partnership") return "Partnership";
    return "Other";
  }

  function statusLabel(value?: RevenueStatus) {
    if (value === "active") return "Active";
    if (value === "pending") return "Pending";
    if (value === "paused") return "Paused";
    return "Forecast";
  }

  function sourceRevenue(items: RevenueAccount[]) {
    return items.reduce((total, item) => total + Number(item.monthlyRevenue || 0), 0);
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/sales-pipeline" className="miniButton">Sales</Link>
          <Link href="/admin/crm" className="miniButton">CRM</Link>
          <Link href="/admin/corporate-accounts" className="miniButton">Corporate</Link>
          <Link href="/admin/government-contracts" className="miniButton">Government</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise Revenue</p>
            <h1>Enterprise <span>Revenue</span></h1>
            <p className="subtitle">
              Consolidate MRR, ARR, forecast revenue, active enterprise clients,
              corporate accounts, universities, airports, partnerships and government contracts.
            </p>
          </div>

          <div className={metrics.enterpriseScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.enterpriseScore}</strong>
            <span>Revenue Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💵" label="MRR" value={money(metrics.mrr)} />
          <Metric icon="🏦" label="ARR" value={money(metrics.arr)} />
          <Metric icon="📈" label="Forecast MRR" value={money(metrics.forecastMrr)} />
          <Metric icon="🚀" label="Forecast ARR" value={money(metrics.forecastArr)} />
          <Metric icon="🏢" label="Clients" value={String(metrics.clients)} />
          <Metric icon="✅" label="Active" value={String(metrics.active.length)} />
          <Metric icon="👥" label="Users" value={metrics.activeUsersTotal.toLocaleString()} />
          <Metric icon="🚘" label="Monthly Rides" value={metrics.monthlyRidesTotal.toLocaleString()} />
        </section>

        <section className="sourceGrid">
          <SourceCard title="Corporate" icon="🏢" value={money(sourceRevenue(metrics.bySource.corporate))} count={metrics.bySource.corporate.length} />
          <SourceCard title="Universities" icon="🎓" value={money(sourceRevenue(metrics.bySource.university))} count={metrics.bySource.university.length} />
          <SourceCard title="Airports" icon="✈️" value={money(sourceRevenue(metrics.bySource.airport))} count={metrics.bySource.airport.length} />
          <SourceCard title="Government" icon="🏛️" value={money(sourceRevenue(metrics.bySource.government))} count={metrics.bySource.government.length} />
          <SourceCard title="Partnerships" icon="🤝" value={money(sourceRevenue(metrics.bySource.partnership))} count={metrics.bySource.partnership.length} />
          <SourceCard title="Other" icon="📦" value={money(sourceRevenue(metrics.bySource.other))} count={metrics.bySource.other.length} />
        </section>

        <section className="card">
          <p className="eyebrow">Create Revenue Account</p>
          <h2>Manual Enterprise Revenue</h2>

          <div className="formGrid">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" />

            <select value={source} onChange={(e) => setSource(e.target.value as RevenueSource)}>
              <option value="corporate">Corporate</option>
              <option value="university">University</option>
              <option value="airport">Airport</option>
              <option value="government">Government</option>
              <option value="partnership">Partnership</option>
              <option value="other">Other</option>
            </select>

            <input value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(e.target.value)} placeholder="Monthly revenue" type="number" />
            <input value={clients} onChange={(e) => setClients(e.target.value)} placeholder="Clients" type="number" />
            <input value={activeUsers} onChange={(e) => setActiveUsers(e.target.value)} placeholder="Active users" type="number" />
            <input value={monthlyRides} onChange={(e) => setMonthlyRides(e.target.value)} placeholder="Monthly rides" type="number" />
          </div>

          <button className="saveButton" onClick={createRevenueAccount} disabled={saving}>
            {saving ? "Creating..." : "Create Revenue Account"}
          </button>
        </section>

        <section className="card">
          <p className="eyebrow">Enterprise Revenue Accounts</p>
          <h2>Revenue Portfolio</h2>

          {revenueAccounts.length === 0 ? (
            <div className="empty">
              <h3>No enterprise revenue yet</h3>
              <p>Create or connect corporate, university, airport, government or partnership accounts.</p>
            </div>
          ) : (
            <div className="accountGrid">
              {revenueAccounts.map((item) => (
                <section key={item.id} className="accountCard">
                  <div className="cardTop">
                    <div>
                      <h3>{item.name || "Unknown Revenue Account"}</h3>
                      <p>{sourceLabel(item.source)} • {item.notes || "Enterprise revenue account"}</p>
                    </div>

                    <span className={`pill ${item.status || "forecast"}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Source" value={sourceLabel(item.source)} />
                    <Info label="Status" value={statusLabel(item.status)} />
                    <Info label="MRR" value={money(Number(item.monthlyRevenue || 0))} />
                    <Info label="ARR" value={money(Number(item.annualRevenue || Number(item.monthlyRevenue || 0) * 12))} />
                    <Info label="Clients" value={String(item.clients || 0)} />
                    <Info label="Active Users" value={String(item.activeUsers || 0)} />
                    <Info label="Monthly Rides" value={String(item.monthlyRides || 0)} />
                    <Info label="ID" value={item.id} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateStatus(item.id, "active")}>Active</button>
                    <button onClick={() => updateStatus(item.id, "forecast")}>Forecast</button>
                    <button onClick={() => updateStatus(item.id, "pending")}>Pending</button>
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
        .accountCard,
        .sourceCard {
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
        .accountCard p,
        .sourceCard p {
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

        .sourceGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .sourceCard {
          border-radius: 24px;
          padding: 20px;
        }

        .sourceIcon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .sourceCard h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        .sourceCard strong {
          display: block;
          color: #22c55e;
          font-size: 24px;
          margin-bottom: 6px;
        }

        .sourceCard p {
          margin: 0;
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
          overflow-wrap: anywhere;
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
          .sourceGrid {
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
          .sourceGrid,
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

function SourceCard({
  title,
  icon,
  value,
  count,
}: {
  title: string;
  icon: string;
  value: string;
  count: number;
}) {
  return (
    <section className="sourceCard">
      <div className="sourceIcon">{icon}</div>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{count} account(s)</p>
    </section>
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
