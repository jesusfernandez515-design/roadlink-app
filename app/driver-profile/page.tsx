"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Rating = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  rating?: number;
  comment?: string;
  from?: string;
  to?: string;
  createdAt?: string;
};

type DriverProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  bio?: string;
  verified?: boolean;
  followers?: string[];
  following?: string[];
  tripsCompleted?: number;
  joinedAt?: any;
  createdAt?: any;
};

export default function DriverProfilePage() {
  const [driverId, setDriverId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [message, setMessage] = useState("Loading driver profile...");
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const params = new URLSearchParams(window.location.search);
      const currentDriverId = params.get("driverId") || "";

      setDriverId(currentDriverId);

      if (user) {
        setCurrentUserId(user.uid);
      }

      await loadDriverProfile(currentDriverId, user?.uid || "");
    });

    return () => unsubscribe();
  }, []);

  async function loadDriverProfile(currentDriverId: string, userId: string) {
    try {
      if (!currentDriverId) {
        setMessage("No driver selected.");
        return;
      }

      const driverRef = doc(db, "users", currentDriverId);
      const driverSnap = await getDoc(driverRef);

      if (driverSnap.exists()) {
        const data = driverSnap.data() as DriverProfile;
        setDriverProfile(data);

        const followers = Array.isArray(data.followers) ? data.followers : [];
        setIsFollowing(userId ? followers.includes(userId) : false);
      } else {
        setDriverProfile(null);
      }

      const ratingsQuery = query(
        collection(db, "ratings"),
        where("driverId", "==", currentDriverId)
      );

      const ratingsSnapshot = await getDocs(ratingsQuery);

      const ratingsData = ratingsSnapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Rating[];

      setRatings(ratingsData);
      setMessage("");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

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

        setDriverProfile((current) => ({
          ...current,
          followers: (current?.followers || []).filter((id) => id !== currentUserId),
        }));
      } else {
        await updateDoc(currentUserRef, {
          following: arrayUnion(driverId),
        });

        await updateDoc(driverRef, {
          followers: arrayUnion(currentUserId),
        });

        setIsFollowing(true);

        setDriverProfile((current) => ({
          ...current,
          followers: [...(current?.followers || []), currentUserId],
        }));
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setFollowLoading(false);
    }
  }

  const totalReviews = ratings.length;

  const averageRating =
    totalReviews > 0
      ? ratings.reduce((total, item) => total + Number(item.rating || 0), 0) /
        totalReviews
      : 0;

  const ratingDisplay =
    totalReviews > 0 ? averageRating.toFixed(1) : "New";

  const stars =
    totalReviews > 0 ? "★".repeat(Math.round(averageRating)) : "★★★★★";

  const displayName = driverProfile?.name || "RoadLink Driver";
  const displayEmail = driverProfile?.email || "Verified RoadLink Driver";
  const displayPhoto = driverProfile?.photoURL || "";
  const displayBio =
    driverProfile?.bio || "Trusted RoadLink member ready to connect with passengers.";
  const followersCount = driverProfile?.followers?.length || 0;
  const followingCount = driverProfile?.following?.length || 0;
  const tripsCompleted = Number(driverProfile?.tripsCompleted || 0);
  const verified = Boolean(driverProfile?.verified);

  return (
    <main className="page">
      <section className="profileCard">
        <div className="topActions">
          <Link href="/find-ride" className="miniButton">
            ← Back
          </Link>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="driverHeader">
          {displayPhoto ? (
            <img src={displayPhoto} alt={displayName} className="avatarImage" />
          ) : (
            <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
          )}

          <div>
            <p className="eyebrow">{verified ? "Verified Driver" : "RoadLink Driver"}</p>

            <h1>
              {displayName} <span>{verified ? "✓" : ""}</span>
            </h1>

            <p className="subtitle">{displayEmail}</p>
            <p className="bioText">{displayBio}</p>

            <div className="verifiedBadge">
              {verified ? "✓ Verified RoadLink Member" : "RoadLink Member"}
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
                  : "Follow"}
              </button>

              <Link
                href={`/chat?driverId=${driverId}`}
                className="messageButton"
              >
                Message
              </Link>
            </div>
          </div>
        </div>

        {message && <p className="message">{message}</p>}

        <section className="ratingHero">
          <div>
            <p className="eyebrow">Public Reviews</p>
            <h2>{ratingDisplay}</h2>
            <p className="stars">{stars}</p>
            <p className="reviewText">
              {totalReviews > 0
                ? `${totalReviews} public review${totalReviews === 1 ? "" : "s"}`
                : "This driver has no reviews yet."}
            </p>
          </div>

          <div className="ratingBadge">⭐</div>
        </section>

        <section className="stats">
          <Metric icon="⭐" label="Rating" value={String(ratingDisplay)} />
          <Metric icon="🚗" label="Trips" value={String(tripsCompleted)} />
          <Metric icon="👥" label="Followers" value={String(followersCount)} />
          <Metric icon="➡️" label="Following" value={String(followingCount)} />
        </section>

        <section className="infoCard">
          <p className="eyebrow">Trust & Safety</p>
          <h2>Driver Information</h2>

          <Info icon="👤" label="Name" value={displayName} />
          <Info
            icon="⭐"
            label="Rating"
            value={totalReviews > 0 ? `${ratingDisplay}/5` : "New Driver"}
          />
          <Info icon="💬" label="Total Reviews" value={String(totalReviews)} />
          <Info icon="🚗" label="Completed Trips" value={String(tripsCompleted)} />
          <Info icon="👥" label="Followers" value={String(followersCount)} />
          <Info icon="➡️" label="Following" value={String(followingCount)} />
          <Info
            icon="🛡️"
            label="Verification"
            value={verified ? "Verified Member" : "Pending Verification"}
          />
          <Info
            icon="🆔"
            label="Driver ID"
            value={driverId || "Not available"}
          />
        </section>

        <section className="reviewsCard">
          <p className="eyebrow">Passenger Feedback</p>
          <h2>Reviews</h2>

          {ratings.length === 0 ? (
            <div className="emptyReview">
              <h3>No reviews yet</h3>
              <p>
                Once passengers rate this driver, their comments will appear here.
              </p>
            </div>
          ) : (
            ratings.map((item) => (
              <div key={item.id} className="review">
                <div className="reviewTop">
                  <div>
                    <strong>
                      {"★".repeat(Number(item.rating || 0))}
                      {"☆".repeat(5 - Number(item.rating || 0))}
                    </strong>
                    <p>
                      {item.from || "Trip"} → {item.to || "Destination"}
                    </p>
                  </div>

                  <span>{item.rating || 0}/5</span>
                </div>

                {item.comment ? (
                  <p className="comment">“{item.comment}”</p>
                ) : (
                  <p className="comment muted">No written comment.</p>
                )}

                <small>
                  {item.passengerEmail || "RoadLink Passenger"}
                  {item.createdAt ? ` • ${item.createdAt.slice(0, 10)}` : ""}
                </small>
              </div>
            ))
          )}
        </section>
      </section>

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

        .profileCard {
          max-width: 900px;
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
        .reviewsCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .driverHeader {
          border-radius: 32px;
          padding: 30px;
          display: flex;
          align-items: center;
          gap: 22px;
          margin-bottom: 22px;
        }

        .avatar,
        .avatarImage {
          min-width: 96px;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.45);
          box-shadow: 0 16px 50px rgba(34,197,94,0.35);
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
          font-size: 48px;
          line-height: 1;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        h1 span,
        .metricValue,
        .stars,
        .reviewTop strong,
        .ratingHero h2 {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .bioText {
          color: #d4d4d8;
          line-height: 1.5;
          margin: 12px 0 0;
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

        .profileActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .followButton,
        .messageButton {
          min-width: 130px;
          padding: 13px 20px;
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

        .ratingBadge {
          min-width: 90px;
          height: 90px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
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
        .reviewsCard {
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

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .driverHeader,
          .infoCard,
          .ratingHero,
          .reviewsCard {
            padding: 24px;
            border-radius: 28px;
          }

          .driverHeader {
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
            font-size: 40px;
          }

          .ratingHero {
            align-items: flex-start;
          }

          .ratingHero h2 {
            font-size: 54px;
          }

          .ratingBadge {
            min-width: 62px;
            height: 62px;
            font-size: 30px;
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

          .reviewTop {
            flex-direction: column;
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
