"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  async function loadMyRides() {
    setMessage("Loading your rides...");

    const user = auth.currentUser;

    if (!user) {
      setMessage("Please sign in to view your rides.");
      router.push("/login");
      return;
    }

    try {
      const q = query(
        collection(db, "rides"),
        where("driverId", "==", user.uid)
      );

      const snapshot = await getDocs(q);

      const ridesData = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Ride[];

      setRides(ridesData);
      setMessage(ridesData.length ? "" : "You have not published any rides yet.");
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
      await loadMyRides();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyRides();
  }, []);

  return (
    <main className="page">
      <section className="headerCard">
        <div className="topActions">
          <button className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/" className="miniButton">
            Home
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>My Rides</h1>
        <p>Manage the rides you have published as a driver.</p>

        <div className="mainActions">
          <Link href="/offer-ride" className="actionButton">
            Offer New Ride
          </Link>

          <button className="actionButton dark" onClick={loadMyRides}>
            Refresh
          </button>
        </div>
      </section>

      <section className="results">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => (
          <div key={ride.id} className="rideCard">
            <div className="topRow">
              <div>
                <h3>
                  {ride.from} → {ride.to}
                </h3>
                <p>
                  {ride.date} • {ride.time}
                </p>
              </div>

              <div className="price">${ride.price}</div>
            </div>

            <div className="details">
              <p>
                <strong>Status:</strong> {ride.status}
              </p>

              <p>
                <strong>Seats:</strong> {ride.seats}
              </p>

              <p>
                <strong>Vehicle:</strong> {ride.vehicle}
              </p>

              {ride.notes && (
                <p>
                  <strong>Notes:</strong> {ride.notes}
                </p>
              )}
            </div>

            <div className="cardButtons">
              <Link
                href={`/ride-details?rideId=${ride.id}`}
                className="secondaryButton"
              >
                View Details
              </Link>

              <Link
                href={`/ride-passengers?rideId=${ride.id}`}
                className="secondaryButton"
              >
                View Passengers
              </Link>

              <Link
                href={`/edit-ride?rideId=${ride.id}`}
                className="secondaryButton"
              >
                Edit Ride
              </Link>

              <button
                className="deleteButton"
                onClick={() => deleteRide(ride.id)}
                disabled={loading}
              >
                Delete Ride
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
          background: linear-gradient(135deg, #000, #0f172a, #111827);
          color: white;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .headerCard {
          max-width: 760px;
          margin: 0 auto 30px;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.45);
        }

        .topActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .miniButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid #333;
          background: #111;
          color: white;
          text-decoration: none;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
        }

        .logo {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 24px;
        }

        .logo span {
          color: #22c55e;
        }

        h1 {
          font-size: 42px;
          margin: 0 0 10px;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .mainActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 24px;
        }

        .actionButton {
          display: block;
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: #22c55e;
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .actionButton.dark {
          background: #111;
          border: 1px solid #333;
        }

        .results {
          max-width: 760px;
          margin: 0 auto;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 800;
          margin: 24px 0;
        }

        .rideCard {
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 18px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        }

        .topRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        h3 {
          margin: 0;
          font-size: 26px;
          line-height: 1.25;
        }

        .price {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
          white-space: nowrap;
        }

        .details {
          margin-top: 20px;
        }

        .details p {
          margin: 12px 0;
          font-size: 17px;
        }

        .details strong {
          color: #d4d4d8;
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 22px;
        }

        .secondaryButton,
        .deleteButton {
          display: block;
          width: 100%;
          padding: 14px;
          border-radius: 999px;
          border: 1px solid #333;
          background: #111;
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .deleteButton {
          background: #7f1d1d;
          border-color: #991b1b;
        }

        .deleteButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 480px) {
          .page {
            padding: 12px;
          }

          .headerCard,
          .rideCard {
            border-radius: 24px;
            padding: 22px;
          }

          h1 {
            font-size: 38px;
          }

          h3 {
            font-size: 24px;
          }

          .topRow {
            flex-direction: column;
          }

          .mainActions,
          .cardButtons {
            grid-template-columns: 1fr;
          }

          .price {
            font-size: 30px;
          }
        }
      `}</style>
    </main>
  );
}
