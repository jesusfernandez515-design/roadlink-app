import { Leaf, Users, Car, Route } from "lucide-react";
import { SearchForm } from "./search-form";

export default function Hero() {
  return (
    <section className="w-full bg-gradient-to-b from-teal-50 to-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16">

        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-2 rounded-full font-semibold">
            <Leaf className="w-4 h-4" />
            Viajes compartidos seguros
          </div>
        </div>

        {/* Título */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight">
            Comparte tu viaje,
            <span className="block text-teal-600">
              ahorra en el camino
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed">
            Conecta con pasajeros y conductores que viajan en tu misma dirección.
            Comparte gastos, reduce costos y viaja acompañado.
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <Users className="w-8 h-8 mx-auto text-teal-600 mb-3" />
            <h3 className="text-3xl font-bold text-gray-900">Beta</h3>
            <p className="text-gray-600 mt-2">
              Comunidad en crecimiento
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <Car className="w-8 h-8 mx-auto text-teal-600 mb-3" />
            <h3 className="text-3xl font-bold text-gray-900">75+</h3>
            <p className="text-gray-600 mt-2">
              Rutas proyectadas
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <Route className="w-8 h-8 mx-auto text-teal-600 mb-3" />
            <h3 className="text-3xl font-bold text-gray-900">EE. UU.</h3>
            <p className="text-gray-600 mt-2">
              Viajes entre ciudades
            </p>
          </div>

        </div>

        {/* Formulario */}
        <div className="mt-14">
          <SearchForm />
        </div>

      </div>
    </section>
  );
}
