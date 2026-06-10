"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type DisputeStatus = "open" | "reviewing" | "resolved" | "refunded" | "closed";
type DisputePriority = "low" | "medium" | "high" | "urgent";

type DisputeItem = {
  id: string;
  bookingId?: string;
  rideId?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  openedById?: string;
  openedByEmail?: string;
  reason?: string;
  details?: string;
  adminNote?: string;
  status?: DisputeStatus;
  priority?: DisputePriority;
  amount?: number;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [selected, setSelected] = useState<DisputeItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState("Loading disputes...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "disputes")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as DisputeItem[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setDisputes(data);
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
    setAdminNote(selected?.adminNote || "");
  }, [selected?.id]);

  const filteredDisputes = useMemo(() => {
    const value = search.toLowerCase().trim();

    return disputes.filter((item) => {
      const matchesSearch =
        !value ||
        String(item.openedByEmail || "").toLowerCase().includes(value) ||
        String(item.driverEmail || "").toLowerCase().includes(value) ||
        String(item.passengerEmail || "").toLowerCase().includes(value) ||
        String(item.reason || "").toLowerCase().includes(value) ||
        String(item.details || "").toLowerCase().includes(value) ||
        String(item.bookingId || "").toLowerCase().includes(value) ||
        String(item.rideId || "").toLowerCase().includes(value) ||
        String(item.id || "").toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === "all" ||
        String(item.status || "open") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [disputes, search, statusFilter]);

  const openCount = disputes.filter((item) => !item.status || item.status === "open").length;
  const reviewingCount = disputes.filter((item) => item.status === "reviewing").length;
  const resolvedCount = disputes.filter((item) => item.status === "resolved").length;
  const refundedCount = disputes.filter((item) => item.status === "refunded").length;
  const urgentCount = disputes.filter((item) => item.priority === "urgent").length;

  const disputedAmount = disputes.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  async function updateDisputeStatus(item: DisputeItem, status: DisputeStatus) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "disputes", item.id), {
        status,
        adminNote: adminNote.trim(),
        updatedAt: now,
        resolvedAt:
          status === "resolved" || status === "refunded" || status === "closed"
            ? now
            : "",
      });

      await notifyUsers(item, status, now);

      setMessage(`Dispute marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function saveAdminNote(item: DisputeItem) {
    try {
      setLoadingId(item.id);
      setMessage("");

      await updateDoc(doc(db, "disputes", item.id), {
        adminNote: adminNote.trim(),
        updatedAt: new Date().toISOString(),
      });

      setMessage("Admin note saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save note.");
    } finally {
      setLoadingId("");
    }
  }

  async function notifyUsers(item: DisputeItem, status: DisputeStatus, now: string) {
    const notificationMessage = `A dispute for your RoadLink trip was marked as ${status}.`;

    if (item.driverId) {
      await setDoc(
        doc(db, "notifications", `${item.driverId}-dispute-${Date.now()}`),
        {
          userId: item.driverId,
          type: "dispute",
          title: "Dispute Update",
          message: notificationMessage,
          read: false,
          createdAt: now,
          actionUrl: "/notifications",
        },
        { merge: true }
      );
    }

    if (item.passengerId) {
      await setDoc(
        doc(db, "notifications", `${item.passengerId}-dispute-${Date.now()}`),
        {
          userId: item.passengerId,
          type: "dispute",
          title: "Dispute Update",
          message: notificationMessage,
          read: false,
          createdAt: now,
          actionUrl: "/notifications",
        },
        { merge: true }
      );
    }
  }

  function statusLabel(status?: DisputeStatus) {
    if (status === "reviewing") return "Reviewing";
    if (status === "resolved") return "Resolved";
    if (status === "refunded") return "Refunded";
    if (status === "closed") return "Closed";
    return "Open";
  }

  function priorityLabel(priority?: DisputePriority) {
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
          <Link href="/admin/payments" className="miniButton">Payments</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/support" className="miniButton">Support</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Disputes <span>Center</span></h1>
            <p className="subtitle">
              Manage conflicts between passengers and drivers, review disputed
              bookings, track refund decisions, and notify both sides.
            </p>
          </div>

          <div className="heroIcon">⚖️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="⚖️" label="Total Disputes" value={String(disputes.length)} />
          <Metric icon="📌" label="Open" value={String(openCount)} />
          <Metric icon="🔎" label="Reviewing" value={String(reviewingCount)} />
          <Metric icon="✅" label="Resolved" value={String(resolvedCount)} />
          <Metric icon="💵" label="Refunded" value={String(refundedCount)} />
          <Metric icon="🔥" label="Urgent" value={String(urgentCount)} />
          <Metric icon="💰" label="Disputed $" value={`$${disputedAmount}`} />
          <Metric icon="📋" label="Filtered" value={String(filteredDisputes.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, reason, dispute ID, booking ID, ride ID..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="refunded">Refunded</option>
            <option value="closed">Closed</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="disputesCard">
            <p className="eyebrow">Disputes</p>
            <h2>Conflict Queue</h2>

            {filteredDisputes.length === 0 ? (
              <div className="empty">
                <h3>No disputes found</h3>
                <p>Disputes submitted by users will appear here.</p>
              </div>
            ) : (
              <div className="disputeList">
                {filteredDisputes.map((item) => (
                  <button
                    key={item.id}
                    className={
                      selected?.id === item.id
                        ? "disputeRow activeDispute"
                        : "disputeRow"
                    }
                    onClick={() => setSelected(item)}
                  >
                    <div className="disputeIcon">⚖️</div>

                    <div className="disputeInfo">
                      <strong>{item.reason || "Trip Dispute"}</strong>
                      <span>{item.openedByEmail || "Opened by user"}</span>
                      <small>
                        {item.driverEmail || "Driver"} • {item.passengerEmail || "Passenger"}
                      </small>
                    </div>

                    <em className={`status ${item.status || "open"}`}>
                      {statusLabel(item.status)}
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
                    <p className="eyebrow">Selected Dispute</p>
                    <h2>{selected.reason || "Trip Dispute"}</h2>
                    <p className="email">{selected.openedByEmail || "No opener email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "open"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="amountBox">
                  <span>Disputed Amount</span>
                  <strong>${Number(selected.amount || 0)}</strong>
                </div>

                <div className="detailsBox">
                  <strong>User Details</strong>
                  <p>{selected.details || "No dispute details provided."}</p>
                </div>

                <div className="infoGrid">
                  <Info label="Dispute ID" value={selected.id} />
                  <Info label="Booking ID" value={selected.bookingId || "Not available"} />
                  <Info label="Ride ID" value={selected.rideId || "Not available"} />
                  <Info label="Priority" value={priorityLabel(selected.priority)} />
                  <Info label="Opened By ID" value={selected.openedById || "Not available"} />
                  <Info label="Opened By Email" value={selected.openedByEmail || "Not available"} />
                  <Info label="Driver ID" value={selected.driverId || "Not available"} />
                  <Info label="Driver Email" value={selected.driverEmail || "Not available"} />
                  <Info label="Passenger ID" value={selected.passengerId || "Not available"} />
                  <Info label="Passenger Email" value={selected.passengerEmail || "Not available"} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Resolved" value={dateText(selected.resolvedAt)} />
                </div>

                <label className="noteLabel">Admin Note</label>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Write investigation notes, refund decision, or resolution details..."
                />

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => updateDisputeStatus(selected, "reviewing")}
                    disabled={loadingId === selected.id}
                  >
                    Reviewing
                  </button>

                  <button
                    className="approveButton"
                    onClick={() => updateDisputeStatus(selected, "resolved")}
                    disabled={loadingId === selected.id}
                  >
                    Resolve
                  </button>

                  <button
                    className="refundButton"
                    onClick={() => updateDisputeStatus(selected, "refunded")}
                    disabled={loadingId === selected.id}
                  >
                    Refunded
                  </button>

                  <button
                    className="closedButton"
                    onClick={() => updateDisputeStatus(selected, "closed")}
                    disabled={loadingId === selected.id}
                  >
                    Close
                  </button>

                  <button
                    className="noteButton"
                    onClick={() => saveAdminNote(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Note
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a dispute</h3>
                <p>Choose a dispute to review details.</p>
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
        .filters,
        .disputesCard,
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
        .amountBox strong {
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
          grid-template-columns: repeat(4, 1fr);
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

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        .filters input,
        .filters select,
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

        .filters option {
          color: black;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
          margin-bottom: 16px;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .disputesCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .disputeList {
          display: grid;
          gap: 12px;
        }

        .disputeRow {
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

        .activeDispute {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .disputeIcon {
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

        .disputeInfo {
          min-width: 0;
        }

        .disputeInfo strong,
        .disputeInfo span,
        .disputeInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .disputeInfo span,
        .disputeInfo small {
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

        .status.reviewing,
        .statusPill.reviewing {
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

        .status.refunded,
        .statusPill.refunded {
          color: #c4b5fd;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.35);
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

        .amountBox,
        .detailsBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .amountBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .amountBox strong {
          font-size: 44px;
          font-weight: 900;
        }

        .detailsBox p {
          color: #e5e7eb;
          line-height: 1.5;
          margin-bottom: 0;
          overflow-wrap: anywhere;
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

        .noteLabel {
          display: block;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .reviewButton,
        .approveButton,
        .refundButton,
        .closedButton,
        .noteButton {
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
        .noteButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .refundButton {
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
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
            grid-template-columns: repeat(2, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }

          .actionRow {
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
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .disputesCard,
          .detailsCard {
            padding: 24px;
          }

          .disputeRow {
            grid-template-columns: 46px 1fr;
          }

          .disputeRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .disputeIcon {
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
