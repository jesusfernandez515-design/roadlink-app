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
  const fromAutoRef = useRef<any>(null);
  const toAutoRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

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
  const [locationLoading, setLocationLoading] = useState<"from" | "to" | "">("");
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
      geocoderRef.current = new window.google.maps.Geocoder();

      if (fromInputRef.current && !fromAutoRef.current) {
        fromAutoRef.current = new window.google.maps.places.Autocomplete(fromInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        });

        fromAutoRef.current.addListener("place_changed", () => {
          const place = fromAutoRef.current.getPlace();
          const label = place.formatted_address || place.name || "";

          setFrom(label);
          resetRouteInfo();

          if (place.geometry?.location) {
            const coords = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };

            setFromCoords(coords);
            setUserLocation(coords);
            biasAutocompleteToLocation(coords);
          } else {
            setFromCoords(null);
          }
        });
      }

      if (toInputRef.current && !toAutoRef.current) {
        toAutoRef.current = new window.google.maps.places.Autocomplete(toInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        });

        toAutoRef.current.addListener("place_changed", () => {
          const place = toAutoRef.current.getPlace();
          const label = place.formatted_address || place.name || "";

          setTo(label);
          resetRouteInfo();

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

  function biasAutocompleteToLocation(coords: LatLng) {
    if (!window.google?.maps) return;

    const circle = new window.google.maps.Circle({
      center: coords,
      radius: 50000,
    });

    const bounds = circle.getBounds();

    if (bounds) {
      fromAutoRef.current?.setBounds(bounds);
      toAutoRef.current?.setBounds(bounds);

      fromAutoRef.current?.setOptions({
        bounds,
        strictBounds: false,
      });

      toAutoRef.current?.setOptions({
        bounds,
        strictBounds: false,
      });
    }
  }

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

  async function reverseGeocode(coords: LatLng) {
    try {
      if (!window.google?.maps || !geocoderRef.current) {
        return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
      }

      const response = await geocoderRef.current.geocode({
        location: coords,
      });

      return (
        response.results?.[0]?.formatted_address ||
        `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
      );
    } catch {
      return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
  }

  function getCurrentPosition() {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS is not available on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          reject(new Error("Location permission was denied or unavailable."));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }

  async function useCurrentLocation(target: "from" | "to") {
    setMessage("");
    setLocationLoading(target);

    try {
      const coords = await getCurrentPosition();
      const address = await reverseGeocode(coords);

      resetRouteInfo();
      setUserLocation(coords);
      biasAutocompleteToLocation(coords);

      if (target === "from") {
        setFrom(address);
        setFromCoords(coords);
      } else {
        setTo(address);
        setToCoords(coords);
      }

      setMessage(
        target === "from"
          ? "Current location set as pickup point. Nearby searches are now prioritized."
          : "Current location set as destination. Nearby searches are now prioritized."
      );
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not get current location.");
    } finally {
      setLocationLoading("");
    }
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
          Publish your ride with Google Places, GPS pickup, nearby search priority,
          real distance and smart suggested pricing.
        </p>

        <div className={mapsReady ? "mapsStatus ready" : "mapsStatus"}>
          {mapsReady ? "Google Maps ready" : "Loading Google Maps..."}
        </div>
      </section>

      <section className="card">
        <div className="routeSectionHeader">
          <div>
            <p className="eyebrow">Pickup & Destination</p>
            <h3>Build your route</h3>
          </div>
          <div className="gpsBadge">📍</div>
        </div>

        <Field label="From *">
          <div className="locationInputRow">
            <input
              ref={fromInputRef}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setFromCoords(null);
                resetRouteInfo();
              }}
              placeholder="Search pickup location or use GPS"
            />

            <button
              type="button"
              className="gpsButton"
              onClick={() => useCurrentLocation("from")}
              disabled={locationLoading !== "" || !mapsReady}
            >
              {locationLoading === "from" ? "Locating..." : "Use GPS"}
            </button>
          </div>
        </Field>

        <Field label="To *">
          <div className="locationInputRow">
            <input
              ref={toInputRef}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setToCoords(null);
                resetRouteInfo();
              }}
              placeholder="Search destination near your pickup"
            />

            <button
              type="button"
              className="gpsButton secondaryGps"
              onClick={() => useCurrentLocation("to")}
              disabled={locationLoading !== "" || !mapsReady}
            >
              {locationLoading === "to" ? "Locating..." : "Use GPS"}
            </button>
          </div>
        </Field>

        <div className="gpsHelp">
          <span>Nearby Search Active</span>
          {userLocation
            ? "Google will prioritize airports, stations and places near your GPS or pickup point."
            : "Tap Use GPS first to make searches like airport, Walmart or mall show nearby results."}
        </div>

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
            placeholder="Pickup details, luggage, rules, meeting point..."
          />
        </Field>

        <div className="preview">
          <p className="eyebrow">Live Preview</p>

          <strong>{from || "Starting point"} → {to || "Destination"}</strong>

          <p>{date || "Date"} · {time || "Time"} · {seats} seats · ${price || "0"}</p>

          <p>
            🛣️ {routeInfo.distanceText || "Distance pending"} · ⏱️{" "}
            {routeInfo.durationText || "Duration pending"}
          </p>

          <p className="coords">
            Start GPS:{" "}
            {fromCoords
              ? `${fromCoords.lat.toFixed(5)}, ${fromCoords.lng.toFixed(5)}`
              : "Not selected yet"}
          </p>

          <p className="coords">
            Destination GPS:{" "}
            {toCoords
              ? `${toCoords.lat.toFixed(5)}, ${toCoords.lng.toFixed(5)}`
              : "Not selected yet"}
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
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 160px;
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

        h3 {
          font-size: 28px;
          margin: 0;
        }

        span {
          color: #22c55e;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .eyebrow {
          color: #22c55e;
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
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

        .routeSectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
        }

        .gpsBadge {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
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

        .locationInputRow,
        .priceRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }

        .gpsButton,
        .priceRow button {
          border-radius: 16px;
          border: 1px solid rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.12);
          color: #22c55e;
          padding: 0 16px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .secondaryGps {
          border-color: rgba(59,130,246,0.35);
          background: rgba(59,130,246,0.12);
          color: #60a5fa;
        }

        .gpsButton:disabled,
        .priceRow button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .gpsHelp {
          margin: -4px 0 20px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.18);
          color: #93c5fd;
          font-size: 14px;
          line-height: 1.5;
        }

        .gpsHelp span {
          display: block;
          color: #60a5fa;
          font-weight: 900;
          margin-bottom: 4px;
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
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .publish:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 170px;
          }

          .card {
            padding: 24px;
            border-radius: 26px;
          }

          h2 {
            font-size: 40px;
          }

          .routeStats,
          .locationInputRow,
          .priceRow {
            grid-template-columns: 1fr;
          }

          .gpsButton,
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
