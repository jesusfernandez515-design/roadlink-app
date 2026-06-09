"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db, storage } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

type UserProfile = {
  name?: string;
  email?: string;
  role?: string;
  createdAt?: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  state?: string;
  emailVerified?: boolean;
  provider?: string;
  verified?: boolean;
  phoneVerified?: boolean;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  verificationStatus?: string;
};

type DriverVerification = {
  status?: "not_submitted" | "pending" | "approved" | "rejected";
  governmentIdURL?: string;
  driverLicenseURL?: string;
  insuranceURL?: string;
  vehiclePhotoURL?: string;
};

type Booking = {
  id: string;
  status?: string;
  seatsBooked?: number;
};

type Ride = {
  id: string;
  status?: string;
};

type Rating = {
  id: string;
  driverId?: string;
  rating?: number;
  stars?: number;
  comment?: string;
};

export default function ProfilePage() {
  const [userId, setUserId] = useState("");

  const [profile, setProfile] = useState<UserProfile>({
    name: "RoadLink User",
    email: "",
    role: "member",
    photoURL: "",
    bio: "",
    city: "",
    state: "",
  });

  const [verification, setVerification] = useState<DriverVerification>({
    status: "not_submitted",
  });

  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [stateInput, setStateInput] = useState("");
  const [photoInput, setPhotoInput] = useState("");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);

  const [avatar, setAvatar] = useState("R");
  const [message, setMessage] = useState("Loading profile...");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeVerification: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribeRatings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your profile.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      setUserId(user.uid);
      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");

      const userRef = doc(db, "users", user.uid);

      try {
        const existingUser = await getDoc(userRef);

        if (!existingUser.exists()) {
          await setDoc(
            userRef,
            {
              name: fallbackName,
              email: userEmail,
              role: "member",
              createdAt: new Date().toISOString(),
              photoURL: fallbackPhoto,
              bio: "",
              city: "",
              state: "",
              emailVerified: Boolean(user.emailVerified),
              provider: "email",
              verified: false,
              phoneVerified: false,
              driverVerified: false,
              licenseVerified: false,
              verificationStatus: "not_submitted",
            },
            { merge: true }
          );
        } else {
          await setDoc(
            userRef,
            {
              email: userEmail,
              emailVerified: Boolean(user.emailVerified),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }

      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          const data = snapshot.data() as UserProfile | undefined;

          const finalProfile: UserProfile = {
            name: data?.name || fallbackName,
            email: data?.email || userEmail,
            role: data?.role || "member",
            createdAt: data?.createdAt || new Date().toISOString(),
            photoURL: data?.photoURL || fallbackPhoto,
            bio: data?.bio || "",
            city: data?.city || "",
            state: data?.state || "",
            emailVerified: Boolean(user.emailVerified || data?.emailVerified),
            provider: data?.provider || "email",
            verified: Boolean(data?.verified),
            phoneVerified: Boolean(data?.phoneVerified),
            driverVerified: Boolean(data?.driverVerified),
            licenseVerified: Boolean(data?.licenseVerified),
            verificationStatus: data?.verificationStatus || "not_submitted",
          };

          setProfile(finalProfile);
          setNameInput(finalProfile.name || "");
          setBioInput(finalProfile.bio || "");
          setCityInput(finalProfile.city || "");
          setStateInput(finalProfile.state || "");
          setPhotoInput(finalProfile.photoURL || "");
          setMessage("");
        },
        (error) => setMessage(error.message)
      );

      unsubscribeVerification = onSnapshot(
        doc(db, "driverVerifications", user.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            setVerification(snapshot.data() as DriverVerification);
          } else {
            setVerification({ status: "not_submitted" });
          }
        },
        (error) => setMessage(error.message)
      );

      unsubscribeBookings = onSnapshot(
        query(collection(db, "bookings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          setBookings(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Booking[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribeRides = onSnapshot(
        query(collection(db, "rides"), where("driverId", "==", user.uid)),
        (snapshot) => {
          setRides(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Ride[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribeRatings = onSnapshot(
        query(collection(db, "ratings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          setRatings(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Rating[]
          );
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeVerification) unsubscribeVerification();
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribeRatings) unsubscribeRatings();
    };
  }, []);

  const bookedTrips = bookings.filter((booking) => booking.status === "reserved").length;
  const completedBookings = bookings.filter((booking) => booking.status === "completed").length;
  const activeRides = rides.filter((ride) => ride.status === "active" || ride.status === "full").length;
  const completedRides = rides.filter((ride) => ride.status === "completed").length;

  const passengersTransported = bookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce((total, booking) => total + Number(booking.seatsBooked || 1), 0);

  const averageRating = useMemo(() => {
    if (!ratings.length) return 0;

    return (
      ratings.reduce(
        (total, item) => total + Number(item.rating || item.stars || 0),
        0
      ) / ratings.length
    );
  }, [ratings]);

  const ratingDisplay = ratings.length ? averageRating.toFixed(1) : "New";

  const verificationStatus =
    profile.driverVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === "approved" ||
    verification.status === "approved"
      ? "approved"
      : verification.status || profile.verificationStatus || "not_submitted";

  const verificationComplete = [
    verification.governmentIdURL,
    verification.driverLicenseURL,
    verification.insuranceURL,
    verification.vehiclePhotoURL,
  ].filter(Boolean).length;

  const driverVerified =
    verificationStatus === "approved" ||
    profile.driverVerified === true ||
    profile.verified === true;

  const trustScore = Math.min(
    100,
    40 +
      (profile.emailVerified ? 15 : 0) +
      (profile.phoneVerified ? 15 : 0) +
      (driverVerified ? 15 : 0) +
      Math.min(completedRides * 3, 15)
  );

  const trustLevel =
    trustScore >= 85 ? "Premium" : trustScore >= 65 ? "Trusted" : "Basic";

  async function uploadProfilePhoto(file: File) {
    if (!userId) {
      setMessage("Please sign in to upload a photo.");
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage("");

      const filePath = `profile-photos/${userId}/${Date.now()}-${file.name}`;
      const photoRef = ref(storage, filePath);

      await uploadBytes(photoRef, file);

      const downloadURL = await getDownloadURL(photoRef);

      await setDoc(
        doc(db, "users", userId),
        {
          photoURL: downloadURL,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setPhotoInput(downloadURL);
      setMessage("Profile photo uploaded successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveProfile() {
    if (!userId) {
      setMessage("Please sign in to update your profile.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await setDoc(
        doc(db, "users", userId),
        {
          name: nameInput.trim() || "RoadLink User",
          bio: bioInput.trim(),
          city: cityInput.trim(),
          state: stateInput.trim(),
          photoURL: photoInput.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

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

  const location =
    profile.city || profile.state
      ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
      : "Location not added";

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/find-ride" className="miniButton">Find Ride</Link>
          <Link href="/offer-ride" className="miniButton">Offer Ride</Link>
          <Link href="/messages" className="miniButton">Messages</Link>
          <Link href="/notifications" className="miniButton">Notifications</Link>
        </div>

        <div className="profileHeader">
          {displayPhoto ? (
            <img src={displayPhoto} alt={displayName} className="avatarImage" />
          ) : (
            <div className="avatar">{avatar}</div>
          )}

          <div className="profileIntro">
            <p className="eyebrow">RoadLink Premium Profile</p>
            <h1>{displayName}</h1>
            <p className="subtitle">{profile.email || "No email found"}</p>

            <div className="badgeRow">
              <span className="verifiedBadge">✓ Email Verified</span>
              <span className="roleBadge">{profile.role || "member"}</span>
              <span className="trustBadge">{trustLevel} Trust</span>
              <span className={driverVerified ? "driverBadge approved" : "driverBadge"}>
                {driverVerified ? "✓ Verified Driver" : "Driver Not Verified"}
              </span>
            </div>
          </div>
        </div>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="stats">
        <Metric icon="⭐" label="Rating" value={String(ratingDisplay)} />
        <Metric icon="🎟️" label="Booked Trips" value={String(bookedTrips)} />
        <Metric icon="🚘" label="Active Rides" value={String(activeRides)} />
        <Metric icon="✅" label="Completed" value={String(completedRides + completedBookings)} />
        <Metric icon="👥" label="Passengers" value={String(passengersTransported)} />
        <Metric icon="🛡️" label="Trust Score" value={`${trustScore}/100`} />
      </section>

      <section className="verifyCard">
        <div>
          <p className="eyebrow">Driver Verification</p>
          <h2>
            {verificationStatus === "approved"
              ? "Verified Driver"
              : verificationStatus === "pending"
              ? "Verification Pending"
              : verificationStatus === "rejected"
              ? "Verification Needs Review"
              : "Become a Verified Driver"}
          </h2>
          <p>
            {verificationStatus === "approved"
              ? "Your driver profile is approved and trusted on RoadLink."
              : verificationStatus === "pending"
              ? "Your documents were submitted and are waiting for review."
              : verificationStatus === "rejected"
              ? "Please update your documents and submit again."
              : "Upload your ID, license, insurance, and vehicle photo to build passenger trust."}
          </p>
        </div>

        <div className="verifyStatus">
          <span>{verificationStatus.replace("_", " ").toUpperCase()}</span>
          <strong>{verificationComplete}/4</strong>
        </div>

        <Link href="/driver-verification" className="verifyButton">
          {verificationStatus === "approved" ? "View Verification" : "Verify Driver"}
        </Link>
      </section>

      <section className="detailsCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Edit Profile</p>
            <h2>Identity & Photo</h2>
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

            <p>Premium Profile Photo</p>
          </div>

          <div className="formBox">
            <label>Display Name</label>
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Your name"
            />

            <label>Bio</label>
            <textarea
              value={bioInput}
              onChange={(event) => setBioInput(event.target.value)}
              placeholder="Tell passengers and drivers who you are..."
            />

            <div className="twoGrid">
              <div>
                <label>City</label>
                <input
                  value={cityInput}
                  onChange={(event) => setCityInput(event.target.value)}
                  placeholder="City"
                />
              </div>

              <div>
                <label>State</label>
                <input
                  value={stateInput}
                  onChange={(event) => setStateInput(event.target.value)}
                  placeholder="State"
                />
              </div>
            </div>

            <label>Upload Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadProfilePhoto(file);
              }}
            />

            <label>Photo URL</label>
            <input
              value={photoInput}
              onChange={(event) => setPhotoInput(event.target.value)}
              placeholder="https://example.com/photo.jpg"
            />

            {uploadingPhoto && <p className="message">Uploading photo...</p>}

            <button onClick={saveProfile} disabled={saving || uploadingPhoto} className="saveButton">
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
        <Info label="Location" value={location} icon="📍" />
        <Info
          label="Member Since"
          value={profile.createdAt ? profile.createdAt.slice(0, 10) : "2026"}
          icon="📅"
        />
        <Info label="Verification" value={profile.emailVerified ? "Email Verified" : "Pending"} icon="🛡️" />
        <Info label="Driver Verification" value={verificationStatus.replace("_", " ")} icon="🚘" />
      </section>

      <section className="safetyCard">
        <div>
          <p className="eyebrow">Trust & Safety</p>
          <h2>Verification Status</h2>
          <p className="trustText">
            Your RoadLink Trust Score improves as you verify your account and complete trips.
          </p>
        </div>

        <div className="trustMeter">
          <div className="trustTop">
            <strong>{trustScore}/100</strong>
            <span>{trustLevel}</span>
          </div>

          <div className="bar">
            <div style={{ width: `${trustScore}%` }} />
          </div>
        </div>

        <div className="badges">
          <span className={profile.emailVerified ? "goodBadge" : ""}>✓ Email Verified</span>
          <span className={profile.phoneVerified ? "goodBadge" : ""}>Phone Pending</span>
          <span className={driverVerified ? "goodBadge" : ""}>
            {driverVerified ? "✓ Driver Verified" : "Driver Check Pending"}
          </span>
          <span>Payment Pending</span>
        </div>
      </section>

      <section className="actionsCard">
        <p className="eyebrow">Quick Actions</p>
        <h2>Control Center</h2>

        <div className="actions">
          <Link href="/dashboard">📊 Dashboard</Link>
          <Link href="/find-ride">🔎 Find a Ride</Link>
          <Link href="/offer-ride">➕ Offer a Ride</Link>
          <Link href="/driver-verification">🛡️ Verify Driver</Link>
          <Link href="/my-bookings">📋 My Bookings</Link>
          <Link href="/my-rides">🚘 My Rides</Link>
          <Link href="/dashboard/driver">🚗 Driver Dashboard</Link>
        </div>
      </section>

      <button onClick={handleSignOut} className="signOutButton">
        Sign Out
      </button>

      <style>{`
        * { box-sizing: border-box; }

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

        .hero,
        .stats,
        .detailsCard,
        .actionsCard,
        .safetyCard,
        .verifyCard,
        .signOutButton {
          max-width: 960px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .metric,
        .detailsCard,
        .actionsCard,
        .safetyCard,
        .verifyCard {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 32px;
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
          min-width: 104px;
          width: 104px;
          height: 104px;
          border-radius: 50%;
          box-shadow: 0 16px 55px rgba(34,197,94,0.4);
          border: 2px solid rgba(34,197,94,0.5);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 44px;
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

        h2 {
          font-size: 32px;
          margin: 0;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .badgeRow {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .verifiedBadge,
        .roleBadge,
        .trustBadge,
        .driverBadge {
          display: inline-flex;
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 900;
        }

        .verifiedBadge,
        .trustBadge,
        .driverBadge.approved {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
        }

        .driverBadge {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
          color: #fca5a5;
        }

        .roleBadge {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          text-transform: capitalize;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin-top: 14px;
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
          color: #22c55e;
          font-size: 28px;
          font-weight: 900;
        }

        .verifyCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .verifyCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin-bottom: 0;
        }

        .verifyStatus {
          min-width: 110px;
          height: 110px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          text-align: center;
          font-weight: 900;
        }

        .verifyStatus span {
          font-size: 10px;
          margin-bottom: 6px;
        }

        .verifyStatus strong {
          font-size: 24px;
        }

        .verifyButton {
          grid-column: 1 / -1;
          width: 100%;
          display: block;
          padding: 17px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-decoration: none;
          text-align: center;
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

        input,
        textarea {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 16px;
          outline: none;
          margin-bottom: 16px;
          font-family: Arial, sans-serif;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        input:focus,
        textarea:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        input::placeholder,
        textarea::placeholder {
          color: #71717a;
        }

        .twoGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
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
          text-transform: capitalize;
        }

        .trustText {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .trustMeter {
          margin: 20px 0;
        }

        .trustTop {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .trustTop strong,
        .trustTop span {
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

        .badges .goodBadge {
          color: #22c55e;
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.12);
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
          .safetyCard,
          .verifyCard {
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
          .editGrid,
          .twoGrid,
          .verifyCard {
            grid-template-columns: 1fr;
          }

          .verifyStatus {
            width: 110px;
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
