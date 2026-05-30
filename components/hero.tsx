"use client";

import SearchForm from "./search-form";

export function Hero() {
  return (
    <section className="w-full bg-gradient-to-b from-cyan-50 to-white py-12 px-5">
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-10">

          <div className="inline-flex items-center gap-2 bg-cyan-100 text-cyan-700 px-4 py-2 rounded-full text-sm font-medium">
            🌱 Viajes ecológicos
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-bold leading-tight text-gray-900">
            Comparte tu viaje,
            <span className="block text-cyan-600">
              ahorra juntos
            </span>
          </h1>

          <p className="max-w-3xl mx-auto mt-5 text-lg text-gray-600 leading-relaxed">
            Conecta con viajeros que van en tu misma dirección.
            Comparte gastos, reduce emisiones y viaja de forma
            más económica y segura.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">

          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-4xl font-bold text-cyan-600">
              2M+
            </div>
            <p className="text-gray-600 mt-2">
              Usuarios activos
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-4xl font-bold text-cyan-600">
              50K+
            </div>
            <p className="text-gray-600 mt-2">
              Viajes diarios
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-4xl font-bold text-cyan-600">
              10K+
            </div>
            <p className="text-gray-600 mt-2">
              Toneladas de CO₂ ahorradas
            </p>
          </div>

        </div>

        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8">
          <SearchForm />
        </div>

      </div>
    </section>
  );
}
