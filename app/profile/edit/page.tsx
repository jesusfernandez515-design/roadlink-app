"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db, storage } from "../../../lib/firebase";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

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
  const [previewURL, setPreviewURL] = useState("");
  const [message, setMessage] = useState("Loading profile...");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const initials = useMemo(() => {
    const parts = name.trim().split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts[1]?.[0] || "";
    return `${first}${second}`.toUpperCase() || userEmail[0]?.toUpperCase() || "R";
  }, [name, userEmail]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to edit your profile.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const data = userSnap.data() as UserProfile | undefined;
        const savedPhoto = data?.photoURL || user.photoURL || "";

        setName(data?.name || user.displayName || "RoadLink User");
        setBio(data?.bio || "");
        setCity(data?.city || "");
        setStateValue(data?.state || "");
        setPhotoURL(savedPhoto);
        setPreviewURL(savedPhoto);
        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  function uploadPhoto(file: File) {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image is too large. Please choose an image under 5MB.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setMessage("");

    const localPreview = URL.createObjectURL(file);
    setPreviewURL(localPreview);

    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `profile-photos/${userId}/profile-${Date.now()}.${extension}`;
    const photoRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(photoRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(percent);
      },
      (error) => {
        setUploading(false);
        setProgress(0);
        setMessage(error.message || "Upload failed. Check Firebase Storage rules.");
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);

          setPhotoURL(url);
          setPreviewURL(url);

          await setDoc(
            doc(db, "users", userId),
            {
              photoURL: url,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          if (auth.currentUser) {
            await updateProfile(auth.currentUser, { photoURL: url });
          }

          setMessage("Photo uploaded successfully.");
        } catch (error: unknown) {
          setMessage(error instanceof Error ? error.message : "Could not save uploaded photo.");
        } finally {
          setUploading(false);
          setProgress(0);
        }
      }
    );
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
          email: userEmail,
          bio: bio.trim(),
          city: city.trim(),
          state: stateValue.trim(),
          photoURL: photoURL.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name.trim() || "RoadLink User",
          photoURL: photoURL.trim() || null,
        });
      }

      setPreviewURL(photoURL.trim());
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

        <section className="photoPanel">
          <div className="avatarWrap">
            {previewURL ? (
              <img
                src={previewURL}
                alt="Profile photo"
                className="avatarImage"
                onError={() => setPreviewURL("")}
              />
            ) : (
              <div className="avatarFallback">{initials}</div>
            )}
          </div>

          <div className="photoActions">
            <label htmlFor="photoUpload" className="uploadButton">
              {uploading ? `Uploading ${progress}%` : "Choose Photo"}
            </label>

            <input
              id="photoUpload"
              className="hiddenFile"
              type="file"
              accept="image/*"
              disabled={uploading || saving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadPhoto(file);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              className="removeButton"
              onClick={() => {
                setPhotoURL("");
                setPreviewURL("");
                setMessage("Photo removed. Save profile to confirm.");
              }}
              disabled={uploading || saving}
            >
              Remove
            </button>
          </div>

          {uploading && (
            <div className="progressBar">
              <div style={{ width: `${progress}%` }} />
            </div>
          )}

          <p className="photoHint">Use JPG, PNG or WEBP under 5MB.</p>
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

        <label>Photo URL</label>
        <input
          value={photoURL}
          placeholder="https://..."
          onChange={(event) => {
            setPhotoURL(event.target.value);
            setPreviewURL(event.target.value);
          }}
        />

        <button onClick={saveProfile} disabled={saving || uploading} className="saveButton">
          {uploading ? `Uploading ${progress}%` : saving ? "Saving..." : "Save Profile"}
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
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          overflow: hidden;
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
          font-size: 54px;
          line-height: 0.95;
          margin: 0 0 14px;
          letter-spacing: -1px;
        }

        h1 span {
          color: #22c55e;
          display: block;
        }

        .subtitle {
          color: #a1a1aa;
          margin: 0 0 24px;
          font-size: 18px;
          line-height: 1.45;
        }

        .photoPanel {
          display: grid;
          justify-items: center;
          gap: 16px;
          padding: 24px;
          margin: 0 0 24px;
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
          background: rgba(34,197,94,0.13);
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
          background: #020617;
        }

        .avatarFallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 52px;
          font-weight: 900;
        }

        .photoActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .uploadButton,
        .removeButton {
          padding: 12px 18px;
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

        .progressBar {
          width: 100%;
          height: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .progressBar div {
          height: 100%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .photoHint {
          margin: 0;
          color: #a1a1aa;
          font-size: 13px;
          text-align: center;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 0 0 16px;
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

        .saveButton:disabled,
        .removeButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .card {
            padding: 24px;
            border-radius: 30px;
          }

          h1 {
            font-size: 42px;
          }

          .avatarWrap {
            width: 142px;
            height: 142px;
          }

          .avatarFallback {
            font-size: 46px;
          }

          .miniButton {
            flex: 1;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
          }
