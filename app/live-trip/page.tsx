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
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type TripStatus =
  | "driver_assigned"
  | "driver_arriving"
  | "passenger_picked_up"
  | "trip_started"
  | "near_destination"
  | "completed"
  | "cancelled";

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  driverId?: string;
  driverEmail?: string;
  vehicle?: string;
  mapUrl?: string;
  status?: string;
  distanceText?: string;
  durationText?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  from?: string;
  to?: string;
};

type LiveTrip = {
  id?: string;
  rideId?: string;
  bookingId?: string;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  status?: TripStatus;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  etaMinutes?: number;
  currentSpeed?: number | null;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

const tripSteps: {
  key: TripStatus;
  title: string;
  icon: string;
  description: string;
}[] = [
  {
    key: "driver_assigned",
    title: "Driver Assigned",
    icon: "👤",
    description: "The driver and passenger are connected.",
  },
  {
    key: "driver_arriving",
    title: "Driver Arriving",
    icon: "🚗",
    description: "Driver is heading to pickup.",
  },
  {
    key: "passenger_picked_up",
    title: "Passenger Picked Up",
    icon: "✅",
    description: "Passenger is now inside the vehicle.",
  },
  {
    key: "trip_started",
    title: "Trip Started",
    icon: "🛣️",
    description: "The trip is actively in progress.",
  },
  {
    key: "near_destination",
    title: "Near Destination",
    icon: "📍",
    description: "The trip is close to the destination.",
  },
  {
    key: "completed",
    title: "Completed",
    icon: "🏁",
    description: "Trip completed successfully.",
  },
  {
    key: "cancelled",
    title: "Cancelled",
    icon: "❌",
    description: "Trip was cancelled.",
  },
];

export default function LiveTripPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LiveTripContent />
    </Suspense>
  );
}

function Loading() {
  return (
    <main className="page">
      <p className="status">Loading live trip...</p>
      <PageStyles />
    </main>
  );
}

function LiveTripContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [rideId, setRideId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [liveTrip, setLiveTrip] = useState<LiveTrip | null>(null);
  const [liveTripId, setLiveTripId] = useState("");

  const [status, setStatus] = useState("Loading live trip...");
  const [saving, setSaving] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const urlRideId = searchParams.get("rideId") || "";
    const urlBookingId = searchParams.get("bookingId") || "";

    setRideId(urlRideId);
    setBookingId(urlBookingId);

    if (!urlRideId && !urlBookingId) {
      setStatus("Missing rideId or bookingId in URL.");
    }
  }, [searchParams]);

  useEffect(() => {
    let unsubscribeLiveTrip: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email || "",
          online: true,
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeLiveTrip) unsubscribeLiveTrip();
    };
  }, [router]);

  useEffect(() => {
    if (!userId || (!rideId && !bookingId)) return;

    let unsubscribeLive: (() => void) | undefined;

    async function loadData() {
      try {
        setStatus("");

        let finalRideId = rideId;
        let finalBookingId = bookingId;
        let finalBooking: Booking | null = null;

        if (finalBookingId) {
          const bookingSnap = await getDoc(doc(db, "bookings", finalBookingId));

          if (bookingSnap.exists()) {
            finalBooking = {
              id: bookingSnap.id,
              ...bookingSnap.data(),
            } as Booking;

            setBooking(finalBooking);
            finalRideId = finalRideId || finalBooking.rideId || "";
          }
        }

        if (finalRideId) {
          const rideSnap = await getDoc(doc(db, "rides", finalRideId));

          if (rideSnap.exists()) {
            const rideData = {
              id: rideSnap.id,
              ...rideSnap.data(),
            } as Ride;

            setRide(rideData);
          }
        }

        setRideId(finalRideId);
        setBookingId(finalBookingId);

        const liveQuery = finalBookingId
          ? query(collection(db, "liveTrips"), where("bookingId", "==", finalBookingId))
          : query(collection(db, "liveTrips"), where("rideId", "==", finalRideId));

        unsubscribeLive = onSnapshot(
          liveQuery,
          async (snapshot) => {
            if (snapshot.empty) {
              const now = new Date().toISOString();

              const driverId = finalBooking?.driverId || ride?.driverId || "";
              const passengerId = finalBooking?.passengerId || "";

              const created = await addDoc(collection(db, "liveTrips"), {
                rideId: finalRideId,
                bookingId: finalBookingId,
                driverId,
                passengerId,
                driverEmail: finalBooking?.driverEmail || ride?.driverEmail || "",
                passengerEmail: finalBooking?.passengerEmail || "",
                status: "driver_assigned",
                latitude: null,
                longitude: null,
                accuracy: null,
                etaMinutes: 0,
                currentSpeed: null,
                note: "",
                createdAt: now,
                updatedAt: now,
              });

              setLiveTripId(created.id);
              return;
            }

            const document = snapshot.docs[0];
            const data = {
              id: document.id,
              ...document.data(),
            } as LiveTrip;

            setLiveTrip(data);
            setLiveTripId(document.id);
            setNote(data.note || "");
          },
          (error) => setStatus(error.message)
        );
      } catch (error: unknown) {
        setStatus(error instanceof Error ? error.message : "Could not load live trip.");
      }
    }

    loadData();

    return () => {
      if (unsubscribeLive) unsubscribeLive();
    };
  }, [userId, rideId, bookingId, ride?.driverId, ride?.driverEmail]);

  const currentStatus: TripStatus = liveTrip?.status || "driver_assigned";
  const currentIndex = tripSteps.findIndex((step) => step.key === currentStatus);
  const progress = currentIndex >= 0 ? Math.round(((currentIndex + 1) / tripSteps.length) * 100) : 0;

  const isDriver = Boolean(userId && (ride?.driverId === userId || booking?.driverId === userId));
  const isPassenger = Boolean(userId && booking?.passengerId === userId);
  const canControl = isDriver;

  const currentStep = useMemo(() => {
    return tripSteps.find((step) => step.key === currentStatus) || tripSteps[0];
  }, [currentStatus]);

  const mapUrl =
    liveTrip?.latitude && liveTrip?.longitude
      ? `https://www.google.com/maps?q=${liveTrip.latitude},${liveTrip.longitude}`
      : ride?.mapUrl || "";

  async function getLocation() {
    if (!navigator.geolocation) {
      setStatus("GPS is not available.");
      return null;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
      };
    } catch {
      setStatus("GPS permission denied or unavailable.");
      return null;
    }
  }

  async function updateLiveLocation() {
    if (!liveTripId) return;

    try {
      setTracking(true);
      setStatus("");

      const location = await getLocation();

      if (!location) return;

      await updateDoc(doc(db, "liveTrips", liveTripId), {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        currentSpeed: location.speed,
        updatedAt: new Date().toISOString(),
      });

      setStatus("Live location updated.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update location.");
    } finally {
      setTracking(false);
    }
  }

  async function updateTripStatus(nextStatus: TripStatus) {
    if (!liveTripId) return;

    try {
      setSaving(true);
      setStatus("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "liveTrips", liveTripId), {
        status: nextStatus,
        updatedAt: now,
      });

      if (rideId) {
        await updateDoc(doc(db, "rides", rideId), {
          liveStatus: nextStatus,
          status:
            nextStatus === "completed"
              ? "completed"
              : nextStatus === "cancelled"
              ? "cancelled"
              : ride?.status || "active",
          updatedAt: now,
        });
      }

      if (bookingId) {
        await updateDoc(doc(db, "bookings", bookingId), {
          liveStatus: nextStatus,
          status:
            nextStatus === "completed"
              ? "completed"
              : nextStatus === "cancelled"
              ? "cancelled"
              : booking?.status || "confirmed",
          updatedAt: now,
        });
      }

      const receiverId = isDriver ? booking?.passengerId : ride?.driverId || booking?.driverId;

      if (receiverId) {
        await addDoc(collection(db, "notifications"), {
          userId: receiverId,
          type: "ride",
          title: "Live Trip Update",
          message: `Trip status updated to ${tripSteps.find((step) => step.key === nextStatus)?.title || nextStatus}.`,
          rideId,
          bookingId,
          read: false,
          createdAt: now,
          actionUrl: `/live-trip?rideId=${rideId}&bookingId=${bookingId}`,
        });
      }

      setStatus("Live trip updated.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update live trip.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    if (!liveTripId) return;

    try {
      setSaving(true);

      await updateDoc(doc(db, "liveTrips", liveTripId), {
        note: note.trim(),
        updatedAt: new Date().toISOString(),
      });

      setStatus("Trip note saved.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not save note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/my-bookings" className="navButton">My Bookings</Link>
          <Link href="/my-rides" className="navButton">My Rides</Link>
          <Link href="/sos" className="navButton">SOS</Link>
          <Link href="/notifications" className="navButton">Notifications</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Live Trip</p>
            <h1>Live <span>Trip Status</span></h1>
            <p className="subtitle">
              Track the trip status, GPS location, ETA, safety notes and route progress in real time.
            </p>
          </div>

          <div className="liveOrb">
            <strong>{currentStep.icon}</strong>
            <span>{currentStep.title}</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="📍" label="Route" value={`${ride?.from || booking?.from || "Origin"} → ${ride?.to || booking?.to || "Destination"}`} />
          <Metric icon="🚗" label="Vehicle" value={ride?.vehicle || "Vehicle pending"} />
          <Metric icon="⏱️" label="ETA" value={liveTrip?.etaMinutes ? `${liveTrip.etaMinutes} min` : ride?.durationText || "Pending"} />
          <Metric icon="🛡️" label="Role" value={isDriver ? "Driver" : isPassenger ? "Passenger" : "Viewer"} />
        </section>

        <section className="progressPanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Trip Progress</p>
              <h2>{currentStep.title}</h2>
              <p>{currentStep.description}</p>
            </div>

            <div className="progressPill">{progress}%</div>
          </div>

          <div className="bar">
            <div style={{ width: `${progress}%` }} />
          </div>

          <div className="steps">
            {tripSteps.map((step, index) => {
              const active = index <= currentIndex;

              return (
                <div key={step.key} className={active ? "step activeStep" : "step"}>
                  <span>{step.icon}</span>
                  <strong>{step.title}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mainGrid">
          <section className="card">
            <p className="eyebrow">Live Controls</p>
            <h2>Driver Status Updates</h2>

            {canControl ? (
              <div className="controlGrid">
                {tripSteps.map((step) => (
                  <button
                    key={step.key}
                    onClick={() => updateTripStatus(step.key)}
                    disabled={saving || currentStatus === step.key}
                    className={currentStatus === step.key ? "activeButton" : ""}
                  >
                    {step.icon} {step.title}
                  </button>
                ))}
              </div>
            ) : (
              <div className="lockedBox">
                <h3>View Only</h3>
                <p>Only the assigned driver can update the live trip status.</p>
              </div>
            )}
          </section>

          <section className="card">
            <p className="eyebrow">Location</p>
            <h2>GPS Tracking</h2>

            <div className="locationGrid">
              <Info label="Latitude" value={liveTrip?.latitude ? String(liveTrip.latitude) : "Pending"} />
              <Info label="Longitude" value={liveTrip?.longitude ? String(liveTrip.longitude) : "Pending"} />
              <Info label="Accuracy" value={liveTrip?.accuracy ? `${Math.round(liveTrip.accuracy)} meters` : "Unknown"} />
              <Info label="Speed" value={liveTrip?.currentSpeed ? `${Math.round(liveTrip.currentSpeed)} m/s` : "Unknown"} />
            </div>

            <button className="locationButton" onClick={updateLiveLocation} disabled={tracking}>
              {tracking ? "Updating..." : "Update Live Location"}
            </button>

            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mapButton">
                Open Map
              </a>
            )}
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Trip Note</p>
          <h2>Safety / Pickup Notes</h2>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add pickup, safety, or trip notes..."
          />

          <button className="saveButton" onClick={saveNote} disabled={saving}>
            {saving ? "Saving..." : "Save Note"}
          </button>
        </section>
      </section>

      <PageStyles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PageStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 120px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
          radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1120px;
        margin: auto;
      }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton,
      .mapButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        display: inline-flex;
        justify-content: center;
      }

      .hero,
      .metric,
      .progressPanel,
      .card {
        background: rgba(8,13,25,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 35px;
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .eyebrow {
        color: #22c55e;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 60px;
        line-height: 1;
      }

      h1 span,
      h2,
      .metric strong,
      .liveOrb strong,
      .progressPill {
        color: #22c55e;
      }

      .subtitle {
        color: #a1a1aa;
        max-width: 720px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .liveOrb {
        min-width: 128px;
        height: 128px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .liveOrb strong {
        font-size: 36px;
      }

      .liveOrb span {
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 900;
        max-width: 90px;
      }

      .status {
        text-align: center;
        color: #22c55e;
        font-weight: 900;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric {
        padding: 18px;
        border-radius: 22px;
      }

      .metricIcon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .metric span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .metric strong {
        font-size: 20px;
        overflow-wrap: anywhere;
      }

      .progressPanel,
      .card {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      .sectionHeader {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
        margin-bottom: 18px;
      }

      .sectionHeader p {
        color: #a1a1aa;
      }

      .progressPill {
        padding: 11px 16px;
        border-radius: 999px;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
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

      .steps {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 10px;
      }

      .step {
        padding: 12px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        opacity: 0.6;
      }

      .activeStep {
        opacity: 1;
        background: rgba(34,197,94,0.11);
        border-color: rgba(34,197,94,0.35);
      }

      .step span {
        display: block;
        font-size: 24px;
        margin-bottom: 6px;
      }

      .step strong {
        display: block;
        color: #e5e7eb;
        font-size: 12px;
      }

      .mainGrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .controlGrid,
      .locationGrid {
        display: grid;
        gap: 10px;
      }

      .controlGrid button,
      .locationButton,
      .saveButton {
        width: 100%;
        padding: 15px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .controlGrid .activeButton,
      .locationButton,
      .saveButton {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .lockedBox,
      .info {
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .lockedBox p {
        color: #a1a1aa;
      }

      .info span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .info strong {
        overflow-wrap: anywhere;
      }

      .mapButton {
        width: 100%;
        margin-top: 12px;
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      textarea {
        width: 100%;
        min-height: 120px;
        padding: 15px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
        resize: vertical;
        font-family: Arial, sans-serif;
        margin-bottom: 14px;
      }

      @media (max-width: 1000px) {
        .stats,
        .mainGrid,
        .steps {
          grid-template-columns: 1fr;
        }

        .hero,
        .sectionHeader {
          flex-direction: column;
          align-items: flex-start;
        }

        h1 {
          font-size: 44px;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .progressPanel,
        .card {
          padding: 22px;
          border-radius: 26px;
        }
      }
    `}</style>
  );
                }
