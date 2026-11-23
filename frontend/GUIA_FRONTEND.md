# Guía del frontend PGC-LT

Esta guía sirve como mapa para editar la interfaz. El frontend usa React, TypeScript, Vite y CSS que ya están instalados en el proyecto; no necesitas instalar otro framework.

## Mapa de archivos

| Archivo | Qué contiene |
| --- | --- |
| [index.html](./index.html) | Título, descripción e icono de la pestaña del navegador. |
| [main.tsx](./src/main.tsx) | Arranque de React, rutas y carga de hojas de estilo. |
| [App.tsx](./src/App.tsx) | Inicio de sesión, panel interno, módulos, permisos y rutas. |
| [LandingHost.tsx](./src/components/landing/LandingHost.tsx) | Secciones y contenido de la página pública. |
| [PublicNavigation.tsx](./src/components/PublicNavigation.tsx) | Barra de navegación compartida por inicio, acceso y panel. |
| [landing.css](./src/components/landing/landing.css) | Diseño de la página pública y sus breakpoints responsivos. |
| [portal-theme.css](./src/portal-theme.css) | Identidad visual del acceso, panel y formularios internos. |
| [styles.css](./src/styles.css) | Componentes generales, tablas y estilos base del sistema. |

## `App.tsx`, de arriba hacia abajo

Los comentarios dentro del archivo marcan el inicio de cada bloque. Usa `Ctrl+F` en Visual Studio Code para buscar el nombre de una función. Los números indican dónde empieza cada bloque en esta versión; pueden cambiar al editar.

| Línea inicial | Bloque | Qué puedes cambiar ahí |
| ---: | --- | --- |
| 1 | Importaciones | React, iconos, gráficos y componentes. |
| 8 | Cliente Axios y seguridad de sesión | URL de API, token y renovación de sesión. La URL se configura con `VITE_API_URL`. |
| 49 | Tipos de datos | Campos esperados para usuario y programa. |
| 68 | Disciplinas del portal | Nombres, etiquetas e iconos que se usan en el panel. |
| 90 | `Landing()` | Enlace entre las rutas de React y la landing. El contenido está en `LandingHost.tsx`. |
| 94 | `Login()` | Formulario, validación y envío de acceso a la API. |
| 162 | `navItems` | Opciones disponibles para el menú del panel. |
| 200 | `Dashboard()` | Portada del panel, carga de métricas, menú lateral y accesos rápidos. |
| 449 | `ModuleHeading()` | Título reutilizable en las pantallas de trabajo. |
| 472 | `ModuleNotice()` | Mensajes de error y confirmación de los formularios. |
| 497 | `EnrollmentWorkspace()` | Solicitudes y creación de matrículas. |
| 632 | `EducatorWorkspace()` | Vista para educadores. |
| 789 | `MyPortal()` | Espacio personal de estudiantes y acudientes. |
| 925 | `GroupsWorkspace()` | Grupos, horarios y cupos. |
| 1048 | `TeachersWorkspace()` | Administración de educadores. |
| 1170 | `ReportsWorkspace()` | Reportes. |
| 1257 | `MaintenanceWorkspace()` | Solicitudes y seguimiento de mantenimiento. |
| 1531 | `UsersWorkspace()` | Usuarios y permisos. |
| 1630 | `SettingsWorkspace()` | Ajustes institucionales. |
| 1705 | `AccountWorkspace()` | Información de la cuenta autenticada. |
| 1789 | `RecoveryPage()` | Solicitud de recuperación de acceso. |
| 1844 | `ChangePasswordPage()` | Formulario de cambio de contraseña. |
| 1896 | `LegalPage()` | Términos y aviso de privacidad. |
| 1937 | `WorkspaceRouter()` | Decide qué módulo mostrar según la opción seleccionada. |
| 1958 | `WorkspaceSection()` | Gestión general de programas y estudiantes. |
| 2248 | `App()` | Enrutamiento y protección de `/panel`. |

## `LandingHost.tsx`, secciones públicas

