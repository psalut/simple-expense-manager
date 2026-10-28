# Casa — Especificación técnica y seguimiento

**Versión documental:** v0.8 (ingresos personales) · **Actualizado:** 27 de octubre de 2026
**Documento complementario:** `Idea_producto_gestor_gastos_v0.7_2026-10-27_actualizada.md`

## 0. Estado verificado y alcance

La aplicación para **dos usuarios y un único espacio compartido Casa** está publicada en Vercel y funciona como PWA online en iPhone. Neon fue reiniciado de forma controlada y se aplicaron las migraciones `0000_initial_v07.sql` y `0001_single_household.sql`, más el seed de 8 categorías. Las dos cuentas fueron creadas, Casa vincula a sus integrantes y el registro público fue cerrado; el usuario confirmó pruebas funcionales correctas después del despliegue.

**Última mejora:** el agente implementó caché y optimizaciones de navegación en `perf/navigation-caching`, **sin commit ni despliegue confirmado**. La validación funcional local fue satisfactoria según el usuario y `pnpm build` pasó con Turbopack. Esta mejora no debe documentarse como publicada hasta completar el merge a `main` y la publicación de Vercel.

**Cambio local:** se implementaron ingresos exclusivamente personales y se generó `0002_personal_incomes.sql`. El código está en el árbol de trabajo; la migración aún no está aplicada y no hay commit ni despliegue.

## 1. Stack

| Capa | Tecnología / decisión |
|---|---|
| Frontend | Next.js 16.4.3 (App Router), React, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui Base UI / Rhea, diseño mobile-first |
| Backend | Route Handlers / lógica de servidor Next.js |
| Autenticación | Better Auth, cookies de sesión; registro público cerrado en producción |
| Persistencia | PostgreSQL en Neon; Drizzle ORM y migraciones SQL (`expenses` e `incomes`) |
| IA | Jev (`jev-latest`) mediante HTTP directo a TypeSafe AI |
| Caché cliente | TanStack Query v5 — implementada en `perf/navigation-caching` |
| Hosting | Vercel (producción desde rama `main`) |
| PWA | Manifest nativo Next.js, íconos definitivos, `standalone`, online-only |

## 2. Dominio y modelo de datos

Se mantienen las tablas de autenticación, `shared_spaces`, `shared_space_members`, `shared_space_invitations`, `categories` y `expenses`; `incomes` guarda ingresos personales separados. La refactorización restringe la experiencia a **un solo grupo global llamado Casa**, con hasta dos integrantes. Los controles de integridad y permisos siguen en el servidor y la base; no depender únicamente de ocultar pantallas o selectores.

### Reglas

- **Casa:** único espacio compartido, nombre fijado a Casa; segundo integrante vinculado mediante invitación. Sin selector de grupo al crear gastos.
- **Privado:** gasto visible únicamente para su autor/pagador en el historial personal.
- **Compartido:** gasto único asociado a Casa, visible a ambos en Casa, editable/eliminable solo por su autor. En Gastos aparece solamente si lo registró quien consulta y se identifica con un ícono accesible.
- **Reparto de Casa:** 50/50 automático; con centavos impares, el pagador asume el centavo excedente. Los balances y deudas de Casa se derivan exclusivamente de gastos compartidos. Casa muestra solo el estado y monto del saldo del usuario autenticado en una fila de ancho completo, sin desglose; Grey Olive identifica saldo a favor, Bordó deuda y neutro el saldo equilibrado.
- **Identidad visual del pagador:** las dos personas del grupo reciben un color de badge según el orden estable de sus IDs: Grey Olive con texto blanco para la primera y Bone con texto negro para la segunda. La asignación no es aleatoria.
- **Moneda:** ARS, montos almacenados y calculados en centavos enteros (`BIGINT`/`BigInt`), sin redondeos con coma flotante. El campo agrupa los miles con puntos en tiempo real y acepta coma o punto para ingresar hasta dos decimales; si se ingresa una parte decimal, muestra dos cifras (por ejemplo, `1020.8` → `1.020,80`).
- **Total mensual personal:** suma exacta de los gastos del mes registrados/pagados por el usuario, privados y compartidos una sola vez.
- **Ingresos personales:** entidad `incomes` independiente, propiedad de un usuario, con importe positivo en centavos, detalle y fecha. No tiene categoría ni referencia a grupos; nunca entra en los balances o repartos de Casa.
- **Saldo personal mensual en Gastos:** ingresos del mes menos los gastos que aparecen en el historial personal del mismo mes (gastos privados y gastos compartidos pagados por el usuario, cada uno una vez). El badge de total gastado conserva su significado y suma solo gastos.
- **Categorías:** catálogo global existente; conserva nombre, descripción, color, archivado, restauración y eliminación con reemplazo cuando aplica. En `/categories`, el listado muestra nombre, color y estado; la descripción queda disponible al abrir la edición.

## 3. Navegación y UX

