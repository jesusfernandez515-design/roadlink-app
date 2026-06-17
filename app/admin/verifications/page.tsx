"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type VerificationStatus = "pending" | "approved" | "rejected";

type DriverVerification = {
  id: string;
  userId?: string;
  userEmail?: string;
  name?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiration?: string;
  licenseImageUrl?: string;
  selfieUrl?: string;
  insuranceImageUrl?: string;
  vehicleRegistrationUrl?: string;
  status?: VerificationStatus;
  rejectionReason?: string;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
};

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<DriverVerification[]>([]);
  const [selected, setSelected] = useState<DriverVerification | null>(null);
  const [filter, setFilter] = useState<"all" | VerificationStatus>("all");
  const [search, setSearch] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState("Loading verifications...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "driverVerifications")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as DriverVerification[];

        data.sort((a, b) =>
          String(b.submittedAt || b.createdAt || b.updatedAt || "").localeCompare(
            String(a.submittedAt || a.createdAt || a.updatedAt || "")
          )
        );

        setVerifications(data);

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

  useEffect(() => {
    setRejectionReason(selected?.rejectionReason || "");
  }, [selected]);

  const filteredVerifications = useMemo(() => {
    const text = search.toLowerCase().trim();

    return verifications.filter((item) => {
      const status = item.status || "pending";

      const matchesFilter = filter === "all" || status === filter;

      const matchesSearch =
        !text ||
        item.userEmail?.toLowerCase().includes(text) ||
        item.name?.toLowerCase().includes(text) ||
        item.phone?.toLowerCase().includes(text) ||
        item.licenseNumber?.toLowerCase().includes(text) ||
        item.licenseState?.toLowerCase().includes(text) ||
        item.userId?.toLowerCase().includes(text) ||
        item.id.toLowerCase().includes(text);

      return matchesFilter && matchesSearch;
    });
  }, [verifications, filter, search]);

  const pendingCount = verifications.filter((item) => !item.status || item.status === "pending").length;
  const approvedCount = verifications.filter((item) => item.status === "approved").length;
  const rejectedCount = verifications.filter((item) => item.status === "rejected").length;

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Not available";
      return date.toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function verificationScore(item: DriverVerification) {
    let score = 0;

    if (item.licenseNumber) score += 20;
    if (item.licenseState) score += 10;
    if (item.licenseExpiration) score += 10;
    if (item.licenseImageUrl) score += 25;
    if (item.selfieUrl) score += 20;
    if (item.insuranceImageUrl) score += 10;
    if (item.vehicleRegistrationUrl) score += 5;

    return Math.min(score, 100);
  }

  async function approveVerification(item: DriverVerification) {
    if (!item.userId) {
      setMessage("This verification does not have a user ID.");
      return;
    }

    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "driverVerifications", item.id), {
        status: "approved",
        rejectionReason: "",
        reviewedAt: now,
        updatedAt: now,
      });

      await setDoc(
        doc(db, "users", item.userId),
        {
          verified: true,
          driverVerified: true,
          licenseVerified: true,
          verificationStatus: "approved",
          suspended: false,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "notifications"), {
        userId: item.userId,
        type: "verification",
        title: "Driver Verification Approved",
        message: "Your RoadLink driver verification has been approved.",
        read: false,
        createdAt: now,
        actionUrl: "/profile",
      });

      await addDoc(collection(db, "auditLogs"), {
        userId: item.userId,
        userEmail: item.userEmail || "",
        action: "Admin approved driver verification",
        targetId: item.id,
        targetType: "driverVerification",
        details: "Driver was approved and marked as verified.",
        severity: "success",
        createdAt: now,
      });

      setMessage("Driver approved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not approve driver.");
    } finally {
      setLoadingId("");
    }
  }

  async function rejectVerification(item: DriverVerification) {
    if (!item.userId) {
      setMessage("This verification does not have a user ID.");
      return;
    }

    if (!rejectionReason.trim()) {
      setMessage("Please write a rejection reason first.");
      return;
    }

    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "driverVerifications", item.id), {
        status: "rejected",
        rejectionReason: rejectionReason.trim(),
        reviewedAt: now,
        updatedAt: now,
      });

      await setDoc(
        doc(db, "users", item.userId),
        {
          driverVerified: false,
          licenseVerified: false,
          verificationStatus: "rejected",
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "notifications"), {
        userId: item.userId,
        type: "verification",
        title: "Driver Verification Rejected",
        message: rejectionReason.trim(),
        read: false,
        createdAt: now,
        actionUrl: "/profile",
      });

      await addDoc(collection(db, "auditLogs"), {
        userId: item.userId,
        userEmail: item.userEmail || "",
        action: "Admin rejected driver verification",
        targetId: item.id,
        targetType: "driverVerification",
        details: rejectionReason.trim(),
        severity: "warning",
        createdAt: now,
      });

      setMessage("Driver verification rejected.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not reject verification.");
    } finally {
      setLoadingId("");
    }
  }

  async function suspendDriver(item: DriverVerification) {
    if (!item.userId) {
      setMessage("This verification does not have a user ID.");
      return;
    }

    const confirmSuspend = window.confirm("Are you sure you want to suspend this driver?");

    if (!confirmSuspend) return;

    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", item.userId),
        {
          suspended: true,
          driverVerified: false,
          verificationStatus: "suspended",
          updatedAt: now,
        },
        { merge: true }
      );

      await updateDoc(doc(db, "driverVerifications", item.id), {
        status: "rejected",
        rejectionReason: "Driver suspended by admin.",
        reviewedAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId: item.userId,
        type: "account",
        title: "Account Suspended",
        message: "Your RoadLink driver account was suspended after an admin review.",
        read: false,
        createdAt: now,
        actionUrl: "/profile",
      });

      await addDoc(collection(db, "auditLogs"), {
        userId: item.userId,
        userEmail: item.userEmail || "",
        action: "Admin suspended driver",
        targetId: item.id,
        targetType: "driverVerification",
        details: "Driver account suspended from verification center.",
        severity: "danger",
        createdAt: now,
      });

      setMessage("Driver suspended successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not suspend driver.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status?: VerificationStatus) {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Pending";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Driver <span>Verification</span></h1>
            <p className="subtitle">
              Review driver licenses, identity documents, selfies, insurance, and approve safe drivers.
            </p>
          </div>

          <div className="heroIcon">🛡️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📋" label="Total" value={String(verifications.length)} />
          <Metric icon="⏳" label="Pending" value={String(pendingCount)} />
          <Metric icon="✅" label="Approved" value={String(approvedCount)} />
          <Metric icon="❌" label="Rejected" value={String(rejectedCount)} />
        </section>

        <section className="filtersCard">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, name, license, state, user ID..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | VerificationStatus)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="listCard">
            <p className="eyebrow">Applications</p>
            <h2>Driver Requests</h2>

            {filteredVerifications.length === 0 ? (
              <div className="empty">
                <h3>No verification requests</h3>
                <p>Driver verification requests will appear here.</p>
              </div>
            ) : (
              <div className="verificationList">
                {filteredVerifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "verificationRow activeRow" : "verificationRow"}
                  >
                    <div className="rowIcon">🪪</div>

                    <div className="rowInfo">
                      <strong>{item.name || item.userEmail || "RoadLink Driver"}</strong>
                      <span>{item.userEmail || "No email"}</span>
                      <small>{item.licenseState || "State"} • Score {verificationScore(item)}%</small>
                    </div>

                    <em className={`status ${item.status || "pending"}`}>
                      {statusLabel(item.status)}
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
                    <p className="eyebrow">Selected Driver</p>
                    <h2>{selected.name || selected.userEmail || "Driver Application"}</h2>
                    <p className="email">{selected.userEmail || "No email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "pending"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="scoreBox">
                  <span>Verification Score</span>
                  <strong>{verificationScore(selected)}%</strong>
                </div>

                <div className="infoGrid">
                  <Info label="Verification ID" value={selected.id} />
                  <Info label="User ID" value={selected.userId || "Not available"} />
                  <Info label="Name" value={selected.name || "Not available"} />
                  <Info label="Email" value={selected.userEmail || "Not available"} />
                  <Info label="Phone" value={selected.phone || "Not available"} />
                  <Info label="License Number" value={selected.licenseNumber || "Not available"} />
                  <Info label="License State" value={selected.licenseState || "Not available"} />
                  <Info label="Expiration Date" value={selected.licenseExpiration || "Not available"} />
                  <Info label="Submitted" value={dateText(selected.submittedAt || selected.createdAt)} />
                  <Info label="Reviewed" value={dateText(selected.reviewedAt)} />
                </div>

                <section className="documentsCard">
                  <p className="eyebrow">Documents</p>

                  <div className="documentGrid">
                    <DocumentLink title="Driver License" url={selected.licenseImageUrl} />
                    <DocumentLink title="Selfie / Identity" url={selected.selfieUrl} />
                    <DocumentLink title="Insurance" url={selected.insuranceImageUrl} />
                    <DocumentLink title="Vehicle Registration" url={selected.vehicleRegistrationUrl} />
                  </div>
                </section>

                <label>Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Write reason if rejecting this verification..."
                />

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() => approveVerification(selected)}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Approve Driver"}
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() => rejectVerification(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Reject
                  </button>

                  <button
                    className="suspendButton"
                    onClick={() => suspendDriver(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Suspend Driver
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a verification</h3>
                <p>Choose a driver verification request to review.</p>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
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
        .filtersCard,
        .listCard,
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
        .scoreBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 12px;
        }

        .subtitle,
        .email,
        .empty p {
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

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric {
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
          font-size: 24px;
          font-weight: 900;
        }

        .filtersCard {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        input,
        select,
        textarea {
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

        select option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .listCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .verificationList {
          display: grid;
          gap: 12px;
        }

        .verificationRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeRow {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .rowIcon {
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

        .rowInfo {
          min-width: 0;
        }

        .rowInfo strong,
        .rowInfo span,
        .rowInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rowInfo span,
        .rowInfo small {
          color: #a1a1aa;
          margin-top: 4px;
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

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .scoreBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .scoreBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .scoreBox strong {
          font-size: 48px;
          font-weight: 900;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox,
        .documentsCard {
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

        .documentsCard {
          margin-bottom: 20px;
        }

        .documentGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .docLink,
        .docMissing {
          padding: 14px;
          border-radius: 16px;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        .docLink {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .docMissing {
          color: #a1a1aa;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        label {
          display: block;
          font-weight: 900;
          margin-bottom: 8px;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
          margin-bottom: 16px;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .approveButton,
        .rejectButton,
        .suspendButton {
          padding: 16px;
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
          background: linear-gradient(135deg, #f97316, #c2410c);
        }

        .suspendButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
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

        @media (max-width: 900px) {
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
          .filtersCard,
          .adminGrid,
          .infoGrid,
          .documentGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .listCard,
          .detailsCard {
            padding: 24px;
          }

          .verificationRow {
            grid-template-columns: 46px 1fr;
          }

          .verificationRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .rowIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
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

function DocumentLink({ title, url }: { title: string; url?: string }) {
  if (!url) {
    return <div className="docMissing">{title}: Missing</div>;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="docLink">
      View {title}
    </a>
  );
}
