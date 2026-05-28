import { Star, Quote } from "lucide-react";
import Image from "next/image";

const testimonials = [
  {
    name: "María Fernanda Solis",
    location: "Nueva York → Boston",
    rating: 5,
    text: "Llevo más de un año usando Roadlink para mis viajes semanales de trabajo. He ahorrado más de $3,000 y conocido personas increíbles. La verificación de conductores me da mucha tranquilidad.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
    verified: true,
    trips: 156,
  },
  {
    name: "Carlos Andrés Torres",
    location: "Los Ángeles → San Francisco",
    rating: 5,
    text: "Como conductor, Roadlink me permite cubrir mis gastos de combustible y peajes. La app es súper intuitiva y el sistema de pagos es muy confiable. Ya llevo más de 200 viajes.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    verified: true,
    trips: 234,
  },
  {
    name: "Elena Rodríguez García",
    location: "Miami → Orlando",
    rating: 5,
    text: "Al principio tenía dudas, pero las reseñas detalladas y los perfiles verificados me convencieron. Ahora viajo cada mes a visitar a mi familia. El soporte siempre responde rápido.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    verified: true,
    trips: 48,
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-[var(--muted)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Miles de viajeros confían en nosotros
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Historias reales de nuestra comunidad de más de 2 millones de usuarios activos.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="relative flex flex-col rounded-2xl bg-[var(--card)] p-8 shadow-sm border border-[var(--border)]"
            >
              {/* Quote Icon */}
              <Quote className="absolute right-6 top-6 h-10 w-10 text-[var(--primary)]/10" />
              
              {/* Rating */}
              <div className="flex gap-1">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Text */}
              <p className="mt-6 flex-1 text-[var(--foreground)] leading-relaxed">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              {/* Author */}
              <div className="mt-8 flex items-center gap-4 border-t border-[var(--border)] pt-6">
                <div className="relative">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                  />
                  {testimonial.verified && (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {testimonial.location}
                  </p>
                  <p className="text-xs text-[var(--primary)]">
                    {testimonial.trips} viajes realizados
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social Proof */}
        <div className="mt-16 flex flex-col items-center justify-center gap-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 sm:flex-row sm:gap-12">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-3">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=40&h=40&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=40&h=40&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=40&h=40&fit=crop&crop=face",
              ].map((src, i) => (
                <Image
                  key={i}
                  src={src}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">+2M usuarios</p>
              <p className="text-sm text-[var(--muted-foreground)]">confían en Roadlink</p>
            </div>
          </div>
          <div className="hidden h-12 w-px bg-[var(--border)] sm:block" />
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-semibold text-[var(--foreground)]">4.9</span>
            <span className="text-[var(--muted-foreground)]">en App Store</span>
          </div>
        </div>
      </div>
    </section>
  );
}
