"use client";

export default function DriverVerificationPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #052e16 0%, #020617 60%)",
        color: "white",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#020817",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: "28px",
            padding: "32px",
            boxShadow: "0 20px 60px rgba(0,0,0,.45)",
          }}
        >
          <p
            style={{
              color: "#22c55e",
              fontWeight: 800,
              letterSpacing: "1px",
              marginBottom: "12px",
            }}
          >
            ROADLINK DRIVER CENTER
          </p>

          <h1
            style={{
              fontSize: "48px",
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: "20px",
            }}
          >
            Driver Verification
          </h1>

          <p
            style={{
              color: "#94a3b8",
              fontSize: "18px",
              marginBottom: "30px",
            }}
          >
            Complete your verification to start accepting rides and earning
            money through RoadLink.
          </p>

          <div
            style={{
              display: "grid",
              gap: "16px",
            }}
          >
            <div
              style={{
                padding: "20px",
                borderRadius: "20px",
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
              ✅ Government ID Uploaded
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "20px",
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
              ✅ Driver License Verified
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "20px",
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
              ⏳ Background Check Pending
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "20px",
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
              ⏳ Vehicle Inspection Pending
            </div>
          </div>

          <button
            style={{
              marginTop: "30px",
              width: "100%",
              padding: "18px",
              borderRadius: "18px",
              border: "none",
              background: "#22c55e",
              color: "white",
              fontWeight: 800,
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            Submit Verification
          </button>
        </div>
      </div>
    </main>
  );
}
