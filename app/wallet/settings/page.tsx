"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";

type BankingInfo = {
  accountHolder?: string;
  bankName?: string;
  routingNumber?: string;
  accountNumberLast4?: string;
  payoutMethod?: string;
  updatedAt?: string;
};

export default function WalletSettingsPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [savedLast4, setSavedLast4] = useState("");
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
      setUserEmail(user.email || "");

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const data = snapshot.data();
        const banking = data?.banking as BankingInfo | undefined;

        setAccountHolder(banking?.accountHolder || data?.name || "");
        setBankName(banking?.bankName || "");
        setRoutingNumber(banking?.routingNumber || "");
        setSavedLast4(banking?.accountNumberLast4 || "");
        setAccountNumber(
          banking?.accountNumberLast4 ? `****${banking.accountNumberLast4}` : ""
        );
        setPayoutMethod(banking?.payoutMethod || "manual_bank_transfer");
        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  const cleanRouting = routingNumber.replace(/\D/g, "");
  const cleanAccount = accountNumber.replace(/\D/g, "");

  const routingValid = cleanRouting.length === 0 || cleanRouting.length === 9;
  const accountValid = accountNumber.startsWith("****") || cleanAccount.length >= 4;

  const bankReady = useMemo(() => {
    return (
      Boolean(accountHolder.trim()) &&
      Boolean(bankName.trim()) &&
      Boolean(savedLast4 || cleanAccount.length >= 4)
    );
  }, [accountHolder, bankName, savedLast4, cleanAccount]);

  async function saveBankingInfo() {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    if (!accountHolder.trim()) {
      setMessage("Account holder name is required.");
      return;
    }

    if (!bankName.trim()) {
      setMessage("Bank name is required.");
      return;
    }

    if (cleanRouting && cleanRouting.length !== 9) {
      setMessage("Routing number must be 9 digits.");
      return;
    }

    if (!accountValid) {
      setMessage("Account number must have at least 4 digits.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();
      const accountNumberLast4 =
        cleanAccount.length >= 4 ? cleanAccount.slice(-4) : savedLast4;

      await setDoc(
        doc(db, "users", userId),
        {
          banking: {
            accountHolder: accountHolder.trim(),
            bankName: bankName.trim(),
            routingNumber: cleanRouting,
            accountNumberLast4,
            payoutMethod,
            updatedAt: now,
          },
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "Wallet Settings Updated",
        targetId: userId,
        targetType: "wallet",
        details: `${userEmail || "Driver"} updated banking settings.`,
        severity: "info",
        createdAt: now,
      });

      setSavedLast4(accountNumberLast4);
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
      <section className="container">
        <div className="topNav">
          <Link href="/wallet" className="miniButton">← Wallet</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/dashboard/driver" className="miniButton">Driver Dashboard</Link>
          <Link href="/my-rides" className="miniButton">My Rides</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Wallet</p>
            <h1>Wallet <span>Settings</span></h1>
            <p className="subtitle">
              Manage payout information, banking readiness and driver payment preferences.
            </p>
          </div>

          <div className={bankReady ? "readyOrb" : "readyOrb warningOrb"}>
            {bankReady ? "✅" : "⚠️"}
            <span>{bankReady ? "Ready" : "Needed"}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="notice">
          <strong>Security note</strong>
          <p>
            RoadLink stores the routing number and only the last 4 digits of the account number.
            Full automated payouts can be handled later with Stripe Connect.
          </p>
        </section>

        <section className="statusGrid">
          <StatusBox label="Banking Status" value={bankReady ? "Ready" : "Incomplete"} />
          <StatusBox label="Saved Account" value={savedLast4 ? `****${savedLast4}` : "Not added"} />
          <StatusBox
            label="Payout Method"
            value={payoutMethod === "stripe_connect_pending" ? "Stripe Pending" : "Manual Bank"}
          />
        </section>

        <section className="formCard">
          <Field label="Account Holder Name">
            <input
              value={accountHolder}
              onChange={(event) => setAccountHolder(event.target.value)}
              placeholder="Jesus Fernandez Rosario"
            />
          </Field>

          <Field label="Bank Name">
            <input
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="Bank name"
            />
          </Field>

          <Field label="Routing Number">
            <input
              value={routingNumber}
              onChange={(event) =>
                setRoutingNumber(event.target.value.replace(/\D/g, "").slice(0, 9))
              }
              placeholder="9 digit routing number"
              inputMode="numeric"
            />
            {!routingValid && <p className="fieldError">Routing number must be 9 digits.</p>}
          </Field>

          <Field label="Account Number">
            <input
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder="Account number"
              inputMode="numeric"
            />
            <p className="fieldHelp">Only the last 4 digits will be saved.</p>
          </Field>

          <Field label="Payout Method">
            <select
              value={payoutMethod}
              onChange={(event) => setPayoutMethod(event.target.value)}
            >
              <option value="manual_bank_transfer">Manual Bank Transfer</option>
              <option value="stripe_connect_pending">Stripe Connect Coming Soon</option>
            </select>
          </Field>

          <button onClick={saveBankingInfo} disabled={saving} className="saveButton">
            {saving ? "Saving..." : "Save Wallet Settings"}
          </button>
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
          padding: 20px;
          padding-bottom: 120px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 900px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
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

        .hero,
        .notice,
        .statusBox,
        .formCard {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 30px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          margin-bottom: 18px;
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
          font-size: 52px;
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
          margin: 0;
        }

        .readyOrb {
          min-width: 104px;
          height: 104px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          font-size: 34px;
        }

        .readyOrb span {
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          margin-top: 5px;
        }

        .warningOrb {
          background: rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.35);
        }

        .warningOrb span {
          color: #facc15;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
          text-align: center;
        }

        .notice {
          padding: 20px;
          border-radius: 24px;
          margin-bottom: 18px;
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

        .statusGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .statusBox {
          padding: 18px;
          border-radius: 22px;
        }

        .statusBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 7px;
        }

        .statusBox strong {
          color: #22c55e;
          overflow-wrap: anywhere;
        }

        .formCard {
          border-radius: 30px;
          padding: 28px;
        }

        .field {
          margin-bottom: 18px;
        }

        label {
          display: block;
          font-weight: 900;
          margin-bottom: 8px;
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

        .fieldHelp {
          color: #a1a1aa;
          margin: 8px 0 0;
          font-size: 13px;
          font-weight: 800;
        }

        .fieldError {
          color: #fca5a5;
          margin: 8px 0 0;
          font-size: 13px;
          font-weight: 900;
        }

        .saveButton {
          width: 100%;
          margin-top: 12px;
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

        @media (max-width: 760px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 40px;
          }

          .statusGrid {
            grid-template-columns: 1fr;
          }

          .formCard {
            padding: 22px;
            border-radius: 28px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="statusBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
