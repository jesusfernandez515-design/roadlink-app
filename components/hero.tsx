"use client";

import SearchForm from "./search-form";

export default function Hero() {
  return (
    <section className="w-full bg-gradient-to-b from-cyan-50 to-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-16">

        <div className="text-center">
          <div className="inline-flex items-center rounded-full bg-cyan-100 px-4 py-2 text-cyan-700 font-medium">
            🌱 Viajes ecológicos
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-bold leading-tight">
            Comparte tu viaje,
            <span className="block text-cyan-600">
              ahorra juntos
            </span>
          </h1>

          <p className="mt-6 max-w-3xl mx-auto text-lg text-gray-600 leading-relaxed">
            Conecta con viajeros que van en tu misma dirección.
            Comparte gastos, reduce emisiones y disfruta viajes
            más económicos y seguros.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <h3 className="text-3xl font-bold text-cyan-600">
              2M+
            </h3>
            <p className="text-gray-600 mt-2">
              Usuarios activos
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <h3 className="text-3xl font-bold text-cyan-600">
              50K+
            </h3>
            <p className="text-gray-600 mt-2">
              Viajes diarios
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <h3 className="text-3xl font-bold text-cyan-600">
              10K+
            </h3>
            <p className="text-gray-600 mt-2">
              Toneladas de CO₂ ahorradas
            </p>
          </div>
        </div>

        <div className="mt-12">
          <SearchForm />
        </div>

      </div>
    </section>
  );
}
