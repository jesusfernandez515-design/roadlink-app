"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function RideDetailsPage() {
  const searchParams = useSearchParams();
  const rideId = searchParams.get("rideId");

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
      <section style={{ maxWidth: 700, margin: "0 auto", background: "#0b0b0b", padding: 28, borderRadius: 24 }}>
        <Link href="/find-ride" style={{ color: "white", textDecoration: "none" }}>← Back</Link>

        <h1>Ride Details</h1>
        <p>Detailed information about this ride.</p>

        <div style={{ marginTop: 24 }}>
          <p><strong>Ride ID:</strong> {rideId}</p>
          <p><strong>Status:</strong> Available</p>
          <p><strong>Safety:</strong> Driver and passenger information will appear here.</p>
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
            fontWeight: 900,
          }}
        >
          Back to Rides
        </Link>
      </section>
    </main>
  );
}
