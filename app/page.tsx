export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-teal-600">
            RoadLink
          </h1>

          <nav className="hidden md:flex gap-6 font-medium">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#beneficios">Beneficios</a>
            <a href="#rutas">Rutas</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-5xl font-extrabold leading-tight">
            Comparte tu viaje,
            <span className="block text-teal-600">
              ahorra juntos
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Conecta conductores y pasajeros para compartir gastos,
            reducir costos y viajar de forma más eficiente.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <input
              placeholder="Origen"
              className="rounded-xl border p-4"
            />

            <input
              placeholder="Destino"
              className="rounded-xl border p-4"
            />

            <input
              type="date"
              className="rounded-xl border p-4"
            />

            <button className="rounded-xl bg-teal-600 p-4 font-bold text-white">
              Buscar viaje
            </button>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section
        id="como-funciona"
        className="bg-gray-50 px-6 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <h3 className="mb-12 text-center text-4xl font-bold">
            Cómo funciona
          </h3>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-8">
              <h4 className="mb-4 text-xl font-bold">
                1. Busca
              </h4>
              <p>
                Encuentra rutas disponibles cerca de ti.
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-8">
              <h4 className="mb-4 text-xl font-bold">
                2. Reserva
              </h4>
              <p>
                Elige el viaje que mejor se adapte a tus necesidades.
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-8">
              <h4 className="mb-4 text-xl font-bold">
                3. Viaja
              </h4>
              <p>
                Comparte gastos y disfruta el trayecto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section
        id="beneficios"
        className="px-6 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <h3 className="mb-12 text-center text-4xl font-bold">
            ¿Por qué elegir RoadLink?
          </h3>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border p-8">
              <h4 className="text-xl font-bold">
                Ahorra dinero
              </h4>

              <p className="mt-3 text-gray-600">
                Comparte combustible y gastos del viaje.
              </p>
            </div>

            <div className="rounded-2xl border p-8">
              <h4 className="text-xl font-bold">
                Comunidad segura
              </h4>

              <p className="mt-3 text-gray-600">
                Viaja con usuarios verificados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rutas */}
      <section
        id="rutas"
        className="bg-gray-50 px-6 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <h3 className="mb-12 text-center text-4xl font-bold">
            Rutas populares
          </h3>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow">
              Mobile → Birmingham
            </div>

            <div className="rounded-2xl bg-white p-6 shadow">
              Mobile → New Orleans
            </div>

            <div className="rounded-2xl bg-white p-6 shadow">
              Birmingham → Atlanta
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal-600 px-6 py-20 text-center text-white">
        <h3 className="text-4xl font-bold">
          ¿Listo para compartir tu viaje?
        </h3>

        <p className="mx-auto mt-4 max-w-2xl">
          Únete a RoadLink y comienza a ahorrar hoy.
        </p>

        <button className="mt-8 rounded-xl bg-white px-8 py-4 font-bold text-teal-600">
          Comenzar ahora
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto max-w-6xl text-center text-gray-500">
          © 2026 RoadLink. Todos los derechos reservados.
        </div>
      </footer>
    </main>
  );
}
