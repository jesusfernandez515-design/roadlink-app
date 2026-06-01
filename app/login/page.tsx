"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signIn() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage("Signed in successfully.");
      router.push("/dashboard");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function continueWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setMessage("Signed in with Google.");
      router.push("/dashboard");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  return (
    <main style={page}>
      <section style={card}>
        <div style={logo}>
          Road<span style={{ color: "#22c55e" }}>Link</span>
        </div>

        <h1 style={title}>Welcome Back</h1>
        <p style={subtitle}>Sign in to continue your journey.</p>

        <button style={socialButton} onClick={continueWithGoogle}>
          Continue with Google
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          style={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button style={primaryButton} onClick={signIn}>
          Sign In
        </button>

        {message && <p style={messageStyle}>{message}</p>}

        <p style={footerText}>
          Don't have an account?{" "}
          <a href="/register" style={link}>
            Create one
          </a>
        </p>
      </section>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #000000, #0f172a, #111827)",
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

const messageStyle = {
  color: "#22c55e",
  textAlign: "center" as const,
  marginTop: "18px",
};

const footerText = {
  color: "#a1a1aa",
  textAlign: "center" as const,
  marginTop: "22px",
};

const link = {
  color: "white",
  fontWeight: "700",
  textDecoration: "none",
};
