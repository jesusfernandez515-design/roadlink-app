"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  state?: string;
};

export default function EditProfilePage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [message, setMessage] = useState("Loading profile...");
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  const initials = useMemo(() => {
    const parts = name.trim().split(" ").filter(Boolean);
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "R";
  }, [name]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to edit your profile.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() as UserProfile | undefined;

      setName(data?.name || user.displayName || "RoadLink User");
      setBio(data?.bio || "");
      setCity(data?.city || "");
      setStateValue(data?.state || "");
      setPhotoURL(data?.photoURL || user.photoURL || "");
      setMessage("");
    });

    return () => unsubscribe();
  }, []);

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxSize = 500;
          const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);

          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not process image."));
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        };

        img.onerror = () => reject(new Error("Invalid image."));
        img.src = String(reader.result);
      };

      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
  }

  async function handlePhoto(file: File) {
    try {
      setProcessing(true);
      setMessage("");

      if (!file.type.startsWith("image/")) {
        setMessage("Please choose a valid image.");
        return;
      }

      const imageData = await resizeImage(file);
      setPhotoURL(imageData);
      setMessage("Photo ready. Press Save Profile.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Photo failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function saveProfile() {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const finalName = name.trim() || "RoadLink User";

      await setDoc(
        doc(db, "users", userId),
        {
          name: finalName,
          email: userEmail,
          bio: bio.trim(),
          city: city.trim(),
          state: stateValue.trim(),
          photoURL,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: finalName,
          photoURL: photoURL || null,
        });
      }

      setMessage("Profile saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="topNav">
          <Link href="/profile" className="miniButton">Back to Profile</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <p className="eyebrow">Edit Profile</p>
        <h1>Identity & <span>Photo</span></h1>
        <p className="subtitle">Update your public RoadLink profile information.</p>

        <section className="photoPanel">
          <div className="avatarWrap">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="avatarImage" />
            ) : (
              <div className="avatarFallback">{initials}</div>
            )}
          </div>

          <label htmlFor="photoUpload" className="uploadButton">
            {processing ? "Processing..." : "Choose Photo"}
          </label>

          <input
            id="photoUpload"
            className="hiddenFile"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handlePhoto(file);
              event.target.value = "";
            }}
          />

          <button
            type="button"
            className="removeButton"
            onClick={() => {
              setPhotoURL("");
              setMessage("Photo removed. Press Save Profile.");
            }}
          >
            Remove
          </button>
        </section>

        {message && <p className="message">{message}</p>}

        <label>Display Name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} />

        <label>Bio</label>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} />

        <label>City</label>
        <input value={city} onChange={(event) => setCity(event.target.value)} />

        <label>State</label>
        <input value={stateValue} onChange={(event) => setStateValue(event.target.value)} />

        <button onClick={saveProfile} disabled={saving || processing} className="saveButton">
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(34,197,94,0.22), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 20px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 720px;
          margin: auto;
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        }

        .topNav {
          display: flex;
          gap: 10px;
          margin-bottom: 28px;
        }

        .miniButton {
          flex: 1;
          text-align: center;
          padding: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .eyebrow {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 10px;
        }

        h1 {
          font-size: 52px;
          line-height: 0.95;
          margin: 0 0 14px;
        }

        h1 span {
          color: #22c55e;
          display: block;
        }

        .subtitle {
          color: #a1a1aa;
          margin-bottom: 24px;
          font-size: 18px;
          line-height: 1.45;
        }

        .photoPanel {
          display: grid;
          justify-items: center;
          gap: 14px;
          padding: 24px;
          margin-bottom: 24px;
          border-radius: 28px;
          background:
            radial-gradient(circle, rgba(34,197,94,0.18), transparent 55%),
            rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .avatarWrap {
          width: 158px;
          height: 158px;
          border-radius: 50%;
          padding: 5px;
          border: 2px solid rgba(34,197,94,0.55);
          box-shadow: 0 18px 70px rgba(34,197,94,0.35);
        }

        .avatarImage,
        .avatarFallback {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .avatarImage {
          object-fit: cover;
          display: block;
        }

        .avatarFallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-size: 52px;
          font-weight: 900;
        }

        .uploadButton,
        .removeButton {
          padding: 13px 20px;
          border-radius: 999px;
          font-weight: 900;
          cursor: pointer;
        }

        .uploadButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
        }

        .removeButton {
          border: 1px solid rgba(239,68,68,0.35);
          background: rgba(239,68,68,0.12);
          color: #fca5a5;
        }

        .hiddenFile {
          display: none;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 16px 0 8px;
        }

        input,
        textarea {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
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
        }

        @media (max-width: 640px) {
          .page { padding: 16px; padding-bottom: 140px; }
          .card { padding: 24px; border-radius: 30px; }
          h1 { font-size: 42px; }
        }
      `}</style>
    </main>
  );
        }