- Navegación inferior: **Gastos**, **Casa** (ícono corazón), **Categorías**.
- `/`: historial personal filtrado por mes con gastos e ingresos diferenciados; selector mensual; total gastado centrado bajo el mes en un badge compacto bordó con texto blanco. Debajo de la línea inferior del selector y antes del historial, mostrar el neto centrado dentro de un badge color hueso, con la etiqueta «Saldo del mes» y el mismo espacio vertical hacia la línea y hacia el primer movimiento; header compacto; alta de movimiento desde el encabezado en escritorio y un botón flotante **+** en móvil.
- `/household`: selector mensual y total del mes de los gastos compartidos de ambos integrantes, centrado bajo el mes en el mismo badge que en Gastos; fila de ancho completo con estado y monto del saldo personal, sin título, subtítulo ni desglose; lista agrupada por día con iniciales de pagador en colores de paleta asignados establemente por ID y sin lista de integrantes; alta con Compartido activado desde el encabezado en escritorio y un botón flotante **+** en móvil.
- Al crear desde Gastos, el encabezado muestra «Nuevo movimiento» junto a un selector segmentado Gasto/Ingreso, con Gasto seleccionado inicialmente. Al editar, conserva «Editar gasto» o «Editar ingreso» y no permite cambiar el tipo. Desde Casa, se mantiene «Nuevo gasto» y el flujo compartido sin selector ni opción de ingresos.
- El formulario de ingreso solo muestra importe, detalle y fecha; al alternar durante el alta se conservan importe, detalle y fecha y se limpian categoría y grupo según corresponda.
- Los círculos de perfil muestran iniciales del nombre y apellido, con fallback al correo y luego a «U» si falta el nombre. Tras confirmar una creación de movimiento, Base UI muestra un toast de éxito que se cierra automáticamente en 3,5 segundos; el viewport móvil queda por encima de la navegación inferior.
- `/categories`: administración del catálogo global; el listado muestra nombre, color y estado, y la descripción se consulta al abrir la edición de una categoría. Sin título interno «Catálogo global»; alta desde el encabezado en escritorio y un botón flotante **+** en móvil.
- Drawer en móvil / Dialog en escritorio, calendario amplio, fecha con TZ coherente en Buenos Aires, zonas táctiles adecuadas y áreas seguras en modo PWA. El toast temporal no captura eventos fuera de su propia superficie.
- Las rutas heredadas de grupos no forman parte de la navegación principal; sus redirecciones/comportamiento deben respetar la implementación actual y la autorización.

## 4. Autenticación y privacidad

- Better Auth gestiona cuentas y sesiones; `AUTH_REGISTRATION_CLOSED=true` en Vercel después del onboarding de ambas personas.
- En todos los endpoints y mutaciones se valida la sesión y la titularidad/membresía antes de leer o escribir.
- Un integrante no puede modificar ni eliminar el gasto de otro.
- Las respuestas privadas de los endpoints de datos declaran `Cache-Control: private, no-store`; **caché de aplicación en memoria** no equivale a almacenamiento HTTP compartido.
- Limpiar la caché al dejar de ser válida la sesión y evitar exponer datos de la cuenta anterior tras cerrar sesión/cambiar de usuario.
- No almacenar `DATABASE_URL`, `BETTER_AUTH_SECRET` ni `TYPESAFE_API_KEY` en cliente o Git.

## 5. Caché de navegación y consultas — implementación reciente

**Estado:** código implementado en `perf/navigation-caching`, sin merge/deploy confirmado.

### Estrategia

- TanStack Query v5 para consultas de **Gastos, Casa y Categorías**, con caché privada segmentada por usuario.
- `staleTime = 5 * 60 * 1000` (5 minutos); caché **en memoria**, no persistida.
- Invalidación de consultas afectadas tras altas, ediciones y eliminaciones, actualizando historial, totales y balances.
- **Casa:** al navegar a esa pestaña, revalidar en segundo plano aun si la caché todavía está fresca. Es necesario para detectar gastos agregados desde el teléfono de la otra persona.
- Recuperación de red / foco: aplicar las opciones de TanStack Query documentadas por la implementación, evitando afirmar que un refetch ocurre cada vez si los datos siguen frescos y no hay invalidación.
- Ante error de red, conservar los últimos datos permitidos con un estado de error/reintento adecuado; ante sesión inválida, purgar los datos privados.
- Evitar poner gastos o respuestas de sesión en cachés públicas de servidor o en service workers.

### Endpoints

`src/app/api/app-data/expenses`, `src/app/api/app-data/household`, `src/app/api/app-data/categories` y utilidades cliente en `src/lib/app-data/client.ts` según el informe del agente. Endpoints autenticados, respuestas privadas `no-store`. El endpoint de Gastos entrega gastos del mes, ingresos propios del mes y un total gastado que excluye ingresos; el cliente calcula por separado el neto mensual. Los gastos del mes y su total se obtienen juntos, manteniendo exactitud `BigInt`.

### Observabilidad

Flag opcional `APP_PERF_LOGS=true`: etiquetas estáticas y duraciones, sin IDs personales, SQL ni contenido financiero. **No se registraron métricas comparables antes/después** en los informes recibidos; no atribuir mejoras porcentuales ni tiempos concretos a esta optimización.

## 6. Jev

