import Link from "next/link";
export default function WalletSettingsPage() {
  return <main style={{ padding: 24, maxWidth: 640, margin: "auto" }}>
    <h1>Cuenta del conductor</h1>
    <p>Conecta tu cuenta desde la cartera. Los datos de identidad y cuenta bancaria se completan directamente en Stripe.</p>
    <p>La integración está disponible solo en el entorno de pruebas.</p>
    <Link href="/wallet">Volver a la cartera y conectar Stripe</Link>
  </main>;
}
