# Base de datos

PostgreSQL es la persistencia única del sistema. El modelo fuente vive en `prisma/schema.prisma`; Prisma Client se genera en el workspace del backend.

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
```

Las entidades cubren usuarios/roles, estudiantes y acudientes, programas, educadores, grupos, espacios y horarios, matrículas, asistencia, evaluación cualitativa, notificaciones, mantenimiento, evidencia, auditoría, intentos de acceso, consentimiento y refresh tokens. El seed solo contiene nombres/programas ficticios; no son estadísticas oficiales.

Respaldo: `docker compose exec -T database pg_dump -U pgclt pgclt > backup.sql`. Restauración de desarrollo: `Get-Content backup.sql | docker compose exec -T database psql -U pgclt pgclt`. Guarda copias fuera del volumen en un destino protegido.
