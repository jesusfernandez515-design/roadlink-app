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
  date?: string;
  time?: string;
  seats?: number;
  price?: number;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  rideId?: string;
  status?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
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

type DispatchRide = {
  id: string;
  ride: RideItem;
  bookings: BookingItem[];
  driver?: UserItem;
  driverLocation?: LiveLocation;
  sosAlerts: EmergencyAlert[];
  passengers: number;
  dispatchStatus: "ready" | "needs_driver" | "in_progress" | "sos" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  reason: string;
};

export default function AdminDispatchPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selected, setSelected] = useState<DispatchRide | null>(null);
  const [filter, setFilter] = useState<"all" | "ready" | "needs_driver" | "in_progress" | "sos">("all");
  const [message, setMessage] = useState("Loading dispatch center...");
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
    const unsubBookings = listen("bookings", setBookings);
    const unsubLocations = listen("liveLocations", setLocations);
    const unsubAlerts = listen("emergencyAlerts", setAlerts);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubLocations();
      unsubAlerts();
    };
  }, []);

  const dispatch = useMemo(() => {
    const onlineDrivers = users.filter((user) => {
      if (!user.driverVerified || user.suspended) return false;
      if (user.online) return true;
      if (!user.lastSeen) return false;

      const lastSeen = new Date(user.lastSeen).getTime();
      if (Number.isNaN(lastSeen)) return false;

      return Date.now() - lastSeen <= 15 * 60 * 1000;
    });

    const driverLocations = locations.filter((item) => item.type === "driver");
    const passengerLocations = locations.filter((item) => item.type === "passenger");

    const dispatchRides: DispatchRide[] = rides
      .map((ride) => {
        const rideBookings = bookings.filter((booking) => booking.rideId === ride.id);

        const activeBookings = rideBookings.filter(
          (booking) =>
            booking.status === "pending" ||
            booking.status === "reserved" ||
            booking.status === "confirmed" ||
            booking.status === "in_progress"
        );

        const driver = users.find(
          (user) => user.id === ride.driverId || user.email === ride.driverEmail
        );

        const driverLocation = driverLocations.find(
          (item) =>
            item.rideId === ride.id ||
            item.userId === ride.driverId ||
            item.userEmail === ride.driverEmail
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
          (total, item) => total + Number(item.seatsBooked || 1),
          0
        );

        let dispatchStatus: DispatchRide["dispatchStatus"] = "ready";
        let priority: DispatchRide["priority"] = "low";
        const reasons: string[] = [];

        if (sosAlerts.length > 0) {
          dispatchStatus = "sos";
          priority = "critical";
          reasons.push(`${sosAlerts.length} active SOS alert(s)`);
        } else if (ride.status === "completed") {
          dispatchStatus = "completed";
          priority = "low";
          reasons.push("trip completed");
        } else if (ride.status === "cancelled") {
          dispatchStatus = "cancelled";
          priority = "medium";
          reasons.push("trip cancelled");
        } else if (ride.status === "in_progress") {
          dispatchStatus = "in_progress";
          priority = driverLocation ? "low" : "high";
          reasons.push(driverLocation ? "trip in progress" : "driver GPS missing");
        } else if (!ride.driverId && !ride.driverEmail) {
          dispatchStatus = "needs_driver";
          priority = "high";
          reasons.push("ride has no assigned driver");
        } else if (!driver?.driverVerified) {
          dispatchStatus = "needs_driver";
          priority = "high";
          reasons.push("assigned driver is not verified");
        } else {
          reasons.push("ready for dispatch");
        }

        return {
          id: ride.id,
          ride,
          bookings: activeBookings,
          driver,
          driverLocation,
          sosAlerts,
          passengers,
          dispatchStatus,
          priority,
          reason: reasons.join(", "),
        };
      })
      .filter((item) => {
        return (
          item.ride.status === "active" ||
          item.ride.status === "open" ||
          item.ride.status === "in_progress" ||
          item.ride.status === "completed" ||
          item.dispatchStatus === "sos" ||
          item.bookings.length > 0
        );
      })
      .sort((a, b) => {
        const order = { critical: 4, high: 3, medium: 2, low: 1 };
        return order[b.priority] - order[a.priority];
      });

    return {
      onlineDrivers,
      driverLocations,
      passengerLocations,
      dispatchRides,
      availableDrivers: onlineDrivers.filter(
        (driver) =>
          !dispatchRides.some(
            (ride) =>
              ride.dispatchStatus === "in_progress" &&
              (ride.ride.driverId === driver.id || ride.ride.driverEmail === driver.email)
          )
      ),
    };
  }, [users, rides, bookings, locations, alerts]);

  const filteredRides = useMemo(() => {
    if (filter === "all") return dispatch.dispatchRides;
    return dispatch.dispatchRides.filter((item) => item.dispatchStatus === filter);
  }, [dispatch.dispatchRides, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredRides.length === 0) return null;
      if (!current) return filteredRides[0];
      return filteredRides.find((item) => item.id === current.id) || filteredRides[0];
    });
  }, [filteredRides]);

  const needsDriver = dispatch.dispatchRides.filter((item) => item.dispatchStatus === "needs_driver");
  const inProgress = dispatch.dispatchRides.filter((item) => item.dispatchStatus === "in_progress");
  const sosRides = dispatch.dispatchRides.filter((item) => item.dispatchStatus === "sos");
  const highPriority = dispatch.dispatchRides.filter(
    (item) => item.priority === "high" || item.priority === "critical"
  );

  const dispatchScore = Math.max(
    100 - sosRides.length * 25 - needsDriver.length * 12 - highPriority.length * 8,
    0
  );

  async function updateRideStatus(item: DispatchRide, status: string) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "rides", item.id),
        {
          status,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `dispatch-${item.id}-${Date.now()}`),
        {
          userId: item.ride.driverId || "",
          userEmail: item.ride.driverEmail || "",
          action: `Dispatch updated ride to ${status}`,
          targetId: item.id,
          targetType: "ride",
          details: item.reason,
          severity: status === "cancelled" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Dispatch action completed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update dispatch.");
    } finally {
      setLoadingId("");
    }
  }

  async function assignDriver(item: DispatchRide, driver: UserItem) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "rides", item.id),
        {
          driverId: driver.id,
          driverEmail: driver.email || "",
          status: item.ride.status || "active",
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `dispatch-assign-${item.id}-${Date.now()}`),
        {
          userId: driver.id,
          userEmail: driver.email || "",
          action: "Driver Assigned From Dispatch Center",
          targetId: item.id,
          targetType: "ride",
          details: `${driver.email || driver.id} assigned to ride ${item.id}`,
          severity: "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Driver assigned successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not assign driver.");
    } finally {
      setLoadingId("");
    }
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

  function statusLabel(value: string) {
    if (value === "needs_driver") return "Needs Driver";
    if (value === "in_progress") return "In Progress";
    if (value === "sos") return "SOS";
    if (value === "completed") return "Completed";
    if (value === "cancelled") return "Cancelled";
    return "Ready";
  }

  function mapUrl(item: DispatchRide) {
    const location = item.driverLocation;

    if (!location?.latitude || !location?.longitude) return "";

    return `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=13&output=embed`;
  }

  function openMapUrl(item: DispatchRide) {
    const location = item.driverLocation;

    if (!location?.latitude || !location?.longitude) return "";

    return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/map-center" className="miniButton">Map</Link>
          <Link href="/admin/live-trips" className="miniButton">Live Trips</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Operations</p>
            <h1>Dispatch <span>Center</span></h1>
            <p className="subtitle">
              Assign drivers, monitor live trips, identify rides without drivers, track GPS and respond to SOS incidents.
            </p>
          </div>

          <div className={dispatchScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{dispatchScore}</strong>
            <span>Dispatch Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚘" label="Online Drivers" value={String(dispatch.onlineDrivers.length)} />
          <Metric icon="✅" label="Available" value={String(dispatch.availableDrivers.length)} />
          <Metric icon="🛣️" label="Trips" value={String(dispatch.dispatchRides.length)} />
          <Metric icon="⚡" label="In Progress" value={String(inProgress.length)} />
          <Metric icon="⚠️" label="Needs Driver" value={String(needsDriver.length)} danger={needsDriver.length > 0} />
          <Metric icon="🚨" label="SOS Trips" value={String(sosRides.length)} danger={sosRides.length > 0} />
        </section>

        <section className="filters">
          {(["all", "ready", "needs_driver", "in_progress", "sos"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={filter === item ? "activeFilter" : ""}
            >
              {item === "all" ? "All" : statusLabel(item)}
            </button>
          ))}
        </section>

        <section className="adminGrid">
          <section className="queueCard">
            <p className="eyebrow">Dispatch Queue</p>
            <h2>Ride Operations</h2>

            {filteredRides.length === 0 ? (
              <div className="empty">
                <h3>No dispatch items</h3>
                <p>No rides match this filter.</p>
              </div>
            ) : (
              <div className="dispatchList">
                {filteredRides.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "dispatchRow activeDispatch" : "dispatchRow"}
                  >
                    <div className={`dispatchIcon ${item.priority}`}>
                      {item.dispatchStatus === "sos"
                        ? "🚨"
                        : item.dispatchStatus === "needs_driver"
                        ? "⚠️"
                        : "🛣️"}
                    </div>

                    <div className="dispatchInfo">
                      <strong>{shortText(`${item.ride.from || "Origin"} → ${item.ride.to || "Destination"}`)}</strong>
                      <span>{shortText(item.ride.driverEmail || "No driver assigned")}</span>
                      <small>{item.passengers} passenger(s) • {item.reason}</small>
                    </div>

                    <em className={`status ${item.priority}`}>
                      {statusLabel(item.dispatchStatus)}
                    </em>
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
                    <p className="eyebrow">Selected Dispatch</p>
                    <h2>{shortText(`${selected.ride.from || "Origin"} → ${selected.ride.to || "Destination"}`, 54)}</h2>
                    <p className="email">{selected.ride.driverEmail || "No driver assigned"}</p>
                  </div>

                  <span className={`statusPill ${selected.priority}`}>
                    {statusLabel(selected.dispatchStatus)}
                  </span>
                </div>

                <div className="summaryBox">
                  <span>Dispatch Summary</span>
                  <strong>{selected.reason}</strong>
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
                    <h3>No driver GPS</h3>
                    <p>No live driver location available for this ride.</p>
                  </div>
                )}

                {openMapUrl(selected) && (
                  <a href={openMapUrl(selected)} target="_blank" rel="noreferrer" className="mapButton">
                    Open Driver Location
                  </a>
                )}

                <div className="infoGrid">
                  <Info label="Ride ID" value={selected.id} />
                  <Info label="Ride Status" value={selected.ride.status || "open"} />
                  <Info label="Driver Email" value={selected.ride.driverEmail || "Not assigned"} />
                  <Info label="Passengers" value={String(selected.passengers)} />
                  <Info label="Bookings" value={String(selected.bookings.length)} />
                  <Info label="SOS Alerts" value={String(selected.sosAlerts.length)} />
                  <Info label="Driver GPS" value={selected.driverLocation ? "Available" : "Missing"} />
                  <Info label="Created" value={timeAgo(selected.ride.createdAt)} />
                </div>

                <section className="assignBox">
                  <p className="eyebrow">Assign Driver</p>
                  <h2>Available Drivers</h2>

                  {dispatch.availableDrivers.length === 0 ? (
                    <div className="empty">
                      <h3>No available drivers</h3>
                      <p>No online verified drivers are available right now.</p>
                    </div>
                  ) : (
                    <div className="driverList">
                      {dispatch.availableDrivers.slice(0, 8).map((driver) => (
                        <button
                          key={driver.id}
                          onClick={() => assignDriver(selected, driver)}
                          disabled={loadingId === selected.id}
                          className="driverRow"
                        >
                          <strong>{shortText(driver.name || driver.email || "Driver")}</strong>
                          <span>{driver.email || driver.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {selected.sosAlerts.length > 0 && (
                  <section className="sosBox">
                    <p className="eyebrow">Emergency</p>
                    <h2>Active SOS</h2>

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
                    className="progressButton"
                    onClick={() => updateRideStatus(selected, "in_progress")}
                    disabled={loadingId === selected.id}
                  >
                    Start Trip
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
                <h3>Select a ride</h3>
                <p>Choose a ride to dispatch or monitor.</p>
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
        .summaryBox strong {
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

        .dispatchList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .dispatchRow {
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

        .activeDispatch {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .dispatchIcon {
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

        .dispatchIcon.high,
        .dispatchIcon.critical {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .dispatchIcon.medium {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .dispatchInfo { min-width: 0; }

        .dispatchInfo strong,
        .dispatchInfo span,
        .dispatchInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dispatchInfo span,
        .dispatchInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .status.critical,
        .statusPill.critical {
          color: #fecaca;
          background: rgba(185,28,28,0.25);
          border: 1px solid rgba(239,68,68,0.45);
        }

        .status.high,
        .statusPill.high {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .status.medium,
        .statusPill.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.low,
        .statusPill.low {
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
        .assignBox,
        .sosBox {
          padding: 20px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 18px;
        }

        .summaryBox span {
          display: block;
          color: #22c55e;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .summaryBox strong {
          display: block;
          font-size: 18px;
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

        .driverList {
          display: grid;
          gap: 9px;
        }

        .driverRow {
          width: 100%;
          padding: 13px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: white;
          text-align: left;
          cursor: pointer;
        }

        .driverRow strong,
        .driverRow span {
          display: block;
          overflow-wrap: anywhere;
        }

        .driverRow span {
          color: #a1a1aa;
          margin-top: 4px;
          font-size: 12px;
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

        .progressButton,
        .completeButton,
        .cancelButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .progressButton {
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

          .dispatchRow {
            grid-template-columns: 46px 1fr;
          }

          .dispatchRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .dispatchIcon {
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
