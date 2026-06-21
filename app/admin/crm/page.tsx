"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type CRMStatus = "new" | "contacted" | "meeting" | "proposal" | "won" | "lost";
type CRMSource = "corporate" | "university" | "airport" | "government" | "partnership" | "other";

type CRMContact = {
  id: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  source?: CRMSource;
  status?: CRMStatus;
  expectedValue?: number;
  nextAction?: string;
  nextActionDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminCRMPage() {
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [message, setMessage] = useState("Loading CRM center...");
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [source, setSource] = useState<CRMSource>("corporate");
  const [expectedValue, setExpectedValue] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "crmContacts")),
      (snapshot) => {
        setContacts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as CRMContact[]);
        setMessage("");
      },
      () => {
        setContacts([]);
        setMessage("");
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const newContacts = contacts.filter((item) => !item.status || item.status === "new");
    const contacted = contacts.filter((item) => item.status === "contacted");
    const meetings = contacts.filter((item) => item.status === "meeting");
    const proposals = contacts.filter((item) => item.status === "proposal");
    const won = contacts.filter((item) => item.status === "won");
    const lost = contacts.filter((item) => item.status === "lost");

    const pipelineValue = contacts
      .filter((item) => item.status !== "lost")
      .reduce((total, item) => total + Number(item.expectedValue || 0), 0);

    const wonValue = won.reduce((total, item) => total + Number(item.expectedValue || 0), 0);

    const crmScore = Math.max(
      Math.min(
        won.length * 25 +
          proposals.length * 15 +
          meetings.length * 10 +
          contacted.length * 6 +
          newContacts.length * 3 +
          Math.round(pipelineValue / 1000),
        100
      ),
      0
    );

    return {
      newContacts,
      contacted,
      meetings,
      proposals,
      won,
      lost,
      pipelineValue,
      wonValue,
      crmScore,
    };
  }, [contacts]);

  async function createContact() {
    if (!companyName.trim()) {
      setMessage("Company or organization name required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const id = `crm-${Date.now()}`;

      await setDoc(
        doc(db, "crmContacts", id),
        {
          companyName: companyName.trim(),
          contactName: contactName.trim() || "Not assigned",
          contactEmail: contactEmail.trim() || "No email",
          phone: "",
          source,
          status: "new",
          expectedValue: Number(expectedValue || 0),
          nextAction: "Initial outreach",
          nextActionDate: "",
          notes: "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setSource("corporate");
      setExpectedValue("");

      setMessage("CRM contact created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create CRM contact.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: CRMStatus) {
    try {
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "crmContacts", id),
        {
          status,
          nextAction:
            status === "contacted"
              ? "Schedule meeting"
              : status === "meeting"
              ? "Prepare proposal"
              : status === "proposal"
              ? "Follow up proposal"
              : status === "won"
              ? "Begin onboarding"
              : status === "lost"
              ? "Review lost reason"
              : "Initial outreach",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `crm-${id}-${Date.now()}`),
        {
          action: "CRM Contact Status Updated",
          targetId: id,
          targetType: "crmContact",
          details: `CRM status changed to ${status}`,
          severity: status === "won" ? "success" : status === "lost" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("CRM status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update CRM contact.");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: CRMStatus) {
    if (status === "contacted") return "Contacted";
    if (status === "meeting") return "Meeting";
    if (status === "proposal") return "Proposal";
    if (status === "won") return "Won";
    if (status === "lost") return "Lost";
    return "New";
  }

  function sourceLabel(value?: CRMSource) {
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
          <Link href="/admin/sales-pipeline" className="miniButton">Sales Pipeline</Link>
          <Link href="/admin/partnerships" className="miniButton">Partnerships</Link>
          <Link href="/admin/corporate-accounts" className="miniButton">Corporate</Link>
          <Link href="/admin/government-contracts" className="miniButton">Government</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Business CRM</p>
            <h1>CRM <span>Center</span></h1>
            <p className="subtitle">
              Manage commercial contacts, follow-ups, meetings, proposals, enterprise leads,
              next actions, expected value and RoadLink business relationships.
            </p>
          </div>

          <div className={metrics.crmScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.crmScore}</strong>
            <span>CRM Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🆕" label="New" value={String(metrics.newContacts.length)} />
          <Metric icon="📞" label="Contacted" value={String(metrics.contacted.length)} />
          <Metric icon="📅" label="Meetings" value={String(metrics.meetings.length)} />
          <Metric icon="📄" label="Proposals" value={String(metrics.proposals.length)} />
          <Metric icon="🏆" label="Won" value={String(metrics.won.length)} />
          <Metric icon="💰" label="Pipeline" value={money(metrics.pipelineValue)} />
          <Metric icon="✅" label="Won Value" value={money(metrics.wonValue)} />
          <Metric icon="❌" label="Lost" value={String(metrics.lost.length)} />
        </section>

        <section className="card">
          <p className="eyebrow">Create CRM Contact</p>
          <h2>New Business Relationship</h2>

          <div className="formGrid">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company or organization" />
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" />

            <select value={source} onChange={(e) => setSource(e.target.value as CRMSource)}>
              <option value="corporate">Corporate</option>
              <option value="university">University</option>
              <option value="airport">Airport</option>
              <option value="government">Government</option>
              <option value="partnership">Partnership</option>
              <option value="other">Other</option>
            </select>

            <input value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder="Expected value" type="number" />
          </div>

          <button className="saveButton" onClick={createContact} disabled={saving}>
            {saving ? "Creating..." : "Create CRM Contact"}
          </button>
        </section>

        <section className="crmGrid">
          {contacts.length === 0 ? (
            <div className="empty">
              <h3>No CRM contacts yet</h3>
              <p>Create your first contact to start managing RoadLink business relationships.</p>
            </div>
          ) : (
            contacts.map((item) => (
              <section key={item.id} className="contactCard">
                <div className="cardTop">
                  <div>
                    <h3>{item.companyName || "Unknown Contact"}</h3>
                    <p>{item.contactEmail || "No email"}</p>
                  </div>

                  <span className={`pill ${item.status || "new"}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>

                <div className="infoGrid">
                  <Info label="Contact" value={item.contactName || "Not assigned"} />
                  <Info label="Source" value={sourceLabel(item.source)} />
                  <Info label="Expected Value" value={money(Number(item.expectedValue || 0))} />
                  <Info label="Next Action" value={item.nextAction || "Initial outreach"} />
                  <Info label="Next Date" value={item.nextActionDate || "Not scheduled"} />
                  <Info label="Phone" value={item.phone || "Not set"} />
                  <Info label="Notes" value={item.notes || "No notes"} />
                  <Info label="ID" value={item.id} />
                </div>

                <div className="actions">
                  <button onClick={() => updateStatus(item.id, "contacted")}>Contacted</button>
                  <button onClick={() => updateStatus(item.id, "meeting")}>Meeting</button>
                  <button onClick={() => updateStatus(item.id, "proposal")}>Proposal</button>
                  <button onClick={() => updateStatus(item.id, "won")}>Won</button>
                  <button className="dangerButton" onClick={() => updateStatus(item.id, "lost")}>Lost</button>
                </div>
              </section>
            ))
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
        .contactCard,
        .empty {
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
        .contactCard p,
        .empty p {
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

        .crmGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .contactCard {
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

        .contactCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .contactCard p {
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

        .pill.lost {
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
          grid-column: 1 / -1;
          padding: 24px;
          border-radius: 22px;
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
          .crmGrid {
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
          .crmGrid,
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
