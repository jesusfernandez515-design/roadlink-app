import Link from "next/link";

export default function RideDetailsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24 }}>
      <section style={{ maxWidth: 700, margin: "0 auto", background: "#0b0b0b", padding: 28, borderRadius: 24 }}>
        <Link href="/find-ride">
          ← Back
        </Link>

        <h1>Ride Details</h1>

        <p>Route information</p>
        <p>Driver information</p>
        <p>Vehicle information</p>
      </section>
    </main>
  );
}
