"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  seats?: number;
  status?: string;
  driverId?: string;
  driverEmail?: string;
  vehicle?: string;
  createdAt?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  status?: string;
  paymentStatus?: string;
  seatsBooked?: number;
  amount?: number;
  price?: number;
  createdAt?: string;
};

type Driver = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  online?: boolean;
  driverVerified?: boolean;
  verified?: boolean;
  vehicle?: string;
  city?: string;
  state?: string;
  lastSeen?: string;
};

export default function AdminDispatchCenterPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [message, setMessage] = useState("Loading dispatch center...");
  const [processingId, setProcessingId] = useState("");

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

    const unsubRides = listen<Ride>("rides", setRides);
    const unsubBookings = listen<Booking>("bookings", setBookings);
    const unsubUsers = listen<Driver>("users", setDrivers);

    return () => {
      unsubRides();
      unsubBookings();
      unsubUsers();
    };
  }, []);

  const data = useMemo(() => {
    const availableDrivers = drivers.filter(
      (item) =>
        item.online ||
        item.driverVerified ||
        item.verified ||
        item.role === "driver" ||
        item.role === "admin_driver"
    );

    const pendingRides = rides.filter(
      (item) => !item.status || item.status === "open" || item.status === "pending"
    );

    const activeRides = rides.filter((item) =>
      ["confirmed", "active", "started", "in_progress"].includes(item.status || "")
    );

    const completedRides = rides.filter((item) => item.status === "completed");

    const pendingBookings = bookings.filter(
      (item) => !item.status || item.status === "pending" || item.status === "reserved"
    );

    const paidBookings = bookings.filter(
      (item) => item.paymentStatus === "paid" || item.status === "paid"
    );

    const dispatchRevenue = bookings.reduce(
      (total, item) =>
        total +
        Number(item.amount || item.price || 0) *
          Number(item.seatsBooked || 1),
      0
    );

    const dispatchScore = Math.max(
      Math.min(
        availableDrivers.length * 8 +
          activeRides.length * 12 +
          paidBookings.length * 10 +
          pendingBookings.length * 4 -
          pendingRides.length * 2,
        100
      ),
      0
    );

    return {
      availableDrivers,
      pendingRides,
      activeRides,
      completedRides,
      pendingBookings,
      paidBookings,
      dispatchRevenue,
      dispatchScore,
    };
  }, [drivers, rides, bookings]);

  async function updateRideStatus(ride: Ride, status: string) {
    try {
      setProcessingId(ride.id);
      const now = new Date().toISOString();

      await updateDoc(doc(db, "rides", ride.id), {
        status,
        updatedAt: now,
      });

      await setDoc(
        doc(db, "auditLogs", `dispatch-ride-${ride.id}-${Date.now()}`),
        {
          action: "Dispatch Ride Status Updated",
          targetId: ride.id,
          targetType: "ride",
          details: `${ride.from || "Origin"} to ${ride.to || "Destination"} changed to ${status}`,
          severity: status === "completed" ? "success" : status === "cancelled" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Ride status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update ride.");
    } finally {
      setProcessingId("");
    }
  }

  async function updateBookingStatus(booking: Booking, status: string) {
    try {
      setProcessingId(booking.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "bookings", booking.id),
        {
          status,
          updatedAt: now,
        },
        { merge: true }
      );

      if (booking.passengerId || booking.passengerEmail) {
        await setDoc(
          doc(db, "notifications", `dispatch-booking-${booking.id}-${Date.now()}`),
          {
            userId: booking.passengerId || "",
            email: booking.passengerEmail || "",
            title: "Booking updated",
            message: `Your booking status is now ${status}.`,
            type: "dispatch",
            read: false,
            bookingId: booking.id,
            rideId: booking.rideId || "",
            createdAt: now,
          },
          { merge: true }
        );
      }

      await setDoc(
        doc(db, "auditLogs", `dispatch-booking-${booking.id}-${Date.now()}`),
        {
          action: "Dispatch Booking Status Updated",
          targetId: booking.id,
          targetType: "booking",
          details: `Booking changed to ${status}`,
          severity: status === "completed" ? "success" : status === "cancelled" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Booking status updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update booking.");
    } finally {
      setProcessingId("");
    }
  }

  async function assignDriver(ride: Ride, driver: Driver) {
    try {
      setProcessingId(`${ride.id}-${driver.id}`);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "rides", ride.id),
        {
          driverId: driver.id,
          driverEmail: driver.email || "",
          status: "confirmed",
          dispatchAssignedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      const relatedBookings = bookings.filter((item) => item.rideId === ride.id);

      await Promise.all(
        relatedBookings.map((booking) =>
          setDoc(
            doc(db, "bookings", booking.id),
            {
              driverId: driver.id,
              driverEmail: driver.email || "",
              status: booking.status === "paid" ? "paid" : "confirmed",
              updatedAt: now,
            },
            { merge: true }
          )
        )
      );

      await setDoc(
        doc(db, "notifications", `dispatch-driver-${ride.id}-${Date.now()}`),
        {
          userId: driver.id,
          email: driver.email || "",
          title: "New dispatch assignment",
          message: `You were assigned to ${ride.from || "Origin"} → ${ride.to || "Destination"}.`,
          type: "dispatch",
          read: false,
          rideId: ride.id,
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `dispatch-assign-${ride.id}-${Date.now()}`),
        {
          action: "Driver Assigned",
          targetId: ride.id,
          targetType: "ride",
          details: `${driver.email || "Driver"} assigned to ride ${ride.id}`,
          severity: "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Driver assigned successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not assign driver.");
    } finally {
      setProcessingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function bookingTotal(booking: Booking) {
    return Number(booking.amount || booking.price || 0) * Number(booking.seatsBooked || 1);
  }

  function statusLabel(status?: string) {
    if (status === "in_progress") return "In Progress";
    if (status === "payment_pending") return "Payment Pending";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "confirmed") return "Confirmed";
    if (status === "active") return "Active";
    if (status === "paid") return "Paid";
    return status || "Pending";
  }

  function statusClass(status?: string) {
    if (status === "completed" || status === "paid") return "good";
    if (status === "cancelled" || status === "rejected") return "bad";
    if (status === "confirmed" || status === "active" || status === "in_progress") return "active";
    return "pending";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/live-map" className="miniButton">Live Map</Link>
          <Link href="/admin/live-trips" className="miniButton">Live Trips</Link>
          <Link href="/admin/emergency" className="miniButton">Emergency</Link>
          <Link href="/admin/safety" className="miniButton">Safety</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Operations</p>
            <h1>Dispatch <span>Center</span></h1>
            <p className="subtitle">
              Assign drivers, manage active rides, control booking states, monitor dispatch revenue,
              coordinate operations and handle real-time ride movement.
            </p>
          </div>

          <div className={data.dispatchScore >= 60 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{data.dispatchScore}</strong>
            <span>Dispatch Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚗" label="Available Drivers" value={String(data.availableDrivers.length)} />
          <Metric icon="🟡" label="Pending Rides" value={String(data.pendingRides.length)} />
          <Metric icon="🛣️" label="Active Rides" value={String(data.activeRides.length)} />
          <Metric icon="🎟️" label="Pending Bookings" value={String(data.pendingBookings.length)} />
          <Metric icon="💳" label="Paid Bookings" value={String(data.paidBookings.length)} />
          <Metric icon="🏁" label="Completed Rides" value={String(data.completedRides.length)} />
          <Metric icon="💵" label="Dispatch Revenue" value={money(data.dispatchRevenue)} />
          <Metric icon="⚡" label="Mode" value="Realtime" />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Driver Supply</p>
            <h2>Available Drivers</h2>

            {data.availableDrivers.length === 0 ? (
              <div className="empty">
                <h3>No drivers available</h3>
                <p>Verified or online drivers will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {data.availableDrivers.slice(0, 8).map((driver) => (
                  <section key={driver.id} className="miniCard">
                    <div>
                      <strong>{driver.name || driver.email || "Driver"}</strong>
                      <span>{driver.vehicle || `${driver.city || "No city"} ${driver.state || ""}`}</span>
                    </div>
                    <span className={`pill ${driver.online ? "good" : "pending"}`}>
                      {driver.online ? "Online" : "Ready"}
                    </span>
                  </section>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Booking Queue</p>
            <h2>Pending Bookings</h2>

            {data.pendingBookings.length === 0 ? (
              <div className="empty">
                <h3>No pending bookings</h3>
                <p>New reservations will appear here for dispatch review.</p>
              </div>
            ) : (
              <div className="list">
                {data.pendingBookings.slice(0, 8).map((booking) => (
                  <section key={booking.id} className="miniCard">
                    <div>
                      <strong>{booking.from || "Origin"} → {booking.to || "Destination"}</strong>
                      <span>{booking.passengerEmail || "No passenger"} • {money(bookingTotal(booking))}</span>
                    </div>
                    <span className={`pill ${statusClass(booking.status)}`}>
                      {statusLabel(booking.status)}
                    </span>
                  </section>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Ride Dispatch</p>
          <h2>Ride Operations</h2>

          {rides.length === 0 ? (
            <div className="empty">
              <h3>No rides found</h3>
              <p>Published rides will appear here for dispatch control.</p>
            </div>
          ) : (
            <div className="rideGrid">
              {rides.map((ride) => (
                <section key={ride.id} className="rideCard">
                  <div className="cardTop">
                    <div>
                      <h3>{ride.from || "Origin"} → {ride.to || "Destination"}</h3>
                      <p>{ride.date || "No date"} • {ride.time || "No time"} • {ride.vehicle || "No vehicle"}</p>
                    </div>

                    <span className={`pill ${statusClass(ride.status)}`}>
                      {statusLabel(ride.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Driver" value={ride.driverEmail || "Not assigned"} />
                    <Info label="Seats" value={String(ride.seats || 0)} />
                    <Info label="Price" value={money(Number(ride.price || 0))} />
                    <Info label="Ride ID" value={ride.id} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateRideStatus(ride, "confirmed")} disabled={processingId === ride.id}>Confirm</button>
                    <button onClick={() => updateRideStatus(ride, "in_progress")} disabled={processingId === ride.id}>Start</button>
                    <button onClick={() => updateRideStatus(ride, "completed")} disabled={processingId === ride.id}>Complete</button>
                    <button className="dangerButton" onClick={() => updateRideStatus(ride, "cancelled")} disabled={processingId === ride.id}>Cancel</button>
                  </div>

                  <div className="assignBox">
                    <p className="assignTitle">Assign Driver</p>
                    <div className="assignList">
                      {data.availableDrivers.slice(0, 4).map((driver) => (
                        <button
                          key={driver.id}
                          onClick={() => assignDriver(ride, driver)}
                          disabled={processingId === `${ride.id}-${driver.id}`}
                          className="assignButton"
                        >
                          {driver.email || driver.name || "Driver"}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Booking Control</p>
          <h2>Reservation Operations</h2>

          {bookings.length === 0 ? (
            <div className="empty">
              <h3>No bookings found</h3>
              <p>Passenger reservations will appear here.</p>
            </div>
          ) : (
            <div className="rideGrid">
              {bookings.map((booking) => (
                <section key={booking.id} className="rideCard">
                  <div className="cardTop">
                    <div>
                      <h3>{booking.from || "Origin"} → {booking.to || "Destination"}</h3>
                      <p>{booking.passengerEmail || "No passenger"} • {money(bookingTotal(booking))}</p>
                    </div>

                    <span className={`pill ${statusClass(booking.status)}`}>
                      {statusLabel(booking.status)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Driver" value={booking.driverEmail || "Not assigned"} />
                    <Info label="Payment" value={booking.paymentStatus || "Not paid"} />
                    <Info label="Seats" value={String(booking.seatsBooked || 1)} />
                    <Info label="Booking ID" value={booking.id} />
                  </div>

                  <div className="actions">
                    <button onClick={() => updateBookingStatus(booking, "confirmed")} disabled={processingId === booking.id}>Confirm</button>
                    <button onClick={() => updateBookingStatus(booking, "paid")} disabled={processingId === booking.id}>Paid</button>
                    <button onClick={() => updateBookingStatus(booking, "completed")} disabled={processingId === booking.id}>Complete</button>
                    <button className="dangerButton" onClick={() => updateBookingStatus(booking, "cancelled")} disabled={processingId === booking.id}>Cancel</button>
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

        .miniButton {
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
        .panel,
        .miniCard,
        .rideCard {
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
        .rideCard p,
        .miniCard span {
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

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        .panel {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .miniCard {
          border-radius: 18px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          box-shadow: none;
        }

        .miniCard strong,
        .miniCard span {
          display: block;
          overflow-wrap: anywhere;
        }

        .rideGrid {
          display: grid;
          gap: 16px;
        }

        .rideCard {
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

        .rideCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .rideCard p {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.active {
          color: #60a5fa;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .pill.pending {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .pill.bad {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
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

        .actions,
        .assignList {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .actions button,
        .assignButton {
          padding: 12px 16px;
          border-radius: 999px;
          border: none;
          font-weight: 900;
          color: white;
          cursor: pointer;
          background: rgba(59,130,246,0.14);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .actions .dangerButton {
          background: rgba(239,68,68,0.14);
          border-color: rgba(239,68,68,0.35);
          color: #fca5a5;
        }

        .assignBox {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .assignTitle {
          color: #22c55e !important;
          font-weight: 900;
          margin-bottom: 10px !important;
        }

        .assignButton {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
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
          .infoGrid,
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 780px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
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
          .infoGrid,
          .grid {
            grid-template-columns: 1fr;
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}
