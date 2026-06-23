"use client";

import Link from "next/link";

export default function AdminStripePage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#020617,#0f172a)",
      color: "white",
      padding: "24px",
      fontFamily: "Arial, sans-serif"
    }}>
      <section style={{
        maxWidth: "900px",
        margin: "auto",
        background: "rgba(8,13,25,0.94)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "30px",
        padding: "28px"
      }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "28px" }}>
          <Link href="/admin" style={button}>Admin</Link>
          <Link href="/admin/stripe-production" style={button}>Stripe Production</Link>
          <Link href="/admin/payments" style={button}>Payments</Link>
          <Link href="/admin/payouts" style={button}>Payouts</Link>
        </div>

        <p style={{ color: "#22c55e", fontWeight: 900, letterSpacing: "0.08em" }}>
          ROADLINK STRIPE
        </p>

        <h1 style={{ fontSize: "44px", lineHeight: 1, margin: "0 0 14px" }}>
          Stripe Connect <span style={{ color: "#22c55e" }}>Center</span>
        </h1>

        <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>
          Stripe is now ready to connect with RoadLink Checkout, payments, platform fees,
          driver payouts and Stripe Connect.
        </p>

        <div style={{
          display: "grid",
          gap: "14px",
          marginTop: "24px"
        }}>
          <Card title="Checkout API" text="app/api/stripe/create-checkout-session/route.ts" />
          <Card title="Webhook API" text="app/api/stripe/webhook/route.ts" />
          <Card title="Connect API" text="app/api/stripe/connect-account/route.ts" />
          <Card title="Environment Variables" text="STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_APP_URL" />
        </div>
      </section>
    </main>
  );
}

const button = {
  padding: "11px 16px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
  textDecoration: "none",
  fontWeight: 900
};

function Card({ title, text }: { title: string; text: string }) {
  return (
    <section style={{
      padding: "18px",
      borderRadius: "20px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)"
    }}>
      <h3 style={{ margin: "0 0 8px", color: "#22c55e" }}>{title}</h3>
      <p style={{ margin: 0, color: "#d4d4d8", overflowWrap: "anywhere" }}>{text}</p>
    </section>
  );
}
