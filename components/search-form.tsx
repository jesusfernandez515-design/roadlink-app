"use client";

import { useState } from "react";
import { Search, MapPin, Calendar, Users } from "lucide-react";

export function SearchForm() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("1");

  return (
    <section className="w-full px-5 sm:px-6 lg:px-8 mt-10">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-gray-100">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Origen
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <input
                type="text"
                placeholder="Ciudad o dirección"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Destino
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
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
