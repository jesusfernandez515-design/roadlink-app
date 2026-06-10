"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Payment = {
  id: string;
  amount?: number;
  status?: string;
  driverEmail?: string;
  passengerEmail?: string;
  bookingId?: string;
  rideId?: string;
  stripePaymentIntentId?: string;
  createdAt?: string;
};

type Transaction = {
  id: string;
  amount?: number;
  type?: string;
  status?: string;
  userEmail?: string;
  stripeId?: string;
  createdAt?: string;
};

type Refund = {
  id: string;
  amount?: number;
  status?: string;
  reason?: string;
  userEmail?: string;
  paymentId?: string;
  createdAt?: string;
};

type StripeAccount = {
  id: string;
  userId?: string;
  email?: string;
  stripeAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  createdAt?: string;
};

export default function AdminStripePage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [accounts, setAccounts] = useState<StripeAccount[]>([]);
  const [message, setMessage] = useState("Loading Stripe dashboard...");

  useEffect(() => {
    const unsubPayments = onSnapshot(
      query(collection(db, "payments")),
      (snapshot) => {
        setPayments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Payment[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, "transactions")),
      (snapshot) => {
        setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Transaction[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubRefunds = onSnapshot(
      query(collection(db, "refunds")),
      (snapshot) => {
        setRefunds(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Refund[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubAccounts = onSnapshot(
      query(collection(db, "stripeAccounts")),
      (snapshot) => {
        setAccounts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StripeAccount[]);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubPayments();
      unsubTransactions();
      unsubRefunds();
      unsubAccounts();
    };
  }, []);

  const totalRevenue = payments
    .filter((item) => item.status === "succeeded" || item.status === "paid")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const platformFees = Math.round(totalRevenue * 0.12);
  const driverEarnings = Math.max(totalRevenue - platformFees, 0);

  const failedPayments = payments.filter((item) => item.status === "failed").length;
  const pendingPayments = payments.filter((item) => item.status === "pending").length;
  const successfulPayments = payments.filter(
    (item) => item.status === "succeeded" || item.status === "paid"
  ).length;

  const pendingRefunds = refunds.filter((item) => item.status === "pending").length;
  const connectedAccounts = accounts.length;
  const readyAccounts = accounts.filter(
    (item) => item.chargesEnabled && item.payoutsEnabled
  ).length;

  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8);
  }, [payments]);

  const recentRefunds = useMemo(() => {
    return [...refunds]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8);
  }, [refunds]);

  function dateText(value?: string) {
    if (!value) return "Recently";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Recently";
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/payments" className="miniButton">Payments</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Stripe <span>Dashboard</span></h1>
            <p className="subtitle">
              Monitor payment activity, platform fees, driver earnings, refunds,
              connected accounts, and transaction history before live Stripe integration.
            </p>
          </div>

          <div className="heroIcon">💳</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="Revenue" value={`$${totalRevenue}`} />
          <Metric icon="🏦" label="Platform Fees" value={`$${platformFees}`} />
          <Metric icon="🚘" label="Driver Earnings" value={`$${driverEarnings}`} />
          <Metric icon="✅" label="Successful" value={String(successfulPayments)} />
          <Metric icon="⏳" label="Pending" value={String(pendingPayments)} />
          <Metric icon="❌" label="Failed" value={String(failedPayments)} />
          <Metric icon="↩️" label="Pending Refunds" value={String(pendingRefunds)} />
          <Metric icon="🔗" label="Stripe Accounts" value={`${readyAccounts}/${connectedAccounts}`} />
        </section>

        <section className="grid">
          <section className="card">
            <p className="eyebrow">Payments</p>
            <h2>Recent Payments</h2>

            {recentPayments.length === 0 ? (
              <div className="empty">
                <h3>No payments yet</h3>
                <p>Stripe payment records will appear here once connected.</p>
              </div>
            ) : (
              <div className="list">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="item">
                    <div className="itemIcon">💳</div>
                    <div className="itemInfo">
                      <strong>${Number(payment.amount || 0)}</strong>
                      <span>{payment.passengerEmail || "Passenger"} → {payment.driverEmail || "Driver"}</span>
                      <small>{payment.status || "pending"} • {dateText(payment.createdAt)}</small>
                    </div>
                    <em className={payment.status === "failed" ? "bad" : "good"}>
                      {payment.status || "pending"}
                    </em>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <p className="eyebrow">Refunds</p>
            <h2>Refund Requests</h2>

            {recentRefunds.length === 0 ? (
              <div className="empty">
                <h3>No refunds yet</h3>
                <p>Refund requests and completed refunds will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {recentRefunds.map((refund) => (
                  <div key={refund.id} className="item">
                    <div className="itemIcon">↩️</div>
                    <div className="itemInfo">
                      <strong>${Number(refund.amount || 0)}</strong>
                      <span>{refund.userEmail || "User"}</span>
                      <small>{refund.reason || "No reason"} • {dateText(refund.createdAt)}</small>
                    </div>
                    <em className={refund.status === "approved" ? "good" : "pending"}>
                      {refund.status || "pending"}
                    </em>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="grid">
          <section className="card">
            <p className="eyebrow">Transactions</p>
            <h2>Transaction History</h2>

            {transactions.length === 0 ? (
              <div className="empty">
                <h3>No transactions yet</h3>
                <p>Stripe transaction records will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {transactions.slice(0, 8).map((transaction) => (
                  <div key={transaction.id} className="item">
                    <div className="itemIcon">📋</div>
                    <div className="itemInfo">
                      <strong>{transaction.type || "Transaction"}</strong>
                      <span>{transaction.userEmail || "RoadLink User"}</span>
                      <small>{transaction.status || "pending"} • {dateText(transaction.createdAt)}</small>
                    </div>
                    <em className="good">${Number(transaction.amount || 0)}</em>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <p className="eyebrow">Connect</p>
            <h2>Stripe Accounts</h2>

            {accounts.length === 0 ? (
              <div className="empty">
                <h3>No connected accounts yet</h3>
                <p>Driver Stripe Connect accounts will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {accounts.slice(0, 8).map((account) => (
                  <div key={account.id} className="item">
                    <div className="itemIcon">🔗</div>
                    <div className="itemInfo">
                      <strong>{account.email || "Driver"}</strong>
                      <span>{account.stripeAccountId || "No Stripe ID"}</span>
                      <small>
                        Charges: {account.chargesEnabled ? "Yes" : "No"} • Payouts:{" "}
                        {account.payoutsEnabled ? "Yes" : "No"}
                      </small>
                    </div>
                    <em className={account.chargesEnabled && account.payoutsEnabled ? "good" : "pending"}>
                      {account.chargesEnabled && account.payoutsEnabled ? "Ready" : "Setup"}
                    </em>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="stripeCard">
          <div>
            <p className="eyebrow">Next Integration</p>
            <h2>Stripe Live Setup</h2>
            <p>
              Next we add Stripe packages, API routes, checkout sessions, payment
              intents, platform fees, webhooks, refunds, and driver Connect onboarding.
            </p>
          </div>

          <Link href="/admin/settings" className="stripeButton">
            Configure Fees
          </Link>
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

        .container { max-width: 1180px; margin: auto; }

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
        .stripeCard {
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .empty p,
        .stripeCard p,
        .itemInfo span,
        .itemInfo small {
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

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
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

        .metricValue { font-size: 24px; font-weight: 900; }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .card,
        .stripeCard {
          border-radius: 30px;
          padding: 28px;
        }

        .list { display: grid; gap: 12px; }

        .item {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .itemIcon {
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

        .itemInfo { min-width: 0; }

        .itemInfo strong,
        .itemInfo span,
        .itemInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item em {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .bad {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .pending {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 { margin: 0 0 8px; font-size: 24px; }

        .stripeCard {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .stripeButton {
          padding: 16px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        @media (max-width: 1100px) {
          .stats { grid-template-columns: repeat(2, 1fr); }
          .grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero,
          .stripeCard {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats { grid-template-columns: 1fr; }

          .item {
            grid-template-columns: 46px 1fr;
          }

          .item em {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .itemIcon {
            width: 46px;
            height: 46px;
          }

          .stripeButton { width: 100%; }
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
