"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

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

  const [message, setMessage] = useState("Manual route mode ready.");
  const [geoLoading, setGeoLoading] = useState<"from" | "to" | "">("");
  const [loading, setLoading] = useState(false);

  const suggestedPrice =
    routeInfo.distanceMiles > 0
      ? Math.max(10, Math.round(routeInfo.distanceMiles * 0.28))
      : 0;

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

    try {
      setGeoLoading(target);
      setMessage("Finding address...");

      const searchText = value.toLowerCase().includes("puerto rico")
        ? value
        : `${value}, Puerto Rico`;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          searchText
        )}`
      );

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        setMessage("Address not found. Try Guayama Puerto Rico or Patillas Puerto Rico.");
        return;
      }

      const result = results[0];

      const coords = {
        lat: Number(result.lat),
        lng: Number(result.lon),
      };

      const label = result.display_name || searchText;

      resetRouteInfo();

      if (target === "from") {
        setFrom(label);
        setFromCoords(coords);
        setMessage("Pickup address selected.");
        if (toCoords) calculateRoute(coords, toCoords);
      } else {
        setTo(label);
        setToCoords(coords);
        setMessage("Destination address selected.");
        if (fromCoords) calculateRoute(fromCoords, coords);
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
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`
      );

      const data = await response.json();

      return (
        data.display_name ||
        `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
      );
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
        if (toCoords) calculateRoute(coords, toCoords);
      } else {
        setTo(address);
        setToCoords(coords);
        setMessage("Current location set as destination.");
        if (fromCoords) calculateRoute(fromCoords, coords);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not get GPS location.");
    } finally {
      setGeoLoading("");
    }
  }

  function calculateRoute(origin: LatLng, destination: LatLng) {
    const miles = calculateStraightDistanceMiles(origin, destination);
    const estimatedMinutes = Math.max(5, Math.round(miles * 2.1));

    setRouteInfo({
      distanceText: `${miles} mi estimated`,
      durationText: `${estimatedMinutes} min estimated`,
      distanceMiles: miles,
      durationMinutes: estimatedMinutes,
    });
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

    return Number(
      (earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
    );
  }

  function buildMapUrl() {
    const origin = fromCoords ? `${fromCoords.lat},${fromCoords.lng}` : from.trim();
    const destination = toCoords ? `${toCoords.lat},${toCoords.lng}` : to.trim();

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}`;
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
      setMessage("Press Use Typed Address or GPS for pickup.");
      return;
    }

    if (!toCoords) {
      setMessage("Press Use Typed Address or GPS for destination.");
      return;
    }

    if (routeInfo.distanceMiles <= 0) {
      calculateRoute(fromCoords, toCoords);
      setMessage("Route calculated. Press Publish again.");
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
        <p>Publish your ride using manual address search or GPS. No Google popup required.</p>

        <div className="mapsStatus ready">
          Manual Maps Ready
        </div>
      </section>

      <section className="card">
        <Field label="From *">
          <div className="locationInputRow">
            <input
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setFromCoords(null);
                resetRouteInfo();
              }}
              placeholder="Example: Guayama Puerto Rico"
            />
            <button type="button" onClick={() => geocodeTypedAddress("from")} disabled={geoLoading !== ""}>
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
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setToCoords(null);
                resetRouteInfo();
              }}
              placeholder="Example: Patillas Puerto Rico"
            />
            <button type="button" onClick={() => geocodeTypedAddress("to")} disabled={geoLoading !== ""}>
              {geoLoading === "to" ? "Finding..." : "Use Typed Address"}
            </button>
            <button type="button" onClick={() => useCurrentLocation("to")} disabled={geoLoading !== ""}>
              GPS
            </button>
          </div>

          {!toCoords && <p className="fieldWarning">Type destination and press Use Typed Address.</p>}
          {toCoords && <p className="fieldSuccess">Destination selected.</p>}
        </Field>

        <div className="routeStats">
          <StatBox label="Distance" value={routeInfo.distanceText || "Select route"} />
          <StatBox label="Duration" value={routeInfo.durationText || "Select route"} />
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
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="1"
              placeholder="45"
            />
            <button type="button" onClick={useSuggestedPrice}>Use ${suggestedPrice || 0}</button>
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
            placeholder="Pickup details, luggage, rules..."
          />
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
