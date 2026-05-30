import {
  ShieldCheck,
  CreditCard,
  Route,
  MessageCircle,
  Clock,
  Users,
} from "lucide-react";

export function Características() {
  const features = [
    {
      icon: ShieldCheck,
      title: "Usuarios verificados",
      text: "Mayor confianza antes de compartir un viaje.",
    },
    {
      icon: CreditCard,
      title: "Pagos seguros",
      text: "Preparado para integrar pagos protegidos.",
    },
    {
      icon: Route,
      title: "Viajes entre ciudades",
      text: "Ideal para rutas largas entre estados.",
    },
    {
      icon: MessageCircle,
      title: "Comunicación fácil",
      text: "Conecta pasajero y conductor de forma simple.",
    },
    {
      icon: Clock,
      title: "Ahorra tiempo",
      text: "Encuentra rutas disponibles sin complicaciones.",
    },
    {
      icon: Users,
      title: "Comunidad real",
      text: "Pensado para personas que viajan por carretera.",
    },
  ];

  return (
    <section className="bg-gray-50 px-5 py-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black text-gray-950 sm:text-4xl">
            Por qué elegir Roadlink
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-600">
            Una plataforma diseñada para hacer los viajes largos más accesibles,
            seguros y convenientes.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="text-xl font-black text-gray-950">
                  {item.title}
                </h3>

                <p className="mt-3 leading-relaxed text-gray-600">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
