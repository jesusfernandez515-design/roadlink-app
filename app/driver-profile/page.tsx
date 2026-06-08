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
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Rating = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  reviewerEmail?: string;
  rating?: number;
  stars?: number;
  comment?: string;
  from?: string;
  to?: string;
  vehicle?: string;
  createdAt?: string;
};

type Ride = {
  id: string;
  driverId?: string;
  status?: string;
  seats?: number;
};

type DriverProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  licenseVerified?: boolean;
  followers?: string[];
  following?: string[];
  tripsCompleted?: number;
  totalTrips?: number;
  ratingAverage?: number;
  ratingCount?: number;
  joinedAt?: any;
  createdAt?: any;
};

export default function DriverProfilePage() {
  const [driverId, setDriverId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [message, setMessage] = useState("Loading driver profile...");
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeRatings: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const params = new URLSearchParams(window.location.search);
      const paramDriverId = params.get("driverId") || "";
      const finalDriverId = paramDriverId || user?.uid || "";

      setDriverId(finalDriverId);

      if (user) {
        setCurrentUserId(user.uid);
      }

      if (!finalDriverId) {
        setMessage("Please sign in or select a driver profile.");
        return;
      }

      const driverRef = doc(db, "users", finalDriverId);

      unsubscribeProfile = onSnapshot(
        driverRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setDriverProfile(null);
            setMessage("Driver profile not found.");
            return;
          }

          const data = snapshot.data() as DriverProfile;
          setDriverProfile(data);

          const followers = Array.isArray(data.followers) ? data.followers : [];
          setIsFollowing(user?.uid ? followers.includes(user.uid) : false);
          setMessage("");
        },
        (error) => setMessage(error.message)
      );

      const ratingsQuery = query(
        collection(db, "ratings"),
        where("driverId", "==", finalDriverId)
      );

      unsubscribeRatings = onSnapshot(
        ratingsQuery,
        (snapshot) => {
          const ratingsData = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Rating[];

          ratingsData.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setRatings(ratingsData);
          setMessage("");
        },
        (error) => setMessage(error.message)
      );

      const ridesQuery = query(
        collection(db, "rides"),
        where("driverId", "==", finalDriverId)
      );

      unsubscribeRides = onSnapshot(
        ridesQuery,
        (snapshot) => {
          const ridesData = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[];

          setRides(ridesData);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRatings) unsubscribeRatings();
      if (unsubscribeRides) unsubscribeRides();
    };
  }, []);

  async function toggleFollow() {
    if (!currentUserId) {
      setMessage("Please sign in before following a driver.");
      return;
    }

    if (!driverId) {
      setMessage("No driver selected.");
      return;
    }

    if (currentUserId === driverId) {
      setMessage("You cannot follow yourself.");
      return;
    }

    try {
      setFollowLoading(true);
      setMessage("");

      const currentUserRef = doc(db, "users", currentUserId);
      const driverRef = doc(db, "users", driverId);

      if (isFollowing) {
        await updateDoc(currentUserRef, {
          following: arrayRemove(driverId),
        });

        await updateDoc(driverRef, {
          followers: arrayRemove(currentUserId),
        });

        setIsFollowing(false);
      } else {
        await updateDoc(currentUserRef, {
          following: arrayUnion(driverId),
        });

        await updateDoc(driverRef, {
          followers: arrayUnion(currentUserId),
        });

        setIsFollowing(true);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setFollowLoading(false);
    }
  }

  function getRatingValue(item: Rating) {
    return Number(item.stars || item.rating || 0);
  }

  function renderStars(value: number) {
    const safeValue = Math.max(0, Math.min(5, Math.round(value)));
    return "★".repeat(safeValue) + "☆".repeat(5 - safeValue);
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

  const totalReviews = ratings.length;

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return 0;

    const total = ratings.reduce((sum, item) => sum + getRatingValue(item), 0);

    return total / ratings.length;
  }, [ratings]);

  const ratingDisplay = totalReviews > 0 ? averageRating.toFixed(1) : "New";
  const stars = totalReviews > 0 ? renderStars(averageRating) : "☆☆☆☆☆";

  const fiveStarReviews = ratings.filter((item) => getRatingValue(item) === 5).length;
  const positiveReviews = ratings.filter((item) => getRatingValue(item) >= 4).length;
  const excellentRate =
    ratings.length > 0 ? Math.round((positiveReviews / ratings.length) * 100) : 0;

  const activeRides = rides.filter(
    (ride) => ride.status === "active" || ride.status === "full"
  ).length;

  const completedRidesFromCollection = rides.filter(
    (ride) => ride.status === "completed"
  ).length;

  const displayName = driverProfile?.name || "RoadLink Driver";
  const displayEmail =
    driverProfile?.email || ratings[0]?.driverEmail || "Verified RoadLink Driver";
  const displayPhoto = driverProfile?.photoURL || "";
  const displayBio =
    driverProfile?.bio || "Trusted RoadLink member ready to connect with passengers.";
  const location =
    driverProfile?.city || driverProfile?.state
      ? `${driverProfile.city || ""}${driverProfile.city && driverProfile.state ? ", " : ""}${driverProfile.state || ""}`
      : "Location not added";

  const followersCount = driverProfile?.followers?.length || 0;
  const followingCount = driverProfile?.following?.length || 0;
  const tripsCompleted = Math.max(
    Number(driverProfile?.tripsCompleted || 0),
    completedRidesFromCollection
  );
  const totalTrips = Math.max(
    Number(driverProfile?.totalTrips || 0),
    rides.length,
    tripsCompleted
  );

  const verified = Boolean(
    driverProfile?.verified ||
      driverProfile?.emailVerified ||
      driverProfile?.phoneVerified ||
      driverProfile?.licenseVerified
  );

  const trustScore = Math.min(
    100,
    40 +
      (driverProfile?.emailVerified ? 15 : 0) +
      (driverProfile?.phoneVerified ? 15 : 0) +
      (driverProfile?.licenseVerified ? 15 : 0) +
      Math.min(tripsCompleted * 3, 15) +
      Math.min(totalReviews * 2, 15)
  );

  const trustLevel =
    trustScore >= 90
      ? "Elite"
      : trustScore >= 75
      ? "Premium"
      : trustScore >= 60
      ? "Trusted"
      : "New";

  const memberSince = formatDate(driverProfile?.createdAt || driverProfile?.joinedAt);

  const chatUrl = `/chat?driverId=${driverId}`;

  return (
    <main className="page">
      <section className="profileShell">
        <div className="topActions">
          <Link href="/find-ride" className="miniButton">← Back</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/reviews" className="miniButton">Reviews</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <section className="driverHeader">
          <div className="coverGlow" />

          <div className="avatarWrap">
            {displayPhoto ? (
              <img src={displayPhoto} alt={displayName} className="avatarImage" />
            ) : (
              <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
            )}

            {verified && <div className="verifyDot">✓</div>}
          </div>

          <div className="driverIntro">
            <p className="eyebrow">{verified ? "Verified RoadLink Driver" : "RoadLink Driver"}</p>

            <h1>
              {displayName} <span>{verified ? "✓" : ""}</span>
            </h1>

            <p className="subtitle">{displayEmail}</p>
            <p className="location">📍 {location}</p>
            <p className="bioText">{displayBio}</p>

            <div className="heroBadges">
              <span>⭐ {ratingDisplay}</span>
              <span>🛡️ {trustLevel} Trust</span>
              <span>📅 Since {memberSince}</span>
            </div>

            <div className="profileActions">
              <button
                className={isFollowing ? "followButton following" : "followButton"}
                onClick={toggleFollow}
                disabled={followLoading || currentUserId === driverId}
              >
                {followLoading
                  ? "Loading..."
                  : currentUserId === driverId
                  ? "Your Profile"
                  : isFollowing
                  ? "Following"
                  : "Follow Driver"}
              </button>

              <Link href={chatUrl} className="messageButton">
                Message Driver
              </Link>
            </div>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="ratingHero">
          <div>
            <p className="eyebrow">Driver Reputation</p>
            <h2>{ratingDisplay}</h2>
            <p className="stars">{stars}</p>
            <p className="reviewText">
              {totalReviews > 0
                ? `${totalReviews} public review${totalReviews === 1 ? "" : "s"}`
                : "This driver has no reviews yet."}
            </p>
          </div>

          <div className="trustCircle">
            <strong>{trustScore}</strong>
            <span>{trustLevel}</span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="⭐" label="Rating" value={String(ratingDisplay)} />
          <Metric icon="💬" label="Reviews" value={String(totalReviews)} />
          <Metric icon="🏆" label="5-Star" value={String(fiveStarReviews)} />
          <Metric icon="📈" label="Positive" value={`${excellentRate}%`} />
          <Metric icon="🚗" label="Trips" value={String(totalTrips)} />
          <Metric icon="✅" label="Completed" value={String(tripsCompleted)} />
          <Metric icon="🟢" label="Active Rides" value={String(activeRides)} />
          <Metric icon="👥" label="Followers" value={String(followersCount)} />
        </section>

        <section className="infoCard">
          <p className="eyebrow">Trust & Safety</p>
          <h2>Driver Information</h2>

          <Info icon="👤" label="Name" value={displayName} />
          <Info icon="⭐" label="Rating" value={totalReviews > 0 ? `${ratingDisplay}/5` : "New Driver"} />
          <Info icon="💬" label="Total Reviews" value={String(totalReviews)} />
          <Info icon="🚗" label="Total Trips" value={String(totalTrips)} />
          <Info icon="✅" label="Completed Trips" value={String(tripsCompleted)} />
          <Info icon="👥" label="Followers" value={String(followersCount)} />
          <Info icon="➡️" label="Following" value={String(followingCount)} />
          <Info icon="📍" label="Location" value={location} />
          <Info icon="🛡️" label="Verification" value={verified ? "Verified Member" : "Pending Verification"} />
        </section>

        <section className="trustCard">
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

          <div className="trustChecklist">
            <span className={driverProfile?.emailVerified ? "complete" : ""}>
              {driverProfile?.emailVerified ? "✓" : "•"} Email Verification
            </span>

            <span className={driverProfile?.phoneVerified ? "complete" : ""}>
              {driverProfile?.phoneVerified ? "✓" : "•"} Phone Verification
            </span>

            <span className={driverProfile?.licenseVerified ? "complete" : ""}>
              {driverProfile?.licenseVerified ? "✓" : "•"} Driver License
            </span>

            <span className={totalReviews > 0 ? "complete" : ""}>
              {totalReviews > 0 ? "✓" : "•"} Passenger Reviews
            </span>
          </div>
        </section>

        <section className="reviewsCard">
          <p className="eyebrow">Passenger Feedback</p>
          <h2>Reviews</h2>

          {ratings.length === 0 ? (
            <div className="emptyReview">
              <h3>No reviews yet</h3>
              <p>Once passengers rate this driver, their comments will appear here.</p>
            </div>
          ) : (
            ratings.map((item) => {
              const reviewValue = getRatingValue(item);

              return (
                <div key={item.id} className="review">
                  <div className="reviewTop">
                    <div>
                      <strong>{renderStars(reviewValue)}</strong>
                      <p>{item.from || "Trip"} → {item.to || "Destination"}</p>
                    </div>

                    <span>{reviewValue}/5</span>
                  </div>

                  {item.comment ? (
                    <p className="comment">“{item.comment}”</p>
                  ) : (
                    <p className="comment muted">No written comment.</p>
                  )}

                  <div className="reviewMeta">
                    <small>{item.reviewerEmail || item.passengerEmail || "RoadLink Passenger"}</small>
                    <small>{formatDate(item.createdAt)}</small>
                    {item.vehicle && <small>🚘 {item.vehicle}</small>}
                  </div>
                </div>
              );
            })
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
          font-family: Arial, sans-serif;
        }

        .profileShell {
          max-width: 980px;
          margin: 0 auto;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
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

        .driverHeader,
        .metric,
        .infoCard,
        .ratingHero,
        .reviewsCard,
        .trustCard {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .driverHeader {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: 34px;
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 24px;
          margin-bottom: 22px;
        }

        .coverGlow {
          position: absolute;
          inset: -120px -100px auto auto;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: rgba(34,197,94,0.16);
          filter: blur(6px);
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
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          border: 3px solid #020617;
        }

        .driverIntro {
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
          letter-spacing: -1px;
        }

        h1 span,
        .metricValue,
        .stars,
        .reviewTop strong,
        .ratingHero h2,
        .trustCircle strong {
          color: #22c55e;
        }

        .subtitle,
        .location {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .location {
          margin-top: 6px;
        }

        .bioText {
          color: #d4d4d8;
          line-height: 1.5;
          margin: 12px 0 0;
        }

        .heroBadges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .heroBadges span {
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .profileActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .followButton,
        .messageButton {
          min-width: 150px;
          padding: 14px 22px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .followButton {
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          box-shadow: 0 14px 40px rgba(34,197,94,0.22);
        }

        .followButton.following {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(34,197,94,0.45);
          color: #22c55e;
          box-shadow: none;
        }

        .followButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .messageButton {
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.04);
          color: white;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 20px 0;
        }

        .ratingHero {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .ratingHero h2 {
          font-size: 64px;
          line-height: 1;
          margin: 0;
        }

        .stars {
          font-size: 28px;
          letter-spacing: 2px;
          margin: 10px 0;
        }

        .reviewText {
          color: #a1a1aa;
          margin: 0;
          font-weight: 800;
        }

        .trustCircle {
          min-width: 104px;
          height: 104px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .trustCircle strong {
          font-size: 32px;
          font-weight: 900;
        }

        .trustCircle span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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

        .infoCard,
        .reviewsCard,
        .trustCard {
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
          color: #e5e7eb;
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

        .trustChecklist {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .trustChecklist span {
          padding: 10px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #a1a1aa;
          font-weight: 900;
        }

        .trustChecklist .complete {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
          color: #22c55e;
        }

        .emptyReview,
        .review {
          padding: 18px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          margin-bottom: 14px;
        }

        .emptyReview h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        .emptyReview p {
          color: #a1a1aa;
          margin: 0;
        }

        .reviewTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
        }

        .reviewTop strong {
          font-size: 22px;
          letter-spacing: 1px;
        }

        .reviewTop p,
        .comment,
        .review small {
          color: #a1a1aa;
        }

        .reviewTop p {
          margin: 8px 0 0;
        }

        .reviewTop span {
          color: #22c55e;
          font-weight: 900;
        }

        .comment {
          font-size: 17px;
          line-height: 1.5;
        }

        .muted {
          opacity: 0.75;
        }

        .reviewMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .reviewMeta small {
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-weight: 900;
        }

        @media (max-width: 800px) {
          .page {
            padding: 16px;
          }

          .driverHeader,
          .infoCard,
          .ratingHero,
          .reviewsCard,
          .trustCard {
            padding: 24px;
            border-radius: 28px;
          }

          .driverHeader {
            grid-template-columns: 1fr;
            align-items: flex-start;
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

          .ratingHero {
            align-items: flex-start;
          }

          .ratingHero h2 {
            font-size: 54px;
          }

          .trustCircle {
            min-width: 86px;
            height: 86px;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .infoRow {
            grid-template-columns: 42px 1fr;
          }

          .infoValue {
            grid-column: 2;
            text-align: left;
          }

          .reviewTop,
          .sectionHeader {
            flex-direction: column;
          }
        }

        @media (max-width: 460px) {
          .stats {
            grid-template-columns: 1fr;
          }

          .profileActions {
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
