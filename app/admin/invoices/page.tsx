"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type Booking = {
  id: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: any;
};

type Invoice = {
  id: string;
  invoiceNumber?: string;
  bookingId?: string;
  rideId?: string;
  customerEmail?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  subtotal?: number;
  platformFee?: number;
  driverPayout?: number;
  total?: number;
  status?: string;
  issuedAt?: string;
  dueAt?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminInvoicesPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("Loading invoices center...");
  const [processingId, setProcessingId] = useState("");

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

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Booking[]);
    });

    const unsubInvoices = onSnapshot(query(collection(db, "invoices")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Invoice[];

      data.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

      setInvoices(data);
      setSelected((current) => {
        if (!current) return data[0] || null;
        return data.find((item) => item.id === current.id) || data[0] || null;
      });

      setMessage("");
    });

    return () => {
      unsubBookings();
      unsubInvoices();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function dateText(value?: string) {
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  const invoiceNumbers = useMemo(() => {
    return new Set(invoices.map((item) => item.bookingId).filter(Boolean));
  }, [invoices]);

  const missingInvoiceBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        clean(booking.status) === "completed" &&
        !invoiceNumbers.has(booking.id)
    );
  }, [bookings, invoiceNumbers]);

  const metrics = useMemo(() => {
    const paid = invoices.filter((item) => item.status === "paid");
    const pending = invoices.filter((item) => item.status === "pending");
    const overdue = invoices.filter((item) => item.status === "overdue");
    const refunded = invoices.filter((item) => item.status === "refunded");
    const cancelled = invoices.filter((item) => item.status === "cancelled");

    const total = invoices.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const paidTotal = paid.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const pendingTotal = pending.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const platformFees = invoices.reduce((sum, item) => sum + Number(item.platformFee || 0), 0);
    const driverPayouts = invoices.reduce((sum, item) => sum + Number(item.driverPayout || 0), 0);

    return {
      totalInvoices: invoices.length,
      paid: paid.length,
      pending: pending.length,
      overdue: overdue.length,
      refunded: refunded.length,
      cancelled: cancelled.length,
      total,
      paidTotal,
      pendingTotal,
      platformFees,
      driverPayouts,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const value = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesSearch =
        !value ||
        clean(invoice.invoiceNumber).includes(value) ||
        clean(invoice.customerEmail).includes(value) ||
        clean(invoice.driverEmail).includes(value) ||
        clean(invoice.bookingId).includes(value) ||
        clean(invoice.rideId).includes(value) ||
        clean(invoice.from).includes(value) ||
        clean(invoice.to).includes(value) ||
        clean(invoice.id).includes(value);

      const matchesFilter = filter === "all" || invoice.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [invoices, search, filter]);

  async function generateMissingInvoices() {
    try {
      setProcessingId("generate");
      setMessage("");

      const now = new Date().toISOString();

      for (const booking of missingInvoiceBookings) {
        const subtotal = Number(booking.price || 0) * Number(booking.seatsBooked || 1);
        const platformFee = Number((subtotal * 0.12).toFixed(2));
        const driverPayout = Number((subtotal * 0.88).toFixed(2));
        const invoiceNumber = `RL-${Date.now()}-${booking.id.slice(0, 5).toUpperCase()}`;

        await addDoc(collection(db, "invoices"), {
          invoiceNumber,
          bookingId: booking.id,
          rideId: booking.rideId || "",
          customerEmail: booking.passengerEmail || "",
          driverEmail: booking.driverEmail || "",
          from: booking.from || "",
          to: booking.to || "",
          subtotal,
          platformFee,
          driverPayout,
          total: subtotal,
          status: "pending",
          issuedAt: now,
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: now,
          updatedAt: now,
        });
      }

      await addDoc(collection(db, "auditLogs"), {
        action: "Invoices Generated",
        targetType: "invoice",
        details: `${missingInvoiceBookings.length} invoices generated from completed bookings.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage(`${missingInvoiceBookings.length} invoices generated.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not generate invoices.");
    } finally {
      setProcessingId("");
    }
  }

  async function updateInvoiceStatus(invoice: Invoice, nextStatus: string) {
    try {
      setProcessingId(invoice.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "invoices", invoice.id), {
        status: nextStatus,
        updatedAt: now,
        ...(nextStatus === "paid" ? { paidAt: now } : {}),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Invoice Status Updated",
        targetType: "invoice",
        targetId: invoice.id,
        details: `${invoice.invoiceNumber || invoice.id} moved to ${nextStatus}.`,
        severity: nextStatus === "paid" ? "success" : "info",
        adminEmail: auth.currentUser?.email || "",
        userEmail: invoice.customerEmail || "",
        createdAt: now,
        resolved: nextStatus === "paid",
      });

      setMessage(`Invoice marked as ${nextStatus}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update invoice.");
    } finally {
      setProcessingId("");
    }
  }

  function statusClass(value?: string) {
    if (value === "paid") return "pill paid";
    if (value === "overdue") return "pill overdue";
    if (value === "refunded") return "pill refunded";
    if (value === "cancelled") return "pill cancelled";
    return "pill pending";
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Invoices <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/finance" className="navButton">Finance</Link>
          <Link href="/admin/refunds" className="navButton">Refunds</Link>
          <Link href="/admin/platform-settings" className="navButton">Settings</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Billing Operations</p>
            <h1>Invoices <span>Center</span></h1>
            <p className="subtitle">
              Manage invoices, completed booking billing, platform fees, driver payouts, payment status and export-ready financial records.
            </p>
          </div>

          <div className="invoiceOrb">
            <strong>{money(metrics.total)}</strong>
            <span>Total Billed</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🧾" label="Invoices" value={String(metrics.totalInvoices)} />
          <Metric icon="✅" label="Paid" value={String(metrics.paid)} />
          <Metric icon="⏳" label="Pending" value={String(metrics.pending)} />
          <Metric icon="🚨" label="Overdue" value={String(metrics.overdue)} />
          <Metric icon="🔄" label="Refunded" value={String(metrics.refunded)} />
          <Metric icon="💰" label="Paid Total" value={money(metrics.paidTotal)} />
          <Metric icon="🧾" label="Platform Fees" value={money(metrics.platformFees)} />
          <Metric icon="🚗" label="Driver Payouts" value={money(metrics.driverPayouts)} />
        </section>

        <section className="controls">
          <div>
            <p className="eyebrow">Invoice Tools</p>
            <h2>Generate & Search</h2>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by invoice, email, booking, ride or route..."
          />

          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All invoices</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button onClick={generateMissingInvoices} disabled={processingId === "generate" || missingInvoiceBookings.length === 0}>
            {processingId === "generate"
              ? "Generating..."
              : `Generate Missing (${missingInvoiceBookings.length})`}
          </button>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Invoice Queue</p>
            <h2>{filteredInvoices.length} Invoices</h2>

            {filteredInvoices.length === 0 ? (
              <div className="empty">
                <h3>No invoices found</h3>
                <p>Completed booking invoices will appear here.</p>
              </div>
            ) : (
              <div className="invoiceList">
                {filteredInvoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    className={selected?.id === invoice.id ? "invoiceItem selected" : "invoiceItem"}
                    onClick={() => setSelected(invoice)}
                  >
                    <div>
                      <strong>{invoice.invoiceNumber || invoice.id}</strong>
                      <span>{invoice.customerEmail || "No customer"}</span>
                      <small>{dateText(invoice.createdAt)}</small>
                    </div>

                    <div className="invoiceRight">
                      <b>{money(invoice.total)}</b>
                      <em className={statusClass(invoice.status)}>{invoice.status || "pending"}</em>
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
                    <p className="eyebrow">Selected Invoice</p>
                    <h2>{selected.invoiceNumber || selected.id}</h2>
                    <p className="subtitle smallText">{selected.customerEmail || "No customer email"}</p>
                  </div>

                  <span className={statusClass(selected.status)}>{selected.status || "pending"}</span>
                </div>

                <div className="invoiceBox">
                  <strong>{money(selected.total)}</strong>
                  <span>Total invoice amount</span>
                </div>

                <div className="infoGrid">
                  <Info label="Invoice ID" value={selected.id} />
                  <Info label="Booking ID" value={selected.bookingId || "Not linked"} />
                  <Info label="Ride ID" value={selected.rideId || "Not linked"} />
                  <Info label="Customer" value={selected.customerEmail || "Not available"} />
                  <Info label="Driver" value={selected.driverEmail || "Not available"} />
                  <Info label="Route" value={`${selected.from || "Origin"} → ${selected.to || "Destination"}`} />
                  <Info label="Issued" value={dateText(selected.issuedAt)} />
                  <Info label="Due" value={dateText(selected.dueAt)} />
                  <Info label="Paid" value={dateText(selected.paidAt)} />
                  <Info label="Subtotal" value={money(selected.subtotal)} />
                  <Info label="RoadLink Fee" value={money(selected.platformFee)} />
                  <Info label="Driver Payout" value={money(selected.driverPayout)} />
                </div>

                <div className="actionRow">
                  <button onClick={() => updateInvoiceStatus(selected, "paid")} disabled={processingId === selected.id}>
                    Mark Paid
                  </button>

                  <button className="warningButton" onClick={() => updateInvoiceStatus(selected, "overdue")} disabled={processingId === selected.id}>
                    Mark Overdue
                  </button>

                  <button className="refundButton" onClick={() => updateInvoiceStatus(selected, "refunded")} disabled={processingId === selected.id}>
                    Refunded
                  </button>

                  <button className="cancelButton" onClick={() => updateInvoiceStatus(selected, "cancelled")} disabled={processingId === selected.id}>
                    Cancel
                  </button>
                </div>

                <div className="preparedBox">
                  <strong>PDF / Email Ready</strong>
                  <p>This invoice structure is ready for future PDF download and email sending integration.</p>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select an invoice</h3>
                <p>Choose an invoice from the queue to view details.</p>
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
      <strong>{value}</strong>
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
          radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 35%),
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
      .controls,
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
      .invoiceOrb strong,
      .invoiceBox strong {
        color: #22c55e;
      }

      .subtitle,
      .empty p,
      .locked p,
      .preparedBox p {
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

      .invoiceOrb {
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

      .invoiceOrb strong {
        font-size: 22px;
      }

      .invoiceOrb span {
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

      .controls {
        border-radius: 30px;
        padding: 22px;
        margin-bottom: 20px;
        display: grid;
        grid-template-columns: 1fr 1.4fr 220px 230px;
        gap: 14px;
        align-items: center;
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

      option {
        color: black;
      }

      button {
        width: 100%;
        padding: 15px;
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

      .grid {
        display: grid;
        grid-template-columns: 0.9fr 1.2fr;
        gap: 20px;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      .invoiceList {
        display: grid;
        gap: 12px;
      }

      .invoiceItem {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        width: 100%;
        text-align: left;
        padding: 16px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .invoiceItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .invoiceItem strong,
      .invoiceItem span,
      .invoiceItem small {
        display: block;
        overflow-wrap: anywhere;
      }

      .invoiceItem span,
      .invoiceItem small {
        color: #a1a1aa;
        margin-top: 5px;
      }

      .invoiceRight {
        text-align: right;
      }

      .invoiceRight b {
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

      .paid {
        color: #86efac;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
      }

      .overdue,
      .cancelled {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .refunded {
        color: #c4b5fd;
        background: rgba(139,92,246,0.12);
        border: 1px solid rgba(139,92,246,0.35);
      }

      .invoiceBox,
      .preparedBox {
        padding: 18px;
        border-radius: 20px;
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
        margin-bottom: 18px;
      }

      .invoiceBox strong {
        display: block;
        font-size: 42px;
      }

      .invoiceBox span {
        color: #a1a1aa;
        font-weight: 900;
      }

      .preparedBox strong {
        color: #22c55e;
        display: block;
        margin-bottom: 6px;
      }

      .infoGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }

      .info {
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .info span {
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

      .actionRow {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 18px;
      }

      .warningButton {
        background: linear-gradient(135deg, #f59e0b, #b45309);
      }

      .refundButton {
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
      }

      .cancelButton {
        background: linear-gradient(135deg, #ef4444, #991b1b);
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

      @media (max-width: 1050px) {
        .hero,
        .controls,
        .grid,
        .detailsTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .infoGrid,
        .actionRow {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 44px;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel,
        .controls {
          padding: 22px;
          border-radius: 26px;
        }

        .invoiceItem {
          grid-template-columns: 1fr;
        }

        .invoiceRight {
          text-align: left;
        }
      }
    `}</style>
  );
      }