Se conserva el flujo preexistente de categorización automática por HTTP directo a TypeSafe AI: sugerencias sobre detalle y categorías globales activas, debounce, timeout y prioridad de elección manual. No enviar el historial de gastos ni información de terceros; un fallo de Jev no bloquea guardar. **La optimización de navegación no debe alterar este contrato.** Jev solo se ejecuta para gastos; al seleccionar Ingreso no se muestra el campo de categoría y no se solicita sugerencia.

## 7. PWA e íconos

- `src/app/manifest.ts`: nombre **Casa**, `start_url: /`, `scope: /`, `display: standalone`.
- `src/app/layout.tsx`: metadatos, Apple Web App, viewport e íconos.
- `public/icons/`: PNG estándar 192/512 y maskable 192/512; `public/apple-touch-icon.png` (180×180); `public/favicon.ico`.
- `assets/pwa/source-master-1024.png`: master conservado fuera de `public/` según informe del agente, con dimensiones reales 1254×1254 pese al nombre.
- Área segura superior en standalone, navegación inferior adaptada al dispositivo.
- Manifest/íconos verificados por HTTP en entorno local; instalación en iOS desde Chrome/Safari reportada satisfactoria tras deploy.
- **Sin service worker, caché offline, background sync ni notificaciones**.

## 8. Base de datos y migraciones

Reset autorizado y ejecutado en Neon `neondb`, proyecto `steep-pond-82785204`, rama reportada `br-round-pond-b65n8fp3`. Se eliminaron únicamente las tablas, funciones y el ledger de migraciones de la aplicación; se conservaron la base y los esquemas.

Orden aplicado en producción: `0000_initial_v07.sql` → `0001_single_household.sql`. El ledger quedó sincronizado con los hashes locales. Se ejecutó el seed y quedaron ocho categorías; inicialmente cero usuarios/gastos, seguidos por onboarding real de las dos cuentas y Casa. La nueva migración `0002_personal_incomes.sql` agrega la tabla independiente de ingresos y aún no se aplicó. **No repetir el reset**: la base ahora contiene datos reales.

Migraciones en producción deben ejecutarse de forma explícita y controlada, no como efecto secundario de `pnpm build`.

## 9. Validación

### Refactorización de Casa y producción

- En su fase de entrega: 46 unitarias y 14 de integración PASS; lint, TypeScript y build aprobados.
- Se verificó en navegador un gasto privado QA temporal y su eliminación completa sin cambios residuales.
- Después del reset: creación de dos cuentas, acceso a Casa, cierre del registro y recorrido de producción confirmados por el usuario.
- PWA instalada en iPhone; validación funcional positiva.

### Optimización de navegación (rama `perf/navigation-caching`)

- `pnpm lint`: PASS.
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm test`: **53 PASS**.
- `git diff --check`: PASS informado por el agente.
- `pnpm exec next build --webpack`: PASS informado por el agente.
- `pnpm build` (Next.js 16.4.3, Turbopack): **PASS**, repetido por el usuario; compilación optimizada en **14,1 s**, TypeScript y generación de páginas correctas.
- Prueba funcional de navegación/caché local: **satisfactoria**, confirmada por el usuario.
- Quedan sin evidencia cuantitativa tiempos de navegación antes/después y una prueba automatizada completa con dos sesiones contra Neon para esta versión de caché.

### Ingresos personales (cambio local)

- `pnpm test`: **64 PASS**.
- `pnpm lint`: PASS.
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm exec next build --webpack`: PASS.
- `pnpm build` (Turbopack) quedó más de dos minutos en `compile`; se interrumpió y se validó el build con webpack, que sí terminó correctamente.
- `git diff --check`: PASS; Git solo advirtió que normalizará CRLF a LF en los documentos.
- `pnpm test:integration` con el esquema aislado del repositorio: no llegó a iniciar pruebas porque el host de Neon no resolvió por DNS (`ENOTFOUND`). No se pudo comprobar en esta ejecución la autorización con PostgreSQL.
- La migración `0002_personal_incomes.sql` se generó, pero no se aplicó a ninguna base.

## 10. Estado Git y próximos pasos

- Rama de performance: `perf/navigation-caching`.
- **Sin commit ni merge confirmado** para esta optimización en la conversación actual.
- Commit propuesto: `perf: speed up tab navigation with client caching`.
- Flujo habitual: commit → merge directo a `main` (sin PR) → push → deployment automático en Vercel → smoke test con ambos teléfonos.
- Comprobar en producción que volver a una pestaña ya visitada es fluido, que mutaciones propias invalidan los datos afectados y que Casa revalida cambios de la otra persona al entrar.
- Pendientes no bloqueantes: experiencia ante desconexión/reintentos, evaluación posterior de Jev y ampliaciones puntuales de pruebas de seguridad HTTP/CSRF.

## 11. Límites explícitos

No introducir múltiples hogares, categorías por grupo, repartos configurables, presupuestos, liquidaciones, notificaciones, persistencia offline ni infraestructura Redis/WebSocket sin una necesidad real confirmada.

**Objetivo técnico:** navegación rápida y datos correctos para dos usuarios, sin sacrificar privacidad ni simplicidad.
