# Casa — Especificación técnica y seguimiento

**Versión documental:** v0.8 (ingresos personales) · **Revisado contra el código:** 16 de noviembre de 2026
**Documento complementario:** `Idea_producto_gestor_gastos_v0.7_2026-10-27_actualizada.md`

## 0. Estado y alcance

Esta especificación describe el código del repositorio: Casa admite hasta dos integrantes; también existen gastos e ingresos personales, reembolsos y caché cliente. Los informes anteriores registran un despliegue y una transición de datos, pero no prueban el estado actual de producción, sus migraciones o ramas. Consultar el entorno antes de operar sobre él. El historial de esa transición se conserva en [Activación de Casa](../HOUSEHOLD_TRANSITION.md).

Las altas, ediciones y bajas de gastos se proyectan optimistamente sobre el historial mensual personal y la actividad de Casa. Los ingresos y reembolsos no usan este mecanismo.

## 1. Stack

| Capa | Tecnología / decisión |
|---|---|
| Frontend | Next.js 16.4.3 (App Router), React, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui Base UI / Rhea, diseño mobile-first |
| Backend | Route Handlers / lógica de servidor Next.js |
| Autenticación | Better Auth, cookies de sesión; registro público cerrado en producción |
| Persistencia | PostgreSQL en Neon; Drizzle ORM y migraciones SQL (`expenses` e `incomes`) |
| IA | Jev (`jev-latest`) mediante HTTP directo a TypeSafe AI |
| Caché cliente | TanStack Query v5 |
| Hosting | Vercel según antecedentes; configuración actual no verificada |
| PWA | Manifest nativo Next.js, íconos definitivos, `standalone`, online-only |

## 2. Dominio y modelo de datos

Se mantienen las tablas de autenticación, `shared_spaces`, `shared_space_members`, `shared_space_invitations`, `categories` y `expenses`; `incomes` guarda ingresos personales separados. La refactorización restringe la experiencia a **un solo grupo global llamado Casa**, con hasta dos integrantes. Los controles de integridad y permisos siguen en el servidor y la base; no depender únicamente de ocultar pantallas o selectores.

### Reglas

- **Casa:** único espacio compartido, nombre fijado a Casa; segundo integrante vinculado mediante invitación. Sin selector de grupo al crear gastos.
- **Privado:** gasto visible únicamente para su autor/pagador en el historial personal.
- **Compartido:** gasto único asociado a Casa, visible a ambos en Casa, editable/eliminable solo por su autor. En Gastos aparece solamente si lo registró quien consulta y se identifica con un ícono accesible.
- **Reparto de Casa:** 50/50 automático; con centavos impares, el pagador asume el centavo excedente. Los balances y deudas de Casa se derivan de gastos compartidos y pagos activos entre integrantes. Casa muestra solo el estado y monto del saldo del usuario autenticado en una fila de ancho completo, sin desglose; Grey Olive identifica saldo a favor, Bordó deuda y neutro el saldo equilibrado.
- **Identidad visual del pagador:** las dos personas del grupo reciben un color de badge según el orden estable de sus IDs: Grey Olive con texto blanco para la primera y Bone con texto negro para la segunda. La asignación no es aleatoria.
- **Moneda:** ARS, montos almacenados y calculados en centavos enteros (`BIGINT`/`BigInt`), sin redondeos con coma flotante. El campo agrupa los miles con puntos en tiempo real y acepta coma o punto para ingresar hasta dos decimales; si se ingresa una parte decimal, muestra dos cifras (por ejemplo, `1020.8` → `1.020,80`).
- **Total mensual personal:** suma exacta de los gastos del mes registrados/pagados por el usuario, privados y compartidos una sola vez.
- **Ingresos personales:** entidad `incomes` independiente, propiedad de un usuario, con importe positivo en centavos, detalle y fecha. No tiene categoría ni referencia a grupos; nunca entra en los balances o repartos de Casa.
- **Saldo personal mensual en Gastos:** si el mes tiene al menos un ingreso, se muestra ingresos del mes menos los gastos que aparecen en el historial personal del mismo mes (gastos privados y gastos compartidos pagados por el usuario, cada uno una vez), incluso si el resultado es cero o negativo. Sin ingresos en el mes, no se muestra el saldo. El badge de total gastado conserva su significado y suma solo gastos.
- **Categorías:** catálogo global existente; conserva nombre, descripción, color, ícono, archivado, restauración y eliminación de archivadas con reemplazo activo obligatorio. En `/categories`, el listado muestra nombre, color y estado; la descripción queda disponible al abrir la edición.

## 3. Navegación y UX

