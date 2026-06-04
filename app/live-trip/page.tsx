"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
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
};

type Booking = {
  passengerId?: string;
  passengerEmail?: string;
};

type Profile = {
  name: string;
  email: string;
  photoURL: string;
};

type LocationData = {
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
};

export default function LiveTripPage() {
  const [rideId, setRideId] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [driverProfile, setDriverProfile] = useState<Profile>({
    name: "RoadLink Driver",
    email: "",
    photoURL: "",
  });

  const [passengerProfile, setPassengerProfile] = useState<Profile>({
    name: "RoadLink Passenger",
    email: "",
    photoURL: "",
  });

  const [driverLocation, setDriverLocation] = useState<LocationData | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<LocationData | null>(null);

  const [message, setMessage] = useState("Loading live trip...");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentRideId = params.get("rideId") || "";

    setRideId(currentRideId);

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setMessage("Please sign in to view live trip.");
        return;
      }

      if (!currentRideId) {
        setMessage("No ride selected.");
        return;
      }

      try {
        const rideRef = doc(db, "rides", currentRideId);
        const rideSnap = await getDoc(rideRef);

        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        const rideData = rideSnap.data() as Ride;
        setRide(rideData);

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", currentRideId),
          where("status", "==", "reserved"),
          limit(1)
        );

        const bookingsSnap = await getDocs(bookingsQuery);
        const bookingData = bookingsSnap.empty
          ? null
          : (bookingsSnap.docs[0].data() as Booking);

        if (rideData.driverId) {
          const driver = await loadProfile(
            rideData.driverId,
            rideData.driverEmail || "RoadLink Driver"
          );
          setDriverProfile(driver);
        }

        if (bookingData?.passengerId) {
          const passenger = await loadProfile(
            bookingData.passengerId,
            bookingData.passengerEmail || "RoadLink Passenger"
          );
          setPassengerProfile(passenger);
        } else if (currentUser.uid !== rideData.driverId) {
          setPassengerProfile({
            name: currentUser.displayName || "RoadLink Passenger",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
          });
        }

        setMessage("");
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!rideId || !ride?.driverId) return;

    const driverLocationRef = doc(db, "locations", `${rideId}_${ride.driverId}`);

    const unsubscribeDriver = onSnapshot(driverLocationRef, (snapshot) => {
      if (snapshot.exists()) {
        setDriverLocation(snapshot.data() as LocationData);
      }
    });

    return () => unsubscribeDriver();
  }, [rideId, ride?.driverId]);

  useEffect(() => {
    if (!rideId || !user?.uid) return;

    const passengerLocationRef = doc(db, "locations", `${rideId}_${user.uid}`);

    const unsubscribePassenger = onSnapshot(passengerLocationRef, (snapshot) => {
      if (snapshot.exists()) {
        setPassengerLocation(snapshot.data() as LocationData);
      }
    });

    return () => unsubscribePassenger();
  }, [rideId, user?.uid]);

  async function loadProfile(userId: string, fallbackEmail: string): Promise<Profile> {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();

        return {
          name: String(data.name || data.displayName || "RoadLink User"),
          email: String(data.email || fallbackEmail),
          photoURL: String(data.photoURL || data.profilePhoto || data.avatarUrl || ""),
        };
      }

      return {
        name: "RoadLink User",
        email: fallbackEmail,
        photoURL: "",
      };
    } catch {
      return {
        name: "RoadLink User",
        email: fallbackEmail,
        photoURL: "",
      };
    }
  }

  async function shareLocation() {
    if (!user || !rideId) {
      setMessage("Please sign in and select a ride first.");
      return;
    }

    if (!navigator.geolocation) {
      setMessage("GPS is not supported on this device.");
      return;
    }

    setSharing(true);
    setMessage("Requesting GPS permission...");

    navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await setDoc(doc(db, "locations", `${rideId}_${user.uid}`), {
            rideId,
            userId: user.uid,
            userEmail: user.email || "",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            updatedAt: new Date().toISOString(),
          });

          setMessage("Live location is being shared.");
        } catch (error: unknown) {
          setMessage(error instanceof Error ? error.message : "Something went wrong.");
        }
      },
      () => {
        setSharing(false);
        setMessage("Location permission was denied.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/find-ride" className="miniButton">Find Ride</Link>
          <Link href="/chat" className="miniButton">Chat</Link>
        </div>

        <div className="logo">Road<span>Link</span></div>

        <h1>Live <span>Trip</span></h1>

        <p className="subtitle">
          Track your ride, view driver and passenger profiles, and share GPS location safely.
        </p>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="routeCard">
        <p className="eyebrow">Trip Route</p>

        <h2>
          {ride?.from || "Starting point"} <span>→</span> {ride?.to || "Destination"}
        </h2>

        <div className="chips">
          <span>📅 {ride?.date || "Date"}</span>
          <span>🕒 {ride?.time || "Time"}</span>
          <span>🟢 Live Tracking</span>
        </div>
      </section>

      <section className="profiles">
        <ProfileCard title="Driver" profile={driverProfile} location={driverLocation} />
        <ProfileCard title="Passenger" profile={passengerProfile} location={passengerLocation} />
      </section>

      <section className="mapCard">
        <p className="eyebrow">GPS Status</p>
        <h2>Live Location</h2>

        <div className="mapVisual">
          <div className="pulse">📍</div>
          <p>GPS tracking active when users share their location.</p>
        </div>

        <button onClick={shareLocation} disabled={sharing} className="shareButton">
          {sharing ? "Sharing Location..." : "Share My Location"}
        </button>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero, .routeCard, .profiles, .mapCard {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero, .routeCard, .profileCard, .mapCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
          border-radius: 32px;
        }

        .hero {
          padding: 30px;
          margin-bottom: 22px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 28px;
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
          margin-bottom: 26px;
        }

        .logo span, h1 span, h2 span, .eyebrow, .message {
          color: #22c55e;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0 0 18px;
        }

        .subtitle, .message {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .routeCard, .mapCard {
          padding: 28px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chips span {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          font-weight: 800;
        }

        .profiles {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 22px;
        }

        .profileCard {
          padding: 24px;
        }

        .photo {
          width: 86px;
          height: 86px;
          border-radius: 50%;
          object-fit: cover;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: 2px solid rgba(34,197,94,0.45);
          box-shadow: 0 16px 50px rgba(34,197,94,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .profileCard h3 {
          font-size: 26px;
          margin: 0 0 8px;
        }

        .profileCard p {
          color: #a1a1aa;
          margin: 6px 0;
          overflow-wrap: anywhere;
        }

        .locationBox {
          margin-top: 16px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .locationBox strong {
          color: #22c55e;
        }

        .mapVisual {
          min-height: 240px;
          border-radius: 26px;
          background:
            radial-gradient(circle at center, rgba(34,197,94,0.20), transparent 30%),
            rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
        }

        .pulse {
          width: 86px;
          height: 86px;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          margin-bottom: 18px;
        }

        .mapVisual p {
          color: #a1a1aa;
          max-width: 520px;
          line-height: 1.5;
        }

        .shareButton {
          width: 100%;
          margin-top: 20px;
          padding: 20px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .shareButton:disabled {
          opacity: 0.65;
        }

        @media (max-width: 700px) {
          .page { padding: 16px; }

          .hero, .routeCard, .profileCard, .mapCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 { font-size: 48px; }
          h2 { font-size: 30px; }

          .profiles {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function ProfileCard({
  title,
  profile,
  location,
}: {
  title: string;
  profile: Profile;
  location: LocationData | null;
}) {
  const firstLetter = profile.name?.charAt(0).toUpperCase() || "R";

  return (
    <div className="profileCard">
      {profile.photoURL ? (
        <img src={profile.photoURL} alt={profile.name} className="photo" />
      ) : (
        <div className="photo">{firstLetter}</div>
      )}

      <p className="eyebrow">{title}</p>
      <h3>{profile.name}</h3>
      <p>{profile.email || "No email available"}</p>

      <div className="locationBox">
        {location?.latitude && location?.longitude ? (
          <>
            <p><strong>GPS Active</strong></p>
            <p>Lat: {location.latitude.toFixed(5)}</p>
            <p>Lng: {location.longitude.toFixed(5)}</p>
          </>
        ) : (
          <p>GPS not shared yet.</p>
        )}
      </div>
    </div>
  );
      }
