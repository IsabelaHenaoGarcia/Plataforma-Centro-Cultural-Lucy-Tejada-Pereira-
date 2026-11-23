# Guía del frontend — Centro Cultural Lucy Tejada

Esta guía explica cómo recorrer y editar el frontend existente. Está organizada por archivos y bloques de código para que puedas encontrar cada parte sin tener que adivinar qué hace. El proyecto usa React, TypeScript, React Router y CSS; esta guía no agrega dependencias ni cambia su arquitectura.

## 1. Mapa de carpetas

```text
frontend/
├── index.html                         Título, favicon y elemento donde monta React
└── src/
    ├── main.tsx                       Entrada: carga CSS y monta la aplicación
    ├── App.tsx                        Cliente API, acceso, rutas y panel autenticado
    ├── styles.css                     Estilos base y compartidos
    ├── portal-theme.css               Colores y ajustes del acceso y del panel
    └── components/
        ├── PublicNavigation.tsx       Barra de navegación reutilizada
        └── landing/
            ├── LandingHost.tsx        Secciones y contenido de la página pública
            └── landing.css            Estilos de la portada y sus secciones

docs/manuals/FRONTEND.md               Esta guía
frontend/public/media/                  Imágenes, ilustraciones, video y logo
```

## 2. Cómo leer el código React

- `import ...`: trae funciones, iconos, componentes o estilos que otro archivo ya proporciona.
- `type User = { ... }`: describe los campos que tiene un usuario. No crea un dato ni hace una petición.
- `const [valor, setValor] = useState(...)`: guarda un dato temporal de la pantalla. La función `setValor` lo cambia y React vuelve a dibujar el componente.
- `useEffect(() => { ... }, [])`: ejecuta una tarea al montar el componente. Aquí se usa, por ejemplo, para cargar datos o registrar observadores.
- `async function ...`: tarea que puede esperar una respuesta del servidor con `await`.
- `return <...>`: estructura visual de la pantalla (JSX). Las etiquetas se parecen a HTML, pero se escriben dentro de TypeScript.
- `className="..."`: conecta ese elemento JSX con las reglas CSS que tienen el mismo nombre de clase.
- `{variable}`: inserta un valor de TypeScript dentro de la vista.
- `{lista.map(...)}`: repite una estructura por cada elemento de una lista. Para editar los elementos, normalmente se cambia la lista, no el `map`.
- `onClick={...}`, `onChange={...}` y `onSubmit={...}`: acciones del usuario; llaman funciones cuando hace clic, escribe o envía un formulario.
- `condition ? A : B` y `condition && A`: muestran una parte de la interfaz solo cuando se cumple una condición.
- `aria-label`, `alt` y `aria-expanded`: describen controles e imágenes para tecnologías de asistencia. Conserva estos atributos al editar.

## 3. Orden de carga

### `frontend/index.html`

Define el idioma, título, descripción y favicon de la pestaña. El `div#root` es el espacio donde se dibuja React; el `script` carga `src/main.tsx`.

### `frontend/src/main.tsx`

1. Importa React y ReactDOM.
2. Importa `BrowserRouter`, que permite que la barra de direcciones controle las rutas.
3. Importa primero `styles.css` y después `portal-theme.css`.
4. Monta `<App />` dentro de `<BrowserRouter>` y `<React.StrictMode>`.

Ese orden importa: si dos selectores tienen el mismo peso, el que se importa después puede reemplazar al anterior.

## 4. Qué editar según el cambio

| Si quieres cambiar… | Edita… | Busca… |
|---|---|---|
| Título, descripción o favicon de la pestaña | `frontend/index.html` | `<title>`, `description`, `icon` |
| Texto o imágenes del hero público | `frontend/src/components/landing/LandingHost.tsx` | `LandingHost` |
| Eventos, disciplinas o programas de ejemplo | `LandingHost.tsx` | `events`, `disciplines`, `programs` |
| Biografía, cifras, galería o visor de obras | `LandingHost.tsx` | `InspirationSection`, `gallery`, `bio-stats` |
| Video, dirección o bandera | `LandingHost.tsx` | `LocationSection` |
| Orden de las secciones públicas | `LandingHost.tsx` | `export default function LandingHost` |
| Aspecto de la portada y responsive | `frontend/src/components/landing/landing.css` | nombre de clase; estilos vigentes al final |
| Logo, enlaces o menú móvil común | `frontend/src/components/PublicNavigation.tsx` | `PublicNavigation` |
| Inicio de sesión o panel | `frontend/src/App.tsx` | `Login`, `Dashboard` |
| Un módulo administrativo | `frontend/src/App.tsx` | nombre de componente en el índice de abajo |
| Ruta de una página | `frontend/src/App.tsx` | `<Route path=...>` dentro de `App` |
| Colores y reglas generales | `frontend/src/styles.css` | `:root`, variables y clase de pantalla |
| Colores del acceso o panel | `frontend/src/portal-theme.css` | `.login-page`, `.dashboard#panel` |
| Dirección de la API | variable `VITE_API_URL` | creación de `api` en `App.tsx` |
| Archivos visuales | `frontend/public/media/` | referencia `/media/...` en JSX |

