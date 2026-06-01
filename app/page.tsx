export default function Home() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif" }}>
      <section
        style={{
          background: "#2563eb",
          color: "white",
          padding: "60px 20px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "48px", marginBottom: "10px" }}>
          RoadLink
        </h1>

        <p style={{ fontSize: "20px" }}>
          Connecting Drivers & Passengers Across America
        </p>

        <p style={{ fontSize: "18px", marginTop: "10px" }}>
          Conectando conductores y pasajeros en Estados Unidos
        </p>
      </section>

      <section style={{ padding: "30px", maxWidth: "1000px", margin: "auto" }}>
        <h2>Find Your Next Ride / Encuentra tu próximo viaje</h2>

        <div
          style={{
            display: "grid",
            gap: "10px",
            marginTop: "20px",
          }}
        >
          <input
            type="text"
            placeholder="Origin / Origen"
            style={{ padding: "12px" }}
          />

          <input
            type="text"
            placeholder="Destination / Destino"
            style={{ padding: "12px" }}
          />

          <input
            type="date"
            style={{ padding: "12px" }}
          />

          <button
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            Search Rides / Buscar Viajes
          </button>
        </div>
      </section>

      <section
        style={{
          maxWidth: "1000px",
          margin: "auto",
          padding: "30px",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "20px",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              padding: "20px",
            }}
          >
            <h2>🚗 Find a Ride</h2>

            <p>
              Search for available rides near you.
            </p>

            <p>
              Busca viajes disponibles cerca de ti.
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              padding: "20px",
            }}
          >
            <h2>🛣 Offer a Ride</h2>

            <p>
              Publish available seats in your vehicle.
            </p>

            <p>
              Publica espacios disponibles en tu vehículo.
            </p>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#f5f5f5",
          padding: "50px 20px",
        }}
      >
        <h2 style={{ textAlign: "center" }}>
          Why RoadLink? / ¿Por qué RoadLink?
        </h2>

        <div
          style={{
            maxWidth: "1000px",
            margin: "30px auto",
          }}
        >
          <h3>🔒 Safe / Seguro</h3>
          <p>User verification and reputation system.</p>

          <h3>💰 Affordable / Económico</h3>
          <p>Share travel costs and save money.</p>

          <h3>⚡ Fast / Rápido</h3>
          <p>Find rides in minutes.</p>
        </div>
      </section>
    </main>
  );
}
