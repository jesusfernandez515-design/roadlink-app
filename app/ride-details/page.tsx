"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function RideDetailsContent() {
  const searchParams = useSearchParams();
  const rideId = searchParams.get("rideId");

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
      <section style={{ maxWidth: 700, margin: "0 auto", background: "#0b0b0b", padding: 28, borderRadius: 24 }}>
        <Link href="/find-ride" style={{ color: "white", textDecoration: "none" }}>
          ← Back
        </Link>

        <h1>Ride Details</h1>
        <p>Ride ID: {rideId || "No ride selected"}</p>

        <div style={{ marginTop: 20 }}>
          <p><strong>Status:</strong> Available</p>
          <p><strong>Price:</strong> $25</p>
          <p><strong>Seats:</strong> 1</p>
        </div>

        <Link
          href="/find-ride"
          style={{
            display: "block",
            marginTop: 24,
            background: "#22c55e",
            color: "white",
            padding: 16,
            borderRadius: 999,
            textAlign: "center",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Back to Rides
        </Link>
      </section>
    </main>
  );
}

export default function RideDetailsPage() {
  return (
    <Suspense fallback={<main style={{ color: "white", background: "#020617", minHeight: "100vh", padding: 24 }}>Loading...</main>}>
      <RideDetailsContent />
    </Suspense>
  );
}
