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

  const [message, setMessage] = useState("Loading Google Maps...");
  const [mapsReady, setMapsReady] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState<"from" | "to" | "">("");
  const [loading, setLoading] = useState(false);

  const suggestedPrice =
    routeInfo.distanceMiles > 0
      ? Math.max(10, Math.round(routeInfo.distanceMiles * 0.28))
      : 0;

  useEffect(() => {
    let mounted = true;

    function setupGoogleServices() {
      if (!window.google?.maps) return;

      directionsServiceRef.current = new window.google.maps.DirectionsService();
      geocoderRef.current = new window.google.maps.Geocoder();

      if (window.google.maps.places && fromInputRef.current && !fromAutoRef.current) {
        fromAutoRef.current = new window.google.maps.places.Autocomplete(fromInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          componentRestrictions: { country: "us" },
        });

        fromAutoRef.current.addListener("place_changed", () => {
          const place = fromAutoRef.current.getPlace();
          const label = place.formatted_address || place.name || "";

          setFrom(label);
          resetRouteInfo();

          if (place.geometry?.location) {
            setFromCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
            setMessage("Pickup selected.");
          } else {
            setFromCoords(null);
            setMessage("Select a real pickup location or press Use Typed Address.");
          }
        });
      }

      if (window.google.maps.places && toInputRef.current && !toAutoRef.current) {
        toAutoRef.current = new window.google.maps.places.Autocomplete(toInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          componentRestrictions: { country: "us" },
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
            setMessage("Destination selected.");
          } else {
            setToCoords(null);
            setMessage("Select a real destination or press Use Typed Address.");
          }
        });
      }

      if (mounted) {
        setMapsReady(true);
        setMessage("Google Maps ready.");
      }
    }

    function loadGoogleMaps() {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        setMessage("Google Maps API key is missing in Vercel.");
        return;
      }

      if (window.google?.maps) {
        setupGoogleServices();
        return;
      }

      const existing = document.getElementById("roadlink-google-maps");

      if (existing) {
        existing.addEventListener("load", setupGoogleServices);
        return;
      }

      const script = document.createElement("script");
      script.id = "roadlink-google-maps";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = setupGoogleServices;
      script.onerror = () => setMessage("Google Maps failed to load. Check API key, billing and domain restrictions.");

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

  function resetRouteInfo() {
    setRouteInfo({
      distanceText: "",
      durationText: "",
      distanceMiles: 0,
      durationMinutes: 0,
    });
  }

  async function geocodeTypedAddress(target: "from" | "to") {
    const value = target === "from" ? from.trim() : to.trim();

    if (!value) {
      setMessage("Type an address first.");
      return;
    }

    if (!window.google?.maps || !geocoderRef.current) {
      setMessage("Google Maps is not ready yet.");
      return;
    }

    try {
      setGeoLoading(target);
      setMessage("Finding address...");

      const response = await geocoderRef.current.geocode({
        address: value.includes("Puerto Rico") ? value : `${value}, Puerto Rico`,
        region: "pr",
      });

      const result = response.results?.[0];

      if (!result?.geometry?.location) {
        setMessage("Address not found. Try a more specific address.");
        return;
      }

      const coords = {
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
      };

      const label = result.formatted_address || value;

      resetRouteInfo();

      if (target === "from") {
        setFrom(label);
        setFromCoords(coords);
        setMessage("Pickup address selected.");
      } else {
        setTo(label);
        setToCoords(coords);
        setMessage("Destination address selected.");
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not find address.");
    } finally {
      setGeoLoading("");
    }
  }

  function getCurrentPosition() {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS is not available."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => reject(new Error("Location permission was denied.")),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }

  async function reverseGeocode(coords: LatLng) {
    if (!window.google?.maps || !geocoderRef.current) {
      return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }

    try {
      const response = await geocoderRef.current.geocode({ location: coords });
      return response.results?.[0]?.formatted_address || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    } catch {
      return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
  }

  async function useCurrentLocation(target: "from" | "to") {
    try {
      setGeoLoading(target);
      setMessage("Getting GPS location...");

      const coords = await getCurrentPosition();
      const address = await reverseGeocode(coords);

      resetRouteInfo();

      if (target === "from") {
        setFrom(address);
        setFromCoords(coords);
        setMessage("Current location set as pickup.");
      } else {
        setTo(address);
        setToCoords(coords);
        setMessage("Current location set as destination.");
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not get GPS location.");
    } finally {
      setGeoLoading("");
    }
  }

  function calculateRoute(origin: LatLng, destination: LatLng) {
    if (!window.google?.maps || !directionsServiceRef.current) {
      const miles = calculateStraightDistanceMiles(origin, destination);
      setRouteInfo({
        distanceText: `${miles} mi estimated`,
        durationText: "Estimated",
        distanceMiles: miles,
        durationMinutes: Math.round(miles * 2),
      });
      return;
    }

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
          const miles = calculateStraightDistanceMiles(origin, destination);
          setRouteInfo({
            distanceText: `${miles} mi estimated`,
            durationText: "Estimated",
            distanceMiles: miles,
            durationMinutes: Math.round(miles * 2),
          });
          setMessage("Route estimated because Google Directions could not calculate it.");
          return;
        }

        const leg = result.routes?.[0]?.legs?.[0];
        const meters = Number(leg?.distance?.value || 0);
        const seconds = Number(leg?.duration?.value || 0);
        const miles = meters / 1609.344;

        setRouteInfo({
          distanceText: leg?.distance?.text || `${miles.toFixed(1)} mi`,
          durationText: leg?.duration?.text || "Estimated",
          distanceMiles: Number(miles.toFixed(1)),
          durationMinutes: Math.round(seconds / 60),
        });

        setMessage("");
      }
    );
  }

  function calculateStraightDistanceMiles(origin: LatLng, destination: LatLng) {
    const earthRadiusMiles = 3958.8;
    const lat1 = (origin.lat * Math.PI) / 180;
    const lat2 = (destination.lat * Math.PI) / 180;
    const deltaLat = ((destination.lat - origin.lat) * Math.PI) / 180;
    const deltaLng = ((destination.lng - origin.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

    return Number((earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
  }

  function buildMapUrl() {
    const origin = fromCoords ? `${fromCoords.lat},${fromCoords.lng}` : from.trim();
    const destination = toCoords ? `${toCoords.lat},${toCoords.lng}` : to.trim();

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  }

  function useSuggestedPrice() {
    if (suggestedPrice > 0) setPrice(String(suggestedPrice));
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

    if (!fromCoords) {
      setMessage("Press Use Typed Address or Use GPS for pickup.");
      return;
    }

    if (!toCoords) {
      setMessage("Press Use Typed Address or Use GPS for destination.");
      return;
    }

    if (routeInfo.distanceMiles <= 0) {
      calculateRoute(fromCoords, toCoords);
      setMessage("Calculating route. Press Publish again in a moment.");
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

  const destinationSelected = Boolean(toCoords);

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
        <p>Publish your ride with GPS, Google autocomplete or manual address search.</p>

        <div className={mapsReady ? "mapsStatus ready" : "mapsStatus"}>
          {mapsReady ? "Google Maps ready" : "Loading Google Maps..."}
        </div>
      </section>

      <section className="card">
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
              placeholder="Example: Guayama Puerto Rico"
            />
            <button type="button" onClick={() => geocodeTypedAddress("from")} disabled={geoLoading !== "" || !mapsReady}>
              {geoLoading === "from" ? "Finding..." : "Use Typed Address"}
            </button>
            <button type="button" onClick={() => useCurrentLocation("from")} disabled={geoLoading !== ""}>
              GPS
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
              placeholder="Example: Patillas Puerto Rico"
            />
            <button type="button" onClick={() => geocodeTypedAddress("to")} disabled={geoLoading !== "" || !mapsReady}>
              {geoLoading === "to" ? "Finding..." : "Use Typed Address"}
            </button>
            <button type="button" onClick={() => useCurrentLocation("to")} disabled={geoLoading !== ""}>
              GPS
            </button>
          </div>

          {!destinationSelected && <p className="fieldWarning">Type destination and press Use Typed Address.</p>}
          {destinationSelected && <p className="fieldSuccess">Destination selected.</p>}
        </Field>

        <div className="routeStats">
          <StatBox label="Distance" value={routeLoading ? "Calculating..." : routeInfo.distanceText || "Select route"} />
          <StatBox label="Duration" value={routeLoading ? "Calculating..." : routeInfo.durationText || "Select route"} />
          <StatBox label="Miles" value={routeInfo.distanceMiles ? `${routeInfo.distanceMiles} mi` : "0 mi"} />
          <StatBox label="Suggested" value={suggestedPrice ? `$${suggestedPrice}` : "$0"} />
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
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="1" placeholder="45" />
            <button type="button" onClick={useSuggestedPrice}>Use ${suggestedPrice || 0}</button>
          </div>
        </Field>

        <Field label="Vehicle *">
          <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Toyota Camry..." />
        </Field>

        <Field label="Trip Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pickup details, luggage, rules..." />
        </Field>

        <div className="preview">
          <p className="eyebrow">Live Preview</p>
          <strong>{from || "Starting point"} → {to || "Destination"}</strong>
          <p>{date || "Date"} · {time || "Time"} · {seats} seats · ${price || "0"}</p>
          <p>🛣️ {routeInfo.distanceText || "Distance pending"} · ⏱️ {routeInfo.durationText || "Duration pending"}</p>

          {fromCoords && <p className="coords">Start GPS: {fromCoords.lat.toFixed(5)}, {fromCoords.lng.toFixed(5)}</p>}
          {toCoords && <p className="coords">Destination GPS: {toCoords.lat.toFixed(5)}, {toCoords.lng.toFixed(5)}</p>}

          {fromCoords && toCoords && (
            <a href={buildMapUrl()} target="_blank" rel="noopener noreferrer">Open route in Google Maps</a>
          )}
        </div>

        <button className="publish" onClick={publishRide} disabled={loading || !fromCoords || !toCoords}>
          {loading ? "Publishing..." : fromCoords && toCoords ? "Publish Ride" : "Select Pickup & Destination"}
        </button>

        {message && <p className="message">{message}</p>}
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          background: radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 34%), linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 180px;
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

        h1 { font-size: 36px; margin: 0 0 24px; }
        h2 { font-size: 46px; margin: 0 0 14px; line-height: 1; }
        span, h2 span { color: #22c55e; }

        p { color: #a1a1aa; line-height: 1.5; }

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

        .field { margin-bottom: 18px; }

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

        textarea { min-height: 110px; resize: vertical; }
        option { background: #020617; }

        .locationInputRow,
        .priceRow {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
        }

        .priceRow { grid-template-columns: 1fr auto; }

        .locationInputRow button,
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

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .fieldWarning,
        .fieldSuccess {
          margin: 8px 0 0;
          font-size: 13px;
          font-weight: 900;
        }

        .fieldWarning { color: #fbbf24; }
        .fieldSuccess { color: #22c55e; }

        .routeStats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 8px 0 20px;
        }

        .statBox {
          border-radius: 16px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.18);
          padding: 12px;
          min-height: 72px;
        }

        .statBox small {
          display: block;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .statBox strong {
          display: block;
          color: #22c55e;
          font-size: 15px;
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
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 190px; }
          .card { padding: 24px; border-radius: 26px; }
          h2 { font-size: 40px; }

          .locationInputRow,
          .priceRow {
            grid-template-columns: 1fr;
          }

          .locationInputRow button,
          .priceRow button {
            padding: 15px;
          }

          .routeStats {
            grid-template-columns: 1fr 1fr;
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="statBox">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
      }
