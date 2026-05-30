import { MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-950 px-6 py-12 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600">
                <MapPin className="h-6 w-6" />
              </div>

              <h2 className="text-2xl font-black">RoadLink</h2>
            </div>

            <p className="mt-4 max-w-md leading-relaxed text-gray-400">
              Viajes compartidos entre ciudades. Ahorra dinero, viaja acompañado
              y conecta con personas en tu ruta.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
            <a href="/" className="hover:text-white">Inicio</a>
            <a href="/search" className="hover:text-white">Buscar</a>
            <a href="/about" className="hover:text-white">Acerca de</a>
            <a href="/offer" className="hover:text-white">Ofrecer viaje</a>
            <a href="/login" className="hover:text-white">Acceso</a>
            <a href="/signup" className="hover:text-white">Inscribirse</a>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-gray-500">
          <p>Founder & CEO: Jesús Fernández Rosario</p>
          <p className="mt-2">
            © 2026 RoadLink. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
