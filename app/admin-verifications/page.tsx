"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type VerificationStatus = "not_started" | "pending" | "approved" | "rejected";

type DriverVerification = {
  id: string;
  userId?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  plateNumber?: string;
  insuranceProvider?: string;
  status?: VerificationStatus;
  licenseUrl?: string;
  insuranceUrl?: string;
  registrationUrl?: string;
  selfieUrl?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string;
};

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type FilterKey = "pending" | "approved" | "rejected" | "all";

export default function AdminVerificationsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [verifications, setVerifications] = useState<DriverVerification[]>([]);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [status, setStatus] = useState("Loading verification reviews...");
  const [savingId, setSavingId] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;
    let unsubscribeVerifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeUser = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const isAdmin =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          if (!isAdmin) {
            setStatus("Access denied. Admin account required.");
            return;
          }

          setStatus("");

          if (!unsubscribeVerifications) {
            unsubscribeVerifications = onSnapshot(
              query(collection(db, "driverVerifications")),
              (snapshotData) => {
                const data = snapshotData.docs.map((item) => ({
                  id: item.id,
                  ...item.data(),
                })) as DriverVerification[];

                data.sort((a, b) =>
                  String(b.submittedAt || b.createdAt || "").localeCompare(
                    String(a.submittedAt || a.createdAt || "")
                  )
                );

                setVerifications(data);
              },
              (error) => setStatus(error.message)
            );
          }
        },
        (error) => setStatus(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeVerifications) unsubscribeVerifications();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  const visibleVerifications = useMemo(() => {
    if (filter === "all") return verifications;
    return verifications.filter((item) => (item.status || "not_started") === filter);
  }, [filter, verifications]);

  const counts = useMemo(() => {
    return {
      all: verifications.length,
      pending: verifications.filter((item) => item.status === "pending").length,
      approved: verifications.filter((item) => item.status === "approved").length,
      rejected: verifications.filter((item) => item.status === "rejected").length,
      notStarted: verifications.filter((item) => !item.status || item.status === "not_started").length,
    };
  }, [verifications]);

  function formatDate(value?: string) {
    if (!value) return "Recently";

    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function statusIcon(value?: VerificationStatus) {
    if (value === "approved") return "✅";
    if (value === "pending") return "🟡";
    if (value === "rejected") return "🔴";
    return "📝";
  }

  function documentCount(item: DriverVerification) {
    return [item.licenseUrl, item.insuranceUrl, item.registrationUrl, item.selfieUrl].filter(Boolean).length;
  }

  async function approveVerification(item: DriverVerification) {
    if (!item.userId) {
      setStatus("Verification user ID is missing.");
      return;
    }

    try {
      setSavingId(item.id);
      setStatus("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "driverVerifications", item.id), {
        status: "approved",
        rejectionReason: "",
        approvedAt: now,
        updatedAt: now,
        reviewedBy: auth.currentUser?.uid || "",
        reviewedByEmail: auth.currentUser?.email || "",
      });

      await updateDoc(doc(db, "users", item.userId), {
        driverVerified: true,
        licenseVerified: true,
        verified: true,
        driverVerificationStatus: "approved",
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId: item.userId,
        type: "verification",
        title: "Driver Verification Approved",
        message: "Your RoadLink driver verification was approved.",
        read: false,
        createdAt: now,
        actionUrl: "/driver-verification",
      });

      setStatus("Driver verification approved.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not approve verification.");
    } finally {
      setSavingId("");
    }
  }

  async function rejectVerification(item: DriverVerification) {
    if (!item.userId) {
      setStatus("Verification user ID is missing.");
      return;
    }

    const reason = rejectionReasons[item.id]?.trim() || "Please review and resubmit your documents.";

    try {
      setSavingId(item.id);
      setStatus("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "driverVerifications", item.id), {
        status: "rejected",
        rejectionReason: reason,
        rejectedAt: now,
        updatedAt: now,
        reviewedBy: auth.currentUser?.uid || "",
        reviewedByEmail: auth.currentUser?.email || "",
      });

      await updateDoc(doc(db, "users", item.userId), {
        driverVerified: false,
        licenseVerified: false,
        driverVerificationStatus: "rejected",
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId: item.userId,
        type: "verification",
        title: "Driver Verification Rejected",
        message: reason,
        read: false,
        createdAt: now,
        actionUrl: "/driver-verification",
      });

      setStatus("Driver verification rejected.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not reject verification.");
    } finally {
      setSavingId("");
    }
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Verification <span>Review</span></h1>
          <p>{status || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>

        <PageStyles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/driver-verification" className="navButton">Driver Verification</Link>
          <Link href="/dashboard" className="navButton">Dashboard</Link>
          <Link href="/profile" className="navButton">Profile</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Trust & Safety</p>
            <h1>Verification <span>Review</span></h1>
            <p className="subtitle">
              Review driver licenses, insurance, vehicle registration and selfie identity documents.
            </p>
          </div>

          <div className="liveOrb">
            <strong>{counts.pending}</strong>
            <span>Pending</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="📋" label="All" value={String(counts.all)} />
          <Metric icon="🟡" label="Pending" value={String(counts.pending)} />
          <Metric icon="✅" label="Approved" value={String(counts.approved)} />
          <Metric icon="🔴" label="Rejected" value={String(counts.rejected)} />
        </section>

        <section className="filters">
          <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>
            🟡 Pending
          </button>
          <button className={filter === "approved" ? "active" : ""} onClick={() => setFilter("approved")}>
            ✅ Approved
          </button>
          <button className={filter === "rejected" ? "active" : ""} onClick={() => setFilter("rejected")}>
            🔴 Rejected
          </button>
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            🔎 All
          </button>
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Applications</p>
              <h2>{visibleVerifications.length} Verification Requests</h2>
            </div>
          </div>

          {visibleVerifications.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🛡️</div>
              <h3>No verification requests</h3>
              <p>Driver verification submissions will appear here.</p>
            </div>
          ) : (
            <div className="list">
              {visibleVerifications.map((item) => (
                <article key={item.id} className="verificationCard">
                  <div className="cardTop">
                    <div className="statusIcon">{statusIcon(item.status)}</div>

                    <div>
                      <h3>{item.fullName || item.email || "Driver Applicant"}</h3>
                      <p>{item.email || "No email"} · {item.phone || "No phone"}</p>
                      <small>
                        Status: {item.status || "not_started"} · Submitted: {formatDate(item.submittedAt || item.createdAt)}
                      </small>
                    </div>

                    <div className="docCount">
                      <strong>{documentCount(item)}/4</strong>
                      <span>Docs</span>
                    </div>
                  </div>

                  <div className="detailsGrid">
                    <Detail label="License" value={`${item.licenseState || "State"} · ${item.licenseNumber || "N/A"}`} />
                    <Detail label="Vehicle" value={`${item.vehicleYear || ""} ${item.vehicleMake || ""} ${item.vehicleModel || ""}`.trim() || "N/A"} />
                    <Detail label="Plate" value={item.plateNumber || "N/A"} />
                    <Detail label="Insurance" value={item.insuranceProvider || "N/A"} />
                  </div>

                  <div className="documentsGrid">
                    <DocumentLink title="License" url={item.licenseUrl} />
                    <DocumentLink title="Insurance" url={item.insuranceUrl} />
                    <DocumentLink title="Registration" url={item.registrationUrl} />
                    <DocumentLink title="Selfie" url={item.selfieUrl} />
                  </div>

                  {item.status === "rejected" && item.rejectionReason && (
                    <div className="rejectionBox">
                      <strong>Rejection reason</strong>
                      <p>{item.rejectionReason}</p>
                    </div>
                  )}

                  <textarea
                    value={rejectionReasons[item.id] || ""}
                    onChange={(event) =>
                      setRejectionReasons((previous) => ({
                        ...previous,
                        [item.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional rejection reason..."
                  />

                  <div className="actions">
                    <button
                      className="approveButton"
                      onClick={() => approveVerification(item)}
                      disabled={savingId === item.id || item.status === "approved"}
                    >
                      {savingId === item.id ? "Updating..." : "Approve"}
                    </button>

                    <button
                      className="rejectButton"
                      onClick={() => rejectVerification(item)}
                      disabled={savingId === item.id || item.status === "rejected"}
                    >
                      {savingId === item.id ? "Updating..." : "Reject"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <PageStyles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DocumentLink({ title, url }: { title: string; url?: string }) {
  if (!url) {
    return (
      <div className="document missing">
        <span>{title}</span>
        <strong>Missing</strong>
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="document">
      <span>{title}</span>
      <strong>Open</strong>
    </a>
  );
}

function PageStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 120px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
          radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1120px;
        margin: auto;
      }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        display: inline-flex;
        justify-content: center;
      }

      .hero,
      .metric,
      .filters,
      .panel,
      .verificationCard,
      .locked {
        background: rgba(8,13,25,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 35px;
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
      }

      .eyebrow {
        color: #22c55e;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 60px;
        line-height: 1;
      }

      h1 span,
      h2,
      .metric strong,
      .liveOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .locked p {
        color: #a1a1aa;
        max-width: 720px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .liveOrb {
        min-width: 120px;
        height: 120px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }

      .liveOrb strong {
        font-size: 34px;
      }

      .liveOrb span {
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 900;
      }

      .status {
        text-align: center;
        color: #22c55e;
        font-weight: 900;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric {
        padding: 18px;
        border-radius: 22px;
      }

      .metricIcon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .metric span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .metric strong {
        font-size: 24px;
      }

      .filters {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        border-radius: 26px;
        padding: 14px;
        margin-bottom: 20px;
      }

      button {
        border: none;
        border-radius: 999px;
        padding: 13px 15px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      button.active {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.4);
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
      }

      .sectionHeader {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: center;
        margin-bottom: 20px;
      }

      .list {
        display: grid;
        gap: 16px;
      }

      .verificationCard {
        border-radius: 26px;
        padding: 22px;
        box-shadow: none;
      }

      .cardTop {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 16px;
        align-items: center;
        margin-bottom: 16px;
      }

      .statusIcon {
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
      }

      .cardTop h3 {
        margin: 0 0 5px;
        font-size: 22px;
        overflow-wrap: anywhere;
      }

      .cardTop p,
      .cardTop small {
        color: #a1a1aa;
        margin: 0;
        overflow-wrap: anywhere;
      }

      .docCount {
        text-align: center;
        padding: 12px;
        border-radius: 18px;
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
      }

      .docCount strong {
        color: #22c55e;
        display: block;
        font-size: 24px;
      }

      .docCount span {
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
      }

      .detailsGrid,
      .documentsGrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
      }

      .detail,
      .document {
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .document {
        text-decoration: none;
      }

      .document.missing {
        opacity: 0.55;
      }

      .detail span,
      .document span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 5px;
      }

      .detail strong,
      .document strong {
        display: block;
        color: #e5e7eb;
        overflow-wrap: anywhere;
      }

      .document strong {
        color: #22c55e;
      }

      textarea {
        width: 100%;
        min-height: 90px;
        padding: 14px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 15px;
        outline: none;
        resize: vertical;
        font-family: Arial, sans-serif;
        margin-bottom: 14px;
      }

      .rejectionBox {
        padding: 14px;
        border-radius: 18px;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.35);
        margin-bottom: 14px;
      }

      .rejectionBox strong {
        color: #fca5a5;
      }

      .rejectionBox p {
        color: #fecaca;
        margin-bottom: 0;
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .approveButton {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
      }

      .rejectButton {
        background: linear-gradient(135deg, #ef4444, #b91c1c);
        border: none;
      }

      .empty {
        min-height: 260px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .emptyIcon {
        width: 82px;
        height: 82px;
        border-radius: 50%;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 38px;
        margin-bottom: 16px;
      }

      .empty p {
        color: #a1a1aa;
      }

      @media (max-width: 900px) {
        .stats,
        .filters,
        .detailsGrid,
        .documentsGrid {
          grid-template-columns: 1fr;
        }

        .hero,
        .sectionHeader {
          flex-direction: column;
          align-items: flex-start;
        }

        h1 {
          font-size: 44px;
        }

        .cardTop {
          grid-template-columns: 1fr;
        }

        .docCount {
          text-align: left;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel,
        .verificationCard {
          padding: 22px;
          border-radius: 26px;
        }

        .actions {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
        }
