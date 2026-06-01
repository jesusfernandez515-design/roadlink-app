export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <section className="bg-blue-600 text-white py-16 px-6 text-center">
        <h1 className="text-5xl font-bold mb-4">RoadLink</h1>
        <p className="text-xl">
          Conectando conductores y pasajeros de forma segura.
        </p>
      </section>

      {/* Search Section */}
      <section className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">
            Encuentra tu próximo viaje
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <input
              type="text"
              placeholder="Origen"
              className="border p-3 rounded-lg"
            />

            <input
              type="text"
              placeholder="Destino"
              className="border p-3 rounded-lg"
            />

            <input
              type="date"
              className="border p-3 rounded-lg"
            />
          </div>

          <button className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">
            Buscar Viaje
          </button>
        </div>
      </section>

      {/* Action Buttons */}
      <section className="max-w-5xl mx-auto p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow">
            <h3 className="text-2xl font-bold mb-3">
              Soy pasajero
            </h3>

            <p className="mb-4">
              Encuentra conductores que van hacia tu destino.
            </p>

            <button className="bg-green-600 text-white px-5 py-3 rounded-lg">
              Buscar Ride
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow">
            <h3 className="text-2xl font-bold mb-3">
              Soy conductor
            </h3>

            <p className="mb-4">
              Publica espacios disponibles en tu vehículo.
            </p>

            <button className="bg-blue-600 text-white px-5 py-3 rounded-lg">
              Ofrecer Ride
            </button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white mt-10 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-8">
            ¿Por qué usar RoadLink?
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="shadow p-6 rounded-xl">
              <h3 className="font-bold text-xl mb-2">
                Seguro
              </h3>
              <p>
                Verificación de usuarios y sistema de reputación.
              </p>
            </div>

            <div className="shadow p-6 rounded-xl">
              <h3 className="font-bold text-xl mb-2">
                Económico
              </h3>
              <p>
                Comparte gastos de viaje y ahorra dinero.
              </p>
            </div>

            <div className="shadow p-6 rounded-xl">
              <h3 className="font-bold text-xl mb-2">
                Rápido
              </h3>
              <p>
                Encuentra viajes disponibles en minutos.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
