"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <nav className="nav">
        <div>
          <div className="logo">
            Road<span>Link</span>
          </div>
          <p className="tagline">Long distance rides made simple.</p>
        </div>

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

      <section className="hero">
        <div>
          <h1 className="title">
            Viaja más lejos <br />
            por <span>menos.</span>
          </h1>

          <p className="subtitle">
            La plataforma de viajes largos por carretera entre estados.
            Segura, económica y confiable.
          </p>

          <div className="buttons">
            <Link href="/find-ride" className="primary">
              Buscar viaje
            </Link>

            <Link href="/offer-ride" className="secondary">
              Conviértete en conductor
            </Link>
          </div>

          <div id="features" className="features">
            <Feature icon="🛡️" title="Seguro" text="Conductores verificados y seguimiento en tiempo real." />
            <Feature icon="💵" title="Económico" text="Comparte gastos y ahorra dinero en cada viaje." />
            <Feature icon="🕒" title="Cómodo" text="Rutas inteligentes y viajes entre estados." />
            <Feature icon="👥" title="Confiable" text="Miles de viajeros conectados cada día." />
          </div>
        </div>

        <div className="card">
          <h2 className="cardTitle">
            Crea tu cuenta <br />
            en <span>RoadLink</span>
          </h2>

          <p className="cardSub">Únete como pasajero o conductor.</p>

          <Link href="/register" className="greenButton">
            Crear cuenta
          </Link>

          <p className="smallText">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="inlineLink">
              Inicia sesión
            </Link>
          </p>
        </div>
      </section>

      <section id="safety" className="stats">
        <Stat number="50K+" label="Rutas disponibles" />
        <Stat number="100K+" label="Viajeros activos" />
        <Stat number="4.8" label="Calificación promedio" />
        <Stat number="100%" label="Viajes seguros" />
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: radial-gradient(circle at center, #0f172a 0%, #020617 45%, #000 100%);
          color: white;
          font-family: Arial, sans-serif;
          padding: 28px;
        }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 60px;
        }

        .logo {
          font-size: 34px;
          font-weight: 900;
        }

        .logo span,
        .title span,
        .cardTitle span {
          color: #22c55e;
        }

        .tagline {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .navLinks {
          display: flex;
          gap: 24px;
          align-items: center;
        }

        .navLinks a,
        .loginLink {
          color: white;
          text-decoration: none;
          font-weight: 700;
        }

        .navButton {
          background: #22c55e;
          color: white;
          padding: 12px 18px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 700;
        }

        .hero {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 40px;
          align-items: center;
        }

        .title {
          font-size: 72px;
          line-height: 1.05;
          margin-bottom: 24px;
        }

        .subtitle {
          font-size: 22px;
          color: #d4d4d8;
          max-width: 600px;
          line-height: 1.6;
        }

        .buttons {
          display: flex;
          gap: 18px;
          margin-top: 30px;
          margin-bottom: 50px;
        }

        .primary {
          display: inline-block;
          background: #22c55e;
          color: white;
          padding: 16px 26px;
          border-radius: 14px;
          text-decoration: none;
          font-size: 16px;
          font-weight: 800;
          text-align: center;
        }

        .secondary {
          display: inline-block;
          color: white;
          padding: 16px 26px;
          border-radius: 14px;
          border: 1px solid #3f3f46;
          text-decoration: none;
          font-weight: 700;
          text-align: center;
        }

        .features {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .feature {
          background: rgba(255,255,255,0.04);
          border: 1px solid #27272a;
          border-radius: 18px;
          padding: 20px;
        }

        .featureIcon {
          font-size: 30px;
          margin-bottom: 12px;
        }

        .featureText {
          color: #a1a1aa;
          font-size: 14px;
        }

        .card {
          background: rgba(10,10,10,0.85);
          border: 1px solid #27272a;
          border-radius: 28px;
          padding: 40px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.7);
        }

        .cardTitle {
          font-size: 42px;
          line-height: 1.15;
        }

        .cardSub {
          color: #a1a1aa;
          margin-bottom: 30px;
        }

        .greenButton {
          display: block;
          background: #22c55e;
          color: white;
          padding: 16px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-weight: 800;
          margin-top: 20px;
        }

        .smallText {
          color: #a1a1aa;
          text-align: center;
          margin-top: 22px;
        }

        .inlineLink {
          color: #22c55e;
          font-weight: 800;
          text-decoration: none;
        }

        .stats {
          border-top: 1px solid #27272a;
          margin-top: 70px;
          padding-top: 30px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .stat {
          text-align: center;
        }

        .statNumber {
          color: #22c55e;
          font-size: 32px;
          margin-bottom: 6px;
        }

        .statLabel {
          color: #a1a1aa;
        }

        @media (max-width: 768px) {
          .page {
            padding: 20px;
          }

          .nav {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 38px;
          }

          .navLinks {
            display: none;
          }

          .hero {
            grid-template-columns: 1fr;
            gap: 28px;
          }

          .title {
            font-size: 44px;
          }

          .subtitle {
            font-size: 17px;
          }

          .buttons {
            flex-direction: column;
            margin-bottom: 34px;
          }

          .primary,
          .secondary {
            width: 100%;
          }

          .features {
            grid-template-columns: 1fr;
          }

          .card {
            padding: 28px;
          }

          .cardTitle {
            font-size: 32px;
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
      <p className="featureText">{text}</p>
    </div>
  );
}

function Stat({ number, label }: any) {
  return (
    <div className="stat">
      <h3 className="statNumber">{number}</h3>
      <p className="statLabel">{label}</p>
    </div>
  );
}
