"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  price: number;
  vehicle: string;
  notes?: string;
  status: string;
  driverId?: string;
  driverEmail?: string;
};

export default function MyRidesPage() {
  const router = useRouter();

  const [rides, setRides] = useState<Ride[]>([]);
  const [message, setMessage] = useState("Loading your rides...");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  async function loadMyRides(userId?: string) {
    setMessage("Loading your rides...");

    const user = auth.currentUser;
    const driverId = userId || user?.uid;

    if (!driverId) {
      setMessage("Please sign in to view your rides.");
      return;
    }

    try {
      const q = query(
        collection(db, "rides"),
        where("driverId", "==", driverId)
      );

      const snapshot = await getDocs(q);

      const ridesData = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Ride[];

      setRides(ridesData);
      setMessage(
        ridesData.length ? "" : "You have not published any rides yet."
      );
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function deleteRide(rideId: string) {
    const confirmDelete = confirm("Are you sure you want to delete this ride?");

    if (!confirmDelete) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, "rides", rideId));
      setMessage("Ride deleted successfully.");
      await loadMyRides(currentUser?.uid);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setMessage("Please sign in to view your rides.");
        router.push("/login");
        return;
      }

      setCurrentUser(user);
      await loadMyRides(user.uid);
    });

    return () => unsubscribe();
  }, [router]);

  const totalPotential = rides.reduce(
    (total, ride) => total + Number(ride.price || 0) * Number(ride.seats || 0),
    0
  );

  const activeRides = rides.filter((ride) => ride.status === "active").length;
  const totalSeats = rides.reduce(
    (total, ride) => total + Number(ride.seats || 0),
    0
  );

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/find-ride" className="miniButton">
            Find Ride
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>
          My <span>Rides</span>
        </h1>

        <p className="subtitle">
          Manage your published routes, monitor availability, and control your driver activity.
        </p>

        <div className="mainActions">
          <Link href="/offer-ride" className="primaryButton">
            Offer New Ride
          </Link>

          <button
            className="secondaryTopButton"
            onClick={() => loadMyRides(currentUser?.uid)}
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="stats">
        <Metric icon="🚘" label="Total Rides" value={String(rides.length)} />
        <Metric icon="🟢" label="Active Rides" value={String(activeRides)} />
        <Metric icon="💺" label="Open Seats" value={String(totalSeats)} />
        <Metric icon="💵" label="Potential" value={`$${totalPotential}`} />
      </section>

      <section className="results">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => (
          <div key={ride.id} className="rideCard">
            <div className="routeHeader">
              <div>
                <p className="eyebrow">Published Ride</p>
                <h2>
                  {ride.from} <span>→</span> {ride.to}
                </h2>
              </div>

              <div className="priceBox">
                <small>PRICE</small>
                <strong>${ride.price}</strong>
              </div>
            </div>

            <div className="chips">
              <div className="chip">📅 {ride.date}</div>
              <div className="chip">🕒 {ride.time}</div>
              <div className="chip">💺 {ride.seats} seats</div>
              <div className="chip active">● {ride.status}</div>
            </div>

            <div className="infoGrid">
              <Info icon="🚘" label="Vehicle" value={ride.vehicle} />
              <Info
                icon="👤"
                label="Driver"
                value={ride.driverEmail || currentUser?.email || "RoadLink Driver"}
              />
              {ride.notes && <Info icon="📝" label="Notes" value={ride.notes} />}
            </div>

            <div className="cardButtons">
              <Link
                href={`/ride-details?rideId=${ride.id}`}
                className="outlineButton"
              >
                View Details
              </Link>

              <Link
                href={`/ride-passengers?rideId=${ride.id}`}
                className="outlineButton"
              >
                View Passengers
              </Link>

              <Link
                href={`/edit-ride?rideId=${ride.id}`}
                className="outlineButton"
              >
                Edit Ride
              </Link>

              <button
                className="deleteButton"
                onClick={() => deleteRide(ride.id)}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete Ride"}
              </button>
            </div>
          </div>
        ))}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .results {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .rideCard,
        .metric {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 22px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 30px;
        }

        .miniButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
        }

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h2 span,
        .active,
        .eyebrow,
        .priceBox strong,
        .metricValue {
          color: #22c55e;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .mainActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 30px;
        }

        .primaryButton,
        .secondaryTopButton {
          width: 100%;
          padding: 18px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        .primaryButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          border: none;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .secondaryTopButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 20px;
        }

        .metricIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 26px;
          font-weight: 900;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 26px 0;
        }

        .rideCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .routeHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0;
        }

        .priceBox {
          min-width: 110px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          text-align: center;
        }

        .priceBox small {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .priceBox strong {
          font-size: 32px;
          font-weight: 900;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .infoGrid {
          display: grid;
          gap: 10px;
        }

        .infoRow {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .infoIcon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
        }

        .infoText strong {
          display: block;
          color: #e5e7eb;
          margin-bottom: 4px;
        }

        .infoText span {
          color: #a1a1aa;
          overflow-wrap: anywhere;
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 24px;
        }

        .outlineButton,
        .deleteButton {
          display: block;
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .deleteButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          border: none;
        }

        .deleteButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero,
          .rideCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 50px;
          }

          h2 {
            font-size: 32px;
          }

          .stats,
          .routeHeader,
          .cardButtons,
          .mainActions {
            grid-template-columns: 1fr;
          }

          .priceBox {
            text-align: left;
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

function Info({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="infoRow">
      <div className="infoIcon">{icon}</div>
      <div className="infoText">
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}
