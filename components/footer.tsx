import Link from "next/link";
import { MapPin, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

const footerLinks = {
  producto: [
    { name: "Buscar viaje", href: "/search" },
    { name: "Ofrecer viaje", href: "/offer" },
    { name: "Cómo funciona", href: "#how-it-works" },
    { name: "Precios", href: "/pricing" },
  ],
  empresa: [
    { name: "Nosotros", href: "/about" },
    { name: "Carreras", href: "/careers" },
    { name: "Prensa", href: "/press" },
    { name: "Blog", href: "/blog" },
  ],
  soporte: [
    { name: "Centro de ayuda", href: "/help" },
    { name: "Seguridad", href: "/safety" },
    { name: "Contacto", href: "/contact" },
    { name: "Preguntas frecuentes", href: "/faq" },
  ],
  legal: [
    { name: "Política de privacidad", href: "/privacy" },
    { name: "Términos de servicio", href: "/terms" },
    { name: "Política de cookies", href: "/cookies" },
  ],
};

const socialLinks = [
  { name: "Facebook", href: "#", icon: Facebook },
  { name: "Twitter", href: "#", icon: Twitter },
  { name: "Instagram", href: "#", icon: Instagram },
  { name: "LinkedIn", href: "#", icon: Linkedin },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]">
                <MapPin className="h-5 w-5 text-[var(--primary-foreground)]" />
              </div>
              <span className="text-xl font-bold text-[var(--foreground)]">
                Roadlink
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-[var(--muted-foreground)]">
              Conectando viajeros para trayectos más seguros, económicos y
              sustentables en todo el país.
            </p>
            {/* Social Links */}
            <div className="mt-6 flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
                >
                  <span className="sr-only">{social.name}</span>
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">Producto</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.producto.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-[var(--foreground)]">Empresa</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-[var(--foreground)]">Soporte</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.soporte.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-[var(--foreground)]">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t border-[var(--border)] pt-8">
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            &copy; {new Date().getFullYear()} Roadlink. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
