import { MapPin, ArrowRight } from "lucide-react";

export function RutasPopulares() {
  const routes = [
    ["Miami", "Orlando", "$49"],
    ["Nueva York", "Boston", "$89"],
    ["Los Ángeles", "San Francisco", "$95"],
    ["Chicago", "Detroit", "$65"],
    ["Austin", "Houston", "$55"],
  ];

  return (
    <section className="bg-white px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-black text-gray-900 sm:text-4xl">
            Rutas populares
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Explora rutas frecuentes para viajes largos entre ciudades.
          </p>
        </div>

        <div className="grid gap-4">
          {routes.map(([from, to, price]) => (
            <div
              key={`${from}-${to}`}
              className="flex items-center justify-between gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                  <MapPin className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-lg font-black text-gray-900">
                    {from} <ArrowRight className="inline h-4 w-4" /> {to}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Viajes compartidos
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-lg font-black text-teal-600">
                  Desde {price}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
