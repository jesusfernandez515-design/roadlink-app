"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
  reload,
} from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function isValidGmail(emailValue: string) {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(emailValue);
  }

  async function signIn() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setMessage("Please enter your Gmail and password.");
      return;
    }

    if (!isValidGmail(cleanEmail)) {
      setMessage("Please use a valid Gmail address ending in @gmail.com.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );

      const user = userCredential.user;

      await reload(user);

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        await signOut(auth);

        setMessage(
          "Please verify your Gmail before signing in. We sent you a new verification email."
        );

        return;
      }

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
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const cleanEmail = (user.email || "").toLowerCase();

      if (!isValidGmail(cleanEmail)) {
        await signOut(auth);
        setMessage("Please use a valid Gmail account.");
        return;
      }

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

        <p className="eyebrow">Verified Access</p>

        <h1>Welcome Back</h1>

        <p className="subtitle">
          Sign in with your verified Gmail to continue your RoadLink journey.
        </p>

        <button
          className="googleButton"
          onClick={continueWithGoogle}
          disabled={loading}
        >
          {loading ? "Please wait..." : "Continue with Google"}
        </button>

        <div className="divider">
          <span></span>
          <p>or</p>
          <span></span>
        </div>

        <input
          type="email"
          placeholder="Gmail Address"
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

        <div className="securityBox">
          <p>✅ Verified Gmail required</p>
          <p>✅ Google sign-in supported</p>
          <p>✅ RoadLink secure access</p>
        </div>

        <p className="footerText">
          Don't have an account? <Link href="/register">Create one</Link>
        </p>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 24px;
          font-family: Arial, sans-serif;
          color: white;
        }

        .card {
          width: 100%;
          max-width: 480px;
          background: rgba(8, 13, 25, 0.92);
          border-radius: 32px;
          padding: 34px;
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 30px 90px rgba(0,0,0,0.7);
          backdrop-filter: blur(16px);
        }

        .logo {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 26px;
        }

        .logo span,
        .eyebrow,
        .message {
          color: #22c55e;
        }

        .eyebrow {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 10px;
        }

        h1 {
          font-size: 46px;
          margin: 0 0 12px;
          line-height: 1.05;
        }

        .subtitle {
          color: #a1a1aa;
          margin: 0 0 26px;
          line-height: 1.5;
          font-size: 17px;
        }

        input {
          width: 100%;
          padding: 16px;
          margin-top: 12px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        input:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        input::placeholder {
          color: #71717a;
        }

        button {
          cursor: pointer;
          transition: all 0.25s ease;
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .googleButton {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: white;
          font-size: 16px;
          font-weight: 900;
        }

        .googleButton:hover {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
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
          background: rgba(255,255,255,0.12);
        }

        .divider p {
          color: #71717a;
          margin: 0;
          font-weight: 800;
        }

        .signInButton {
          width: 100%;
          padding: 17px;
          margin-top: 22px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 17px;
          font-weight: 900;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .message {
          text-align: center;
          font-weight: 800;
          margin-top: 18px;
          line-height: 1.5;
        }

        .securityBox {
          margin-top: 22px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.09);
          border: 1px solid rgba(34,197,94,0.22);
        }

        .securityBox p {
          margin: 8px 0;
          color: #d4d4d8;
          font-weight: 800;
        }

        .footerText {
          color: #a1a1aa;
          text-align: center;
          margin: 24px 0 0;
        }

        .footerText a {
          color: white;
          font-weight: 900;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .page {
            align-items: flex-start;
            padding: 18px;
          }

          .card {
            padding: 28px;
            border-radius: 28px;
          }

          h1 {
            font-size: 38px;
          }
        }
      `}</style>
    </main>
  );
}
