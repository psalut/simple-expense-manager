# Gestor simple de gastos

App mobile-first para registrar gastos e ingresos personales, compartir gastos 50/50 en Casa (un hogar de hasta dos integrantes), registrar reembolsos y administrar categorías globales. Los grupos anteriores a Casa pueden conservarse como historial autorizado.

La [idea de producto](docs/Idea_producto_gestor_gastos_v0.7_2026-10-27_actualizada.md) describe los flujos y la [especificación técnica](docs/Especificacion_tecnica_gestor_gastos_MVP_v0.7_2026-10-27_actualizada.md) detalla reglas, persistencia y pendientes. [Activación de Casa](HOUSEHOLD_TRANSITION.md) conserva la guía de transición y un registro histórico; [DESIGN.md](DESIGN.md) documenta la dirección visual.

## Desarrollo local

1. Instalá dependencias con pnpm install.
2. Copiá .env.example a .env.local y completá la conexión PostgreSQL de desarrollo y la configuración de Better Auth.
3. Verificá que `DATABASE_URL` apunte a una base de desarrollo aislada y aplicá las migraciones con `pnpm db:migrate`.
4. Creá categorías desde la aplicación; este repositorio no contiene actualmente un comando de seed.
5. Ejecutá `pnpm dev` y abrí [http://localhost:3000](http://localhost:3000).

Para una instalación nueva, dejá el registro abierto, creá la primera cuenta y prepará Casa; generá una invitación para la segunda cuenta. Cerrá el registro solo después de comprobar el acceso de ambas. `HOUSEHOLD_SPACE_ID` es una opción privada para resolver Casa cuando hay grupos históricos; `AUTH_REGISTRATION_CLOSED=true` también restringe el acceso a sus dos integrantes. Consultá `.env.example` y la guía de transición antes de configurar un entorno existente.

Las sugerencias Jev son opcionales. Para habilitarlas, configurá `TYPESAFE_API_KEY` en el entorno de servidor. Sin esa clave, o ante errores del servicio, la app deja elegir la categoría manualmente. El umbral conservador por defecto es 0.8; se puede ajustar entre 0.5 y 1 con `CATEGORY_SUGGESTION_MIN_PROBABILITY`.

## Caché y navegación

Gastos, Casa y Categorías conservan datos autenticados en la memoria de TanStack Query v5 del navegador: cinco minutos frescos y hasta treinta minutos en memoria después de salir de una pestaña. La clave incluye el usuario; Gastos también incluye el mes. La caché no se persiste en `localStorage`, IndexedDB ni service worker.

Volver a Gastos o Categorías dentro de esos cinco minutos muestra la respuesta guardada sin volver a pedir sus datos a `/api/app-data`. Cada entrada real a Casa muestra primero la respuesta guardada y lanza una consulta de fondo, aunque siga fresca, para detectar cambios de la otra persona. En foco y reconexión se revalidan las consultas vencidas. Si falla una consulta de fondo, se conserva la vista guardada.

Las altas, ediciones y bajas de gastos esperan la confirmación del servidor: las actualizaciones optimistas son una funcionalidad pendiente. Las escrituras de gastos invalidan todos los meses de Gastos y Casa, incluidos gastos y balances compartidos; las escrituras de categorías invalidan todas las vistas privadas que contienen el catálogo. Logout y errores de sesión limpian la caché. Los endpoints de lectura vuelven a validar Better Auth y responden `private, no-store`; el servidor no conserva estas respuestas entre sesiones.

Para diagnosticar una compilación local de producción, usá una base y cuentas de desarrollo aisladas. Con `APP_PERF_LOGS=true` en el proceso de `pnpm start`, el servidor informa etiquetas de consultas y duración, sin SQL, parámetros, identidades ni datos. En DevTools, conservá el registro de Network y separá las solicitudes RSC (`?_rsc`) de `/api/app-data/*`; compará primera visita, retorno a una pestaña fresca y cada entrada a Casa. No uses una Neon que comparta datos con Vercel para crear fixtures de medición.

## PWA e instalación online

La app puede agregarse a la pantalla de inicio y abrirse en modo standalone cuando se publica bajo HTTPS. Sigue necesitando conexión a internet para iniciar sesión y usar Gastos, Casa y Categorías; no ofrece modo offline ni sincronización.

- **Android (Chrome):** abrí el dominio HTTPS, tocá el menú ⋮ y elegí **Instalar app** o **Agregar a pantalla principal**.
- **iPhone (Safari):** abrí el dominio HTTPS, tocá **Compartir** y elegí **Agregar a inicio**.

Next sirve el manifest desde `src/app/manifest.ts`. Los íconos estándar son `public/icons/icon-192x192.png` y `public/icons/icon-512x512.png`; las variantes maskable son archivos propios de 192×192 y 512×512. Apple usa `public/apple-touch-icon.png` (180×180), y el favicon ICO se sirve estáticamente desde `public/favicon.ico` para conservar sus subíconos originales. Los archivos tienen fondo opaco y deben conservarse tal como fueron entregados. `assets/pwa/source-master-1024.png` se conserva como fuente del diseño (el archivo mide 1254×1254). No hay generador local de íconos: al renovarlos, actualizá directamente esos recursos y verificá formato y dimensiones.

No se agrega service worker ni caché offline. El estado y la configuración del despliegue deben verificarse en el entorno correspondiente; el repositorio no los confirma.

## Comandos

- pnpm db:generate: genera una migración desde el esquema Drizzle actual.
- pnpm db:migrate: aplica las migraciones al DATABASE_URL configurado; verificá que sea un entorno de desarrollo antes de ejecutarlo.
- pnpm lint: ejecuta ESLint.
- pnpm exec tsc --noEmit: comprueba tipos.
- pnpm test: ejecuta las pruebas unitarias de Vitest.
- pnpm test:integration: requiere `RUN_DB_INTEGRATION=true` y `TEST_DATABASE_URL` explícita hacia PostgreSQL local descartable, con base `casa_test` o `casa_test_<sufijo>`; crea y elimina esquemas aislados. Ver `tests/integration-database.ts`.
- pnpm build: compila la app.
