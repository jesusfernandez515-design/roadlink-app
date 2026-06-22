"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type LocationItem = {
  id: string;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  online?: boolean;
  lastSeen?: string;
  latitude?: number;
  longitude?: number;
  currentLat?: number;
  currentLng?: number;
  city?: string;
  state?: string;
};

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  date?: string;
  time?: string;
  latitude?: number;
  longitude?: number;
  currentLat?: number;
  currentLng?: number;
  createdAt?: string;
};

type SOSItem = {
  id: string;
  userId?: string;
  email?: string;
  status?: string;
  message?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

type MapPoint = {
  id: string;
  type: "driver" | "passenger" | "ride" | "sos";
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  status: string;
};

export default function AdminLiveMapCenterPage() {
  const [users, setUsers] = useState<LocationItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [sosEvents, setSosEvents] = useState<SOSItem[]>([]);
  const [message, setMessage] = useState("Loading live map center...");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => {
          setter([]);
          setMessage("");
        }
      );

    const unsubUsers = listen<LocationItem>("users", setUsers);
    const unsubRides = listen<RideItem>("rides", setRides);
    const unsubSOS = listen<SOSItem>("sosEvents", setSosEvents);

    return () => {
      unsubUsers();
      unsubRides();
      unsubSOS();
    };
  }, []);

  const data = useMemo(() => {
    const activeDrivers = users.filter(
      (item) =>
        item.role === "driver" ||
        item.role === "admin_driver" ||
        item.status === "driver" ||
        item.online
    );

    const activePassengers = users.filter(
      (item) =>
        item.role === "passenger" ||
        item.role === "member" ||
        (!item.role && item.email)
    );

    const liveRides = rides.filter((item) =>
      ["active", "in_progress", "started", "confirmed"].includes(item.status || "")
    );

    const activeSOS = sosEvents.filter(
      (item) => !item.status || item.status === "open" || item.status === "active"
    );

    const points: MapPoint[] = [];

    activeDrivers.forEach((item) => {
      const lat = Number(item.latitude || item.currentLat || 0);
      const lng = Number(item.longitude || item.currentLng || 0);
      if (lat && lng) {
        points.push({
          id: item.id,
          type: "driver",
          title: item.name || item.email || "Driver",
          subtitle: `${item.city || "Unknown city"} ${item.state || ""}`.trim(),
          lat,
          lng,
          status: item.online ? "online" : item.status || "driver",
        });
      }
    });

    activePassengers.forEach((item) => {
      const lat = Number(item.latitude || item.currentLat || 0);
      const lng = Number(item.longitude || item.currentLng || 0);
      if (lat && lng) {
        points.push({
          id: item.id,
          type: "passenger",
          title: item.name || item.email || "Passenger",
          subtitle: `${item.city || "Unknown city"} ${item.state || ""}`.trim(),
          lat,
          lng,
          status: item.online ? "online" : item.status || "passenger",
        });
      }
    });

    liveRides.forEach((item) => {
      const lat = Number(item.latitude || item.currentLat || 0);
      const lng = Number(item.longitude || item.currentLng || 0);
      if (lat && lng) {
        points.push({
          id: item.id,
          type: "ride",
          title: `${item.from || "Origin"} → ${item.to || "Destination"}`,
          subtitle: item.driverEmail || "Driver not assigned",
          lat,
          lng,
          status: item.status || "active",
        });
      }
    });

    activeSOS.forEach((item) => {
      const lat = Number(item.latitude || 0);
      const lng = Number(item.longitude || 0);
      if (lat && lng) {
        points.push({
          id: item.id,
          type: "sos",
          title: item.email || "SOS Event",
          subtitle: item.message || "Emergency alert",
          lat,
          lng,
          status: item.status || "open",
        });
      }
    });

    const center =
      points.length > 0
        ? {
            lat: points.reduce((total, item) => total + item.lat, 0) / points.length,
            lng: points.reduce((total, item) => total + item.lng, 0) / points.length,
          }
        : { lat: 18.2208, lng: -66.5901 };

    const healthScore = Math.max(
      Math.min(
        activeDrivers.length * 8 +
          liveRides.length * 12 +
          points.length * 5 -
          activeSOS.length * 15,
        100
      ),
      0
    );

    return {
      activeDrivers,
      activePassengers,
      liveRides,
      activeSOS,
      points,
      center,
      healthScore,
    };
  }, [users, rides, sosEvents]);

  async function resolveSOS(event: SOSItem) {
    try {
      setSavingId(event.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "sosEvents", event.id),
        {
          status: "resolved",
          resolvedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `sos-resolved-${event.id}-${Date.now()}`),
        {
          action: "SOS Event Resolved",
          targetId: event.id,
          targetType: "sosEvent",
          details: `${event.email || "User"} SOS event marked as resolved.`,
          severity: "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("SOS event resolved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not resolve SOS.");
    } finally {
      setSavingId("");
    }
  }

  function mapsUrl(lat: number, lng: number) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  function pointIcon(type: MapPoint["type"]) {
    if (type === "driver") return "🚗";
    if (type === "passenger") return "🧍";
    if (type === "ride") return "🛣️";
    return "🚨";
  }

  function pointClass(type: MapPoint["type"]) {
    if (type === "sos") return "sosPoint";
    if (type === "driver") return "driverPoint";
    if (type === "ride") return "ridePoint";
    return "passengerPoint";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/live-trips" className="miniButton">Live Trips</Link>
          <Link href="/admin/emergency" className="miniButton">Emergency</Link>
          <Link href="/admin/safety" className="miniButton">Safety</Link>
          <Link href="/admin/map" className="miniButton">Map Center</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Operations</p>
            <h1>Live Map <span>Center</span></h1>
            <p className="subtitle">
              Monitor active drivers, passengers, live rides, SOS events, operational map points,
              real-time locations and marketplace movement.
            </p>
          </div>

          <div className={data.healthScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{data.healthScore}</strong>
            <span>Map Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚗" label="Active Drivers" value={String(data.activeDrivers.length)} />
          <Metric icon="🧍" label="Passengers" value={String(data.activePassengers.length)} />
          <Metric icon="🛣️" label="Live Rides" value={String(data.liveRides.length)} />
          <Metric icon="🚨" label="Active SOS" value={String(data.activeSOS.length)} />
          <Metric icon="📍" label="Map Points" value={String(data.points.length)} />
          <Metric icon="🌎" label="Center Lat" value={data.center.lat.toFixed(4)} />
          <Metric icon="🌎" label="Center Lng" value={data.center.lng.toFixed(4)} />
          <Metric icon="⚡" label="Mode" value="Realtime" />
        </section>

        <section className="mapGrid">
          <section className="mapPanel">
            <div className="mapHeader">
              <div>
                <p className="eyebrow">Live Operations Map</p>
                <h2>Puerto Rico Command View</h2>
              </div>

              <a
                href={mapsUrl(data.center.lat, data.center.lng)}
                target="_blank"
                rel="noreferrer"
                className="openMapButton"
              >
                Open Google Maps
              </a>
            </div>

            <div className="fakeMap">
              <div className="mapGlow" />

              {data.points.length === 0 ? (
                <div className="noPoints">
                  <h3>No GPS points yet</h3>
                  <p>
                    When the app starts saving latitude and longitude in users, rides or SOS events,
                    the live map will display them here.
                  </p>
                </div>
              ) : (
                data.points.slice(0, 25).map((point, index) => (
                  <a
                    key={`${point.type}-${point.id}`}
                    href={mapsUrl(point.lat, point.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className={`mapPoint ${pointClass(point.type)}`}
                    style={{
                      left: `${10 + ((index * 17) % 78)}%`,
                      top: `${15 + ((index * 23) % 68)}%`,
                    }}
                    title={`${point.title} ${point.lat},${point.lng}`}
                  >
                    {pointIcon(point.type)}
                  </a>
                ))
              )}
            </div>

            <p className="mapNote">
              This premium map panel is Firestore-ready. For a real embedded Google Map,
              connect Maps JavaScript API and render these same GPS points as markers.
            </p>
          </section>

          <section className="sidePanel">
            <p className="eyebrow">Map Legend</p>
            <h2>Live Signals</h2>

            <div className="legendList">
              <Legend icon="🚗" title="Drivers" text="Online or driver-role users with GPS." />
              <Legend icon="🧍" title="Passengers" text="Passenger/member users with GPS." />
              <Legend icon="🛣️" title="Live Rides" text="Active or confirmed rides with location." />
              <Legend icon="🚨" title="SOS" text="Open emergency alerts with GPS." />
            </div>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Live Points</p>
          <h2>Location Feed</h2>

          {data.points.length === 0 ? (
            <div className="empty">
              <h3>No live location points</h3>
              <p>Start saving latitude and longitude on users, rides or SOS records.</p>
            </div>
          ) : (
            <div className="pointGrid">
              {data.points.map((point) => (
                <section key={`${point.type}-${point.id}`} className={`pointCard ${pointClass(point.type)}`}>
                  <div className="cardTop">
                    <div>
                      <h3>{pointIcon(point.type)} {point.title}</h3>
                      <p>{point.subtitle}</p>
                    </div>

                    <span className="pill">{point.status}</span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Type" value={point.type} />
                    <Info label="Latitude" value={String(point.lat)} />
                    <Info label="Longitude" value={String(point.lng)} />
                    <Info label="ID" value={point.id} />
                  </div>

                  <a
                    href={mapsUrl(point.lat, point.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="openMapButton full"
                  >
                    Open Location
                  </a>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <p className="eyebrow">Emergency Layer</p>
          <h2>SOS Events</h2>

          {data.activeSOS.length === 0 ? (
            <div className="empty">
              <h3>No active SOS events</h3>
              <p>Emergency events will appear here when a user triggers SOS.</p>
            </div>
          ) : (
            <div className="pointGrid">
              {data.activeSOS.map((event) => (
                <section key={event.id} className="pointCard sosPoint">
                  <div className="cardTop">
                    <div>
                      <h3>🚨 {event.email || "SOS Event"}</h3>
                      <p>{event.message || "Emergency alert"}</p>
                    </div>

                    <span className="pill dangerPill">{event.status || "open"}</span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Latitude" value={String(event.latitude || "Not set")} />
                    <Info label="Longitude" value={String(event.longitude || "Not set")} />
                    <Info label="Created" value={event.createdAt || "Not available"} />
                  </div>

                  <div className="actions">
                    {event.latitude && event.longitude && (
                      <a
                        href={mapsUrl(Number(event.latitude), Number(event.longitude))}
                        target="_blank"
                        rel="noreferrer"
                        className="openMapButton"
                      >
                        Open SOS Location
                      </a>
                    )}

                    <button
                      onClick={() => resolveSOS(event)}
                      disabled={savingId === event.id}
                      className="resolveButton"
                    >
                      {savingId === event.id ? "Resolving..." : "Resolve SOS"}
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1450px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton,
        .openMapButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .card,
        .mapPanel,
        .sidePanel,
        .pointCard {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
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
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .empty p,
        .pointCard p,
        .legendList p,
        .mapNote,
        .noPoints p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .scoreOrb {
          min-width: 112px;
          height: 112px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 12px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .mapGrid {
          display: grid;
          grid-template-columns: 1.55fr 0.45fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .mapPanel,
        .sidePanel,
        .card {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .mapHeader {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .fakeMap {
          position: relative;
          height: 520px;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          background:
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            radial-gradient(circle at 30% 25%, rgba(34,197,94,0.22), transparent 22%),
            radial-gradient(circle at 70% 70%, rgba(59,130,246,0.18), transparent 25%),
            linear-gradient(135deg, #020617, #111827);
          background-size: 44px 44px, 44px 44px, auto, auto, auto;
        }

        .mapGlow {
          position: absolute;
          inset: 18%;
          border-radius: 50%;
          border: 1px solid rgba(34,197,94,0.18);
          box-shadow: 0 0 80px rgba(34,197,94,0.18);
        }

        .mapPoint {
          position: absolute;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 22px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.45);
          transform: translate(-50%, -50%);
        }

        .driverPoint {
          background: rgba(34,197,94,0.18);
          border: 1px solid rgba(34,197,94,0.55);
        }

        .passengerPoint {
          background: rgba(59,130,246,0.18);
          border: 1px solid rgba(59,130,246,0.55);
        }

        .ridePoint {
          background: rgba(168,85,247,0.18);
          border: 1px solid rgba(168,85,247,0.55);
        }

        .sosPoint {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.55) !important;
        }

        .noPoints {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
        }

        .noPoints h3 {
          font-size: 28px;
          margin: 0 0 10px;
        }

        .mapNote {
          margin: 14px 0 0;
          font-size: 13px;
        }

        .legendList {
          display: grid;
          gap: 12px;
        }

        .legendItem {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .legendIcon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .legendItem h3 {
          margin: 0 0 6px;
          font-size: 17px;
        }

        .legendItem p {
          margin: 0;
          font-size: 13px;
        }

        .pointGrid {
          display: grid;
          gap: 16px;
        }

        .pointCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .pointCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .pointCard p {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .dangerPill {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .infoBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          display: block;
          overflow-wrap: anywhere;
        }

        .full {
          display: inline-flex;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .resolveButton {
          padding: 12px 18px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1180px) {
          .stats,
          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .mapGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .mapHeader,
          .cardTop {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          .fakeMap {
            height: 420px;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Legend({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <section className="legendItem">
      <div className="legendIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
      }
