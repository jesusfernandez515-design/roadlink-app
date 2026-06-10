"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="overlay" />

        <nav className="nav">
          <Link href="/" className="brand">
            <img src="/roadlink-logo.png" alt="RoadLink" />
            <span>RoadLink</span>
          </Link>

          <div className="navLinks">
            <Link href="/find-ride">Find</Link>
            <Link href="/offer-ride">Offer</Link>
            <Link href="/login">Login</Link>
            <Link href="/register" className="navButton">
              Register
            </Link>
          </div>
        </nav>

        <div className="content">
          <section className="introCard">
            <p className="eyebrow">Long Distance Ride Sharing</p>

            <h1>
              Travel farther for <span>less.</span>
            </h1>

            <p className="subtitle">
              RoadLink connects drivers and passengers for affordable long-distance
              trips between cities and states.
            </p>

            <div className="actions">
              <Link href="/find-ride" className="primary">
                🔎 Find a Ride
              </Link>

              <Link href="/offer-ride" className="secondary">
                ➕ Offer a Ride
              </Link>
            </div>
          </section>

          <section className="quickCard">
            <p className="eyebrow">Quick Search</p>
            <h2>Plan your trip</h2>

            <div className="formGrid">
              <div className="field">
                <label>From</label>
                <input placeholder="Origin city" />
              </div>

              <div className="field">
                <label>To</label>
                <input placeholder="Destination city" />
              </div>

              <div className="field">
                <label>Date</label>
                <input type="date" />
              </div>

              <div className="field">
                <label>Seats</label>
                <select>
                  <option>1 passenger</option>
                  <option>2 passengers</option>
                  <option>3 passengers</option>
                  <option>4 passengers</option>
                </select>
              </div>
            </div>

            <Link href="/find-ride" className="searchButton">
              Search Routes
            </Link>
          </section>
        </div>

        <section className="stats">
          <Stat icon="🛡️" title="Verified" text="Driver safety tools" />
          <Stat icon="💰" title="Affordable" text="Save on long trips" />
          <Stat icon="🚗" title="Flexible" text="Offer or book rides" />
          <Stat icon="⭐" title="Trusted" text="Ratings and reviews" />
        </section>

        <section className="mobileActions">
          <Link href="/find-ride">🔎 Find</Link>
          <Link href="/offer-ride">➕ Offer</Link>
          <Link href="/messages">💬 Messages</Link>
          <Link href="/profile">👤 Profile</Link>
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #020617;
          color: white;
          font-family: Arial, sans-serif;
        }

        .hero {
          min-height: 100vh;
          position: relative;
          padding: 18px;
          padding-bottom: 110px;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          overflow: hidden;
        }

        .overlay {
          position: absolute;
          inset: 0;
          background-image: url("/images/hero-roadlink-sportscar.png");
          background-size: cover;
          background-position: center;
          opacity: 0.18;
          pointer-events: none;
        }

        .nav,
        .content,
        .stats,
        .mobileActions {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin-left: auto;
          margin-right: auto;
        }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .brand img {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }

        .brand span {
          color: #22c55e;
          font-size: 18px;
        }

        .navLinks {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .navLinks a {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .navLinks .navButton {
          background: #22c55e;
          border-color: #22c55e;
        }

        .content {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 16px;
          align-items: stretch;
        }

        .introCard,
        .quickCard,
        .stat {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 60px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .introCard,
        .quickCard {
          border-radius: 28px;
          padding: 26px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 54px;
          line-height: 1.02;
          margin: 0 0 14px;
          letter-spacing: -1.5px;
        }

        h1 span,
        h2 {
          color: #22c55e;
        }

        h2 {
          font-size: 28px;
          margin: 0 0 18px;
        }

        .subtitle {
          max-width: 620px;
          color: #d4d4d8;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 24px;
        }

        .primary,
        .secondary,
        .searchButton {
          display: block;
          padding: 16px;
          border-radius: 16px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
        }

        .primary,
        .searchButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
        }

        .secondary {
          color: white;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          font-size: 12px;
          font-weight: 900;
          color: #a1a1aa;
        }

        .field input,
        .field select {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.35);
          color: white;
          outline: none;
        }

        .searchButton {
          margin-top: 14px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 16px;
        }

        .stat {
          border-radius: 22px;
          padding: 18px;
          min-height: 120px;
        }

        .statIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          font-size: 22px;
        }

        .stat strong {
          display: block;
          color: #22c55e;
          font-size: 18px;
          margin-bottom: 5px;
        }

        .stat span {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.35;
        }

        .mobileActions {
          display: none;
        }

        @media (max-width: 820px) {
          .hero {
            padding: 16px;
            padding-bottom: 100px;
          }

          .navLinks {
            display: none;
          }

          .content {
            grid-template-columns: 1fr;
          }

          .quickCard {
            display: none;
          }

          h1 {
            font-size: 42px;
          }

          .subtitle {
            font-size: 16px;
          }

          .actions {
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .stat {
            min-height: 116px;
            padding: 16px;
          }

          .mobileActions {
            position: fixed;
            left: 12px;
            right: 12px;
            bottom: 12px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            padding: 10px;
            border-radius: 26px;
            background: rgba(8, 13, 25, 0.96);
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 18px 60px rgba(0,0,0,0.65);
            backdrop-filter: blur(16px);
          }

          .mobileActions a {
            color: white;
            text-decoration: none;
            text-align: center;
            font-size: 12px;
            font-weight: 900;
            padding: 10px 4px;
            border-radius: 18px;
          }

          .mobileActions a:hover {
            background: rgba(34,197,94,0.12);
            color: #22c55e;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="stat">
      <div className="statIcon">{icon}</div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