| Línea inicial | Bloque | Edición habitual |
| ---: | --- | --- |
| 5 | `media` | Ruta base para imágenes e ilustraciones locales. |
| 8 | `events` | Cambia los títulos, fechas, etiquetas y afiches del carrusel. Cada objeto tiene `image` y `alt`. |
| 31 | `disciplines` | Cambia nombre, ilustración y descripción de Música, Teatro, Artes plásticas y Danza. |
| 49 | `programs` | Cambia las filas de programas formativos. |
| 51 | `EventsSection()` | Carrusel: progreso, desplazamiento y botones anterior/siguiente. |
| 117 | `InspirationSection()` | Textos e imágenes de la biografía de Lucy Tejada. |
| 148 | `LocationSection()` | Video, bandera y dirección. |
| 170 | `ExploreSection()` | Cuadrícula interactiva de disciplinas. |
| 202 | `ProgramsSection()` | Presentación de las filas de programas. |
| 232 | `LandingHost()` | Ensambla las secciones en el orden de la página. |

Las imágenes usadas por la landing están en `frontend/public/media/lucy/`; las fotos y videos generales están en `frontend/public/media/`. Para cambiar una imagen, copia el recurso dentro de `public` y actualiza su ruta `src` en el componente.

## Navegación, favicon y arranque

- [PublicNavigation.tsx](./src/components/PublicNavigation.tsx): opciones de inicio, eventos, programas y acceso. Sus propiedades permiten cambiar los enlaces y el texto del botón.
- [index.html](./index.html): edita `<title>` para el nombre de la pestaña y `rel="icon"` para el logotipo pequeño del navegador.
- [main.tsx](./src/main.tsx): importa primero los estilos generales y después `portal-theme.css`; este orden permite que el tema sobrescriba reglas base.

## Hojas de estilo

### `landing.css`

Los comentarios del archivo señalan cada grupo: navegación, pilares, hero, carrusel, biografía, ubicación, disciplinas, programas, CTA y footer. Los selectores principales son:

- `.lucy-landing`: tipografía y colores base de la landing.
- `.lucy-nav`, `.lucy-brand`: navegación e identidad del logo.
- `.lucy-hero`, `.pillar-bar`: portada y franja de pilares.
- `.events-section`, `.projects-track`, `.project-card`: carrusel de eventos.
- `.inspiration-section`, `.bio-row`, `.bio-photo`: biografía e imágenes.
- `.location-banner`: video y composición de ubicación.
- `.explore-section`, `.discipline-tile`: tarjetas interactivas.
- `.programs-section`, `.lucy-cta`, `.lucy-footer`: programas y cierre de página.
- Las reglas `@media` del final ajustan tabletas, móviles y pantallas pequeñas.

### `portal-theme.css`

- Primer bloque: pantalla de acceso, recuperación y páginas legales.
- Bloque del panel: sidebar, logo y títulos internos.
- `.dash-title-home`: portada del resumen del panel.
- `.metric-card`, `.quick-links`, `.quote-panel`: métricas, accesos y bloque visual.
- Último bloque `@media`: ajustes del portal en móvil.

### `styles.css`

Es la hoja general más extensa. Sus comentarios la dividen en navegación, acceso, panel, módulos, formularios, tablas y reportes. Si una regla de tema parece no aplicarse, busca el mismo selector más abajo: en CSS, la regla posterior suele prevalecer.

## Cambios frecuentes

1. **Editar un texto:** busca el componente de la sección en `LandingHost.tsx` o `App.tsx` y cambia el texto entre etiquetas.
2. **Agregar un evento:** agrega otro objeto a `events` en `LandingHost.tsx` y deja su imagen en `public/media/lucy/`.
3. **Cambiar un color:** busca las variables `--primary-color`, `--tertiary-color` y `--pine` al inicio de `landing.css`; revisa también `portal-theme.css` para el acceso y el panel.
4. **Cambiar una fuente:** busca `font-family` en `landing.css` y `portal-theme.css`. Mantén las dos hojas coherentes para que la página y el portal conserven la misma identidad.
5. **Cambiar una imagen del panel:** busca `src="/media/lucy/..."` en `App.tsx` o la ruta `url('/media/...')` en `portal-theme.css`.
6. **Cambiar una ruta:** modifica `<Route>` al final de `App.tsx`; la lógica de acceso protegido está en la ruta `/panel`.

## Verificar después de editar

Desde la terminal, en `frontend`, ejecuta:

```powershell
npm run build
```

No necesitas instalar dependencias para hacer estos cambios.
