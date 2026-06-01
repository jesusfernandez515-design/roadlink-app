"use client";

import { useState } from "react";

export default function Home() {
  const [lang, setLang] = useState<"en" | "es">("en");

  const text = {
    en: {
      subtitle: "Connecting drivers and passengers across America",
      findTitle: "Find Your Next Ride",
      origin: "Origin",
      destination: "Destination",
      search: "Search Rides",
      passenger: "Find a Ride",
      passengerText: "Search for available rides near you.",
      driver: "Offer a Ride",
      driverText: "Publish available seats in your vehicle.",
      why: "Why RoadLink?",
      safe: "Safe",
      safeText: "User verification and reputation system.",
      affordable: "Affordable",
      affordableText: "Share travel costs and save money.",
      fast: "Fast",
      fastText: "Find rides in minutes.",
    },
    es: {
      subtitle: "Conectando conductores y pasajeros en Estados Unidos",
      findTitle: "Encuentra tu próximo viaje",
      origin: "Origen",
      destination: "Destino",
      search: "Buscar viajes",
      passenger: "Buscar viaje",
      passengerText: "Busca viajes disponibles cerca de ti.",
      driver: "Ofrecer viaje",
      driverText: "Publica espacios disponibles en tu vehículo.",
      why: "¿Por qué RoadLink?",
      safe: "Seguro",
      safeText: "Verificación de usuarios y sistema de reputación.",
      affordable: "Económico",
      affordableText: "Comparte gastos de viaje y ahorra dinero.",
      fast: "Rápido",
      fastText: "Encuentra viajes en minutos.",
    },
  };

  const t = text[lang];

  return (
    <main style={{ fontFamily: "Arial, sans-serif" }}>
      <section style={{ background: "#2563eb", color: "white", padding: "50px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "44px", marginBottom: "10px" }}>RoadLink</h1>
        <p style={{ fontSize: "18px" }}>{t.subtitle}</p>

        <div style={{ marginTop: "25px" }}>
          <button onClick={() => setLang("en")} style={{ padding: "10px 18px", marginRight: "10px" }}>
            English
          </button>
          <button onClick={() => setLang("es")} style={{ padding: "10px 18px" }}>
            Español
          </button>
        </div>
      </section>

      <section style={{ padding: "30px", maxWidth: "1000px", margin: "auto" }}>
        <h2>{t.findTitle}</h2>

        <div style={{ display: "grid", gap: "10px", marginTop: "20px" }}>
          <input type="text" placeholder={t.origin} style={{ padding: "12px" }} />
          <input type="text" placeholder={t.destination} style={{ padding: "12px" }} />
          <input type="date" style={{ padding: "12px" }} />

          <button style={{ background: "#2563eb", color: "white", border: "none", padding: "14px" }}>
            {t.search}
          </button>
        </div>
      </section>

      <section style={{ maxWidth: "1000px", margin: "auto", padding: "30px" }}>
        <div style={{ display: "grid", gap: "20px" }}>
          <div style={{ border: "1px solid #ddd", padding: "20px" }}>
            <h2>🚗 {t.passenger}</h2>
            <p>{t.passengerText}</p>
          </div>

          <div style={{ border: "1px solid #ddd", padding: "20px" }}>
            <h2>🛣 {t.driver}</h2>
            <p>{t.driverText}</p>
          </div>
        </div>
      </section>

      <section style={{ background: "#f5f5f5", padding: "50px 20px" }}>
        <h2 style={{ textAlign: "center" }}>{t.why}</h2>

        <div style={{ maxWidth: "1000px", margin: "30px auto" }}>
          <h3>🔒 {t.safe}</h3>
          <p>{t.safeText}</p>

          <h3>💰 {t.affordable}</h3>
          <p>{t.affordableText}</p>

          <h3>⚡ {t.fast}</h3>
          <p>{t.fastText}</p>
        </div>
      </section>
    </main>
  );
}
