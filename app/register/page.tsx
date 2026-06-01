export default function RegisterPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#f5f5f5", padding: "30px" }}>
      <section style={{ maxWidth: "420px", margin: "auto", background: "white", padding: "30px", borderRadius: "12px" }}>
        <h1 style={{ textAlign: "center" }}>Create your RoadLink account</h1>
        <p style={{ textAlign: "center" }}>Crea tu cuenta de RoadLink</p>

        <button style={buttonStyle}>Continue with Google</button>
        <button style={buttonStyle}>Continue with Facebook</button>
        <button style={buttonStyle}>Continue with Apple</button>

        <hr style={{ margin: "25px 0" }} />

        <input placeholder="Full name" style={inputStyle} />
        <input placeholder="Email" type="email" style={inputStyle} />
        <input placeholder="Password" type="password" style={inputStyle} />

        <select style={inputStyle}>
          <option>Passenger</option>
          <option>Driver</option>
        </select>

        <button style={{ ...buttonStyle, background: "#2563eb", color: "white" }}>
          Create Account
        </button>
      </section>
    </main>
  );
}

const buttonStyle = {
  width: "100%",
  padding: "14px",
  marginTop: "12px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  background: "white",
  fontSize: "16px",
};

const inputStyle = {
  width: "100%",
  padding: "14px",
  marginTop: "12px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  fontSize: "16px",
};