## 5. `App.tsx`, bloque por bloque

El archivo comienza con un índice comentado. Estos son los bloques en orden:

### Cliente HTTP y sesión

- `declare module 'axios'`: añade el campo `_pgcltRetry` a la forma interna de una petición. Se usa para evitar que la renovación de sesión se repita sin límite.
- `const api = axios.create(...)`: prepara el cliente Axios. `VITE_API_URL` permite cambiar el servidor; si no existe, usa `http://localhost:4000/api`.
- `api.interceptors.request`: adjunta el token guardado en `sessionStorage` a las peticiones.
- `csrfToken()`: lee la cookie CSRF para enviarla al cerrar o renovar una sesión protegida.
- `api.interceptors.response`: si la API responde 401, intenta renovar la sesión una vez. Si falla, borra el token; no procesa automáticamente los endpoints de inicio y recuperación.

No pegues contraseñas ni tokens en este archivo. Los datos sensibles deben seguir el flujo de la API.

### Tipos y listas compartidas

- `type User`: campos que el frontend usa del usuario autenticado.
- `type Program`: campos principales de un programa y cantidad opcional de grupos.
- `disciplines`: datos de las tarjetas de disciplinas dentro del portal autenticado.
- `navItems`: nombre e icono de las opciones de navegación del panel. `visibleNav` filtra la lista según el rol; esa condición protege la visibilidad de opciones. No la cambies para ajustar solo el aspecto.

### Páginas de entrada

- `Landing()`: entrega el control de la página pública a `LandingHost.tsx`.
- `Login({ onLogin })`: guarda correo y contraseña en estado local, llama `/auth/login`, conserva el token de sesión y muestra el error recibido si el inicio falla. La API decide si hay que cambiar la clave antes de abrir el panel.

### Panel y módulos

- `Dashboard({ user, onLogout })`: arma la navegación lateral y superior, consulta `/dashboard` y `/programs`, dibuja el resumen y muestra el módulo seleccionado. Los grupos `navSections` solo ordenan opciones que ya pasaron el filtro de rol.
- `ModuleHeading(...)` y `ModuleNotice(...)`: encabezado y aviso reutilizables para módulos.
- `EnrollmentWorkspace()`: consulta y gestiona solicitudes de matrícula.
- `EducatorWorkspace()`: muestra grupos del educador y acciones de asistencia o evaluación.
- `MyPortal()`: espacio personal de estudiantes y acudientes.
- `GroupsWorkspace()`: consulta y administra grupos, cupos y horarios.
- `TeachersWorkspace()`: consulta y administra educadores.
- `ReportsWorkspace()`: prepara y exporta reportes.
- `MaintenanceWorkspace(...)`: solicitudes, asignación, estados, evidencias y mantenimiento preventivo.
- `UsersWorkspace()`: gestión de usuarios y sus estados.
- `SettingsWorkspace()`: consulta y guarda ajustes institucionales.
- `AccountWorkspace(...)`: datos de cuenta y configuración de MFA.
- `WorkspaceRouter(...)`: traduce el texto de la opción seleccionada a su módulo.
- `WorkspaceSection(...)`: formularios y listas CRUD reutilizados para programas y estudiantes.

Para cambiar un texto de un formulario, busca su etiqueta dentro del componente del módulo. Para cambiar qué endpoint se consulta o qué campos se envían, revisa las funciones `load`, `submit`, `save`, `create` o `toggle` de ese mismo módulo.

### Recuperación, legales y rutas

- `RecoveryPage()`: solicita recuperación de cuenta.
- `ChangePasswordPage(...)`: presenta el cambio de clave y mantiene sus validaciones.
- `LegalPage(...)`: muestra privacidad o términos según la propiedad `kind`.
- `App()`: verifica si hay token, consulta `/auth/me`, implementa el cierre de sesión y define las rutas. La ruta `/panel` requiere un usuario autenticado; usuarios que deben cambiar su clave se dirigen a `/cambiar-clave`.

Para añadir o cambiar una ruta, modifica las declaraciones `<Route>` de `App()` y revisa las condiciones de acceso que ya tiene esa ruta. Un cambio de etiqueta del menú se hace en `navItems`; un cambio de permisos requiere revisar el filtro de `visibleNav` y la autorización correspondiente en el backend.

## 6. `LandingHost.tsx`, bloque por bloque

