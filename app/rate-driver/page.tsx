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
    async function loadPage() {
      const params = new URLSearchParams(window.location.search);
      const currentRideId = params.get("rideId") || "";
      const currentDriverId = params.get("driverId") || "";

      setRideId(currentRideId);
      setDriverId(currentDriverId);

      if (!currentRideId) {
        setMessage("No ride selected.");
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setMessage("Please sign in before rating a driver.");
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
        } catch (error: any) {
          setMessage(error.message);
        }
      });

      return () => unsubscribe();
    }

    loadPage();
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
      setMessage("Rating submitted successfully. Thank you for helping RoadLink build trust.");
      setComment("");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const visibleRating = hoverRating || rating;

  return (
    <main className="page">
      <section className="hero">
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

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>
          Rate <span>Driver</span>
        </h1>

        <p className="subtitle">
          Share your experience and help future passengers choose trusted RoadLink drivers.
        </p>
      </section>

      {ride && (
        <section className="tripCard">
          <div className="routeLine">
            <div className="dot" />
            <div className="line" />
            <div className="dot" />
          </div>

          <div className="routeInfo">
            <p className="eyebrow">Trip</p>
            <h2>
              {ride.from || "Starting point"} <span>→</span>{" "}
              {ride.to || "Destination"}
            </h2>

            <div className="chips">
              <div className="chip">📅 {ride.date || "Date"}</div>
              <div className="chip">🕒 {ride.time || "Time"}</div>
              <div className="chip">🚘 {ride.vehicle || "Vehicle"}</div>
            </div>
          </div>
        </section>
      )}

      <section className="ratingCard">
        <div className="driverHeader">
          <div className="avatar">D</div>

          <div>
            <p className="eyebrow">Driver Experience</p>
            <h2>RoadLink Driver</h2>
            <p>{ride?.driverEmail || "Verified RoadLink Driver"}</p>
            <div className="verifiedBadge">✓ Verified Member</div>
          </div>
        </div>

        <div className="starsBox">
          <p className="eyebrow">Select Rating</p>

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
        </div>

        <label>Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a short comment about punctuality, communication, safety, and overall experience..."
          disabled={alreadyRated || loading}
        />

        <div className="trustGrid">
          <Info icon="🛡️" label="Trust" value="Helps future passengers" />
          <Info icon="⭐" label="Rating" value={`${rating || 0}/5 stars`} />
          <Info icon="👤" label="Passenger" value={passengerEmail || "Signed in user"} />
        </div>

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

      <section className="safetyCard">
        <div>
          <p className="eyebrow">RoadLink Trust</p>
          <h2>Why ratings matter</h2>
          <p>
            Ratings help RoadLink create safer rides, better communication, and a trusted community
            between drivers and passengers.
          </p>
        </div>

        <div className="shield">✓</div>
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

        .hero,
        .tripCard,
        .ratingCard,
        .safetyCard {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
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
          margin-bottom: 30px;
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

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h2 span,
        .eyebrow,
        .activeStar,
        .message {
          color: #22c55e;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .tripCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 22px;
          display: grid;
          grid-template-columns: 34px 1fr;
          gap: 20px;
        }

        .routeLine {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 110px;
        }

        .dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 4px solid #22c55e;
        }

        .line {
          width: 4px;
          flex: 1;
          background: #22c55e;
          opacity: 0.85;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0 0 18px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .ratingCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 22px;
        }

        .driverHeader {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
        }

        .avatar {
          min-width: 82px;
          height: 82px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          font-weight: 900;
          box-shadow: 0 16px 50px rgba(34,197,94,0.35);
        }

        .driverHeader p {
          color: #a1a1aa;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .verifiedBadge {
          display: inline-flex;
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .starsBox {
          padding: 22px;
          border-radius: 24px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 22px;
        }

        .stars {
          display: flex;
          gap: 8px;
          margin: 12px 0;
        }

        .star {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.22);
          font-size: 48px;
          cursor: pointer;
          transition: transform 0.2s ease, color 0.2s ease;
          padding: 0;
        }

        .star:hover {
          transform: scale(1.08);
        }

        .star:disabled {
          cursor: not-allowed;
        }

        .activeStar {
          text-shadow: 0 0 24px rgba(34,197,94,0.45);
        }

        h3 {
          font-size: 26px;
          margin: 8px 0 0;
        }

        label {
          display: block;
          margin-bottom: 10px;
          color: #e5e7eb;
          font-weight: 900;
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

        textarea:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        textarea::placeholder {
          color: #71717a;
        }

        .trustGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 22px;
        }

        .infoBox {
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .infoIcon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }

        .infoBox strong {
          display: block;
          color: #e5e7eb;
          margin-bottom: 4px;
        }

        .infoBox span {
          color: #a1a1aa;
          overflow-wrap: anywhere;
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
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .submitButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        .message {
          text-align: center;
          font-weight: 900;
          margin-top: 18px;
          line-height: 1.5;
        }

        .safetyCard {
          border-radius: 30px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .safetyCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        .shield {
          min-width: 78px;
          height: 78px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          font-size: 36px;
          font-weight: 900;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero,
          .tripCard,
          .ratingCard,
          .safetyCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 48px;
          }

          h2 {
            font-size: 30px;
          }

          .driverHeader {
            align-items: flex-start;
          }

          .avatar {
            min-width: 72px;
            height: 72px;
            font-size: 32px;
          }

          .stars {
            justify-content: space-between;
          }

          .star {
            font-size: 42px;
          }

          .trustGrid {
            grid-template-columns: 1fr;
          }

          .safetyCard {
            align-items: flex-start;
          }

          .shield {
            min-width: 58px;
            height: 58px;
            font-size: 28px;
          }
        }
      `}</style>
    </main>
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
    <div className="infoBox">
      <div className="infoIcon">{icon}</div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
      }
