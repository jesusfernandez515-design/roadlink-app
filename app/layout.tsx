import type { Metadata, Viewport } from "next";
import BottomNavigation from "./components/BottomNavigation";
import BrandHeader from "./components/BrandHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoadLink | Más cerca de lo que importa",
  description:
    "Conecta con personas que van en tu misma dirección. Encuentra viajes compartidos y publica tu ruta en Puerto Rico con RoadLink.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "RoadLink",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/roadlink-logo.png",
    apple: "/roadlink-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#080f0d",
  width: "device-width",
  initialScale: 1,

};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-roadlink-brand="luxury">
      <body style={{ margin: 0 }}>
        {process.env.NEXT_PUBLIC_ROADLINK_ENV === "test" && (
          <aside aria-label="Entorno de pruebas" className="sandboxNotice">
            RoadLink · Piloto privado de pruebas. Solo cuentas autorizadas. Los pagos y transferencias son ficticios.
          </aside>
        )}
        <BrandHeader />
        {children}
        <BottomNavigation />
      </body>
    </html>
  );
}
