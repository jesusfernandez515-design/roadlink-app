export default function RegisterPage() {
  return (
    <main style={page}>
      <section style={card}>
        <div style={logo}>RoadLink</div>

        <h1 style={title}>Create your account</h1>
        <p style={subtitle}>Join RoadLink as a passenger or driver.</p>

        <button style={socialButton}>Continue with Google</button>
        <button style={socialButton}>Continue with Facebook</button>
        <button style={socialButton}>Continue with Apple</button>

        <div style={divider}>
          <span style={line}></span>
          <span style={dividerText}>or</span>
          <span style={line}></span>
        </div>

        <input placeholder="Full name" style={input} />
        <input placeholder="Email address" type="email" style={input} />
        <input placeholder="Password" type="password" style={input} />

        <select style={input}>
          <option>Passenger</option>
          <option>Driver</option>
        </select>

        <button style={primaryButton}>Create Account</button>

        <p style={footerText}>
          Already have an account? <span style={link}>Sign in</span>
        </p>
      </section>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #000000, #111827)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
};

const card = {
  width: "100%",
  maxWidth: "430px",
  background: "#0b0b0b",
  color: "white",
  borderRadius: "24px",
  padding: "34px",
  boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
  border: "1px solid #222",
};

const logo = {
  fontSize: "28px",
  fontWeight: "800",
  marginBottom: "28px",
};

const title = {
  fontSize: "34px",
  lineHeight: "1.1",
  marginBottom: "10px",
};

const subtitle = {
  color: "#a1a1aa",
  fontSize: "16px",
  marginBottom: "24px",
};

const socialButton = {
  width: "100%",
  padding: "15px",
  marginTop: "12px",
  borderRadius: "999px",
  border: "1px solid #333",
  background: "#18181b",
  color: "white",
  fontSize: "16px",
};

const divider = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "26px 0",
};

const line = {
  flex: 1,
  height: "1px",
  background: "#333",
};

const dividerText = {
  color: "#71717a",
};

const input = {
  width: "100%",
  padding: "15px",
  marginTop: "12px",
  borderRadius: "14px",
  border: "1px solid #333",
  background: "#111",
  color: "white",
  fontSize: "16px",
};

const primaryButton = {
  width: "100%",
  padding: "16px",
  marginTop: "20px",
  borderRadius: "999px",
  border: "none",
  background: "white",
  color: "black",
  fontSize: "16px",
  fontWeight: "700",
};

const footerText = {
  color: "#a1a1aa",
  textAlign: "center" as const,
  marginTop: "22px",
};

const link = {
  color: "white",
  fontWeight: "700",
};