- Navegación inferior: **Gastos**, **Casa** (ícono corazón), **Categorías**.
- `/`: historial personal filtrado por mes con gastos e ingresos diferenciados; selector mensual; total gastado centrado bajo el mes en un badge compacto bordó con texto blanco. Debajo de la línea inferior del selector y antes del historial, mostrar el neto centrado dentro de un badge color hueso, con la etiqueta «Saldo del mes» y el mismo espacio vertical hacia la línea y hacia el primer movimiento; header compacto; alta de movimiento desde el encabezado en escritorio y un botón flotante **+** en móvil.
- `/household`: selector mensual y total del mes de los gastos compartidos de ambos integrantes, centrado bajo el mes en el mismo badge que en Gastos; fila de ancho completo con estado y monto del saldo personal, sin título, subtítulo ni desglose; lista agrupada por día con iniciales de pagador en colores de paleta asignados establemente por ID y sin lista de integrantes; en escritorio, el botón del encabezado, y en móvil, el botón flotante **+**, abren las acciones de Casa. Con deuda activa y dos integrantes se puede elegir cargar un gasto compartido o registrar un reembolso; sin deuda, el pago queda oculto y la acción disponible abre directamente el alta de gasto. El selector es un bottom sheet en móvil y un dialog en escritorio.
- Al crear desde Gastos, el encabezado muestra «Nuevo movimiento» junto a un selector segmentado Gasto/Ingreso, con Gasto seleccionado inicialmente. Al editar, conserva «Editar gasto» o «Editar ingreso» y no permite cambiar el tipo. Desde Casa, se mantiene «Nuevo gasto» y el flujo compartido sin selector ni opción de ingresos.
- El formulario de ingreso solo muestra importe, detalle y fecha; al alternar durante el alta se conservan importe, detalle y fecha y se limpian categoría y grupo según corresponda.
- Los círculos de perfil muestran iniciales del nombre y apellido, con fallback al correo y luego a «U» si falta el nombre. Tras confirmar una creación, edición o eliminación de movimiento, Base UI muestra un toast de éxito que se cierra automáticamente en 3,5 segundos; el viewport móvil queda por encima de la navegación inferior.
- `/categories`: administración del catálogo global; el listado muestra nombre, color y estado, y la descripción se consulta al abrir la edición de una categoría. Sin título interno «Catálogo global»; alta desde el encabezado en escritorio y un botón flotante **+** en móvil.
- Drawer en móvil / Dialog en escritorio, calendario amplio, fecha con TZ coherente en Buenos Aires, zonas táctiles adecuadas y áreas seguras en modo PWA. El toast temporal no captura eventos fuera de su propia superficie.
- Las rutas heredadas de grupos no forman parte de la navegación principal; sus redirecciones/comportamiento deben respetar la implementación actual y la autorización.

## 4. Autenticación y privacidad

- Better Auth gestiona cuentas y sesiones. `AUTH_REGISTRATION_CLOSED=true` cierra el registro y limita el acceso a los dos integrantes de Casa; verificar la configuración efectiva de cada entorno.
- Recuperación administrativa sin correo: `node scripts/reset-user-password.mjs --email usuario@dominio --confirm-email usuario@dominio` solicita la nueva contraseña en una terminal sin mostrarla. Usa `DATABASE_URL` de `.env.local`, exige confirmación adicional para bases remotas y revoca las sesiones existentes. No pasar contraseñas como argumentos ni guardarlas en archivos.
- En todos los endpoints y mutaciones se valida la sesión y la titularidad/membresía antes de leer o escribir.
- Un integrante no puede modificar ni eliminar el gasto de otro.
- Las respuestas privadas de los endpoints de datos declaran `Cache-Control: private, no-store`; **caché de aplicación en memoria** no equivale a almacenamiento HTTP compartido.
- Limpiar la caché al dejar de ser válida la sesión y evitar exponer datos de la cuenta anterior tras cerrar sesión/cambiar de usuario.
- No almacenar `DATABASE_URL`, `BETTER_AUTH_SECRET` ni `TYPESAFE_API_KEY` en cliente o Git.

## 5. Caché de navegación y consultas

El comportamiento siguiente describe el código, sin afirmar su despliegue.

### Estrategia

- TanStack Query v5 para consultas de **Gastos, Casa y Categorías**, con caché privada segmentada por usuario.
- `staleTime = 5 * 60 * 1000` (5 minutos); caché **en memoria**, no persistida.
- Proyección optimista de gastos en las consultas mensuales personales y de Casa; la respuesta del servidor sigue siendo la fuente de verdad y dispara la reconciliación de las claves afectadas.
- **Casa:** al navegar a esa pestaña, revalidar en segundo plano aun si la caché todavía está fresca. Es necesario para detectar gastos agregados desde el teléfono de la otra persona.
- Recuperación de red / foco: aplicar las opciones de TanStack Query documentadas por la implementación, evitando afirmar que un refetch ocurre cada vez si los datos siguen frescos y no hay invalidación.
- Ante error de red, conservar los últimos datos permitidos con un estado de error/reintento adecuado; ante sesión inválida, purgar los datos privados.
- Evitar poner gastos o respuestas de sesión en cachés públicas de servidor o en service workers.

