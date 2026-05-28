import { ShieldCheck, CreditCard, Car, Headphones } from "lucide-react";

const trustFeatures = [
  {
    icon: ShieldCheck,
    title: "Conductores verificados",
    description:
      "Verificamos la identidad, licencia de conducir y antecedentes de cada conductor antes de aprobar su perfil.",
  },
  {
    icon: CreditCard,
    title: "Pagos seguros",
    description:
      "Procesamos todos los pagos de forma segura. Tu dinero está protegido hasta que completes tu viaje.",
  },
  {
    icon: Car,
    title: "Viajes protegidos",
    description:
      "Cada viaje incluye seguro de pasajeros. Monitoreo en tiempo real y botón de emergencia disponible 24/7.",
  },
  {
    icon: Headphones,
    title: "Soporte 24/7",
    description:
      "Nuestro equipo de atención está disponible las 24 horas para ayudarte antes, durante y después de tu viaje.",
  },
];

export function TrustSafety() {
  return (
    <section className="py-20 lg:py-28 bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Tu seguridad es nuestra prioridad
          </span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Viaja con total confianza
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Hemos implementado múltiples capas de seguridad para que cada viaje sea una experiencia tranquila y protegida.
          </p>
        </div>

        {/* Trust Features Grid */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {trustFeatures.map((feature) => (
            <div
              key={feature.title}
              className="relative rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center transition-all hover:border-[var(--primary)]/30 hover:shadow-lg"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 shadow-lg shadow-[var(--primary)]/25">
                <feature.icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Trust Stats */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-[var(--primary)]/5 via-[var(--primary)]/10 to-[var(--primary)]/5 p-8 lg:p-12">
          <div className="grid gap-8 text-center sm:grid-cols-3">
            <div>
              <p className="text-4xl font-bold text-[var(--primary)]">99.8%</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Viajes completados sin incidentes
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[var(--primary)]">4.9/5</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Calificación promedio de conductores
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[var(--primary)]">&lt;2min</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Tiempo promedio de respuesta de soporte
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
