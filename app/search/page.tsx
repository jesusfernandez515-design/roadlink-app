import Header from "@/components/header";
import { PieDePágina } from "@/components/footer";
import { SearchForm } from "@/components/search-form";

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <Header />

      <section className="px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black">
              Buscar viajes
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-gray-600">
              Encuentra rutas compartidas entre ciudades.
            </p>
          </div>

          <SearchForm />
        </div>
      </section>

      <PieDePágina />
    </main>
  );
}
