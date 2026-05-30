import {
  MapPin,
  Search,
  Calendar,
  Users,
  ShieldCheck,
  CreditCard,
  Car,
  Star,
  Route,
  MessageCircle,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white">
              <MapPin className="h-6 w-6" />
            </div>
            <span className="text-2xl font-black">Roadlink</span>
          </div>

          <button className="rounded-xl bg-teal-600 px-5 py-2.5 font-bold text-white">
            Únete
          </button>
        </div>
      </header>

      <section className="bg-gradient-to-b from-teal-50 to-white">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-teal-100 px-4 py-2 text-sm font-bold text-teal-700">
              <Route className="h-4 w-4" />
              Viajes compartidos seguros
            </p>

            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Comparte tu viaje,
              <span className="block text-teal-600">ahorra en el camino</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
              Roadlink conecta pasajeros con conductores verificados para viajes
              largos entre ciudades. Comparte gastos, viaja acompañado y llega
              con más tranquilidad.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3">
            <Stat icon={<Users />} title="Beta" text="Comunidad en crecimiento" />
            <Stat icon={<Car />} title="75+" text="Rutas proyectadas" />
            <Stat icon={<MapPin />} title="EE. UU." text="Viajes entre ciudades" />
          </div>

          <div className="mx-auto mt-12 max-w-5xl rounded-3xl border bg-white p-6 shadow-2xl">
            <h2 className="text-center text-2xl font-black">
              Encuentra tu próximo viaje
            </h2>
            <p className="mt-2 text-center text-gray-600">
              Busca rutas compartidas seguras, económicas y verificadas.
            </p>

            <form className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Origen" icon={<MapPin />} placeholder="Ciudad o dirección" />
              <Field label="Destino" icon={<MapPin />} placeholder="Ciudad o dirección" />
              <Field label="Fecha" icon={<Calendar />} type="date" />
              <SelectField />

              <button className="flex min-h-[58px] items-center justify-center gap-3 rounded-2xl bg-teal-600 text-lg font-black text-white shadow-lg md:col-span-2 lg:col-span-4">
                <Search className="h-5 w-5" />
                Buscar viaje
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-black sm:text-4xl">Cómo funciona</h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            Comenzar con Roadlink es fácil. Encuentra una ruta, reserva tu
            espacio y viaja seguro.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Step number="1" title="Busca una ruta" text="Elige origen, destino, fecha y cantidad de pasajeros." />
            <Step number="2" title="Reserva tu asiento" text="Conecta con conductores verificados que van en tu dirección." />
            <Step number="3" title="Viaja seguro" text="Comparte gastos y disfruta un viaje más cómodo y económico." />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-black sm:text-4xl">
              Por qué elegir Roadlink
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-600">
              Diseñado para viajes largos, conductores confiables y pasajeros que
              quieren ahorrar.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Feature icon={<ShieldCheck />} title="Usuarios verificados" text="Mayor confianza antes de compartir un viaje." />
            <Feature icon={<CreditCard />} title="Pagos seguros" text="Preparado para integrar pagos protegidos." />
            <Feature icon={<Route />} title="Rutas largas" text="Ideal para viajes entre ciudades y estados." />
            <Feature icon={<MessageCircle />} title="Comunicación fácil" text="Conecta pasajero y conductor de forma simple." />
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-black sm:text-4xl">
            Rutas populares
          </h2>

          <div className="mt-8 grid gap-4">
            {[
              ["Miami", "Orlando", "$49"],
              ["Nueva York", "Boston", "$89"],
              ["Los Ángeles", "San Francisco", "$95"],
              ["Chicago", "Detroit", "$65"],
            ].map(([from, to, price]) => (
              <div
                key={from}
                className="flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="text-lg font-black">
                    {from} → {to}
                  </p>
                  <p className="text-sm text-gray-500">Viajes compartidos</p>
                </div>
                <p className="font-black text-teal-600">Desde {price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-teal-600 px-6 py-16 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-black sm:text-4xl">
            ¿Listo para compartir tu viaje?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-teal-50">
            Únete a Roadlink Beta y sé parte de una nueva forma de viajar por
            carretera.
          </p>
          <button className="mt-8 rounded-2xl bg-white px-8 py-4 font-black text-teal-700">
            Quiero unirme
          </button>
        </div>
      </section>

      <footer className="bg-gray-950 px-6 py-10 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl text-center">
          <h3 className="text-2xl font-black">Roadlink</h3>
          <p className="mt-2 text-gray-400">
            Founder & CEO: Jesús Fernández Rosario
          </p>
          <p className="mt-6 text-sm text-gray-500">
            © 2026 Roadlink. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Stat({ icon, title, text }: any) {
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-sm border">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
        {icon}
      </div>
      <p className="text-3xl font-black">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{text}</p>
    </div>
  );
}

function Field({ label, icon, placeholder, type = "text" }: any) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-800">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-teal-600">
          {icon}
        </div>
        <input
          type={type}
          placeholder={placeholder}
          className="min-h-[54px] w-full rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
      </div>
    </div>
  );
}

function SelectField() {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-800">
        Pasajeros
      </label>
      <div className="relative">
        <Users className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
        <select className="min-h-[54px] w-full appearance-none rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
          <option>1 pasajero</option>
          <option>2 pasajeros</option>
          <option>3 pasajeros</option>
          <option>4 pasajeros</option>
        </select>
      </div>
    </div>
  );
}

function Step({ number, title, text }: any) {
  return (
    <div className="rounded-3xl border bg-white p-7 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-xl font-black text-white">
        {number}
      </div>
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-3 leading-relaxed text-gray-600">{text}</p>
    </div>
  );
}

function Feature({ icon, title, text }: any) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
        {icon}
      </div>
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">{text}</p>
    </div>
  );
}
