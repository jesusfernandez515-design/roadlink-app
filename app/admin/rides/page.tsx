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

type RideStatus = "active" | "full" | "completed" | "cancelled" | "draft";

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  seats?: number;
  seatsAvailable?: number;
  status?: RideStatus;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminRidesPage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [selected, setSelected] = useState<RideItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("Loading rides...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as RideItem[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setRides(data);
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

  const filteredRides = useMemo(() => {
    const value = search.toLowerCase().trim();

    return rides.filter((ride) => {
      const matchesSearch =
        !value ||
        String(ride.driverEmail || "").toLowerCase().includes(value) ||
        String(ride.driverId || "").toLowerCase().includes(value) ||
        String(ride.from || "").toLowerCase().includes(value) ||
        String(ride.to || "").toLowerCase().includes(value) ||
        String(ride.id || "").toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === "all" || String(ride.status || "active") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rides, search, statusFilter]);

  const activeCount = rides.filter((ride) => ride.status === "active").length;
  const fullCount = rides.filter((ride) => ride.status === "full").length;
  const completedCount = rides.filter((ride) => ride.status === "completed").length;
  const cancelledCount = rides.filter((ride) => ride.status === "cancelled").length;

  async function updateRideStatus(ride: RideItem, status: RideStatus) {
    try {
      setLoadingId(ride.id);
      setMessage("");

      await setDoc(
        doc(db, "rides", ride.id),
        {
          status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage(`Ride marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function deleteRide(ride: RideItem) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this ride? This cannot be undone."
    );

    if (!confirmDelete) return;

    try {
      setLoadingId(ride.id);
      setMessage("");

      await deleteDoc(doc(db, "rides", ride.id));

      setSelected(null);
      setMessage("Ride deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete ride.");
    } finally {
      setLoadingId("");
    }
  }

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function statusLabel(status?: RideStatus) {
    if (status === "full") return "Full";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "draft") return "Draft";
    return "Active";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/bookings" className="miniButton">Bookings</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Rides <span>Management</span></h1>
            <p className="subtitle">
              Monitor all published rides, review driver routes, update ride status,
              and remove suspicious or fraudulent trips.
            </p>
          </div>

          <div className="heroIcon">🚘</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚘" label="Total Rides" value={String(rides.length)} />
          <Metric icon="🟢" label="Active" value={String(activeCount)} />
          <Metric icon="🧍" label="Full" value={String(fullCount)} />
          <Metric icon="✅" label="Completed" value={String(completedCount)} />
          <Metric icon="⛔" label="Cancelled" value={String(cancelledCount)} />
          <Metric icon="📋" label="Filtered" value={String(filteredRides.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by driver, route, ride ID..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="full">Full</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="ridesCard">
            <p className="eyebrow">Rides</p>
            <h2>Published Trips</h2>

            {filteredRides.length === 0 ? (
              <div className="empty">
                <h3>No rides found</h3>
                <p>Try a different search or filter.</p>
              </div>
            ) : (
              <div className="rideList">
                {filteredRides.map((ride) => (
                  <button
                    key={ride.id}
                    className={selected?.id === ride.id ? "rideRow activeRide" : "rideRow"}
                    onClick={() => setSelected(ride)}
                  >
                    <div className="routeIcon">🚘</div>

                    <div className="rideInfo">
                      <strong>
                        {ride.from || "Origin"} → {ride.to || "Destination"}
                      </strong>
                      <span>{ride.driverEmail || ride.driverId || "RoadLink Driver"}</span>
                      <small>
                        {ride.date || "Date"} • {ride.time || "Time"} • ${Number(ride.price || 0)}
                      </small>
                    </div>

                    <em className={`status ${ride.status || "active"}`}>
                      {statusLabel(ride.status)}
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
                    <p className="eyebrow">Selected Ride</p>
                    <h2>
                      {selected.from || "Origin"} → {selected.to || "Destination"}
                    </h2>
                    <p className="email">{selected.driverEmail || "No driver email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "active"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="amountBox">
                  <span>Trip Price</span>
                  <strong>${Number(selected.price || 0)}</strong>
                </div>

                <div className="infoGrid">
                  <Info label="Ride ID" value={selected.id} />
                  <Info label="Driver ID" value={selected.driverId || "Not available"} />
                  <Info label="Driver Email" value={selected.driverEmail || "Not available"} />
                  <Info label="From" value={selected.from || "Not available"} />
                  <Info label="To" value={selected.to || "Not available"} />
                  <Info label="Date" value={selected.date || "Not available"} />
                  <Info label="Time" value={selected.time || "Not available"} />
                  <Info label="Seats" value={String(selected.seats ?? "Not available")} />
                  <Info label="Seats Available" value={String(selected.seatsAvailable ?? selected.seats ?? "Not available")} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                </div>

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() => updateRideStatus(selected, "active")}
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Mark Active"}
                  </button>

                  <button
                    className="paidButton"
                    onClick={() => updateRideStatus(selected, "full")}
                    disabled={loadingId === selected.id}
                  >
                    Mark Full
                  </button>

                  <button
                    className="completeButton"
                    onClick={() => updateRideStatus(selected, "completed")}
                    disabled={loadingId === selected.id}
                  >
                    Complete
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() => updateRideStatus(selected, "cancelled")}
                    disabled={loadingId === selected.id}
                  >
                    Cancel
                  </button>

                  <button
                    className="deleteButton"
                    onClick={() => deleteRide(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a ride</h3>
                <p>Choose a ride to manage trip details.</p>
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
        .ridesCard,
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
          grid-template-columns: repeat(6, 1fr);
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

        .ridesCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .rideList {
          display: grid;
          gap: 12px;
        }

        .rideRow {
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

        .activeRide {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .routeIcon {
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

        .rideInfo {
          min-width: 0;
        }

        .rideInfo strong,
        .rideInfo span,
        .rideInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rideInfo span,
        .rideInfo small {
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

        .status.active,
        .statusPill.active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.full,
        .statusPill.full {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .status.completed,
        .statusPill.completed {
          color: #c4b5fd;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.35);
        }

        .status.cancelled,
        .statusPill.cancelled {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .status.draft,
        .statusPill.draft {
          color: #a1a1aa;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
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
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .approveButton,
        .paidButton,
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

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .paidButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
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
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .ridesCard,
          .detailsCard {
            padding: 24px;
          }

          .rideRow {
            grid-template-columns: 46px 1fr;
          }

          .rideRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .routeIcon {
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
