"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";
type PaymentProvider = "manual_stripe_ready" | "manual_admin_ready" | "stripe" | "cash" | "other";

type Payment = {
  id: string;
  bookingId?: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  amount?: number;
  platformFee?: number;
  driverAmount?: number;
  currency?: string;
  provider?: PaymentProvider;
  status?: PaymentStatus;
  type?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
};

export default function AdminPaymentsCenterPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("Loading payments center...");
  const [processingId, setProcessingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "payments")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Payment[];

        setPayments(
          data.sort(
            (a, b) =>
              new Date(b.createdAt || "").getTime() -
              new Date(a.createdAt || "").getTime()
          )
        );

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const pending = payments.filter((item) => !item.status || item.status === "pending");
    const paid = payments.filter((item) => item.status === "paid");
    const failed = payments.filter((item) => item.status === "failed");
    const cancelled = payments.filter((item) => item.status === "cancelled");
    const refunded = payments.filter((item) => item.status === "refunded");

    const totalVolume = payments.reduce((total, item) => total + Number(item.amount || 0), 0);
    const paidVolume = paid.reduce((total, item) => total + Number(item.amount || 0), 0);
    const pendingVolume = pending.reduce((total, item) => total + Number(item.amount || 0), 0);
    const platformFees = payments.reduce((total, item) => total + Number(item.platformFee || 0), 0);
    const paidFees = paid.reduce((total, item) => total + Number(item.platformFee || 0), 0);
    const driverEarnings = payments.reduce((total, item) => total + Number(item.driverAmount || 0), 0);
    const paidDriverEarnings = paid.reduce((total, item) => total + Number(item.driverAmount || 0), 0);

    const successRate =
      payments.length > 0 ? Math.round((paid.length / payments.length) * 100) : 0;

    const paymentHealthScore = Math.max(
      Math.min(
        paid.length * 12 +
          pending.length * 4 +
          Math.round(paidVolume / 50) +
          Math.round(paidFees / 10) -
          failed.length * 10 -
          cancelled.length * 6 -
          refunded.length * 8,
        100
      ),
      0
    );

    return {
      pending,
      paid,
      failed,
      cancelled,
      refunded,
      totalVolume,
      paidVolume,
      pendingVolume,
      platformFees,
      paidFees,
      driverEarnings,
      paidDriverEarnings,
      successRate,
      paymentHealthScore,
    };
  }, [payments]);

  async function updatePaymentStatus(payment: Payment, status: PaymentStatus) {
    try {
      setProcessingId(payment.id);
      setMessage("");

      const now = new Date().toISOString();
      const amount = Number(payment.amount || 0);
      const platformFee = Number(payment.platformFee || Math.round(amount * 0.12 * 100) / 100);
      const driverAmount = Number(payment.driverAmount || Math.max(amount - platformFee, 0));

      await updateDoc(doc(db, "payments", payment.id), {
        status,
        platformFee,
        driverAmount,
        updatedAt: now,
        ...(status === "paid" ? { paidAt: now } : {}),
      });

      if (payment.bookingId) {
        await setDoc(
          doc(db, "bookings", payment.bookingId),
          {
            status: status === "paid" ? "paid" : status === "pending" ? "payment_pending" : status,
            paymentStatus: status,
            paymentId: payment.id,
            amount,
            platformFee,
            driverAmount,
            updatedAt: now,
            ...(status === "paid" ? { paidAt: now } : {}),
          },
          { merge: true }
        );
      }

      if (status === "paid") {
        await setDoc(
          doc(db, "walletTransactions", `wallet-${payment.id}`),
          {
            paymentId: payment.id,
            bookingId: payment.bookingId || "",
            rideId: payment.rideId || "",
            driverId: payment.driverId || "",
            driverEmail: payment.driverEmail || "",
            passengerId: payment.passengerId || "",
            passengerEmail: payment.passengerEmail || "",
            amount: driverAmount,
            platformFee,
            grossAmount: amount,
            type: "ride_payment",
            status: "pending_payout",
            description: payment.description || "RoadLink ride payment",
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      await setDoc(
        doc(db, "auditLogs", `payment-${payment.id}-${Date.now()}`),
        {
          action: "Payment Status Updated",
          targetId: payment.id,
          targetType: "payment",
          details: `Payment changed to ${status}`,
          severity: status === "paid" ? "success" : status === "failed" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage(`Payment marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update payment.");
    } finally {
      setProcessingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: PaymentStatus) {
    if (status === "paid") return "Paid";
    if (status === "failed") return "Failed";
    if (status === "cancelled") return "Cancelled";
    if (status === "refunded") return "Refunded";
    return "Pending";
  }

  function providerLabel(provider?: PaymentProvider) {
    if (provider === "stripe") return "Stripe";
    if (provider === "manual_stripe_ready") return "Stripe Ready";
    if (provider === "manual_admin_ready") return "Manual Admin";
    if (provider === "cash") return "Cash";
    return "Other";
  }

  function statusClass(status?: PaymentStatus) {
    if (status === "paid") return "paid";
    if (status === "failed" || status === "cancelled" || status === "refunded") return "bad";
    return "pending";
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue</Link>
          <Link href="/admin/enterprise-revenue" className="miniButton">Enterprise Revenue</Link>
          <Link href="/admin/stripe" className="miniButton">Stripe</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Financial Operations</p>
            <h1>Payments <span>Center</span></h1>
            <p className="subtitle">
              Track passenger payments, booking revenue, pending payments, completed payments,
              platform fees, driver earnings and Stripe-ready financial operations.
            </p>
          </div>

          <div className={metrics.paymentHealthScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.paymentHealthScore}</strong>
            <span>Payment Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💳" label="Payments" value={String(payments.length)} />
          <Metric icon="⏳" label="Pending" value={String(metrics.pending.length)} />
          <Metric icon="✅" label="Paid" value={String(metrics.paid.length)} />
          <Metric icon="❌" label="Failed" value={String(metrics.failed.length)} />
          <Metric icon="💵" label="Total Volume" value={money(metrics.totalVolume)} />
          <Metric icon="🏦" label="Paid Volume" value={money(metrics.paidVolume)} />
          <Metric icon="🟢" label="RoadLink Fees" value={money(metrics.paidFees)} />
          <Metric icon="🚗" label="Driver Earnings" value={money(metrics.paidDriverEarnings)} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Success Rate</p>
            <h2>{metrics.successRate}%</h2>
            <p>Paid payments compared with all tracked payments.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Pending Volume</p>
            <h2>{money(metrics.pendingVolume)}</h2>
            <p>Total value waiting for payment completion.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Gross Platform Fees</p>
            <h2>{money(metrics.platformFees)}</h2>
            <p>RoadLink platform fees across all payment records.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Payment Records</p>
          <h2>Payment Timeline</h2>

          {payments.length === 0 ? (
            <div className="empty">
              <h3>No payments yet</h3>
              <p>Payments will appear here when passengers start or complete booking payments.</p>
            </div>
          ) : (
            <div className="paymentGrid">
              {payments.map((payment) => {
                const amount = Number(payment.amount || 0);
                const fee = Number(payment.platformFee || Math.round(amount * 0.12 * 100) / 100);
                const driverAmount = Number(payment.driverAmount || Math.max(amount - fee, 0));

                return (
                  <section key={payment.id} className="paymentCard">
                    <div className="cardTop">
                      <div>
                        <h3>{money(amount)} Payment</h3>
                        <p>{payment.description || "RoadLink booking payment"}</p>
                      </div>

                      <span className={`pill ${statusClass(payment.status)}`}>
                        {statusLabel(payment.status)}
                      </span>
                    </div>

                    <div className="infoGrid">
                      <Info label="Passenger" value={payment.passengerEmail || "Not available"} />
                      <Info label="Driver" value={payment.driverEmail || "Not available"} />
                      <Info label="Provider" value={providerLabel(payment.provider)} />
                      <Info label="Status" value={statusLabel(payment.status)} />
                      <Info label="Amount" value={money(amount)} />
                      <Info label="RoadLink Fee" value={money(fee)} />
                      <Info label="Driver Amount" value={money(driverAmount)} />
                      <Info label="Booking ID" value={payment.bookingId || "Not linked"} />
                      <Info label="Ride ID" value={payment.rideId || "Not linked"} />
                      <Info label="Created" value={formatDate(payment.createdAt)} />
                      <Info label="Paid At" value={formatDate(payment.paidAt)} />
                      <Info label="Payment ID" value={payment.id} />
                    </div>

                    <div className="actions">
                      <button
                        onClick={() => updatePaymentStatus(payment, "pending")}
                        disabled={processingId === payment.id}
                      >
                        Pending
                      </button>

                      <button
                        className="paidButton"
                        onClick={() => updatePaymentStatus(payment, "paid")}
                        disabled={processingId === payment.id}
                      >
                        Paid
                      </button>

                      <button
                        className="dangerButton"
                        onClick={() => updatePaymentStatus(payment, "failed")}
                        disabled={processingId === payment.id}
                      >
                        Failed
                      </button>

                      <button
                        className="dangerButton"
                        onClick={() => updatePaymentStatus(payment, "refunded")}
                        disabled={processingId === payment.id}
                      >
                        Refunded
                      </button>
                    </div>
                  </section>
                );
              })}
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
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1380px;
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
        .card,
        .paymentCard,
        .scoreCard {
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
        .paymentCard p,
        .scoreCard p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 112px;
          height: 112px;
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

        .stats,
        .scoreGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .scoreGrid {
          grid-template-columns: repeat(3, 1fr);
        }

        .metric,
        .scoreCard {
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

        .scoreCard h2 {
          font-size: 38px;
        }

        .card {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .paymentGrid {
          display: grid;
          gap: 16px;
        }

        .paymentCard {
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

        .paymentCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .paymentCard p {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.pending {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .pill.paid {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.bad {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
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

        .actions .paidButton {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.35);
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
          .scoreGrid {
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
          .scoreGrid,
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
