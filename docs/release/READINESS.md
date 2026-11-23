# Alistamiento de versión y asuntos institucionales

Este documento separa lo implementado en el repositorio de lo que depende del cliente o de infraestructura. No declarar listo para producción hasta cerrar las validaciones marcadas como externas.

## Mejoras incluidas en esta entrega

- El registro opcional de género está disponible para filtrar reportes estudiantiles junto con barrio, ciudad, programa y grupo.
- El resumen consulta también evaluaciones cualitativas y matrículas retiradas.
- La campana del panel abre las notificaciones reales del usuario y permite marcarlas como leídas. El portal de estudiantes y acudientes ya tenía la bandeja.
- Los cambios de horario y las evaluaciones producen avisos para estudiante y acudiente. El correo sale cuando SMTP está configurado.
- El backend genera una vez al día, a las 18:00 hora de Colombia, un recordatorio de las clases del día siguiente para estudiantes y acudientes. Una clave única evita repetirlo si el proceso revisa más de una vez.
- La solicitud de matrícula desde el portal exige aceptación expresa del aviso y guarda el consentimiento asociado al estudiante. Si un acudiente la presenta, queda como sujeto que autorizó.
- Estudiante/acudiente puede consultar sus autorizaciones y solicitar revocación; los cambios se registran en auditoría.
- El esquema tiene una migración inicial versionada; Compose transmite secretos, URL permitidas y configuración SMTP desde `.env`.

## Antes de una base nueva

1. Configura una base PostgreSQL persistente y los secretos de producción en un gestor seguro.
2. Configura SMTP y verifica recepción, rebotes y remitente autorizado.
3. Configura HTTPS en un proxy o servicio de entrada delante de la API y la web. En producción, establece `FRONTEND_URL` al origen HTTPS real y `VITE_API_URL` a la API HTTPS real.
4. Ejecuta `npm run db:generate`, `npm --workspace backend run db:deploy` y los pasos de seed aprobados para el entorno. No cargues cuentas demo ni contraseñas conocidas en producción.
5. Publica la web y API en staging, completa pruebas del documento `docs/testing/README.md`, respalda y ensaya restauración antes de promover.

## Si la base ya usa `prisma db push`

No ejecutes la migración inicial encima de las tablas existentes: puede fallar porque intenta crearlas. Haz primero una copia. Comprueba que el esquema desplegado coincide con `database/prisma/schema.prisma`, y marca `20261120000000_initial` como aplicada mediante `prisma migrate resolve --applied 20261120000000_initial`. Después ejecuta `prisma migrate deploy`. Para nuevas diferencias, genera migraciones adicionales y revísalas; no vuelvas a usar `db push` en producción.

## Pendientes que requieren a la institución o a operaciones

- Aprobación del responsable, contacto, finalidades, retención, derechos y texto final del aviso de privacidad/términos; el texto actual es un borrador y no acredita cumplimiento de la Ley 1581 ni de su reglamentación.
- Definir autorización verificable para menores, canales de revocación y quién puede registrar o consultar esos consentimientos. La aceptación del portal solo captura la decisión y no reemplaza la aprobación legal.
- Hosting, dominio, certificados TLS, reglas de red, almacenamiento privado durable, SMTP institucional, secretos y cuentas de operación.
- Política de backups y recuperación, monitoreo, objetivo de disponibilidad del 99,9 %, escalamiento horizontal y gestión de incidentes.
- Prueba de carga de 200 usuarios; tiempos de respuesta; pruebas de navegadores y WCAG 2.1 AA; y aceptación formal por los representantes requeridos.
- Definición oficial de género/categorías institucionales. El campo actual es opcional y el filtro compara las opciones previstas en el formulario; la institución debe confirmar si esas categorías son adecuadas.

El estado de estas garantías no se puede afirmar desde una compilación local. Se debe guardar evidencia de la configuración, ejecución de pruebas y aprobaciones antes de la salida a producción.
