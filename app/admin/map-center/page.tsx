"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type LocationType = "driver" | "passenger" | "ride" | "sos" | "user";

type LiveLocation = {
  id: string;
  userId?: string;
  userEmail?: string;
  type?: LocationType | string;
  latitude?: number;
  longitude?: number;
  rideId?: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  priority?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
};

export default function AdminMapCenterPage() {
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [filter, setFilter] = useState<"all" | "driver" | "passenger" | "ride" | "sos">("all");
  const [message, setMessage] = useState("Loading map center...");

  useEffect(() => {
    const unsubLocations = onSnapshot(
      query(collection(db, "liveLocations")),
      (snapshot) => {
        setLocations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as LiveLocation[]);
        setMessage("");
      },
      () => setLocations([])
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
      },
      () => setRides([])
    );

    const unsubAlerts = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        setAlerts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyAlert[]);
      },
      () => setAlerts([])
    );

    return () => {
      unsubLocations();
      unsubRides();
      unsubAlerts();
    };
  }, []);

  const mapData = useMemo(() => {
    const activeSOS = alerts.filter((item) => item.status === "active");

    const sosLocations: LiveLocation[] = activeSOS
      .filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number")
      .map((item) => ({
        id: `sos-${item.id}`,
        userId: item.userId,
        userEmail: item.userEmail,
        type: "sos",
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      }));

    const rideLocations: LiveLocation[] = rides
      .filter(
        (item) =>
          (item.status === "active" || item.status === "open" || item.status === "in_progress") &&
          typeof item.latitude === "number" &&
          typeof item.longitude === "number"
      )
      .map((item) => ({
        id: `ride-${item.id}`,
        userEmail: item.driverEmail,
        type: "ride",
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        rideId: item.id,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      }));

    const all = [...locations, ...sosLocations, ...rideLocations].filter(
      (item) => typeof item.latitude === "number" && typeof item.longitude === "number"
    );

    const visible = filter === "all" ? all : all.filter((item) => item.type === filter);

    const drivers = all.filter((item) => item.type === "driver");
    const passengers = all.filter((item) => item.type === "passenger");
    const ridePins = all.filter((item) => item.type === "ride");
    const sosPins = all.filter((item) => item.type === "sos");

    const center = visible[0] || all[0];

    const mapUrl = center
      ? `https://maps.google.com/maps?q=${center.latitude},${center.longitude}&z=10&output=embed`
      : "";

    return {
      all,
      visible,
      drivers,
      passengers,
      ridePins,
      sosPins,
      activeSOS,
      mapUrl,
    };
  }, [locations, rides, alerts, filter]);

  function timeAgo(value?: string) {
    if (!value) return "Recently";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function iconFor(type?: string) {
    if (type === "driver") return "🚘";
    if (type === "passenger") return "👤";
    if (type === "ride") return "🛣️";
    if (type === "sos") return "🚨";
    return "📍";
  }

  function labelFor(type?: string) {
    if (type === "driver") return "Driver";
    if (type === "passenger") return "Passenger";
    if (type === "ride") return "Ride";
    if (type === "sos") return "SOS";
    return "User";
  }

  function shortText(value?: string, max = 36) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  function googleMapLink(item: LiveLocation) {
    return `https://maps.google.com/?q=${item.latitude},${item.longitude}`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/live" className="miniButton">Live</Link>
          <Link href="/admin/operations" className="miniButton">Operations</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Command</p>
            <h1>Map <span>Center</span></h1>
            <p className="subtitle">
              Monitor live GPS locations, active rides, drivers, passengers and emergency SOS alerts.
            </p>
          </div>

          <div className={mapData.sosPins.length > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{mapData.visible.length}</strong>
            <span>Live Pins</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📍" label="Live Pins" value={String(mapData.all.length)} />
          <Metric icon="🚘" label="Drivers" value={String(mapData.drivers.length)} />
          <Metric icon="👤" label="Passengers" value={String(mapData.passengers.length)} />
          <Metric icon="🛣️" label="Rides" value={String(mapData.ridePins.length)} />
          <Metric icon="🚨" label="SOS" value={String(mapData.sosPins.length)} danger={mapData.sosPins.length > 0} />
          <Metric icon="🔥" label="Active Alerts" value={String(mapData.activeSOS.length)} danger={mapData.activeSOS.length > 0} />
        </section>

        <section className="filters">
          {(["all", "driver", "passenger", "ride", "sos"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={filter === item ? "activeFilter" : ""}
            >
              {item === "all" ? "All" : labelFor(item)}
            </button>
          ))}
        </section>

        <section className="mapGrid">
          <section className="mapCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Live Map</p>
                <h2>Realtime Location View</h2>
              </div>

              <div className="liveBadge">
                <span></span>
                LIVE
              </div>
            </div>

            {mapData.mapUrl ? (
              <iframe
                src={mapData.mapUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="emptyMap">
                <h3>No live GPS data yet</h3>
                <p>
                  Add documents to Firestore collection <strong>liveLocations</strong> with latitude and longitude.
                </p>
              </div>
            )}
          </section>

          <section className="listCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Location Queue</p>
                <h2>Live Pins</h2>
              </div>
            </div>

            {mapData.visible.length === 0 ? (
              <div className="empty">
                <h3>No pins found</h3>
                <p>No locations match this filter.</p>
              </div>
            ) : (
              <div className="pinList">
                {mapData.visible.map((item) => (
                  <a
                    key={item.id}
                    href={googleMapLink(item)}
                    target="_blank"
                    rel="noreferrer"
                    className={item.type === "sos" ? "pinRow dangerPin" : "pinRow"}
                  >
                    <div className="pinIcon">{iconFor(item.type)}</div>

                    <div className="pinInfo">
                      <strong>{shortText(item.userEmail || item.rideId || item.userId || "RoadLink Location")}</strong>
                      <span>{labelFor(item.type)} • {item.status || "active"}</span>
                      <small>
                        {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)} •{" "}
                        {timeAgo(item.updatedAt || item.createdAt)}
                      </small>
                    </div>

                    <em>Open</em>
                  </a>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="setupCard">
          <p className="eyebrow">Firestore Setup</p>
          <h2>Live Locations Collection</h2>

          <div className="codeBox">
            <p>Collection:</p>
            <strong>liveLocations</strong>
            <p>Fields:</p>
            <span>userId, userEmail, type, latitude, longitude, rideId, status, updatedAt</span>
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(59,130,246,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1280px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
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

        .dangerLink {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .hero,
        .metric,
        .mapCard,
        .listCard,
        .setupCard {
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
          margin: 0;
        }

        .subtitle,
        .empty p,
        .emptyMap p,
        .codeBox p,
        .codeBox span {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 96px;
          height: 96px;
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
          font-size: 30px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
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
          font-size: 24px;
          font-weight: 900;
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }

        .filters button {
          padding: 10px 15px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .filters .activeFilter {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .mapGrid {
          display: grid;
          grid-template-columns: 1.4fr 0.8fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .mapCard,
        .listCard,
        .setupCard {
          border-radius: 30px;
          padding: 24px;
          overflow: hidden;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .liveBadge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          border: 1px solid rgba(34,197,94,0.4);
          background: rgba(34,197,94,0.12);
          color: #22c55e;
          font-size: 11px;
          font-weight: 900;
          padding: 8px 10px;
        }

        .liveBadge span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 1.3s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        iframe {
          width: 100%;
          height: 620px;
          border: 0;
          border-radius: 24px;
          background: rgba(255,255,255,0.04);
        }

        .emptyMap,
        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .emptyMap {
          min-height: 620px;
          display: flex;
          justify-content: center;
          flex-direction: column;
        }

        .empty h3,
        .emptyMap h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        .pinList {
          display: grid;
          gap: 10px;
          max-height: 620px;
          overflow: auto;
          padding-right: 4px;
        }

        .pinRow {
          display: grid;
          grid-template-columns: 46px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 13px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
        }

        .dangerPin {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .pinIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .dangerPin .pinIcon {
          background: rgba(239,68,68,0.16);
        }

        .pinInfo {
          min-width: 0;
        }

        .pinInfo strong,
        .pinInfo span,
        .pinInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pinInfo span,
        .pinInfo small {
          color: #a1a1aa;
          margin-top: 4px;
          font-size: 12px;
        }

        .pinRow em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
        }

        .codeBox {
          padding: 18px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .codeBox strong {
          display: block;
          color: #22c55e;
          font-size: 20px;
          margin-bottom: 12px;
        }

        .codeBox p {
          margin: 0 0 6px;
          font-weight: 900;
        }

        .codeBox span {
          display: block;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
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

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          iframe,
          .emptyMap {
            height: 380px;
            min-height: 380px;
          }

          .pinRow {
            grid-template-columns: 44px 1fr;
          }

          .pinRow em {
            grid-column: 1 / -1;
            width: fit-content;
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
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}
