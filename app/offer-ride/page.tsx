"use client";

import Link from "../components/AppLink";
import RequireSession from "../components/RequireSession";
import { useState, type ReactNode } from "react";
import { useAppRouter as useRouter } from "../components/useAppRouter";
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
  return <RequireSession purpose="Entra en tu cuenta para publicar un viaje."><OfferRidePageContent /></RequireSession>;
}

function OfferRidePageContent() {
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

  const [message, setMessage] = useState("Selecciona el origen y el destino para preparar tu viaje.");
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
      setMessage("Escribe una dirección primero.");
      return;
    }

    try {
      setGeoLoading(target);
      setMessage("Buscando dirección…");

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
        setMessage("No encontramos esa dirección. Prueba con el municipio y Puerto Rico.");
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
        setMessage("Origen seleccionado.");
        if (toCoords) calculateRoute(coords, toCoords);
      } else {
        setTo(label);
        setToCoords(coords);
        setMessage("Destino seleccionado.");
        if (fromCoords) calculateRoute(fromCoords, coords);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo encontrar la dirección.");
    } finally {
      setGeoLoading("");
    }
  }

  function getCurrentPosition() {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("El GPS no está disponible."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => reject(new Error("No se concedió el permiso de ubicación.")),
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
      setMessage("Obteniendo tu ubicación…");

      const coords = await getCurrentPosition();
      const address = await reverseGeocode(coords);

      resetRouteInfo();

      if (target === "from") {
        setFrom(address);
        setFromCoords(coords);
        setMessage("Tu ubicación se seleccionó como origen.");
        if (toCoords) calculateRoute(coords, toCoords);
      } else {
        setTo(address);
        setToCoords(coords);
        setMessage("Tu ubicación se seleccionó como destino.");
        if (fromCoords) calculateRoute(fromCoords, coords);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo obtener tu ubicación.");
    } finally {
      setGeoLoading("");
    }
  }

  function calculateRoute(origin: LatLng, destination: LatLng) {
    const miles = calculateStraightDistanceMiles(origin, destination);
    const estimatedMinutes = Math.max(5, Math.round(miles * 2.1));

    setRouteInfo({
      distanceText: `${miles} mi estimadas`,
      durationText: `${estimatedMinutes} min estimados`,
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
      setMessage("Inicia sesión antes de publicar un viaje.");
      router.push("/login");
      return;
    }

    if (!from || !to || !date || !time || !seats || !price || !vehicle) {
      setMessage("Completa todos los campos obligatorios.");
      return;
    }

    if (!fromCoords) {
      setMessage("Confirma la dirección de origen o usa el GPS.");
      return;
    }

    if (!toCoords) {
      setMessage("Confirma la dirección de destino o usa el GPS.");
      return;
    }

    if (routeInfo.distanceMiles <= 0) {
      calculateRoute(fromCoords, toCoords);
      setMessage("Estimación calculada. Pulsa Publicar de nuevo.");
      return;
    }

    if (Number(price) <= 0) {
      setMessage("El precio debe ser mayor que cero.");
      return;
    }

    if (Number(seats) <= 0) {
      setMessage("Debe haber al menos un asiento disponible.");
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
      setMessage(error instanceof Error ? error.message : "No se pudo publicar el viaje. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card heroCard">
        <div className="nav">
          <button type="button" onClick={() => router.back()}>← Volver</button>
          <Link href="/">Inicio</Link>
          <Link href="/dashboard">Mi panel</Link>
          <Link href="/profile">Perfil</Link>
        </div>

        <h1>Road<span>Link</span></h1>
        <h2>Publicar un <span>viaje</span></h2>
        <p>Indica el origen, el destino y los detalles del viaje. La distancia y duración son estimaciones en línea recta.</p>

        <div className="mapsStatus ready">
          Preparar mi ruta
        </div>
      </section>

      <section className="card">
        <Field label="Origen *">
          <div className="locationInputRow">
            <input
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setFromCoords(null);
                resetRouteInfo();
              }}
              placeholder="Ejemplo: Guayama, Puerto Rico"
            />
            <button type="button" onClick={() => geocodeTypedAddress("from")} disabled={geoLoading !== ""}>
              {geoLoading === "from" ? "Buscando…" : "Confirmar dirección"}
            </button>
            <button type="button" onClick={() => useCurrentLocation("from")} disabled={geoLoading !== ""}>
              GPS
            </button>
          </div>
        </Field>

        <Field label="Destino *">
          <div className="locationInputRow">
            <input
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setToCoords(null);
                resetRouteInfo();
              }}
              placeholder="Ejemplo: Patillas, Puerto Rico"
            />
            <button type="button" onClick={() => geocodeTypedAddress("to")} disabled={geoLoading !== ""}>
              {geoLoading === "to" ? "Buscando…" : "Confirmar dirección"}
            </button>
            <button type="button" onClick={() => useCurrentLocation("to")} disabled={geoLoading !== ""}>
              GPS
            </button>
          </div>

          {!toCoords && <p className="fieldWarning">Escribe el destino y pulsa Confirmar dirección.</p>}
          {toCoords && <p className="fieldSuccess">Destino seleccionado.</p>}
        </Field>

        <div className="routeStats">
          <StatBox label="Distancia estimada" value={routeInfo.distanceText || "Selecciona una ruta"} />
          <StatBox label="Duración estimada" value={routeInfo.durationText || "Selecciona una ruta"} />
          <StatBox label="Millas" value={routeInfo.distanceMiles ? `${routeInfo.distanceMiles} mi` : "0 mi"} />
          <StatBox label="Precio sugerido" value={suggestedPrice ? `$${suggestedPrice}` : "$0"} />
        </div>

        <Field label="Fecha *">
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        </Field>

        <Field label="Hora de salida *">
          <input value={time} onChange={(e) => setTime(e.target.value)} type="time" />
        </Field>

        <Field label="Asientos disponibles *">
          <select value={seats} onChange={(e) => setSeats(e.target.value)}>
            <option value="1">1 asiento</option>
            <option value="2">2 asientos</option>
            <option value="3">3 asientos</option>
            <option value="4">4 asientos</option>
            <option value="5">5 asientos</option>
            <option value="6">6 asientos</option>
          </select>
        </Field>

        <Field label="Precio por asiento *">
          <div className="priceRow">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="1"
              placeholder="45"
            />
            <button type="button" onClick={useSuggestedPrice}>Usar ${suggestedPrice || 0}</button>
          </div>
        </Field>

        <Field label="Vehículo *">
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Toyota Camry..."
          />
        </Field>

        <Field label="Notas del viaje">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Punto de encuentro, equipaje, reglas…"
          />
        </Field>

        <div className="preview">
          <p className="eyebrow">Vista previa</p>
          <strong>{from || "Origen"} → {to || "Destino"}</strong>
          <p>{date || "Fecha"} · {time || "Hora"} · {seats} asientos · ${price || "0"}</p>
          <p>🛣️ {routeInfo.distanceText || "Distancia pendiente"} · ⏱️ {routeInfo.durationText || "Duración pendiente"}</p>

          {fromCoords && <p className="coords">GPS de origen: {fromCoords.lat.toFixed(5)}, {fromCoords.lng.toFixed(5)}</p>}
          {toCoords && <p className="coords">GPS de destino: {toCoords.lat.toFixed(5)}, {toCoords.lng.toFixed(5)}</p>}

          {fromCoords && toCoords && (
            <a href={buildMapUrl()} target="_blank" rel="noopener noreferrer">Ver ruta en Google Maps</a>
          )}
        </div>

        <button className="publish" onClick={publishRide} disabled={loading || !fromCoords || !toCoords}>
          {loading ? "Publicando…" : fromCoords && toCoords ? "Publicar viaje" : "Selecciona origen y destino"}
        </button>

        {message && <p className="message">{message}</p>}
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          background: radial-gradient(circle at top right, rgba(217,195,157,0.16), transparent 34%), linear-gradient(135deg, #070d11, #0b1217, #10191e);
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
        span, h2 span { color: #d9c39d; }

        p { color: #a1a1aa; line-height: 1.5; }

        .eyebrow {
          color: #d9c39d;
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
          background: rgba(217, 195, 157, 0.12);
          border-color: rgba(217, 195, 157, 0.35);
          color: #d9c39d;
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
        option { background: #070d11; }

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
          border: 1px solid rgba(217,195,157,0.35);
          background: rgba(217,195,157,0.12);
          color: #d9c39d;
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
        .fieldSuccess { color: #d9c39d; }

        .routeStats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 8px 0 20px;
        }

        .statBox {
          border-radius: 16px;
          background: rgba(217,195,157,0.08);
          border: 1px solid rgba(217,195,157,0.18);
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
          color: #d9c39d;
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
          color: #d9c39d;
          font-weight: 900;
        }

        .publish {
          width: 100%;
          border: 0;
          border-radius: 999px;
          padding: 18px;
          background: linear-gradient(135deg, #d9c39d, #b89b69);
          color: #070d11;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 18px 50px rgba(217,195,157,0.25);
        }

        .publish:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .message {
          text-align: center;
          color: #d9c39d;
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
