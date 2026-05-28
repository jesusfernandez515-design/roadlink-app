import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Shield, Users, Leaf, Heart, MapPin } from "lucide-react";

const stats = [
  { label: "Usuarios activos", value: "2M+" },
  { label: "Viajes completados", value: "15M+" },
  { label: "Países", value: "25+" },
  { label: "CO2 ahorrado (tons)", value: "10K+" },
];

const values = [
  {
    icon: Shield,
    title: "Seguridad primero",
    description:
      "Verificamos a todos los conductores y ofrecemos funciones de seguridad como seguimiento de viaje, contactos de emergencia y soporte 24/7.",
  },
  {
    icon: Users,
    title: "Impulsado por la comunidad",
    description:
      "Nuestra plataforma está construida sobre la confianza y la comunidad. Las calificaciones y reseñas ayudan a todos a tomar decisiones informadas.",
  },
  {
    icon: Leaf,
    title: "Sustentabilidad",
    description:
      "Cada viaje compartido reduce las emisiones de carbono. Juntos estamos haciendo el transporte más sustentable.",
  },
  {
    icon: Heart,
    title: "Accesibilidad",
    description:
      "Viajes accesibles para todos. Creemos que ir del punto A al B no debería vaciar tu bolsillo.",
  },
];

const team = [
  { name: "Alex Chen", role: "CEO y Cofundador", avatar: "AC" },
  { name: "María García", role: "CTO y Cofundadora", avatar: "MG" },
  { name: "James Wilson", role: "Director de Operaciones", avatar: "JW" },
  { name: "Sara Johnson", role: "Directora de Confianza y Seguridad", avatar: "SJ" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />

      {/* Hero */}
      <section className="bg-[var(--accent)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Sobre Roadlink
            </h1>
            <p className="mt-6 text-lg text-[var(--muted-foreground)]">
              Nuestra misión es hacer los viajes más accesibles, económicos y
              sustentables conectando viajeros que van en la misma dirección.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[var(--border)] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-[var(--primary)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-[var(--muted-foreground)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-[var(--foreground)]">
                Nuestra historia
              </h2>
              <div className="mt-6 space-y-4 text-[var(--muted-foreground)]">
                <p>
                  Roadlink nació de una idea simple: los asientos vacíos en autos
                  que viajan las mismas rutas representan una gran oportunidad sin
                  explotar para la conexión y la sustentabilidad.
                </p>
                <p>
                  Fundada en 2020, nos propusimos construir una plataforma que haga
                  el carpooling fácil, seguro y agradable. Hoy conectamos millones
                  de viajeros en más de 25 países, ayudándoles a ahorrar dinero
                  mientras reducen su huella de carbono.
                </p>
                <p>
                  Nuestra visión va más allá de solo viajes. Estamos construyendo
                  una comunidad de viajeros que comparten no solo sus trayectos,
                  sino sus historias, experiencias y perspectivas.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl bg-[var(--muted)] flex items-center justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)]/10">
                  <MapPin className="h-12 w-12 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-[var(--muted)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              Nuestros valores
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--muted-foreground)]">
              Estos principios fundamentales guían todo lo que hacemos en Roadlink.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl bg-[var(--card)] p-6 text-center border border-[var(--border)]"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--primary)]/10">
                  <value.icon className="h-7 w-7 text-[var(--primary)]" />
                </div>
                <h3 className="mt-4 font-semibold text-[var(--foreground)]">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              Nuestro equipo
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--muted-foreground)]">
              Conoce a las personas detrás de Roadlink.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <div key={member.name} className="text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-2xl font-bold text-[var(--primary-foreground)]">
                  {member.avatar}
                </div>
                <h3 className="mt-4 font-semibold text-[var(--foreground)]">
                  {member.name}
                </h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
