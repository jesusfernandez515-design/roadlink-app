import type { Metadata, Viewport } from "next";
import AppExperienceProvider from "./components/AppExperience";
import BottomNavigation from "./components/BottomNavigation";
import DriverPushControl from "./components/DriverPushControl";
import LastMinuteAlerts from "./components/LastMinuteAlerts";
import BrandHeader from "./components/BrandHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoadLink | Más cerca de lo que importa",
  description:
    "Conecta con personas que van en tu misma dirección. Encuentra viajes compartidos y publica tu ruta en Puerto Rico con RoadLink.",
  appleWebApp: {
    capable: true,
    title: "RoadLink",
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/icons/roadlink-luxury.svg", type: "image/svg+xml" },
      { url: "/icons/roadlink-luxury-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/icons/roadlink-luxury-180.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  themeColor: "#070d11",
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
        <AppExperienceProvider>
        <BrandHeader />
        <LastMinuteAlerts />
        <DriverPushControl />
        {children}
        <BottomNavigation />
        </AppExperienceProvider>
      </body>
    </html>
  );
}
