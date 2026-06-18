"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type TripStatus =
  | "active"
  | "open"
  | "in_progress"
  | "reserved"
  | "confirmed"
  | "completed"
  | "cancelled";

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: TripStatus | string;
  driverId?: string;
  driverEmail?: string;
  date?: string;
  time?: string;
  seats?: number;
  price?: number;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  durationMinutes?: number;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  rideId?: string;
  status?: TripStatus | string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type LiveLocation = {
  id: string;
  userId?: string;
  userEmail?: string;
  type?: string;
  rideId?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
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

type LiveTrip = {
  id: string;
  ride: RideItem;
  bookings: BookingItem[];
  driverLocation?: LiveLocation;
  passengerLocations: LiveLocation[];
  sosAlerts: EmergencyAlert[];
  status: string;
  passengers: number;
  revenue: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskReason: string;
  lastUpdate?: string;
};

export default function AdminLiveTripsPage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selected, setSelected] = useState<LiveTrip | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "sos" | "high" | "completed">("all");
  const [message, setMessage] = useState("Loading live trips monitor...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
      },
      () => setBookings([])
    );

    const unsubLocations = onSnapshot(
      query(collection(db, "liveLocations")),
      (snapshot) => {
        setLocations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as LiveLocation[]);
      },
      () => setLocations([])
    );

    const unsubAlerts = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        setAlerts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyAlert[]);
      },
      () => setAlerts([])
    );

    return () => {
      unsubRides();
      unsubBookings();
      unsubLocations();
      unsubAlerts();
    };
  }, []);

  const liveTrips = useMemo<LiveTrip[]>(() => {
    return rides
      .map((ride) => {
        const rideBookings = bookings.filter((booking) => booking.rideId === ride.id);

        const activeBookings = rideBookings.filter(
          (booking) =>
            booking.status === "pending" ||
            booking.status === "reserved" ||
            booking.status === "confirmed" ||
            booking.status === "in_progress"
        );

        const driverLocation = locations.find(
          (item) =>
            item.type === "driver" &&
            (item.rideId === ride.id ||
              item.userId === ride.driverId ||
              item.userEmail === ride.driverEmail)
        );

        const passengerLocations = locations.filter(
          (item) =>
            item.type === "passenger" &&
            (item.rideId === ride.id ||
              activeBookings.some(
                (booking) =>
                  booking.passengerId === item.userId ||
                  booking.passengerEmail === item.userEmail
              ))
        );

        const sosAlerts = alerts.filter(
          (alert) =>
            alert.status === "active" &&
            (alert.rideId === ride.id ||
              alert.userId === ride.driverId ||
              alert.userEmail === ride.driverEmail ||
              activeBookings.some(
                (booking) =>
                  booking.passengerId === alert.userId ||
                  booking.passengerEmail === alert.userEmail
              ))
        );

        const passengers = activeBookings.reduce(
          (total, booking) => total + Number(booking.seatsBooked || 1),
          0
        );

        const revenue = activeBookings.reduce((total, booking) => {
          return total + Number(booking.price || booking.amount || ride.price || 0) * Number(booking.seatsBooked || 1);
        }, 0);

        let riskLevel: LiveTrip["riskLevel"] = "low";
        const reasons: string[] = [];

        if (sosAlerts.length > 0) {
          riskLevel = "critical";
          reasons.push(`${sosAlerts.length} active SOS alert(s)`);
        }

        if (!driverLocation && ride.status === "in_progress") {
          riskLevel = riskLevel === "critical" ? riskLevel : "high";
          reasons.push("driver location missing");
        }

        if (ride.status === "cancelled") {
          riskLevel = riskLevel === "critical" ? riskLevel : "medium";
          reasons.push("ride cancelled");
        }

        if (activeBookings.length > 0 && passengerLocations.length === 0 && ride.status === "in_progress") {
          riskLevel = riskLevel === "critical" || riskLevel === "high" ? riskLevel : "medium";
          reasons.push("passenger locations missing");
        }

        if (reasons.length === 0) reasons.push("trip activity normal");

        const lastUpdate =
          driverLocation?.updatedAt ||
          passengerLocations[0]?.updatedAt ||
          ride.createdAt ||
          activeBookings[0]?.createdAt;

        return {
          id: ride.id,
          ride,
          bookings: activeBookings,
          driverLocation,
          passengerLocations,
          sosAlerts,
          status: ride.status || "open",
          passengers,
          revenue,
          riskLevel,
          riskReason: reasons.join(", "),
          lastUpdate,
        };
      })
      .filter((trip) => {
        return (
          trip.status === "active" ||
          trip.status === "open" ||
          trip.status === "in_progress" ||
          trip.status === "completed" ||
          trip.bookings.length > 0 ||
          trip.sosAlerts.length > 0
        );
      })
      .sort((a, b) => {
        const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      });
  }, [rides, bookings, locations, alerts]);

  const filteredTrips = useMemo(() => {
    if (filter === "active") {
      return liveTrips.filter(
        (trip) => trip.status === "active" || trip.status === "open" || trip.status === "in_progress"
      );
    }

    if (filter === "sos") return liveTrips.filter((trip) => trip.sosAlerts.length > 0);
    if (filter === "high") return liveTrips.filter((trip) => trip.riskLevel === "high" || trip.riskLevel === "critical");
    if (filter === "completed") return liveTrips.filter((trip) => trip.status === "completed");

    return liveTrips;
  }, [liveTrips, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredTrips.length === 0) return null;
      if (!current) return filteredTrips[0];
      return filteredTrips.find((item) => item.id === current.id) || filteredTrips[0];
    });
  }, [filteredTrips]);

  const activeTrips = liveTrips.filter(
    (trip) => trip.status === "active" || trip.status === "open" || trip.status === "in_progress"
  );

  const sosTrips = liveTrips.filter((trip) => trip.sosAlerts.length > 0);
  const highRiskTrips = liveTrips.filter((trip) => trip.riskLevel === "high" || trip.riskLevel === "critical");
  const totalPassengers = liveTrips.reduce((total, trip) => total + trip.passengers, 0);
  const liveRevenue = liveTrips.reduce((total, trip) => total + trip.revenue, 0);

  const operationsScore = Math.max(
    100 - sosTrips.length * 25 - highRiskTrips.length * 12,
    0
  );

  async function updateRideStatus(trip: LiveTrip, status: TripStatus) {
    try {
      setLoadingId(trip.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "rides", trip.id),
        {
          status,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `live-trip-${trip.id}-${Date.now()}`),
        {
          userId: trip.ride.driverId || "",
          userEmail: trip.ride.driverEmail || "",
          action: `Live Trip Status Updated To ${status}`,
          targetId: trip.id,
          targetType: "ride",
          details: trip.riskReason,
          severity: status === "cancelled" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Trip status updated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update trip.");
    } finally {
      setLoadingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
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

  function shortText(value?: string, max = 42) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  function riskLabel(value: LiveTrip["riskLevel"]) {
    if (value === "critical") return "Critical";
    if (value === "high") return "High Risk";
    if (value === "medium") return "Medium";
    return "Low Risk";
  }

  function mapUrl(trip: LiveTrip) {
    const location = trip.driverLocation || trip.passengerLocations[0];

    if (!location?.latitude || !location?.longitude) return "";

    return `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=13&output=embed`;
  }

  function openMapUrl(trip: LiveTrip) {
    const location = trip.driverLocation || trip.passengerLocations[0];

    if (!location?.latitude || !location?.longitude) return "";

    return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/map-center" className="miniButton">Map Center</Link>
          <Link href="/admin/live" className="miniButton">Live</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Operations</p>
            <h1>Live Trips <span>Monitor</span></h1>
            <p className="subtitle">
              Monitor live trips, active bookings, passengers, driver GPS, trip risk, SOS alerts and route activity.
            </p>
          </div>

          <div className={operationsScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{operationsScore}</strong>
            <span>Ops Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🛣️" label="Trips" value={String(liveTrips.length)} />
          <Metric icon="🚘" label="Active Trips" value={String(activeTrips.length)} />
          <Metric icon="👥" label="Passengers" value={String(totalPassengers)} />
          <Metric icon="💵" label="Live Value" value={money(liveRevenue)} />
          <Metric icon="⚠️" label="High Risk" value={String(highRiskTrips.length)} danger={highRiskTrips.length > 0} />
          <Metric icon="🚨" label="SOS Trips" value={String(sosTrips.length)} danger={sosTrips.length > 0} />
        </section>

        <section className="filters">
          {(["all", "active", "sos", "high", "completed"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={filter === item ? "activeFilter" : ""}
            >
              {item === "all"
                ? "All"
                : item === "sos"
                ? "SOS"
                : item === "high"
                ? "High Risk"
                : item}
            </button>
          ))}
        </section>

        <section className="adminGrid">
          <section className="tripsCard">
            <p className="eyebrow">Trip Queue</p>
            <h2>Live Trip Stream</h2>

            {filteredTrips.length === 0 ? (
              <div className="empty">
                <h3>No trips found</h3>
                <p>No trips match this filter yet.</p>
              </div>
            ) : (
              <div className="tripList">
                {filteredTrips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => setSelected(trip)}
                    className={selected?.id === trip.id ? "tripRow activeTrip" : "tripRow"}
                  >
                    <div className={`tripIcon ${trip.riskLevel}`}>
                      {trip.riskLevel === "critical"
                        ? "🚨"
                        : trip.riskLevel === "high"
                        ? "⚠️"
                        : "🛣️"}
                    </div>

                    <div className="tripInfo">
                      <strong>{shortText(`${trip.ride.from || "Origin"} → ${trip.ride.to || "Destination"}`, 46)}</strong>
                      <span>{shortText(trip.ride.driverEmail || "Driver not available")}</span>
                      <small>
                        {trip.passengers} passenger(s) • {money(trip.revenue)} • {timeAgo(trip.lastUpdate)}
                      </small>
                    </div>

                    <em className={`risk ${trip.riskLevel}`}>{riskLabel(trip.riskLevel)}</em>
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
                    <p className="eyebrow">Selected Trip</p>
                    <h2>{shortText(`${selected.ride.from || "Origin"} → ${selected.ride.to || "Destination"}`, 52)}</h2>
                    <p className="email">{selected.ride.driverEmail || "No driver email"}</p>
                  </div>

                  <span className={`riskPill ${selected.riskLevel}`}>
                    {riskLabel(selected.riskLevel)}
                  </span>
                </div>

                <div className="summaryBox">
                  <span>Trip Status</span>
                  <strong>{selected.status}</strong>
                  <p>{selected.riskReason}</p>
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
                    <h3>No GPS location</h3>
                    <p>This trip does not have live driver or passenger GPS data yet.</p>
                  </div>
                )}

                {openMapUrl(selected) && (
                  <a href={openMapUrl(selected)} target="_blank" rel="noreferrer" className="mapButton">
                    Open Trip Location
                  </a>
                )}

                <div className="infoGrid">
                  <Info label="Ride ID" value={selected.id} />
                  <Info label="Driver" value={selected.ride.driverEmail || "Not available"} />
                  <Info label="Status" value={selected.status} />
                  <Info label="Passengers" value={String(selected.passengers)} />
                  <Info label="Bookings" value={String(selected.bookings.length)} />
                  <Info label="Revenue" value={money(selected.revenue)} />
                  <Info label="Distance" value={selected.ride.distanceText || "Not available"} />
                  <Info label="Duration" value={selected.ride.durationText || "Not available"} />
                  <Info label="Driver GPS" value={selected.driverLocation ? "Available" : "Missing"} />
                  <Info label="Passenger GPS" value={String(selected.passengerLocations.length)} />
                  <Info label="SOS Alerts" value={String(selected.sosAlerts.length)} />
                  <Info label="Last Update" value={timeAgo(selected.lastUpdate)} />
                </div>

                {selected.sosAlerts.length > 0 && (
                  <section className="sosBox">
                    <p className="eyebrow">Emergency</p>
                    <h2>Active SOS Alerts</h2>

                    {selected.sosAlerts.map((alert) => (
                      <Link href="/admin/emergency" key={alert.id} className="sosRow">
                        <strong>{alert.userEmail || "SOS Alert"}</strong>
                        <span>{alert.priority || "critical"} • {timeAgo(alert.createdAt)}</span>
                      </Link>
                    ))}
                  </section>
                )}

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => updateRideStatus(selected, "in_progress")}
                    disabled={loadingId === selected.id}
                  >
                    In Progress
                  </button>

                  <button
                    className="completeButton"
                    onClick={() => updateRideStatus(selected, "completed")}
                    disabled={loadingId === selected.id}
                  >
                    Complete
                  </button>

                  <button
                    className="cancelButton"
                    onClick={() => updateRideStatus(selected, "cancelled")}
                    disabled={loadingId === selected.id}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a trip</h3>
                <p>Choose a trip to monitor details.</p>
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
            radial-gradient(circle at top right, rgba(59,130,246,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
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
        .tripsCard,
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
        .metricValue,
        .summaryBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .email,
        .empty p,
        .summaryBox p {
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

        .dangerMetric .metricIcon {
          background: rgba(239,68,68,0.16);
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
          overflow-wrap: anywhere;
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
          text-transform: capitalize;
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

        .tripsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .tripList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .tripRow {
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

        .activeTrip {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .tripIcon {
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

        .tripIcon.high,
        .tripIcon.critical {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .tripInfo { min-width: 0; }

        .tripInfo strong,
        .tripInfo span,
        .tripInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tripInfo span,
        .tripInfo small {
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

        .risk.critical,
        .riskPill.critical {
          color: #fecaca;
          background: rgba(185,28,28,0.25);
          border: 1px solid rgba(239,68,68,0.45);
        }

        .risk.high,
        .riskPill.high {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .risk.medium,
        .riskPill.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .risk.low,
        .riskPill.low {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .summaryBox,
        .sosBox {
          padding: 20px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 18px;
        }

        .summaryBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .summaryBox strong {
          display: block;
          font-size: 34px;
          font-weight: 900;
          text-transform: capitalize;
        }

        .mapBox {
          width: 100%;
          height: 340px;
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

        .sosBox {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .sosRow {
          display: block;
          padding: 13px;
          border-radius: 16px;
          color: white;
          text-decoration: none;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(239,68,68,0.25);
          margin-top: 10px;
        }

        .sosRow span {
          display: block;
          color: #fca5a5;
          margin-top: 5px;
          font-size: 13px;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .reviewButton,
        .completeButton,
        .cancelButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .reviewButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .completeButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .cancelButton {
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

          .tripRow {
            grid-template-columns: 46px 1fr;
          }

          .tripRow .risk {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .tripIcon {
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
