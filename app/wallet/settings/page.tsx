"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

type BankingInfo = {
  accountHolder?: string;
  bankName?: string;
  routingNumber?: string;
  accountNumberLast4?: string;
  payoutMethod?: string;
};

export default function WalletSettingsPage() {
  const [userId, setUserId] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("manual_bank_transfer");
  const [message, setMessage] = useState("Loading wallet settings...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to manage wallet settings.");
        return;
      }

      setUserId(user.uid);

      try {
        const userRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userRef);
        const data = snapshot.data();

        const banking = data?.banking as BankingInfo | undefined;

        setAccountHolder(banking?.accountHolder || data?.name || "");
        setBankName(banking?.bankName || "");
        setRoutingNumber(banking?.routingNumber || "");
        setAccountNumber(banking?.accountNumberLast4 ? `****${banking.accountNumberLast4}` : "");
        setPayoutMethod(banking?.payoutMethod || "manual_bank_transfer");
        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  async function saveBankingInfo() {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const cleanAccountNumber = accountNumber.replace(/\D/g, "");
      const accountNumberLast4 = cleanAccountNumber.slice(-4);

      await setDoc(
        doc(db, "users", userId),
        {
          banking: {
            accountHolder: accountHolder.trim(),
            bankName: bankName.trim(),
            routingNumber: routingNumber.trim(),
            accountNumberLast4,
            payoutMethod,
            updatedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setAccountNumber(accountNumberLast4 ? `****${accountNumberLast4}` : "");
      setMessage("Banking information saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="topNav">
          <Link href="/wallet" className="miniButton">Wallet</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/dashboard/driver" className="miniButton">Driver Dashboard</Link>
        </div>

        <p className="eyebrow">RoadLink Wallet</p>
        <h1>Banking <span>Settings</span></h1>
        <p className="subtitle">
          Save your payout information for future driver payments.
        </p>

        {message && <p className="message">{message}</p>}

        <div className="notice">
          <strong>Security note</strong>
          <p>
            For now, RoadLink only stores the last 4 digits of the account number.
            Full automated payouts will be handled later with Stripe Connect.
          </p>
        </div>

        <label>Account Holder Name</label>
        <input
          value={accountHolder}
          onChange={(event) => setAccountHolder(event.target.value)}
          placeholder="Jesus Fernandez Rosario"
        />

        <label>Bank Name</label>
        <input
          value={bankName}
          onChange={(event) => setBankName(event.target.value)}
          placeholder="Bank name"
        />

        <label>Routing Number</label>
        <input
          value={routingNumber}
          onChange={(event) => setRoutingNumber(event.target.value)}
          placeholder="Routing number"
          inputMode="numeric"
        />

        <label>Account Number</label>
        <input
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value)}
          placeholder="Account number"
          inputMode="numeric"
        />

        <label>Payout Method</label>
        <select
          value={payoutMethod}
          onChange={(event) => setPayoutMethod(event.target.value)}
        >
          <option value="manual_bank_transfer">Manual Bank Transfer</option>
          <option value="stripe_connect_pending">Stripe Connect Coming Soon</option>
        </select>

        <button onClick={saveBankingInfo} disabled={saving} className="saveButton">
          {saving ? "Saving..." : "Save Banking Info"}
        </button>
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
          padding: 20px;
          padding-bottom: 110px;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 760px;
          margin: auto;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 28px;
        }

        .miniButton {
          padding: 11px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
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
          font-size: 48px;
          line-height: 1;
          margin: 0 0 14px;
        }

        h1 span {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .notice {
          padding: 18px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 22px;
        }

        .notice strong {
          display: block;
          color: #22c55e;
          margin-bottom: 6px;
        }

        .notice p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 16px 0 8px;
        }

        input,
        select {
          width: 100%;
          padding: 16px;
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

        input:focus,
        select:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        .saveButton {
          width: 100%;
          margin-top: 24px;
          padding: 18px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        .saveButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
            padding-bottom: 110px;
          }

          .card {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 40px;
          }
        }
      `}</style>
    </main>
  );
}
