"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  role?: string;
  createdAt?: string;
  photoURL?: string;
};

export default function ProfilePage() {
  const [userId, setUserId] = useState("");

  const [profile, setProfile] = useState<UserProfile>({
    name: "RoadLink User",
    email: "",
    role: "member",
    photoURL: "",
  });

  const [nameInput, setNameInput] = useState("");
  const [photoInput, setPhotoInput] = useState("");

  const [bookedTrips, setBookedTrips] = useState(0);
  const [activeRides, setActiveRides] = useState(0);
  const [avatar, setAvatar] = useState("R");
  const [message, setMessage] = useState("Loading profile...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your profile.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      setUserId(user.uid);
      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        let finalProfile: UserProfile = {
          name: fallbackName,
          email: userEmail,
          role: "member",
          createdAt: new Date().toISOString(),
          photoURL: fallbackPhoto,
        };

        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;

          finalProfile = {
            name: userData.name || fallbackName,
            email: userData.email || userEmail,
            role: userData.role || "member",
            createdAt: userData.createdAt || "",
            photoURL: userData.photoURL || fallbackPhoto,
          };
        } else {
          await setDoc(userRef, finalProfile, { merge: true });
        }

        setProfile(finalProfile);
        setNameInput(finalProfile.name || "");
        setPhotoInput(finalProfile.photoURL || "");

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("passengerEmail", "==", userEmail),
          where("status", "==", "reserved")
        );

        const bookingsSnapshot = await getDocs(bookingsQuery);
        setBookedTrips(bookingsSnapshot.size);

        const ridesQuery = query(
          collection(db, "rides"),
          where("driverEmail", "==", userEmail),
          where("status", "==", "active")
        );

        const ridesSnapshot = await getDocs(ridesQuery);
        setActiveRides(ridesSnapshot.size);

        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  async function saveProfile() {
    if (!userId) {
      setMessage("Please sign in to update your profile.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const updatedProfile: UserProfile = {
        ...profile,
        name: nameInput.trim() || "RoadLink User",
        photoURL: photoInput.trim(),
      };

      await setDoc(doc(db, "users", userId), updatedProfile, { merge: true });

      setProfile(updatedProfile);
      setMessage("Profile updated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  const displayName = profile.name || "RoadLink User";
  const displayPhoto = profile.photoURL || "";

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/find-ride" className="miniButton">
            Find Ride
          </Link>

          <Link href="/offer-ride" className="miniButton">
            Offer Ride
          </Link>

          <Link href="/my-bookings" className="miniButton">
            My Bookings
          </Link>
        </div>

        <div className="profileHeader">
          {displayPhoto ? (
            <img src={displayPhoto} alt={displayName} className="avatarImage" />
          ) : (
            <div className="avatar">{avatar}</div>
          )}

          <div>
            <p className="eyebrow">RoadLink Member</p>
            <h1>
              {displayName} <span>Profile</span>
            </h1>
            <p className="subtitle">{profile.email || "No email found"}</p>

            <div className="verifiedBadge">✓ Verified RoadLink Member</div>
          </div>
        </div>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="stats">
        <Metric icon="⭐" label="Rating" value="New" />
        <Metric icon="🎟️" label="Booked Trips" value={String(bookedTrips)} />
        <Metric icon="🚘" label="Active Rides" value={String(activeRides)} />
      </section>

      <section className="detailsCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Edit Profile</p>
            <h2>Photo & Identity</h2>
          </div>

          <div className="shield">📸</div>
        </div>

        <div className="editGrid">
          <div className="previewBox">
            {photoInput ? (
              <img src={photoInput} alt="Profile preview" className="previewImage" />
            ) : (
              <div className="previewAvatar">{avatar}</div>
            )}

            <p>Profile Photo Preview</p>
          </div>

          <div className="formBox">
            <label>Display Name</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
            />

            <label>Photo URL</label>
            <input
              value={photoInput}
              onChange={(e) => setPhotoInput(e.target.value)}
              placeholder="https://example.com/photo.jpg"
            />

            <button onClick={saveProfile} disabled={saving} className="saveButton">
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </section>

      <section className="detailsCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Account</p>
            <h2>Profile Details</h2>
          </div>

          <div className="shield">✓</div>
        </div>

        <Info label="Full Name" value={displayName} icon="👤" />
        <Info label="Email" value={profile.email || "Not available"} icon="✉️" />
        <Info label="Account Type" value={profile.role || "member"} icon="🪪" />
        <Info
          label="Member Since"
          value={profile.createdAt ? profile.createdAt.slice(0, 10) : "2026"}
          icon="📅"
        />
        <Info label="Verification" value="Email Verified" icon="🛡️" />
      </section>

      <section className="actionsCard">
        <p className="eyebrow">Quick Actions</p>
        <h2>Control Center</h2>

        <div className="actions">
          <Link href="/dashboard">📊 Dashboard</Link>
          <Link href="/find-ride">🔎 Find a Ride</Link>
          <Link href="/offer-ride">➕ Offer a Ride</Link>
          <Link href="/my-bookings">📋 My Bookings</Link>
          <Link href="/my-rides">🚘 My Rides</Link>
          <Link href="/dashboard/driver">🚗 Driver Dashboard</Link>
        </div>
      </section>

      <section className="safetyCard">
        <div>
          <p className="eyebrow">Trust & Safety</p>
          <h2>Verification Status</h2>
        </div>

        <div className="badges">
          <span>✓ Email Verified</span>
          <span>Phone Pending</span>
          <span>Driver Check Pending</span>
        </div>
      </section>

      <button onClick={handleSignOut} className="signOutButton">
        Sign Out
      </button>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .detailsCard,
        .actionsCard,
        .safetyCard,
        .signOutButton {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .metric,
        .detailsCard,
        .actionsCard,
        .safetyCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 22px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 32px;
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

        .profileHeader {
          display: flex;
          gap: 22px;
          align-items: center;
        }

        .avatar,
        .avatarImage {
          min-width: 92px;
          width: 92px;
          height: 92px;
          border-radius: 50%;
          box-shadow: 0 16px 50px rgba(34,197,94,0.35);
          border: 2px solid rgba(34,197,94,0.45);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
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
          font-size: 54px;
          line-height: 1;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        h1 span,
        .metricValue {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .verifiedBadge {
          display: inline-flex;
          margin-top: 16px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin-top: 22px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 22px;
        }

        .metricIcon {
          width: 44px;
          height: 44px;
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
          font-size: 28px;
          font-weight: 900;
        }

        .detailsCard,
        .actionsCard,
        .safetyCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          margin-bottom: 22px;
        }

        h2 {
          font-size: 32px;
          margin: 0;
        }

        .shield {
          min-width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          font-size: 30px;
          font-weight: 900;
        }

        .editGrid {
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 18px;
        }

        .previewBox,
        .formBox {
          padding: 18px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .previewBox {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .previewImage,
        .previewAvatar {
          width: 124px;
          height: 124px;
          border-radius: 50%;
          margin-bottom: 14px;
          border: 2px solid rgba(34,197,94,0.45);
        }

        .previewImage {
          object-fit: cover;
        }

        .previewAvatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 900;
        }

        .previewBox p {
          color: #a1a1aa;
          font-weight: 800;
          margin: 0;
        }

        label {
          display: block;
          color: #e5e7eb;
          font-weight: 900;
          margin-bottom: 8px;
        }

        input {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 16px;
          outline: none;
          margin-bottom: 16px;
        }

        input:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        input::placeholder {
          color: #71717a;
        }

        .saveButton {
          width: 100%;
          padding: 17px;
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

        .infoRow {
          display: grid;
          grid-template-columns: 42px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 10px;
        }

        .infoIcon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
        }

        .infoLabel {
          color: #e5e7eb;
          font-weight: 900;
        }

        .infoValue {
          color: #a1a1aa;
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 22px;
        }

        .actions a {
          display: block;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 18px;
          color: white;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .badges span {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          padding: 11px 15px;
          color: #d4d4d8;
          font-weight: 800;
        }

        .signOutButton {
          display: block;
          width: 100%;
          padding: 18px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 6px;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero,
          .detailsCard,
          .actionsCard,
          .safetyCard {
            padding: 24px;
            border-radius: 28px;
          }

          .profileHeader {
            align-items: flex-start;
          }

          .avatar,
          .avatarImage {
            min-width: 76px;
            width: 76px;
            height: 76px;
            font-size: 34px;
          }

          h1 {
            font-size: 42px;
          }

          .stats,
          .actions,
          .editGrid {
            grid-template-columns: 1fr;
          }

          .infoRow {
            grid-template-columns: 42px 1fr;
          }

          .infoValue {
            grid-column: 2;
            text-align: left;
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

function Info({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="infoRow">
      <div className="infoIcon">{icon}</div>
      <div className="infoLabel">{label}</div>
      <div className="infoValue">{value}</div>
    </div>
  );
}
