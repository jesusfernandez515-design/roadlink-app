import { Wallet, Shield, Leaf, Clock, Star, Users } from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Ahorra dinero",
    description:
      "Divide los costos de viaje con otros pasajeros. Ahorra hasta un 75% comparado con viajar solo.",
  },
  {
    icon: Shield,
    title: "Seguro y verificado",
    description:
      "Todos los conductores están verificados. Revisa calificaciones, reseñas y perfiles completos antes de reservar.",
  },
  {
    icon: Leaf,
    title: "Ecológico",
    description:
      "Reduce tu huella de carbono compartiendo viajes. Un auto menos en la carretera hace la diferencia.",
  },
  {
    icon: Clock,
    title: "Opciones flexibles",
    description:
      "Encuentra viajes a cualquier hora del día. Filtra por hora de salida, comodidades y más.",
  },
  {
    icon: Star,
    title: "Viajes de calidad",
    description:
      "Elige entre vehículos cómodos. Muchos conductores ofrecen WiFi, refrigerios y más comodidades.",
  },
  {
    icon: Users,
    title: "Construye comunidad",
    description:
      "Conoce personas interesantes en tu viaje. Muchos pasajeros se convierten en amigos para toda la vida.",
  },
];

export function Features() {
  return (
    <section className="bg-[var(--muted)] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Por qué elegir Roadlink
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Únete a millones de viajeros que confían en Roadlink para sus trayectos.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl bg-[var(--card)] p-8 shadow-sm transition-all hover:shadow-lg border border-[var(--border)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--primary)]/10 transition-colors group-hover:bg-[var(--primary)]/20">
                <feature.icon className="h-7 w-7 text-[var(--primary)]" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--foreground)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-[var(--muted-foreground)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
