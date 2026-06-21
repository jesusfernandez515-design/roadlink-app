"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type PartnerType = "university" | "corporate" | "hotel" | "airport" | "government" | "other";
type PartnerStatus = "signed" | "negotiating" | "qualified" | "lead" | "lost";

type PartnershipItem = {
  id: string;
  name?: string;
  type?: PartnerType;
  status?: PartnerStatus;
  contactName?: string;
  contactEmail?: string;
  city?: string;
  state?: string;
  estimatedUsers?: number;
  estimatedMonthlyRides?: number;
  estimatedMonthlyRevenue?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PartnershipLead = {
  id: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  contactName: string;
  contactEmail: string;
  city: string;
  state: string;
  estimatedUsers: number;
  estimatedMonthlyRides: number;
  estimatedMonthlyRevenue: number;
  partnershipScore: number;
  priority: "critical" | "high" | "medium" | "low";
  insight: string;
  notes: string;
};

const starterLeads: PartnershipLead[] = [
  {
    id: "starter-university",
    name: "University Partnership Program",
    type: "university",
    status: "lead",
    contactName: "Student Transportation Office",
    contactEmail: "transportation@example.edu",
    city: "San Juan",
    state: "Puerto Rico",
    estimatedUsers: 500,
    estimatedMonthlyRides: 220,
    estimatedMonthlyRevenue: 6600,
    partnershipScore: 74,
    priority: "high",
    insight: "Universities can create recurring demand from students traveling between cities.",
    notes: "Target students who need long-distance rides between campus, home and airports.",
  },
  {
    id: "starter-corporate",
    name: "Corporate Employee Commute Program",
    type: "corporate",
    status: "lead",
    contactName: "HR / Operations",
    contactEmail: "hr@example.com",
    city: "Guayama",
    state: "Puerto Rico",
    estimatedUsers: 250,
    estimatedMonthlyRides: 160,
    estimatedMonthlyRevenue: 4800,
    partnershipScore: 68,
    priority: "high",
    insight: "Companies can generate predictable employee transportation demand.",
    notes: "Offer employee travel benefits and monthly reporting.",
  },
  {
    id: "starter-airport",
    name: "Airport Ride Connection Program",
    type: "airport",
    status: "lead",
    contactName: "Ground Transportation",
    contactEmail: "transportation@example.com",
    city: "Carolina",
    state: "Puerto Rico",
    estimatedUsers: 800,
    estimatedMonthlyRides: 300,
    estimatedMonthlyRevenue: 9000,
    partnershipScore: 82,
    priority: "critical",
    insight: "Airports can generate strong long-distance ride demand.",
    notes: "Focus on travelers who need affordable rides after flights.",
  },
];

export default function AdminPartnershipCenterPage() {
  const [partnerships, setPartnerships] = useState<PartnershipItem[]>([]);
  const [selected, setSelected] = useState<PartnershipLead | null>(null);
  const [filter, setFilter] = useState<"all" | PartnerStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | PartnerType>("all");
  const [message, setMessage] = useState("Loading partnership center...");
  const [savingId, setSavingId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<PartnerType>("university");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftState, setDraftState] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "partnerships")),
      (snapshot) => {
        setPartnerships(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PartnershipItem[]
        );
        setMessage("");
      },
      () => {
        setPartnerships([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const partnershipLeads = useMemo<PartnershipLead[]>(() => {
    const savedLeads = partnerships.map((item) => {
      const estimatedUsers = Number(item.estimatedUsers || 0);
      const estimatedMonthlyRides = Number(item.estimatedMonthlyRides || 0);
      const estimatedMonthlyRevenue = Number(item.estimatedMonthlyRevenue || 0);

      let partnershipScore = 0;

      partnershipScore += estimatedUsers >= 500 ? 25 : estimatedUsers >= 200 ? 16 : estimatedUsers > 0 ? 8 : 0;
      partnershipScore += estimatedMonthlyRides >= 250 ? 25 : estimatedMonthlyRides >= 100 ? 16 : estimatedMonthlyRides > 0 ? 8 : 0;
      partnershipScore += estimatedMonthlyRevenue >= 7500 ? 25 : estimatedMonthlyRevenue >= 2500 ? 16 : estimatedMonthlyRevenue > 0 ? 8 : 0;
      partnershipScore += item.status === "signed" ? 25 : item.status === "negotiating" ? 16 : item.status === "qualified" ? 10 : 4;

      partnershipScore = Math.max(Math.min(partnershipScore, 100), 0);

      const priority: PartnershipLead["priority"] =
        partnershipScore >= 80
          ? "critical"
          : partnershipScore >= 60
          ? "high"
          : partnershipScore >= 35
          ? "medium"
          : "low";

      const insight =
        item.status === "signed"
          ? "Signed partner. Focus on activation and monthly ride volume."
          : item.status === "negotiating"
          ? "Negotiation in progress. Follow up and close the partnership."
          : item.status === "qualified"
          ? "Qualified partner. Prepare proposal and pilot plan."
          : item.status === "lost"
          ? "Lost opportunity. Review notes and reasons before re-engaging."
          : "New partnership lead. Validate demand and decision maker.";

      return {
        id: item.id,
        name: item.name || "Unnamed Partner",
        type: item.type || "other",
        status: item.status || "lead",
        contactName: item.contactName || "Not assigned",
        contactEmail: item.contactEmail || "No email",
        city: item.city || "Unknown City",
        state: item.state || "Unknown State",
        estimatedUsers,
        estimatedMonthlyRides,
        estimatedMonthlyRevenue,
        partnershipScore,
        priority,
        insight,
        notes: item.notes || "",
      };
    });

    const existingNames = new Set(savedLeads.map((item) => item.name.toLowerCase()));
    const missingStarterLeads = starterLeads.filter((item) => !existingNames.has(item.name.toLowerCase()));

    return [...savedLeads, ...missingStarterLeads].sort(
      (a, b) =>
        b.partnershipScore +
        b.estimatedMonthlyRevenue / 100 -
        (a.partnershipScore + a.estimatedMonthlyRevenue / 100)
    );
  }, [partnerships]);

  const filteredLeads = useMemo(() => {
    return partnershipLeads.filter((item) => {
      const matchesStatus = filter === "all" || item.status === filter;
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      return matchesStatus && matchesType;
    });
  }, [partnershipLeads, filter, typeFilter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredLeads.length === 0) return null;
      if (!current) return filteredLeads[0];
      return filteredLeads.find((item) => item.id === current.id) || filteredLeads[0];
    });
  }, [filteredLeads]);

  const signed = partnershipLeads.filter((item) => item.status === "signed").length;
  const negotiating = partnershipLeads.filter((item) => item.status === "negotiating").length;
  const qualified = partnershipLeads.filter((item) => item.status === "qualified").length;
  const leads = partnershipLeads.filter((item) => item.status === "lead").length;
  const estimatedRevenue = partnershipLeads.reduce(
    (total, item) => total + item.estimatedMonthlyRevenue,
    0
  );
  const estimatedUsers = partnershipLeads.reduce((total, item) => total + item.estimatedUsers, 0);

  async function savePartnership(item: PartnershipLead, status?: PartnerStatus) {
    try {
      setSavingId(item.id);
      setMessage("");

      const now = new Date().toISOString();
      const finalStatus = status || item.status;

      await setDoc(
        doc(db, "partnerships", item.id),
        {
          name: item.name,
          type: item.type,
          status: finalStatus,
          contactName: item.contactName,
          contactEmail: item.contactEmail,
          city: item.city,
          state: item.state,
          estimatedUsers: item.estimatedUsers,
          estimatedMonthlyRides: item.estimatedMonthlyRides,
          estimatedMonthlyRevenue: item.estimatedMonthlyRevenue,
          partnershipScore: item.partnershipScore,
          priority: item.priority,
          insight: item.insight,
          notes: item.notes,
          updatedAt: now,
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `partnership-${item.id}-${Date.now()}`),
        {
          action: "Partnership Saved",
          targetId: item.id,
          targetType: "partnership",
          details: `${item.name} saved as ${finalStatus}`,
          severity: finalStatus === "signed" ? "success" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Partnership saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save partnership.");
    } finally {
      setSavingId("");
    }
  }

  async function createDraftLead() {
    if (!draftName.trim()) {
      setMessage("Partner name is required.");
      return;
    }

    try {
      setSavingId("new");
      setMessage("");

      const now = new Date().toISOString();
      const id = `partner-${Date.now()}`;

      await setDoc(
        doc(db, "partnerships", id),
        {
          name: draftName.trim(),
          type: draftType,
          status: "lead",
          contactName: "Not assigned",
          contactEmail: draftEmail.trim() || "No email",
          city: draftCity.trim() || "Unknown City",
          state: draftState.trim() || "Unknown State",
          estimatedUsers: 0,
          estimatedMonthlyRides: 0,
          estimatedMonthlyRevenue: 0,
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setDraftName("");
      setDraftEmail("");
      setDraftCity("");
      setDraftState("");
      setMessage("New partnership lead created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create lead.");
    } finally {
      setSavingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: PartnerStatus) {
    if (status === "signed") return "Signed";
    if (status === "negotiating") return "Negotiating";
    if (status === "qualified") return "Qualified";
    if (status === "lost") return "Lost";
    return "Lead";
  }

  function typeLabel(type: PartnerType) {
    if (type === "university") return "University";
    if (type === "corporate") return "Corporate";
    if (type === "hotel") return "Hotel";
    if (type === "airport") return "Airport";
    if (type === "government") return "Government";
    return "Other";
  }

  function shortText(value?: string, max = 44) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/growth-intelligence" className="miniButton">Growth</Link>
          <Link href="/admin/market-intelligence" className="miniButton">Market</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Business Development</p>
            <h1>Partnership <span>Center</span></h1>
            <p className="subtitle">
              Manage universities, companies, hotels, airports, government leads,
              estimated users, monthly rides, revenue potential and partnership status.
            </p>
          </div>

          <div className={estimatedRevenue > 0 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{money(estimatedRevenue)}</strong>
            <span>Monthly Potential</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🤝" label="Signed" value={String(signed)} />
          <Metric icon="🗣️" label="Negotiating" value={String(negotiating)} />
          <Metric icon="✅" label="Qualified" value={String(qualified)} />
          <Metric icon="🌱" label="Leads" value={String(leads)} />
          <Metric icon="👥" label="Est. Users" value={estimatedUsers.toLocaleString()} />
          <Metric icon="💰" label="Est. Monthly" value={money(estimatedRevenue)} />
        </section>

        <section className="filters">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | PartnerStatus)}
          >
            <option value="all">All statuses</option>
            <option value="signed">Signed</option>
            <option value="negotiating">Negotiating</option>
            <option value="qualified">Qualified</option>
            <option value="lead">Lead</option>
            <option value="lost">Lost</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "all" | PartnerType)}
          >
            <option value="all">All types</option>
            <option value="university">University</option>
            <option value="corporate">Corporate</option>
            <option value="hotel">Hotel</option>
            <option value="airport">Airport</option>
            <option value="government">Government</option>
            <option value="other">Other</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="leadCard">
            <p className="eyebrow">Partnership Pipeline</p>
            <h2>Partner Leads</h2>

            {filteredLeads.length === 0 ? (
              <div className="empty">
                <h3>No partnership data found</h3>
                <p>Create a lead or save one of the starter opportunities.</p>
              </div>
            ) : (
              <div className="leadList">
                {filteredLeads.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "leadRow activeLead" : "leadRow"}
                  >
                    <div className={`leadIcon ${item.priority}`}>
                      {item.type === "university"
                        ? "🎓"
                        : item.type === "corporate"
                        ? "🏢"
                        : item.type === "hotel"
                        ? "🏨"
                        : item.type === "airport"
                        ? "✈️"
                        : item.type === "government"
                        ? "🏛️"
                        : "🤝"}
                    </div>

                    <div className="leadInfo">
                      <strong>{shortText(item.name)}</strong>
                      <span>{typeLabel(item.type)} • {statusLabel(item.status)}</span>
                      <small>{money(item.estimatedMonthlyRevenue)} monthly • Score {item.partnershipScore}/100</small>
                    </div>

                    <em className={`status ${item.status}`}>
                      {statusLabel(item.status)}
                    </em>
                  </button>
                ))}
              </div>
            )}

            <section className="createBox">
              <p className="eyebrow">Create Lead</p>
              <h2>New Partner</h2>

              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Partner name"
              />

              <select
                value={draftType}
                onChange={(event) => setDraftType(event.target.value as PartnerType)}
              >
                <option value="university">University</option>
                <option value="corporate">Corporate</option>
                <option value="hotel">Hotel</option>
                <option value="airport">Airport</option>
                <option value="government">Government</option>
                <option value="other">Other</option>
              </select>

              <input
                value={draftEmail}
                onChange={(event) => setDraftEmail(event.target.value)}
                placeholder="Contact email"
              />

              <input
                value={draftCity}
                onChange={(event) => setDraftCity(event.target.value)}
                placeholder="City"
              />

              <input
                value={draftState}
                onChange={(event) => setDraftState(event.target.value)}
                placeholder="State"
              />

              <button className="saveButton" onClick={createDraftLead} disabled={savingId === "new"}>
                Create Lead
              </button>
            </section>
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Partner</p>
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.contactEmail}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.priority}`}>
                  <span>Partnership Score</span>
                  <strong>{selected.partnershipScore}/100</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.partnershipScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Partner Type" value={typeLabel(selected.type)} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Priority" value={selected.priority} />
                  <Info label="Contact Name" value={selected.contactName} />
                  <Info label="Contact Email" value={selected.contactEmail} />
                  <Info label="City" value={selected.city} />
                  <Info label="State" value={selected.state} />
                  <Info label="Estimated Users" value={selected.estimatedUsers.toLocaleString()} />
                  <Info label="Monthly Rides" value={selected.estimatedMonthlyRides.toLocaleString()} />
                  <Info label="Monthly Revenue" value={money(selected.estimatedMonthlyRevenue)} />
                  <Info label="Notes" value={selected.notes || "No notes"} />
                  <Info label="ID" value={selected.id} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Partnership Recommendation</p>
                  <h2>
                    {selected.status === "signed"
                      ? "Activate partner"
                      : selected.status === "negotiating"
                      ? "Close negotiation"
                      : selected.status === "qualified"
                      ? "Send proposal"
                      : selected.status === "lost"
                      ? "Review lost lead"
                      : "Qualify lead"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => savePartnership(selected)}
                    disabled={savingId === selected.id}
                  >
                    Save
                  </button>

                  <button
                    className="linkButton"
                    onClick={() => savePartnership(selected, "qualified")}
                    disabled={savingId === selected.id}
                  >
                    Qualify
                  </button>

                  <button
                    className="linkButton"
                    onClick={() => savePartnership(selected, "negotiating")}
                    disabled={savingId === selected.id}
                  >
                    Negotiate
                  </button>

                  <button
                    className="successButton"
                    onClick={() => savePartnership(selected, "signed")}
                    disabled={savingId === selected.id}
                  >
                    Sign
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a partner</h3>
                <p>Choose a partnership lead to view details.</p>
              </div>
            )}
          </section>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1280px; margin: auto; }

        .topNav { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }

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
        .filters,
        .leadCard,
        .detailsCard,
        .createBox {
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
        .email,
        .empty p,
        .insightBox p,
        .summaryBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 118px;
          height: 118px;
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

        .warningScore { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); }
        .scoreOrb strong { color: #22c55e; font-size: 24px; font-weight: 900; }
        .warningScore strong { color: #fca5a5; }
        .scoreOrb span { color: #a1a1aa; font-size: 10px; font-weight: 900; }

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric { border-radius: 24px; padding: 18px; }

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

        .metricValue { font-size: 22px; font-weight: 900; overflow-wrap: anywhere; }

        .filters {
          display: grid;
          grid-template-columns: repeat(2, 230px);
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
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

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .leadCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .leadList {
          display: grid;
          gap: 12px;
          max-height: 560px;
          overflow: auto;
          padding-right: 4px;
          margin-bottom: 20px;
        }

        .leadRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeLead { border-color: rgba(34,197,94,0.45); background: rgba(34,197,94,0.1); }

        .leadIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .leadIcon.critical {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .leadIcon.high {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .leadInfo { min-width: 0; }

        .leadInfo strong,
        .leadInfo span,
        .leadInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .leadInfo span,
        .leadInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .status.signed,
        .status.negotiating,
        .status.qualified,
        .status.lead,
        .statusPill.signed,
        .statusPill.negotiating,
        .statusPill.qualified,
        .statusPill.lead {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.lost,
        .statusPill.lost {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .createBox {
          border-radius: 24px;
          padding: 20px;
          display: grid;
          gap: 12px;
          box-shadow: none;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .insightBox,
        .summaryBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .insightBox.critical {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .insightBox.high {
          background: rgba(250,204,21,0.1);
          border-color: rgba(250,204,21,0.35);
        }

        .insightBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .insightBox strong {
          color: #22c55e;
          font-size: 42px;
          font-weight: 900;
        }

        .insightBox.critical strong { color: #fca5a5; }
        .insightBox.high strong { color: #fde68a; }

        .scoreBar {
          width: 100%;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .scoreBar div {
          height: 100%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 999px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
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

        .infoBox strong { display: block; overflow-wrap: anywhere; }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .saveButton,
        .linkButton,
        .successButton {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .saveButton { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .linkButton { background: rgba(59,130,246,0.13); border: 1px solid rgba(59,130,246,0.35); }
        .successButton { background: linear-gradient(135deg, #22c55e, #15803d); }

        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 16px;
        }

        .empty h3 { margin: 0 0 8px; font-size: 22px; }

        @media (max-width: 1100px) {
          .stats { grid-template-columns: repeat(3, 1fr); }
          .adminGrid { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats,
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .leadRow {
            grid-template-columns: 46px 1fr;
          }

          .leadRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .leadIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader { flex-direction: column; }
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
