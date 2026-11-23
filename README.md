# Plataforma Centro Cultural Lucy Tejada

Plataforma web para explorar la oferta cultural del Centro Cultural Lucy Tejada y gestionar sus procesos formativos. Incluye una página pública y espacios de trabajo para los distintos roles del sistema.

> **Demo:** los datos y usuarios creados por el seed son ficticios. No uses estas cuentas ni esta configuración para información real o en producción.

## Contenido

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Requisitos](#requisitos)
- [Instalación y ejecución local](#instalación-y-ejecución-local)
- [Usuarios demo](#usuarios-demo)
- [Scripts disponibles](#scripts-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Despliegue gratuito con Neon, Render y Vercel](#despliegue-gratuito-con-neon-render-y-vercel)
- [Verificación y solución de problemas del despliegue](#verificación-y-solución-de-problemas-del-despliegue)
- [Seguridad](#seguridad)
- [Documentación adicional](#documentación-adicional)

## Características

- Página pública del Centro Cultural y sus programas.
- Inicio de sesión con acceso según el rol de la cuenta.
- Gestión de estudiantes, programas, grupos y matrículas.
- Herramientas para educadores, como asistencia y seguimiento.
- Espacios para estudiantes y acudientes.
- Módulos de solicitudes y tareas de mantenimiento.
- Consultas y exportación de información.
- API con validación de datos y conexión a PostgreSQL.

## Tecnologías

- **Frontend:** React, Vue 3, TypeScript y Vite.
- **Componentes e interacción:** React Router, Axios, React Hook Form y Lucide.
- **Gráficos:** Recharts.
- **Backend:** Node.js, Express y TypeScript.
- **Base de datos:** PostgreSQL.
- **ORM y esquema:** Prisma.
- **Validación:** Zod.
- **Ejecución local de PostgreSQL:** Docker Compose.

## Requisitos

Instala estas herramientas antes de comenzar:

- [Node.js](https://nodejs.org/) — versión 20 recomendada.
- npm, incluido con Node.js.
- [Git](https://git-scm.com/downloads).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) para ejecutar PostgreSQL localmente con Docker Compose.

Comprueba las instalaciones desde Git Bash:

```bash
node --version
npm --version
git --version
docker --version
docker compose version
```

## Instalación y ejecución local

### 1. Clona el repositorio

```bash
git clone https://github.com/IsabelaHenaoGarcia/Plataforma-Centro-Cultural-Lucy-Tejada-Pereira-.git
cd Plataforma-Centro-Cultural-Lucy-Tejada-Pereira-
```

### 2. Crea el archivo de configuración local

El archivo `.env` contiene configuración privada y no debe subirse a GitHub. Créalo en la raíz del proyecto:

```bash
cat > .env <<'EOF'
DATABASE_URL=postgresql://pgclt:pgclt_dev@localhost:5433/pgclt?schema=public
JWT_SECRET=reemplaza_este_valor_por_un_secreto_largo_y_unico
MFA_ENCRYPTION_KEY=reemplaza_este_valor_por_otro_secreto_largo_y_unico
API_PORT=4000
FRONTEND_URL=http://localhost:5174,http://127.0.0.1:5174
VITE_API_URL=http://localhost:4000/api
SEED_PASSWORD=Demo-PGC-LT-2026!
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
EOF
```

Cambia los valores de `JWT_SECRET` y `MFA_ENCRYPTION_KEY` por secretos largos y únicos. No compartas el archivo `.env`.

### 3. Instala las dependencias

```bash
npm install
```

### 4. Inicia PostgreSQL

Abre Docker Desktop y espera a que esté iniciado. Después, desde la carpeta del proyecto:

```bash
docker compose up -d database
```

La base de datos local estará disponible en el puerto `5433`.

### 5. Prepara la base de datos y los usuarios de demostración

```bash
npm run db:generate
npm --workspace backend run db:push
npm run db:seed
```

El seed crea las cuentas demo y algunos registros de muestra. Si cambias `SEED_PASSWORD` en `.env`, el seed usará ese valor como contraseña demo.

### 6. Ejecuta la aplicación

```bash
npm run dev
```

Abre la página en:

- **Sitio web:** http://localhost:5174
- **API:** http://localhost:4000
- **Estado de la API:** http://localhost:4000/api/health

Mantén abierta la terminal mientras uses la aplicación. Para detener los procesos, presiona `Ctrl + C`.

## Usuarios demo

Después de preparar la base de datos y ejecutar el seed, puedes iniciar sesión con cualquiera de estas cuentas:

| Perfil | Correo |
|---|---|
| Superadministración | `super_admin@demo.pgclt.local` |
| Administración | `administrativo@demo.pgclt.local` |
| Coordinación | `coordinador@demo.pgclt.local` |
| Educador | `educador@demo.pgclt.local` |
| Estudiante | `estudiante@demo.pgclt.local` |
| Acudiente | `acudiente@demo.pgclt.local` |
| Jefatura de mantenimiento | `jefe_mantenimiento@demo.pgclt.local` |
| Técnico de mantenimiento | `tecnico_mantenimiento@demo.pgclt.local` |

**Contraseña demo predeterminada:** `Demo-PGC-LT-2026!`

Estas cuentas son para una instalación local de demostración. No uses esta contraseña en un entorno público. Si publicas una demo, cambia la contraseña y evita cargar información personal real.

## Scripts disponibles

Desde la raíz del repositorio:

| Comando | Función |
|---|---|
| `npm run dev` | Inicia el frontend y la API en modo desarrollo. |
| `npm run dev:web` | Inicia solo el frontend. |
| `npm run dev:api` | Inicia solo la API. |
| `npm run build` | Compila el backend y el frontend. |
| `npm run db:generate` | Genera el cliente de Prisma. |
| `npm --workspace backend run db:push` | Sincroniza el esquema Prisma con la base local. |
| `npm --workspace backend run db:deploy` | Aplica migraciones existentes en un entorno preparado para despliegue. |
| `npm run db:seed` | Crea o actualiza los usuarios y datos ficticios de demostración. |

## Estructura del proyecto

```text
PGC-LT/
├── backend/                 # API Express y lógica del servidor
│   └── src/
├── database/
│   └── prisma/
│       ├── schema.prisma    # Modelo de datos
│       └── seed.ts          # Usuarios y datos demo
├── docs/                    # Documentación técnica y manuales
├── frontend/                # Interfaz web React/Vue con Vite
│   └── src/
├── docker-compose.yml       # PostgreSQL local
├── package.json             # Workspaces y comandos generales
└── .env                     # Configuración local; no subir a Git
```

## Despliegue gratuito con Neon, Render y Vercel

La versión publicada separa los tres servicios:

| Parte | Plataforma | Función |
|---|---|---|
| Base de datos PostgreSQL | [Neon](https://neon.tech/) | Guarda usuarios, programas, matrículas y demás información de la aplicación. |
| API Express | [Render](https://render.com/) | Atiende las solicitudes del frontend y consulta Neon. |
| Aplicación web Vite | [Vercel](https://vercel.com/) | Publica la interfaz del proyecto. |

Esta configuración sirve para una demostración. Los planes gratuitos tienen límites, el servicio de Render puede dormir cuando está inactivo y el disco local de Render no conserva archivos subidos al reiniciarse. No almacenes información real de estudiantes en esta demo.

### 1. Crear la base de datos en Neon

1. Crea un proyecto PostgreSQL en Neon.
2. En el proyecto, abre **Connect** y copia la cadena de conexión de PostgreSQL. Si Neon ofrece una opción pooled, se puede usar para la API. La cadena debe conectarse con SSL; Neon suele incluir `sslmode=require`.
3. Guarda la cadena como `DATABASE_URL` en el `.env` local, en la raíz del proyecto. No subas ese archivo a GitHub ni lo agregues a Vercel.
4. Desde Git Bash, con el `.env` local apuntando a Neon, instala dependencias y prepara la base:

```bash
npm install
npm run db:generate
npm --workspace backend run db:push
npm run db:seed
```

`db:push` crea o sincroniza el esquema Prisma de esta versión demo. `db:seed` agrega las cuentas y registros ficticios. Ejecuta estos comandos una vez sobre la base de demo; no ejecutes el seed en cada inicio del servidor.

Si una contraseña de Neon se compartió o quedó expuesta, rótala desde **Neon → proyecto → rama → Roles → menú del rol → Reset password** y actualiza `DATABASE_URL` en cada lugar donde se utilice. Consulta la [documentación de roles de Neon](https://neon.com/docs/manage/roles#reset-a-password).

### 2. Publicar la API en Render

1. Conecta GitHub a Render y crea **New → Web Service** usando este repositorio y la rama `main`.
2. Deja **Root Directory** vacío para que los comandos puedan usar los npm workspaces de la raíz.
3. Configura:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm exec --workspace backend -- prisma generate --schema=../database/prisma/schema.prisma && npm --workspace backend run build && cp backend/src/domain.js backend/dist/domain.js` |
| Start Command | `npm --workspace backend run start` |
| Instance Type | Free para demostración |

El `--include=dev` instala los tipos de TypeScript requeridos durante la compilación. El paso `cp` copia `domain.js` al directorio compilado que necesita el servidor.

4. En **Environment**, agrega estas variables. Los secretos se generan en privado; no los copies desde este README:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Cadena nueva de Neon, con SSL habilitado |
| `API_PORT` | `10000` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Secreto aleatorio largo y privado |
| `MFA_ENCRYPTION_KEY` | Otro secreto aleatorio largo y privado |
| `FRONTEND_URL` | Dominio de producción asignado por Vercel, sin `/` al final |
| `SEED_PASSWORD` | Opcional; contraseña que usa el seed al crear/actualizar cuentas demo |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Opcionales; configuración del servicio de correo |

`FRONTEND_URL` se puede completar o actualizar después de publicar el frontend. Si Render cambia una variable, guarda los cambios y vuelve a desplegar el servicio.

5. Después del despliegue, Render asigna una dirección pública. Comprueba la API abriendo:

```text
https://TU-SERVICIO.onrender.com/api/health
```

La respuesta esperada contiene `"status":"ok"`.

### 3. Publicar el frontend en Vercel

1. En Vercel, importa el repositorio de GitHub. El frontend está en `frontend`; selecciónalo como proyecto independiente si Vercel muestra la lista de aplicaciones del monorepo.
2. Configura el proyecto:

| Campo | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

3. En **Settings → Environment Variables**, crea `VITE_API_URL` con el valor `/api`, para **Production** y **Preview**. El tipo debe ser **Config** (público), no **Secret**: las variables `VITE_*` forman parte del código enviado al navegador, y `/api` no contiene credenciales.
4. El archivo [`frontend/vercel.json`](frontend/vercel.json) reenvía las solicitudes `/api/...` a la API de Render y devuelve el frontend para las rutas de la aplicación. Si cambia el dominio de Render, actualiza el destino de ese archivo y súbelo a GitHub.
5. Cuando Vercel asigne el dominio de producción, vuelve a Render y establece `FRONTEND_URL` con ese origen exacto, por ejemplo `https://mi-sitio.vercel.app`, sin barra final.
6. Si cambias una variable de entorno en Vercel, vuelve a desplegar para que Vite reconstruya la aplicación con el nuevo valor.

Vercel y Render están conectados a GitHub; los nuevos commits en `main` pueden iniciar despliegues automáticos. La [guía de monorepos de Vercel](https://vercel.com/docs/monorepos) explica la configuración de directorios de aplicaciones dentro del repositorio.

### 4. Credenciales de demostración en producción

El seed crea estas cuentas ficticias. Todas usan el valor de `SEED_PASSWORD`; por defecto, la contraseña es `Demo-PGC-LT-2026!` si no se configuró otra al ejecutar el seed.

| Perfil | Correo |
|---|---|
| Superadministración | `super_admin@demo.pgclt.local` |
| Administración | `administrativo@demo.pgclt.local` |
| Coordinación | `coordinador@demo.pgclt.local` |
| Educador | `educador@demo.pgclt.local` |
| Estudiante | `estudiante@demo.pgclt.local` |
| Acudiente | `acudiente@demo.pgclt.local` |
| Jefatura de mantenimiento | `jefe_mantenimiento@demo.pgclt.local` |
| Técnico de mantenimiento | `tecnico_mantenimiento@demo.pgclt.local` |

Estas credenciales son compartidas y sirven solo para probar datos ficticios. Si `SEED_PASSWORD` cambió, la contraseña activa será la configurada al ejecutar el seed. No las uses para datos reales ni para una operación institucional.

## Verificación y solución de problemas del despliegue

1. Abre `https://TU-SERVICIO.onrender.com/api/health`; debe responder `status: ok`.
2. Abre `https://TU-DOMINIO.vercel.app/api/health`; debe llegar a la misma API a través de la reescritura de Vercel.
3. Abre el dominio de Vercel, inicia sesión con una cuenta demo y confirma que carga el panel.
4. Si `/api/health` funciona pero iniciar sesión falla, revisa que Neon tenga el esquema y los usuarios seed, que Render use el `DATABASE_URL` actual y que `FRONTEND_URL` sea el dominio de Vercel exacto.
5. Si Vercel muestra una página 404 en `/api/health`, confirma que `frontend/vercel.json` esté incluido en el despliegue de producción y que el destino apunte al dominio vigente de Render.


## Documentación adicional

- [Documentación de arquitectura](docs/architecture/README.md)
- [Documentación de API](docs/api/README.md)
- [Documentación de base de datos](docs/database/README.md)
- [Manuales del proyecto](docs/manuals/README.md)
- [Guía del frontend](docs/manuals/FRONTEND.md)
- [Pruebas](docs/testing/README.md)
- [Preparación para publicación](docs/release/READINESS.md)
