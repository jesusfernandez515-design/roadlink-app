"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Payment = {
  id: string;
  amount?: number;
  platformFee?: number;
  driverAmount?: number;
  status?: string;
  provider?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  bookingId?: string;
  rideId?: string;
  createdAt?: string;
};

type User = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  driverVerified?: boolean;
  verified?: boolean;
  stripeAccountId?: string;
  stripeStatus?: string;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
};

type Payout = {
  id: string;
  amount?: number;
  status?: string;
  driverEmail?: string;
  stripePayoutId?: string;
  createdAt?: string;
};

export default function AdminStripeProductionCenterPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [message, setMessage] = useState("Loading Stripe Production Center...");
  const [processingId, setProcessingId] = useState("");

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => {
          setter([]);
          setMessage("");
        }
      );

    const unsubPayments = listen<Payment>("payments", setPayments);
    const unsubUsers = listen<User>("users", setUsers);
    const unsubPayouts = listen<Payout>("payoutRequests", setPayouts);

    return () => {
      unsubPayments();
      unsubUsers();
      unsubPayouts();
    };
  }, []);

  const metrics = useMemo(() => {
    const stripePayments = payments.filter(
      (item) =>
        item.provider === "stripe" ||
        item.stripePaymentIntentId ||
        item.stripeCheckoutSessionId
    );

    const manualPayments = payments.filter(
      (item) =>
        item.provider !== "stripe" &&
        !item.stripePaymentIntentId &&
        !item.stripeCheckoutSessionId
    );

    const paid = payments.filter((item) => item.status === "paid");
    const pending = payments.filter((item) => !item.status || item.status === "pending");
    const failed = payments.filter((item) => item.status === "failed");
    const refunded = payments.filter((item) => item.status === "refunded");

    const connectedDrivers = users.filter(
      (item) => item.stripeAccountId || item.stripeStatus === "verified"
    );

    const readyDrivers = users.filter(
      (item) =>
        item.stripeChargesEnabled &&
        item.stripePayoutsEnabled &&
        item.stripeDetailsSubmitted
    );

    const needsOnboarding = users.filter(
      (item) =>
        (item.driverVerified || item.verified || item.role === "driver") &&
        (!item.stripeAccountId || item.stripeStatus !== "verified")
    );

    const paidPayouts = payouts.filter((item) => item.status === "paid");
    const pendingPayouts = payouts.filter(
      (item) => !item.status || item.status === "pending" || item.status === "scheduled"
    );
    const failedPayouts = payouts.filter((item) => item.status === "failed");

    const totalVolume = payments.reduce((total, item) => total + Number(item.amount || 0), 0);
    const stripeVolume = stripePayments.reduce((total, item) => total + Number(item.amount || 0), 0);
    const platformRevenue = paid.reduce((total, item) => total + Number(item.platformFee || 0), 0);
    const driverRevenue = paid.reduce((total, item) => total + Number(item.driverAmount || 0), 0);
    const payoutVolume = paidPayouts.reduce((total, item) => total + Number(item.amount || 0), 0);

    const productionScore = Math.max(
      Math.min(
        readyDrivers.length * 12 +
          stripePayments.length * 8 +
          paid.length * 6 +
          Math.round(platformRevenue / 10) -
          failed.length * 10 -
          refunded.length * 8 -
          failedPayouts.length * 10 -
          needsOnboarding.length * 2,
        100
      ),
      0
    );

    return {
      stripePayments,
      manualPayments,
      paid,
      pending,
      failed,
      refunded,
      connectedDrivers,
      readyDrivers,
      needsOnboarding,
      paidPayouts,
      pendingPayouts,
      failedPayouts,
      totalVolume,
      stripeVolume,
      platformRevenue,
      driverRevenue,
      payoutVolume,
      productionScore,
    };
  }, [payments, users, payouts]);

  async function markProductionReady() {
    try {
      setProcessingId("production-ready");
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "platformSettings", "stripeProduction"),
        {
          mode: "production_ready",
          stripeConnectEnabled: true,
          checkoutEnabled: true,
          payoutsEnabled: true,
          platformFeePercent: 12,
          currency: "USD",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `stripe-production-${Date.now()}`),
        {
          action: "Stripe Production Marked Ready",
          targetId: "stripeProduction",
          targetType: "platformSettings",
          details: "Stripe production settings marked as ready.",
          severity: "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Stripe production settings marked as ready.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update Stripe production settings.");
    } finally {
      setProcessingId("");
    }
  }

  async function createProductionChecklist() {
    try {
      setProcessingId("checklist");
      const now = new Date().toISOString();

      const items = [
        "Add STRIPE_SECRET_KEY to Vercel",
        "Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to Vercel",
        "Add STRIPE_WEBHOOK_SECRET to Vercel",
        "Create Checkout Session API route",
        "Create Stripe Connect onboarding route",
        "Create Stripe webhook route",
        "Test booking payment",
        "Test driver payout",
        "Switch Stripe account to live mode",
      ];

      await Promise.all(
        items.map((title, index) =>
          setDoc(
            doc(db, "stripeProductionChecklist", `item-${index + 1}`),
            {
              title,
              status: "pending",
              order: index + 1,
              createdAt: now,
              updatedAt: now,
            },
            { merge: true }
          )
        )
      );

      setMessage("Stripe production checklist created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create checklist.");
    } finally {
      setProcessingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusClass(value: number) {
    if (value >= 70) return "good";
    if (value >= 40) return "warning";
    return "bad";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/stripe" className="miniButton">Stripe Connect</Link>
          <Link href="/admin/payments" className="miniButton">Payments</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Production Payments</p>
            <h1>Stripe Production <span>Center</span></h1>
            <p className="subtitle">
              Prepare RoadLink for real Stripe Checkout, Stripe Connect Express,
              platform fees, driver payouts, webhooks and production payment monitoring.
            </p>
          </div>

          <div className={`scoreOrb ${statusClass(metrics.productionScore)}`}>
            <strong>{metrics.productionScore}</strong>
            <span>Production Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💳" label="Total Volume" value={money(metrics.totalVolume)} />
          <Metric icon="⚡" label="Stripe Volume" value={money(metrics.stripeVolume)} />
          <Metric icon="🟢" label="Platform Revenue" value={money(metrics.platformRevenue)} />
          <Metric icon="🚗" label="Driver Revenue" value={money(metrics.driverRevenue)} />
          <Metric icon="✅" label="Paid Payments" value={String(metrics.paid.length)} />
          <Metric icon="⏳" label="Pending Payments" value={String(metrics.pending.length)} />
          <Metric icon="❌" label="Failed Payments" value={String(metrics.failed.length)} />
          <Metric icon="🏦" label="Paid Payouts" value={String(metrics.paidPayouts.length)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Production Readiness</p>
            <h2>Stripe Checklist</h2>

            <div className="checkList">
              <Check label="Stripe secret key in Vercel" />
              <Check label="Stripe publishable key in Vercel" />
              <Check label="Webhook secret configured" />
              <Check label="Checkout Session API route" />
              <Check label="Connect onboarding API route" />
              <Check label="Webhook route for completed payments" />
              <Check label="Driver payouts tested" />
              <Check label="Live mode enabled in Stripe" />
            </div>

            <div className="actions">
              <button onClick={createProductionChecklist} disabled={processingId === "checklist"}>
                Create Checklist
              </button>

              <button className="goodButton" onClick={markProductionReady} disabled={processingId === "production-ready"}>
                Mark Production Ready
              </button>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Environment Variables</p>
            <h2>Vercel Keys Needed</h2>

            <div className="codeBox">
              <code>STRIPE_SECRET_KEY</code>
              <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>
              <code>STRIPE_WEBHOOK_SECRET</code>
              <code>NEXT_PUBLIC_APP_URL</code>
            </div>

            <p className="smallText">
              Nunca pongas las llaves secretas dentro del frontend. Van en Vercel Environment Variables.
            </p>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Connected Drivers</p>
          <h2>Stripe Connect Accounts</h2>

          <div className="miniGrid">
            <Mini label="Connected Drivers" value={String(metrics.connectedDrivers.length)} />
            <Mini label="Ready Drivers" value={String(metrics.readyDrivers.length)} />
            <Mini label="Need Onboarding" value={String(metrics.needsOnboarding.length)} />
            <Mini label="Payout Volume" value={money(metrics.payoutVolume)} />
          </div>

          {metrics.connectedDrivers.length === 0 ? (
            <div className="empty">
              <h3>No Stripe connected drivers yet</h3>
              <p>Drivers will appear here after Stripe Connect onboarding starts.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {metrics.connectedDrivers.map((driver) => (
                <section key={driver.id} className="itemCard">
                  <div className="cardTop">
                    <div>
                      <h3>{driver.name || driver.email || "Driver"}</h3>
                      <p>{driver.stripeAccountId || "No Stripe Account ID"}</p>
                    </div>

                    <span className={`pill ${driver.stripeStatus === "verified" ? "good" : "warning"}`}>
                      {driver.stripeStatus || "pending"}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Email" value={driver.email || "Not available"} />
                    <Info label="Charges Enabled" value={driver.stripeChargesEnabled ? "Yes" : "No"} />
                    <Info label="Payouts Enabled" value={driver.stripePayoutsEnabled ? "Yes" : "No"} />
                    <Info label="Details Submitted" value={driver.stripeDetailsSubmitted ? "Yes" : "No"} />
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Payment Operations</p>
          <h2>Production Payment Records</h2>

          {payments.length === 0 ? (
            <div className="empty">
              <h3>No payments yet</h3>
              <p>Stripe and manual payments will appear here.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {payments.slice(0, 30).map((payment) => (
                <section key={payment.id} className="itemCard">
                  <div className="cardTop">
                    <div>
                      <h3>{money(Number(payment.amount || 0))} Payment</h3>
                      <p>{payment.passengerEmail || "Passenger"} → {payment.driverEmail || "Driver"}</p>
                    </div>

                    <span className={`pill ${payment.status === "paid" ? "good" : payment.status === "failed" ? "bad" : "warning"}`}>
                      {payment.status || "pending"}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Provider" value={payment.provider || "manual"} />
                    <Info label="Stripe Intent" value={payment.stripePaymentIntentId || "Not linked"} />
                    <Info label="Checkout Session" value={payment.stripeCheckoutSessionId || "Not linked"} />
                    <Info label="Platform Fee" value={money(Number(payment.platformFee || 0))} />
                    <Info label="Driver Amount" value={money(Number(payment.driverAmount || 0))} />
                    <Info label="Booking ID" value={payment.bookingId || "Not linked"} />
                    <Info label="Ride ID" value={payment.rideId || "Not linked"} />
                    <Info label="Payment ID" value={payment.id} />
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
            radial-gradient(circle at top right, rgba(99,102,241,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1450px; margin: auto; }

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
        .panel,
        .itemCard,
        .miniBox {
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
        .itemCard p,
        .smallText {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
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

        .scoreOrb.warning {
          background: rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.35);
        }

        .scoreOrb.bad {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
        }

        .scoreOrb.bad strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
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
          background: rgba(99,102,241,0.14);
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

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        .panel {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .checkList {
          display: grid;
          gap: 10px;
          margin-bottom: 18px;
        }

        .checkItem,
        .codeBox code {
          display: block;
          padding: 13px 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #e5e7eb;
          font-weight: 900;
        }

        .codeBox {
          display: grid;
          gap: 10px;
          margin-bottom: 14px;
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

        .actions .goodButton {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.35);
        }

        .miniGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .miniBox {
          border-radius: 18px;
          padding: 16px;
          box-shadow: none;
        }

        .miniBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .miniBox strong {
          display: block;
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .cardGrid {
          display: grid;
          gap: 16px;
        }

        .itemCard {
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

        .itemCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .itemCard p {
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

        .pill.good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.warning {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
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
          .infoGrid,
          .miniGrid,
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 780px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .cardTop {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .infoGrid,
          .miniGrid,
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <section className="miniBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function Check({ label }: { label: string }) {
  return <div className="checkItem">✅ {label}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}
