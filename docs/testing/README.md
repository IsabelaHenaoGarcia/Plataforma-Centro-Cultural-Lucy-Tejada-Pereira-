# Validación, cobertura y criterios de liberación

## Comandos de comprobación

Desde la raíz del repositorio, con dependencias instaladas y PostgreSQL configurado:

```powershell
npm run build
npm --workspace backend test
npm run db:generate
npm --workspace backend run db:deploy
```

`prisma validate` valida el esquema sin conectarse a una base. `db:deploy` sí necesita que `DATABASE_URL` apunte a la base de destino. Para una base de demostración ya creada con `db push`, sigue primero el procedimiento de baseline descrito en el README raíz.

## Cobertura automatizada actual

Las pruebas unitarias ejercitan conflictos de horarios, transiciones y cierre de mantenimiento con evidencia, y neutralización de fórmulas CSV. El build de TypeScript y Vite y la validación de Prisma también se deben ejecutar antes de integrar cambios. No hay aún pruebas HTTP automatizadas ni cobertura de interfaz con navegadores.

## Validaciones pendientes antes de producción

- Pruebas HTTP y de integración con PostgreSQL para matrícula concurrente, roles, MFA, consentimiento, asistencia, evaluación, notificaciones, mantenimiento y exportaciones.
- Prueba de carga con 200 usuarios simultáneos y medición de las operaciones críticas con objetivo inferior a 4 s.
- Revisión visual y de teclado con Chrome, Firefox, Edge y Safari en escritorio, tableta y móvil; auditoría manual/automática de WCAG 2.1 AA.
- Pruebas de recuperación de copias de seguridad, monitoreo y ensayo de despliegue con rollback en un entorno staging.
- Aceptación documentada por al menos un representante estudiante, educador y administrativo, y validación del módulo de mantenimiento por la Oficina de Escenarios.

Estos puntos requieren base y servicios de staging, representantes institucionales y datos de prueba aprobados. La existencia de rutas o controles en el código no reemplaza su verificación operacional.
