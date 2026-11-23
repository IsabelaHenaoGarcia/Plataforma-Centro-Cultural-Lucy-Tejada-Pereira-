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
- [Configuración para despliegue](#configuración-para-despliegue)
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


## Seguridad

- No subas `.env`, contraseñas, tokens, claves privadas ni datos personales.
- El repositorio ignora archivos `.env` mediante `.gitignore`.
- Las cuentas demo y el contenido creado por el seed son ficticios.
- Cambia la contraseña demo y los secretos antes de publicar una demo accesible por internet.
- No uses la base local ni las cuentas demo para guardar información real.

## Documentación adicional

- [Documentación de arquitectura](docs/architecture/README.md)
- [Documentación de API](docs/api/README.md)
- [Documentación de base de datos](docs/database/README.md)
- [Manuales del proyecto](docs/manuals/README.md)
- [Guía del frontend](docs/manuals/FRONTEND.md)
- [Pruebas](docs/testing/README.md)
- [Preparación para publicación](docs/release/READINESS.md)
