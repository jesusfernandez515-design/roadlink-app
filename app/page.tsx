import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ArrowRight, MapPin, ChevronDown, Route, Users, Compass } from "lucide-react";
import styles from "./luxury.module.css";

const vision = [
  { id: "01", image: "jet", title: "Un horizonte sin límites.", category: "AIRE", alt: "Concepto de jet privado con la marca RoadLink al atardecer", text: "La libertad de mirar más lejos." },
  { id: "02", image: "yacht", title: "Otra forma de ver el mundo.", category: "MAR", alt: "Concepto de superyate RoadLink en un atardecer caribeño", text: "La calma de elegir tu propio rumbo." },
  { id: "03", image: "helicopter", title: "Una perspectiva diferente.", category: "ALTURA", alt: "Concepto de helicóptero ejecutivo RoadLink frente al mar", text: "Elevar la mirada. Ampliar lo posible." },
  { id: "04", image: "headquarters", title: "Una visión que toma forma.", category: "LEGADO", alt: "Concepto arquitectónico de la sede RoadLink con iluminación dorada", text: "Construir algo que trascienda el camino." },
];

export default function Home() {
  return (
    <main className={styles.page} data-brand-home="true">
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="RoadLink, inicio"><span className={styles.symbol}>R<span>↗</span></span><span>Road<span className={styles.brandAccent}>Link</span><small>EL CAMINO NOS CONECTA</small></span></Link>
        <nav aria-label="Navegación principal"><a href="#universo">Universo RoadLink</a><a href="#experiencia">La experiencia</a><Link href="/login" className={styles.access}>Mi cuenta <ArrowUpRight size={15} /></Link></nav>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroImage}><Image src="/images/vision/porsche.webp" alt="Visión de marca RoadLink: Porsche 911 GT3 RS y jet al atardecer" fill priority sizes="100vw" quality={85} /></div>
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}><p className={styles.eyebrow}><span /> ROADLINK · UNA VISIÓN EXTRAORDINARIA</p><h1 id="hero-title">El camino hacia<br /><em>algo más grande.</em></h1><p className={styles.intro}>Más cerca de tus destinos.<br />Más cerca de la vida que imaginas.</p><div className={styles.heroActions}><Link href="/pasajero" className={styles.primary}>RoadLink Pasajero <ArrowUpRight size={18} /></Link><Link href="/conductor" className={styles.outline}>RoadLink Conductor <ArrowRight size={17} /></Link></div></div>
        <div className={styles.heroFoot}><span>PUERTO RICO · ROADLINK</span><a href="#universo">EXPLORA EL UNIVERSO <span>↓</span></a><small>Imagen conceptual de marca</small></div>
      </section>

      <section className={styles.routeBar} aria-label="Viajes disponibles hoy"><div><MapPin size={22} /><span>HOY EN ROADLINK<strong>Tu próximo viaje comienza aquí.</strong></span></div><p>Conectamos pasajeros y conductores<br />que comparten una dirección.</p><Link href="/find-ride">Ver viajes compartidos <ArrowUpRight size={19} /></Link></section>

      <section id="universo" className={styles.universe}>
        <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>EL UNIVERSO ROADLINK</p><h2>Por tierra.<br /><em>Con la mirada más allá.</em></h2></div><div className={styles.sectionDescription}><p>Una marca que nace de conectar personas y se inspira en una forma más amplia de vivir, moverse y descubrir.</p><span>CONCEPTOS DE MARCA · VISIÓN A FUTURO</span></div></div>
        <div className={styles.visionGrid}>{vision.map(item => <figure className={styles.visionCard} key={item.id}><div className={`${styles.visionImage} ${item.image === "headquarters" ? styles.architecture : ""}`}><Image src={`/images/vision/${item.image}.webp`} alt={item.alt} fill sizes="(max-width: 760px) 100vw, 50vw" /><span className={styles.imageCategory}>{item.category}</span><span className={styles.imageIndex}>{item.id} / VISIÓN</span></div><figcaption><h3>{item.title}</h3><p>{item.text}</p></figcaption></figure>)}</div>
        <p className={styles.visionNote}>Esta colección expresa nuestra visión de marca. Los jets, yates, helicópteros y edificios son conceptos visuales; actualmente RoadLink conecta viajes compartidos por carretera.</p>
      </section>

      <section id="experiencia" className={styles.experience}><div><p className={styles.eyebrow}>LA ESENCIA ROADLINK</p><h2>El verdadero lujo:<br /><em>estar donde importa.</em></h2></div><div className={styles.experienceText}><p>Una cita que no puedes perder. Una persona que quieres volver a ver. Una oportunidad que merece el viaje.</p><p>Comenzamos con algo esencial: conectar a quienes necesitan llegar con quienes van en la misma dirección. Una gran visión, construida conexión a conexión.</p><Link href="/register" className={styles.textLink}>Comienza tu camino <ArrowUpRight size={17} /></Link></div></section>

      <section className={styles.steps} aria-labelledby="steps-title"><div className={styles.stepsHeading}><p className={styles.eyebrow}>EL PRIMER PASO ES HOY</p><h2 id="steps-title">Una conexión.<br />Nuevas posibilidades.</h2></div><div className={styles.stepGrid}>{[{n:"01",icon:<Compass />,title:"Encuentra tu destino",text:"Explora los viajes publicados y elige una ruta que se ajuste a tus planes."},{n:"02",icon:<Users />,title:"Conecta y reserva",text:"Consulta el perfil del conductor y los detalles antes de reservar tu asiento."},{n:"03",icon:<Route />,title:"Comparte el camino",text:"Coordina los detalles de tu viaje y prepárate para llegar a lo que importa."}].map(step=><article key={step.n}><div className={styles.stepTop}><span>{step.n}</span>{step.icon}</div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>

      <section className={styles.invitation}><p className={styles.eyebrow}>PARA QUIENES ABREN CAMINO</p><h2>Hay destinos que empiezan<br /><em>con una decisión.</em></h2><p>Comparte tu próxima ruta. Tu camino puede acercar a alguien a sus planes.</p><Link href="/conductor" className={styles.primary}>Abre RoadLink Conductor <ArrowUpRight size={18} /></Link><span className={styles.invitationSignature}>ROADLINK — ACERCÁNDOTE A TODO Y A TODOS.</span></section>

      <section id="fundador" className={styles.experience} aria-labelledby="founder-title">
        <div><p className={styles.eyebrow}>LIDERAZGO ROADLINK</p><h2 id="founder-title">Jesús Fernández<br /><em>Rosario</em></h2></div>
        <div className={styles.experienceText}><p style={{ color: "#d9c39d", letterSpacing: "0.12em", fontSize: 12 }}>FUNDADOR Y CEO DE ROADLINK</p><p>RoadLink fue fundado por Jesús Fernández Rosario, quien dirige el proyecto como CEO desde Puerto Rico.</p><p>Su visión: acercarte a todo y a todos, conectando a quienes necesitan llegar con quienes comparten el mismo camino.</p></div>
      </section>

      <section className={styles.faq}><p className={styles.eyebrow}>ANTES DE SALIR</p><h2>Todo empieza con claridad.</h2>{[{q:"¿Qué puedo hacer hoy en RoadLink?",a:"Buscar viajes compartidos por carretera, publicar tu ruta y gestionar tus reservas y mensajes. La disponibilidad depende de los viajes publicados. El piloto actual está limitado a las cuentas autorizadas y utiliza pagos de prueba."},{q:"¿Puedo reservar jets, yates o helicópteros?",a:"Las imágenes de esta colección representan la visión y el universo creativo de RoadLink. No son servicios disponibles para reservar ni una flota operativa. Actualmente la plataforma conecta viajes compartidos por carretera."},{q:"¿Cómo encuentro o publico un viaje?",a:"Selecciona Encuentra tu viaje para explorar rutas u Ofrece un viaje para publicar la tuya. Inicia sesión con una cuenta autorizada para continuar durante el piloto."}].map(item=><details key={item.q}><summary>{item.q}<ChevronDown size={18} /></summary><p>{item.a}</p></details>)}</section>

      <footer className={styles.footer}><div><Link href="/" className={styles.footerBrand}>Road<span>Link</span></Link><p>El camino nos conecta.<br />La visión nos mueve.</p></div><nav aria-label="Enlaces del pie"><a href="#fundador">Fundador y CEO</a><Link href="/support">Ayuda</Link><Link href="/privacy">Privacidad</Link><Link href="/terms">Términos</Link><Link href="/dashboard">Mi panel</Link></nav><small>© {new Date().getFullYear()} RoadLink · Puerto Rico</small><a href="#hero-title" className={styles.backTop} aria-label="Volver al inicio">↑</a></footer>
    </main>
  );
}
