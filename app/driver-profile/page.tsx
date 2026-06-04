import Link from "next/link";

export default function DriverProfilePage() {
  return (
    <main className="page">
      <section className="profileCard">
        <div className="topActions">
          <Link href="/find-ride" className="miniButton">
            ← Back
          </Link>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="driverHeader">
          <div className="avatar">D</div>

          <div>
            <p className="eyebrow">Verified Driver</p>
            <h1>
              Driver <span>Profile</span>
            </h1>
            <p className="subtitle">RoadLink Driver</p>
            <div className="verifiedBadge">✓ Verified RoadLink Member</div>
          </div>
        </div>

        <section className="stats">
          <Metric icon="⭐" label="Rating" value="New" />
          <Metric icon="🚘" label="Completed Trips" value="0" />
          <Metric icon="🛡️" label="Status" value="Verified" />
        </section>

        <section className="infoCard">
          <p className="eyebrow">Trust & Safety</p>
          <h2>Driver Information</h2>

          <Info icon="👤" label="Name" value="RoadLink Driver" />
          <Info icon="⭐" label="Rating" value="New Driver" />
          <Info icon="🚗" label="Completed Trips" value="0" />
          <Info icon="📅" label="Member Since" value="2026" />
          <Info icon="🛡️" label="Verification" value="Email Verified" />
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .profileCard {
          max-width: 860px;
          margin: 0 auto;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .driverHeader,
        .metric,
        .infoCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .driverHeader {
          border-radius: 32px;
          padding: 30px;
          display: flex;
          align-items: center;
          gap: 22px;
          margin-bottom: 22px;
        }

        .avatar {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          font-weight: 900;
          box-shadow: 0 16px 50px rgba(34,197,94,0.35);
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 54px;
          line-height: 1;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        h1 span,
        .metricValue {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }

        .verifiedBadge {
          display: inline-flex;
          margin-top: 16px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 22px;
        }

        .metricIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 28px;
          font-weight: 900;
        }

        .infoCard {
          border-radius: 30px;
          padding: 28px;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 22px;
        }

        .infoRow {
          display: grid;
          grid-template-columns: 42px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 10px;
        }

        .infoIcon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
        }

        .infoLabel {
          color: #e5e7eb;
          font-weight: 900;
        }

        .infoValue {
          color: #a1a1aa;
          font-weight: 800;
          text-align: right;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .driverHeader,
          .infoCard {
            padding: 24px;
            border-radius: 28px;
          }

          .driverHeader {
            align-items: flex-start;
          }

          .avatar {
            min-width: 76px;
            height: 76px;
            font-size: 34px;
          }

          h1 {
            font-size: 42px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .infoRow {
            grid-template-columns: 42px 1fr;
          }

          .infoValue {
            grid-column: 2;
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="infoRow">
      <div className="infoIcon">{icon}</div>
      <div className="infoLabel">{label}</div>
      <div className="infoValue">{value}</div>
    </div>
  );
}
