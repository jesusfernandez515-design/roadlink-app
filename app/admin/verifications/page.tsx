"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected";

type DriverVerification = {
  id: string;
  userId?: string;
  email?: string;
  status?: VerificationStatus;
  governmentIdURL?: string;
  driverLicenseURL?: string;
  insuranceURL?: string;
  vehiclePhotoURL?: string;
  submittedAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<DriverVerification[]>([]);
  const [selected, setSelected] = useState<DriverVerification | null>(null);
  const [message, setMessage] = useState("Loading verification requests...");
  const [loadingId, setLoadingId] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const verificationsQuery = query(collection(db, "driverVerifications"));

    const unsubscribe = onSnapshot(
      verificationsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as DriverVerification[];

        data.sort((a, b) =>
          String(b.submittedAt || b.updatedAt || "").localeCompare(
            String(a.submittedAt || a.updatedAt || "")
          )
        );

        setVerifications(data);
        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });
        setMessage("");
      },
      (error) => {
        setMessage(error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  const pendingCount = useMemo(
    () => verifications.filter((item) => item.status === "pending").length,
    [verifications]
  );

  const approvedCount = useMemo(
    () => verifications.filter((item) => item.status === "approved").length,
    [verifications]
  );

  const rejectedCount = useMemo(
    () => verifications.filter((item) => item.status === "rejected").length,
    [verifications]
  );

  async function approveDriver(item: DriverVerification) {
    const userId = item.userId || item.id;

    if (!userId) {
      setMessage("Missing user ID.");
      return;
    }

    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "driverVerifications", userId),
        {
          ...item,
          userId,
          status: "approved",
          reviewedAt: now,
          updatedAt: now,
          rejectionReason: "",
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", userId),
        {
          verified: true,
          driverVerified: true,
          licenseVerified: true,
          verificationStatus: "approved",
          updatedAt: now,
        },
        { merge: true }
      );

      setMessage("Driver approved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function rejectDriver(item: DriverVerification) {
    const userId = item.userId || item.id;

    if (!userId) {
      setMessage("Missing user ID.");
      return;
    }

    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "driverVerifications", userId),
        {
          ...item,
          userId,
          status: "rejected",
          reviewedAt: now,
          updatedAt: now,
          rejectionReason: rejectReason.trim() || "Documents need review.",
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", userId),
        {
          verified: false,
          driverVerified: false,
          licenseVerified: false,
          verificationStatus: "rejected",
          updatedAt: now,
        },
        { merge: true }
      );

      setRejectReason("");
      setMessage("Driver rejected successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  function statusText(status?: VerificationStatus) {
    if (status === "approved") return "Approved";
    if (status === "pending") return "Pending";
    if (status === "rejected") return "Rejected";
    return "Not Submitted";
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
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/driver-verification" className="miniButton">Driver Verification</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>
              Verification <span>Dashboard</span>
            </h1>
            <p className="subtitle">
              Review driver documents, approve verified drivers, and reject incomplete applications.
            </p>
          </div>

          <div className="heroIcon">🛡️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="⏳" label="Pending" value={String(pendingCount)} />
          <Metric icon="✅" label="Approved" value={String(approvedCount)} />
          <Metric icon="⛔" label="Rejected" value={String(rejectedCount)} />
          <Metric icon="📋" label="Total" value={String(verifications.length)} />
        </section>

        <section className="adminGrid">
          <div className="requestsCard">
            <p className="eyebrow">Requests</p>
            <h2>Driver Applications</h2>

            {verifications.length === 0 ? (
              <div className="empty">
                <h3>No verification requests yet</h3>
                <p>When drivers submit documents, they will appear here.</p>
              </div>
            ) : (
              <div className="requestList">
                {verifications.map((item) => {
                  const active = selected?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      className={active ? "request activeRequest" : "request"}
                      onClick={() => setSelected(item)}
                    >
                      <div>
                        <strong>{item.email || "RoadLink Driver"}</strong>
                        <span>{dateText(item.submittedAt || item.updatedAt)}</span>
                      </div>

                      <em className={`status ${item.status || "not_submitted"}`}>
                        {statusText(item.status)}
                      </em>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Driver</p>
                    <h2>{selected.email || "RoadLink Driver"}</h2>
                  </div>

                  <span className={`statusPill ${selected.status || "not_submitted"}`}>
                    {statusText(selected.status)}
                  </span>
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.userId || selected.id} />
                  <Info label="Submitted" value={dateText(selected.submittedAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Reviewed" value={dateText(selected.reviewedAt)} />
                </div>

                <div className="documents">
                  <DocumentLink title="Government ID" url={selected.governmentIdURL} icon="🪪" />
                  <DocumentLink title="Driver License" url={selected.driverLicenseURL} icon="🚘" />
                  <DocumentLink title="Insurance" url={selected.insuranceURL} icon="📄" />
                  <DocumentLink title="Vehicle Photo" url={selected.vehiclePhotoURL} icon="📸" />
                </div>

                {selected.rejectionReason && (
                  <div className="reasonBox">
                    <strong>Rejection Reason</strong>
                    <p>{selected.rejectionReason}</p>
                  </div>
                )}

                <label className="rejectLabel">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Example: Insurance document is missing or unclear."
                />

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() => approveDriver(selected)}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Approve Driver"}
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() => rejectDriver(selected)}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Reject Driver"}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a driver</h3>
                <p>Choose a verification request to review documents.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

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
          display: inline-flex;
          align-items: center;
          justify-content: center;
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
          letter-spacing: -1px;
        }

        h1 span,
        h2 {
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
          color: #22c55e;
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

        .status.not_submitted,
        .statusPill.not_submitted {
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

        .documents {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .documentLink {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .documentLink span {
          font-size: 24px;
        }

        .documentLink em {
          color: #22c55e;
          font-style: normal;
          font-size: 13px;
        }

        .missingDoc {
          opacity: 0.45;
        }

        .reasonBox {
          padding: 16px;
          border-radius: 18px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          margin-bottom: 16px;
        }

        .reasonBox p {
          color: #fca5a5;
          margin-bottom: 0;
        }

        .rejectLabel {
          display: block;
          color: #e5e7eb;
          font-weight: 900;
          margin-bottom: 8px;
        }

        textarea {
          width: 100%;
          min-height: 110px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 15px;
          outline: none;
          resize: vertical;
          margin-bottom: 16px;
        }

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .approveButton,
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
          .documents,
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

function DocumentLink({
  title,
  url,
  icon,
}: {
  title: string;
  url?: string;
  icon: string;
}) {
  if (!url) {
    return (
      <div className="documentLink missingDoc">
        <span>{icon}</span>
        <strong>{title}</strong>
        <em>Missing</em>
      </div>
    );
  }

  return (
    <a className="documentLink" href={url} target="_blank" rel="noreferrer">
      <span>{icon}</span>
      <strong>{title}</strong>
      <em>View</em>
    </a>
  );
      }
