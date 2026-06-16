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

type RouteInfo = {
  distanceText: string;
  durationText: string;
  distanceMiles: number;
  durationMinutes: number;
};

export default function OfferRidePage() {
  const router = useRouter();

  const fromInputRef = useRef<HTMLInputElement | null>(null);
  const toInputRef = useRef<HTMLInputElement | null>(null);
  const directionsServiceRef = useRef<any>(null);

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

  const [routeInfo, setRouteInfo] = useState<RouteInfo>({
    distanceText: "",
    durationText: "",
    distanceMiles: 0,
    durationMinutes: 0,
  });

  const [message, setMessage] = useState("");
  const [mapsReady, setMapsReady] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const suggestedPrice =
    routeInfo.distanceMiles > 0
      ? Math.max(10, Math.round(routeInfo.distanceMiles * 0.28))
      : 0;

  useEffect(() => {
    let mounted = true;

    function setupAutocomplete() {
      if (!window.google?.maps?.places) return;

      directionsServiceRef.current = new window.google.maps.DirectionsService();

      if (fromInputRef.current) {
        const fromAuto = new window.google.maps.places.Autocomplete(fromInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        });

        fromAuto.addListener("place_changed", () => {
          const place = fromAuto.getPlace();
          const label = place.formatted_address || place.name || "";

          setFrom(label);
          setRouteInfo({
            distanceText: "",
            durationText: "",
            distanceMiles: 0,
            durationMinutes: 0,
          });

          if (place.geometry?.location) {
            setFromCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          } else {
            setFromCoords(null);
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
          setRouteInfo({
            distanceText: "",
            durationText: "",
            distanceMiles: 0,
            durationMinutes: 0,
          });

          if (place.geometry?.location) {
            setToCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          } else {
            setToCoords(null);
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

  useEffect(() => {
    if (fromCoords && toCoords && mapsReady) {
      calculateRoute(fromCoords, toCoords);
    }
  }, [fromCoords, toCoords, mapsReady]);

  function buildMapUrl() {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      from.trim()
    )}&destination=${encodeURIComponent(to.trim())}`;
  }

  function resetRouteInfo() {
    setRouteInfo({
      distanceText: "",
      durationText: "",
      distanceMiles: 0,
      durationMinutes: 0,
    });
  }

  function calculateRoute(origin: LatLng, destination: LatLng) {
    if (!window.google?.maps || !directionsServiceRef.current) return;

    setRouteLoading(true);

    directionsServiceRef.current.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        setRouteLoading(false);

        if (status !== "OK" || !result) {
          setMessage("Route distance could not be calculated.");
          return;
        }

        const leg = result.routes?.[0]?.legs?.[0];

        if (!leg) {
          setMessage("Route information was not found.");
          return;
        }

        const meters = Number(leg.distance?.value || 0);
        const seconds = Number(leg.duration?.value || 0);
        const miles = meters / 1609.344;
        const minutes = seconds / 60;

        setRouteInfo({
          distanceText: leg.distance?.text || "",
          durationText: leg.duration?.text || "",
          distanceMiles: Number(miles.toFixed(1)),
          durationMinutes: Math.round(minutes),
        });

        setMessage("");
      }
    );
  }

  function useSuggestedPrice() {
    if (suggestedPrice > 0) {
      setPrice(String(suggestedPrice));
    }
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
        distanceText: routeInfo.distanceText,
        durationText: routeInfo.durationText,
        distanceMiles: routeInfo.distanceMiles,
        durationMinutes: routeInfo.durationMinutes,
        date,
        time,
        seats: Number(seats),
        originalSeats: Number(seats),
        price: Number(price),
        suggestedPrice,
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
      <section className="card heroCard">
        <div className="nav">
          <button type="button" onClick={() => router.back()}>← Back</button>
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/profile">Profile</Link>
        </div>

        <h1>Road<span>Link</span></h1>
        <h2>Offer a <span>Ride</span></h2>

        <p>
          Publish your ride with Google Places autocomplete, GPS coordinates,
          real distance and estimated travel time.
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
              resetRouteInfo();
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
              resetRouteInfo();
            }}
            placeholder="Orlando, FL"
          />
        </Field>

        <div className="routeStats">
          <div className="statBox">
            <small>Distance</small>
            <strong>{routeLoading ? "Calculating..." : routeInfo.distanceText || "Select route"}</strong>
          </div>

          <div className="statBox">
            <small>Duration</small>
            <strong>{routeLoading ? "Calculating..." : routeInfo.durationText || "Select route"}</strong>
          </div>

          <div className="statBox">
            <small>Miles</small>
            <strong>{routeInfo.distanceMiles ? `${routeInfo.distanceMiles} mi` : "0 mi"}</strong>
          </div>

          <div className="statBox">
            <small>Suggested</small>
            <strong>{suggestedPrice ? `$${suggestedPrice}` : "$0"}</strong>
          </div>
        </div>

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
          <div className="priceRow">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="1"
              placeholder="45"
            />

            <button type="button" onClick={useSuggestedPrice}>
              Use ${suggestedPrice || 0}
            </button>
          </div>
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

          <p>
            {date || "Date"} · {time || "Time"} · {seats} seats · ${price || "0"}
          </p>

          <p>
            🛣️ {routeInfo.distanceText || "Distance pending"} · ⏱️{" "}
            {routeInfo.durationText || "Duration pending"}
          </p>

          <p className="coords">
            Start GPS:{" "}
            {fromCoords
              ? `${fromCoords.lat.toFixed(5)}, ${fromCoords.lng.toFixed(5)}`
              : "Not selected from Google yet"}
          </p>

          <p className="coords">
            Destination GPS:{" "}
            {toCoords
              ? `${toCoords.lat.toFixed(5)}, ${toCoords.lng.toFixed(5)}`
              : "Not selected from Google yet"}
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
          padding-bottom: 150px;
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

        .heroCard {
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.14), transparent 36%),
            rgba(15, 23, 42, 0.92);
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

        .routeStats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 8px 0 22px;
        }

        .statBox {
          border-radius: 18px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.18);
          padding: 14px;
          min-height: 80px;
        }

        .statBox small {
          display: block;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .statBox strong {
          display: block;
          color: #22c55e;
          font-size: 17px;
          overflow-wrap: anywhere;
        }

        .priceRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }

        .priceRow button {
          border-radius: 16px;
          border: 1px solid rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.12);
          color: #22c55e;
          padding: 0 16px;
          font-weight: 900;
          cursor: pointer;
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

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 160px;
          }

          .card {
            padding: 24px;
            border-radius: 26px;
          }

          h2 {
            font-size: 40px;
          }

          .routeStats,
          .priceRow {
            grid-template-columns: 1fr;
          }

          .priceRow button {
            padding: 15px;
          }
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
