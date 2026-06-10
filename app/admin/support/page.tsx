"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type TicketStatus = "open" | "pending" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

type SupportTicket = {
  id: string;
  userId?: string;
  email?: string;
  name?: string;
  subject?: string;
  message?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  adminReply?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("Loading support tickets...");
  const [loadingId, setLoadingId] = useState("");
  const [reply, setReply] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("medium");
  const [creating, setCreating] = useState(false);

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
  }, [selected?.id]);

  const filteredTickets = useMemo(() => {
    const value = search.toLowerCase().trim();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !value ||
        String(ticket.email || "").toLowerCase().includes(value) ||
        String(ticket.name || "").toLowerCase().includes(value) ||
        String(ticket.subject || "").toLowerCase().includes(value) ||
        String(ticket.message || "").toLowerCase().includes(value) ||
        String(ticket.category || "").toLowerCase().includes(value) ||
        String(ticket.id || "").toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === "all" ||
        String(ticket.status || "open") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, statusFilter]);

  const openCount = tickets.filter((item) => !item.status || item.status === "open").length;
  const pendingCount = tickets.filter((item) => item.status === "pending").length;
  const resolvedCount = tickets.filter((item) => item.status === "resolved").length;
  const urgentCount = tickets.filter((item) => item.priority === "urgent").length;

  async function createTicket() {
    if (!newEmail.trim() || !newSubject.trim() || !newMessage.trim()) {
      setMessage("Email, subject, and message are required.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "supportTickets"), {
        email: newEmail.trim(),
        subject: newSubject.trim(),
        message: newMessage.trim(),
        priority: newPriority,
        status: "open",
        category: "manual",
        createdAt: now,
        updatedAt: now,
      });

      setNewEmail("");
      setNewSubject("");
      setNewMessage("");
      setNewPriority("medium");

      setMessage("Support ticket created successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create ticket.");
    } finally {
      setCreating(false);
    }
  }

  async function updateTicketStatus(ticket: SupportTicket, status: TicketStatus) {
    try {
      setLoadingId(ticket.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "supportTickets", ticket.id), {
        status,
        updatedAt: now,
        resolvedAt: status === "resolved" || status === "closed" ? now : "",
      });

      if (ticket.userId) {
        await setDoc(
          doc(db, "notifications", `${ticket.userId}-support-${Date.now()}`),
          {
            userId: ticket.userId,
            type: "support",
            title: "Support Ticket Update",
            message: `Your support ticket was marked as ${status}.`,
            read: false,
            createdAt: now,
            actionUrl: "/notifications",
          },
          { merge: true }
        );
      }

      setMessage(`Ticket marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function saveReply(ticket: SupportTicket) {
    try {
      setLoadingId(ticket.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "supportTickets", ticket.id), {
        adminReply: reply.trim(),
        status: "pending",
        updatedAt: now,
      });

      if (ticket.userId) {
        await setDoc(
          doc(db, "notifications", `${ticket.userId}-support-reply-${Date.now()}`),
          {
            userId: ticket.userId,
            type: "support",
            title: "Support Reply Received",
            message: "RoadLink support replied to your ticket.",
            read: false,
            createdAt: now,
            actionUrl: "/notifications",
          },
          { merge: true }
        );
      }

      setMessage("Reply saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save reply.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status?: TicketStatus) {
    if (status === "pending") return "Pending";
    if (status === "resolved") return "Resolved";
    if (status === "closed") return "Closed";
    return "Open";
  }

  function priorityLabel(priority?: TicketPriority) {
    if (priority === "urgent") return "Urgent";
    if (priority === "high") return "High";
    if (priority === "low") return "Low";
    return "Medium";
  }

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/messages" className="miniButton">Messages</Link>
          <Link href="/admin/settings" className="miniButton">Settings</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Support <span>Center</span></h1>
            <p className="subtitle">
              Manage support tickets, answer user issues, prioritize urgent cases,
              and keep RoadLink passengers and drivers supported.
            </p>
          </div>

          <div className="heroIcon">🎧</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎫" label="Total Tickets" value={String(tickets.length)} />
          <Metric icon="📌" label="Open" value={String(openCount)} />
          <Metric icon="⏳" label="Pending" value={String(pendingCount)} />
          <Metric icon="✅" label="Resolved" value={String(resolvedCount)} />
          <Metric icon="🔥" label="Urgent" value={String(urgentCount)} />
          <Metric icon="📋" label="Filtered" value={String(filteredTickets.length)} />
        </section>

        <section className="createCard">
          <p className="eyebrow">Create Ticket</p>
          <h2>Manual Support Ticket</h2>

          <div className="createGrid">
            <input
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="User email"
            />

            <input
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
              placeholder="Subject"
            />

            <select
              value={newPriority}
              onChange={(event) => setNewPriority(event.target.value as TicketPriority)}
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent priority</option>
            </select>
          </div>

          <textarea
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            placeholder="Describe the support issue..."
          />

          <button onClick={createTicket} disabled={creating} className="createButton">
            {creating ? "Creating..." : "Create Support Ticket"}
          </button>
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets by email, subject, message, category, or ticket ID..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="ticketsCard">
            <p className="eyebrow">Tickets</p>
            <h2>Support Queue</h2>

            {filteredTickets.length === 0 ? (
              <div className="empty">
                <h3>No support tickets found</h3>
                <p>Tickets submitted by users will appear here.</p>
              </div>
            ) : (
              <div className="ticketList">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className={
                      selected?.id === ticket.id
                        ? "ticketRow activeTicket"
                        : "ticketRow"
                    }
                    onClick={() => setSelected(ticket)}
                  >
                    <div className="ticketIcon">🎫</div>

                    <div className="ticketInfo">
                      <strong>{ticket.subject || "Support Ticket"}</strong>
                      <span>{ticket.email || "No email available"}</span>
                      <small>{ticket.message || "No message provided"}</small>
                    </div>

                    <em className={`status ${ticket.status || "open"}`}>
                      {statusLabel(ticket.status)}
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
                    <p className="email">{selected.email || "No email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "open"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="priorityBox">
                  <span>Priority</span>
                  <strong>{priorityLabel(selected.priority)}</strong>
                </div>

                <div className="infoGrid">
                  <Info label="Ticket ID" value={selected.id} />
                  <Info label="User ID" value={selected.userId || "Not available"} />
                  <Info label="Email" value={selected.email || "Not available"} />
                  <Info label="Category" value={selected.category || "General"} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Priority" value={priorityLabel(selected.priority)} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Resolved" value={dateText(selected.resolvedAt)} />
                </div>

                <div className="detailsBox">
                  <strong>User Message</strong>
                  <p>{selected.message || "No message provided."}</p>
                </div>

                <label className="replyLabel">Admin Reply</label>
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write a support response..."
                />

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => updateTicketStatus(selected, "pending")}
                    disabled={loadingId === selected.id}
                  >
                    Pending
                  </button>

                  <button
                    className="approveButton"
                    onClick={() => saveReply(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Reply
                  </button>

                  <button
                    className="resolvedButton"
                    onClick={() => updateTicketStatus(selected, "resolved")}
                    disabled={loadingId === selected.id}
                  >
                    Resolve
                  </button>

                  <button
                    className="closedButton"
                    onClick={() => updateTicketStatus(selected, "closed")}
                    disabled={loadingId === selected.id}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a ticket</h3>
                <p>Choose a support ticket to review and respond.</p>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

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
        .createCard,
        .filters,
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
        .metricValue,
        .priorityBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 8px;
        }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
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
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
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
          font-size: 24px;
          font-weight: 900;
        }

        .createCard {
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 18px;
        }

        .createGrid,
        .filters {
          display: grid;
          grid-template-columns: 1fr 1fr 220px;
          gap: 12px;
        }

        .filters {
          grid-template-columns: 1fr 220px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        input,
        select,
        textarea {
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

        textarea {
          min-height: 115px;
          resize: vertical;
          margin-top: 12px;
        }

        .createButton {
          width: 100%;
          margin-top: 14px;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
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

        .ticketRow {
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

        .activeTicket {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .ticketIcon {
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

        .ticketInfo {
          min-width: 0;
        }

        .ticketInfo strong,
        .ticketInfo span,
        .ticketInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ticketInfo span,
        .ticketInfo small {
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

        .status.open,
        .statusPill.open {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.pending,
        .statusPill.pending {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .status.resolved,
        .statusPill.resolved {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.closed,
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

        .priorityBox,
        .detailsBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .priorityBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .priorityBox strong {
          font-size: 44px;
          font-weight: 900;
        }

        .detailsBox p {
          color: #e5e7eb;
          line-height: 1.5;
          margin-bottom: 0;
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

        .infoBox strong {
          overflow-wrap: anywhere;
        }

        .replyLabel {
          display: block;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 16px;
        }

        .reviewButton,
        .approveButton,
        .resolvedButton,
        .closedButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .reviewButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .approveButton,
        .resolvedButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .closedButton {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
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

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }

          .actionRow {
            grid-template-columns: repeat(2, 1fr);
          }

          .createGrid {
            grid-template-columns: 1fr;
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
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .ticketsCard,
          .detailsCard {
            padding: 24px;
          }

          .ticketRow {
            grid-template-columns: 46px 1fr;
          }

          .ticketRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .ticketIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
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
      <strong>{value}</strong>
    </div>
  );
}
