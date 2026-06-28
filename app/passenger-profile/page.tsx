"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Booking = {
  id: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  followers?: string[];
  following?: string[];
  createdAt?: any;
  joinedAt?: any;
};

export default function PassengerProfilePage() {
  const [passengerId, setPassengerId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [message, setMessage] = useState("Loading passenger profile...");
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const params = new URLSearchParams(window.location.search);
      const paramPassengerId = params.get("passengerId") || "";
      const finalPassengerId = paramPassengerId || user?.uid || "";

      if (user) setCurrentUserId(user.uid);
      setPassengerId(finalPassengerId);

      if (!finalPassengerId) {
        setMessage("Please sign in or select a passenger profile.");
        return;
      }

      unsubscribeProfile = onSnapshot(
        doc(db, "users", finalPassengerId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setProfile(null);
            setMessage("Passenger profile not found.");
            return;
          }

          const data = snapshot.data() as UserProfile;
          setProfile(data);

          const followers = Array.isArray(data.followers) ? data.followers : [];
          setIsFollowing(user?.uid ? followers.includes(user.uid) : false);
          setMessage("");
        },
        (error) => setMessage(error.message)
      );

      unsubscribeBookings = onSnapshot(
        query(collection(db, "bookings"), where("passengerId", "==", finalPassengerId)),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setBookings(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, []);

  async function toggleFollow() {
    if (!currentUserId) {
      setMessage("Please sign in before following a passenger.");
      return;
    }

    if (!passengerId) {
      setMessage("No passenger selected.");
      return;
    }

    if (currentUserId === passengerId) {
      setMessage("You cannot follow yourself.");
      return;
    }

    try {
      setFollowLoading(true);
      setMessage("");

      const currentUserRef = doc(db, "users", currentUserId);
      const passengerRef = doc(db, "users", passengerId);

      if (isFollowing) {
        await updateDoc(currentUserRef, { following: arrayRemove(passengerId) });
        await updateDoc(passengerRef, { followers: arrayRemove(currentUserId) });
        setIsFollowing(false);
      } else {
        await updateDoc(currentUserRef, { following: arrayUnion(passengerId) });
        await updateDoc(passengerRef, { followers: arrayUnion(currentUserId) });
        setIsFollowing(true);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setFollowLoading(false);
    }
  }

  function formatDate(value?: any) {
    if (!value) return "Recently";

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  }

  const completedTrips = bookings.filter((item) => item.status === "completed").length;
  const cancelledTrips = bookings.filter((item) => item.status === "cancelled").length;
  const activeTrips = bookings.filter((item) =>
    ["reserved", "confirmed", "pending"].includes(String(item.status || ""))
  ).length;

  const totalSpent = useMemo(() => {
    return bookings
      .filter((item) => item.status === "completed")
      .reduce(
        (total, item) =>
          total + Number(item.price || 0) * Number(item.seatsBooked || 1),
        0
      );
  }, [bookings]);

  const displayName = profile?.name || "RoadLink Passenger";
  const displayEmail = profile?.email || bookings[0]?.passengerEmail || "Passenger";
  const displayPhoto = profile?.photoURL || "";
  const displayBio =
    profile?.bio || "Trusted RoadLink passenger building safe and reliable ride history.";

  const location =
    profile?.city || profile?.state
      ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
      : "Location not added";

  const followersCount = profile?.followers?.length || 0;
  const followingCount = profile?.following?.length || 0;

  const verified = Boolean(
    profile?.verified || profile?.emailVerified || profile?.phoneVerified
  );

  const trustScore = Math.min(
    100,
    45 +
      (profile?.emailVerified ? 15 : 0) +
      (profile?.phoneVerified ? 15 : 0) +
      Math.min(completedTrips * 4, 20) +
      Math.max(0, 5 - cancelledTrips)
  );

  const trustLevel =
    trustScore >= 90
      ? "Elite"
      : trustScore >= 75
      ? "Premium"
      : trustScore >= 60
      ? "Trusted"
      : "New";

  const memberSince = formatDate(profile?.createdAt || profile?.joinedAt);
  const chatUrl = `/chat?passengerId=${passengerId}`;

  return (
    <main className="page">
      <section className="shell">
        <div className="topActions">
          <Link href="/find-ride" className="miniButton">← Find Ride</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/my-bookings" className="miniButton">My Bookings</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <section className="hero">
          <div className="glow" />

          <div className="avatarWrap">
            {displayPhoto ? (
              <img src={displayPhoto} alt={displayName} className="avatarImage" />
            ) : (
              <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
            )}

            {verified && <div className="verifyDot">✓</div>}
          </div>

          <div className="intro">
            <p className="eyebrow">
              {verified ? "Verified RoadLink Passenger" : "RoadLink Passenger"}
            </p>

            <h1>
              {displayName} <span>{verified ? "✓" : ""}</span>
            </h1>

            <p className="subtitle">{displayEmail}</p>
            <p className="location">📍 {location}</p>
            <p className="bio">{displayBio}</p>

            <div className="badges">
              <span>🛡️ {trustLevel} Trust</span>
              <span>✅ {completedTrips} Completed</span>
              <span>📅 Since {memberSince}</span>
            </div>

            <div className="actions">
              <button
                className={isFollowing ? "followButton following" : "followButton"}
                onClick={toggleFollow}
                disabled={followLoading || currentUserId === passengerId}
              >
                {followLoading
                  ? "Loading..."
                  : currentUserId === passengerId
                  ? "Your Profile"
                  : isFollowing
                  ? "Following"
                  : "Follow Passenger"}
              </button>

              <Link href={chatUrl} className="messageButton">
                Message Passenger
              </Link>
            </div>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="trustHero">
          <div>
            <p className="eyebrow">Passenger Reputation</p>
            <h2>{trustScore}</h2>
            <p>{trustLevel} passenger trust score</p>
          </div>

          <div className="trustCircle">
            <strong>{trustScore}</strong>
            <span>/100</span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="✅" label="Completed Trips" value={String(completedTrips)} />
          <Metric icon="🟢" label="Active Trips" value={String(activeTrips)} />
          <Metric icon="❌" label="Cancelled" value={String(cancelledTrips)} />
          <Metric icon="💵" label="Total Spent" value={`$${totalSpent}`} />
          <Metric icon="👥" label="Followers" value={String(followersCount)} />
          <Metric icon="➡️" label="Following" value={String(followingCount)} />
        </section>

        <section className="card">
          <p className="eyebrow">Trust & Safety</p>
          <h2>Passenger Information</h2>

          <Info icon="👤" label="Name" value={displayName} />
          <Info icon="📧" label="Email" value={displayEmail} />
          <Info icon="📍" label="Location" value={location} />
          <Info icon="✅" label="Completed Trips" value={String(completedTrips)} />
          <Info icon="🟢" label="Active Trips" value={String(activeTrips)} />
          <Info icon="❌" label="Cancelled Trips" value={String(cancelledTrips)} />
          <Info icon="👥" label="Followers" value={String(followersCount)} />
          <Info icon="🛡️" label="Verification" value={verified ? "Verified Member" : "Pending Verification"} />
        </section>

        <section className="card">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">RoadLink Trust</p>
              <h2>Trust Score</h2>
            </div>

            <div className="trustPill">{trustScore}/100</div>
          </div>

          <div className="bar">
            <div style={{ width: `${trustScore}%` }} />
          </div>

          <div className="checklist">
            <span className={profile?.emailVerified ? "complete" : ""}>
              {profile?.emailVerified ? "✓" : "•"} Email Verification
            </span>

            <span className={profile?.phoneVerified ? "complete" : ""}>
              {profile?.phoneVerified ? "✓" : "•"} Phone Verification
            </span>

            <span className={completedTrips > 0 ? "complete" : ""}>
              {completedTrips > 0 ? "✓" : "•"} Completed Trips
            </span>

            <span className={cancelledTrips === 0 ? "complete" : ""}>
              {cancelledTrips === 0 ? "✓" : "•"} Low Cancellation Risk
            </span>
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">Passenger Activity</p>
          <h2>Trip History</h2>

          {bookings.length === 0 ? (
            <div className="empty">
              <h3>No trip history yet</h3>
              <p>This passenger has not completed any RoadLink bookings yet.</p>
            </div>
          ) : (
            <div className="tripList">
              {bookings.map((booking) => (
                <div key={booking.id} className="trip">
                  <div className="tripIcon">🚗</div>

                  <div>
                    <strong>
                      {booking.from || "Origin"} → {booking.to || "Destination"}
                    </strong>

                    <p>
                      Driver: {booking.driverEmail || "RoadLink Driver"}
                    </p>

                    <small>
                      {booking.status || "reserved"} · {formatDate(booking.createdAt)}
                    </small>
                  </div>

                  <span>${Number(booking.price || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 120px;
          font-family: Arial, sans-serif;
        }

        .shell {
          max-width: 980px;
          margin: auto;
        }

        .topActions {
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
        .trustHero,
        .metric,
        .card {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: 34px;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 24px;
          align-items: center;
          margin-bottom: 22px;
        }

        .glow {
          position: absolute;
          top: -100px;
          right: -100px;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: rgba(34,197,94,0.16);
          filter: blur(8px);
        }

        .avatarWrap {
          position: relative;
          z-index: 1;
        }

        .avatar,
        .avatarImage {
          min-width: 128px;
          width: 128px;
          height: 128px;
          border-radius: 50%;
          border: 3px solid rgba(34,197,94,0.5);
          box-shadow: 0 18px 60px rgba(34,197,94,0.4);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 54px;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
        }

        .verifyDot {
          position: absolute;
          right: 2px;
          bottom: 8px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #22c55e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          border: 3px solid #020617;
        }

        .intro {
          position: relative;
          z-index: 1;
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
        }

        h1 span,
        .metricValue,
        .trustHero h2,
        .trustCircle strong {
          color: #22c55e;
        }

        .subtitle,
        .location,
        .bio {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .location {
          margin-top: 6px;
        }

        .bio {
          color: #d4d4d8;
          margin-top: 12px;
        }

        .badges,
        .actions,
        .checklist {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .badges {
          margin-top: 16px;
        }

        .badges span,
        .checklist span {
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .actions {
          margin-top: 18px;
        }

        .followButton,
        .messageButton {
          min-width: 160px;
          padding: 14px 22px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
        }

        .followButton {
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
        }

        .followButton.following {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(34,197,94,0.45);
          color: #22c55e;
        }

        .messageButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.15);
          color: white;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .trustHero {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .trustHero h2 {
          font-size: 64px;
          margin: 0;
        }

        .trustHero p {
          color: #a1a1aa;
        }

        .trustCircle {
          width: 105px;
          height: 105px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .trustCircle strong {
          font-size: 32px;
        }

        .trustCircle span {
          color: #d4d4d8;
          font-weight: 900;
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

        .card {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 22px;
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
          font-weight: 900;
        }

        .infoValue {
          color: #a1a1aa;
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          margin-bottom: 18px;
        }

        .trustPill {
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
          margin-bottom: 18px;
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .checklist span {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #a1a1aa;
        }

        .checklist .complete {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
          color: #22c55e;
        }

        .empty {
          padding: 20px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty p {
          color: #a1a1aa;
        }

        .tripList {
          display: grid;
          gap: 12px;
        }

        .trip {
          display: grid;
          grid-template-columns: 48px 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .tripIcon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(34,197,94,0.14);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .trip strong {
          display: block;
          margin-bottom: 5px;
          overflow-wrap: anywhere;
        }

        .trip p,
        .trip small {
          color: #a1a1aa;
          margin: 0;
        }

        .trip span {
          color: #22c55e;
          font-weight: 900;
        }

        @media (max-width: 800px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero {
            grid-template-columns: 1fr;
            align-items: flex-start;
            padding: 24px;
            border-radius: 28px;
          }

          .avatar,
          .avatarImage {
            min-width: 110px;
            width: 110px;
            height: 110px;
            font-size: 44px;
          }

          h1 {
            font-size: 42px;
          }

          .trustHero {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .infoRow,
          .trip {
            grid-template-columns: 42px 1fr;
          }

          .infoValue,
          .trip span {
            grid-column: 2;
            text-align: left;
          }

          .sectionHeader {
            flex-direction: column;
            align-items: flex-start;
          }

          .actions {
            display: grid;
          }

          .followButton,
          .messageButton {
            width: 100%;
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
