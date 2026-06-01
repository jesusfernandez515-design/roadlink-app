export default function OfferRidePage() {
  return (
    <main style={page}>
      <section style={card}>
        <div style={logo}>
          Road<span style={{ color: "#22c55e" }}>Link</span>
        </div>

        <h1 style={title}>Offer a Ride</h1>
        <p style={subtitle}>
          Publish your route and let passengers join your trip.
        </p>

        <form>
          <label style={label}>From</label>
          <input style={input} placeholder="City or address" />

          <label style={label}>To</label>
          <input style={input} placeholder="City or address" />

          <label style={label}>Date</label>
          <input style={input} type="date" />

          <label style={label}>Departure Time</label>
          <input style={input} type="time" />

          <label style={label}>Available Seats</label>
          <select style={input}>
            <option>1 seat</option>
            <option>2 seats</option>
            <option>3 seats</option>
            <option>4 seats</option>
          </select>

          <label style={label}>Price per Seat</label>
          <input style={input} placeholder="$45" />

          <label style={label}>Vehicle</label>
          <input style={input} placeholder="Toyota Camry, Honda CR-V, etc." />

          <label style={label}>Trip Notes</label>
          <textarea
            style={textarea}
            placeholder="Example: No smoking, small luggage allowed, pickup at gas station..."
          />

          <button type="submit" style={primaryButton}>
            Publish Ride
          </button>
        </form>
      </section>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #000000, #0f172a, #111827)",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  color: "white",
};

const card = {
  width: "100%",
  maxWidth: "680px",
  margin: "0 auto",
  background: "#0b0b0b",
  border: "1px solid #222",
  borderRadius: "28px",
  padding: "34px",
  boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
};

const logo = {
  fontSize: "28px",
  fontWeight: "800",
  marginBottom: "26px",
};

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
