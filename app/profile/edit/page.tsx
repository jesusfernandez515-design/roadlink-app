"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db, storage } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

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
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [message, setMessage] = useState("Loading profile...");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to edit your profile.");
        return;
      }

      setUserId(user.uid);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const data = userSnap.data() as UserProfile | undefined;

        setName(data?.name || user.displayName || "RoadLink User");
        setBio(data?.bio || "");
        setCity(data?.city || "");
        setStateValue(data?.state || "");
        setPhotoURL(data?.photoURL || user.photoURL || "");
        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  async function uploadPhoto(file: File) {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const filePath = `profile-photos/${userId}/${Date.now()}-${file.name}`;
      const photoRef = ref(storage, filePath);

      await uploadBytes(photoRef, file);

      const url = await getDownloadURL(photoRef);
      setPhotoURL(url);

      await setDoc(
        doc(db, "users", userId),
        {
          photoURL: url,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("Photo uploaded successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
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

      await setDoc(
        doc(db, "users", userId),
        {
          name: name.trim() || "RoadLink User",
          bio: bio.trim(),
          city: city.trim(),
          state: stateValue.trim(),
          photoURL: photoURL.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("Profile saved successfully.");
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
          <Link href="/profile" className="miniButton">Back to Profile</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <p className="eyebrow">Edit Profile</p>
        <h1>Identity & <span>Photo</span></h1>
        <p className="subtitle">Update your public RoadLink profile information.</p>

        {photoURL ? (
          <img src={photoURL} alt="Profile" className="avatarImage" />
        ) : (
          <div className="avatar">J</div>
        )}

        {message && <p className="message">{message}</p>}

        <label>Display Name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} />

        <label>Bio</label>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} />

        <label>City</label>
        <input value={city} onChange={(event) => setCity(event.target.value)} />

        <label>State</label>
        <input value={stateValue} onChange={(event) => setStateValue(event.target.value)} />

        <label>Upload Photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadPhoto(file);
          }}
        />

        <label>Photo URL</label>
        <input value={photoURL} onChange={(event) => setPhotoURL(event.target.value)} />

        <button onClick={saveProfile} disabled={saving || uploading} className="saveButton">
          {uploading ? "Uploading..." : saving ? "Saving..." : "Save Profile"}
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
          padding-bottom: 110px;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 720px;
          margin: auto;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
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
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 10px;
        }

        h1 {
          font-size: 44px;
          line-height: 1;
          margin: 0 0 12px;
        }

        h1 span {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          margin-bottom: 24px;
        }

        .avatar,
        .avatarImage {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          margin: 0 auto 24px;
          border: 2px solid rgba(34,197,94,0.5);
          box-shadow: 0 18px 60px rgba(34,197,94,0.35);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 52px;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
          display: block;
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
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}
