"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

declare global {
  interface Window {
    google?: any;
  }
}

type LatLng = {
  lat: number;
  lng: number;
};

export default function OfferRidePage() {
  const router = useRouter();

  const fromInputRef = useRef<HTMLInputElement | null>(null);
  const toInputRef = useRef<HTMLInputElement | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState("1");
  const [price, setPrice] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [mapsReady, setMapsReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    function setupAutocomplete() {
      if (!window.google?.maps?.places) return;

      if (fromInputRef.current) {
        const fromAuto = new window.google.maps.places.Autocomplete(fromInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        });

        fromAuto.addListener("place_changed", () => {
          const place = fromAuto.getPlace();

          const label = place.formatted_address || place.name || "";
          setFrom(label);

          if (place.geometry?.location) {
            setFromCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        });
      }

      if (toInputRef.current) {
        const toAuto = new window.google.maps.places.Autocomplete(toInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        });

        toAuto.addListener("place_changed", () => {
          const place = toAuto.getPlace();

          const label = place.formatted_address || place.name || "";
          setTo(label);

          if (place.geometry?.location) {
            setToCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        });
      }

      if (mounted) {
        setMapsReady(true);
        setMessage("");
      }
    }

    function loadGoogleMaps() {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        setMessage("Google Maps API key is missing.");
        return;
      }

      if (typeof window === "undefined") return;

      if (window.google?.maps?.places) {
        setupAutocomplete();
        return;
      }

      const existingScript = document.getElementById("roadlink-google-maps");

      if (existingScript) {
        existingScript.addEventListener("load", setupAutocomplete);
        existingScript.addEventListener("error", () => {
          if (mounted) setMessage("Google Maps could not load.");
        });
        return;
      }

      const script = document.createElement("script");
      script.id = "roadlink-google-maps";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = setupAutocomplete;

      script.onerror = () => {
        if (mounted) setMessage("Google Maps could not load.");
      };

      document.head.appendChild(script);
    }

    loadGoogleMaps();

    return () => {
      mounted = false;
    };
  }, []);

  function buildMapUrl() {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      from.trim()
    )}&destination=${encodeURIComponent(to.trim())}`;
  }

  async function publishRide() {
    setMessage("");

    const user = auth.currentUser;

    if (!user) {
      setMessage("Please sign in before publishing a ride.");
      router.push("/login");
      return;
    }

    if (!from || !to || !date || !time || !seats || !price || !vehicle) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (Number(price) <= 0) {
      setMessage("Price must be greater than 0.");
      return;
    }

    if (Number(seats) <= 0) {
      setMessage("Seats must be greater than 0.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "rides"), {
        driverId: user.uid,
        driverEmail: user.email || "",
        from: from.trim(),
        to: to.trim(),
        fromLat: fromCoords?.lat || null,
        fromLng: fromCoords?.lng || null,
        toLat: toCoords?.lat || null,
        toLng: toCoords?.lng || null,
        date,
        time,
        seats: Number(seats),
        originalSeats: Number(seats),
        price: Number(price),
        vehicle: vehicle.trim(),
        notes: notes.trim(),
        mapUrl: buildMapUrl(),
        status: "active",
        createdAt: new Date().toISOString(),
      });

      router.push("/find-ride");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="nav">
          <button type="button" onClick={() => router.back()}>← Back</button>
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/profile">Profile</Link>
        </div>

        <h1>Road<span>Link</span></h1>
        <h2>Offer a <span>Ride</span></h2>

        <p>
          Publish your ride with Google Places autocomplete and automatic Google Maps route link.
        </p>

        <div className={mapsReady ? "mapsStatus ready" : "mapsStatus"}>
          {mapsReady ? "Google Places ready" : "Loading Google Places..."}
        </div>
      </section>

      <section className="card">
        <Field label="From *">
          <input
            ref={fromInputRef}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setFromCoords(null);
            }}
            placeholder="Miami, FL"
          />
        </Field>

        <Field label="To *">
          <input
            ref={toInputRef}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setToCoords(null);
            }}
            placeholder="Orlando, FL"
          />
        </Field>

        <Field label="Date *">
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        </Field>

        <Field label="Departure Time *">
          <input value={time} onChange={(e) => setTime(e.target.value)} type="time" />
        </Field>

        <Field label="Available Seats *">
          <select value={seats} onChange={(e) => setSeats(e.target.value)}>
            <option value="1">1 seat</option>
            <option value="2">2 seats</option>
            <option value="3">3 seats</option>
            <option value="4">4 seats</option>
            <option value="5">5 seats</option>
            <option value="6">6 seats</option>
          </select>
        </Field>

        <Field label="Price per Seat *">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min="1"
            placeholder="45"
          />
        </Field>

        <Field label="Vehicle *">
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Toyota Camry..."
          />
        </Field>

        <Field label="Trip Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Pickup details..."
          />
        </Field>

        <div className="preview">
          <strong>{from || "Starting point"} → {to || "Destination"}</strong>
          <p>{date || "Date"} · {time || "Time"} · {seats} seats · ${price || "0"}</p>

          <p className="coords">
            Start GPS: {fromCoords ? `${fromCoords.lat.toFixed(5)}, ${fromCoords.lng.toFixed(5)}` : "Not selected from Google yet"}
          </p>

          <p className="coords">
            Destination GPS: {toCoords ? `${toCoords.lat.toFixed(5)}, ${toCoords.lng.toFixed(5)}` : "Not selected from Google yet"}
          </p>

          {from && to && (
            <a href={buildMapUrl()} target="_blank" rel="noopener noreferrer">
              Open route in Google Maps
            </a>
          )}
        </div>

        <button className="publish" onClick={publishRide} disabled={loading}>
          {loading ? "Publishing..." : "Publish Ride"}
        </button>

        {message && <p className="message">{message}</p>}
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          background: #020617;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 850px;
          margin: 0 auto 24px;
          padding: 28px;
          border-radius: 28px;
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 22px 70px rgba(0,0,0,0.35);
        }

        .nav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .nav a,
        .nav button {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: white;
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        h1 {
          font-size: 36px;
          margin: 0 0 24px;
        }

        h2 {
          font-size: 46px;
          margin: 0 0 14px;
          line-height: 1;
        }

        span {
          color: #22c55e;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .mapsStatus {
          display: inline-block;
          margin-top: 14px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(234, 179, 8, 0.12);
          border: 1px solid rgba(234, 179, 8, 0.35);
          color: #facc15;
          font-weight: 900;
          font-size: 13px;
        }

        .mapsStatus.ready {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.35);
          color: #22c55e;
        }

        .field {
          margin-bottom: 18px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 900;
        }

        input,
        select,
        textarea {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(34,197,94,0.75);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        option {
          background: #020617;
        }

        .preview {
          margin: 20px 0;
          padding: 20px;
          border-radius: 20px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .preview strong {
          display: block;
          font-size: 20px;
          margin-bottom: 8px;
          overflow-wrap: anywhere;
        }

        .coords {
          margin: 6px 0;
          font-size: 13px;
          color: #94a3b8;
        }

        .preview a {
          display: inline-block;
          margin-top: 12px;
          color: #22c55e;
          font-weight: 900;
        }

        .publish {
          width: 100%;
          border: 0;
          border-radius: 999px;
          padding: 18px;
          background: #22c55e;
          color: white;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .publish:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
