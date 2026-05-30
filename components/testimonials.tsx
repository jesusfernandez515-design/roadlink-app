export function Testimonios() {
  const reviews = [
    {
      name: "María",
      text: "Encontré un viaje seguro y gasté mucho menos de lo que esperaba.",
    },
    {
      name: "Carlos",
      text: "La experiencia fue excelente. Conocí personas increíbles durante el viaje.",
    },
    {
      name: "Ana",
      text: "Una forma inteligente de viajar largas distancias compartiendo gastos.",
    },
  ];

  return (
    <section className="bg-gray-50 py-16 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            La confianza de los viajeros
          </h2>

          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Miles de personas utilizan plataformas de viaje compartido para
            ahorrar dinero y viajar de forma más eficiente.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {reviews.map((review) => (
            <div
              key={review.name}
              className="bg-white rounded-3xl p-6 shadow-sm"
            >
              <div className="text-yellow-500 text-xl mb-3">
                ★★★★★
              </div>

              <p className="text-gray-600 leading-relaxed">
                "{review.text}"
              </p>

              <div className="mt-5 font-bold text-gray-900">
                {review.name}
              </div>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}
