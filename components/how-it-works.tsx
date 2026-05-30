import { Search, UserCheck, Car, CheckCircle } from "lucide-react";

export function ComoFunciona() {
  const steps = [
    {
      icon: Search,
      title: "Busca un viaje",
      text: "Encuentra conductores o pasajeros que viajen hacia tu destino.",
    },
    {
      icon: UserCheck,
      title: "Conecta",
      text: "Revisa perfiles y comunícate antes del viaje.",
    },
    {
      icon: Car,
      title: "Viaja",
      text: "Comparte gastos y disfruta un viaje más económico.",
    },
    {
      icon: CheckCircle,
      title: "Califica",
      text: "Ayuda a construir una comunidad segura y confiable.",
    },
  ];

  return (
    <section className="bg-white py-16 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Cómo funciona
          </h2>

          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Comenzar con Roadlink es sencillo. Sigue estos pasos
            para compartir tu próximo viaje.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-4">

          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className="text-center bg-gray-50 rounded-3xl p-6 shadow-sm"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-cyan-100 flex items-center justify-center mb-4">
                  <Icon className="w-8 h-8 text-cyan-600" />
                </div>

                <div className="text-sm font-bold text-cyan-600 mb-2">
                  PASO {index + 1}
                </div>

                <h3 className="text-xl font-bold text-gray-900">
                  {step.title}
                </h3>

                <p className="mt-3 text-gray-600 leading-relaxed">
                  {step.text}
                </p>
              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
}
