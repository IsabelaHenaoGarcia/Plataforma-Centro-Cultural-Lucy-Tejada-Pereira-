/*
 * MAPA DE ESTE ARCHIVO
 * 1. Cliente HTTP, sesión, tipos y datos de navegación.
 * 2. Landing y acceso.
 * 3. Dashboard y módulos administrativos.
 * 4. Recuperación, cambio de clave y páginas legales.
 * 5. Enrutador de módulos y rutas principales (App, al final).
 *
 * Los comentarios de cada bloque explican qué editar. Cambia el diseño en CSS;
 * cambia el comportamiento o los datos únicamente en el componente responsable.
 */

// React administra estado local y efectos; React Router resuelve las URLs.
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
// Iconos de línea y gráfico ya incluidos en el proyecto.
import {
  Archive, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen,
  CalendarClock, CalendarDays, Check, ChevronDown, CircleHelp, ClipboardCheck,
  Download, ExternalLink, Eye, FileDown, Filter, GraduationCap, ImagePlus,
  LayoutDashboard, LockKeyhole, LogIn, Mail, Menu, Music2, Palette, Pencil,
  Plus, RotateCcw, Search, Settings, ShieldCheck, Sparkles, Theater, Trash2,
  UserPlus, UserRound, Users, Wrench, X
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
// Axios es el cliente HTTP. Las vistas públicas y la navegación común viven aparte.
import axios, { type InternalAxiosRequestConfig } from 'axios';
import PublicNavigation from './components/PublicNavigation';
const LandingHost = lazy(() => import('./components/landing/LandingHost'));
// Axios, cookies CSRF y renovación de sesión compartidos por las pantallas.
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _pgcltRetry?: boolean;
  }
}
// Cliente HTTP: cambia VITE_API_URL en el .env para apuntar a otra API.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true
});
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('pgclt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// Lee el token CSRF de la cookie para acciones protegidas.
function csrfToken() {
  return document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('pgclt_csrf='))?.slice('pgclt_csrf='.length) || '';
}
api.interceptors.response.use(response => response, async error => {
  const request = error.config as InternalAxiosRequestConfig | undefined;
  const url = String(request?.url || '');
  if (error.response?.status !== 401 || !request || request._pgcltRetry || url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/recovery')) throw error;
  request._pgcltRetry = true;
  try {
    const {
      data
    } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, {
      withCredentials: true,
      headers: {
        'X-CSRF-Token': csrfToken()
      }
    });
    sessionStorage.setItem('pgclt_token', data.token);
    return api(request);
  } catch (refreshError) {
    sessionStorage.removeItem('pgclt_token');
    throw refreshError;
  }
});
// Formas de los datos principales que el frontend recibe del backend.
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
  mfaEnabled?: boolean;
};
type Program = {
  id: string;
  name: string;
  category: string;
  description?: string;
  _count?: {
    groups: number;
  };
};
// Tarjetas de disciplinas usadas dentro del portal.
const disciplines = [{
  icon: Music2,
  name: 'Música',
  tag: 'Escucha · ritmo · encuentro',
  tone: 'sage'
}, {
  icon: Theater,
  name: 'Teatro',
  tag: 'Cuerpo · voz · relato',
  tone: 'rose'
}, {
  icon: Palette,
  name: 'Artes plásticas',
  tag: 'Materia · imagen · forma',
  tone: 'gold'
}, {
  icon: Sparkles,
  name: 'Danza',
  tag: 'Movimiento · expresión',
  tone: 'blue'
}];
// ── Página pública y autenticación ──────────────────────────────────────────
// Entrada a la página pública. La maquetación vive en LandingHost.tsx.
function Landing() {
  return <Suspense fallback={<main className="page-loading">Cargando el Centro Cultural…</main>}><LandingHost /></Suspense>;
}
// Inicio de sesión: valida con la API y conserva el token en sessionStorage.
function Login({
  onLogin
}: {
  onLogin: (u: User) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const {
        data
      } = await api.post('/auth/login', {
        email,
        password,
        mfaCode: mfaCode || undefined
      });
      sessionStorage.setItem('pgclt_token', data.token);
      onLogin(data.user);
      nav(data.user.mustChangePassword ? '/cambiar-clave' : '/panel');
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'No fue posible conectar con el sistema.' : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }
  return <>
    <PublicNavigation palette="pereira" />
    <main className="login-page" id="contenido-principal">
      <div className="login-layout">
        <div className="login-art">
          <div className="login-circle" />
          <div className="login-blob" />
          <span className="login-note">APRENDER<br />EN COMUNIDAD</span>
          <div className="login-quote">“El arte como<br />punto de <em>encuentro.</em>”</div>
        </div>
        <div className="login-form-wrap">
          <span className="section-label">BIENVENIDA · BIENVENIDO</span>
          <h1>Qué bueno<br />tenerte <em>de vuelta.</em></h1>
          <p>Accede a tu espacio en el Centro Cultural.</p>
          <form onSubmit={submit}>
            <label>Correo electrónico<input type="email" required autoComplete="username" placeholder="nombre@correo.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Contraseña<input type="password" required autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={e => setPassword(e.target.value)} /></label>
            <label>Código de autenticación <small>(si activaste MFA)</small><input inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
            { error && <div className="error-box">
              { error }
            </div> }
            <button className="button button-ink full-button" disabled={loading}>
              { loading ? 'Ingresando…' : 'Ingresar a mi espacio' }
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="secure-note"><ShieldCheck size={16} /> Acceso protegido · Tus datos son privados</div>
          <Link className="back-link" to="/recuperar">¿Olvidaste tu contraseña?</Link>
          <Link className="back-link" to="/">← Volver al inicio</Link>
        </div>
      </div>
      <footer className="login-footer">CENTRO CULTURAL LUCY TEJADA · PEREIRA</footer>
    </main>
  </>;
}
// ── Panel autenticado ───────────────────────────────────────────────────────
// Opciones del menú interno; visibleNav filtra cada opción por rol.
const navItems = [{
  label: 'Resumen',
  icon: LayoutDashboard
}, {
  label: 'Estudiantes',
  icon: Users
}, {
  label: 'Programas',
  icon: BookOpen
}, {
  label: 'Matrículas',
  icon: ClipboardCheck
}, {
  label: 'Educadores',
  icon: GraduationCap
}, {
  label: 'Grupos y horarios',
  icon: CalendarDays
}, {
  label: 'Reportes',
  icon: FileDown
}, {
  label: 'Usuarios',
  icon: UserPlus
}, {
  label: 'Ajustes',
  icon: Settings
}, {
  label: 'Mantenimiento',
  icon: Wrench
}, {
  label: 'Mi espacio',
  icon: UserRound
}, {
  label: 'Mi cuenta',
  icon: Settings
}];
// Define qué espacios necesita cada rol y cuál es su pantalla de entrada.
// Las rutas y permisos del backend no cambian; esto solo organiza la interfaz.
const roleWorkspace: Record<string, { home: string; sections: string[] }> = {
  SUPER_ADMIN: { home: 'Resumen', sections: ['Resumen', 'Estudiantes', 'Programas', 'Matrículas', 'Educadores', 'Grupos y horarios', 'Reportes', 'Usuarios', 'Ajustes', 'Mantenimiento', 'Mi cuenta'] },
  ADMINISTRATIVO: { home: 'Resumen', sections: ['Resumen', 'Estudiantes', 'Programas', 'Matrículas', 'Educadores', 'Grupos y horarios', 'Reportes', 'Mantenimiento', 'Mi cuenta'] },
  COORDINADOR: { home: 'Resumen', sections: ['Resumen', 'Estudiantes', 'Programas', 'Matrículas', 'Grupos y horarios', 'Reportes', 'Mantenimiento', 'Mi cuenta'] },
  EDUCADOR: { home: 'Grupos y horarios', sections: ['Grupos y horarios', 'Reportes', 'Mantenimiento', 'Mi cuenta'] },
  JEFE_MANTENIMIENTO: { home: 'Mantenimiento', sections: ['Mantenimiento', 'Mi cuenta'] },
  TECNICO_MANTENIMIENTO: { home: 'Mantenimiento', sections: ['Mantenimiento', 'Mi cuenta'] },
  ESTUDIANTE: { home: 'Mi espacio', sections: ['Mi espacio', 'Programas', 'Mantenimiento', 'Mi cuenta'] },
  ACUDIENTE: { home: 'Mi espacio', sections: ['Mi espacio', 'Programas', 'Mantenimiento', 'Mi cuenta'] }
};
// Panel autenticado: resumen, menú lateral, métricas y áreas de trabajo.
function Dashboard({
  user,
  onLogout
}: {
  user: User;
  onLogout: () => void;
}) {
  const [metrics, setMetrics] = useState<any>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const allowedSections = roleWorkspace[user.role]?.sections || ['Mi cuenta'];
  const [section, setSection] = useState(roleWorkspace[user.role]?.home || 'Mi cuenta');
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const canViewStats = ['SUPER_ADMIN', 'ADMINISTRATIVO', 'COORDINADOR'].includes(user.role);
  useEffect(() => {
    if (canViewStats) {
      api.get('/dashboard').then(r => setMetrics(r.data)).catch(() => setMsg('No se pudo cargar la información. Comprueba que la API y PostgreSQL estén activos.'));
      api.get('/programs').then(r => setPrograms(r.data)).catch(() => {});
    }
    api.get('/notifications').then(r => setNotifications(r.data.items || [])).catch(() => {});
  }, []);
  const data = programs.slice(0, 5).map(p => ({
    name: p.name.split(' ')[0],
    grupos: p._count?.groups || 0
  }));
  const visibleNav = navItems.filter(item => allowedSections.includes(item.label));
  const navSections = [{
    title: 'INICIO',
    items: visibleNav.filter(item => ['Resumen', 'Mi espacio'].includes(item.label))
  }, {
    title: 'GESTIÓN CULTURAL',
    items: visibleNav.filter(item => ['Estudiantes', 'Programas', 'Matrículas', 'Educadores', 'Grupos y horarios', 'Reportes'].includes(item.label))
  }, {
    title: 'SISTEMA',
    items: visibleNav.filter(item => ['Mantenimiento', 'Usuarios', 'Ajustes', 'Mi cuenta'].includes(item.label))
  }].filter(group => group.items.length > 0);
  return <>
    <PublicNavigation accessHref="/panel" accessLabel="Mi espacio" accessInitial={user.name} palette="pereira" />
    <div className="dashboard" id="panel">
      <aside className={`sidebar ${menu ? 'open' : 'sidebar-collapsed'}`}>
        <Link to="/" className="brand side-brand">
          <img className="app-brand-image" src="/media/lucy/LOGO.svg" alt="" />
          <span>CENTRO CULTURAL<small>LUCY TEJADA · GESTIÓN</small></span>
        </Link>
        <div className="side-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Secciones del panel">
          { navSections.map(group => <div className="sidebar-nav-group" key={group.title}>
            <span className="sidebar-group-title">{group.title}</span>
            { group.items.map(item => <button key={item.label} title={item.label} aria-current={section === item.label ? 'page' : undefined} className={section === item.label ? 'active' : ''} onClick={() => {
              setSection(item.label);
              setMenu(false);
            }}>
              <item.icon size={19} strokeWidth={1.8} />
              <span className="sidebar-item-label">{item.label}</span>
              { item.label === 'Mantenimiento' && metrics?.metrics?.maintenance > 0 && <span className="nav-count">
                { metrics.metrics.maintenance }
              </span> }
            </button>) }
          </div>) }
        </nav>
        <div className="side-bottom">
          <img className="sidebar-art" src="/media/lucy/abrazo.svg" alt="" aria-hidden="true" width="150" height="100" loading="lazy" />
          <div className="help-box">
            <CircleHelp size={17} />
            <span>¿Necesitas ayuda?<small>Consulta la guía de uso</small></span>
            <ArrowUpRight size={14} />
          </div>
          <button className="user-card" title="Cerrar sesión" onClick={onLogout}>
            <span className="user-avatar">
              { user.name.charAt(0) }
            </span>
            <span>
              <b>
                { user.name }
              </b>
              <small>Cerrar sesión · {user.role.replaceAll('_', ' ')}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <main className="dash-main" id="contenido-principal">
        <header className="dash-top">
          <button className="menu-trigger" aria-label={menu ? 'Contraer menú' : 'Expandir menú'} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            { menu ? <X /> : <Menu /> }
          </button>
          <div className="crumb" aria-label={`Centro Cultural Lucy Tejada, ${section}`}><span>Centro Cultural</span><b aria-hidden="true">/</b><strong>{section}</strong></div>
          <div className="top-right">
            { canViewStats && <button aria-label="Ir a estudiantes" className="icon-button" onClick={() => setSection('Estudiantes')}>
              <Search size={18} />
            </button> }
            <button aria-label={`Notificaciones, ${notifications.filter(item => !item.readAt).length} sin leer`} aria-expanded={showNotifications} className="icon-button notification" onClick={() => setShowNotifications(value => !value)}>
              <Bell size={18} />
              {notifications.some(item => !item.readAt) && <i />}
            </button>
            {showNotifications && <div className="dashboard-notifications" role="region" aria-label="Notificaciones recientes">
              <div className="panel-head"><h2>Notificaciones</h2><button className="quiet-link" onClick={async () => { await api.post('/notifications/read-all'); const r = await api.get('/notifications'); setNotifications(r.data.items || []); }}>Marcar todas leídas</button></div>
              {notifications.slice(0, 6).map(item => <button className={`dashboard-notification ${item.readAt ? '' : 'unread'}`} key={item.id} onClick={async () => { if (!item.readAt) await api.patch(`/notifications/${item.id}/read`); const r = await api.get('/notifications'); setNotifications(r.data.items || []); }}>
                <b>{item.title}</b><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString('es-CO')}</small>
              </button>)}
              {!notifications.length && <p className="empty-inline">No tienes novedades por ahora.</p>}
            </div>}
            <span className="top-avatar">
              { user.name.charAt(0) }
            </span>
          </div>
        </header>
        <section className="dash-content">
          { section !== 'Resumen' ? <WorkspaceRouter section={section} role={user.role} user={user} /> : <>
            <div className="dash-title dash-title-home">
              <div className="dash-hero-copy">
                <span className="section-label">PEREIRA · RISARALDA <b className="hero-index">01 — GESTIÓN CULTURAL</b></span>
                <h1>Un nuevo día para crear,<br /><em>aprender y encontrarnos.</em></h1>
                <p>Este es el pulso de tu comunidad, {user.name.toUpperCase() === 'SUPER ADMIN' ? 'equipo administrativo' : user.name.split(' ')[0]}.</p>
              </div>
              <button className="button button-ink" onClick={() => setSection('Programas')}>Gestionar programas <ArrowUpRight size={17} /></button>
              <img className="dash-hero-art" src="/media/lucy/BIOGRAFIAimg1.svg" alt="" aria-hidden="true" width="290" height="260" loading="lazy" />
            </div>
            { msg && <div className="notice">
              <span>
                { msg }
              </span>
              <button onClick={() => setMsg('')}>
                <X size={15} />
              </button>
            </div> }
            <div className="metric-grid">
              { [{
                label: 'Estudiantes activos',
                key: 'students',
                icon: GraduationCap
              }, {
                label: 'Matrículas activas',
                key: 'enrollments',
                icon: Check
              }, {
                label: 'Programas activos',
                key: 'programs',
                icon: Palette
              }, {
                label: 'Grupos formativos',
                key: 'groups',
                icon: Users,
                empty: 'Aún no hay grupos creados'
              }, {
                label: 'Seguimientos cualitativos',
                key: 'evaluations',
                icon: ClipboardCheck,
                empty: 'Aún no hay evaluaciones registradas'
              }, {
                label: 'Matrículas retiradas',
                key: 'withdrawn',
                icon: RotateCcw,
                empty: 'No hay retiros registrados'
              }].map((m, i) => <article className={`metric-card metric-${i}`} key={m.key}>
                <div className="metric-top">
                  <span>
                    { m.label }
                  </span>
                  <m.icon size={21} strokeWidth={1.8} />
                </div>
                <strong>
                  { metrics?.metrics?.[m.key] === 0 ? <span className="metric-zero-state">Aún sin registros</span> : metrics?.metrics?.[m.key] ?? '—' }
                </strong>
                <span className="metric-foot">
                  { metrics?.metrics?.[m.key] === 0 ? m.empty : canViewStats ? metrics ? 'Información actualizada desde el sistema' : 'Cargando información del sistema…' : 'Indicador según tu perfil de acceso' }
                </span>
              </article>) }
            </div>
            <div className="dash-grid">
              <article className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">ACTIVIDAD FORMATIVA</span>
                    <h2>Programas y grupos</h2>
                  </div>
                  <span className="filter-button">Vista general</span>
                </div>
                { data.some(item => item.grupos > 0) ? <ResponsiveContainer width="100%" height={310}>
                  <BarChart data={data} margin={{
                      top: 22,
                      right: 14,
                      left: -12,
                      bottom: 8
                  }}>
                    <CartesianGrid vertical={false} stroke="#e7dfd1" strokeDasharray="4 6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
                      fill: '#625c52',
                      fontSize: 13
                    }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{
                      fill: '#625c52',
                      fontSize: 13
                    }} />
                    <Tooltip cursor={{ fill: '#f5efdf' }} contentStyle={{ borderRadius: 12, borderColor: '#ddd3c2', background: '#fffdf8', fontSize: 14 }} labelStyle={{ color: '#302d28', fontWeight: 700 }} itemStyle={{ color: '#785617' }} />
                    <Bar dataKey="grupos" fill="var(--dash-terracotta)" radius={[8, 8, 0, 0]} maxBarSize={54}>
                      <LabelList dataKey="grupos" position="top" fill="#3f382f" fontSize={13} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer> : <div className="chart-empty">
                  <img className="empty-art" src="/media/lucy/abrazo.svg" alt="" aria-hidden="true" width="150" height="100" loading="lazy" />
                  <span className="chart-empty-kicker">UN PRIMER PASO</span>
                  <b>Tu comunidad empieza aquí.</b>
                  <p>Aún no hay grupos con actividad. Cuando inicies un proceso formativo, sus datos aparecerán en este espacio.</p>
                </div> }
              </article>
              <article className="panel quick-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">ACCESOS DIRECTOS</span>
                    <h2>¿Qué necesitas hacer?</h2>
                  </div>
                </div>
                <div className="quick-links">
                  <button onClick={() => setSection('Estudiantes')}>
                    <span className="quick-icon clay-bg">
                      <Users size={18} />
                    </span>
                    <span>
                    <b>Registrar estudiante</b>
                      <small>Agregar a la comunidad</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                  <button onClick={() => setSection('Programas')}>
                    <span className="quick-icon sage-bg">
                      <BookOpen size={18} />
                    </span>
                    <span>
                      <b>Ver programas</b>
                      <small>Explorar oferta formativa</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                  <button onClick={() => setSection('Mantenimiento')}>
                    <span className="quick-icon gold-bg">
                      <Wrench size={18} />
                    </span>
                    <span>
                      <b>Solicitudes de mantenimiento</b>
                      <small>Revisar espacios y escenarios</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
            </div>
            <div className="bottom-grid">
              <article className="panel activity-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">COMUNIDAD</span>
                    <h2>Programas formativos</h2>
                  </div>
                  <button className="quiet-link" onClick={() => setSection('Programas')}>Ver todos <ArrowRight size={14} /></button>
                </div>
                { programs.length ? programs.slice(0, 4).map((p, i) => <div className="program-mini" key={p.id}>
                  <span className={`mini-icon tone-${i % 4}`}>
                    { [<Music2 />, <Theater />, <Palette />, <Sparkles />][i % 4] }
                  </span>
                  <span>
                    <b>
                      { p.name }
                    </b>
                    <small><span className="program-category">{p.category}</span><span>{p._count?.groups || 0} grupos</span></small>
                  </span>
                  <ArrowUpRight size={15} />
                </div>) : <div className="empty-inline">Conecta el servidor para consultar programas.</div> }
              </article>
              <article className="quote-panel">
                <span className="quote-mark">“</span>
                <p>La cultura es el lugar donde una comunidad se reconoce y se imagina de nuevo.</p>
                <span>UN ESPACIO PARA CREAR EN COMUNIDAD</span>
                <img className="quote-art" src="/media/lucy/abrazo.svg" alt="" aria-hidden="true" width="230" height="230" loading="lazy" />
              </article>
            </div>
            <footer className="dash-footer">PGC-LT · CULTURA QUE NOS ENCUENTRA <span>Centro Cultural Lucy Tejada · Pereira</span></footer>
          </> }
        </section>
      </main>
    </div>
  </>;
}
// ── Módulos de trabajo del panel ────────────────────────────────────────────
// Encabezado reutilizable de cada módulo del panel.
function ModuleHeading({
  label,
  title,
  description
}: {
  label: string;
  title: string;
  description: string;
}) {
  return <div className="dash-title module-heading">
    <div>
      <span className="section-label">
        { label }
      </span>
      <h1>
        { title }
      </h1>
      <p>
        { description }
      </p>
    </div>
  </div>;
}
function ModuleNotice({
  error,
  notice,
  clear
}: {
  error: string;
  notice: string;
  clear: () => void;
}) {
  return <>
    { notice && <div className="notice success-note">
      { notice }
      <button onClick={clear}>
        <X size={15} />
      </button>
    </div> }
    { error && <div className="notice">
      { error }
      <button onClick={clear}>
        <X size={15} />
      </button>
    </div> }
  </>;
}
// Módulo: solicitudes de matrícula y registro.
function EnrollmentWorkspace() {
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [studentId, setStudentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('PENDING');
  async function load() {
    try {
      const [e, s, p, g] = await Promise.all([api.get('/enrollments', {
        params: {
          status
        }
      }), api.get('/students'), api.get('/programs'), api.get('/groups')]);
      setRows(e.data.items);
      setStudents(s.data.items);
      setPrograms(p.data);
      setGroups(g.data);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudieron cargar las matrículas.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, [status]);
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/enrollments', {
        studentId,
        programId,
        groupId: groupId || undefined
      });
      setNotice('Solicitud de matrícula guardada como pendiente.');
      setStudentId('');
      setGroupId('');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo registrar la matrícula.' : 'Error de conexión.');
    }
  }
  async function decide(id: string, next: string) {
    try {
      await api.patch(`/enrollments/${id}/status`, {
        status: next
      });
      setNotice(next === 'ACTIVE' ? 'Matrícula aprobada y notificamos a la comunidad.' : 'Solicitud rechazada.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo actualizar.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label="GESTIÓN ACADÉMICA · MATRÍCULAS" title="Inscripciones y matrículas" description="Revisa solicitudes, cupos y grupos desde el registro central." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="module-toolbar">
      <label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="PENDING">Pendientes</option><option value="ACTIVE">Activas</option><option value="REJECTED">Rechazadas</option><option value="WITHDRAWN">Retiradas</option></select></label>
      <button className="quiet-link" onClick={load}>Actualizar <RotateCcw size={14} /></button>
    </div>
    <div className="workspace-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">SOLICITUDES</span>
            <h2>{rows.length} registros</h2>
          </div>
        </div>
        <div className="student-table">
          <div className="table-header table-enrollment">
            <span>ESTUDIANTE</span>
            <span>PROGRAMA / GRUPO</span>
            <span>ESTADO</span>
            <span>ACCIÓN</span>
          </div>
          { rows.map((r: any) => <div className="table-row table-enrollment" key={r.id}>
            <span>
              <b>
                {r.student.firstName} {r.student.lastName}
              </b>
              <small>{r.student.documentType}: {r.student.documentNumber}</small>
            </span>
            <span>
              <b>{r.program.name}</b>
              <small>
                { r.group?.name || 'Grupo pendiente' }
              </small>
            </span>
            <span>
              <em className={`status-pill status-${r.status.toLowerCase()}`}>
                { r.status }
              </em>
            </span>
            <span>
              { r.status === 'PENDING' ? <div className="row-actions">
                <button title="Aprobar" onClick={() => decide(r.id, 'ACTIVE')}>
                  <Check size={15} />
                </button>
                <button title="Rechazar" onClick={() => decide(r.id, 'REJECTED')}>
                  <X size={15} />
                </button>
              </div> : <span className="empty-inline">—</span> }
            </span>
          </div>) }
          { !rows.length && <p className="empty-inline">No hay solicitudes con este estado.</p> }
        </div>
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">REGISTRO</span>
            <h2>Nueva solicitud</h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={create}>
          <label>Estudiante<select required value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Selecciona</option>{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.documentNumber}</option>)}</select></label>
          <label>Programa<select required value={programId} onChange={e => {
              setProgramId(e.target.value);
              setGroupId('');
            }}><option value="">Selecciona</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Grupo<select value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">Asignar después</option>{groups.filter(g => g.programId === programId).map(g => <option key={g.id} value={g.id}>{g.name} · {g._count?.students || 0}/{g.capacity || '∞'}</option>)}</select></label>
          <button className="button button-ink">Registrar solicitud <ArrowRight size={16} /></button>
        </form>
      </article>
    </div>
  </>;
}
// Módulo de trabajo para educadores.
function EducatorWorkspace() {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState('');
  const [roster, setRoster] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState('');
  const [studentId, setStudentId] = useState('');
  const [observations, setObservations] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function loadGroups() {
    try {
      const r = await api.get('/groups');
      setGroups(r.data);
      if (!groupId && r.data[0]) setGroupId(r.data[0].id);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se cargaron tus grupos.' : 'Error de conexión.');
    }
  }
  async function loadGroup() {
    if (!groupId) return;
    try {
      const [r, h] = await Promise.all([api.get(`/groups/${groupId}/roster`), api.get(`/groups/${groupId}/attendance`)]);
      setRoster(r.data.map((item: any) => item.student));
      setHistory(h.data);
      setStatus(Object.fromEntries(r.data.map((item: any) => [item.studentId, 'PRESENTE'])));
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se cargó el grupo.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    loadGroups();
  }, []);
  useEffect(() => {
    loadGroup();
  }, [groupId]);
  async function saveAttendance(e: FormEvent) {
    e.preventDefault();
    try {
      const records = roster.map(s => ({
        studentId: s.id,
        status: status[s.id] || 'PRESENTE'
      }));
      const {
        data
      } = await api.post('/attendance', {
        groupId,
        date,
        records
      });
      setNotice(`Asistencia guardada para ${data.saved} estudiantes.`);
      loadGroup();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo guardar la asistencia.' : 'Error de conexión.');
    }
  }
  async function saveEvaluation(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/evaluations', {
        studentId,
        groupId,
        period,
        observations
      });
      setNotice('Evaluación cualitativa guardada.');
      setObservations('');
      loadGroup();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo guardar la evaluación.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label="ESPACIO DOCENTE · ASISTENCIA Y PROCESOS" title="Mis grupos" description="Toma asistencia por sesión y registra observaciones formativas." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="module-toolbar">
      <label>Grupo<select value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">Selecciona un grupo</option>{groups.map(g => <option value={g.id} key={g.id}>{g.name} · {g.program?.name}</option>)}</select></label>
      <span>{roster.length} estudiantes activos</span>
    </div>
    { groupId && <div className="workspace-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">CONTROL DE ASISTENCIA</span>
            <h2>Sesión del día</h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={saveAttendance}>
          <label>Fecha<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
          <div className="attendance-list">
            { roster.map(s => <label className="attendance-row" key={s.id}>
              <span>
                <b>
                  {s.firstName} {s.lastName}
                </b>
                <small>Documento {s.documentType}: {s.documentNumber}</small>
              </span>
              <select value={status[s.id] || 'PRESENTE'} onChange={e => setStatus({
                ...status,
                [s.id]: e.target.value
              })}>
                <option value="PRESENTE">Presente</option>
                <option value="AUSENTE">Ausente</option>
                <option value="TARDANZA">Tardanza</option>
                <option value="JUSTIFICADO">Justificado</option>
              </select>
            </label>) }
          </div>
          <button className="button button-ink" disabled={!roster.length}>Guardar asistencia <Check size={16} /></button>
        </form>
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">EVALUACIÓN CUALITATIVA</span>
            <h2>Observación de proceso</h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={saveEvaluation}>
          <label>Estudiante<select required value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Selecciona</option>{roster.map(s => <option value={s.id} key={s.id}>{s.firstName} {s.lastName}</option>)}</select></label>
          <label>Periodo<input required minLength={2} value={period} onChange={e => setPeriod(e.target.value)} placeholder="Ej. Ciclo 1 — 2026" /></label>
          <label>Observación<textarea required minLength={2} maxLength={3000} rows={5} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Describe avances, preguntas y procesos artísticos…" /></label>
          <button className="button button-ink">Guardar evaluación <Check size={16} /></button>
        </form>
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">HISTORIAL</span>
            <h2>Sesiones recientes</h2>
          </div>
        </div>
        { history.map(session => <div className="program-mini" key={session.id}>
          <span className="mini-icon tone-2">
            <CalendarDays size={15} />
          </span>
          <span>
            <b>
              { new Date(`${session.date.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', {
                dateStyle: 'medium'
              }) }
            </b>
            <small className="record-fact"><b>Asistencia</b>{session.records.filter((r: any) => r.status === 'PRESENTE').length} de {session.records.length} presentes</small>
          </span>
        </div>) }
        { !history.length && <p className="empty-inline">Todavía no hay sesiones guardadas.</p> }
      </article>
    </div> }
  </>;
}
// Vista personal para estudiantes y acudientes.
function MyPortal() {
  const [data, setData] = useState<any>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [consent, setConsent] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      const [p, program, notices] = await Promise.all([api.get('/me/profile'), api.get('/programs'), api.get('/notifications')]);
      setData(p.data);
      setPrograms(program.data);
      setNotifications(notices.data.items);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo cargar tu espacio.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function request(e: FormEvent) {
    e.preventDefault();
    try {
      if (own) await api.post('/my/enrollments', {
        programId,
        consent
      });else await api.post('/my/guardian-enrollments', {
        programId,
        studentId,
        consent
      });
      setNotice('Solicitud enviada para revisión.');
      setProgramId('');
      setStudentId('');
      setConsent(false);
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo enviar la solicitud.' : 'Error de conexión.');
    }
  }
  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }
  async function revokeConsent(id: string) {
    try {
      await api.post(`/my/consents/${id}/revoke`);
      setNotice('Se registró tu solicitud de revocación del consentimiento.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo registrar la revocación.' : 'Error de conexión.');
    }
  }
  const profile = data?.profile;
  const own = data?.type === 'student';
  const studentList = own ? profile ? [profile] : [] : profile?.students?.map((row: any) => row.student) || [];
  return <>
    <ModuleHeading label="TU ESPACIO · CENTRO CULTURAL" title={own ? 'Tu camino artístico' : 'Acompañamiento familiar'} description="Consulta tus inscripciones, horarios, asistencia y novedades." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="portal-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">PROCESOS FORMATIVOS</span>
            <h2>
              { own ? 'Mis matrículas' : 'Estudiantes a tu cargo' }
            </h2>
          </div>
        </div>
        { studentList.map((student: any) => <div className="portal-student" key={student.id}>
          <div className="portal-student-head">
            <span className="user-avatar">
              { student.firstName[0] }
            </span>
            <span>
              <b>
                {student.firstName} {student.lastName}
              </b>
              <small>
                { student.neighborhood || 'Comunidad PGC-LT' }
              </small>
            </span>
          </div>
          { student.enrollments?.map((enrollment: any) => <div className="program-mini" key={enrollment.id}>
            <span className="mini-icon tone-2">
              <BookOpen size={15} />
            </span>
            <span>
              <b>
                { enrollment.program.name }
              </b>
              <small className="record-fact"><b>Estado</b><em className={`status-pill status-${enrollment.status.toLowerCase()}`}>{enrollment.status}</em></small>
              <small className="record-fact"><b>Grupo</b>{enrollment.group?.name || 'Por asignar'}</small>
              {enrollment.group?.teacher && <small className="record-fact"><b>Educador</b>{enrollment.group.teacher.name}</small>}
              {enrollment.group?.classroom && <small className="record-fact"><b>Salón</b>{enrollment.group.classroom.name}</small>}
              {enrollment.group?.schedules?.map((schedule: any) => <small className="record-fact" key={schedule.id}><b>Horario</b>{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][schedule.weekday]}, {schedule.startTime}–{schedule.endTime}</small>)}
            </span>
          </div>) }
          { student.attendance?.length > 0 && <div className="portal-attendance">
            <b>Asistencia reciente</b>
            { student.attendance.slice(0, 5).map((r: any) => <span className="portal-fact" key={r.id}><b>{new Date(`${String(r.session?.date).slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO')}</b><em className={`status-pill status-${r.status.toLowerCase()}`}>{r.status}</em></span>) }
          </div> }
          {student.evaluations?.length > 0 && <div className="portal-attendance">
            <b>Progreso cualitativo</b>
            {student.evaluations.slice(0, 3).map((evaluation: any) => <span className="portal-evaluation" key={evaluation.id}><b>{evaluation.period}</b><small>{evaluation.group?.name}</small><span>{evaluation.observations}</span></span>)}
          </div>}
          {student.consents?.length > 0 && <div className="portal-attendance">
            <b>Autorizaciones de tratamiento</b>
            {student.consents.map((record: any) => <span className="consent-record" key={record.id}>
              {record.revokedAt ? 'Revocada' : 'Activa'} · {new Date(record.createdAt).toLocaleDateString('es-CO')} · {record.purpose}
              {!record.revokedAt && ['student', 'guardian'].includes(data?.type) && <button type="button" className="quiet-link" onClick={() => revokeConsent(record.id)}>Revocar autorización</button>}
            </span>)}
          </div>}
          { !student.enrollments?.length && <p className="empty-inline">Aún no hay matrículas registradas.</p> }
        </div>) }
        { !studentList.length && <p className="empty-inline">El perfil aún no está vinculado. Contacta a administración para actualizar el registro.</p> }
      </article>
      <div className="portal-side">
        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">DESCUBRE</span>
              <h2>Solicitar una inscripción</h2>
            </div>
          </div>
          <form className="workspace-form" onSubmit={request}>
            { !own && <label>Estudiante<select required value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Selecciona estudiante</option>{studentList.map((s: any) => <option value={s.id} key={s.id}>{s.firstName} {s.lastName}</option>)}</select></label> }
            <label>Programa<select required value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Selecciona</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name} · {p.category}</option>)}</select></label>
            <div className="consent-check"><input id="enrollmentConsent" type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><label htmlFor="enrollmentConsent">{own ? 'Autorizo el tratamiento de mis datos para gestionar esta inscripción.' : 'Como acudiente, autorizo el tratamiento de los datos del estudiante para gestionar esta inscripción.'}</label><Link to="/privacidad">Leer aviso de privacidad</Link></div>
            <button className="button button-ink">Enviar solicitud <ArrowRight size={16} /></button>
          </form>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">AVISOS</span>
              <h2>Notificaciones</h2>
            </div>
            <button className="quiet-link" onClick={async () => {
              await api.post('/notifications/read-all');
              load();
            }}>Marcar leídas</button>
          </div>
          { notifications.map(n => <button className="notification-row" key={n.id} onClick={() => markRead(n.id)}>
            <span className={n.readAt ? 'notice-dot read' : 'notice-dot'} />
            <span>
              <b>
                { n.title }
              </b>
              <small>{n.body} · {new Date(n.createdAt).toLocaleDateString('es-CO')}</small>
            </span>
          </button>) }
          { !notifications.length && <p className="empty-inline">No tienes notificaciones nuevas.</p> }
        </article>
      </div>
    </div>
  </>;
}
// Módulo de grupos, cupos y horarios.
function GroupsWorkspace() {
  const [groups, setGroups] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [programId, setProgramId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [capacity, setCapacity] = useState('');
  const [weekday, setWeekday] = useState('1');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:30');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      const [g, p, t, c] = await Promise.all([api.get('/groups'), api.get('/programs'), api.get('/teachers'), api.get('/classrooms')]);
      setGroups(g.data);
      setPrograms(p.data);
      setTeachers(t.data);
      setClassrooms(c.data);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo cargar la configuración.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/groups', {
        name,
        programId,
        teacherId: teacherId || null,
        classroomId: classroomId || null,
        capacity: capacity ? Number(capacity) : undefined,
        schedules: [{
          weekday: Number(weekday),
          startTime,
          endTime
        }]
      });
      setName('');
      setNotice('Grupo y horario guardados.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo crear el grupo.' : 'Error de conexión.');
    }
  }
  async function toggle(group: any) {
    try {
      await api.patch(`/groups/${group.id}/active`, {
        active: !group.active
      });
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo actualizar el grupo.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label="PROGRAMACIÓN ACADÉMICA" title="Grupos y horarios" description="Organiza programas, educadores, salones y disponibilidad semanal." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="workspace-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">GRUPOS</span>
            <h2>{groups.filter(g => g.active).length} activos</h2>
          </div>
          <button className="quiet-link" onClick={load}>Actualizar <RotateCcw size={14} /></button>
        </div>
        { groups.map(g => <div className="program-mini" key={g.id}>
          <span className={`mini-icon ${g.active ? 'tone-2' : 'tone-1'}`}>
            <CalendarDays size={15} />
          </span>
          <span>
            <b>
              { g.name }
              <small className="inline-status">
                { g.active ? 'ACTIVO' : 'INACTIVO' }
              </small>
            </b>
            <small className="record-fact"><b>Programa</b>{g.program?.name || 'Sin programa'}</small>
            <small className="record-fact"><b>Educador</b>{g.teacher?.name || 'Por asignar'}</small>
            <small className="record-fact"><b>Salón</b>{g.classroom?.name || 'Por asignar'}</small>
            <small className="record-fact"><b>Cupos</b>{g._count?.students || 0} de {g.capacity || 'sin límite'}</small>
            <small>
              { g.schedules?.map((s: any) => `${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][s.weekday]} ${s.startTime}–${s.endTime}`).join(' · ') || 'Horario pendiente' }
            </small>
          </span>
          <button className="row-icon" title={g.active ? 'Desactivar' : 'Activar'} onClick={() => toggle(g)}>
            { g.active ? <X size={15} /> : <Check size={15} /> }
          </button>
        </div>) }
        { !groups.length && <p className="empty-inline">Aún no hay grupos configurados.</p> }
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">NUEVO GRUPO</span>
            <h2>Crear grupo formativo</h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={create}>
          <label>Nombre<input required value={name} onChange={e => setName(e.target.value)} placeholder="Danza — nivel inicial" /></label>
          <label>Programa<select required value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Selecciona</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Educador<select value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">Por asignar</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name} · {t.specialty}</option>)}</select></label>
          <label>Salón<select value={classroomId} onChange={e => setClassroomId(e.target.value)}><option value="">Por asignar</option>{classrooms.map(c => <option key={c.id} value={c.id}>{c.name} · {c.venue?.name}</option>)}</select></label>
          <label>Cupo<input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
          <div className="form-split">
            <label>Día<select value={weekday} onChange={e => setWeekday(e.target.value)}>{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((d, i) => <option value={i} key={d}>{d}</option>)}</select></label>
            <label>Inicio<input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
            <label>Fin<input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} /></label>
          </div>
          <button className="button button-ink">Crear grupo y validar horario <Check size={16} /></button>
        </form>
      </article>
    </div>
  </>;
}
// Administración de educadores.
function TeachersWorkspace() {
  const [rows, setRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [editId, setEditId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      const [t, a] = await Promise.all([api.get('/teachers'), api.get('/users/candidates', {
        params: {
          role: 'EDUCADOR'
        }
      })]);
      setRows(t.data);
      setAccounts(a.data);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudieron cargar educadores.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      specialty,
      email: email || undefined,
      phone: phone || undefined,
      userId: userId || undefined
    };
    try {
      if (editId) await api.patch(`/teachers/${editId}`, payload);else await api.post('/teachers', payload);
      setName('');
      setSpecialty('');
      setEmail('');
      setPhone('');
      setUserId('');
      setEditId('');
      setNotice('Educador guardado y cuenta vinculada.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo guardar.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label="EQUIPO FORMATIVO" title="Educadores" description="Gestiona especialidades, canales de contacto y cuentas de acceso." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="workspace-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">DIRECTORIO</span>
            <h2>{rows.length} educadores activos</h2>
          </div>
        </div>
        { rows.map(t => <div className="program-mini" key={t.id}>
          <span className="mini-icon tone-2">
            <GraduationCap size={15} />
          </span>
          <span>
            <b>
              { t.name }
            </b>
            <small className="record-fact"><b>Especialidad</b>{t.specialty}</small>
            <small className="record-fact"><b>Grupos</b>{t.groups?.length || 0}</small>
            <small className="record-fact"><b>Cuenta</b>{t.user?.email || 'Sin cuenta vinculada'}</small>
            <small className="record-fact"><b>Contacto</b>{[t.email, t.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</small>
          </span>
          <button className="row-icon" title="Editar" onClick={() => {
            setEditId(t.id);
            setName(t.name);
            setSpecialty(t.specialty);
            setEmail(t.email || '');
            setPhone(t.phone || '');
            setUserId(t.userId || '');
          }}>
            <Pencil size={14} />
          </button>
        </div>) }
        { !rows.length && <p className="empty-inline">No hay educadores registrados.</p> }
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">
              { editId ? 'EDITAR PERFIL' : 'NUEVO PERFIL' }
            </span>
            <h2>
              { editId ? 'Actualizar educador' : 'Registrar educador' }
            </h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={save}>
          <label>Nombre<input required value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Especialidad<input required value={specialty} onChange={e => setSpecialty(e.target.value)} /></label>
          <label>Correo<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Teléfono<input value={phone} onChange={e => setPhone(e.target.value)} /></label>
          <label>Cuenta del educador<select value={userId} onChange={e => setUserId(e.target.value)}><option value="">Sin cuenta vinculada</option>{accounts.map(a => <option value={a.id} key={a.id}>{a.name} · {a.email}</option>)}</select></label>
          <div className="row-actions">
            <button className="button button-ink">Guardar educador <Check size={15} /></button>
            { editId && <button type="button" className="quiet-link" onClick={() => {
              setEditId('');
              setName('');
              setSpecialty('');
              setEmail('');
              setPhone('');
              setUserId('');
            }}>Cancelar</button> }
          </div>
        </form>
      </article>
    </div>
  </>;
}
// Reportes e indicadores para los roles autorizados.
function ReportsWorkspace() {
  const [kind, setKind] = useState('students');
  const [format, setFormat] = useState('xlsx');
  const [programs, setPrograms] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [programId, setProgramId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [gender, setGender] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    api.get('/programs').then(r => setPrograms(r.data));
    api.get('/groups').then(r => setGroups(r.data)).catch(() => {});
  }, []);
  async function exportReport(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.get(`/reports/${kind}`, {
        params: {
          format,
          programId: programId || undefined,
          groupId: groupId || undefined,
          neighborhood: neighborhood || undefined,
          originCity: originCity || undefined,
          gender: gender || undefined,
          from: from || undefined,
          to: to || undefined
        },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pgclt-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice('Reporte generado desde los registros disponibles.');
    } catch (e) {
      setError(axios.isAxiosError(e) ? 'No se pudo generar el reporte con los filtros seleccionados.' : 'Error al exportar.');
    } finally {
      setBusy(false);
    }
  }
  return <>
    <ModuleHeading label="ANÁLISIS · INFORMACIÓN INSTITUCIONAL" title="Reportes y exportaciones" description="Aplica filtros y descarga archivos generados desde los datos guardados." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="workspace-grid">
      <article className="panel report-intro">
        <span className="report-art">
          <FileDown size={28} />
        </span>
        <span className="section-label">EXPORTACIÓN SEGURA</span>
        <h2>Una lectura clara<br />de la actividad.</h2>
        <p>Los resultados se limitan según tu rol. Los documentos reflejan únicamente información presente en la plataforma.</p>
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">CONFIGURAR</span>
            <h2>Preparar descarga</h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={exportReport}>
          <label>Tipo de reporte<select value={kind} onChange={e => setKind(e.target.value)}><option value="students">Estudiantes y matrícula</option><option value="enrollments">Inscripciones</option><option value="attendance">Asistencia</option><option value="maintenance">Mantenimiento</option></select></label>
          <label>Formato<select value={format} onChange={e => setFormat(e.target.value)}><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF</option><option value="csv">CSV</option></select></label>
          { kind !== 'maintenance' && <>
            <label>Programa<select value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Todos</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Grupo<select value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">Todos</option>{groups.filter(g => !programId || g.programId === programId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          </> }
          {kind === 'students' && <>
            <label>Barrio<input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Todos los barrios" /></label>
            <label>Ciudad de origen<input value={originCity} onChange={e => setOriginCity(e.target.value)} placeholder="Todas las ciudades" /></label>
            <label>Género registrado<select value={gender} onChange={e => setGender(e.target.value)}><option value="">Todos</option><option value="Mujer">Mujer</option><option value="Hombre">Hombre</option><option value="No binario">No binario</option><option value="Prefiere no decirlo">Prefiere no decirlo</option></select></label>
          </>}
          <div className="form-split">
            <label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          </div>
          <button className="button button-ink" disabled={busy}>
            { busy ? 'Preparando…' : 'Descargar reporte' }
            <Download size={16} />
          </button>
        </form>
      </article>
    </div>
  </>;
}
// Solicitudes y seguimiento de mantenimiento.
function MaintenanceWorkspace({
  role
}: {
  role: string;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [preventive, setPreventive] = useState<any[]>([]);
  const [venueId, setVenueId] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('CORRECTIVO');
  const [urgency, setUrgency] = useState('MEDIA');
  const [description, setDescription] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [destination, setDestination] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [asset, setAsset] = useState('ASCENSOR');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isLead = ['SUPER_ADMIN', 'JEFE_MANTENIMIENTO'].includes(role);
  const isTech = ['SUPER_ADMIN', 'JEFE_MANTENIMIENTO', 'TECNICO_MANTENIMIENTO'].includes(role);
  async function load() {
    try {
      const [r, v] = await Promise.all([api.get('/maintenance'), api.get('/venues')]);
      setRequests(r.data);
      setVenues(v.data);
      if (!venueId && v.data[0]) setVenueId(v.data[0].id);
      if (isTech) {
        const [t, p] = await Promise.all([api.get('/maintenance/technicians').catch(() => ({
          data: []
        })), api.get('/maintenance/preventive').catch(() => ({
          data: []
        }))]);
        setTechnicians(t.data);
        setPreventive(p.data);
      }
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudieron cargar las solicitudes.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/maintenance', {
        venueId,
        location,
        type,
        urgency,
        description
      });
      setDescription('');
      setLocation('');
      setNotice('Solicitud registrada; jefatura recibirá un aviso.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo crear la solicitud.' : 'Error de conexión.');
    }
  }
  async function transition(id: string, status: string, extra: any = {}) {
    try {
      await api.patch(`/maintenance/${id}/status`, {
        status,
        ...extra
      });
      setNotice(`La solicitud cambió a ${status}.`);
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo cambiar el estado.' : 'Error de conexión.');
    }
  }
  async function assign(id: string) {
    try {
      await api.post(`/maintenance/${id}/assign`, {
        userId: assignments[id]
      });
      setNotice('Solicitud asignada al técnico.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo asignar.' : 'Error de conexión.');
    }
  }
  async function reopen(id: string) {
    try {
      await api.post(`/maintenance/${id}/reopen`, {
        reason: reasons[id]
      });
      setNotice('Solicitud reabierta para revisión.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo reabrir.' : 'Error de conexión.');
    }
  }
  async function evidence(id: string, file?: File) {
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    try {
      await api.post(`/maintenance/${id}/evidence`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setNotice('Evidencia fotográfica guardada de forma privada.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo guardar la evidencia.' : 'Error de conexión.');
    }
  }
  async function createPreventive(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/maintenance/preventive', {
        asset,
        venueId,
        description,
        dueAt: new Date(dueAt).toISOString()
      });
      setNotice('Mantenimiento preventivo programado.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo programar el mantenimiento.' : 'Error de conexión.');
    }
  }
  async function completePreventive(id: string) {
    try {
      await api.patch(`/maintenance/preventive/${id}/complete`);
      setNotice('Mantenimiento preventivo marcado como ejecutado.');
      load();
    } catch (e) {
      setError('No se pudo actualizar el mantenimiento preventivo.');
    }
  }
  return <>
    <ModuleHeading label="OPERACIÓN DE ESCENARIOS" title="Mantenimiento" description="Sigue cada solicitud, documenta trabajos y programa cuidado preventivo." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="maintenance-layout">
      <div className="maintenance-list">
        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">SEGUIMIENTO</span>
              <h2>{requests.length} solicitudes</h2>
            </div>
            <button className="quiet-link" onClick={load}>Actualizar <RotateCcw size={14} /></button>
          </div>
          { requests.map(r => <div className="maintenance-card" key={r.id}>
            <div className="maintenance-card-top">
              <span className={`status-pill status-${r.status.toLowerCase()}`}>#{r.number} · {r.status.replaceAll('_', ' ')}</span>
              <span className="maintenance-kind"><b>{r.urgency}</b><small>{r.type === 'PREVENTIVO' ? 'Preventivo' : 'Correctivo'}</small></span>
              <span>
                { new Date(r.createdAt).toLocaleDateString('es-CO') }
              </span>
            </div>
            <h3>
              { r.venue?.name }
              <span>— {r.location}</span>
            </h3>
            <p>
              { r.description }
            </p>
            { r.destination && <small>Escalada a {r.destination} · {r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString('es-CO') : ''}</small> }
            <div className="evidence-strip">
              { r.evidence?.map((ev: any) => <a key={ev.id} href={`${api.defaults.baseURL}/evidence/${ev.id}`} target="_blank" rel="noreferrer" onClick={async e => {
                e.preventDefault();
                try {
                  const x = await api.get(`/evidence/${ev.id}`, {
                    responseType: 'blob'
                  });
                  window.open(URL.createObjectURL(x.data), '_blank', 'noopener');
                } catch {
                  setError('No tienes acceso a esta evidencia.');
                }
              }}>
                <ImagePlus size={14} />
                { ev.originalName || 'Evidencia' }
              </a>) }
            </div>
            { isTech && r.status !== 'CERRADA' && <label className="upload-control"><ImagePlus size={15} /> Adjuntar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => evidence(r.id, e.target.files?.[0])} /></label> }
            <div className="maintenance-actions">
              { isLead && r.status === 'REGISTRADA' && <button className="button button-quiet" onClick={() => transition(r.id, 'EN_REVISION')}>Iniciar revisión <ArrowRight size={14} /></button> }
              { isLead && ['EN_REVISION', 'ASIGNADA'].includes(r.status) && <div className="inline-action">
                <select value={assignments[r.id] || ''} onChange={e => setAssignments({
                  ...assignments,
                  [r.id]: e.target.value
                })}>
                  <option value="">Seleccionar técnico</option>
                  { technicians.map(t => <option key={t.id} value={t.id}>
                    { t.name }
                  </option>) }
                </select>
                <button className="button button-quiet" disabled={!assignments[r.id]} onClick={() => assign(r.id)}>Asignar</button>
              </div> }
              { isLead && ['EN_REVISION', 'ASIGNADA'].includes(r.status) && <div className="inline-action">
                <input placeholder="Dependencia destino" value={destination} onChange={e => setDestination(e.target.value)} />
                <input aria-label="Fecha programada" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                <button className="button button-quiet" onClick={() => transition(r.id, 'ESCALADA', {
                  destination,
                  scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined
                })}>Escalar</button>
              </div> }
              { isLead && r.status === 'ESCALADA' && <button className="button button-quiet" onClick={() => transition(r.id, 'EN_REVISION')}>Volver a revisión</button> }
              { isTech && r.status === 'ASIGNADA' && <button className="button button-quiet" onClick={() => transition(r.id, 'EN_EJECUCION')}>Iniciar trabajo</button> }
              { isLead && r.status === 'ASIGNADA' && <button className="button button-quiet" onClick={() => transition(r.id, 'EN_EJECUCION')}>Marcar en ejecución</button> }
              { isTech && r.status === 'EN_EJECUCION' && <button className="button button-ink" disabled={!r.evidence?.length} onClick={() => transition(r.id, 'CERRADA')}>Cerrar con evidencia <Check size={14} /></button> }
              { isLead && r.status === 'CERRADA' && <div className="inline-action">
                <input placeholder="Motivo de reapertura" value={reasons[r.id] || ''} onChange={e => setReasons({
                  ...reasons,
                  [r.id]: e.target.value
                })} />
                <button className="button button-quiet" disabled={(reasons[r.id] || '').length < 8} onClick={() => reopen(r.id)}><RotateCcw size={14} /> Reabrir</button>
              </div> }
            </div>
          </div>) }
          { !requests.length && <p className="empty-inline">Todavía no hay solicitudes para mostrar.</p> }
        </article>
      </div>
      <div className="maintenance-side">
        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">NUEVA SOLICITUD</span>
              <h2>Reportar mantenimiento</h2>
            </div>
          </div>
          <form className="workspace-form" onSubmit={create}>
            <label>Escenario<select required value={venueId} onChange={e => setVenueId(e.target.value)}><option value="">Selecciona</option>{venues.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</select></label>
            <label>Ubicación específica<input required value={location} onChange={e => setLocation(e.target.value)} placeholder="Salón, pasillo, equipo…" /></label>
            <label>Tipo<select value={type} onChange={e => setType(e.target.value)}><option value="CORRECTIVO">Correctivo</option><option value="PREVENTIVO">Preventivo</option></select></label>
            <label>Urgencia<select value={urgency} onChange={e => setUrgency(e.target.value)}><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option><option value="CRITICA">Crítica</option></select></label>
            <label>Descripción<textarea required minLength={8} rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label>
            <button className="button button-ink">Enviar solicitud <ArrowRight size={16} /></button>
          </form>
        </article>
        { isLead && <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">CUIDADO PREVENTIVO</span>
              <h2>Programar mantenimiento</h2>
            </div>
          </div>
          <form className="workspace-form" onSubmit={createPreventive}>
            <label>Activo<select value={asset} onChange={e => setAsset(e.target.value)}>{[['ASCENSOR', 'Ascensores'], ['PLANTA_ELECTRICA', 'Plantas eléctricas'], ['MOTOBOMBA', 'Motobombas'], ['ALARMA_INCENDIOS', 'Alarmas contra incendios'], ['SILLETERIA', 'Silletería'], ['BANOS', 'Baños'], ['LUMINARIAS', 'Luminarias']].map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
            <label>Escenario<select value={venueId} onChange={e => setVenueId(e.target.value)}>{venues.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</select></label>
            <label>Descripción<input required value={description} onChange={e => setDescription(e.target.value)} /></label>
            <label>Fecha programada<input type="datetime-local" required value={dueAt} onChange={e => setDueAt(e.target.value)} /></label>
            <button className="button button-ink">Programar <CalendarClock size={15} /></button>
          </form>
          { preventive.map(p => <div className="program-mini" key={p.id}>
            <span className="mini-icon tone-2">
              <CalendarClock size={14} />
            </span>
            <span>
              <b>{p.asset.replaceAll('_', ' ')} · {p.venue?.name}</b>
              <small>{new Date(p.dueAt).toLocaleDateString('es-CO')} · {p.completedAt ? 'Ejecutado' : 'Programado'}</small>
            </span>
            { !p.completedAt && <button className="row-icon" onClick={() => completePreventive(p.id)} title="Marcar ejecutado">
              <Check size={14} />
            </button> }
          </div>) }
        </article> }
      </div>
    </div>
  </>;
}
// Administración de usuarios y permisos por rol.
function UsersWorkspace() {
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ADMINISTRATIVO');
  const [temp, setTemp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      setUsers((await api.get('/users')).data);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo cargar el directorio.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const {
        data
      } = await api.post('/users', {
        name,
        email,
        role
      });
      setTemp(data.temporaryPassword);
      setNotice(`Cuenta creada para ${email}. Entrega la clave temporal por un canal privado.`);
      setName('');
      setEmail('');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo crear la cuenta.' : 'Error de conexión.');
    }
  }
  async function toggle(u: any) {
    try {
      await api.patch(`/users/${u.id}`, {
        active: !u.active
      });
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo cambiar el estado.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label="ADMINISTRACIÓN · ACCESO Y ROLES" title="Usuarios y permisos" description="Crea cuentas y revisa rol, estado y autenticación multifactor." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    { temp && <div className="temporary-password"><LockKeyhole size={16} /> Contraseña temporal: <code>{temp}</code><button onClick={() => setTemp('')}>Ocultar</button></div> }
    <div className="workspace-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">DIRECTORIO</span>
            <h2>{users.length} cuentas</h2>
          </div>
        </div>
        { users.map(u => <div className="program-mini" key={u.id}>
          <span className="user-avatar">
            { u.name[0] }
          </span>
          <span>
            <b>
              { u.name }
            </b>
            <small className="record-fact"><b>Correo</b>{u.email}</small>
            <small className="record-fact"><b>Rol</b>{u.role.replaceAll('_', ' ')}</small>
            <small className="record-fact"><b>Seguridad</b>{u.mfaEnabled ? 'Autenticación en dos pasos activa' : 'Autenticación en dos pasos inactiva'}</small>
          </span>
          <em className={`status-pill ${u.active ? 'status-active' : 'status-inactive'}`}>
            { u.active ? 'ACTIVO' : 'INACTIVO' }
          </em>
          <button className="row-icon" onClick={() => toggle(u)} title={u.active ? 'Desactivar' : 'Activar'}>
            { u.active ? <X size={14} /> : <Check size={14} /> }
          </button>
        </div>) }
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">NUEVA CUENTA</span>
            <h2>Crear perfil de acceso</h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={create}>
          <label>Nombre<input required value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Correo<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Rol<select value={role} onChange={e => setRole(e.target.value)}>{['ADMINISTRATIVO', 'COORDINADOR', 'EDUCADOR', 'ESTUDIANTE', 'ACUDIENTE', 'JEFE_MANTENIMIENTO', 'TECNICO_MANTENIMIENTO', 'SUPER_ADMIN'].map(r => <option key={r}>{r}</option>)}</select></label>
          <button className="button button-ink">Crear cuenta <UserPlus size={15} /></button>
          <small>La primera sesión obliga a cambiar la clave temporal.</small>
        </form>
      </article>
    </div>
  </>;
}
// Ajustes institucionales guardados en la API.
function SettingsWorkspace() {
  const [rows, setRows] = useState<any[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      setRows((await api.get('/settings')).data);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudieron cargar los ajustes.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api.put(`/settings/${key}`, {
        value
      });
      setKey('');
      setValue('');
      setNotice('Ajuste institucional guardado.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo guardar.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label="CONFIGURACIÓN INSTITUCIONAL" title="Ajustes y privacidad" description="Guarda valores auditables y consulta los documentos informativos." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="workspace-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">AJUSTES</span>
            <h2>Valores configurados</h2>
          </div>
        </div>
        { rows.map(s => <div className="program-mini" key={s.key}>
          <span className="mini-icon tone-2">
            <Settings size={14} />
          </span>
          <span>
            <b>
              { s.key }
            </b>
            <small>
              { s.value }
            </small>
          </span>
        </div>) }
        { !rows.length && <p className="empty-inline">Todavía no hay valores configurados.</p> }
      </article>
      <article className="panel">
        <form className="workspace-form" onSubmit={save}>
          <label>Clave<input required pattern="[A-Z][A-Z0-9_]{1,79}" value={key} onChange={e => setKey(e.target.value.toUpperCase())} placeholder="PERIODO_ACADEMICO" /></label>
          <label>Valor<input required maxLength={2000} value={value} onChange={e => setValue(e.target.value)} /></label>
          <button className="button button-ink">Guardar ajuste <Check size={15} /></button>
        </form>
        <div className="legal-links">
          <Link to="/privacidad">Aviso de privacidad <ExternalLink size={14} /></Link>
          <Link to="/terminos">Términos de uso <ExternalLink size={14} /></Link>
        </div>
        <p className="privacy-note">La institución debe revisar y aprobar estos textos antes de tratar datos reales, especialmente de menores.</p>
      </article>
    </div>
  </>;
}
// Perfil y datos de la cuenta autenticada.
function AccountWorkspace({
  user
}: {
  user: User;
}) {
  const [profile, setProfile] = useState<any>(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    api.get('/auth/me').then(r => setProfile(r.data.user)).catch(() => setError('No se pudo cargar la cuenta.'));
  }, []);
  async function setup() {
    try {
      const {
        data
      } = await api.post('/auth/mfa/setup');
      setSecret(data.secret);
      setNotice('Guarda este secreto en tu autenticador y confirma con un código actual.');
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo preparar MFA.' : 'Error de conexión.');
    }
  }
  async function verify(enable: boolean) {
    try {
      await api.post(`/auth/mfa/${enable ? 'enable' : 'disable'}`, {
        code
      });
      setProfile({
        ...profile,
        mfaEnabled: enable
      });
      setSecret('');
      setCode('');
      setNotice(enable ? 'MFA activado.' : 'MFA desactivado.');
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'Código no válido.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label="SEGURIDAD DE LA CUENTA" title="Mi cuenta" description="Actualiza tu contraseña y protege el acceso con MFA TOTP." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    <div className="workspace-grid">
      <article className="panel">
        <div className="account-detail">
          <span>Nombre</span>
          <b>
            { user.name }
          </b>
          <span>Correo</span>
          <b>
            { user.email }
          </b>
          <span>Rol</span>
          <b>
            { user.role.replaceAll('_', ' ') }
          </b>
          <span>MFA</span>
          <b>
            { profile?.mfaEnabled ? 'Activo' : 'Inactivo' }
          </b>
        </div>
        <Link to="/cambiar-clave" className="button button-quiet"><LockKeyhole size={15} /> Cambiar contraseña</Link>
      </article>
      <article className="panel">
        <span className="section-label">AUTENTICACIÓN MULTIFACTOR</span>
        <h2>
          { profile?.mfaEnabled ? 'MFA activado' : 'Añadir segundo factor' }
        </h2>
        { secret && <div className="mfa-secret">Secreto TOTP: <code>{secret}</code></div> }
        { (!profile?.mfaEnabled || secret) && <label className="workspace-form">Código actual<input className="mfa-code" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label> }
        { !profile?.mfaEnabled ? <button className="button button-ink" onClick={secret ? () => verify(true) : setup} disabled={Boolean(secret) && code.length !== 6}>
          { secret ? 'Confirmar MFA' : 'Configurar MFA' }
          <ShieldCheck size={15} />
        </button> : <button className="button button-quiet" onClick={() => verify(false)} disabled={code.length !== 6}>Desactivar MFA</button> }
      </article>
    </div>
  </>;
}
// ── Cuenta, acceso y páginas informativas ──────────────────────────────────
// Recuperación de cuenta por correo o token de un solo uso.
function RecoveryPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (token) {
        await api.post('/auth/recovery/complete', {
          token,
          newPassword: password
        });
        setNotice('Contraseña actualizada. Ya puedes iniciar sesión.');
      } else setNotice((await api.post('/auth/recovery/request', {
        email
      })).data.message);
      setDone(true);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo completar.' : 'Error de conexión.');
    }
  }
  return <>
    <PublicNavigation palette="pereira" />
    <main className="recovery-page" id="contenido-principal">
      <section className="panel recovery-card">
        <span className="section-label">SEGURIDAD DE LA CUENTA</span>
        <h1>
          { token ? 'Crear contraseña nueva' : 'Recuperar acceso' }
        </h1>
        <p>
          { token ? 'Usa 12 caracteres o más e incluye mayúscula, minúscula y número.' : 'Te enviaremos un enlace de un solo uso si el correo está registrado.' }
        </p>
        { notice && <div className="notice success-note">
          { notice }
        </div> }
        { error && <div className="notice">
          { error }
        </div> }
        { !done && <form className="workspace-form" onSubmit={submit}>
          { token ? <label>Nueva contraseña<input type="password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} /></label> : <label>Correo<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label> }
          <button className="button button-ink">
            { token ? 'Actualizar contraseña' : 'Enviar instrucciones' }
            <ArrowRight size={15} />
          </button>
        </form> }
        <Link className="back-link" to="/acceso">Volver al inicio de sesión</Link>
      </section>
    </main>
  </>;
}
// Cambio de contraseña requerido; conserva sus validaciones de seguridad.
function ChangePasswordPage({
  user,
  onChanged
}: {
  user: User;
  onChanged: (u: User) => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword: next
      });
      onChanged({
        ...user,
        mustChangePassword: false
      });
      nav('/panel');
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo actualizar.' : 'Error de conexión.');
    } finally {
      setBusy(false);
    }
  }
  return <>
    <PublicNavigation accessHref="/panel" accessLabel="Mi espacio" accessInitial={user.name} palette="pereira" />
    <main className="recovery-page" id="contenido-principal">
      <section className="panel recovery-card">
        <span className="section-label">ACTUALIZACIÓN REQUERIDA</span>
        <h1>Elige una contraseña personal.</h1>
        <p>Al menos 12 caracteres, con mayúscula, minúscula y número.</p>
        { error && <div className="notice">
          { error }
        </div> }
        <form className="workspace-form" onSubmit={submit}>
          <label>Contraseña actual<input type="password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
          <label>Nueva contraseña<input type="password" minLength={12} required value={next} onChange={e => setNext(e.target.value)} /></label>
          <button className="button button-ink" disabled={busy}>Actualizar contraseña <Check size={15} /></button>
        </form>
      </section>
    </main>
  </>;
}
// Páginas informativas de privacidad y términos.
function LegalPage({
  kind
}: {
  kind: 'privacy' | 'terms';
}) {
  const privacy = kind === 'privacy';
  return <>
    <PublicNavigation palette="pereira" />
    <main className="legal-page" id="contenido-principal">
      <article>
        <span className="section-label">CENTRO CULTURAL LUCY TEJADA · PEREIRA</span>
        <h1>
          { privacy ? 'Aviso de privacidad' : 'Términos de uso' }
        </h1>
        <p className="legal-date">Versión inicial para revisión institucional</p>
        { privacy ? <>
          <h2>Tratamiento de información</h2>
          <p>PGC-LT organiza información de estudiantes, acudientes, educadores y personal autorizado para apoyar formación artística, matrícula, asistencia, seguimiento cualitativo y operación de escenarios.</p>
          <h2>Datos de niñas, niños y adolescentes</h2>
          <p>Antes de usar datos reales, la institución debe definir autorizaciones de representantes, canales para ejercer derechos, retención, responsable del tratamiento y procedimientos jurídicos aplicables.</p>
          <h2>Uso y protección</h2>
          <p>El acceso se limita por perfil y operaciones administrativas generan auditoría. Los registros de demostración son ficticios. La implementación técnica no constituye certificación de cumplimiento legal.</p>
          <h2>Consultas y actualización</h2>
          <p>La institución debe completar aquí su contacto y procedimiento oficial antes de publicar este aviso.</p>
        </> : <>
          <h2>Uso del servicio</h2>
          <p>La plataforma apoya procesos culturales y formativos del Centro. Cada persona debe usar las funciones de su rol y mantener protegidas sus credenciales.</p>
          <h2>Exactitud de la información</h2>
          <p>Las personas autorizadas deben registrar información necesaria y veraz. Las evaluaciones son cualitativas y no equivalen a calificaciones numéricas.</p>
          <h2>Disponibilidad y revisión</h2>
          <p>Esta versión es una base de desarrollo. La institución debe revisar seguridad, privacidad, respaldos, normas internas y estos términos antes de operar con información real.</p>
        </> }
      </article>
      <footer className="footer">
        <span>PGC-LT · CULTURA QUE NOS ENCUENTRA</span>
        <span>Centro Cultural Lucy Tejada · Pereira</span>
      </footer>
    </main>
  </>;
}
// ── Enrutamiento interno y rutas del sitio ─────────────────────────────────
// Conecta el nombre seleccionado en el menú con su módulo.
function WorkspaceRouter({
  section,
  role,
  user
}: {
  section: string;
  role: string;
  user: User;
}) {
  if (section === 'Mi espacio') return <MyPortal />;
  if (section === 'Mi cuenta') return <AccountWorkspace user={user} />;
  if (section === 'Matrículas') return <EnrollmentWorkspace />;
  if (section === 'Educadores') return <TeachersWorkspace />;
  if (section === 'Grupos y horarios') return role === 'EDUCADOR' ? <EducatorWorkspace /> : <GroupsWorkspace />;
  if (section === 'Reportes') return <ReportsWorkspace />;
  if (section === 'Usuarios') return <UsersWorkspace />;
  if (section === 'Mantenimiento') return <MaintenanceWorkspace role={role} />;
  if (section === 'Ajustes') return <SettingsWorkspace />;
  return <WorkspaceSection section={section} role={role} />;
}
// Módulo genérico de programas/estudiantes; aquí se editan formularios CRUD.
function WorkspaceSection({
  section,
  role
}: {
  section: string;
  role: string;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [programView, setProgramView] = useState<'active' | 'archived'>('active');
  const [students, setStudents] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [editProgramId, setEditProgramId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentType, setDocumentType] = useState('CC');
  const [documentNumber, setDocumentNumber] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const canManagePrograms = ['SUPER_ADMIN', 'ADMINISTRATIVO', 'COORDINADOR'].includes(role);
  const canManageStudents = ['SUPER_ADMIN', 'ADMINISTRATIVO'].includes(role);
  async function load() {
    try {
      setError('');
      if (section === 'Programas') {
        const endpoint = programView === 'archived' ? '/programs/archived' : '/programs';
        setItems((await api.get(endpoint)).data);
      } else if (section === 'Estudiantes') {
        const r = await api.get('/students', {
          params: {
            q: query,
            page
          }
        });
        setStudents(r.data.items);
        setPages(r.data.pages);
      }
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo cargar la información.' : 'Error de conexión.');
    }
  }
  useEffect(() => {
    load();
  }, [section, query, page, programView]);
  function clearProgram() {
    setEditProgramId('');
    setName('');
    setCategory('');
    setDescription('');
    setCapacity('');
  }
  async function submitProgram(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        name,
        category,
        description,
        capacity: capacity ? Number(capacity) : undefined
      };
      if (editProgramId) await api.patch(`/programs/${editProgramId}`, payload);else await api.post('/programs', payload);
      clearProgram();
      setNotice(editProgramId ? 'Programa actualizado.' : 'Programa creado.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo guardar.' : 'Error de conexión.');
    }
  }
  async function toggleProgram(p: any) {
    try {
      await api.patch(`/programs/${p.id}`, {
        active: programView === 'archived'
      });
      setNotice(programView === 'archived' ? 'Programa restaurado y visible nuevamente.' : 'Programa archivado.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo actualizar.' : 'Error de conexión.');
    }
  }
  function clearStudent() {
    setEditStudentId('');
    setFirstName('');
    setLastName('');
    setDocumentType('CC');
    setDocumentNumber('');
    setGender('');
    setEmail('');
    setPhone('');
  }
  async function submitStudent(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        firstName,
        lastName,
        documentType,
        documentNumber,
        gender: gender || undefined,
        email: email || undefined,
        phone: phone || undefined
      };
      if (editStudentId) await api.patch(`/students/${editStudentId}`, payload);else await api.post('/students', payload);
      clearStudent();
      setNotice(editStudentId ? 'Estudiante actualizado.' : 'Estudiante registrado.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo guardar.' : 'Error de conexión.');
    }
  }
  async function deactivateStudent(s: any) {
    if (!window.confirm(`¿Desactivar el registro de ${s.firstName} ${s.lastName}?`)) return;
    try {
      await api.delete(`/students/${s.id}`);
      setNotice('Estudiante desactivado; el historial se conserva.');
      load();
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || 'No se pudo desactivar.' : 'Error de conexión.');
    }
  }
  return <>
    <ModuleHeading label={`GESTIÓN CULTURAL · ${section.toUpperCase()}`} title={section === 'Estudiantes' ? 'Comunidad estudiantil' : 'Programas formativos'} description="Información persistida en PostgreSQL, con búsqueda y acciones según tu rol." />
    <ModuleNotice error={error} notice={notice} clear={() => {
      setError('');
      setNotice('');
    }} />
    { section === 'Programas' && <div className="workspace-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">OFERTA FORMATIVA</span>
            <h2>{items.length} {programView === 'archived' ? 'programas archivados' : 'programas activos'}</h2>
          </div>
          <div className="program-list-actions">
            <div className="program-view-switch" aria-label="Vista de programas">
              <button type="button" aria-pressed={programView === 'active'} className={programView === 'active' ? 'selected' : ''} onClick={() => setProgramView('active')}>Activos</button>
              <button type="button" aria-pressed={programView === 'archived'} className={programView === 'archived' ? 'selected' : ''} onClick={() => setProgramView('archived')}>Archivados</button>
            </div>
            <button className="quiet-link" onClick={load}>Actualizar <RotateCcw size={14} /></button>
          </div>
        </div>
        { items.map((p: any) => <div className="program-mini" key={p.id}>
          <span className="mini-icon tone-2">
            <Palette size={15} />
          </span>
          <span>
            <b>
              { p.name }
            </b>
            <small className="record-fact"><b>Disciplina</b>{p.category}</small>
            <small className="record-fact"><b>Grupos</b>{p._count?.groups || 0}</small>
            <small className="record-fact"><b>Cupo</b>{p.capacity || 'Abierto'}</small>
            <small>
              { p.description || 'Descripción pendiente' }
            </small>
          </span>
          { canManagePrograms && <>
            <button className="row-icon" title="Editar" onClick={() => {
              setEditProgramId(p.id);
              setName(p.name);
              setCategory(p.category);
              setDescription(p.description || '');
              setCapacity(p.capacity?.toString() || '');
            }}>
              <Pencil size={14} />
            </button>
            <button className="row-icon" title={programView === 'archived' ? 'Restaurar programa' : 'Archivar programa'} onClick={() => toggleProgram(p)}>
              { programView === 'archived' ? <RotateCcw size={14} /> : <Archive size={14} /> }
            </button>
          </> }
        </div>) }
        { !items.length && <p className="empty-inline">{programView === 'archived' ? 'No hay programas archivados.' : 'No hay programas activos todavía.'}</p> }
      </article>
      { canManagePrograms && <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">
              { editProgramId ? 'EDITAR OFERTA' : 'NUEVA OFERTA' }
            </span>
            <h2>
              { editProgramId ? 'Actualizar programa' : 'Crear programa' }
            </h2>
          </div>
        </div>
        <form className="workspace-form" onSubmit={submitProgram}>
          <label>Nombre<input required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Laboratorio de creación" /></label>
          <label>Disciplina<input required minLength={2} value={category} onChange={e => setCategory(e.target.value)} placeholder="Música, danza…" /></label>
          <label>Descripción<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label>
          <label>Cupo máximo<input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Sin límite establecido" /></label>
          <div className="row-actions">
            <button className="button button-ink">
              { editProgramId ? 'Guardar cambios' : 'Guardar programa' }
              <Check size={16} />
            </button>
            { editProgramId && <button className="button button-quiet" type="button" onClick={clearProgram}>Cancelar</button> }
          </div>
        </form>
      </article> }
    </div> }
    { section === 'Estudiantes' && <>
      <div className="panel student-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input placeholder="Buscar nombre o documento" value={query} onChange={e => {
            setQuery(e.target.value);
            setPage(1);
          }} />
        </label>
        <span>{students.length} de 20 registros · página {page}/{pages}</span>
      </div>
      <div className="workspace-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">REGISTRO</span>
              <h2>Estudiantes</h2>
            </div>
            <div className="row-actions">
              <button className="row-icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
              <button className="row-icon" disabled={page >= pages} onClick={() => setPage(page + 1)}>→</button>
            </div>
          </div>
          <div className="student-table">
            <div className="table-header">
              <span>NOMBRE</span>
              <span>DOCUMENTO</span>
              <span>ACCIONES</span>
            </div>
            { students.map((s: any) => <div className="table-row student-record" key={s.id}>
              <span>
                <b>
                  {s.firstName} {s.lastName}
                </b>
                <small>
                  { s.email || s.phone || 'Sin contacto registrado' }
                </small>
              </span>
                <span>{s.documentType}: {s.documentNumber}</span>
              <span className="row-actions">
                { canManageStudents && <>
                  <button className="row-icon" title="Editar" onClick={() => {
                    setEditStudentId(s.id);
                    setFirstName(s.firstName);
                    setLastName(s.lastName);
                    setDocumentType(s.documentType);
                    setDocumentNumber(s.documentNumber);
                    setGender(s.gender || '');
                    setEmail(s.email || '');
                    setPhone(s.phone || '');
                  }}>
                    <Pencil size={14} />
                  </button>
                  <button className="row-icon danger-icon" title="Desactivar" onClick={() => deactivateStudent(s)}>
                    <X size={14} />
                  </button>
                </> }
              </span>
            </div>) }
            { !students.length && <p className="empty-inline">No hay coincidencias para esta búsqueda.</p> }
          </div>
        </article>
        { canManageStudents && <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">
                { editStudentId ? 'ACTUALIZAR REGISTRO' : 'NUEVO REGISTRO' }
              </span>
              <h2>
                { editStudentId ? 'Editar estudiante' : 'Agregar estudiante' }
              </h2>
            </div>
          </div>
          <form className="workspace-form" onSubmit={submitStudent}>
            <label>Nombres<input required minLength={2} value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
            <label>Apellidos<input required minLength={2} value={lastName} onChange={e => setLastName(e.target.value)} /></label>
            <div className="form-split">
              <label>Tipo documento<select value={documentType} onChange={e => setDocumentType(e.target.value)}><option>CC</option><option>TI</option><option>CE</option><option>RC</option><option>PP</option></select></label>
              <label>Número<input required minLength={4} value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} /></label>
            </div>
            <label>Género (opcional)<select value={gender} onChange={e => setGender(e.target.value)}><option value="">Sin registrar</option><option>Mujer</option><option>Hombre</option><option>No binario</option><option>Prefiere no decirlo</option></select></label>
            <label>Correo<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Teléfono<input value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <div className="row-actions">
              <button className="button button-ink">
                { editStudentId ? 'Guardar cambios' : 'Registrar estudiante' }
                <Check size={16} />
              </button>
              { editStudentId && <button className="button button-quiet" type="button" onClick={clearStudent}>Cancelar</button> }
            </div>
          </form>
        </article> }
      </div>
    </> }
  </>;
}
// Rutas principales y comprobación de sesión antes de abrir /panel.
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem('pgclt_token')));
  useEffect(() => {
    if (sessionStorage.getItem('pgclt_token')) api.get('/auth/me').then(r => setUser(r.data.user)).catch(() => sessionStorage.removeItem('pgclt_token')).finally(() => setChecking(false));
  }, []);
  // Un solo observador anima piezas de todas las rutas, incluidas las que React monta después.
  useEffect(() => {
    const selector = [
      '#header', '.pillar-bar .pillar', '.lucy-hero .hero-title',
      '.events-section .lucy-kicker', '.events-section .section-heading', '.events-section .project-slide',
      '.inspiration-section .bio-gallery-title', '.inspiration-section .bio-art-card', '.location-content',
      '.explore-intro', '.discipline-tile', '.programs-heading', '.program-row', '.lucy-cta .cta-inner > *',
      '.login-layout', '.recovery-card', '.legal-page article',
      '.dash-title-home', '.metric-card', '.dash-grid > .panel', '.bottom-grid > *',
      '.module-heading', '.workspace-grid > .panel', '.portal-grid > *'
    ].join(',');
    const targets = new WeakSet<HTMLElement>();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
    const watch = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
        if (targets.has(element)) return;
        targets.add(element);
        element.classList.add('site-reveal');
        element.style.setProperty('--reveal-delay', `${Math.min(index % 5, 3) * 65}ms`);
        observer.observe(element);
      });
    };
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);
  async function logout() {
    try {
      if (csrfToken()) await api.post('/auth/logout', {}, {
        headers: {
          'X-CSRF-Token': csrfToken()
        }
      });
    } catch {} finally {
      sessionStorage.removeItem('pgclt_token');
      setUser(null);
    }
  }
  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/acceso" element={<Login onLogin={setUser} />} />
    <Route path="/recuperar" element={<RecoveryPage />} />
    <Route path="/privacidad" element={<LegalPage kind="privacy" />} />
    <Route path="/terminos" element={<LegalPage kind="terms" />} />
    <Route path="/cambiar-clave" element={user ? <ChangePasswordPage user={user} onChanged={setUser} /> : <Navigate to="/acceso" replace />} />
    <Route path="/panel" element={checking ? <div className="page-loading">Cargando tu espacio…</div> : user?.mustChangePassword ? <Navigate to="/cambiar-clave" replace /> : user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/acceso" replace />} />
    <Route path="*" element={<Landing />} />
  </Routes>;
}
export default App;
