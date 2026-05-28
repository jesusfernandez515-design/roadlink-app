import { Star } from "lucide-react";

const testimonials = [
  {
    name: "María S.",
    location: "Nueva York a Boston",
    rating: 5,
    text: "He usado Roadlink para mi viaje semanal durante más de un año. El ahorro es increíble y he hecho grandes conexiones en el camino.",
    avatar: "MS",
  },
  {
    name: "Carlos T.",
    location: "Los Ángeles a San Francisco",
    rating: 5,
    text: "Como conductor, Roadlink me ayuda a compensar mis gastos de viaje significativamente. La app es fácil de usar y he conocido personas muy interesantes.",
    avatar: "CT",
  },
  {
    name: "Elena R.",
    location: "Chicago a Detroit",
    rating: 5,
    text: "Estaba nerviosa por mi primer viaje, pero el sistema de verificación y las reseñas me dieron confianza. ¡Ahora soy una usuaria frecuente!",
    avatar: "ER",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            La confianza de los viajeros
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Descubre lo que nuestra comunidad dice sobre sus experiencias con Roadlink.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="flex flex-col rounded-2xl bg-[var(--card)] p-8 shadow-sm border border-[var(--border)]"
            >
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
              <p className="mt-4 flex-1 text-[var(--muted-foreground)]">
                {testimonial.text}
              </p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-3 border-t border-[var(--border)] pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
