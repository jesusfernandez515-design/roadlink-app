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
  const [loading, setLoading] = useState(false);

  async function signIn() {
    try {
      setLoading(true);
      setMessage("");

      if (!email || !password) {
        setMessage("Please enter your email and password.");
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);

      setMessage("Signed in successfully.");
      router.push("/dashboard");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    try {
      setLoading(true);
      setMessage("");

      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      setMessage("Signed in with Google.");
      router.push("/dashboard");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>Welcome Back</h1>
        <p className="subtitle">Sign in to continue your journey.</p>

        <button
          className="googleButton"
          onClick={continueWithGoogle}
          disabled={loading}
        >
          Continue with Google
        </button>

        <div className="divider">
          <span></span>
          <p>or</p>
          <span></span>
        </div>

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button className="signInButton" onClick={signIn} disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </button>

        {message && <p className="message">{message}</p>}

        <p className="footerText">
          Don't have an account?{" "}
          <a href="/register">Create one</a>
        </p>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #000000, #0f172a, #111827);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 24px;
          font-family: Arial, sans-serif;
          color: white;
        }

        .card {
          width: 100%;
          max-width: 460px;
          background: #0b0b0b;
          border-radius: 28px;
          padding: 34px;
          border: 1px solid #222;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        }

        .logo {
          font-size: 30px;
          font-weight: 900;
          margin-bottom: 26px;
        }

        .logo span {
          color: #22c55e;
        }

        h1 {
          font-size: 42px;
          margin: 0 0 10px;
        }

        .subtitle {
          color: #a1a1aa;
          margin-bottom: 26px;
          line-height: 1.5;
        }

        input {
          width: 100%;
          padding: 16px;
          margin-top: 12px;
          border-radius: 16px;
          border: 1px solid #333;
          background: #111;
          color: white;
          font-size: 16px;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .googleButton {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          border: 1px solid #333;
          background: #18181b;
          color: white;
          font-size: 16px;
          font-weight: 700;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 28px 0;
        }

        .divider span {
          flex: 1;
          height: 1px;
          background: #333;
        }

        .divider p {
          color: #71717a;
          margin: 0;
        }

        .signInButton {
          width: 100%;
          padding: 17px;
          margin-top: 22px;
          border-radius: 999px;
          border: none;
          background: #22c55e;
          color: white;
          font-size: 17px;
          font-weight: 800;
        }

        .message {
          color: #22c55e;
          text-align: center;
          font-weight: 700;
          margin-top: 18px;
          line-height: 1.5;
        }

        .footerText {
          color: #a1a1aa;
          text-align: center;
          margin-top: 24px;
        }

        .footerText a {
          color: white;
          font-weight: 800;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .page {
            align-items: flex-start;
            padding: 18px;
          }

          .card {
            padding: 28px;
            border-radius: 24px;
          }

          h1 {
            font-size: 36px;
          }
        }
      `}</style>
    </main>
  );
}
