import Header from "@/components/header";
import Hero from "@/components/hero";
import { ComoFunciona } from "@/components/how-it-works";
import { Características } from "@/components/features";
import { RutasPopulares } from "@/components/popular-routes";
import { Testimonios } from "@/components/testimonials";
import { CTA } from "@/components/cta";
import { PieDePágina } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <Header />
      <Hero />
      <ComoFunciona />
      <Características />
      <RutasPopulares />
      <Testimonios />
      <CTA />
      <PieDePágina />
    </main>
  );
}
