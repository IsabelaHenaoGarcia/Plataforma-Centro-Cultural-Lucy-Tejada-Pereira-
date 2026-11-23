# Instalación y administración local

Para editar la interfaz, consulta la [Guía del frontend](./FRONTEND.md), que explica la estructura, los componentes, las rutas y los estilos.

1. Copia `.env.example` a `.env`; reemplaza `JWT_SECRET` y `MFA_ENCRYPTION_KEY` por secretos aleatorios estables.
2. Inicia PostgreSQL con `docker compose up -d database`.
3. Para la demo local ejecuta `npm install`, `npm run db:generate`, `npm --workspace backend run db:push` y `npm run db:seed`. En una base nueva administrada usa `npm --workspace backend run db:deploy`; si ya se sincronizó con `db push`, respalda y marca el baseline descrito en `docs/release/READINESS.md` antes del despliegue.
4. Inicia la API y el frontend con `npm run dev`.
5. Accede a http://localhost:5173 con una cuenta ficticia descrita en el README raíz; la contraseña se controla con `SEED_PASSWORD`.

La variante contenedorizada local se inicia con `docker compose up --build`; sincroniza el esquema y carga el seed automáticamente. `docker compose down` conserva volúmenes; `docker compose down -v` elimina datos locales. Para desplegar en un entorno persistente, usa migraciones Prisma, SMTP, HTTPS con proxy inverso, almacenamiento privado y respaldos externos. No uses datos reales de menores hasta que la institución apruebe aviso y consentimiento.
