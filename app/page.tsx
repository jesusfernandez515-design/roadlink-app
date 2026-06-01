"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main style={page}>
      <nav style={nav}>
        <div>
          <div style={logo}>
            Road<span style={{ color: "#22c55e" }}>Link</span>
          </div>
          <p style={tagline}>Long distance rides made simple.</p>
        </div>

        <div style={navLinks}>
          <a>Inicio</a>
          <a>Cómo funciona</a>
          <a>Seguridad</a>
          <Link href="/register" style={navButton}>
            Registrarse
          </Link>
        </div>
      </nav>

      <section style={hero}>
        <div style={left}>
          <h1 style={title}>
            Viaja más lejos <br />
            por <span style={{ color: "#22c55e" }}>menos.</span>
          </h1>

          <p style={subtitle}>
            La plataforma de viajes largos por carretera entre estados.
            Segura, económica y confiable.
          </p>

          <div style={buttons}>
            <button style={primary}>Buscar viaje</button>
            <Link href="/register" style={secondary}>
              Conviértete en conductor
            </Link>
          </div>

          <div style={features}>
            <Feature icon="🛡️" title="Seguro" text="Conductores verificados y seguimiento en tiempo real." />
            <Feature icon="💵" title="Económico" text="Comparte gastos y ahorra dinero en cada viaje." />
            <Feature icon="🕒" title="Cómodo" text="Rutas inteligentes y viajes entre estados." />
            <Feature icon="👥" title="Confiable" text="Miles de viajeros conectados cada día." />
          </div>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>
            Crea tu cuenta <br />
            en <span style={{ color: "#22c55e" }}>RoadLink</span>
          </h2>

          <p style={cardSub}>Únete como pasajero o conductor.</p>

          <Link href="/register" style={greenButton}>
            Crear cuenta
          </Link>

          <p style={smallText}>
            ¿Ya tienes cuenta? <span style={{ color: "#22c55e" }}>Inicia sesión</span>
          </p>
        </div>
      </section>

      <section style={stats}>
        <Stat number="50K+" label="Rutas disponibles" />
        <Stat number="100K+" label="Viajeros activos" />
        <Stat number="4.8" label="Calificación promedio" />
        <Stat number="100%" label="Viajes seguros" />
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: any) {
  return (
    <div style={feature}>
      <div style={featureIcon}>{icon}</div>
      <h3>{title}</h3>
      <p style={featureText}>{text}</p>
    </div>
  );
}

function Stat({ number, label }: any) {
  return (
    <div style={stat}>
      <h3 style={statNumber}>{number}</h3>
      <p style={statLabel}>{label}</p>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "radial-gradient(circle at center, #0f172a 0%, #020617 45%, #000 100%)",
  color: "white",
  fontFamily: "Arial, sans-serif",
  padding: "28px",
};

const nav = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "60px",
};

const logo = {
  fontSize: "34px",
  fontWeight: "900",
};

const tagline = {
  color: "#a1a1aa",
  marginTop: "4px",
};

const navLinks = {
  display: "flex",
  gap: "24px",
  alignItems: "center",
};

const navButton = {
  background: "#22c55e",
  color: "white",
  padding: "12px 18px",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: "700",
};

const hero = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: "40px",
  alignItems: "center",
};

const left = {
  maxWidth: "850px",
};

const title = {
  fontSize: "72px",
  lineHeight: "1.05",
  marginBottom: "24px",
};

const subtitle = {
  fontSize: "22px",
  color: "#d4d4d8",
  maxWidth: "600px",
  lineHeight: "1.6",
};

const buttons = {
  display: "flex",
  gap: "18px",
  marginTop: "30px",
  marginBottom: "50px",
};

const primary = {
  background: "#22c55e",
  color: "white",
  padding: "16px 26px",
  borderRadius: "14px",
  border: "none",
  fontSize: "16px",
  fontWeight: "700",
};

const secondary = {
  color: "white",
  padding: "16px 26px",
  borderRadius: "14px",
  border: "1px solid #3f3f46",
  textDecoration: "none",
};

const features = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "20px",
};

const feature = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid #27272a",
  borderRadius: "18px",
  padding: "20px",
};

const featureIcon = {
  fontSize: "30px",
  marginBottom: "12px",
};

const featureText = {
  color: "#a1a1aa",
  fontSize: "14px",
};

const card = {
  background: "rgba(10,10,10,0.85)",
  border: "1px solid #27272a",
  borderRadius: "28px",
  padding: "40px",
  boxShadow: "0 30px 90px rgba(0,0,0,0.7)",
};

const cardTitle = {
  fontSize: "42px",
  lineHeight: "1.15",
};

const cardSub = {
  color: "#a1a1aa",
  marginBottom: "30px",
};

const greenButton = {
  display: "block",
  background: "#22c55e",
  color: "white",
  padding: "16px",
  borderRadius: "999px",
  textAlign: "center" as const,
  textDecoration: "none",
  fontWeight: "800",
  marginTop: "20px",
};

const smallText = {
  color: "#a1a1aa",
  textAlign: "center" as const,
  marginTop: "22px",
};

const stats = {
  borderTop: "1px solid #27272a",
  marginTop: "70px",
  paddingTop: "30px",
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "20px",
};

const stat = {
  textAlign: "center" as const,
};

const statNumber = {
  color: "#22c55e",
  fontSize: "32px",
  marginBottom: "6px",
};

const statLabel = {
  color: "#a1a1aa",
};
