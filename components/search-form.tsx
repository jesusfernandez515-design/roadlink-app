import { Leaf, Users, Car, Route } from "lucide-react";
import { SearchForm } from "./search-form";

export function Hero() {
  return (
    <section className="w-full bg-gradient-to-b from-teal-50 to-white">
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-teal-100 px-4 py-2 text-sm font-bold text-teal-700">
            <Leaf className="h-4 w-4" />
            Viajes compartidos seguros
          </div>

          <h1 className="text-4xl font-black leading-tight tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
            Comparte tu viaje,
            <span className="block text-teal-600">ahorra en el camino</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            Roadlink conecta pasajeros con conductores verificados para viajes
            largos entre ciudades. Ahorra dinero, viaja acompañado y llega con
            más tranquilidad.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white/80 p-5 text-center shadow-sm ring-1 ring-gray-100">
            <Users className="mx-auto mb-3 h-8 w-8 text-teal-600" />
            <p className="text-3xl font-black text-gray-950">Beta</p>
            <p className="mt-1 text-sm font-medium text-gray-600">
              Comunidad en crecimiento
            </p>
          </div>

          <div className="rounded-3xl bg-white/80 p-5 text-center shadow-sm ring-1 ring-gray-100">
            <Car className="mx-auto mb-3 h-8 w-8 text-teal-600" />
            <p className="text-3xl font-black text-gray-950">75+</p>
            <p className="mt-1 text-sm font-medium text-gray-600">
              Rutas proyectadas
            </p>
          </div>

          <div className="rounded-3xl bg-white/80 p-5 text-center shadow-sm ring-1 ring-gray-100">
            <Route className="mx-auto mb-3 h-8 w-8 text-teal-600" />
            <p className="text-3xl font-black text-gray-950">EE. UU.</p>
            <p className="mt-1 text-sm font-medium text-gray-600">
              Viajes entre ciudades
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
