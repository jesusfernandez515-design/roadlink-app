"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type RefundStatus = "pending" | "approved" | "rejected" | "paid";
type RefundPriority = "normal" | "high" | "urgent";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type RefundRequest = {
  id: string;
  userId?: string;
  userEmail?: string;
  bookingId?: string;
  rideId?: string;
  paymentId?: string;
  amount?: number;
  reason?: string;
  status?: RefundStatus | string;
  priority?: RefundPriority | string;
  adminNote?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

type Booking = {
  id: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  from?: string;
  to?: string;
};

export default function AdminRefundsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<RefundRequest | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState("Loading refunds center...");
  const [processingId, setProcessingId] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newBookingId, setNewBookingId] = useState("");
  const [newRideId, setNewRideId] = useState("");
  const [newPaymentId, setNewPaymentId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newPriority, setNewPriority] = useState<RefundPriority>("normal");

  useEffect(() => {
    let unsubscribeMe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeMe = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const allowed =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          setMessage(allowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMe) unsubscribeMe();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  useEffect(() => {
    if (!adminAllowed) return;

    const unsubscribeRefunds = onSnapshot(
      query(collection(db, "refundRequests")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as RefundRequest[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setRefunds(data);
        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubscribeBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[]
        );
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubscribeRefunds();
      unsubscribeBookings();
    };
  }, [adminAllowed]);

  useEffect(() => {
    setAdminNote(selected?.adminNote || "");
  }, [selected]);

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  const filteredRefunds = useMemo(() => {
    const text = search.trim().toLowerCase();

    return refunds.filter((refund) => {
      const matchesSearch =
        !text ||
        clean(refund.userEmail).includes(text) ||
        clean(refund.bookingId).includes(text) ||
        clean(refund.rideId).includes(text) ||
        clean(refund.paymentId).includes(text) ||
        clean(refund.reason).includes(text) ||
        clean(refund.id).includes(text);

      const matchesFilter =
        filter === "all" ||
        refund.status === filter ||
        refund.priority === filter;

      return matchesSearch && matchesFilter;
    });
  }, [refunds, search, filter]);

  const metrics = useMemo(() => {
    const pending = refunds.filter((item) => item.status === "pending");
    const approved = refunds.filter((item) => item.status === "approved");
    const rejected = refunds.filter((item) => item.status === "rejected");
    const paid = refunds.filter((item) => item.status === "paid");
    const urgent = refunds.filter((item) => item.priority === "urgent");

    const requestedAmount = refunds.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const approvedAmount = [...approved, ...paid].reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const paidAmount = paid.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    return {
      total: refunds.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      paid: paid.length,
      urgent: urgent.length,
      requestedAmount,
      approvedAmount,
      paidAmount,
    };
  }, [refunds]);

  function getBooking(refund?: RefundRequest | null) {
    if (!refund?.bookingId) return undefined;
    return bookings.find((booking) => booking.id === refund.bookingId);
  }

  async function createRefundRequest() {
    if (!newUserEmail.trim()) {
      setMessage("User email is required.");
      return;
    }

    if (!newAmount || Number(newAmount) <= 0) {
      setMessage("Refund amount must be greater than zero.");
      return;
    }

    try {
      setProcessingId("new");
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "refundRequests"), {
        userEmail: newUserEmail.trim(),
        bookingId: newBookingId.trim(),
        rideId: newRideId.trim(),
        paymentId: newPaymentId.trim(),
        amount: Number(newAmount || 0),
        reason: newReason.trim(),
        priority: newPriority,
        status: "pending",
        createdBy: auth.currentUser?.email || "",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Refund Request Created",
        targetType: "refund",
        details: `Refund request created for ${newUserEmail}.`,
        severity: newPriority === "urgent" ? "warning" : "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: false,
      });

      setNewUserEmail("");
      setNewBookingId("");
      setNewRideId("");
      setNewPaymentId("");
      setNewAmount("");
      setNewReason("");
      setNewPriority("normal");
      setMessage("Refund request created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create refund.");
    } finally {
      setProcessingId("");
    }
  }

  async function updateRefundStatus(refund: RefundRequest, nextStatus: RefundStatus) {
    try {
      setProcessingId(refund.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "refundRequests", refund.id), {
        status: nextStatus,
        adminNote: adminNote.trim(),
        updatedAt: now,
        ...(nextStatus === "approved" ? { approvedAt: now } : {}),
        ...(nextStatus === "rejected" ? { rejectedAt: now, resolvedAt: now } : {}),
        ...(nextStatus === "paid" ? { paidAt: now, resolvedAt: now } : {}),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Refund Status Updated",
        targetId: refund.id,
        targetType: "refund",
        details: `Refund ${refund.id} moved to ${nextStatus}.`,
        severity:
          nextStatus === "approved" || nextStatus === "paid"
            ? "success"
            : nextStatus === "rejected"
            ? "warning"
            : "info",
        adminEmail: auth.currentUser?.email || "",
        userEmail: refund.userEmail || "",
        createdAt: now,
        resolved: nextStatus === "paid" || nextStatus === "rejected",
      });

      if (refund.userId) {
        await addDoc(collection(db, "notifications"), {
          userId: refund.userId,
          type: "refund",
          title: "Refund Update",
          message: `Your refund request is now ${nextStatus}.`,
          read: false,
          createdAt: now,
          actionUrl: "/support",
        });
      }

      setMessage(`Refund marked as ${nextStatus}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update refund.");
    } finally {
      setProcessingId("");
    }
  }

  function statusClass(value?: string) {
    if (value === "approved") return "pill approved";
    if (value === "paid") return "pill paid";
    if (value === "rejected") return "pill rejected";
    return "pill pending";
  }

  function priorityClass(value?: string) {
    if (value === "urgent") return "pill urgent";
    if (value === "high") return "pill high";
    return "pill normal";
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Refunds <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  const booking = getBooking(selected);

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/support-center" className="navButton">Support</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
          <Link href="/admin/analytics" className="navButton">Analytics</Link>
          <Link href="/wallet" className="navButton">Wallet</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Finance Operations</p>
            <h1>Refunds <span>Center</span></h1>
            <p className="subtitle">
              Manage refund requests, payment disputes, booking refunds, approval workflow,
              payout notes and financial audit trails.
            </p>
          </div>

          <div className="moneyOrb">
            <strong>{money(metrics.requestedAmount)}</strong>
            <span>Requested</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📚" label="Total" value={String(metrics.total)} />
          <Metric icon="⏳" label="Pending" value={String(metrics.pending)} />
          <Metric icon="✅" label="Approved" value={String(metrics.approved)} />
          <Metric icon="💵" label="Paid" value={String(metrics.paid)} />
          <Metric icon="❌" label="Rejected" value={String(metrics.rejected)} />
          <Metric icon="🚨" label="Urgent" value={String(metrics.urgent)} />
          <Metric icon="💳" label="Approved Amount" value={money(metrics.approvedAmount)} />
          <Metric icon="🏦" label="Paid Amount" value={money(metrics.paidAmount)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Create Refund</p>
            <h2>Manual Refund Request</h2>

            <label>User Email</label>
            <input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@email.com" />

            <label>Booking ID</label>
            <input value={newBookingId} onChange={(e) => setNewBookingId(e.target.value)} placeholder="Booking ID" />

            <label>Ride ID</label>
            <input value={newRideId} onChange={(e) => setNewRideId(e.target.value)} placeholder="Ride ID" />

            <label>Payment ID</label>
            <input value={newPaymentId} onChange={(e) => setNewPaymentId(e.target.value)} placeholder="Stripe/payment reference" />

            <label>Amount</label>
            <input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="Refund amount" inputMode="decimal" />

            <label>Priority</label>
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as RefundPriority)}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            <label>Reason</label>
            <textarea value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Why is this refund needed?" />

            <button onClick={createRefundRequest} disabled={processingId === "new"}>
              {processingId === "new" ? "Creating..." : "Create Refund"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Search</p>
            <h2>Refund Filters</h2>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by email, booking, ride, payment or reason..."
            />

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["pending", "⏳ Pending"],
                ["approved", "✅ Approved"],
                ["paid", "💵 Paid"],
                ["rejected", "❌ Rejected"],
                ["urgent", "🚨 Urgent"],
                ["high", "⚠️ High"],
                ["normal", "🟢 Normal"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={filter === key ? "filterButton activeFilter" : "filterButton"}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="summaryBox">
              <strong>{filteredRefunds.length}</strong>
              <span>refunds showing</span>
            </div>
          </section>
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">Refund Queue</p>
            <h2>Requests</h2>

            {filteredRefunds.length === 0 ? (
              <div className="empty">
                <h3>No refunds found</h3>
                <p>Refund requests will appear here.</p>
              </div>
            ) : (
              <div className="refundList">
                {filteredRefunds.map((refund) => (
                  <button
                    key={refund.id}
                    className={selected?.id === refund.id ? "refundItem selected" : "refundItem"}
                    onClick={() => setSelected(refund)}
                  >
                    <div>
                      <strong>{refund.userEmail || "Unknown user"}</strong>
                      <span>{refund.reason || "No reason added"}</span>
                      <small>{formatDate(refund.createdAt)}</small>
                    </div>

                    <div className="refundRight">
                      <b>{money(refund.amount)}</b>
                      <em className={statusClass(refund.status)}>{refund.status || "pending"}</em>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            {selected ? (
              <>
                <div className="detailsTop">
                  <div>
                    <p className="eyebrow">Selected Refund</p>
                    <h2>{money(selected.amount)}</h2>
                    <p className="subtitle smallText">{selected.userEmail || "No user email"}</p>
                  </div>

                  <div className="pillGroup">
                    <span className={statusClass(selected.status)}>{selected.status || "pending"}</span>
                    <span className={priorityClass(selected.priority)}>{selected.priority || "normal"}</span>
                  </div>
                </div>

                <div className="infoGrid">
                  <Info label="Refund ID" value={selected.id} />
                  <Info label="Booking ID" value={selected.bookingId || "Not linked"} />
                  <Info label="Ride ID" value={selected.rideId || "Not linked"} />
                  <Info label="Payment ID" value={selected.paymentId || "Not linked"} />
                  <Info label="Created" value={formatDate(selected.createdAt)} />
                  <Info label="Updated" value={formatDate(selected.updatedAt)} />
                  <Info label="Resolved" value={formatDate(selected.resolvedAt)} />
                  <Info label="Amount" value={money(selected.amount)} />
                </div>

                <div className="messageBox">
                  <strong>Reason</strong>
                  <p>{selected.reason || "No reason provided."}</p>
                </div>

                {booking && (
                  <div className="messageBox">
                    <strong>Linked Booking</strong>
                    <p>
                      {booking.from || "Origin"} → {booking.to || "Destination"} ·{" "}
                      {booking.passengerEmail || "Passenger"} · {booking.driverEmail || "Driver"} ·{" "}
                      {money(Number(booking.price || 0) * Number(booking.seatsBooked || 1))}
                    </p>
                  </div>
                )}

                <label>Admin Note</label>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Internal refund note..."
                />

                <div className="actionRow">
                  <button onClick={() => updateRefundStatus(selected, "approved")} disabled={processingId === selected.id}>
                    Approve
                  </button>
                  <button className="paidButton" onClick={() => updateRefundStatus(selected, "paid")} disabled={processingId === selected.id}>
                    Mark Paid
                  </button>
                  <button className="rejectButton" onClick={() => updateRefundStatus(selected, "rejected")} disabled={processingId === selected.id}>
                    Reject
                  </button>
                  <button className="pendingButton" onClick={() => updateRefundStatus(selected, "pending")} disabled={processingId === selected.id}>
                    Reopen
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a refund</h3>
                <p>Choose a request from the queue to review.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <Styles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 130px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 35%),
          radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1240px;
        margin: auto;
      }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .hero,
      .metric,
      .panel,
      .locked {
        background: rgba(8,13,25,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 35px;
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
      }

      .eyebrow {
        color: #22c55e;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 60px;
        line-height: 1;
      }

      h1 span,
      h2,
      .metric strong,
      .moneyOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .empty p,
      .messageBox p {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .smallText {
        font-size: 15px;
        overflow-wrap: anywhere;
      }

      .moneyOrb {
        min-width: 140px;
        height: 140px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
        padding: 14px;
      }

      .moneyOrb strong {
        font-size: 22px;
      }

      .moneyOrb span {
        color: #d4d4d8;
        font-weight: 900;
        font-size: 12px;
      }

      .message {
        text-align: center;
        color: #22c55e;
        font-weight: 900;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric {
        padding: 18px;
        border-radius: 22px;
      }

      .metricIcon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .metric span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .metric strong {
        font-size: 22px;
        overflow-wrap: anywhere;
      }

      .grid,
      .adminGrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      label {
        display: block;
        margin: 14px 0 8px;
        font-weight: 900;
      }

      input,
      textarea,
      select {
        width: 100%;
        padding: 15px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
        font-family: Arial, sans-serif;
      }

      textarea {
        min-height: 110px;
        resize: vertical;
      }

      option {
        color: black;
      }

      button {
        width: 100%;
        margin-top: 16px;
        padding: 14px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .filterGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .filterButton {
        text-align: left;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .activeFilter {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      .summaryBox {
        margin-top: 18px;
        padding: 18px;
        border-radius: 20px;
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
      }

      .summaryBox strong {
        display: block;
        color: #22c55e;
        font-size: 34px;
      }

      .summaryBox span {
        color: #a1a1aa;
        font-weight: 900;
      }

      .refundList {
        display: grid;
        gap: 12px;
      }

      .refundItem {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        width: 100%;
        text-align: left;
        padding: 16px;
        margin: 0;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .refundItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .refundItem strong,
      .refundItem span,
      .refundItem small {
        display: block;
        overflow-wrap: anywhere;
      }

      .refundItem span,
      .refundItem small {
        color: #a1a1aa;
        margin-top: 5px;
      }

      .refundRight {
        text-align: right;
      }

      .refundRight b {
        color: #22c55e;
        display: block;
        margin-bottom: 8px;
      }

      .detailsTop {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .pillGroup {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .pill {
        padding: 8px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        text-transform: capitalize;
        white-space: nowrap;
        font-style: normal;
      }

      .pending {
        color: #fde68a;
        background: rgba(234,179,8,0.12);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .approved,
      .paid,
      .normal {
        color: #86efac;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
      }

      .rejected {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .urgent {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .high {
        color: #fb923c;
        background: rgba(249,115,22,0.12);
        border: 1px solid rgba(249,115,22,0.35);
      }

      .infoGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }

      .info,
      .messageBox {
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .info span,
      .messageBox strong {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .info strong {
        display: block;
        color: white;
        overflow-wrap: anywhere;
      }

      .messageBox {
        margin-bottom: 14px;
      }

      .actionRow {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      .paidButton {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      }

      .rejectButton {
        background: linear-gradient(135deg, #ef4444, #991b1b);
      }

      .pendingButton {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
      }

      .empty {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .empty h3 {
        margin: 0 0 8px;
      }

      @media (max-width: 1000px) {
        .hero,
        .grid,
        .adminGrid,
        .detailsTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .infoGrid,
        .actionRow,
        .filterGrid {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 44px;
        }

        .pillGroup {
          justify-content: flex-start;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel {
          padding: 22px;
          border-radius: 26px;
        }

        .refundItem {
          grid-template-columns: 1fr;
        }

        .refundRight {
          text-align: left;
        }
      }
    `}</style>
  );
      }
