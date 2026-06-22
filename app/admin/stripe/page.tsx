"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type StripeAccountStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "restricted"
  | "rejected";

type StripePaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

type StripePayoutStatus =
  | "scheduled"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

type DriverAccount = {
  id: string;
  email?: string;
  name?: string;
  driverEmail?: string;
  driverVerified?: boolean;
  verified?: boolean;
  stripeAccountId?: string;
  stripeStatus?: StripeAccountStatus;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  createdAt?: string;
};

type Payment = {
  id: string;
  amount?: number;
  platformFee?: number;
  driverAmount?: number;
  status?: StripePaymentStatus;
  provider?: string;
  driverEmail?: string;
  passengerEmail?: string;
  bookingId?: string;
  rideId?: string;
  createdAt?: string;
};

type Payout = {
  id: string;
  amount?: number;
  status?: StripePayoutStatus;
  driverEmail?: string;
  stripePayoutId?: string;
  createdAt?: string;
};

type Dispute = {
  id: string;
  amount?: number;
  status?: string;
  reason?: string;
  paymentId?: string;
  email?: string;
  createdAt?: string;
};

export default function AdminStripeConnectCenterPage() {
  const [users, setUsers] = useState<DriverAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [message, setMessage] = useState("Loading Stripe Connect center...");
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

    const unsubUsers = listen<DriverAccount>("users", setUsers);
    const unsubPayments = listen<Payment>("payments", setPayments);
    const unsubPayouts = listen<Payout>("payoutRequests", setPayouts);
    const unsubDisputes = listen<Dispute>("disputes", setDisputes);

    return () => {
      unsubUsers();
      unsubPayments();
      unsubPayouts();
      unsubDisputes();
    };
  }, []);

  const metrics = useMemo(() => {
    const drivers = users.filter(
      (item) => item.driverVerified || item.verified || item.stripeAccountId
    );

    const notStarted = drivers.filter(
      (item) => !item.stripeStatus || item.stripeStatus === "not_started"
    );

    const pending = drivers.filter((item) => item.stripeStatus === "pending");

    const verified = drivers.filter(
      (item) =>
        item.stripeStatus === "verified" ||
        (item.stripeChargesEnabled && item.stripePayoutsEnabled)
    );

    const restricted = drivers.filter((item) => item.stripeStatus === "restricted");
    const rejected = drivers.filter((item) => item.stripeStatus === "rejected");

    const pendingPayments = payments.filter((item) => !item.status || item.status === "pending");
    const paidPayments = payments.filter((item) => item.status === "paid");
    const failedPayments = payments.filter((item) => item.status === "failed");
    const refundedPayments = payments.filter((item) => item.status === "refunded");

    const scheduledPayouts = payouts.filter((item) => item.status === "scheduled");
    const processingPayouts = payouts.filter((item) => item.status === "processing");
    const paidPayouts = payouts.filter((item) => item.status === "paid");
    const failedPayouts = payouts.filter((item) => item.status === "failed");

    const totalProcessed = paidPayments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const pendingBalance = pendingPayments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const platformRevenue = paidPayments.reduce(
      (total, item) => total + Number(item.platformFee || 0),
      0
    );

    const driverRevenue = paidPayments.reduce(
      (total, item) => total + Number(item.driverAmount || 0),
      0
    );

    const payoutVolume = paidPayouts.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const disputedVolume = disputes.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const payoutSuccessRate =
      payouts.length > 0 ? Math.round((paidPayouts.length / payouts.length) * 100) : 0;

    const stripeHealthScore = Math.max(
      Math.min(
        verified.length * 12 +
          paidPayments.length * 8 +
          paidPayouts.length * 8 +
          Math.round(platformRevenue / 10) -
          restricted.length * 10 -
          rejected.length * 12 -
          failedPayments.length * 8 -
          failedPayouts.length * 10 -
          disputes.length * 10,
        100
      ),
      0
    );

    return {
      drivers,
      notStarted,
      pending,
      verified,
      restricted,
      rejected,
      pendingPayments,
      paidPayments,
      failedPayments,
      refundedPayments,
      scheduledPayouts,
      processingPayouts,
      paidPayouts,
      failedPayouts,
      totalProcessed,
      pendingBalance,
      platformRevenue,
      driverRevenue,
      payoutVolume,
      disputedVolume,
      payoutSuccessRate,
      stripeHealthScore,
    };
  }, [users, payments, payouts, disputes]);

  async function updateStripeStatus(driver: DriverAccount, status: StripeAccountStatus) {
    try {
      setProcessingId(driver.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", driver.id),
        {
          stripeStatus: status,
          stripeDetailsSubmitted: status !== "not_started",
          stripeChargesEnabled: status === "verified",
          stripePayoutsEnabled: status === "verified",
          stripeUpdatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `stripe-account-${driver.id}-${Date.now()}`),
        {
          action: "Stripe Account Status Updated",
          targetId: driver.id,
          targetType: "stripeAccount",
          details: `${driver.email || driver.driverEmail || "Driver"} changed to ${status}`,
          severity: status === "verified" ? "success" : status === "restricted" || status === "rejected" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Stripe account status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update Stripe status.");
    } finally {
      setProcessingId("");
    }
  }

  async function createStripePlaceholder(driver: DriverAccount) {
    try {
      setProcessingId(driver.id);
      const now = new Date().toISOString();
      const fakeStripeAccountId = `acct_roadlink_${driver.id.slice(0, 10)}`;

      await setDoc(
        doc(db, "users", driver.id),
        {
          stripeAccountId: driver.stripeAccountId || fakeStripeAccountId,
          stripeStatus: "pending",
          stripeDetailsSubmitted: false,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeProvider: "stripe_connect_ready",
          stripeCreatedAt: driver.stripeAccountId ? undefined : now,
          stripeUpdatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "stripeAccounts", driver.id),
        {
          userId: driver.id,
          email: driver.email || driver.driverEmail || "",
          stripeAccountId: driver.stripeAccountId || fakeStripeAccountId,
          status: "pending",
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          provider: "stripe_connect_ready",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setMessage("Stripe Connect placeholder created. Real onboarding can be connected next.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create Stripe placeholder.");
    } finally {
      setProcessingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status?: StripeAccountStatus) {
    if (status === "verified") return "Verified";
    if (status === "pending") return "Pending";
    if (status === "restricted") return "Restricted";
    if (status === "rejected") return "Rejected";
    return "Not Started";
  }

  function statusClass(status?: StripeAccountStatus) {
    if (status === "verified") return "good";
    if (status === "restricted" || status === "rejected") return "bad";
    if (status === "pending") return "pending";
    return "neutral";
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
          <Link href="/admin/payments" className="miniButton">Payments</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue</Link>
          <Link href="/admin/risk" className="miniButton">Risk</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Stripe Connect</p>
            <h1>Stripe Connect <span>Center</span></h1>
            <p className="subtitle">
              Manage connected driver accounts, Stripe readiness, payment volume,
              platform revenue, driver revenue, payouts, disputes and financial risk.
            </p>
          </div>

          <div className={metrics.stripeHealthScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.stripeHealthScore}</strong>
            <span>Stripe Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💳" label="Total Processed" value={money(metrics.totalProcessed)} />
          <Metric icon="⏳" label="Pending Balance" value={money(metrics.pendingBalance)} />
          <Metric icon="🟢" label="Platform Revenue" value={money(metrics.platformRevenue)} />
          <Metric icon="🚗" label="Driver Revenue" value={money(metrics.driverRevenue)} />
          <Metric icon="🏦" label="Payout Volume" value={money(metrics.payoutVolume)} />
          <Metric icon="✅" label="Payout Success" value={`${metrics.payoutSuccessRate}%`} />
          <Metric icon="⚠️" label="Disputed Volume" value={money(metrics.disputedVolume)} />
          <Metric icon="👥" label="Connected Drivers" value={String(metrics.verified.length)} />
        </section>

        <section className="scoreGrid">
          <section className="scoreCard">
            <p className="eyebrow">Stripe Accounts</p>
            <h2>{metrics.drivers.length}</h2>
            <p>Total driver accounts tracked for Stripe Connect onboarding.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Needs Verification</p>
            <h2>{metrics.pending.length + metrics.restricted.length}</h2>
            <p>Drivers that need verification, onboarding or restriction resolution.</p>
          </section>

          <section className="scoreCard">
            <p className="eyebrow">Payment Risk</p>
            <h2>{metrics.failedPayments.length + metrics.failedPayouts.length + disputes.length}</h2>
            <p>Failed payments, failed payouts and disputes requiring review.</p>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Stripe Driver Accounts</p>
          <h2>Connected Accounts</h2>

          {metrics.drivers.length === 0 ? (
            <div className="empty">
              <h3>No driver Stripe accounts yet</h3>
              <p>Verified drivers or users with Stripe accounts will appear here.</p>
            </div>
          ) : (
            <div className="accountGrid">
              {metrics.drivers.map((driver) => (
                <section key={driver.id} className="accountCard">
                  <div className="cardTop">
                    <div>
                      <h3>{driver.name || driver.email || driver.driverEmail || "Driver Account"}</h3>
                      <p>{driver.email || driver.driverEmail || "No email"}</p>
                    </div>

                    <span className={`pill ${statusClass(driver.stripeStatus)}`}>
                      {statusLabel(driver.stripeStatus)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Stripe Account ID" value={driver.stripeAccountId || "Not created"} />
                    <Info label="Charges Enabled" value={driver.stripeChargesEnabled ? "Yes" : "No"} />
                    <Info label="Payouts Enabled" value={driver.stripePayoutsEnabled ? "Yes" : "No"} />
                    <Info label="Details Submitted" value={driver.stripeDetailsSubmitted ? "Yes" : "No"} />
                    <Info label="Driver Verified" value={driver.driverVerified || driver.verified ? "Yes" : "No"} />
                    <Info label="Created" value={formatDate(driver.createdAt)} />
                  </div>

                  <div className="actions">
                    <button
                      onClick={() => createStripePlaceholder(driver)}
                      disabled={processingId === driver.id}
                    >
                      Create Stripe Ready
                    </button>

                    <button
                      onClick={() => updateStripeStatus(driver, "pending")}
                      disabled={processingId === driver.id}
                    >
                      Pending
                    </button>

                    <button
                      className="goodButton"
                      onClick={() => updateStripeStatus(driver, "verified")}
                      disabled={processingId === driver.id}
                    >
                      Verify
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => updateStripeStatus(driver, "restricted")}
                      disabled={processingId === driver.id}
                    >
                      Restrict
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => updateStripeStatus(driver, "rejected")}
                      disabled={processingId === driver.id}
                    >
                      Reject
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <p className="eyebrow">Stripe Payments</p>
          <h2>Payment Operations</h2>

          <div className="miniStats">
            <Mini label="Pending Payments" value={String(metrics.pendingPayments.length)} />
            <Mini label="Successful Payments" value={String(metrics.paidPayments.length)} />
            <Mini label="Failed Payments" value={String(metrics.failedPayments.length)} />
            <Mini label="Refunded Payments" value={String(metrics.refundedPayments.length)} />
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Stripe Payouts</p>
          <h2>Payout Operations</h2>

          <div className="miniStats">
            <Mini label="Scheduled" value={String(metrics.scheduledPayouts.length)} />
            <Mini label="Processing" value={String(metrics.processingPayouts.length)} />
            <Mini label="Paid" value={String(metrics.paidPayouts.length)} />
            <Mini label="Failed" value={String(metrics.failedPayouts.length)} />
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Risk Monitoring</p>
          <h2>Disputes & Chargebacks</h2>

          {disputes.length === 0 ? (
            <div className="empty">
              <h3>No disputes found</h3>
              <p>Stripe disputes, chargebacks and fraud alerts will appear here.</p>
            </div>
          ) : (
            <div className="accountGrid">
              {disputes.map((item) => (
                <section key={item.id} className="accountCard dangerCard">
                  <div className="cardTop">
                    <div>
                      <h3>{money(Number(item.amount || 0))} Dispute</h3>
                      <p>{item.reason || "No reason provided"}</p>
                    </div>

                    <span className="pill bad">{item.status || "Open"}</span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Payment ID" value={item.paymentId || "Not linked"} />
                    <Info label="Email" value={item.email || "Not available"} />
                    <Info label="Created" value={formatDate(item.createdAt)} />
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
        .scoreCard,
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
        .accountCard p,
        .scoreCard p {
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

        .accountGrid {
          display: grid;
          gap: 16px;
        }

        .accountCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .dangerCard {
          border-color: rgba(239,68,68,0.32);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.1), transparent 40%),
            rgba(8,13,25,0.92);
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
        }

        .pill.good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.pending {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .pill.neutral {
          color: #e5e7eb;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
        }

        .pill.bad {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .infoBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span,
        .miniBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong,
        .miniBox strong {
          display: block;
          overflow-wrap: anywhere;
        }

        .miniStats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .miniBox {
          padding: 16px;
          border-radius: 18px;
          box-shadow: none;
        }

        .miniBox strong {
          color: #22c55e;
          font-size: 24px;
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
          .scoreGrid,
          .miniStats {
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
          .miniStats,
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="miniBox">
      <span>{label}</span>
      <strong>{value}</strong>
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
