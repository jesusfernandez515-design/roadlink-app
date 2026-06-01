export default function OfferRidePage() {
  return (
    <main className="page">
      <section className="card">
        <div className="logo">Road<span>Link</span></div>

        <h1>Offer a Ride</h1>
        <p className="subtitle">Publish your route and let passengers join your trip.</p>

        <label>From</label>
        <input placeholder="City or address" />

        <label>To</label>
        <input placeholder="City or address" />

        <label>Date</label>
        <input type="date" />

        <label>Departure Time</label>
        <input type="time" />

        <label>Available Seats</label>
        <select>
          <option>1 seat</option>
          <option>2 seats</option>
          <option>3 seats</option>
          <option>4 seats</option>
        </select>

        <label>Price per Seat</label>
        <input placeholder="$45" />

        <label>Vehicle</label>
        <input placeholder="Toyota Camry, Honda CR-V, etc." />

        <label>Trip Notes</label>
        <textarea placeholder="No smoking, small luggage allowed, pickup location..." />

        <button>Publish Ride</button>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          width: 100%;
          background: linear-gradient(135deg, #000000, #0f172a, #111827);
          padding: 18px;
          font-family: Arial, sans-serif;
          color: white;
          overflow-x: hidden;
        }

        .card {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 26px;
          padding: 28px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        }

        .logo {
          font-size: 28px;
          font-weight: 900;
          margin-bottom: 26px;
        }

        .logo span {
          color: #22c55e;
        }

        h1 {
          font-size: 38px;
          margin: 0 0 10px;
        }

        .subtitle {
          color: #a1a1aa;
          line-height: 1.5;
          margin-bottom: 26px;
        }

        label {
          display: block;
          margin-top: 16px;
          margin-bottom: 8px;
          color: #d4d4d8;
          font-weight: 700;
        }

        input,
        select,
        textarea {
          width: 100%;
          max-width: 100%;
          display: block;
          padding: 15px;
          border-radius: 14px;
          border: 1px solid #333;
          background: #111;
          color: white;
          font-size: 16px;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        button {
          width: 100%;
          padding: 17px;
          margin-top: 26px;
          border-radius: 999px;
          border: none;
          background: #22c55e;
          color: white;
          font-size: 17px;
          font-weight: 800;
        }

        @media (max-width: 480px) {
          .page {
            padding: 12px;
          }

          .card {
            padding: 22px;
            border-radius: 22px;
          }

          h1 {
            font-size: 34px;
          }
        }
      `}</style>
    </main>
  );
}

const title = {
  fontSize: "40px",
  marginBottom: "10px",
};

const subtitle = {
  color: "#a1a1aa",
  marginBottom: "30px",
};

const label = {
  display: "block",
  marginTop: "16px",
  marginBottom: "8px",
  color: "#d4d4d8",
  fontWeight: "700",
};

const input = {
  width: "100%",
  padding: "15px",
  borderRadius: "14px",
  border: "1px solid #333",
  background: "#111",
  color: "white",
  fontSize: "16px",
};

const textarea = {
  ...input,
  minHeight: "120px",
  resize: "vertical" as const,
};

const primaryButton = {
  width: "100%",
  padding: "17px",
  marginTop: "26px",
  borderRadius: "999px",
  border: "none",
  background: "#22c55e",
  color: "white",
  fontSize: "17px",
  fontWeight: "800",
};
