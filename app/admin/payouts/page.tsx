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

type PayoutStatus = "pending" | "approved" | "rejected" | "paid";

type PayoutRequest = {
  id: string;
  userId?: string;
  driverEmail?: string;
  amount?: number;
  status?: PayoutStatus;
  createdAt?: string;
  reviewedAt?: string;
  note?: string;
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [selected, setSelected] = useState<PayoutRequest | null>(null);
  const [message, setMessage] = useState("Loading payout requests...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const payoutsQuery = query(collection(db, "payoutRequests"));

    const unsubscribe = onSnapshot(
      payoutsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as PayoutRequest[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setPayouts(data);
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

  const pendingCount = useMemo(
    () => payouts.filter((item) => item.status === "pending").length,
    [payouts]
  );

  const approvedCount = useMemo(
    () => payouts.filter((item) => item.status === "approved").length,
    [payouts]
  );

  const paidCount = useMemo(
    () => payouts.filter((item) => item.status === "paid").length,
    [payouts]
  );

  const totalPending = useMemo(
    () =>
      payouts
        .filter((item) => item.status === "pending")
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [payouts]
  );

  async function updatePayoutStatus(item: PayoutRequest, status: PayoutStatus) {
    if (!item.id) {
      setMessage("Missing payout request ID.");
      return;
    }

    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "payoutRequests", item.id), {
        status,
        reviewedAt: now,
        updatedAt: now,
      });

      if (item.userId) {
        await setDoc(
          doc(db, "notifications", `${item.userId}-payout-${Date.now()}`),
          {
            userId: item.userId,
            type: "payout",
            title: "Payout Update",
            message:
              status === "approved"
                ? `Your payout request for $${Number(item.amount || 0)} was approved.`
                : status === "paid"
                ? `Your payout request for $${Number(item.amount || 0)} was marked as paid.`
                : `Your payout request for $${Number(item.amount || 0)} was rejected.`,
            read: false,
            createdAt: now,
          },
          { merge: true }
        );
      }

      setMessage(`Payout ${status} successfully.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  function statusText(status?: PayoutStatus) {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    if (status === "paid") return "Paid";
    return "Pending";
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
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/admin/verifications" className="miniButton">Verifications</Link>
          <Link href="/wallet" className="miniButton">Wallet</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Payout <span>Dashboard</span></h1>
            <p className="subtitle">
              Review driver payout requests, approve payouts, reject requests, and mark payouts as paid.
            </p>
          </div>

          <div className="heroIcon">💰</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="⏳" label="Pending" value={String(pendingCount)} />
          <Metric icon="✅" label="Approved" value={String(approvedCount)} />
          <Metric icon="🏦" label="Paid" value={String(paidCount)} />
          <Metric icon="💵" label="Pending $" value={`$${totalPending}`} />
        </section>

        <section className="adminGrid">
          <div className="requestsCard">
            <p className="eyebrow">Requests</p>
            <h2>Payout Requests</h2>

            {payouts.length === 0 ? (
              <div className="empty">
                <h3>No payout requests yet</h3>
                <p>When drivers request payouts, they will appear here.</p>
              </div>
            ) : (
              <div className="requestList">
                {payouts.map((item) => (
                  <button
                    key={item.id}
                    className={selected?.id === item.id ? "request activeRequest" : "request"}
                    onClick={() => setSelected(item)}
                  >
                    <div>
                      <strong>{item.driverEmail || item.userId || "RoadLink Driver"}</strong>
                      <span>{dateText(item.createdAt)}</span>
                    </div>

                    <em className={`status ${item.status || "pending"}`}>
                      {statusText(item.status)}
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
                    <p className="eyebrow">Selected Request</p>
                    <h2>{selected.driverEmail || "RoadLink Driver"}</h2>
                  </div>

                  <span className={`statusPill ${selected.status || "pending"}`}>
                    {statusText(selected.status)}
                  </span>
                </div>

                <div className="amountBox">
                  <span>Requested Amount</span>
                  <strong>${Number(selected.amount || 0)}</strong>
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.userId || "Not available"} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Reviewed" value={dateText(selected.reviewedAt)} />
                  <Info label="Request ID" value={selected.id} />
                </div>

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() => updatePayoutStatus(selected, "approved")}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Approve"}
                  </button>

                  <button
                    className="paidButton"
                    onClick={() => updatePayoutStatus(selected, "paid")}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Mark Paid"}
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() => updatePayoutStatus(selected, "rejected")}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Reject"}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a payout</h3>
                <p>Choose a payout request to review.</p>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
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
        .requestsCard,
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
          margin: 0 0 20px;
        }

        .subtitle {
          max-width: 700px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
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
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 22px;
        }

        .metricIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 30px;
          font-weight: 900;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .requestsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .requestList {
          display: grid;
          gap: 12px;
        }

        .request {
          width: 100%;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeRequest {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .request strong {
          display: block;
          margin-bottom: 6px;
          overflow-wrap: anywhere;
        }

        .request span {
          color: #a1a1aa;
          font-size: 12px;
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

        .status.pending,
        .statusPill.pending {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.approved,
        .statusPill.approved {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.rejected,
        .statusPill.rejected {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .status.paid,
        .statusPill.paid {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .amountBox {
          padding: 24px;
          border-radius: 24px;
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
          font-size: 52px;
          font-weight: 900;
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

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .approveButton,
        .paidButton,
        .rejectButton {
          padding: 17px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .paidButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .rejectButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
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

        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 900px) {
          .page {
            padding: 16px;
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
          .adminGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .requestsCard,
          .detailsCard {
            padding: 24px;
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
