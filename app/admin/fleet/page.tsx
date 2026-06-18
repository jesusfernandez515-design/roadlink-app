"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  online?: boolean;
  lastSeen?: string;
  driverVerified?: boolean;
  suspended?: boolean;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverId?: string;
  driverEmail?: string;
  createdAt?: string;
};

type LiveLocation = {
  id: string;
  userId?: string;
  userEmail?: string;
  type?: "driver" | "passenger" | "sos" | string;
  rideId?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  speed?: number;
  heading?: number;
  updatedAt?: string;
  createdAt?: string;
};

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  rideId?: string;
  status?: string;
  priority?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
};

type FleetUnit = {
  id: string;
  type: "driver" | "passenger" | "sos" | "unknown";
  userId: string;
  userEmail: string;
  rideId: string;
  rideTitle: string;
  latitude?: number;
  longitude?: number;
  speed: number;
  status: "online" | "moving" | "stopped" | "offline" | "sos";
  risk: "low" | "medium" | "high" | "critical";
  reason: string;
  updatedAt?: string;
};

export default function AdminFleetPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selected, setSelected] = useState<FleetUnit | null>(null);
  const [filter, setFilter] = useState<"all" | FleetUnit["type"] | FleetUnit["risk"]>("all");
  const [message, setMessage] = useState("Loading fleet tracking...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const listen = (name: string, setter: (items: any[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
          setMessage("");
        },
        () => setter([])
      );

    const unsubUsers = listen("users", setUsers);
    const unsubRides = listen("rides", setRides);
    const unsubLocations = listen("liveLocations", setLocations);
    const unsubAlerts = listen("emergencyAlerts", setAlerts);

    return () => {
      unsubUsers();
      unsubRides();
      unsubLocations();
      unsubAlerts();
    };
  }, []);

  const fleetUnits = useMemo<FleetUnit[]>(() => {
    const activeAlerts = alerts.filter((alert) => alert.status === "active");

    const locationUnits: FleetUnit[] = locations.map((location) => {
      const user = users.find(
        (item) => item.id === location.userId || item.email === location.userEmail
      );

      const ride = rides.find((item) => item.id === location.rideId);

      const speed = Number(location.speed || 0);

      let status: FleetUnit["status"] = "online";
      let risk: FleetUnit["risk"] = "low";
      const reasons: string[] = [];

      const hasGps =
        typeof location.latitude === "number" && typeof location.longitude === "number";

      if (!hasGps) {
        status = "offline";
        risk = "high";
        reasons.push("GPS missing");
      }

      if (speed > 3) {
        status = "moving";
      }

      if (speed <= 3 && hasGps) {
        status = "stopped";
        reasons.push("unit stopped or low speed");
      }

      if (location.updatedAt) {
        const age = Date.now() - new Date(location.updatedAt).getTime();

        if (!Number.isNaN(age) && age > 20 * 60 * 1000) {
          status = "offline";
          risk = "medium";
          reasons.push("GPS older than 20 minutes");
        }

        if (!Number.isNaN(age) && age > 60 * 60 * 1000) {
          status = "offline";
          risk = "high";
          reasons.push("GPS older than 1 hour");
        }
      } else {
        risk = "medium";
        reasons.push("missing update timestamp");
      }

      if (user?.suspended) {
        risk = "high";
        reasons.push("user is suspended");
      }

      const hasSos = activeAlerts.some(
        (alert) =>
          alert.rideId === location.rideId ||
          alert.userId === location.userId ||
          alert.userEmail === location.userEmail
      );

      if (hasSos) {
        status = "sos";
        risk = "critical";
        reasons.push("active SOS linked to this unit");
      }

      const type: FleetUnit["type"] =
        location.type === "driver"
          ? "driver"
          : location.type === "passenger"
          ? "passenger"
          : location.type === "sos"
          ? "sos"
          : "unknown";

      return {
        id: location.id,
        type,
        userId: location.userId || user?.id || "No user",
        userEmail: location.userEmail || user?.email || "No email",
        rideId: location.rideId || "No ride",
        rideTitle: ride ? `${ride.from || "Origin"} → ${ride.to || "Destination"}` : "No active ride",
        latitude: location.latitude,
        longitude: location.longitude,
        speed,
        status,
        risk,
        reason: reasons.length > 0 ? reasons.join(", ") : "normal live fleet signal",
        updatedAt: location.updatedAt || location.createdAt,
      };
    });

    const sosUnits: FleetUnit[] = activeAlerts.map((alert) => ({
      id: `sos-${alert.id}`,
      type: "sos",
      userId: alert.userId || "No user",
      userEmail: alert.userEmail || "SOS User",
      rideId: alert.rideId || "No ride",
      rideTitle: "Active SOS Alert",
      latitude: typeof alert.latitude === "number" ? alert.latitude : undefined,
      longitude: typeof alert.longitude === "number" ? alert.longitude : undefined,
      speed: 0,
      status: "sos",
      risk: "critical",
      reason:
        typeof alert.latitude === "number" && typeof alert.longitude === "number"
          ? "active SOS with GPS location"
          : "active SOS without GPS coordinates",
      updatedAt: alert.createdAt,
    }));

    return [...sosUnits, ...locationUnits].sort((a, b) => {
      const order = { critical: 4, high: 3, medium: 2, low: 1 };
      return order[b.risk] - order[a.risk];
    });
  }, [users, rides, locations, alerts]);

  const filteredUnits = useMemo(() => {
    if (filter === "all") return fleetUnits;

    return fleetUnits.filter(
      (item) => item.type === filter || item.risk === filter
    );
  }, [fleetUnits, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredUnits.length === 0) return null;
      if (!current) return filteredUnits[0];
      return filteredUnits.find((item) => item.id === current.id) || filteredUnits[0];
    });
  }, [filteredUnits]);

  const drivers = fleetUnits.filter((item) => item.type === "driver");
  const passengers = fleetUnits.filter((item) => item.type === "passenger");
  const moving = fleetUnits.filter((item) => item.status === "moving");
  const stopped = fleetUnits.filter((item) => item.status === "stopped");
  const offline = fleetUnits.filter((item) => item.status === "offline");
  const sos = fleetUnits.filter((item) => item.status === "sos");

  const fleetScore = Math.max(
    100 - sos.length * 25 - offline.length * 10 - stopped.length * 4,
    0
  );

  async function saveFleetCase(item: FleetUnit) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "fleetCases", item.id.replaceAll("/", "-")),
        {
          ...item,
          status: "open",
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `fleet-${item.id.replaceAll("/", "-")}-${Date.now()}`),
        {
          userId: item.userId,
          userEmail: item.userEmail,
          action: "Fleet Case Saved",
          targetId: item.id,
          targetType: "fleet",
          details: item.reason,
          severity: item.risk === "critical" || item.risk === "high" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Fleet case saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save fleet case.");
    } finally {
      setLoadingId("");
    }
  }

  function riskLabel(risk: FleetUnit["risk"]) {
    if (risk === "critical") return "Critical";
    if (risk === "high") return "High Risk";
    if (risk === "medium") return "Medium Risk";
    return "Low Risk";
  }

  function statusLabel(status: FleetUnit["status"]) {
    if (status === "moving") return "Moving";
    if (status === "stopped") return "Stopped";
    if (status === "offline") return "GPS Offline";
    if (status === "sos") return "SOS";
    return "Online";
  }

  function shortText(value?: string, max = 42) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

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

  function mapUrl(item: FleetUnit) {
    if (!item.latitude || !item.longitude) return "";
    return `https://maps.google.com/maps?q=${item.latitude},${item.longitude}&z=14&output=embed`;
  }

  function openMapUrl(item: FleetUnit) {
    if (!item.latitude || !item.longitude) return "";
    return `https://maps.google.com/?q=${item.latitude},${item.longitude}`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/map-center" className="miniButton">Map</Link>
          <Link href="/admin/dispatch" className="miniButton">Dispatch</Link>
          <Link href="/admin/geofence" className="miniButton">Geofence</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Live Operations</p>
            <h1>Fleet <span>Tracking</span></h1>
            <p className="subtitle">
              Track drivers, passengers, SOS alerts, moving units, stopped units and GPS risk signals in real time.
            </p>
          </div>

          <div className={fleetScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{fleetScore}</strong>
            <span>Fleet Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚘" label="Drivers" value={String(drivers.length)} />
          <Metric icon="👤" label="Passengers" value={String(passengers.length)} />
          <Metric icon="🟢" label="Moving" value={String(moving.length)} />
          <Metric icon="🟡" label="Stopped" value={String(stopped.length)} danger={stopped.length > 0} />
          <Metric icon="⚫" label="GPS Offline" value={String(offline.length)} danger={offline.length > 0} />
          <Metric icon="🚨" label="SOS" value={String(sos.length)} danger={sos.length > 0} />
        </section>

        <section className="filters">
          {(["all", "driver", "passenger", "sos", "critical", "high", "medium", "low"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={filter === item ? "activeFilter" : ""}
            >
              {item === "all"
                ? "All"
                : item === "driver"
                ? "Drivers"
                : item === "passenger"
                ? "Passengers"
                : item === "sos"
                ? "SOS"
                : riskLabel(item)}
            </button>
          ))}
        </section>

        <section className="adminGrid">
          <section className="queueCard">
            <p className="eyebrow">Fleet Queue</p>
            <h2>Live Units</h2>

            {filteredUnits.length === 0 ? (
              <div className="empty">
                <h3>No fleet units</h3>
                <p>No live locations match this filter.</p>
              </div>
            ) : (
              <div className="unitList">
                {filteredUnits.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "unitRow activeUnit" : "unitRow"}
                  >
                    <div className={`unitIcon ${item.risk}`}>
                      {item.status === "sos"
                        ? "🚨"
                        : item.type === "driver"
                        ? "🚘"
                        : item.type === "passenger"
                        ? "👤"
                        : "📍"}
                    </div>

                    <div className="unitInfo">
                      <strong>{shortText(item.userEmail)}</strong>
                      <span>{shortText(item.rideTitle)}</span>
                      <small>{statusLabel(item.status)} • {item.reason}</small>
                    </div>

                    <em className={`risk ${item.risk}`}>{riskLabel(item.risk)}</em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Unit</p>
                    <h2>{shortText(selected.userEmail, 54)}</h2>
                    <p className="email">{selected.rideTitle}</p>
                  </div>

                  <span className={`riskPill ${selected.risk}`}>
                    {riskLabel(selected.risk)}
                  </span>
                </div>

                <div className={`fleetBox ${selected.risk}`}>
                  <span>{statusLabel(selected.status)}</span>
                  <strong>{riskLabel(selected.risk)}</strong>
                  <p>{selected.reason}</p>
                </div>

                {mapUrl(selected) ? (
                  <div className="mapBox">
                    <iframe
                      src={mapUrl(selected)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : (
                  <div className="empty">
                    <h3>No GPS coordinates</h3>
                    <p>This fleet unit does not have valid latitude and longitude.</p>
                  </div>
                )}

                {openMapUrl(selected) && (
                  <a href={openMapUrl(selected)} target="_blank" rel="noreferrer" className="mapButton">
                    Open Location in Google Maps
                  </a>
                )}

                <div className="infoGrid">
                  <Info label="Unit ID" value={selected.id} />
                  <Info label="Type" value={selected.type} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="User ID" value={selected.userId} />
                  <Info label="User Email" value={selected.userEmail} />
                  <Info label="Ride ID" value={selected.rideId} />
                  <Info label="Latitude" value={selected.latitude ? String(selected.latitude) : "Missing"} />
                  <Info label="Longitude" value={selected.longitude ? String(selected.longitude) : "Missing"} />
                  <Info label="Speed" value={`${selected.speed} mph`} />
                  <Info label="Updated" value={timeAgo(selected.updatedAt)} />
                  <Info label="Risk" value={riskLabel(selected.risk)} />
                  <Info label="Reason" value={selected.reason} />
                </div>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveFleetCase(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Case
                  </button>

                  <Link href="/admin/map-center" className="linkButton">
                    Open Map
                  </Link>

                  <Link href="/admin/dispatch" className="linkButton">
                    Dispatch
                  </Link>

                  <Link href="/admin/emergency" className="dangerButton">
                    SOS
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a fleet unit</h3>
                <p>Choose a live location to view tracking details.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container { max-width: 1280px; margin: auto; }

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
        .queueCard,
        .detailsCard {
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
        .email,
        .empty p,
        .fleetBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
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

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .queueCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .unitList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .unitRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeUnit {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .unitIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .unitIcon.medium {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .unitIcon.high,
        .unitIcon.critical {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .unitInfo { min-width: 0; }

        .unitInfo strong,
        .unitInfo span,
        .unitInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .unitInfo span,
        .unitInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .risk,
        .riskPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .risk.low,
        .riskPill.low {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .risk.medium,
        .riskPill.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .risk.high,
        .riskPill.high,
        .risk.critical,
        .riskPill.critical {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .fleetBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .fleetBox.medium {
          background: rgba(250,204,21,0.1);
          border-color: rgba(250,204,21,0.35);
        }

        .fleetBox.high,
        .fleetBox.critical {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .fleetBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .fleetBox strong {
          color: #22c55e;
          font-size: 36px;
          font-weight: 900;
        }

        .fleetBox.medium strong {
          color: #fde68a;
        }

        .fleetBox.high strong,
        .fleetBox.critical strong {
          color: #fca5a5;
        }

        .mapBox {
          width: 100%;
          height: 320px;
          border-radius: 22px;
          overflow: hidden;
          margin-bottom: 14px;
          border: 1px solid rgba(59,130,246,0.35);
          background: rgba(59,130,246,0.08);
        }

        .mapBox iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }

        .mapButton {
          display: flex;
          justify-content: center;
          padding: 14px;
          border-radius: 999px;
          color: #93c5fd;
          text-decoration: none;
          background: rgba(59,130,246,0.13);
          border: 1px solid rgba(59,130,246,0.35);
          font-weight: 900;
          margin-bottom: 18px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 18px;
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

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .saveButton,
        .linkButton,
        .dangerButton {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .saveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .linkButton {
          background: rgba(59,130,246,0.13);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 16px;
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
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

          .stats,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .unitRow {
            grid-template-columns: 46px 1fr;
          }

          .unitRow .risk {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .unitIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
          }

          .mapBox {
            height: 260px;
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
  }
