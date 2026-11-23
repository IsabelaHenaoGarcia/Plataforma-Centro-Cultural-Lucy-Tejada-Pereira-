# API REST — resumen de rutas

Prefijo: `/api`. Las rutas privadas requieren `Authorization: Bearer <access token>`. La renovación utiliza cookie HttpOnly y protección CSRF. Las rutas sensibles responden con `{ "error": "..." }` ante errores de validación o autorización.

| Área | Rutas principales | Acceso |
|---|---|---|
| Salud y sesión | `GET /health`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` | Salud/login públicos; demás autenticado |
| Seguridad | `POST /auth/change-password`, `/auth/recovery/request`, `/auth/recovery/complete`, `/auth/mfa/setup`, `/auth/mfa/enable`, `/auth/mfa/disable` | Público solo solicitud/completar recuperación; MFA y contraseña autenticados |
| Panel y catálogo | `GET /dashboard`, `/programs`, `/programs/:id`, `/venues`, `/classrooms`, `/groups` | Panel autenticado de personal; programas públicos; escenarios/grupos autenticados |
| Formación | CRUD/consulta de `/programs`, `/students`, `/teachers`, `/groups`, `/venues`, `/classrooms`; `GET /groups/:id/roster` | Personal según rol; CRUD administrativo restringido |
| Matrículas | `GET/POST /enrollments`, `PATCH /enrollments/:id/status`, `POST /my/enrollments`, `POST /my/guardian-enrollments` | Gestión por personal; portal estudiante/acudiente limitado a su propio perfil/vínculo |
| Perfil y acudientes | `GET/PATCH /me/profile`, `POST /student-guardians` | Perfil propio autenticado; vínculos por gestión |
| Asistencia y evaluación | `POST /attendance`, `GET /groups/:id/attendance`, `GET /students/:id/attendance`, `POST/GET /evaluations`, `/evaluation-indicators` | Docente asignado y personal según rol |
| Mantenimiento | `/maintenance`, `/maintenance/:id/status`, `/assign`, `/reopen`, `/:id/evidence`, `/maintenance/preventive`; `GET /evidence/:id` | Reporte autenticado; acciones limitadas a equipo de mantenimiento y jefatura |
| Operación | `/notifications`, `/audit-logs`, `/settings`, `/students/:id/consents`, `/consents` | Autenticado; administración/auditoría según rol |
| Reportes | `GET /reports/:kind?format=csv|xlsx|pdf` | Autenticado, con resultados limitados por rol y filtros disponibles |

Listados de estudiantes aceptan búsqueda/paginación. El reporte de estudiantes admite filtros opcionales `programId`, `groupId`, `neighborhood`, `originCity` y `gender`; los reportes también aceptan rangos `from`/`to` cuando aplican. Las evidencias no se sirven como carpeta pública: se descargan por endpoint autenticado. Para detalles de payload y filtros, consulta validadores y controladores en `backend/src/server.ts`.

Las solicitudes de inscripción propias y de acudiente desde el portal exigen `consent: true`; la decisión se registra asociada al estudiante. Los avisos se consultan en `/notifications`. Cambios de horario y evaluaciones notifican a estudiantes/acudientes vinculados. El backend revisa las clases del día siguiente a las 18:00 de `America/Bogota`; el correo solo se envía si SMTP está configurado.

La documentación OpenAPI formal y la generación interactiva Swagger aún no están implementadas. El esquema Prisma se sincroniza en el arranque de demostración con `db push`; falta la migración inicial versionada.
