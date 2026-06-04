"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type Ride = {
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  seats?: number;
  price?: number;
  vehicle?: string;
  notes?: string;
  driverEmail?: string;
  status?: string;
};

export default function RideDetailsPage() {
  const [ride, setRide] = useState<Ride | null>(null);
  const [message, setMessage] = useState("Loading ride details...");

  useEffect(() => {
    async function loadRide() {
      try {
        const params = new URLSearchParams(window.location.search);
        const rideId = params.get("rideId");

        if (!rideId) {
          setMessage("No ride selected.");
          return;
        }

        const rideRef = doc(db, "rides", rideId);
        const rideSnap = await getDoc(rideRef);

        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        setRide(rideSnap.data() as Ride);
        setMessage("");
      } catch (error: any) {
        setMessage(error.message);
      }
    }

    loadRide();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
      <section style={{ maxWidth: 700, margin: "0 auto", background: "#0b0b0b", padding: 28, borderRadius: 24 }}>
        <Link href="/find-ride" style={{ color: "white", textDecoration: "none" }}>
          ← Back
        </Link>

        <h1>Ride Details</h1>

        {message && <p>{message}</p>}

        {ride && (
          <div style={{ marginTop: 24 }}>
            <h2>
              {ride.from} → {ride.to}
            </h2>

            <p><strong>Date:</strong> {ride.date}</p>
            <p><strong>Time:</strong> {ride.time}</p>
            <p><strong>Price:</strong> ${ride.price}</p>
            <p><strong>Seats Available:</strong> {ride.seats}</p>
            <p><strong>Vehicle:</strong> {ride.vehicle}</p>
            <p><strong>Driver:</strong> {ride.driverEmail || "RoadLink Driver"}</p>
            <p><strong>Status:</strong> {ride.status || "active"}</p>

            {ride.notes && (
              <p><strong>Notes:</strong> {ride.notes}</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
