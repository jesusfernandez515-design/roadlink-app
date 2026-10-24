import type { Metadata, Viewport } from "next";
import BottomNavigation from "./components/BottomNavigation";

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
    <html lang="es">
      <body style={{ margin: 0 }}>
        {process.env.NEXT_PUBLIC_ROADLINK_ENV === "test" && (
          <aside aria-label="Entorno de pruebas" style={{ background: "#20372a", color: "#f1eee5", padding: "10px 16px", textAlign: "center", fontFamily: "Arial, sans-serif", fontSize: 12, lineHeight: 1.5 }}>
            RoadLink · Piloto privado de pruebas. Solo cuentas autorizadas. Los pagos y transferencias son ficticios.
          </aside>
        )}
        {children}
        <BottomNavigation />
      </body>
    </html>
  );
}
