"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebase";

type VerificationStatus = "not_started" | "pending" | "approved" | "rejected";

type DriverVerification = {
  id?: string;
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
  name?: string;
  email?: string;
  phone?: string;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  verified?: boolean;
};

export default function DriverVerificationPage() {
  const router = useRouter();

  const licenseInputRef = useRef<HTMLInputElement | null>(null);
  const insuranceInputRef = useRef<HTMLInputElement | null>(null);
  const registrationInputRef = useRef<HTMLInputElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verificationId, setVerificationId] = useState("");
  const [verification, setVerification] = useState<DriverVerification | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");

  const [licenseUrl, setLicenseUrl] = useState("");
  const [insuranceUrl, setInsuranceUrl] = useState("");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  const [status, setStatus] = useState("Loading verification...");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeVerification: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("Please sign in to verify your driver account.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.data() as UserProfile | undefined;
          setProfile(data || null);
          setFullName((current) => current || data?.name || "");
          setPhone((current) => current || data?.phone || "");
        },
        (error) => setStatus(error.message)
      );

      const verificationQuery = query(
        collection(db, "driverVerifications"),
        where("userId", "==", user.uid)
      );

      unsubscribeVerification = onSnapshot(
        verificationQuery,
        (snapshot) => {
          if (snapshot.empty) {
            setVerification(null);
            setVerificationId("");
            setStatus("");
            return;
          }

          const document = snapshot.docs[0];
          const data = {
            id: document.id,
            ...document.data(),
          } as DriverVerification;

          setVerification(data);
          setVerificationId(document.id);

          setFullName(data.fullName || "");
          setPhone(data.phone || "");
          setLicenseNumber(data.licenseNumber || "");
          setLicenseState(data.licenseState || "");
          setVehicleMake(data.vehicleMake || "");
          setVehicleModel(data.vehicleModel || "");
          setVehicleYear(data.vehicleYear || "");
          setPlateNumber(data.plateNumber || "");
          setInsuranceProvider(data.insuranceProvider || "");
          setLicenseUrl(data.licenseUrl || "");
          setInsuranceUrl(data.insuranceUrl || "");
          setRegistrationUrl(data.registrationUrl || "");
          setSelfieUrl(data.selfieUrl || "");

          setStatus("");
        },
        (error) => setStatus(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeVerification) unsubscribeVerification();
    };
  }, [router]);

  const verificationStatus: VerificationStatus =
    verification?.status ||
    (profile?.driverVerified || profile?.licenseVerified ? "approved" : "not_started");

  const completion = useMemo(() => {
    const checks = [
      Boolean(fullName.trim()),
      Boolean(phone.trim()),
      Boolean(licenseNumber.trim()),
      Boolean(licenseState.trim()),
      Boolean(vehicleMake.trim()),
      Boolean(vehicleModel.trim()),
      Boolean(vehicleYear.trim()),
      Boolean(plateNumber.trim()),
      Boolean(insuranceProvider.trim()),
      Boolean(licenseUrl),
      Boolean(insuranceUrl),
      Boolean(registrationUrl),
      Boolean(selfieUrl),
    ];

    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [
    fullName,
    phone,
    licenseNumber,
    licenseState,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    plateNumber,
    insuranceProvider,
    licenseUrl,
    insuranceUrl,
    registrationUrl,
    selfieUrl,
  ]);

  function statusLabel(value: VerificationStatus) {
    if (value === "approved") return "Approved";
    if (value === "pending") return "Pending Review";
    if (value === "rejected") return "Rejected";
    return "Not Started";
  }

  function statusIcon(value: VerificationStatus) {
    if (value === "approved") return "✅";
    if (value === "pending") return "🟡";
    if (value === "rejected") return "🔴";
    return "📝";
  }

  async function uploadDocument(file: File, field: "licenseUrl" | "insuranceUrl" | "registrationUrl" | "selfieUrl") {
    if (!userId) {
      setStatus("Please sign in first.");
      return;
    }

    try {
      setUploading(field);
      setStatus("");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `driverVerifications/${userId}/${field}_${Date.now()}_${safeName}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      if (field === "licenseUrl") setLicenseUrl(url);
      if (field === "insuranceUrl") setInsuranceUrl(url);
      if (field === "registrationUrl") setRegistrationUrl(url);
      if (field === "selfieUrl") setSelfieUrl(url);

      await saveDraft({ [field]: url });

      setStatus("Document uploaded.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not upload document.");
    } finally {
      setUploading("");
    }
  }

  async function saveDraft(extra: Partial<DriverVerification> = {}) {
    if (!userId) return;

    const now = new Date().toISOString();

    const payload: DriverVerification = {
      userId,
      email: userEmail,
      fullName: fullName.trim(),
      phone: phone.trim(),
      licenseNumber: licenseNumber.trim(),
      licenseState: licenseState.trim(),
      vehicleMake: vehicleMake.trim(),
      vehicleModel: vehicleModel.trim(),
      vehicleYear: vehicleYear.trim(),
      plateNumber: plateNumber.trim(),
      insuranceProvider: insuranceProvider.trim(),
      status: verification?.status || "not_started",
      licenseUrl,
      insuranceUrl,
      registrationUrl,
      selfieUrl,
      updatedAt: now,
      createdAt: verification?.createdAt || now,
      ...extra,
    };

    if (verificationId) {
      await updateDoc(doc(db, "driverVerifications", verificationId), payload);
    } else {
      const created = await addDoc(collection(db, "driverVerifications"), payload);
      setVerificationId(created.id);
    }
  }

  async function handleSaveDraft() {
    try {
      setSaving(true);
      setStatus("");
      await saveDraft();
      setStatus("Draft saved.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function submitVerification() {
    if (!userId) return;

    if (completion < 100) {
      setStatus("Complete all fields and upload all required documents before submitting.");
      return;
    }

    try {
      setSaving(true);
      setStatus("");

      const now = new Date().toISOString();

      await saveDraft({
        status: "pending",
        submittedAt: now,
        updatedAt: now,
      });

      await setDoc(
        doc(db, "users", userId),
        {
          driverVerificationStatus: "pending",
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "verification",
        title: "Driver Verification Submitted",
        message: "Your driver verification was submitted for review.",
        read: false,
        createdAt: now,
        actionUrl: "/driver-verification",
      });

      setStatus("Verification submitted for review.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not submit verification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/profile" className="navButton">Profile</Link>
          <Link href="/driver-profile" className="navButton">Driver Profile</Link>
          <Link href="/wallet" className="navButton">Wallet</Link>
          <Link href="/admin-console" className="navButton">Admin</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Trust & Safety</p>
            <h1>Driver <span>Verification</span></h1>
            <p className="subtitle">
              Submit your license, insurance, vehicle registration and identity selfie for premium driver verification.
            </p>
          </div>

          <div className={`statusOrb ${verificationStatus}`}>
            <strong>{statusIcon(verificationStatus)}</strong>
            <span>{statusLabel(verificationStatus)}</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="📋" label="Completion" value={`${completion}%`} />
          <Metric icon="🛡️" label="Status" value={statusLabel(verificationStatus)} />
          <Metric icon="🚘" label="Vehicle" value={vehicleMake || "Pending"} />
          <Metric icon="📄" label="Documents" value={`${[licenseUrl, insuranceUrl, registrationUrl, selfieUrl].filter(Boolean).length}/4`} />
        </section>

        <section className="progressCard">
          <div className="progressHeader">
            <div>
              <p className="eyebrow">Verification Progress</p>
              <h2>{completion}% Complete</h2>
            </div>

            <div className="progressPill">{statusLabel(verificationStatus)}</div>
          </div>

          <div className="bar">
            <div style={{ width: `${completion}%` }} />
          </div>

          {verification?.rejectionReason && (
            <div className="rejection">
              <strong>Rejection reason</strong>
              <p>{verification.rejectionReason}</p>
            </div>
          )}
        </section>

        <section className="grid">
          <section className="card">
            <p className="eyebrow">Personal Information</p>
            <h2>Driver Details</h2>

            <Field label="Full Name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full legal name" />
            </Field>

            <Field label="Phone Number">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            </Field>

            <Field label="License Number">
              <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="Driver license number" />
            </Field>

            <Field label="License State">
              <input value={licenseState} onChange={(e) => setLicenseState(e.target.value)} placeholder="PR, FL, CA..." />
            </Field>
          </section>

          <section className="card">
            <p className="eyebrow">Vehicle Information</p>
            <h2>Vehicle Details</h2>

            <Field label="Vehicle Make">
              <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="Toyota, Nissan, Honda..." />
            </Field>

            <Field label="Vehicle Model">
              <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Camry, Altima..." />
            </Field>

            <Field label="Vehicle Year">
              <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} placeholder="2020" inputMode="numeric" />
            </Field>

            <Field label="Plate Number">
              <input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ABC-123" />
            </Field>

            <Field label="Insurance Provider">
              <input value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} placeholder="Insurance company" />
            </Field>
          </section>
        </section>

        <section className="documents">
          <p className="eyebrow">Required Documents</p>
          <h2>Upload Files</h2>

          <input ref={licenseInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], "licenseUrl")} />
          <input ref={insuranceInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], "insuranceUrl")} />
          <input ref={registrationInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], "registrationUrl")} />
          <input ref={selfieInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], "selfieUrl")} />

          <div className="docGrid">
            <DocCard title="Driver License" icon="🪪" url={licenseUrl} loading={uploading === "licenseUrl"} onClick={() => licenseInputRef.current?.click()} />
            <DocCard title="Insurance" icon="🛡️" url={insuranceUrl} loading={uploading === "insuranceUrl"} onClick={() => insuranceInputRef.current?.click()} />
            <DocCard title="Vehicle Registration" icon="📄" url={registrationUrl} loading={uploading === "registrationUrl"} onClick={() => registrationInputRef.current?.click()} />
            <DocCard title="Identity Selfie" icon="🤳" url={selfieUrl} loading={uploading === "selfieUrl"} onClick={() => selfieInputRef.current?.click()} />
          </div>
        </section>

        <section className="actionsPanel">
          <button onClick={handleSaveDraft} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </button>

          <button className="submitButton" onClick={submitVerification} disabled={saving || verificationStatus === "approved"}>
            {saving ? "Submitting..." : verificationStatus === "approved" ? "Already Approved" : "Submit Verification"}
          </button>
        </section>
      </section>

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
        }

        .hero,
        .metric,
        .progressCard,
        .card,
        .documents,
        .actionsPanel {
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
        .metricValue,
        .statusOrb strong {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          max-width: 720px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .statusOrb {
          min-width: 130px;
          height: 130px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
          text-align: center;
        }

        .statusOrb strong {
          font-size: 34px;
        }

        .statusOrb span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
          margin-top: 5px;
        }

        .statusOrb.pending {
          background: rgba(234,179,8,0.12);
          border-color: rgba(234,179,8,0.4);
        }

        .statusOrb.rejected {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.4);
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

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .progressCard,
        .card,
        .documents,
        .actionsPanel {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        .progressHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
        }

        .progressPill {
          padding: 10px 15px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .bar {
          height: 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .rejection {
          margin-top: 18px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .rejection strong {
          color: #fca5a5;
        }

        .rejection p {
          color: #fecaca;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        label {
          display: block;
          color: #e5e7eb;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .field {
          margin-bottom: 16px;
        }

        input {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        input:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        .hidden {
          display: none;
        }

        .docGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .docCard {
          text-align: left;
          padding: 18px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
        }

        .docCard.uploaded {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.45);
        }

        .docIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.3);
          font-size: 25px;
          margin-bottom: 14px;
        }

        .docCard strong {
          display: block;
          font-size: 16px;
          margin-bottom: 8px;
        }

        .docCard span {
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
        }

        .actionsPanel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        button {
          border: none;
          border-radius: 999px;
          padding: 16px 18px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .submitButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .stats,
          .grid,
          .docGrid,
          .actionsPanel {
            grid-template-columns: 1fr;
          }

          .hero,
          .progressHeader {
            flex-direction: column;
            align-items: flex-start;
          }

          h1 {
            font-size: 44px;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .progressCard,
          .card,
          .documents,
          .actionsPanel {
            padding: 22px;
            border-radius: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
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

function DocCard({
  title,
  icon,
  url,
  loading,
  onClick,
}: {
  title: string;
  icon: string;
  url: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={url ? "docCard uploaded" : "docCard"}
      onClick={onClick}
      disabled={loading}
    >
      <div className="docIcon">{icon}</div>
      <strong>{title}</strong>
      <span>{loading ? "Uploading..." : url ? "Uploaded ✓" : "Tap to upload"}</span>
    </button>
  );
    }
