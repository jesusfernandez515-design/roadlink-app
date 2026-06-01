export default function DashboardPage() {
  return (
    <main className="page">
      <section className="card">
        <div className="header">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back to RoadLink.</p>
          </div>

          <div className="avatar">J</div>
        </div>

        <div className="stats">
          <Box title="Active Rides" value="2" />
          <Box title="Booked Trips" value="4" />
          <Box title="Rating" value="4.9" />
          <Box title="Earnings" value="$245" />
        </div>

        <section className="section">
          <h2>Upcoming Trip</h2>
          <div className="trip">
            <h3>Mobile, AL → Pensacola, FL</h3>
            <p>Tomorrow · 9:30 AM</p>
            <p>Driver: Michael T. · ⭐ 4.8</p>
            <button>View Details</button>
          </div>
        </section>

        <section className="section">
          <h2>Quick Actions</h2>
          <div className="actions">
            <a href="/find-ride">Find a Ride</a>
            <a href="/offer-ride">Offer a Ride</a>
            <a href="/profile">Profile</a>
          </div>
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg,#000,#0f172a,#111827);
          color: white;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .card {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        h1 {
          font-size: 42px;
          margin: 0;
        }

        p {
          color: #a1a1aa;
        }

        .avatar {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          background: #22c55e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 16px;
          margin-top: 32px;
        }

        .box {
          background: #111;
          border: 1px solid #222;
          border-radius: 18px;
          padding: 18px;
        }

        .box h3 {
          color: #a1a1aa;
          font-size: 14px;
          margin: 0 0 10px;
        }

        .box p {
          color: #22c55e;
          font-size: 28px;
          font-weight: 900;
          margin: 0;
        }

        .section {
          margin-top: 34px;
        }

        .trip {
          background: #111;
          border: 1px solid #222;
          border-radius: 20px;
          padding: 20px;
        }

        .trip h3 {
          margin-top: 0;
        }

        button {
          width: 100%;
          margin-top: 16px;
          padding: 15px;
          border-radius: 999px;
          border: none;
          background: #22c55e;
          color: white;
          font-weight: 800;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 14px;
        }

        .actions a {
          background: #111;
          border: 1px solid #222;
          border-radius: 18px;
          padding: 18px;
          text-align: center;
          color: white;
          text-decoration: none;
          font-weight: 800;
        }

        @media (max-width: 700px) {
          .card {
            padding: 22px;
          }

          .header {
            align-items: flex-start;
          }

          h1 {
            font-size: 34px;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Box({ title, value }: any) {
  return (
    <div className="box">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}
