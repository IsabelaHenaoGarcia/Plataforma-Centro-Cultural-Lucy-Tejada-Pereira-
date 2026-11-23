import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import './landing/landing.css';

// Destinos y etiqueta configurables sin añadir rutas a la navegación existente.
type PublicNavigationProps = {
  homeHref?: string;
  eventsHref?: string;
  programsHref?: string;
  accessHref?: string;
  accessLabel?: string;
  accessInitial?: string;
  palette?: 'landing' | 'pereira';
};

// Barra institucional compartida por la portada, acceso y espacio de gestión.
export default function PublicNavigation({
  homeHref = '/#inicio',
  eventsHref = '/#eventos',
  programsHref = '/#programas',
  accessHref = '/acceso',
  accessLabel = 'Acceso',
  accessInitial,
  palette = 'landing'
}: PublicNavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const priorFocus = useRef<HTMLElement | null>(null);
  const closeMenu = () => setMenuOpen(false);

  // Compacta la barra y actualiza el avance con el desplazamiento real de la página.
  useEffect(() => {
    let frame = 0;
    const updateScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        setIsCompact(window.scrollY > 24);
        setReadingProgress(maxScroll > 0 ? Math.min(100, Math.max(0, window.scrollY / maxScroll * 100)) : 0);
      });
    };
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, []);

  // Activa Eventos o Programas cuando su sección pasa por el área de lectura.
  useEffect(() => {
    const targets = [
      { key: 'events', href: eventsHref },
      { key: 'programs', href: programsHref }
    ].map(item => {
      try {
        const url = new URL(item.href, window.location.origin);
        return url.pathname === window.location.pathname && url.hash
          ? { key: item.key, element: document.getElementById(decodeURIComponent(url.hash.slice(1))) }
          : null;
      } catch { return null; }
    }).filter((item): item is { key: string; element: HTMLElement } => Boolean(item?.element));
    if (!targets.length || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      const current = entries.filter(entry => entry.isIntersecting)
        .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
      if (current) setActiveKey(targets.find(target => target.element === current.target)?.key || null);
    }, { rootMargin: '-22% 0px -62% 0px', threshold: [0, .15, .4, .7] });
    targets.forEach(target => observer.observe(target.element));
    return () => observer.disconnect();
  }, [eventsHref, programsHref]);

  // Mide el indicador pintado para que se deslice entre el enlace activo y el enfocado.
  useEffect(() => {
    const key = hoveredKey || activeKey;
    const anchor = key && navRef.current?.querySelector<HTMLElement>(`[data-nav-key="${key}"]`);
    if (!anchor || anchor.classList.contains('nav-access')) {
      setIndicator(current => current.width ? { ...current, width: 0 } : current);
      return;
    }
    setIndicator({ left: anchor.offsetLeft, width: anchor.offsetWidth });
  }, [activeKey, hoveredKey]);

  // El cajón bloquea el fondo, devuelve el foco al cerrar y admite Escape y Tab.
  useEffect(() => {
    if (!menuOpen) return;
    priorFocus.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => navRef.current?.querySelector<HTMLElement>('a[href]')?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeMenu(); return; }
      if (event.key !== 'Tab') return;
      const items = headerRef.current?.querySelectorAll<HTMLElement>('.mobile-menu, .nav-items a[href]');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (priorFocus.current?.isConnected) priorFocus.current.focus();
      else menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  const accessPath = new URL(accessHref, window.location.origin).pathname;
  const isAccessCurrent = accessPath === window.location.pathname;
  const indicatorKey = hoveredKey || activeKey;

  return <>
    <a className="nav-skip-link" href="#contenido-principal">Saltar al contenido</a>
    <header ref={headerRef} className={`lucy-nav${palette === 'pereira' ? ' lucy-nav-pereira' : ''}${isCompact ? ' is-compact' : ''}${menuOpen ? ' menu-open' : ''}`} id="header">
      <a className="lucy-brand" href={homeHref} aria-label="Centro Cultural Lucy Tejada, inicio">
        <img src="/media/lucy/LOGO.svg" alt="" />
        <span className="lucy-brand-name"><span>Centro Cultural</span><b>Lucy Tejada</b></span>
      </a>
      <button ref={menuButtonRef} className="mobile-menu" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(open => !open)}>
        {menuOpen ? <X size={23} /> : <Menu size={23} />}
      </button>
      {menuOpen && <button className="nav-scrim" type="button" aria-label="Cerrar menú" onClick={closeMenu} />}
      <nav ref={navRef} className={menuOpen ? 'nav-items is-open' : 'nav-items'} id="main-navigation" aria-label="Navegación principal">
        <img className="nav-drawer-art" src="/media/lucy/collage2.jpg" alt="" aria-hidden="true" />
        <a data-nav-key="events" aria-current={activeKey === 'events' ? 'location' : undefined} href={eventsHref} onClick={closeMenu} onFocus={() => setHoveredKey('events')} onBlur={() => setHoveredKey(null)} onMouseEnter={() => setHoveredKey('events')} onMouseLeave={() => setHoveredKey(null)}>Eventos</a>
        <a data-nav-key="programs" aria-current={activeKey === 'programs' ? 'location' : undefined} href={programsHref} onClick={closeMenu} onFocus={() => setHoveredKey('programs')} onBlur={() => setHoveredKey(null)} onMouseEnter={() => setHoveredKey('programs')} onMouseLeave={() => setHoveredKey(null)}>Programas</a>
        <a href={accessHref} className={`nav-access${isAccessCurrent ? ' is-current' : ''}`} aria-current={isAccessCurrent ? 'page' : undefined} onClick={closeMenu}>
          <span className="nav-access-label">{accessInitial ? 'Mi espacio' : accessLabel}</span>
          {accessInitial ? <span className="nav-user-initial" aria-hidden="true">{accessInitial.slice(0, 1).toLocaleUpperCase('es')}</span> : <ArrowUpRight className="nav-access-icon" size={19} aria-hidden="true" />}
        </a>
        {indicatorKey && <svg className="nav-active-stroke" aria-hidden="true" viewBox="0 0 120 12" preserveAspectRatio="none" style={{ left: indicator.left, width: indicator.width }}><path d="M3 8 C28 3, 51 10, 76 6 S104 5, 117 3" /></svg>}
        <img className="nav-drawer-mark" src="/media/lucy/LOGO.svg" alt="" aria-hidden="true" />
      </nav>
      <div className="nav-reading-track" aria-label={`Avance de lectura: ${Math.round(readingProgress)} por ciento`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(readingProgress)}>
        <span style={{ width: `${readingProgress}%` }} />
      </div>
    </header>
  </>;
}
