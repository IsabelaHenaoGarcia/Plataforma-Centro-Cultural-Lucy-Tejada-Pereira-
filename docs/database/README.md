# Modelo entidad-relación

El esquema autoritativo es [`../../database/prisma/schema.prisma`](../../database/prisma/schema.prisma). Este diagrama resume los vínculos principales; auditoría, consentimiento, sesiones de acceso y mantenimiento preventivo también están modelados en Prisma.

```mermaid
erDiagram
  USER ||--o{ AUDIT_LOG : genera
  USER ||--o{ LOGIN_ATTEMPT : registra
  USER ||--o{ ATTENDANCE_SESSION : imparte
  USER ||--o{ EVALUATION : escribe
  STUDENT ||--o{ ENROLLMENT : solicita
  PROGRAM ||--o{ ENROLLMENT : recibe
  GROUP o|--o{ ENROLLMENT : organiza
  PROGRAM ||--o{ GROUP : ofrece
  TEACHER o|--o{ GROUP : orienta
  CLASSROOM o|--o{ GROUP : aloja
  VENUE ||--o{ CLASSROOM : contiene
  GROUP ||--o{ SCHEDULE : programa
  GROUP ||--o{ ATTENDANCE_SESSION : convoca
  ATTENDANCE_SESSION ||--o{ ATTENDANCE : registra
  STUDENT ||--o{ ATTENDANCE : participa
  STUDENT ||--o{ EVALUATION : recibe
  GROUP ||--o{ EVALUATION : contextualiza
  STUDENT ||--o{ STUDENT_GUARDIAN : vincula
  GUARDIAN ||--o{ STUDENT_GUARDIAN : representa
  VENUE ||--o{ MAINTENANCE_REQUEST : reporta
  USER ||--o{ MAINTENANCE_REQUEST : solicita
  MAINTENANCE_REQUEST ||--o{ MAINTENANCE_HISTORY : cambia
  MAINTENANCE_REQUEST ||--o{ MAINTENANCE_EVIDENCE : evidencia
  MAINTENANCE_REQUEST ||--o{ MAINTENANCE_ASSIGNMENT : asigna
```

Los nombres del diagrama resumen modelos Prisma. Las claves únicas incluyen correo, documento estudiantil, nombre de programa, número de solicitud, sesión por grupo/fecha y asistencia por estudiante/sesión.