- `media`: prefijo para imágenes de `frontend/public/media/lucy/`. Así se puede cambiar la carpeta de recursos desde un solo lugar.
- `events`: cada objeto alimenta una tarjeta del carrusel. Mantén `title`, `image` y `alt`; el texto alternativo describe el afiche.
- `disciplines`: cada elemento define nombre, imagen y descripción de una disciplina.
- `programs`: cada arreglo representa número, nombre y etiqueta de una fila.
- `EventsSection()`: `trackRef` apunta al carrusel; `progress` guarda cuánto se ha desplazado. `move()` desplaza una tarjeta y `updateProgress()` actualiza la barra al hacer scroll.
- `InspirationSection()`: conserva animación de entrada, cifras, orden del mosaico y visor de obras. `gallery` contiene el nombre de archivo, descripción y pie de foto de cada obra.
- `LocationSection()`: video local en silencio y bucle, dirección y bandera.
- `ExploreSection()`: repite `disciplines` para crear las tarjetas interactivas.
- `ProgramsSection()`: repite `programs` para armar la lista formativa.
- `LandingHost()`: monta navegación, pilares, hero, eventos, biografía, ubicación, exploración, programas, CTA y footer en ese orden.

Al agregar una imagen, guárdala en `frontend/public/media/lucy/`, usa una ruta absoluta que empiece por `/media/lucy/` y define `alt` descriptivo. Para adornos que no aportan información usa `alt=""`. Mantén `loading="lazy"` y `width`/`height` en imágenes de contenido para evitar saltos mientras cargan.

## 7. Cómo funcionan los estilos

### `styles.css`

Contiene estilos comunes y estilos base de las pantallas. Sus primeras reglas cargan Manrope y DM Serif Display. El bloque `:root` define valores globales; los estilos de cada área aparecen después.

### `portal-theme.css`

Se importa después de `styles.css`. Aquí están la identidad de acceso, recuperación, páginas legales y panel. Los selectores `.dashboard#panel` limitan el tema al panel; el resto de páginas no hereda esos ajustes.

### `components/landing/landing.css`

Controla la portada pública. Su mapa está al inicio y las secciones principales tienen rótulos como `Navegación`, `Hero`, `Carrusel`, `Ubicación` y `Programas`. Hay reglas antiguas y sobreescrituras posteriores: el navegador las combina en orden. Para editar la biografía, usa el bloque final `Biografía editorial`, que contiene también el breakpoint móvil y las preferencias de movimiento reducido.

### Variables de identidad de la portada

Al inicio de `landing.css`, dentro de `.lucy-landing`, están las variables más útiles:

| Variable | Uso |
|---|---|
| `--primary-color` | Rojo de identidad y llamadas principales |
| `--tertiary-color` | Amarillo de acento |
| `--text-color` | Texto principal |
| `--pine` | Verde institucional |
| `--paper` | Fondo claro |
| `--paper-warm` | Fondo crema cálido |

Busca el nombre de una clase que aparece como `className` en JSX para encontrar su diseño. En CSS, `@media (max-width: 767px)` contiene la adaptación móvil. Las reglas `:hover` describen el cursor; `:focus-visible` describe la navegación con teclado.

**Fuentes:** `styles.css` descarga Manrope y DM Serif Display desde Google Fonts. Algunas reglas mencionan Poppins y Monument Extended como primera opción, pero esas familias no tienen archivo local ni importación en este proyecto; el navegador usa Manrope u otra alternativa cuando no están instaladas. No instales fuentes para editar colores o tamaños.

## 8. Cambios comunes paso a paso

### Cambiar una frase de la portada

1. Abre `LandingHost.tsx`.
2. Busca el componente que contiene esa frase (`InspirationSection`, `LocationSection`, etc.).
3. Cambia solo el texto entre las etiquetas JSX.
4. Guarda el archivo y recarga el navegador.

### Cambiar la imagen de una tarjeta

1. Copia el archivo en `frontend/public/media/lucy/`.
2. Cambia el campo `image` en la lista que alimenta esa tarjeta.
3. Actualiza `alt` con una descripción breve de lo que se ve.
4. No cambies la función `map()` salvo que quieras cambiar cómo se dibujan todas las tarjetas.

### Cambiar el tamaño o el color de un elemento

1. Inspecciona el JSX y copia la clase de `className`.
2. Busca `.esa-clase` en la hoja CSS indicada en la tabla de la sección 4.
3. Edita la regla vigente y revisa también su `@media` móvil.
4. Si el cambio afecta toda la identidad, ajusta primero las variables existentes en vez de repetir un color en muchos selectores.

### Cambiar un módulo conectado a la API

1. Encuentra el componente en `App.tsx` por su título o nombre.
2. Lee la función que carga datos (`load`) y el `useEffect` que la llama.
3. Lee la función que envía cambios (`submit`, `save`, `create`, etc.).
4. Conserva nombres de campos y rutas que espera el backend; cambiar solo una etiqueta visible no requiere cambiar la API.

## 9. Comprobar una edición

Desde la carpeta `frontend`, ejecuta:

```powershell
npm run build
```

Este comando verifica TypeScript y compila para producción. No instala paquetes. Si aparece un error, empieza por el archivo y número de línea que indique la consola; en JSX suelen ser etiquetas sin cerrar, llaves desbalanceadas o nombres mal escritos.
