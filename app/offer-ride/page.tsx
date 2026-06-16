"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

  const mapRef = useRef<HTMLDivElement | null>(null);
  const fromInputRef = useRef<HTMLInputElement | null>(null);
  const toInputRef = useRef<HTMLInputElement | null>(null);

  const mapInstanceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const selectModeRef = useRef<"from" | "to">("from");

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

  const [distanceText, setDistanceText] = useState("");
  const [durationText, setDurationText] = useState("");
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);

  const [selectMode, setSelectMode] = useState<"from" | "to">("from");
  const [mapReady, setMapReady] = useState(false);
  const [message, setMessage] = useState("Loading Google Maps...");
  const [loading, setLoading] = useState(false);

  const suggestedPrice =
    distanceMiles > 0 ? Math.max(10, Math.round(distanceMiles * 0.28)) : 0;

  useEffect(() => {
    selectModeRef.current = selectMode;
  }, [selectMode]);

  useEffect(() => {
    let mounted = true;

    async function loadMap() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
          setMessage("Google Maps API key is missing.");
          return;
        }

        if (typeof window === "undefined") return;

        if (window.google?.maps) {
          if (mounted) initializeMap();
          return;
        }

        const existingScript = document.getElementById("roadlink-google-maps");

        if (existingScript) {
          existingScript.addEventListener("load", () => {
            if (mounted) initializeMap();
          });

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

        script.onload = () => {
          if (mounted) initializeMap();
        };

        script.onerror = () => {
          if (mounted) setMessage("Google Maps could not load.");
        };

        document.head.appendChild(script);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Google Maps failed to initialize.");
      }
    }

    loadMap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (fromCoords && toCoords && mapReady) {
      calculateRoute(fromCoords, toCoords);
    }
  }, [fromCoords, toCoords, mapReady]);

  function initializeMap() {
    try {
      if (!mapRef.current || !window.google?.maps || mapInstanceRef.current) return;

      const center = { lat: 18.2208, lng: -66.5901 };

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 8,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#22c55e",
          strokeWeight: 6,
          strokeOpacity: 0.9,
        },
      });

      setupAutocomplete();
      setupMapClick(map);

      setMapReady(true);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Map could not be initialized.");
    }
  }

  function setupAutocomplete() {
    if (!window.google?.maps?.places) return;

    if (fromInputRef.current) {
      const fromAuto = new window.google.maps.places.Autocomplete(fromInputRef.current, {
        fields: ["formatted_address", "geometry", "name"],
      });

      fromAuto.addListener("place_changed", () => {
        const place = fromAuto.getPlace();
        if (!place.geometry?.location) return;

        const coords = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        setFrom(place.formatted_address || place.name || "");
        setFromCoords(coords);
      });
    }

    if (toInputRef.current) {
      const toAuto = new window.google.maps.places.Autocomplete(toInputRef.current, {
        fields: ["formatted_address", "geometry", "name"],
      });

      toAuto.addListener("place_changed", () => {
        const place = toAuto.getPlace();
        if (!place.geometry?.location) return;

        const coords = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        setTo(place.formatted_address || place.name || "");
        setToCoords(coords);
      });
    }
  }

  function setupMapClick(map: any) {
    map.addListener("click", async (event: any) => {
      if (!event.latLng) return;

      const coords = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };

      const address = await reverseGeocode(coords);

      if (selectModeRef.current === "from") {
        setFrom(address);
        setFromCoords(coords);
        setSelectMode("to");
      } else {
        setTo(address);
        setToCoords(coords);
      }
    });
  }

  async function reverseGeocode(coords: LatLng) {
    try {
      if (!window.google?.maps) {
        return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
      }

      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: coords });

      return (
        response.results?.[0]?.formatted_address ||
        `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
      );
    } catch {
      return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
  }

  function calculateRoute(origin: LatLng, destination: LatLng) {
    if (!window.google?.maps || !directionsServiceRef.current || !directionsRendererRef.current) {
      return;
    }

    directionsServiceRef.current.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status !== "OK" || !result) {
          setMessage("Route could not be calculated.");
          return;
        }

        directionsRendererRef.current.setDirections(result);

        const leg = result.routes?.[0]?.legs?.[0];
        if (!leg) return;

        const meters = Number(leg.distance?.value || 0);
        const seconds = Number(leg.duration?.value || 0);
        const miles = meters / 1609.344;
        const minutes = seconds / 60;

        setDistanceText(leg.distance?.text || "");
        setDurationText(leg.duration?.text || "");
        setDistanceMiles(Number(miles.toFixed(1)));
        setDurationMinutes(Math.round(minutes));
        setMessage("");
      }
    );
  }

  function useSuggestedPrice() {
    if (suggestedPrice > 0) {
      setPrice(String(suggestedPrice));
    }
  }

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

    if (!from || !to || !date || !time || !price || !vehicle) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (!fromCoords || !toCoords) {
      setMessage("Please select both route points from autocomplete or map.");
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
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        toLat: toCoords.lat,
        toLng: toCoords.lng,
        distanceText,
        durationText,
        distanceMiles,
        durationMinutes,
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

      setMessage("Ride published successfully.");

      setTimeout(() => {
        router.push("/find-ride");
      }, 800);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button type="button" className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/" className="miniButton">Home</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <div className="logo">Road<span>Link</span></div>

        <h1>Offer a <span>Ride</span></h1>

        <p className="subtitle">
          Publish your route with Google Maps, real distance, estimated time and GPS coordinates.
        </p>
      </section>

      <section className="formCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Trip Route</p>
            <h2>Where are you going?</h2>
          </div>

          <div className="carBadge">🗺️</div>
        </div>

        <div className="mapTools">
          <button
            type="button"
            className={selectMode === "from" ? "toolButton activeTool" : "toolButton"}
            onClick={() => setSelectMode("from")}
          >
            📍 Pick Start
          </button>

          <button
            type="button"
            className={selectMode === "to" ? "toolButton activeTool" : "toolButton"}
            onClick={() => setSelectMode("to")}
          >
            🏁 Pick Destination
          </button>
        </div>

        <div className="mapBox" ref={mapRef}>
          {!mapReady && <div className="mapLoading">Loading map...</div>}
        </div>

        <div className="routeSummary">
          <InfoBox label="Distance" value={distanceText || "Select route"} />
          <InfoBox label="Duration" value={durationText || "Select route"} />
          <InfoBox label="Miles" value={distanceMiles ? `${distanceMiles} mi` : "0 mi"} />
          <InfoBox label="Suggested Price" value={suggestedPrice ? `$${suggestedPrice}` : "$0"} />
        </div>

        <div className="routeGrid">
          <Field label="From *" icon="📍">
            <input
              ref={fromInputRef}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="City or address"
            />
          </Field>

          <Field label="To *" icon="🏁">
            <input
              ref={toInputRef}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="City or address"
            />
          </Field>
        </div>

        <div className="grid">
          <Field label="Date *" icon="📅">
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
          </Field>

          <Field label="Departure Time *" icon="🕒">
            <input value={time} onChange={(e) => setTime(e.target.value)} type="time" />
          </Field>
        </div>

        <div className="grid">
          <Field label="Available Seats *" icon="💺">
            <select value={seats} onChange={(e) => setSeats(e.target.value)}>
              <option value="1">1 seat</option>
              <option value="2">2 seats</option>
              <option value="3">3 seats</option>
              <option value="4">4 seats</option>
              <option value="5">5 seats</option>
              <option value="6">6 seats</option>
            </select>
          </Field>

          <Field label="Price per Seat *" icon="💵">
            <div className="priceInputWrap">
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
        </div>

        <Field label="Vehicle *" icon="🚘">
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Toyota Camry, Honda CR-V, Nissan Altima..."
          />
        </Field>

        <Field label="Trip Notes" icon="📝">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="No smoking, small luggage allowed, pickup location..."
          />
        </Field>

        <section className="previewCard">
          <p className="eyebrow">Live Preview</p>

          <h3>
            {from || "Starting point"} <span>→</span> {to || "Destination"}
          </h3>

          <div className="chips">
            <div className="chip">📅 {date || "Date"}</div>
            <div className="chip">🕒 {time || "Time"}</div>
            <div className="chip">💺 {seats} seat{seats === "1" ? "" : "s"}</div>
            <div className="chip green">${price || "0"}</div>
            <div className="chip">🛣️ {distanceText || "Distance"}</div>
            <div className="chip">⏱️ {durationText || "Duration"}</div>
          </div>

          <p>{vehicle || "Vehicle information will appear here."}</p>
        </section>

        <button onClick={publishRide} disabled={loading} className="publishButton">
          {loading ? "Publishing..." : "Publish Ride"}
        </button>

        {message && <p className="message">{message}</p>}
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .formCard {
          max-width: 960px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .formCard,
        .previewCard,
        .mapBox,
        .infoBox {
          background: rgba(8,13,25,0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 24px;
        }

        .formCard {
          border-radius: 32px;
          padding: 30px;
        }

        .topActions,
        .mapTools,
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .topActions {
          margin-bottom: 30px;
        }

        .miniButton,
        .toolButton {
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
          cursor: pointer;
        }

        .activeTool {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.45);
        }

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h3 span,
        .green,
        .eyebrow {
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

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          margin-bottom: 22px;
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
          margin: 0;
        }

        .carBadge {
          min-width: 76px;
          height: 76px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
        }

        .mapTools {
          margin-bottom: 14px;
        }

        .mapBox {
          position: relative;
          width: 100%;
          height: 360px;
          overflow: hidden;
          border-radius: 26px;
          margin-bottom: 16px;
        }

        .mapLoading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          background: rgba(2,6,23,0.9);
          font-weight: 900;
          z-index: 5;
        }

        .routeSummary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox {
          border-radius: 18px;
          padding: 14px;
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .infoBox strong {
          display: block;
          color: #22c55e;
          font-size: 18px;
          overflow-wrap: anywhere;
        }

        .routeGrid,
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .field {
          margin-bottom: 18px;
        }

        .labelRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 9px;
          color: #e5e7eb;
          font-weight: 900;
        }

        .fieldIcon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
        }

        input,
        select,
        textarea {
          width: 100%;
          display: block;
          padding: 17px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 16px;
          outline: none;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.10);
        }

        input::placeholder,
        textarea::placeholder {
          color: #71717a;
        }

        select option {
          background: #020617;
          color: white;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
        }

        .priceInputWrap {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }

        .priceInputWrap button {
          border-radius: 16px;
          padding: 0 16px;
          background: rgba(34,197,94,0.14);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
          cursor: pointer;
        }

        .previewCard {
          border-radius: 24px;
          padding: 22px;
          margin-top: 10px;
          margin-bottom: 24px;
        }

        .previewCard h3 {
          font-size: 28px;
          line-height: 1.2;
          margin: 0 0 18px;
          overflow-wrap: anywhere;
        }

        .previewCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .publishButton {
          width: 100%;
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

        .publishButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .message {
          color: #22c55e;
          text-align: center;
          margin-top: 18px;
          font-weight: 900;
          line-height: 1.5;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .formCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 48px;
          }

          h2 {
            font-size: 30px;
          }

          .routeGrid,
          .grid,
          .routeSummary,
          .priceInputWrap {
            grid-template-columns: 1fr;
          }

          .mapBox {
            height: 300px;
          }

          .sectionHeader {
            align-items: flex-start;
          }

          .carBadge {
            min-width: 58px;
            height: 58px;
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <div className="labelRow">
        <div className="fieldIcon">{icon}</div>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