### Escrituras optimistas de gastos

- Los importes y totales se actualizan usando centavos enteros. Al cambiar la fecha, los meses personales anterior y nuevo se proyectan juntos; Casa filtra la actividad por el mes seleccionado y deriva su total mensual de los gastos visibles.
- Las altas usan un ID con prefijo temporal, reemplazado por el ID persistido al confirmar el servidor. Un gasto temporal no se puede abrir para editar ni eliminar.
- Las operaciones pendientes se reaplican a las respuestas de consulta antes de que TanStack Query las almacene. Las ediciones/bajas del mismo gasto se serializan para el servidor; el rollback solo modifica la entidad afectada y no repone snapshots completos.
- Las claves personales de los meses afectados y Casa (si corresponde) se invalidan al finalizar. Una operación confirmada permanece proyectada hasta que sus lecturas afectadas confirmen el resultado, incluso si el usuario navegó a otra pantalla.
- El balance acumulado de Casa continúa siendo calculado por el servidor. Mientras haya un cambio compartido pendiente de reconciliación, la interfaz muestra «Actualizando saldo acumulado…» en vez de estimar el balance.
- Al confirmar una operación válida, el editor se cierra sin esperar al servidor; la validación local fallida no lo cierra. Si el servidor falla, se revierte solo el cambio afectado y aparece un aviso persistente con una acción explícita para recuperar el borrador y reintentar. El formulario no se superpone a otro que el usuario haya abierto. El toast de éxito aparece únicamente después de la confirmación.
- Si falla la revalidación del balance acumulado de Casa, se conserva el último balance confirmado y se ofrece reintentar la consulta; no se deriva una fórmula optimista en el cliente.

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

El repositorio contiene `0000_initial_v07.sql`, `0001_single_household.sql`, `0002_personal_incomes.sql`, `0003_category_icons.sql`, `0004_category_description_1000.sql` y `0005_household_payments.sql`. La presencia de los archivos no demuestra su aplicación en ningún entorno. `pnpm db:migrate` actúa sobre `DATABASE_URL`; verificar el destino y el historial antes de ejecutarlo. No se aplican migraciones como parte del build. El repositorio no ofrece actualmente un comando de seed.

El antecedente del reset y las migraciones ejecutadas en octubre de 2026 se conserva como registro histórico en [Activación de Casa](../HOUSEHOLD_TRANSITION.md); no repetir operaciones destructivas sobre datos reales.

## 9. Reembolsos entre integrantes

La interfaz los denomina «reembolsos». `household_payments` guarda participantes, creador, importe en centavos, fecha, clave de idempotencia y anulación. Los reembolsos no permiten ingresar ni editar notas, y no se prevé solicitarlas en este flujo. La columna `note` puede conservarse por compatibilidad con datos históricos; la escritura de nuevos reembolsos no la usa. La propuesta anterior de una nota opcional quedó descartada. Cualquiera de los dos integrantes puede registrar o anular un reembolso; el servidor deriva de la deuda quién paga y recibe, comprueba que no exceda la deuda y serializa la operación con mutaciones de gastos y membresía. Para corregirlo se anula y se registra otro. La fecha no puede ser futura; no se reconstruyen saldos históricos.

El saldo acumulado es gastos pagados menos parte asignada, más reembolsos activos enviados menos recibidos. La actividad se filtra por mes, incluye anulaciones y el total mensual suma únicamente gastos. Los reembolsos no forman parte del saldo personal mensual y mantienen su flujo no optimista. No hay sincronización en tiempo real.

## 10. Verificación y pendientes

Las pruebas unitarias y de integración, lint, tipos y build se describen en el [README](../README.md). Las pruebas de integración requieren una base local descartable explícita; crean y eliminan esquemas aislados. Los resultados históricos no garantizan el estado actual. Confirmar por separado el estado de migraciones y despliegue de cada entorno.

## 11. Límites de producto

No se ofrecen múltiples hogares, categorías por grupo, repartos configurables, presupuestos, notificaciones ni persistencia offline. Los grupos anteriores a Casa conservan rutas y datos autorizados como legado; consultar [Activación de Casa](../HOUSEHOLD_TRANSITION.md).
