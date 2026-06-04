"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
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
};

export default function RateDriverPage() {
  const [rideId, setRideId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [passengerId, setPassengerId] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
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

        const ratingQuery = query(
          collection(db, "ratings"),
          where("rideId", "==", currentRideId),
          where("passengerId", "==", user.uid)
        );

        const ratingSnapshot = await getDocs(ratingQuery);

        if (!ratingSnapshot.empty) {
          setAlreadyRated(true);
          setMessage("You already rated this driver.");
          return;
        }

        setMessage("");
      } catch (error: unknown) {
        if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage("Something went wrong.");
        }
      }
    });

    return () => unsubscribe();
  }, []);

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

      await addDoc(collection(db, "ratings"), {
        rideId,
        driverId: driverId || ride?.driverId || "",
        driverEmail: ride?.driverEmail || "",
        passengerId,
        passengerEmail,
        rating,
        comment: comment.trim(),
        from: ride?.from || "",
        to: ride?.to || "",
        createdAt: new Date().toISOString(),
      });

      setAlreadyRated(true);
      setComment("");
      setMessage("Rating submitted successfully.");
    } catch (error: unknown) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  const visibleRating = hoverRating || rating;

  return (
    <main className="page">
      <section className="card">
        <div className="topActions">
          <Link href="/find-ride" className="miniButton">
            ← Back
          </Link>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/my-bookings" className="miniButton">
            My Bookings
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>
          Rate <span>Driver</span>
        </h1>

        <p className="subtitle">
          Share your experience and help RoadLink build trust.
        </p>

        {ride && (
          <div className="tripBox">
            <p className="eyebrow">Trip</p>
            <h2>
              {ride.from || "Starting point"} → {ride.to || "Destination"}
            </h2>
            <p>
              {ride.date || "Date"} • {ride.time || "Time"}
            </p>
            <p>{ride.vehicle || "Vehicle not provided"}</p>
          </div>
        )}

        <div className="driverBox">
          <div className="avatar">D</div>

          <div>
            <p className="eyebrow">Driver</p>
            <h2>RoadLink Driver</h2>
            <p>{ride?.driverEmail || "Verified RoadLink Driver"}</p>
            <div className="verified">✓ Verified Member</div>
          </div>
        </div>

        <div className="stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
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

        <h3>
          {visibleRating === 0
            ? "Choose your rating"
            : visibleRating === 1
            ? "Poor experience"
            : visibleRating === 2
            ? "Could be better"
            : visibleRating === 3
            ? "Good experience"
            : visibleRating === 4
            ? "Great experience"
            : "Excellent driver"}
        </h3>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a short comment about the driver..."
          disabled={alreadyRated || loading}
        />

        <button
          className="submitButton"
          onClick={submitRating}
          disabled={loading || alreadyRated}
        >
          {loading
            ? "Submitting..."
            : alreadyRated
            ? "Rating Submitted"
            : "Submit Rating"}
        </button>

        {message && <p className="message">{message}</p>}
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

        .card {
          max-width: 860px;
          margin: 0 auto;
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 32px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
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
        .message {
          color: #22c55e;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        .subtitle,
        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .tripBox,
        .driverBox {
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

        .avatar {
          min-width: 76px;
          height: 76px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          font-weight: 900;
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
          margin: 30px 0 12px;
        }

        .star {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.22);
          font-size: 48px;
          cursor: pointer;
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
        }

        .submitButton {
          width: 100%;
          margin-top: 24px;
          padding: 20px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 19px;
          font-weight: 900;
          cursor: pointer;
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
          .page {
            padding: 16px;
          }

          .card {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 48px;
          }

          .driverBox {
            align-items: flex-start;
          }

          .stars {
            justify-content: space-between;
          }

          .star {
            font-size: 42px;
          }
        }
      `}</style>
    </main>
  );
}
