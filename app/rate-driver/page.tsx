"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  vehicle?: string;
  status?: string;
  ratingId?: string;
  driverRated?: boolean;
  createdAt?: string;
};

type DriverProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  ratingAverage?: number;
  ratingCount?: number;
};

type Rating = {
  id: string;
  bookingId?: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
};

export default function RateDriverPage() {
  return (
    <Suspense fallback={<main className="page">Loading...</main>}>
      <RateDriverContent />
    </Suspense>
  );
}

function RateDriverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingIdFromUrl = searchParams.get("bookingId") || "";

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState(bookingIdFromUrl);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("Loading completed trips...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;
    let unsubscribeRatings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setMessage("Please sign in to rate a driver.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setMessage("");

      unsubscribeBookings = onSnapshot(
        query(collection(db, "bookings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[];

          const completed = data
            .filter((item) =>
              ["completed", "paid"].includes(String(item.status || ""))
            )
            .sort((a, b) =>
              String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
            );

          setBookings(completed);

          if (!selectedBookingId && completed.length > 0) {
            setSelectedBookingId(completed[0].id);
          }

          if (completed.length === 0) {
            setMessage("No completed trips available to rate yet.");
          }
        },
        (error) => setMessage(error.message)
      );

      unsubscribeRatings = onSnapshot(
        query(collection(db, "ratings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Rating[];

          setRatings(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribeRatings) unsubscribeRatings();
    };
  }, [router, selectedBookingId]);

  useEffect(() => {
    async function loadBooking() {
      if (!selectedBookingId) return;

      try {
        const bookingSnap = await getDoc(doc(db, "bookings", selectedBookingId));

        if (!bookingSnap.exists()) {
          setSelectedBooking(null);
          setMessage("Booking not found.");
          return;
        }

        const booking = {
          id: bookingSnap.id,
          ...bookingSnap.data(),
        } as Booking;

        setSelectedBooking(booking);

        if (booking.driverId) {
          const driverSnap = await getDoc(doc(db, "users", booking.driverId));

          if (driverSnap.exists()) {
            setDriverProfile(driverSnap.data() as DriverProfile);
          }
        }

        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Could not load booking.");
      }
    }

    loadBooking();
  }, [selectedBookingId]);

  const alreadyRated = useMemo(() => {
    if (!selectedBooking) return false;

    return ratings.some(
      (rating) =>
        rating.bookingId === selectedBooking.id ||
        (rating.rideId === selectedBooking.rideId &&
          rating.driverId === selectedBooking.driverId)
    );
  }, [ratings, selectedBooking]);

  const driverName =
    driverProfile?.name ||
    selectedBooking?.driverEmail ||
    "RoadLink Driver";

  function renderStars(value: number) {
    return "★".repeat(value) + "☆".repeat(5 - value);
  }

  async function submitRating() {
    if (!userId || !selectedBooking) {
      setMessage("Please select a completed trip.");
      return;
    }

    if (!selectedBooking.driverId) {
      setMessage("Driver not found.");
      return;
    }

    if (alreadyRated || selectedBooking.driverRated) {
      setMessage("You already rated this trip.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      const ratingRef = await addDoc(collection(db, "ratings"), {
        bookingId: selectedBooking.id,
        rideId: selectedBooking.rideId || "",
        driverId: selectedBooking.driverId,
        driverEmail: selectedBooking.driverEmail || "",
        passengerId: userId,
        passengerEmail: userEmail,
        reviewerEmail: userEmail,
        stars,
        rating: stars,
        comment: comment.trim(),
        from: selectedBooking.from || "",
        to: selectedBooking.to || "",
        vehicle: selectedBooking.vehicle || "",
        createdAt: now,
      });

      await updateDoc(doc(db, "bookings", selectedBooking.id), {
        driverRated: true,
        ratingId: ratingRef.id,
        updatedAt: now,
      });

      const driverRef = doc(db, "users", selectedBooking.driverId);
      const driverSnap = await getDoc(driverRef);

      if (driverSnap.exists()) {
        const data = driverSnap.data() as DriverProfile;

        const oldAverage = Number(data.ratingAverage || 0);
        const oldCount = Number(data.ratingCount || 0);
        const newCount = oldCount + 1;
        const newAverage = (oldAverage * oldCount + stars) / newCount;

        await updateDoc(driverRef, {
          ratingAverage: Number(newAverage.toFixed(2)),
          ratingCount: newCount,
          updatedAt: now,
        });
      }

      await addDoc(collection(db, "notifications"), {
        userId: selectedBooking.driverId,
        type: "rating",
        title: "New Driver Rating",
        message: `${userEmail} rated you ${stars} stars.`,
        rideId: selectedBooking.rideId || "",
        bookingId: selectedBooking.id,
        read: false,
        createdAt: now,
        actionUrl: "/reviews",
      });

      setMessage("Driver rated successfully.");

      setTimeout(() => router.push("/reviews"), 1000);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/my-bookings" className="miniButton">My Bookings</Link>
          <Link href="/reviews" className="miniButton">Reviews</Link>
        </div>

        <p className="eyebrow">RoadLink Reputation</p>
        <h1>Rate <span>Driver</span></h1>
        <p className="subtitle">Rate your completed trip and help build RoadLink trust.</p>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card">
        <label>Select Completed Trip</label>

        <select
          value={selectedBookingId}
          onChange={(event) => setSelectedBookingId(event.target.value)}
        >
          <option value="">Select a completed booking</option>

          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.from || "Origin"} → {booking.to || "Destination"}
            </option>
          ))}
        </select>

        {selectedBooking && (
          <>
            <div className="driverBox">
              <div className="avatar">{driverName.charAt(0).toUpperCase()}</div>

              <div>
                <h2>{driverName}</h2>
                <p>{selectedBooking.driverEmail || "Driver email not available"}</p>
                <small>
                  {selectedBooking.from || "Origin"} → {selectedBooking.to || "Destination"}
                </small>
              </div>
            </div>

            <label>Overall Rating</label>

            <div className="stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStars(value)}
                  className="starButton"
                >
                  {stars >= value ? "★" : "☆"}
                </button>
              ))}
            </div>

            <div className="scoreBox">
              <strong>{stars}/5</strong>
              <span>{renderStars(stars)}</span>
            </div>

            <label>Comment</label>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell future passengers about your experience..."
            />

            <button
              className="submitButton"
              onClick={submitRating}
              disabled={saving || alreadyRated || Boolean(selectedBooking.driverRated)}
            >
              {alreadyRated || selectedBooking.driverRated
                ? "Already Rated"
                : saving
                ? "Submitting..."
                : "Submit Rating"}
            </button>
          </>
        )}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 130px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .card {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 32px;
          margin-bottom: 20px;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 26px;
        }

        .miniButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          padding: 11px 18px;
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
          font-size: 58px;
          line-height: 1;
          margin: 0 0 14px;
        }

        h1 span,
        .scoreBox strong {
          color: #22c55e;
        }

        .subtitle,
        .driverBox p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          max-width: 900px;
          margin: 0 auto 18px;
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .card {
          border-radius: 30px;
          padding: 30px;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 18px 0 8px;
        }

        select,
        textarea {
          width: 100%;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          padding: 16px;
          font-size: 16px;
          outline: none;
          font-family: Arial, sans-serif;
        }

        option {
          color: black;
        }

        textarea {
          resize: vertical;
          min-height: 130px;
        }

        .driverBox {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          align-items: center;
          margin: 22px 0;
          padding: 18px;
          border-radius: 24px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.24);
        }

        .avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 900;
        }

        .driverBox h2 {
          margin: 0 0 6px;
          font-size: 24px;
          overflow-wrap: anywhere;
        }

        .driverBox p {
          margin: 0 0 5px;
          overflow-wrap: anywhere;
        }

        .driverBox small {
          color: #22c55e;
          font-weight: 900;
        }

        .stars {
          display: flex;
          gap: 8px;
          margin: 10px 0 12px;
        }

        .starButton {
          border: none;
          background: transparent;
          color: #facc15;
          font-size: 44px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .scoreBox {
          padding: 18px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
          margin: 18px 0;
        }

        .scoreBox strong {
          display: block;
          font-size: 34px;
        }

        .scoreBox span {
          color: #facc15;
          letter-spacing: 2px;
          font-size: 22px;
        }

        .submitButton {
          width: 100%;
          margin-top: 22px;
          border: none;
          border-radius: 999px;
          padding: 18px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        .submitButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 130px;
          }

          .hero,
          .card {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .driverBox {
            grid-template-columns: 1fr;
          }

          .starButton {
            font-size: 38px;
          }
        }
      `}</style>
    </main>
  );
              }
