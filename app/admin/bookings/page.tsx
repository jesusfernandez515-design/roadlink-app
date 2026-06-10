"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type BookingStatus =
  | "pending"
  | "reserved"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rejected";

type BookingItem = {
  id: string;
  rideId?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  seatsBooked?: number;
  status?: BookingStatus;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [selected, setSelected] = useState<BookingItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("Loading bookings...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as BookingItem[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setBookings(data);
        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const filteredBookings = useMemo(() => {
    const value = search.toLowerCase().trim();

    return bookings.filter((booking) => {
      const matchesSearch =
        !value ||
        String(booking.driverEmail || "").toLowerCase().includes(value) ||
        String(booking.passengerEmail || "").toLowerCase().includes(value) ||
        String(booking.driverId || "").toLowerCase().includes(value) ||
        String(booking.passengerId || "").toLowerCase().includes(value) ||
        String(booking.from || "").toLowerCase().includes(value) ||
        String(booking.to || "").toLowerCase().includes(value) ||
        String(booking.rideId || "").toLowerCase().includes(value) ||
        String(booking.id || "").toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === "all" ||
        String(booking.status || "pending") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, search, statusFilter]);

  const pendingCount = bookings.filter((item) => item.status === "pending").length;
  const reservedCount = bookings.filter((item) => item.status === "reserved").length;
  const confirmedCount = bookings.filter((item) => item.status === "confirmed").length;
  const completedCount = bookings.filter((item) => item.status === "completed").length;
  const cancelledCount = bookings.filter((item) => item.status === "cancelled").length;

  const totalRevenue = useMemo(() => {
    return bookings
      .filter((item) => item.status === "completed")
      .reduce((total, item) => {
        return total + Number(item.price || 0) * Number(item.seatsBooked || 1);
      }, 0);
  }, [bookings]);

  async function updateBookingStatus(booking: BookingItem, status: BookingStatus) {
    try {
      setLoadingId(booking.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "bookings", booking.id),
        {
          status,
          updatedAt: now,
          completedAt: status === "completed" ? now : booking.updatedAt || now,
        },
        { merge: true }
      );

      if (booking.passengerId) {
        await setDoc(
          doc(db, "notifications", `${booking.passengerId}-booking-${Date.now()}`),
          {
            userId: booking.passengerId,
            type: "booking",
            title: "Booking Update",
            message: `Your booking from ${booking.from || "Origin"} to ${
              booking.to || "Destination"
            } was marked as ${status}.`,
            read: false,
            createdAt: now,
            actionUrl: "/my-bookings",
          },
          { merge: true }
        );
      }

      if (booking.driverId) {
        await setDoc(
          doc(db, "notifications", `${booking.driverId}-booking-${Date.now()}`),
          {
            userId: booking.driverId,
            type: "booking",
            title: "Booking Update",
            message: `A booking for your ride from ${booking.from || "Origin"} to ${
              booking.to || "Destination"
            } was marked as ${status}.`,
            read: false,
            createdAt: now,
            actionUrl: "/ride-passengers",
          },
          { merge: true }
        );
      }

      setMessage(`Booking marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function deleteBooking(booking: BookingItem) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this booking? This cannot be undone."
    );

    if (!confirmDelete) return;

    try {
      setLoadingId(booking.id);
      setMessage("");

      await deleteDoc(doc(db, "bookings", booking.id));

      setSelected(null);
      setMessage("Booking deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete booking.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status?: BookingStatus) {
    if (status === "reserved") return "Reserved";
    if (status === "confirmed") return "Confirmed";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "rejected") return "Rejected";
    return "Pending";
  }

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Bookings <span>Management</span></h1>
            <p className="subtitle">
              Monitor every reservation, review passenger and driver activity,
              update booking status, and manage completed trips.
            </p>
          </div>

          <div className="heroIcon">🎟️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🎟️" label="Total Bookings" value={String(bookings.length)} />
          <Metric icon="⏳" label="Pending" value={String(pendingCount)} />
          <Metric icon="📌" label="Reserved" value={String(reservedCount)} />
          <Metric icon="✅" label="Confirmed" value={String(confirmedCount)} />
          <Metric icon="🏁" label="Completed" value={String(completedCount)} />
          <Metric icon="⛔" label="Cancelled" value={String(cancelledCount)} />
          <Metric icon="💵" label="Completed $" value={`$${totalRevenue}`} />
          <Metric icon="📋" label="Filtered" value={String(filteredBookings.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by passenger, driver, route, booking ID..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="reserved">Reserved</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="bookingsCard">
            <p className="eyebrow">Bookings</p>
            <h2>Reservations</h2>

            {filteredBookings.length === 0 ? (
              <div className="empty">
                <h3>No bookings found</h3>
                <p>Try a different search or filter.</p>
              </div>
            ) : (
              <div className="bookingList">
                {filteredBookings.map((booking) => (
                  <button
                    key={booking.id}
                    className={
                      selected?.id === booking.id
                        ? "bookingRow activeBooking"
                        : "bookingRow"
                    }
                    onClick={() => setSelected(booking)}
                  >
                    <div className="bookingIcon">🎟️</div>

                    <div className="bookingInfo">
                      <strong>
                        {booking.from || "Origin"} → {booking.to || "Destination"}
                      </strong>
                      <span>{booking.passengerEmail || "Passenger"}</span>
                      <small>
                        {booking.date || "Date"} • {booking.time || "Time"} • $
                        {Number(booking.price || 0)}
                      </small>
                    </div>

                    <em className={`status ${booking.status || "pending"}`}>
                      {statusLabel(booking.status)}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Booking</p>
                    <h2>
                      {selected.from || "Origin"} → {selected.to || "Destination"}
                    </h2>
                    <p className="email">{selected.passengerEmail || "No passenger email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "pending"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="amountBox">
                  <span>Total Booking Value</span>
                  <strong>
                    $
                    {Number(selected.price || 0) *
                      Number(selected.seatsBooked || 1)}
                  </strong>
                </div>

                <div className="infoGrid">
                  <Info label="Booking ID" value={selected.id} />
                  <Info label="Ride ID" value={selected.rideId || "Not available"} />
                  <Info label="Driver ID" value={selected.driverId || "Not available"} />
                  <Info label="Driver Email" value={selected.driverEmail || "Not available"} />
                  <Info label="Passenger ID" value={selected.passengerId || "Not available"} />
                  <Info label="Passenger Email" value={selected.passengerEmail || "Not available"} />
                  <Info label="From" value={selected.from || "Not available"} />
                  <Info label="To" value={selected.to || "Not available"} />
                  <Info label="Date" value={selected.date || "Not available"} />
                  <Info label="Time" value={selected.time || "Not available"} />
                  <Info label="Price" value={`$${Number(selected.price || 0)}`} />
                  <Info label="Seats Booked" value={String(selected.seatsBooked || 1)} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                </div>

                <div className="actionRow">
                  <button
                    className="pendingButton"
                    onClick={() => updateBookingStatus(selected, "pending")}
                    disabled={loadingId === selected.id}
                  >
                    Pending
                  </button>

                  <button
                    className="reservedButton"
                    onClick={() => updateBookingStatus(selected, "reserved")}
                    disabled={loadingId === selected.id}
                  >
                    Reserved
                  </button>

                  <button
                    className="approveButton"
                    onClick={() => updateBookingStatus(selected, "confirmed")}
                    disabled={loadingId === selected.id}
                  >
                    Confirm
                  </button>

                  <button
                    className="completeButton"
                    onClick={() => updateBookingStatus(selected, "completed")}
                    disabled={loadingId === selected.id}
                  >
                    Complete
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() => updateBookingStatus(selected, "cancelled")}
                    disabled={loadingId === selected.id}
                  >
                    Cancel
                  </button>

                  <button
                    className="deleteButton"
                    onClick={() => deleteBooking(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a booking</h3>
                <p>Choose a booking to manage reservation details.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
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

        .hero,
        .metric,
        .filters,
        .bookingsCard,
        .detailsCard {
          background: rgba(8, 13, 25, 0.92);
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
        .amountBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 8px;
        }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 18px;
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
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        .filters input,
        .filters select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .filters option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .bookingsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .bookingList {
          display: grid;
          gap: 12px;
        }

        .bookingRow {
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

        .activeBooking {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .bookingIcon {
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

        .bookingInfo {
          min-width: 0;
        }

        .bookingInfo strong,
        .bookingInfo span,
        .bookingInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bookingInfo span,
        .bookingInfo small {
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

        .status.pending,
        .statusPill.pending {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.reserved,
        .statusPill.reserved {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .status.confirmed,
        .statusPill.confirmed {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.completed,
        .statusPill.completed {
          color: #c4b5fd;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.35);
        }

        .status.cancelled,
        .statusPill.cancelled,
        .status.rejected,
        .statusPill.rejected {
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

        .amountBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .amountBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .amountBox strong {
          font-size: 48px;
          font-weight: 900;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
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
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }

        .pendingButton,
        .reservedButton,
        .approveButton,
        .completeButton,
        .rejectButton,
        .deleteButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .pendingButton {
          background: linear-gradient(135deg, #facc15, #ca8a04);
        }

        .reservedButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .completeButton {
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        }

        .rejectButton {
          background: linear-gradient(135deg, #f97316, #c2410c);
        }

        .deleteButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }

          .actionRow {
            grid-template-columns: repeat(3, 1fr);
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
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .bookingsCard,
          .detailsCard {
            padding: 24px;
          }

          .bookingRow {
            grid-template-columns: 46px 1fr;
          }

          .bookingRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .bookingIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
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
      <strong>{value}</strong>
    </div>
  );
}
