import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type UIEvent } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, MapPin, X } from 'lucide-react';
import './landing.css';
import PublicNavigation from '../PublicNavigation';

/*
 * ÍNDICE DE LA PORTADA
 * A. events, disciplines y programs: contenido que alimenta listas y tarjetas.
 * B. EventsSection: desplazamiento del carrusel y barra de progreso.
 * C. InspirationSection: biografía, cifras animadas y visor de obras.
 * D. LocationSection: video en bucle, dirección y bandera.
 * E. ExploreSection y ProgramsSection: disciplinas y oferta formativa.
 * F. LandingHost: orden final de las secciones, de arriba hacia abajo.
 *
 * Para cambiar aspecto, edita landing.css; para cambiar fotos, revisa media.
 */

// Recursos visuales locales en public/media/lucy/. No se descargan al editar la página.
const media = '/media/lucy/';
// Para editar el carrusel: agrega, quita o cambia objetos de esta lista.
const events = [{
  title: 'Estrellas de Navidad',
  tags: 'Danza · baile · cultura',
  date: 'Viernes 12 de diciembre · 7:00 p. m.',
  place: 'Teatro Lucy Tejada · Pereira centro',
  image: 'evento1.png',
  alt: 'Afiche Estrellas de Navidad'
}, {
  title: 'Retreta banda sinfónica',
  tags: 'Música · folclor · cultura',
  date: 'Viernes 24 de mayo · 4:00 p. m.',
  place: 'Hall Centro Cultural Lucy Tejada',
  image: 'evento2.png',
  alt: 'Afiche Retreta Banda Sinfónica'
}, {
  title: 'Exposición de artes plásticas',
  tags: 'Imagen · memoria · territorio',
  date: 'Una casa abierta a nuevas miradas',
  place: 'Salas de exposición · entrada libre',
  image: 'collage2.jpg',
  alt: 'Mural y obra de arte en el Centro Cultural'
}];
// Disciplinas mostradas en “Explora tu camino” y sus ilustraciones locales.
const disciplines = [{
  name: 'Música',
  art: 'notasmusicales.svg',
  detail: 'Escucha, ritmo y creación colectiva.'
}, {
  name: 'Teatro',
  art: 'teatro.svg',
  detail: 'Voz, cuerpo y relatos para compartir.'
}, {
  name: 'Artes plásticas',
  art: 'artes plasticas.svg',
  detail: 'Color, materia e ideas que toman forma.'
}, {
  name: 'Danza',
  art: 'danza.svg',
  detail: 'Movimiento, expresión y encuentro.'
}];
// Filas de ejemplo de la sección de programas formativos.
const programs = [['01', 'Danza y movimiento', 'CUERPO · RITMO · EXPRESIÓN'], ['02', 'Laboratorio de música', 'SONIDO · ESCUCHA · CREACIÓN'], ['03', 'Taller de artes plásticas', 'IMAGEN · MATERIA · COLOR'], ['04', 'Teatro en comunidad', 'VOZ · ESCENA · ENCUENTRO']];
// Carrusel de eventos: estado del scroll, flechas y progreso.
function EventsSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const updateProgress = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  };
  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const first = track.querySelector<HTMLElement>('.project-slide');
    const gap = Number.parseFloat(getComputedStyle(track).gap) || 24;
    track.scrollBy({
      left: direction * ((first?.getBoundingClientRect().width || track.clientWidth * .48) + gap),
      behavior: 'smooth'
    });
  };
  return <section className="lucy-section lucy-art-bg events-section" id="eventos" style={{
    '--art-image': `url("${media}fonde3.png")`
  } as CSSProperties}>
    <div className="lucy-wrap">
      <p className="lucy-kicker">EVENTOS Y COMUNIDAD</p>
      <h2 className="section-heading">EVENTOS</h2>
      <div className="projects-carousel">
        <button className="carousel-arrow carousel-prev" aria-label="Evento anterior" onClick={() => move(-1)}>
          <ArrowLeft size={19} />
        </button>
        <div className="projects-track" ref={trackRef} onScroll={updateProgress}>
          { events.map((event, index) => <article className="project-slide" key={event.title}>
            <div className="project-card">
              <div className="event-meta">
                <span className="event-number">0{index + 1}</span>
                <span>
                  { event.tags }
                </span>
              </div>
              <h3>
                { event.title }
              </h3>
              <p className="event-date">
                { event.date }
              </p>
              <p className="event-place">
                { event.place }
              </p>
              <div className="banner-container">
                <img className="banner" src={`${media}${event.image}`} alt={event.alt} loading="lazy" />
              </div>
              <a className="event-visit" href="#programas" aria-label={`Conoce más: ${event.title}`}>Visit <ArrowUpRight size={13} /></a>
            </div>
          </article>) }
        </div>
        <button className="carousel-arrow carousel-next" aria-label="Evento siguiente" onClick={() => move(1)}>
          <ArrowRight size={19} />
        </button>
      </div>
      <div className="carousel-progress" role="progressbar" aria-label="Progreso de eventos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{
          transform: `translateX(${progress * 200}%)`
        }} />
      </div>
    </div>
  </section>;
}
// Biografía e imágenes de Lucy Tejada. Cambia aquí el texto o los SVG.
function InspirationSection() {
  // Ref local de la sección: permite observar qué entra al viewport.
  const sectionRef = useRef<HTMLElement>(null);
  // La galería usa un único diálogo accesible con controles anterior/siguiente.
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Estos valores animan los números; los objetivos están en el efecto de abajo.
  const [statsValues, setStatsValues] = useState([0, 0, 0]);
  const isLightboxOpen = lightboxIndex !== null;
  const gallery = [
    { image: 'ELSEMBRADOOR.jpg', width: 326, height: 613, focus: '50% 62%', alt: 'Figura humana en una obra de Lucy Tejada, El sembrador', caption: 'El sembrador' },
    { image: 'LOSINSECTOS.jpg', width: 359, height: 557, focus: '50% 46%', alt: 'Figuras humanas reunidas en una obra de tonos rosados de Lucy Tejada', caption: 'Los insectos' },
    { image: 'PASAJEROS.jpg', width: 509, height: 407, focus: '50% 47%', alt: 'Composición de figuras y objetos en tonos tierra, obra de Lucy Tejada', caption: 'Pasajeros' },
    { image: 'TRASLAHUELLA.jpg', width: 606, height: 506, focus: '50% 52%', alt: 'Figura entre flores y colibríes en tonos rosados, obra de Lucy Tejada', caption: 'Tras la huella' },
  ];
  // Fondos artísticos locales, alternados para evitar ampliar una sola imagen.
  const biographyBackgrounds = [
    'fondo1.png', 'fonde3.png', 'fondo-2-3.png', 'fonde3.png',
    'fondo1.png', 'fondo-2-3.png', 'fonde3.png', 'fondo1.png',
    'fondo-2-3.png', 'fondo1.png', 'fonde3.png', 'fondo-2-3.png',
    'fonde3.png', 'fondo-2-3.png', 'fondo1.png', 'fonde3.png',
    'fondo1.png', 'fondo-2-3.png',
  ];

  // Revela el contenido al llegar a la sección y cuenta las cifras una sola vez.
  // Con movimiento reducido, muestra los valores finales sin animación.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealItems = section.querySelectorAll<HTMLElement>('.bio-reveal');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach(item => item.classList.add('is-visible'));
      setStatsValues([1920, 163, 2005]);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .14 });
    revealItems.forEach(item => observer.observe(item));
    const statsObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        const targets = [1920, 163, 2005];
        const startedAt = performance.now();
        const duration = 1050;
        let frame = 0;
        const countUp = (now: number) => {
          const progress = Math.min((now - startedAt) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setStatsValues(targets.map(target => Math.round(target * eased)));
          if (progress < 1) frame = requestAnimationFrame(countUp);
        };
        frame = requestAnimationFrame(countUp);
        statsObserver.disconnect();
      }
    }, { threshold: .4 });
    const stats = section.querySelector('.bio-stats');
    if (stats) statsObserver.observe(stats);
    return () => {
      observer.disconnect();
      statsObserver.disconnect();
    };
  }, []);

  // Teclado del visor: Escape cierra, flechas cambian obra y Tab queda dentro.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.querySelector<HTMLElement>('.bio-lightbox-close')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
      } else if (event.key === 'ArrowRight') {
        setLightboxIndex(index => index === null ? null : (index + 1) % gallery.length);
      } else if (event.key === 'ArrowLeft') {
        setLightboxIndex(index => index === null ? null : (index - 1 + gallery.length) % gallery.length);
      } else if (event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [isLightboxOpen]);

  // Guarda el foco antes de abrir para devolverlo al mismo botón al cerrar.
  const openArtwork = (index: number) => {
    returnFocusRef.current = document.activeElement as HTMLElement;
    setLightboxIndex(index);
  };

  // El orden del JSX también es el orden móvil: retrato, texto, archivo, cifras, mosaico.
  return <section ref={sectionRef} className="lucy-section inspiration-section" id="inspiracion">
    <div className="bio-mural-field" aria-hidden="true">
      {biographyBackgrounds.map((image, index) => <span className="bio-mural-tile" key={`${image}-${index}`} style={{ backgroundImage: `url("${media}${image}")` }} />)}
    </div>
    <div className="lucy-wrap">
      <header className="bio-heading bio-reveal">
        <p className="lucy-kicker">NUESTRA INSPIRACIÓN</p>
        <h2 className="inspiration-title">Lucy Tejada: <em>la artista de la ternura</em></h2>
        <span className="bio-heading-mark" aria-hidden="true" />
      </header>
      <div className="bio-editorial">
        <figure className="bio-portrait bio-reveal">
          <img src={`${media}BIOGRAFIAimg1.svg`} alt="Retrato ilustrado de Lucy Tejada entre rosas y un colibrí" loading="lazy" width="2000" height="2000" />
          <figcaption>Una vida entre color, memoria y naturaleza</figcaption>
        </figure>
        <div className="bio-copy bio-reveal">
          <p className="bio-lead">En Pereira comenzó la mirada de Lucy Tejada: una artista que convirtió el lienzo en un lugar para la ternura.</p>
          <p>Nació en 1920 y llegó a ser una de las pintoras, muralistas y grabadoras más importantes del arte moderno colombiano.</p>
          <p>En sus obras, mujeres de mirada profunda, niños y naturaleza abrieron un espacio poético lleno de color. Su talento la llevó a exponer en Europa y en grandes galerías del mundo, sin apartarla de sus raíces cafeteras.</p>
        </div>
      </div>
      <div className="bio-legacy-layout" id="bio-coleccion">
        <figure className="bio-photo bio-reveal">
          <span className="bio-photo-image">
            <img src={`${media}BIOGRAFIAimg2.svg`} alt="Lucy Tejada junto a una de sus pinturas, en una fotografía de archivo en blanco y negro" loading="lazy" width="2000" height="2000" />
          </span>
          <figcaption>Lucy Tejada y su obra · archivo fotográfico</figcaption>
        </figure>
        <div className="bio-legacy bio-reveal">
          <span className="bio-archive-note">Pereira · 2005</span>
          <p>En 2005, Pereira inauguró este centro cultural en su honor. Lucy y su familia donaron 163 obras originales que hoy conforman su museo, lo que convirtió a Lucy en la única artista colombiana con museo propio en su ciudad y región.</p>
        </div>
      </div>
      <div className="bio-stats bio-reveal" aria-label="Datos destacados de Lucy Tejada">
        <div className="bio-stat"><strong>{statsValues[0]}</strong><span>Nació en Pereira</span></div>
        <div className="bio-stat"><strong>{statsValues[1]}</strong><span>Obras originales donadas</span></div>
        <div className="bio-stat"><strong>{statsValues[2]}</strong><span>Año de inauguración</span></div>
      </div>
      <div className="bio-collection" id="bio-artwork-gallery">
        <h3 className="bio-gallery-title">Una colección que sigue hablando</h3>
        <div className="bio-gallery" aria-label="Galería de obras y mural">
          {gallery.map((artwork, index) => <button className="bio-art-card" type="button" key={artwork.image} onClick={() => openArtwork(index)} aria-label={`Ampliar: ${artwork.caption}`}>
            <span className="bio-art-image"><img src={`${media}${artwork.image}`} alt={artwork.alt} loading="lazy" width={artwork.width} height={artwork.height} style={{ objectPosition: artwork.focus }} /></span>
            <span className="bio-art-caption">{artwork.caption}<b aria-hidden="true">↗</b></span>
          </button>)}
        </div>
        <div className="bio-actions">
          <a className="bio-button-primary" href="#bio-artwork-gallery">Explora la colección <ArrowRight size={16} /></a>
          <a className="bio-button-ghost" href="#inspiracion">Conoce la historia de Lucy</a>
        </div>
      </div>
      {lightboxIndex !== null && <div className="bio-lightbox-backdrop" onClick={event => { if (event.target === event.currentTarget) setLightboxIndex(null); }}>
        <div className="bio-lightbox" ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Galería: ${gallery[lightboxIndex].caption}`}>
          <button className="bio-lightbox-close" type="button" onClick={() => setLightboxIndex(null)} aria-label="Cerrar galería"><X size={22} /></button>
          <button className="bio-lightbox-arrow bio-lightbox-prev" type="button" onClick={() => setLightboxIndex((lightboxIndex - 1 + gallery.length) % gallery.length)} aria-label="Obra anterior"><ArrowLeft size={20} /></button>
          <figure><img src={`${media}${gallery[lightboxIndex].image}`} alt={gallery[lightboxIndex].alt} width={gallery[lightboxIndex].width} height={gallery[lightboxIndex].height} /><figcaption>{gallery[lightboxIndex].caption} · {lightboxIndex + 1} de {gallery.length}</figcaption></figure>
          <button className="bio-lightbox-arrow bio-lightbox-next" type="button" onClick={() => setLightboxIndex((lightboxIndex + 1) % gallery.length)} aria-label="Obra siguiente"><ArrowRight size={20} /></button>
        </div>
      </div>}
    </div>
  </section>;
}
// Video de ubicación en bucle, dirección y bandera de Pereira.
function LocationSection() {
  return <section className="location-banner" id="ubicacion">
    <video className="location-video" src={`${media}videodeubicacion.mp4`} autoPlay muted loop playsInline poster="/media/centro-lucy-tejada-fachada.jpg" aria-label="Recorrido por el Centro Cultural Lucy Tejada" />
    <div className="location-shade" />
    <div className="location-content lucy-wrap">
      <div>
        <p className="lucy-kicker">UBICACIÓN</p>
        <h2>Una esquina,<br /><em>muchas historias.</em></h2>
        <img className="pereira-flag" src="/media/bandera-pereira.png" alt="Bandera de Pereira" />
      </div>
      <p className="location-address">
        <MapPin size={22} fill="currentColor" />
        <span>
          <b>CARRERA 10 # 16–60</b>
          <small>Pereira · Risaralda</small>
        </span>
      </p>
    </div>
    <span className="location-caption">EL CENTRO DE LA CIUDAD, EL CORAZÓN DE LA CULTURA</span>
  </section>;
}
// Cuadrícula interactiva de disciplinas.
function ExploreSection() {
  return <section className="lucy-section lucy-art-bg explore-section" id="explora" style={{
    '--art-image': `url("${media}fondo-2-3.png")`
  } as CSSProperties}>
    <div className="lucy-wrap explore-grid">
      <div className="explore-intro">
        <p className="lucy-kicker">EXPLORA TU CAMINO</p>
        <h2>Encuentra tu<br />forma de crear.</h2>
        <p>Disciplinas para explorar, aprender y compartir. Cada proceso empieza con curiosidad.</p>
        <a className="explore-link" href="#programas">Ver programas <ArrowRight size={16} /></a>
      </div>
      <div className="discipline-grid">
        { disciplines.map(({ name, art, detail }, index) => <a className={`discipline-tile discipline-${index + 1}`} href="#programas" key={name}>
          <span className="discipline-index">0{index + 1}</span>
          <img src={`${media}${art}`} alt="" loading="lazy" />
          <span className="discipline-name">{ name }</span>
          <span className="discipline-detail">{ detail }</span>
          <span className="discipline-action">Explorar disciplina <b>↗</b></span>
        </a>) }
      </div>
    </div>
  </section>;
}
// Lista de programas que enlaza al acceso institucional.
function ProgramsSection() {
  return <section className="lucy-section lucy-art-bg programs-section" id="programas" style={{
    '--art-image': `url("${media}fondo1.png")`
  } as CSSProperties}>
    <div className="lucy-wrap">
      <div className="programs-heading">
        <div>
          <p className="lucy-kicker">APRENDER HACIENDO</p>
          <h2>Programas formativos</h2>
        </div>
        <span className="program-count"><b>04</b> DISPONIBLES</span>
      </div>
      <div className="program-list">
        { programs.map(([number, name, tag]) => <a className="program-row" href="/acceso" key={number}>
          <span className="program-number">{ number }</span>
          <span className="program-name">{ name }</span>
          <span className="program-tag">{ tag }</span>
          <ArrowUpRight className="program-arrow" size={20} />
        </a>) }
      </div>
    </div>
  </section>;
}
// Ensamble y orden vertical de toda la landing pública.
export default function LandingHost() {
  // El collage del hero acompaña suavemente el movimiento del puntero.
  // Se limita a mouse/trackpad; en móvil y con movimiento reducido queda quieto.
  const moveHeroArtwork = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    event.currentTarget.querySelectorAll<HTMLImageElement>('.hero-mosaic img').forEach((image, index) => {
      const depth = (index + 1) * 3;
      image.style.setProperty('--pointer-shift-x', `${-x * depth}px`);
      image.style.setProperty('--pointer-shift-y', `${-y * depth}px`);
    });
  };
  const resetHeroArtwork = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.querySelectorAll<HTMLImageElement>('.hero-mosaic img').forEach(image => {
      image.style.removeProperty('--pointer-shift-x');
      image.style.removeProperty('--pointer-shift-y');
    });
  };
  return <main className="lucy-landing" id="contenido-principal">
    <PublicNavigation homeHref="#inicio" eventsHref="#eventos" programsHref="#programas" />
    <div className="pillar-bar">
      { ['CULTURA', 'ARTE', 'TALENTO', 'IDENTIDAD'].map((pillar, index) => <span key={pillar} className={`pillar pillar-${index + 1}`}>
        { pillar }
      </span>) }
    </div>
    <section className="lucy-hero" id="inicio" onPointerMove={moveHeroArtwork} onPointerLeave={resetHeroArtwork}>
      <div className="hero-mosaic">
        <img src={`${media}igexport-DM9IvsoNstF-5 (1).jpg`} alt="" />
        <img src={`${media}collage3.png`} alt="" />
        <img src="/media/centro-lucy-tejada-fachada.jpg" alt="" />
        <img src={`${media}collage2.jpg`} alt="" />
      </div>
      <div className="hero-veil" />
      <div className="hero-title">
        <p className="lucy-kicker">PEREIRA · RISARALDA · COLOMBIA</p>
        <h1>VIVE EL<br /><em>ARTE</em></h1>
        <p>El corazón cultural de Pereira abierto<br className="desktop-break" /> para crear y compartir.</p>
        <a href="#eventos" className="hero-scroll">DESCUBRE LA CASA <ArrowDownRight size={17} /></a>
      </div>
      <span className="hero-side-note">UN LUGAR PARA TODAS LAS VOCES · 01—04</span>
    </section>
    <EventsSection />
    <InspirationSection />
    <LocationSection />
    <ExploreSection />
    <ProgramsSection />
    <section className="lucy-cta">
      <div className="lucy-wrap cta-inner">
        <div>
          <p className="lucy-kicker">¿YA ERES PARTE?</p>
          <h2>Tu espacio también<br />está aquí.</h2>
          <p>Consulta tus grupos, horarios y procesos formativos desde un solo lugar.</p>
        </div>
        <a href="/acceso" className="cta-button">Entrar a mi espacio <ArrowRight size={17} /></a>
        <img src={`${media}abrazo.svg`} alt="Comunidad de artistas reunida" loading="lazy" />
      </div>
    </section>
    <footer className="lucy-footer">
      <a className="footer-brand" href="#inicio">
        <img src={`${media}LOGO.svg`} alt="Centro Cultural Lucy Tejada" />
        <span>© 2026</span>
      </a>
      <div className="footer-hours">
        <b>Pereira, Risaralda</b>
        <span>Lunes a sábado · 9:00 a. m. a 4:00 p. m.</span>
      </div>
      <div className="footer-social">
        <a href="https://www.facebook.com/" aria-label="Facebook">
          <img src={`${media}logofb.svg`} alt="" />
        </a>
        <a href="https://www.instagram.com/" aria-label="Instagram">
          <img src={`${media}logoig.svg`} alt="" />
        </a>
      </div>
    </footer>
  </main>;
}
