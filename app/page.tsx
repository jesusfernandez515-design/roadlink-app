"use client";

import Logo from "./components/Logo";
import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="overlay" />

        <nav className="nav">
          <Logo height={95} />

          <div className="navLinks">
            <a href="/">Inicio</a>
            <a href="#features">Cómo funciona</a>
            <a href="#safety">Seguridad</a>
            <Link href="/login" className="loginLink">
              Iniciar sesión
            </Link>
            <Link href="/register" className="navButton">
              Registrarse
            </Link>
          </div>
        </nav>

        <div className="heroContent">
          <div className="left">
            <h1>
              Viaja más lejos <br />
              por <span>menos.</span>
            </h1>

            <p className="subtitle">
              La plataforma de viajes largos por carretera entre estados.
              Seguro, económico y confiable.
            </p>

            <div className="buttons">
              <Link href="/find-ride" className="primary">
                🔎 Buscar viaje
              </Link>

              <Link href="/offer-ride" className="secondary">
                👤 Conviértete en conductor
              </Link>
            </div>

            <div id="features" className="features">
              <Feature icon="🛡️" title="Seguro" text="Conductores verificados y seguimiento en tiempo real." />
              <Feature icon="💵" title="Económico" text="Viajes compartidos con precios justos." />
              <Feature icon="🕒" title="Cómodo" text="Rutas inteligentes entre ciudades y estados." />
              <Feature icon="👥" title="Confiable" text="Viajeros conectados cada día en RoadLink." />
            </div>
          </div>

          <div className="searchCard">
            <h2>
              Encuentra tu <span>próximo viaje</span>
            </h2>

            <div className="field">
              <label>Origen</label>
              <input placeholder="¿Desde dónde sales?" />
            </div>

            <div className="field">
              <label>Destino</label>
              <input placeholder="¿A dónde vas?" />
            </div>

            <div className="fieldGrid">
              <div className="field">
                <label>Fecha</label>
                <input type="date" />
              </div>

              <div className="field">
                <label>Pasajeros</label>
                <select>
                  <option>1 pasajero</option>
                  <option>2 pasajeros</option>
                  <option>3 pasajeros</option>
                  <option>4 pasajeros</option>
                </select>
              </div>
            </div>

            <Link href="/find-ride" className="searchButton">
              Buscar ruta
            </Link>
          </div>
        </div>

        <section id="safety" className="stats">
          <Stat icon="🗺️" number="50K+" label="Rutas disponibles" />
          <Stat icon="👥" number="100K+" label="Viajeros activos" />
          <Stat icon="⭐" number="4.8" label="Calificación promedio" />
          <Stat icon="🛡️" number="100%" label="Viajes seguros" />
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #000;
          color: white;
          font-family: Arial, sans-serif;
        }

        .hero {
          min-height: 100vh;
          position: relative;
          padding: 28px;
          background-image: url("/images/hero-road.png");
          background-size: cover;
          background-position: center;
          overflow: hidden;
        }

        .overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(0,0,0,0.95), rgba(0,0,0,0.65), rgba(0,0,0,0.25)),
            linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.85));
          z-index: 0;
        }

        .nav,
        .heroContent,
        .stats {
          position: relative;
          z-index: 1;
        }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 70px;
        }

        .navLinks {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .navLinks a,
        .loginLink {
          color: white;
          text-decoration: none;
          font-weight: 700;
        }

        .navButton {
          background: #22c55e;
          padding: 12px 20px;
          border-radius: 12px;
          color: white;
          text-decoration: none;
          font-weight: 800;
        }

        .heroContent {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 40px;
          align-items: center;
          max-width: 1400px;
          margin: 0 auto;
        }

        .left h1 {
          font-size: 78px;
          line-height: 1.05;
          margin: 0 0 24px;
        }

        .left h1 span,
        .searchCard span {
          color: #22c55e;
        }

        .subtitle {
          font-size: 22px;
          line-height: 1.6;
          color: #e5e7eb;
          max-width: 640px;
        }

        .buttons {
          display: flex;
          gap: 18px;
          margin: 34px 0 50px;
        }

        .primary,
        .secondary {
          padding: 17px 28px;
          border-radius: 14px;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        .primary {
          background: #22c55e;
          color: white;
        }

        .secondary {
          color: white;
          border: 1px solid rgba(255,255,255,0.25);
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(10px);
        }

        .features {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .feature {
          background: rgba(0,0,0,0.38);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 20px;
          backdrop-filter: blur(10px);
        }

        .featureIcon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .feature h3 {
          margin: 0 0 8px;
        }

        .feature p {
          color: #d4d4d8;
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        .searchCard {
          background: rgba(5, 8, 15, 0.82);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 30px;
          padding: 34px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.8);
          backdrop-filter: blur(14px);
        }

        .searchCard h2 {
          font-size: 42px;
          line-height: 1.15;
          margin: 0 0 28px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 18px;
        }

        .field label {
          color: white;
          font-weight: 800;
        }

        .field input,
        .field select {
          width: 100%;
          padding: 17px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(0,0,0,0.45);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .fieldGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .searchButton {
          display: block;
          margin-top: 12px;
          background: #22c55e;
          color: white;
          padding: 18px;
          border-radius: 16px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          font-size: 18px;
        }

        .stats {
          max-width: 1400px;
          margin: 60px auto 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          border-top: 1px solid rgba(255,255,255,0.14);
          padding-top: 26px;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .statIcon {
          font-size: 34px;
        }

        .stat h3 {
          margin: 0;
          color: #22c55e;
          font-size: 30px;
        }

        .stat p {
          margin: 4px 0 0;
          color: #d4d4d8;
        }

        @media (max-width: 900px) {
  .hero {
    min-height: auto;
    padding: 24px 20px 40px;
    background-position: center top;
  }

  .overlay {
    background:
      linear-gradient(180deg, rgba(0,0,0,0.88), rgba(0,0,0,0.78), rgba(0,0,0,0.92));
  }

  .nav {
    margin-bottom: 70px;
  }

  .nav img {
    height: 90px !important;
  }

  .navLinks {
    display: none;
  }

  .heroContent {
    display: block;
  }

  .left h1 {
    font-size: 54px;
    line-height: 1.05;
    margin-bottom: 24px;
  }

  .subtitle {
    font-size: 19px;
    line-height: 1.6;
  }

  .buttons {
    flex-direction: column;
    gap: 16px;
    margin: 34px 0;
  }

  .primary,
  .secondary {
    width: 100%;
    padding: 20px;
    border-radius: 18px;
    font-size: 18px;
  }

  .features {
    grid-template-columns: 1fr;
    margin-top: 36px;
  }

  .searchCard {
    display: none;
  }

  .stats {
    grid-template-columns: 1fr 1fr;
    margin-top: 40px;
  }

           .nav {
            align-items: flex-start;
            margin-bottom: 55px;
          }

          .navLinks {
            display: none;
          }

          .heroContent {
            grid-template-columns: 1fr;
          }

          .left h1 {
            font-size: 52px;
          }

          .subtitle {
            font-size: 18px;
          }

          .buttons {
            flex-direction: column;
          }

          .features {
            grid-template-columns: 1fr;
          }

          .searchCard {
            padding: 24px;
          }

          .searchCard h2 {
            font-size: 34px;
          }

          .fieldGrid {
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Feature({ icon, title, text }: any) {
  return (
    <div className="feature">
      <div className="featureIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Stat({ icon, number, label }: any) {
  return (
    <div className="stat">
      <div className="statIcon">{icon}</div>
      <div>
        <h3>{number}</h3>
        <p>{label}</p>
      </div>
    </div>
  );
}
