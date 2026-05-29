"use client";

import { useState } from "react";
import { Search, MapPin, Calendar, Users } from "lucide-react";

export function SearchForm() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("1");

  return (
    <section className="w-full px-5 sm:px-6 lg:px-8 mt-14 mb-16">
      <div className="mx-auto max-w-5xl rounded-[28px] border border-gray-100 bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black text-gray-950">
            Encuentra tu próximo viaje
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Busca rutas compartidas seguras, económicas y verificadas.
          </p>
        </div>

        <form className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Origen
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <input
                type="text"
                placeholder="Ciudad o dirección"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-13 min-h-[52px] w-full rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Destino
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <input
                type="text"
                placeholder="Ciudad o dirección"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-13 min-h-[52px] w-full rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Fecha
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-[52px] w-full rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 shadow-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Pasajeros
            </label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <select
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                className="min-h-[52px] w-full appearance-none rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 shadow-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              >
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num} pasajero{num > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="mt-2 flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-teal-600 px-6 text-lg font-black text-white shadow-xl transition hover:bg-teal-700"
            >
              <Search className="h-5 w-5" />
              Buscar viaje
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <input
                type="text"
                placeholder="Ciudad o dirección"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Fecha
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Pasajeros
            </label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <select
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                className="h-12 w-full appearance-none rounded-xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-teal-600 text-lg font-bold text-white shadow-lg transition hover:bg-teal-700"
            >
              <Search className="h-5 w-5" />
              Buscar viaje
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
