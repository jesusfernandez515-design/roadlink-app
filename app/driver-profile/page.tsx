"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function DriverProfilePage() {
  const searchParams = useSearchParams();
  const driverId = searchParams.get("driverId");

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
      <section style={{ maxWidth: 700, margin: "0 auto", background: "#0b0b0b", padding: 28, borderRadius: 24 }}>
        <Link href="/find-ride" style={{ color: "white", textDecoration: "none" }}>← Back</Link>

        <h1>Driver Profile</h1>
        <h2>RoadLink Driver</h2>
        <p>Verified RoadLink Member</p>
        <p>Driver ID: {driverId}</p>

        <div style={{ marginTop: 24 }}>
          <p><strong>Rating:</strong> New</p>
          <p><strong>Completed Trips:</strong> 0</p>
          <p><strong>Status:</strong> Verified</p>
        </div>
      </section>
    </main>
  );
}
