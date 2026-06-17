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

type VerificationStatus = "pending" | "approved" | "rejected" | "reviewing";

type DriverVerification = {
  id: string;
  userId?: string;
  userEmail?: string;
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  licenseUrl?: string;
  insuranceUrl?: string;
  vehiclePhotoUrl?: string;
  selfieUrl?: string;
  status?: VerificationStatus;
  licenseStatus?: VerificationStatus;
  insuranceStatus?: VerificationStatus;
  vehicleStatus?: VerificationStatus;
  riskLevel?: "low" | "medium" | "high";
  notes?: string;
  rejectionReason?: string;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
};

export default function AdminVerificationQueuePage() {
  const [items, setItems] = useState<DriverVerification[]>([]);
  const [selected, setSelected] = useState<DriverVerification | null>(null);
  const [filter, setFilter] = useState<"all" | VerificationStatus>("all");
  const [search, setSearch] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState("Loading verification queue...");
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
          String(b.submittedAt || b.createdAt || "").localeCompare(
            String(a.submittedAt || a.createdAt || "")
          )
        );

        setItems(data);

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
    setAdminNote(selected?.notes || "");
    setRejectionReason(selected?.rejectionReason || "");
  }, [selected]);

  const filteredItems = useMemo(() => {
    const text = search.toLowerCase().trim();

    return items.filter((item) => {
      const currentStatus = item.status || "pending";

      const matchesFilter = filter === "all" || currentStatus === filter;

      const matchesSearch =
        !text ||
        item.userEmail?.toLowerCase().includes(text) ||
        item.name?.toLowerCase().includes(text) ||
        item.phone?.toLowerCase().includes(text) ||
        item.city?.toLowerCase().includes(text) ||
        item.state?.toLowerCase().includes(text) ||
        item.vehicleMake?.toLowerCase().includes(text) ||
        item.vehicleModel?.toLowerCase().includes(text) ||
        item.id.toLowerCase().includes(text) ||
        item.userId?.toLowerCase().includes(text);

      return matchesFilter && matchesSearch;
    });
  }, [items, filter, search]);

  const pendingCount = items.filter((item) => !item.status || item.status === "pending").length;
  const reviewingCount = items.filter((item) => item.status === "reviewing").length;
  const approvedCount = items.filter((item) => item.status === "approved").length;
  const rejectedCount = items.filter((item) => item.status === "rejected").length;
  const highRiskCount = items.filter((item) => item.riskLevel === "high").length;

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

  function statusLabel(value?: VerificationStatus) {
    if (value === "approved") return "Approved";
    if (value === "rejected") return "Rejected";
    if (value === "reviewing") return "Reviewing";
    return "Pending";
  }

  function riskScore(item: DriverVerification) {
    let score = 20;

    if (!item.licenseUrl) score += 25;
    if (!item.insuranceUrl) score += 20;
    if (!item.vehiclePhotoUrl) score += 15;
    if (!item.selfieUrl) score += 10;
    if (item.status === "rejected") score += 15;
    if (item.riskLevel === "high") score += 25;
    if (item.riskLevel === "medium") score += 12;

    return Math.min(score, 100);
  }

  function calculatedRisk(item: DriverVerification) {
    const score = riskScore(item);

    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  async function updateVerification(
    item: DriverVerification,
    updates: Partial<DriverVerification>
  ) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "driverVerifications", item.id),
        {
          ...updates,
          updatedAt: now,
          reviewedAt:
            updates.status === "approved" || updates.status === "rejected"
              ? now
              : item.reviewedAt || "",
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `verification-${item.id}-${Date.now()}`),
        {
          userId: item.userId || "",
          userEmail: item.userEmail || "",
          action: `Driver verification ${updates.status || "updated"}`,
          targetId: item.id,
          targetType: "driverVerification",
          details: updates.rejectionReason || updates.notes || "Verification queue action.",
          severity:
            updates.status === "rejected"
              ? "warning"
              : updates.status === "approved"
              ? "success"
              : "info",
          createdAt: now,
        },
        { merge: true }
      );

      if (item.userId && updates.status) {
        await addDoc(collection(db, "notifications"), {
          userId: item.userId,
          type: "verification",
          title:
            updates.status === "approved"
              ? "Driver Verification Approved"
              : updates.status === "rejected"
              ? "Driver Verification Rejected"
              : "Driver Verification Update",
          message:
            updates.status === "approved"
              ? "Your RoadLink driver verification was approved."
              : updates.status === "rejected"
              ? `Your driver verification was rejected. ${updates.rejectionReason || ""}`
              : "Your driver verification is being reviewed.",
          read: false,
          createdAt: now,
          actionUrl: "/profile",
        });
      }

      if (item.userId && updates.status === "approved") {
        await setDoc(
          doc(db, "users", item.userId),
          {
            verified: true,
            driverVerified: true,
            licenseVerified: true,
            verificationStatus: "approved",
            updatedAt: now,
          },
          { merge: true }
        );
      }

      if (item.userId && updates.status === "rejected") {
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
      }

      setMessage("Verification updated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function approveSelected() {
    if (!selected) return;

    await updateVerification(selected, {
      status: "approved",
      licenseStatus: "approved",
      insuranceStatus: "approved",
      vehicleStatus: "approved",
      riskLevel: calculatedRisk(selected),
      notes: adminNote.trim(),
      rejectionReason: "",
    });
  }

  async function rejectSelected() {
    if (!selected) return;

    if (!rejectionReason.trim()) {
      setMessage("Please write a rejection reason first.");
      return;
    }

    await updateVerification(selected, {
      status: "rejected",
      riskLevel: calculatedRisk(selected),
      notes: adminNote.trim(),
      rejectionReason: rejectionReason.trim(),
    });
  }

  async function markReviewing() {
    if (!selected) return;

    await updateVerification(selected, {
      status: "reviewing",
      riskLevel: calculatedRisk(selected),
      notes: adminNote.trim(),
    });
  }

  async function saveNotes() {
    if (!selected) return;

    await updateVerification(selected, {
      notes: adminNote.trim(),
      rejectionReason: rejectionReason.trim(),
      riskLevel: calculatedRisk(selected),
    });
  }

  async function approveAllPending() {
    const confirmApprove = window.confirm(
      "Approve all pending verifications in the current queue?"
    );

    if (!confirmApprove) return;

    const pending = filteredItems.filter((item) => !item.status || item.status === "pending");

    if (pending.length === 0) {
      setMessage("No pending verifications to approve.");
      return;
    }

    try {
      setLoadingId("bulk");
      setMessage("");

      await Promise.all(
        pending.map((item) =>
          updateVerification(item, {
            status: "approved",
            licenseStatus: "approved",
            insuranceStatus: "approved",
            vehicleStatus: "approved",
            riskLevel: calculatedRisk(item),
            notes: item.notes || "Bulk approved from verification queue.",
            rejectionReason: "",
          })
        )
      );

      setMessage(`${pending.length} verification(s) approved.`);
    } finally {
      setLoadingId("");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/verifications" className="miniButton">Verifications</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Verification <span>Queue</span></h1>
            <p className="subtitle">
              Review driver documents, approve vehicles, manage license and insurance checks,
              notify users, and protect RoadLink before drivers publish rides.
            </p>
          </div>

          <div className="heroIcon">🛡️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📥" label="Total" value={String(items.length)} />
          <Metric icon="⏳" label="Pending" value={String(pendingCount)} />
          <Metric icon="🔎" label="Reviewing" value={String(reviewingCount)} />
          <Metric icon="✅" label="Approved" value={String(approvedCount)} />
          <Metric icon="❌" label="Rejected" value={String(rejectedCount)} />
          <Metric icon="🚨" label="High Risk" value={String(highRiskCount)} danger={highRiskCount > 0} />
        </section>

        <section className="filtersCard">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, phone, city, vehicle, UID..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | VerificationStatus)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button onClick={approveAllPending} disabled={loadingId === "bulk"}>
            {loadingId === "bulk" ? "Working..." : "Approve Pending"}
          </button>
        </section>

        <section className="adminGrid">
          <section className="queueCard">
            <p className="eyebrow">Queue</p>
            <h2>Driver Applications</h2>

            {filteredItems.length === 0 ? (
              <div className="empty">
                <h3>No verifications found</h3>
                <p>Driver verification requests will appear here.</p>
              </div>
            ) : (
              <div className="queueList">
                {filteredItems.map((item) => {
                  const risk = calculatedRisk(item);

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={selected?.id === item.id ? "queueRow activeQueue" : "queueRow"}
                    >
                      <div className={`queueIcon ${risk}`}>
                        {risk === "high" ? "🚨" : risk === "medium" ? "⚠️" : "🛡️"}
                      </div>

                      <div className="queueInfo">
                        <strong>{item.name || item.userEmail || "Driver Applicant"}</strong>
                        <span>{item.userEmail || "No email"}</span>
                        <small>
                          {item.vehicleYear || "Year"} {item.vehicleMake || "Vehicle"}{" "}
                          {item.vehicleModel || ""}
                        </small>
                      </div>

                      <em className={`status ${item.status || "pending"}`}>
                        {statusLabel(item.status)}
                      </em>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Driver</p>
                    <h2>{selected.name || "Driver Applicant"}</h2>
                    <p className="email">{selected.userEmail || "No email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "pending"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`riskBox ${calculatedRisk(selected)}`}>
                  <span>Risk Score</span>
                  <strong>{riskScore(selected)}/100</strong>
                  <p>
                    {calculatedRisk(selected) === "high"
                      ? "High risk. Review documents carefully before approval."
                      : calculatedRisk(selected) === "medium"
                      ? "Medium risk. Some information may be missing."
                      : "Low risk. Application appears complete."}
                  </p>
                </div>

                <div className="documentGrid">
                  <DocumentCard title="Driver License" url={selected.licenseUrl} status={selected.licenseStatus} />
                  <DocumentCard title="Insurance" url={selected.insuranceUrl} status={selected.insuranceStatus} />
                  <DocumentCard title="Vehicle Photo" url={selected.vehiclePhotoUrl} status={selected.vehicleStatus} />
                  <DocumentCard title="Selfie" url={selected.selfieUrl} status={selected.status} />
                </div>

                <div className="infoGrid">
                  <Info label="Verification ID" value={selected.id} />
                  <Info label="User ID" value={selected.userId || "Not available"} />
                  <Info label="Email" value={selected.userEmail || "Not available"} />
                  <Info label="Phone" value={selected.phone || "Not available"} />
                  <Info label="Location" value={`${selected.city || ""}${selected.city && selected.state ? ", " : ""}${selected.state || ""}` || "Not available"} />
                  <Info label="Vehicle" value={`${selected.vehicleYear || ""} ${selected.vehicleMake || ""} ${selected.vehicleModel || ""}` || "Not available"} />
                  <Info label="Submitted" value={dateText(selected.submittedAt || selected.createdAt)} />
                  <Info label="Reviewed" value={dateText(selected.reviewedAt)} />
                </div>

                <label>Admin Notes</label>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Internal admin notes..."
                />

                <label>Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Write rejection reason if needed..."
                />

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={markReviewing}
                    disabled={loadingId === selected.id}
                  >
                    Reviewing
                  </button>

                  <button
                    className="saveButton"
                    onClick={saveNotes}
                    disabled={loadingId === selected.id}
                  >
                    Save Notes
                  </button>

                  <button
                    className="approveButton"
                    onClick={approveSelected}
                    disabled={loadingId === selected.id}
                  >
                    Approve
                  </button>

                  <button
                    className="rejectButton"
                    onClick={rejectSelected}
                    disabled={loadingId === selected.id}
                  >
                    Reject
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a verification</h3>
                <p>Choose an application to review documents.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
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
        .filtersCard,
        .queueCard,
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
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
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
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

        .metricValue { font-size: 24px; font-weight: 900; }

        .filtersCard {
          display: grid;
          grid-template-columns: 1fr 220px auto;
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
        }

        select option { color: black; }

        .filtersCard button {
          padding: 0 18px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .queueCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .queueList {
          display: grid;
          gap: 12px;
        }

        .queueRow {
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

        .activeQueue {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .queueIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .queueIcon.low {
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .queueIcon.medium {
          background: rgba(250,204,21,0.13);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .queueIcon.high {
          background: rgba(239,68,68,0.13);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .queueInfo {
          min-width: 0;
        }

        .queueInfo strong,
        .queueInfo span,
        .queueInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .queueInfo span,
        .queueInfo small {
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

        .status.reviewing,
        .statusPill.reviewing {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
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

        .riskBox {
          padding: 20px;
          border-radius: 22px;
          margin-bottom: 20px;
        }

        .riskBox.low {
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .riskBox.medium {
          background: rgba(250,204,21,0.1);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .riskBox.high {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .riskBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .riskBox strong {
          color: #22c55e;
          font-size: 42px;
          font-weight: 900;
        }

        .riskBox p {
          color: #e5e7eb;
          margin-bottom: 0;
          line-height: 1.5;
        }

        .documentGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .docCard {
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .docCard strong,
        .docCard span {
          display: block;
        }

        .docCard span {
          color: #a1a1aa;
          margin: 6px 0 12px;
          font-size: 13px;
          font-weight: 900;
        }

        .docCard a {
          display: inline-flex;
          padding: 10px 14px;
          border-radius: 999px;
          color: white;
          text-decoration: none;
          background: rgba(34,197,94,0.16);
          border: 1px solid rgba(34,197,94,0.35);
          font-weight: 900;
          font-size: 13px;
        }

        .missingDoc {
          color: #fca5a5;
          font-weight: 900;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 18px;
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

        label {
          display: block;
          color: #e5e7eb;
          font-weight: 900;
          margin: 12px 0 8px;
        }

        textarea {
          min-height: 100px;
          resize: vertical;
          font-family: Arial, sans-serif;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 16px;
        }

        .reviewButton,
        .saveButton,
        .approveButton,
        .rejectButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .reviewButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .saveButton {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .rejectButton {
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

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
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
          .filtersCard,
          .documentGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .queueCard,
          .detailsCard {
            padding: 24px;
          }

          .queueRow {
            grid-template-columns: 46px 1fr;
          }

          .queueRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .queueIcon {
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
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
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

function DocumentCard({
  title,
  url,
  status,
}: {
  title: string;
  url?: string;
  status?: VerificationStatus;
}) {
  return (
    <div className="docCard">
      <strong>{title}</strong>
      <span>{status ? status.toUpperCase() : "PENDING"}</span>

      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          Open Document
        </a>
      ) : (
        <p className="missingDoc">Missing document</p>
      )}
    </div>
  );
  }
