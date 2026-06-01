export default function LoginPage() {
  return (
    <main style={page}>
      <section style={card}>
        <div style={logo}>
          Road<span style={{ color: "#22c55e" }}>Link</span>
        </div>

        <h1 style={title}>Welcome Back</h1>
        <p style={subtitle}>
          Sign in to continue your journey.
        </p>

        <button style={socialButton}>
          Continue with Google
        </button>

        <button style={socialButton}>
          Continue with Facebook
        </button>

        <button style={socialButton}>
          Continue with Apple
        </button>

        <div style={divider}>
          <span style={line}></span>
          <span style={dividerText}>or</span>
          <span style={line}></span>
        </div>

        <input
          type="email"
          placeholder="Email Address"
          style={input}
        />

        <input
          type="password"
          placeholder="Password"
          style={input}
        />

        <button style={primaryButton}>
          Sign In
        </button>

        <p style={forgotPassword}>
          Forgot your password?
        </p>

        <p style={footerText}>
          Don't have an account?{" "}
          <span style={link}>
            Create one
          </span>
        </p>
      </section>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #000000, #0f172a, #111827)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
};

const card = {
  width: "100%",
  maxWidth: "430px",
  background: "#0b0b0b",
  borderRadius: "24px",
  padding: "34px",
  border: "1px solid #222",
  color: "white",
  boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
};

const logo = {
  fontSize: "28px",
  fontWeight: "800",
  marginBottom: "24px",
};

const title = {
  fontSize: "36px",
  marginBottom: "10px",
};

const subtitle = {
  color: "#a1a1aa",
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
  background: "#22c55e",
  color: "white",
  fontSize: "16px",
  fontWeight: "700",
};

const forgotPassword = {
  color: "#22c55e",
  textAlign: "center" as const,
  marginTop: "18px",
  cursor: "pointer",
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
