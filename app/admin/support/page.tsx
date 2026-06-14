"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type TicketStatus = "open" | "closed";

type SupportTicket = {
  id: string;
  userId?: string;
  userEmail?: string;
  subject?: string;
  category?: string;
  priority?: string;
  message?: string;
  status?: TicketStatus;
  adminReply?: string;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("Loading support tickets...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "supportTickets")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as SupportTicket[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setTickets(data);

        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setReply(selected?.adminReply || "");
  }, [selected]);

  const filteredTickets = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((ticket) => ticket.status === filter);
  }, [tickets, filter]);

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const closedCount = tickets.filter((ticket) => ticket.status === "closed").length;
  const urgentCount = tickets.filter((ticket) => ticket.priority === "urgent").length;

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  async function sendReply(ticket: SupportTicket) {
    if (!ticket.id) return;

    if (!reply.trim()) {
      setMessage("Please write a reply before sending.");
      return;
    }

    try {
      setLoadingId(ticket.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "supportTickets", ticket.id), {
        adminReply: reply.trim(),
        status: "open",
        readByUser: false,
        readByAdmin: true,
        updatedAt: now,
      });

      if (ticket.userId) {
        await addDoc(collection(db, "notifications"), {
          userId: ticket.userId,
          type: "support",
          title: "Support Reply",
          message: "RoadLink Support replied to your ticket.",
          read: false,
          createdAt: now,
          actionUrl: "/support",
        });
      }

      setMessage("Reply sent successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function updateTicketStatus(ticket: SupportTicket, status: TicketStatus) {
    if (!ticket.id) return;

    try {
      setLoadingId(ticket.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "supportTickets", ticket.id), {
        status,
        updatedAt: now,
        ...(status === "closed" ? { closedAt: now } : {}),
      });

      if (ticket.userId) {
        await addDoc(collection(db, "notifications"), {
          userId: ticket.userId,
          type: "support",
          title: status === "closed" ? "Support Ticket Closed" : "Support Ticket Reopened",
          message:
            status === "closed"
              ? "Your support ticket was closed by RoadLink Support."
              : "Your support ticket was reopened by RoadLink Support.",
          read: false,
          createdAt: now,
          actionUrl: "/support",
        });
      }

      setMessage(`Ticket ${status} successfully.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/verifications" className="miniButton">Verifications</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Support <span>Center</span></h1>
            <p className="subtitle">
              Review user support tickets, send replies, close cases, and manage urgent issues.
            </p>
          </div>

          <div className="heroIcon">🎧</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📩" label="Total Tickets" value={String(tickets.length)} />
          <Metric icon="🟢" label="Open" value={String(openCount)} />
          <Metric icon="✅" label="Closed" value={String(closedCount)} />
          <Metric icon="🚨" label="Urgent" value={String(urgentCount)} />
        </section>

        <section className="adminGrid">
          <div className="ticketsCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Tickets</p>
                <h2>Support Requests</h2>
              </div>
            </div>

            <div className="filters">
              <button onClick={() => setFilter("all")} className={filter === "all" ? "activeFilter" : ""}>All</button>
              <button onClick={() => setFilter("open")} className={filter === "open" ? "activeFilter" : ""}>Open</button>
              <button onClick={() => setFilter("closed")} className={filter === "closed" ? "activeFilter" : ""}>Closed</button>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="empty">
                <h3>No tickets found</h3>
                <p>Support requests will appear here.</p>
              </div>
            ) : (
              <div className="ticketList">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelected(ticket)}
                    className={selected?.id === ticket.id ? "ticket activeTicket" : "ticket"}
                  >
                    <div>
                      <strong>{ticket.subject || "Support Ticket"}</strong>
                      <span>{ticket.userEmail || "No email"}</span>
                      <small>{dateText(ticket.createdAt)}</small>
                    </div>

                    <em className={`pill ${ticket.status || "open"}`}>
                      {ticket.status || "open"}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Ticket</p>
                    <h2>{selected.subject || "Support Ticket"}</h2>
                    <p className="email">{selected.userEmail || "No email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "open"}`}>
                    {selected.status || "open"}
                  </span>
                </div>

                <div className="infoGrid">
                  <Info label="Ticket ID" value={selected.id} />
                  <Info label="Category" value={selected.category || "general"} />
                  <Info label="Priority" value={selected.priority || "normal"} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Closed" value={dateText(selected.closedAt)} />
                </div>

                <div className="messageBox">
                  <strong>User Message</strong>
                  <p>{selected.message || "No message provided."}</p>
                </div>

                <label>Admin Reply</label>
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write your support reply..."
                />

                <div className="actionRow">
                  <button
                    className="replyButton"
                    onClick={() => sendReply(selected)}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Send Reply"}
                  </button>

                  <button
                    className="closeButton"
                    onClick={() => updateTicketStatus(selected, "closed")}
                    disabled={loadingId === selected.id}
                  >
                    Close Ticket
                  </button>

                  <button
                    className="reopenButton"
                    onClick={() => updateTicketStatus(selected, "open")}
                    disabled={loadingId === selected.id}
                  >
                    Reopen
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a ticket</h3>
                <p>Choose a ticket to review and reply.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topNav,
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton,
        .filters button {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
        }

        .filters .activeFilter {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.4);
          color: #22c55e;
        }

        .hero,
        .metric,
        .ticketsCard,
        .detailsCard {
          background: rgba(8, 13, 25, 0.92);
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
          font-size: 32px;
          margin: 0;
        }

        .subtitle,
        .email {
          max-width: 700px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
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
          padding: 22px;
        }

        .metricIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 30px;
          font-weight: 900;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .ticketsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .ticketList {
          display: grid;
          gap: 12px;
        }

        .ticket {
          width: 100%;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeTicket {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .ticket strong,
        .ticket span,
        .ticket small {
          display: block;
          overflow-wrap: anywhere;
        }

        .ticket span,
        .ticket small {
          color: #a1a1aa;
          margin-top: 5px;
        }

        .pill,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
          text-transform: capitalize;
        }

        .pill.open,
        .statusPill.open {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.closed,
        .statusPill.closed {
          color: #a1a1aa;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox,
        .messageBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span,
        .messageBox strong {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong,
        .messageBox p {
          overflow-wrap: anywhere;
        }

        .messageBox {
          margin-bottom: 18px;
        }

        .messageBox p {
          color: #e5e7eb;
          line-height: 1.5;
          margin: 0;
        }

        label {
          display: block;
          color: #e5e7eb;
          font-weight: 900;
          margin-bottom: 8px;
        }

        textarea {
          width: 100%;
          min-height: 150px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 15px;
          outline: none;
          resize: vertical;
          margin-bottom: 16px;
          font-family: Arial, sans-serif;
        }

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .replyButton,
        .closeButton,
        .reopenButton {
          padding: 17px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .replyButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .closeButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
        }

        .reopenButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 900px) {
          .page {
            padding: 16px;
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
          .adminGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .ticketsCard,
          .detailsCard {
            padding: 24px;
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
