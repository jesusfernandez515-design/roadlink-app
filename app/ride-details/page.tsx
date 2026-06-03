"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function DriverProfileContent() {
  const searchParams = useSearchParams();
  const driverId = searchParams.get("driverId");

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
      <section style={{ maxWidth: 700, margin: "0 auto", background: "#0b0b0b", padding: 28, borderRadius: 24 }}>
        <Link href="/find-ride" style={{ color: "white", textDecoration: "none" }}>
          ← Back
        </Link>

        <h1>Driver Profile</h1>

        <p>Driver ID: {driverId || "No driver selected"}</p>

        <div style={{ marginTop: 20 }}>
          <p><strong>Name:</strong> RoadLink Driver</p>
          <p><strong>Rating:</strong> 5.0 ⭐</p>
          <p><strong>Trips:</strong> 1</p>
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

export default function DriverProfilePage() {
  return (
    <Suspense fallback={<main style={{ color: "white", background: "#020617", minHeight: "100vh", padding: 24 }}>Loading...</main>}>
      <DriverProfileContent />
    </Suspense>
  );
}
