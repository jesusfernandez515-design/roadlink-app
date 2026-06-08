"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

type Ride = {
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  driverId?: string;
  driverEmail?: string;
  vehicle?: string;
  status?: string;
};

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  verified?: boolean;
  emailVerified?: boolean;
};

type RatingItem = {
  id: string;
  driverId?: string;
  rideId?: string;
  passengerId?: string;
  rating?: number;
  stars?: number;
  comment?: string;
};

export default function RateDriverPage() {
  const [rideId, setRideId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [passengerId, setPassengerId] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<UserProfile | null>(null);
  const [driverRatings, setDriverRatings] = useState<RatingItem[]>([]);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("Loading rating page...");
  const [loading, setLoading] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const params = new URLSearchParams(window.location.search);
      const currentRideId = params.get("rideId") || "";
      const currentDriverId = params.get("driverId") || "";

      setRideId(currentRideId);
      setDriverId(currentDriverId);

      if (!user) {
        setMessage("Please sign in before rating a driver.");
        return;
      }

      if (!currentRideId) {
        setMessage("No ride selected.");
        return;
      }

      setPassengerId(user.uid);
      setPassengerEmail(user.email || "");

      try {
        const rideRef = doc(db, "rides", currentRideId);
        const rideSnap = await getDoc(rideRef);

        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        const rideData = rideSnap.data() as Ride;
        setRide(rideData);

        const finalDriverId = currentDriverId || rideData.driverId || "";
        setDriverId(finalDriverId);

        if (!finalDriverId) {
          setMessage("Driver information is missing.");
          return;
        }

        const driverRef = doc(db, "users", finalDriverId);
        const driverSnap = await getDoc(driverRef);

        if (driverSnap.exists()) {
          setDriver(driverSnap.data() as UserProfile);
        }

        const ratingQuery = query(
          collection(db, "ratings"),
          where("rideId", "==", currentRideId),
          where("passengerId", "==", user.uid)
        );

        const ratingSnapshot = await getDocs(ratingQuery);

        if (!ratingSnapshot.empty) {
          setAlreadyRated(true);
          setMessage("You already rated this driver.");
        } else {
          setMessage("");
        }

        const driverRatingsQuery = query(
          collection(db, "ratings"),
          where("driverId", "==", finalDriverId)
        );

        const driverRatingsSnapshot = await getDocs(driverRatingsQuery);

        const ratingsData = driverRatingsSnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as RatingItem[];

        setDriverRatings(ratingsData);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribe();
  }, []);

  const averageRating = useMemo(() => {
    if (!driverRatings.length) return 0;

    return (
      driverRatings.reduce(
        (total, item) => total + Number(item.rating || item.stars || 0),
        0
      ) / driverRatings.length
    );
  }, [driverRatings]);

  const averageDisplay = driverRatings.length ? averageRating.toFixed(1) : "New";
  const visibleRating = hoverRating || rating;

  const ratingLabel =
    visibleRating === 0
      ? "Choose your rating"
      : visibleRating === 1
      ? "Poor experience"
      : visibleRating === 2
      ? "Could be better"
      : visibleRating === 3
      ? "Good experience"
      : visibleRating === 4
      ? "Great experience"
      : "Excellent driver";

  async function submitRating() {
    setMessage("");

    if (!passengerId) {
      setMessage("Please sign in before rating a driver.");
      return;
    }

    if (!rideId) {
      setMessage("No ride selected.");
      return;
    }

    if (!driverId && !ride?.driverId) {
      setMessage("Driver information is missing.");
      return;
    }

    if (rating < 1) {
      setMessage("Please select a rating from 1 to 5 stars.");
      return;
    }

    try {
      setLoading(true);

      const finalDriverId = driverId || ride?.driverId || "";
      const now = new Date().toISOString();

      const duplicateQuery = query(
        collection(db, "ratings"),
        where("rideId", "==", rideId),
        where("passengerId", "==", passengerId)
      );

      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        setAlreadyRated(true);
        setMessage("You already rated this driver.");
        return;
      }

      await addDoc(collection(db, "ratings"), {
        rideId,
        driverId: finalDriverId,
        driverEmail: ride?.driverEmail || driver?.email || "",
        passengerId,
        passengerEmail,
        reviewerEmail: passengerEmail,
        stars: rating,
        rating,
        comment: comment.trim(),
        from: ride?.from || "",
        to: ride?.to || "",
        vehicle: ride?.vehicle || "",
        createdAt: now,
      });

      const updatedRatingsQuery = query(
        collection(db, "ratings"),
        where("driverId", "==", finalDriverId)
      );

      const updatedRatingsSnapshot = await getDocs(updatedRatingsQuery);

      const updatedRatings = updatedRatingsSnapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as RatingItem[];

      const newAverage =
        updatedRatings.reduce(
          (total, item) => total + Number(item.rating || item.stars || 0),
          0
        ) / Math.max(updatedRatings.length, 1);

      await setDoc(
        doc(db, "users", finalDriverId),
        {
          ratingAverage: Number(newAverage.toFixed(2)),
          ratingCount: updatedRatings.length,
          updatedAt: now,
        },
        { merge: true }
      );

      if (finalDriverId) {
        await addDoc(collection(db, "notifications"), {
          userId: finalDriverId,
          type: "review",
          title: "New Review",
          message: `${passengerEmail} rated you ${rating} star${rating === 1 ? "" : "s"}.`,
          rideId,
          driverId: finalDriverId,
          passengerId,
          read: false,
          createdAt: now,
          actionUrl: `/driver-profile?driverId=${finalDriverId}`,
        });
      }

      setAlreadyRated(true);
      setComment("");
      setDriverRatings(updatedRatings);
      setMessage("Rating submitted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const driverName =
    driver?.name || ride?.driverEmail?.split("@")[0] || "RoadLink Driver";

  const driverPhoto = driver?.photoURL || "";

  return (
    <main className="page">
      <section className="card">
        <div className="topActions">
          <Link href="/find-ride" className="miniButton">← Back</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/my-bookings" className="miniButton">My Bookings</Link>
          <Link href="/reviews" className="miniButton">Reviews</Link>
        </div>

        <div className="logo">Road<span>Link</span></div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Ratings</p>
            <h1>Rate <span>Driver</span></h1>
            <p className="subtitle">
              Share your experience and help RoadLink build a safer, more trusted ride community.
            </p>
          </div>

          <div className="scoreOrb">
            <strong>{averageDisplay}</strong>
            <span>{driverRatings.length} review{driverRatings.length === 1 ? "" : "s"}</span>
          </div>
        </section>

        {ride && (
          <div className="tripBox">
            <p className="eyebrow">Trip Summary</p>

            <h2>{ride.from || "Starting point"} → {ride.to || "Destination"}</h2>

            <div className="chips">
              <span>📅 {ride.date || "Date"}</span>
              <span>🕒 {ride.time || "Time"}</span>
              <span>🚘 {ride.vehicle || "Vehicle not provided"}</span>
              <span>🛡️ {ride.status || "Completed"}</span>
            </div>
          </div>
        )}

        <div className="driverBox">
          {driverPhoto ? (
            <img src={driverPhoto} alt={driverName} className="driverPhoto" />
          ) : (
            <div className="avatar">
              {driverName.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <p className="eyebrow">Driver</p>
            <h2>{driverName}</h2>
            <p>{ride?.driverEmail || driver?.email || "Verified RoadLink Driver"}</p>

            <div className="verified">✓ Verified Member</div>
          </div>
        </div>

        <section className="ratingPanel">
          <p className="eyebrow">Your Rating</p>

          <div className="stars" aria-label="Rate driver from 1 to 5 stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`${star} star rating`}
                className={star <= visibleRating ? "star activeStar" : "star"}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                disabled={alreadyRated || loading}
              >
                ★
              </button>
            ))}
          </div>

          <h3>{ratingLabel}</h3>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Write a short comment about the driver..."
            disabled={alreadyRated || loading}
          />

          <button
            className="submitButton"
            onClick={submitRating}
            disabled={loading || alreadyRated}
          >
            {loading ? "Submitting..." : alreadyRated ? "Rating Submitted" : "Submit Rating"}
          </button>

          {driverId && (
            <Link href={`/driver-profile?driverId=${driverId}`} className="outlineButton">
              View Driver Profile
            </Link>
          )}
        </section>

        {message && <p className="message">{message}</p>}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 900px;
          margin: 0 auto;
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 30px;
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

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        .eyebrow,
        .activeStar,
        .message,
        .scoreOrb strong {
          color: #22c55e;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
          margin-bottom: 24px;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        .subtitle,
        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow: 0 16px 50px rgba(34,197,94,0.18);
        }

        .scoreOrb strong {
          font-size: 32px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
        }

        .tripBox,
        .driverBox,
        .ratingPanel {
          margin-top: 24px;
          padding: 22px;
          border-radius: 24px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .driverBox {
          display: flex;
          gap: 18px;
          align-items: center;
        }

        .avatar,
        .driverPhoto {
          min-width: 76px;
          width: 76px;
          height: 76px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.45);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          font-weight: 900;
        }

        .driverPhoto {
          object-fit: cover;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 8px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .chips span {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .verified {
          display: inline-flex;
          margin-top: 10px;
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .stars {
          display: flex;
          gap: 8px;
          margin: 8px 0 12px;
        }

        .star {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.22);
          font-size: 52px;
          cursor: pointer;
          padding: 0;
        }

        .activeStar {
          text-shadow: 0 0 24px rgba(34,197,94,0.45);
        }

        h3 {
          font-size: 26px;
          margin: 0 0 18px;
        }

        textarea {
          width: 100%;
          min-height: 130px;
          padding: 18px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 16px;
          outline: none;
          resize: vertical;
          font-family: Arial, sans-serif;
        }

        textarea:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        .submitButton,
        .outlineButton {
          width: 100%;
          display: block;
          margin-top: 18px;
          padding: 18px;
          border-radius: 999px;
          font-size: 17px;
          font-weight: 900;
          text-align: center;
          text-decoration: none;
        }

        .submitButton {
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          cursor: pointer;
        }

        .outlineButton {
          color: white;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .submitButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .message {
          text-align: center;
          font-weight: 900;
          margin-top: 18px;
        }

        @media (max-width: 700px) {
          .page { padding: 16px; }

          .card {
            padding: 24px;
            border-radius: 28px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          h1 { font-size: 48px; }

          .driverBox { align-items: flex-start; }

          .stars {
            justify-content: space-between;
          }

          .star {
            font-size: 42px;
          }

          .scoreOrb {
            min-width: 100px;
            height: 100px;
          }
        }
      `}</style>
    </main>
  );
                 }
