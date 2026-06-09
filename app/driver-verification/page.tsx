"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebase";

type Verification = {
  userId?: string;
  email?: string;
  status?: "not_submitted" | "pending" | "approved" | "rejected";
  governmentIdURL?: string;
  driverLicenseURL?: string;
  insuranceURL?: string;
  vehiclePhotoURL?: string;
  submittedAt?: string;
  updatedAt?: string;
};

export default function DriverVerificationPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [verification, setVerification] = useState<Verification>({
    status: "not_submitted",
  });
  const [message, setMessage] = useState("Loading verification...");
  const [uploading, setUploading] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to verify your driver profile.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      try {
        const verificationRef = doc(db, "driverVerifications", user.uid);
        const verificationSnap = await getDoc(verificationRef);

        if (verificationSnap.exists()) {
          setVerification(verificationSnap.data() as Verification);
        } else {
          setVerification({
            userId: user.uid,
            email: user.email || "",
            status: "not_submitted",
          });
        }

        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  async function uploadVerificationFile(
    file: File,
    field:
      | "governmentIdURL"
      | "driverLicenseURL"
      | "insuranceURL"
      | "vehiclePhotoURL"
  ) {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    try {
      setUploading(field);
      setMessage("");

      const filePath = `driver-verifications/${userId}/${field}-${Date.now()}-${file.name}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, file);

      const downloadURL = await getDownloadURL(fileRef);
      const now = new Date().toISOString();

      const updatedVerification: Verification = {
        ...verification,
        userId,
        email: userEmail,
        status: verification.status || "not_submitted",
        [field]: downloadURL,
        updatedAt: now,
      };

      await setDoc(doc(db, "driverVerifications", userId), updatedVerification, {
        merge: true,
      });

      setVerification(updatedVerification);
      setMessage("File uploaded successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading("");
    }
  }

  async function submitVerification() {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    if (
      !verification.governmentIdURL ||
      !verification.driverLicenseURL ||
      !verification.insuranceURL ||
      !verification.vehiclePhotoURL
    ) {
      setMessage("Please upload all required files before submitting.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      const updatedVerification: Verification = {
        ...verification,
        userId,
        email: userEmail,
        status: "pending",
        submittedAt: verification.submittedAt || now,
        updatedAt: now,
      };

      await setDoc(doc(db, "driverVerifications", userId), updatedVerification, {
        merge: true,
      });

      await setDoc(
        doc(db, "users", userId),
        {
          verificationStatus: "pending",
          verified: false,
          licenseVerified: false,
          updatedAt: now,
        },
        { merge: true }
      );

      setVerification(updatedVerification);
      setMessage("Verification submitted successfully. RoadLink will review your documents.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const status = verification.status || "not_submitted";
  const completedCount = [
    verification.governmentIdURL,
    verification.driverLicenseURL,
    verification.insuranceURL,
    verification.vehiclePhotoURL,
  ].filter(Boolean).length;

  const progress = Math.round((completedCount / 4) * 100);

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/driver-profile" className="miniButton">Driver Profile</Link>
        </div>

        <section className="hero">
          <p className="eyebrow">RoadLink Driver Center</p>
          <h1>Driver <span>Verification</span></h1>
          <p className="subtitle">
            Complete your verification to start accepting rides and earning money through RoadLink.
          </p>

          <div className="statusPill">{status.replace("_", " ").toUpperCase()}</div>

          <div className="progressBar">
            <div style={{ width: `${progress}%` }} />
          </div>

          <p className="progressText">{completedCount}/4 documents uploaded</p>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="grid">
          <UploadCard
            title="Government ID"
            description="Upload a clear photo of your government ID."
            icon="🪪"
            uploaded={Boolean(verification.governmentIdURL)}
            uploading={uploading === "governmentIdURL"}
            onChange={(file) => uploadVerificationFile(file, "governmentIdURL")}
          />

          <UploadCard
            title="Driver License"
            description="Upload your valid driver license."
            icon="🚘"
            uploaded={Boolean(verification.driverLicenseURL)}
            uploading={uploading === "driverLicenseURL"}
            onChange={(file) => uploadVerificationFile(file, "driverLicenseURL")}
          />

          <UploadCard
            title="Insurance"
            description="Upload proof of active vehicle insurance."
            icon="📄"
            uploaded={Boolean(verification.insuranceURL)}
            uploading={uploading === "insuranceURL"}
            onChange={(file) => uploadVerificationFile(file, "insuranceURL")}
          />

          <UploadCard
            title="Vehicle Photo"
            description="Upload a clear photo of the vehicle."
            icon="📸"
            uploaded={Boolean(verification.vehiclePhotoURL)}
            uploading={uploading === "vehiclePhotoURL"}
            onChange={(file) => uploadVerificationFile(file, "vehiclePhotoURL")}
          />
        </section>

        <section className="checklist">
          <p className="eyebrow">Final Step</p>
          <h2>Submit for Review</h2>

          <Checklist label="Government ID uploaded" done={Boolean(verification.governmentIdURL)} />
          <Checklist label="Driver license uploaded" done={Boolean(verification.driverLicenseURL)} />
          <Checklist label="Insurance uploaded" done={Boolean(verification.insuranceURL)} />
          <Checklist label="Vehicle photo uploaded" done={Boolean(verification.vehiclePhotoURL)} />

          <button className="submitButton" onClick={submitVerification} disabled={saving}>
            {saving ? "Submitting..." : "Submit Verification"}
          </button>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(34,197,94,0.2), transparent 32%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1000px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .uploadCard,
        .checklist {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 22px;
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
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2 {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          max-width: 650px;
        }

        .statusPill {
          display: inline-flex;
          margin-top: 18px;
          padding: 10px 15px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .progressBar {
          width: 100%;
          height: 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-top: 22px;
        }

        .progressBar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .progressText,
        .message {
          color: #22c55e;
          font-weight: 900;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .uploadCard,
        .checklist {
          border-radius: 28px;
          padding: 24px;
        }

        .uploadIcon {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(34,197,94,0.14);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin-bottom: 16px;
        }

        .uploadCard h3 {
          font-size: 24px;
          margin: 0 0 10px;
        }

        .uploadCard p,
        .checkRow span {
          color: #a1a1aa;
        }

        .uploadCard label {
          display: block;
          width: 100%;
          margin-top: 18px;
          padding: 15px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          text-align: center;
          cursor: pointer;
        }

        .uploadCard input {
          display: none;
        }

        .checkRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 12px;
        }

        .done {
          color: #22c55e;
        }

        .pending {
          color: #fca5a5;
        }

        .submitButton {
          width: 100%;
          margin-top: 18px;
          padding: 18px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 800px) {
          .page {
            padding: 16px;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function UploadCard({
  title,
  description,
  icon,
  uploaded,
  uploading,
  onChange,
}: {
  title: string;
  description: string;
  icon: string;
  uploaded: boolean;
  uploading: boolean;
  onChange: (file: File) => void;
}) {
  return (
    <div className="uploadCard">
      <div className="uploadIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{uploaded ? "Uploaded successfully." : description}</p>

      <label>
        {uploading ? "Uploading..." : uploaded ? "Replace File" : "Upload File"}
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onChange(file);
          }}
        />
      </label>
    </div>
  );
}

function Checklist({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="checkRow">
      <span>{label}</span>
      <strong className={done ? "done" : "pending"}>
        {done ? "Complete" : "Pending"}
      </strong>
    </div>
  );
  }
