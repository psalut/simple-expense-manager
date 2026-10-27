# Gestor de gastos personales y compartidos — Especificación técnica

**Versión:** 0.7 · **Actualizado:** 27 de octubre de 2026 · **Estado:** primer despliegue en Vercel realizado; PWA online implementada en `feat/pwa`, revisión y despliegue pendientes
**Documento complementario:** `Idea_producto_gestor_gastos_v0.7.md`

## 0. Estado real y alcance de esta versión

**Implementado según informes del agente y verificaciones del usuario (27/10/2026):** Next.js 16.4.3, TypeScript strict, pnpm, Tailwind 4, shadcn/ui Base UI + Rhea, Better Auth, Drizzle y PostgreSQL en Neon; varios grupos por usuario con máximo dos integrantes por grupo; invitaciones; catálogo global editable de categorías con color; gastos privados y compartidos, reparto fijo 50/50 sin `expense_shares`, listados y balances. Se implementó Jev mediante la API HTTP directa de TypeSafe AI. No se confirmó auditoría independiente de todo el código.

**Base de desarrollo reiniciada:** el usuario eliminó las tablas anteriores y confirmó haber aplicado el nuevo baseline `drizzle/0000_initial_v07.sql` y el seed idempotente `scripts/seed-categories.mjs` sobre Neon. En E2E posteriores se verificaron la conexión y las tablas del esquema v0.7. Las migraciones anteriores ya no forman parte del nuevo historial del repositorio. **No volver a ejecutar el reset** sobre la base ahora poblada.

**Pruebas:** la reejecución en navegador informó inicialmente 23 PASS, 1 FAIL, 3 BLOCKED y 2 NOT RUN de 29 casos. El usuario comprobó manualmente que la edición de fecha (E2E-12), el ciclo privado ↔ compartido (E2E-20), la sugerencia Jev con HTTP 200 (E2E-28) y la experiencia móvil (E2E-27) funcionan. El supuesto fallo de fecha queda **no reproducido en la prueba manual posterior**; no se da por corregido en código sin una investigación específica. E2E-24 aprobó **9/9 pruebas de integración con PostgreSQL real** sobre permisos de Server Actions y preservación de balances/datos; no cubre POST HTTP real/CSRF/origin de Next.js. **Queda diferida** la prueba E2E-26 de pérdida de conexión y la definición precisa de la experiencia de reintento. Afinar la calidad de sugerencias de Jev queda como mejora futura.

**Seguridad y Git:** durante las pruebas se reportó exposición de secretos de `.env.local` en una salida de herramienta. Se recomendó rotar credenciales de Neon y `BETTER_AUTH_SECRET` (y TypeSafe si correspondía); **la rotación no fue confirmada**. El usuario trabajó en `fix/mobile-ui-refinement` y después en su carpeta habitual; reportó que el refinamiento anterior ya estaba confirmado. El estado final de commits, merge y `git push` **no fue verificado de forma independiente**, aunque Vercel ya importó `main` desde GitHub. Mantener en `docs/` únicamente esta documentación técnica y la funcional, junto con tests reproducibles en código (sin reportes efímeros).

**Pendiente de MVP:** comportamiento ante fallos de red y validación funcional del sitio desplegado en dispositivos reales; instalación PWA aún pendiente de revisión, despliegue y prueba física; pruebas HTTP de protocolo/CSRF pendientes si se incorporan al plan de seguridad. **Vercel:** el usuario confirmó un primer deploy realizado el 27/10/2026; todavía no se comunicó la URL definitiva ni un recorrido funcional de producción.

## 1. Stack y arquitectura

| Componente | Decisión |
| --- | --- |
| App | Next.js App Router, monolito modular; Server Components para lecturas y Client Components para interacción |
| Lenguaje/paquetes | TypeScript strict, pnpm |
| UI | Tailwind 4 + shadcn/ui Base UI (Rhea), diseño mobile-first, skill Impeccable para revisión |
| Auth | Better Auth; sesiones autenticadas en servidor |
| Persistencia | Neon PostgreSQL + Drizzle ORM/Kit, migraciones SQL versionadas |
| Mutaciones | Server Actions protegidas, reglas concentradas en servicios de dominio |
| IA | TypeSafe AI **Jev** mediante API HTTP directa `POST https://api.typesafe.ai/v1/systemone`, modelo `jev-latest`, `fetch` en servidor y `TYPESAFE_API_KEY`; sin AI Gateway ni SDK `ai` |
| PWA/hosting | Manifest nativo de App Router, PNG estándar y maskable, Apple touch icon y favicon ICO; instalación online en modo standalone; sin service worker, offline ni caché de datos |

No agregar ORM paralelo, backend separado, Redis, colas, sockets, analítica, adjuntos, motor contable ni sincronización offline.

## 2. Modelo de datos v0.7 implementado (contrato)

Mantener tablas de Better Auth según integración efectiva del repositorio. Los nombres/columnas concretos deben adaptarse al código real; el siguiente es el **contrato de dominio v0.7**; el esquema implementado debe seguir siendo la referencia para detalles físicos.

### 2.1 `shared_spaces`

- `id`, `name`, `created_by` FK usuario, `created_at`.
- Una persona puede crear varios grupos. **No** imponer único por `created_by` ni por miembro.

### 2.2 `shared_space_members`

- `space_id`, `user_id`, `joined_at`; clave única compuesta `(space_id,user_id)`; FKs.
- Restricción **máximo dos integrantes por `space_id`**: además de la comprobación del servicio, **garantizarla en PostgreSQL frente a concurrencia**. Una restricción `CHECK(count(...))` no sirve entre filas. Implementar inserciones transaccionales con bloqueo explícito de la fila padre `shared_spaces` (y mantener una única vía de altas), o un mecanismo equivalente de integridad DB como trigger, documentando las garantías. Si el requisito es invariante incluso contra escrituras fuera del servicio, preferir constraint trigger/trigger con bloqueo para impedir terceros en cualquier ruta de inserción.
- Grupos con **uno** o **dos** integrantes son válidos. Solo los grupos de dos admiten nuevos gastos compartidos.
- No implementar bajas/expulsiones de miembros con gastos históricos en este MVP.

### 2.3 `shared_space_invitations`

- Invitación a un grupo existente mediante token impredecible hasheado, uso único, expiración (7 días en implementación previa).
- Aceptación autenticada, transaccional e idempotencia/error controlado ante duplicación. **Si el grupo ya tiene dos miembros, rechazar la invitación aunque el token sea válido**, sin consumir otro cupo. Garantizar que dos aceptaciones simultáneas no puedan dejar tres miembros.
- Una persona conserva sus otras membresías al aceptar una invitación.

### 2.4 `categories` — catálogo global

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `id` | ID estable | PK |
| `name` | VARCHAR(60) | Obligatorio, sin duplicados entre activas (normalizar mayúsculas/espacios) |
| `description` | TEXT | Obligatorio; contexto para Jev |
| `color` | VARCHAR(7) | Hexadecimal `#RRGGBB`, validación Zod/DB |
| `is_archived` | BOOLEAN | Default false; historial preservado |
| `created_at`, `updated_at` | timestamps | Metadatos |

**Eliminar del nuevo esquema** `user_id` y `shared_space_id` en categorías, índices únicos por ámbito, selectors de grupo para categoría y rutas de catálogo grupal. No mantener capas de permisos propietarias del catálogo. Cualquier usuario autenticado puede listar, crear, editar (nombre, descripción, color), archivar, restaurar y solicitar eliminación de archivadas. Prevenir nombres activos duplicados mediante índice único normalizado (preferiblemente también `trim`/espacios). Definir selección accesible del color con contraste suficiente.

**Borrado:** FK de `expenses.category_id` = `NO ACTION`/`RESTRICT`, nunca CASCADE. Eliminar categoría archivada con gastos exige reemplazo global activo distinto: actualizar referencias y eliminar en la misma transacción. Para no exponer conteos ni existencia de gastos privados ajenos, permitir exigir reemplazo en **toda** operación de borrado de archivada, aunque no tenga usos; no retornar gastos afectados ni cantidades por usuario. Proteger concurrencia con edición/alta de gastos y cambios de categoría. El reemplazo no cambia importes, visibilidad ni balances.

### 2.5 `expenses`

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `id` | ID | PK |
| `user_id` | FK usuario | Autor y pagador, inmutable; derivado de sesión |
| `amount_cents` | BIGINT | Entero positivo, ARS; sin flotantes para aritmética |
| `currency` | TEXT | `'ARS'` fijo en MVP |
| `description` | TEXT | No vacío, longitud limitada |
| `category_id` | FK categories | Categoría global activa al asignar; archivada conservable en histórico |
| `expense_date` | DATE | Obligatoria, default de UI = hoy |
| `shared_space_id` | FK nullable | NULL privado; de otro modo uno y solo un grupo completo del autor |
| `created_at`, `updated_at` | timestamps | Metadatos |

**Eliminar `expense_shares` de la arquitectura nueva**. No crear ni mantener tabla de participaciones ni opciones de reparto. Un gasto se guarda una sola vez, y comparte su visibilidad con un único grupo. Índices en `(user_id, expense_date DESC)` y `(shared_space_id, expense_date DESC)`; índice FK categoría.

La condición «grupo completo de dos integrantes» no puede garantizarse solo con FK; verificar en operación de creación/modificación y sincronizar contra cambios de membresía de forma transaccional. En el MVP, no habilitar salida/expulsión con históricos.

## 3. Regla de reparto y balances sin `expense_shares`

**Todos los gastos compartidos se dividen entre los dos miembros del grupo al que pertenecen.** No hay selección individual de participantes. El pagador puede ser cualquiera de los dos y es siempre el autor del gasto.

Algoritmo en centavos enteros:

```ts
const otherShare = amountCents / 2n;        // división entera hacia abajo
const payerShare = amountCents - otherShare; // el centavo impar corresponde al pagador
```

Ejemplo: $100,01 = 10.001 centavos → pagador 5.001; otro miembro 5.000. No hacer conversiones a `number` que pierdan precisión. El balance se deriva con aritmética BIGINT (en SQL o servicio) a partir de gastos y membresías:

`saldoUsuario = total_pagado_en_grupo − total_partes_que_le_corresponden`.

- Para un gasto pagado por A de 10.001 centavos: saldo A **+5.000**, saldo B **−5.000**.
- Para dos gastos, A paga $80.000 y B paga $40.000: saldo A **+$20.000**, B **−$20.000**.
- Suma de saldos = 0 siempre, incluso con importes impares.
- Acumulado histórico por grupo, no por mes, sin segunda tabla de saldos.
- Cambio de importe, grupo, estado Compartido o eliminación recalcula automáticamente derivando de gastos actuales.
- Como un grupo no admite un tercer miembro y no hay bajas con históricos, no existe problema de nuevas participaciones retroactivas.

## 4. Autorización y privacidad

- Cada operación de lectura/mutación obtiene identidad y sesión de Better Auth **en servidor**.
- Listado personal `WHERE expenses.user_id = session.user.id`, privados y compartidos creados por esa persona; **nunca incluir gastos ajenos**, aunque compartan grupo.
- Listado de grupo: comprobar membresía y consultar exclusivamente gastos `shared_space_id = groupId`; incluye gastos de ambos autores, no privados.
- Detalle ajeno permitido solo si el gasto está compartido con un grupo al que pertenece el usuario; devolver todos los campos visibles con estado **read-only**.
- **Únicamente el autor** puede editar, cambiar grupo/estado o eliminar. Verificar condición en la mutación, no por ocultar botones.
- Un gasto compartido exige membresía del autor y dos miembros en grupo; validar también al editar y al cambiar de grupo.
- Categorías globales son legibles/editables por usuarios autenticados; **no** exponer listados ni conteos de gastos privados ajenos al administrar una categoría.
- No aceptar `userId` ni identidades de participantes enviadas por el cliente.
- No filtrar datos personales ajenos solo en el navegador; consultas SQL acotadas en servidor. Evitar cachés cruzadas de sesiones.

## 5. Formularios y UX mobile-first

- **Gastos (`/`)**: gastos propios ordenados por fecha, agrupados por día, navegación básica por mes, indicador compartido y color junto a categoría; CTA flotante/alcanzable.
- **Formulario** Drawer móvil / Dialog escritorio; importe, detalle, categoría **global única**, fecha (hoy), switch Compartido, grupo al activar. No selector de participantes ni etiquetas `categoría · grupo`.
- Si la persona no tiene ningún grupo, **ocultar Compartido** y no mostrar CTA para crear grupo allí. Si hay grupos pero ninguno completo, explicar que falta segundo integrante y no permitir guardar compartido. Con uno solo completo se puede preseleccionar; con varios exigir selección explícita.
- Cambiar grupo o switch **no limpia categoría** (catálogo global idéntico). Las únicas razones para invalidarla son archivado/eliminación o elección explícita.
- Desde detalle de grupo completo, «Agregar gasto» abre el mismo formulario con grupo preseleccionado y compartido activo.
- **Grupos (`/groups`, `/groups/[id]`)**: lista de grupos, invitaciones y detalle con lista de gastos del grupo, pagador, categoría/color; dos saldos acumulados y desglose expandible de «Pagó» y «Su parte».
- Gasto propio: detalle editable con borrado confirmado. Gasto ajeno de grupo: mismos datos de consulta, **solo lectura**.
- **Categorías (`/categories`)**: un solo CRUD global y selector de color accesible. Retirar `/groups/[id]/categories` y sus enlaces, no mantener catálogos duplicados.
- Mantener navegación inferior Gastos / Grupos / Categorías, estilo Rhea y soporte 360–390 px, estados de carga/vacío/error/falta de conexión.

## 6. Jev — categorización automática del MVP

**Integración implementada:** petición del servidor a `POST https://api.typesafe.ai/v1/systemone` con `model: "jev-latest"`, autenticación Bearer mediante `TYPESAFE_API_KEY` exclusivamente en entorno servidor y `fetch` nativo. No utilizar Vercel AI Gateway, `AI_GATEWAY_API_KEY` ni Vercel AI SDK para esta integración.

- Ruta protegida `POST /api/categories/suggest`; identifica usuario por sesión y carga exclusivamente categorías globales activas desde servidor, sin aceptar listas de categorías ni IDs de usuario del cliente.
- Envía el detalle como `state`, y nombres/descripciones como opciones de tipo `choice` (`category_0`, `category_1`, etc.) más `no_match`; nunca envía IDs reales de categorías, precios, colores, usuarios, grupos o gastos históricos.
- Valida que la opción devuelta pertenezca a las claves generadas, aplica umbral configurable (valor actual por defecto `0.8`) y revalida que la categoría siga activa antes de responder `{ categoryId, probability }`.
- Debounce cliente de 700 ms, timeout abortable de 4 s, límite en memoria de 20 solicitudes por usuario/minuto, descarte de respuestas obsoletas, prioridad de elección manual y sin reclasificación automática de gastos existentes.
- Ante falta de clave, error HTTP/red, timeout, `no_match`, baja probabilidad o respuesta inesperada, permanece disponible la categoría manual. No registrar prompts ni respuestas completas.
- Una llamada real con datos sintéticos devolvió HTTP 200 del proveedor; en el navegador el usuario vio sugerencia y respuesta HTTP 200 de `/api/categories/suggest`, y comprobó que la elección manual prevalece.
- **Mejora futura:** calibrar el umbral y la calidad de clasificación con ejemplos reales sin sacrificar control manual; verificar costes, retención y limitaciones del proveedor. No incluir secretos en documentación ni logs.

## 7. Migraciones y base de desarrollo — estado actual

- El usuario autorizó explícitamente descartar datos anteriores de desarrollo y **eliminó manualmente las tablas** de la base Neon utilizada para esta app.
- Se generó un nuevo baseline único `drizzle/0000_initial_v07.sql`, con snapshot/journal Drizzle nuevos; se retiraron los SQL históricos `0000`, `0001` y `0002` del prototipo, sin trasladar `expense_shares` al esquema v0.7.
- El usuario confirmó haber ejecutado `pnpm exec drizzle-kit migrate` y `node scripts/seed-categories.mjs`. Pruebas posteriores en navegador y PostgreSQL real confirmaron funcionamiento sobre esquema v0.7. El seed es idempotente y carga categorías editables.
- **No reiniciar ni borrar nuevamente las tablas**: ahora existen cuentas, grupos, categorías y gastos creados en los ensayos; toda futura modificación debe ser una migración incremental versionada.
- Precaución operativa: el primer deploy ya se hizo; revisar separación de entornos, copias de seguridad y credenciales rotadas antes de ampliar el acceso. Nunca commitear `.env.local` ni ejecutar migraciones automáticamente durante el build.

## 8. Pruebas y aceptación — ejecución y pendientes

**Verificaciones reportadas tras integración directa de Jev:** `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test` (**34 pruebas en 7 archivos**), `pnpm exec next build --webpack` y `git diff --check` aprobados. En la refactorización previa también se informó que pasaban el build Turbopack y la verificación Drizzle; estos resultados no reemplazan la ejecución final antes del commit.

**E2E navegador (25/10/2026):** 23 PASS / 1 FAIL / 3 BLOCKED / 2 NOT RUN en el reporte automatizado inicial. Se comprobó categorías globales con colores, invitaciones, límite de dos, listado privado, gastos compartidos, balance, centavos impares, archivar/borrar con reemplazo y Jev. Verificaciones manuales posteriores del usuario:

- **E2E-12:** fecha editada se conservó al volver a probar manualmente; el FAIL anterior **no se reprodujo**, no se atribuye a un fix inexistente.
- **E2E-20:** cambio privado → compartido → privado y efecto en el grupo: PASS manual.
- **E2E-27:** experiencia móvil: PASS manual (dispositivos físicos no documentados).
- **E2E-28:** sugerencia Jev: PASS manual, con respuesta HTTP 200 en Network; calibración futura pendiente.
- **E2E-24:** 9/9 integración con sesiones reales Better Auth, Server Actions y PostgreSQL: acceso autorizado a consulta de compartidos; edit/move/delete ajenos y sin sesión rechazados, datos y balances intactos, limpieza de fixtures verificada. **Sin POST HTTP de Server Actions ni prueba de CSRF/origin**.
- **E2E-26:** pérdida de conectividad, recuperación y reintento: **pendiente por decisión del usuario**; no asumir un comportamiento implementado/verificado.

**Cobertura que conviene preservar:** tests de permisos en `src/lib/server/expenses.e2e24.integration.test.ts`; balances 50/50 par/impar, grupos aislados, dobles invitaciones, categorías históricas y prioridad manual frente a IA. No incluir informes E2E efímeros ni capturas de prueba en Git; conservar únicamente las dos especificaciones y el código de pruebas reproducibles.

**Refinamiento UI (octubre 2026):** el agente reportó implementación del encabezado móvil compacto, acceso a Cuenta junto a los títulos, selectores adaptados a móvil, calendario amplio dentro del Drawer, indicación de hoy, reorganización de campos (Compartido al final), scroll/focus rings y estilos unificados. Las inspecciones visuales en 360/375/390 px y escritorio resultaron favorables en las iteraciones finales; no se documentó prueba física de safe-area ni teclado iOS/Android. Se corrigió la discrepancia entre llamadas que pasaban `description` y el contrato de `SectionHeading` quitando esa prop, conforme a la decisión del usuario de no mostrar subtítulos en los encabezados. `react-day-picker` fue incorporado. En la carpeta habitual `pnpm lint` pasó y `pnpm test` aprobó 38 tests unitarios; la suite completa falló inicialmente por falta de `DATABASE_URL` al cargar la prueba de integración E2E-24. El usuario informó haber separado la ejecución unitaria de la integración; **no se aportó todavía el log final de una ejecución posterior**. No afirmar que el último `pnpm build` y `tsc` finales estén validados sin salida de esos comandos.

**Primer deploy (27/10/2026):** el usuario confirmó que el proyecto `simple-expense-manager` fue desplegado desde GitHub (`main`) en Vercel mediante la interfaz web. No se registró aquí la URL final, el resultado de pruebas de autenticación/cookies, el funcionamiento de Neon/Jev en producción ni la configuración exacta de variables. No ejecutar migraciones o seed como parte del build sin plan expreso.

## 9. Próximas entregas y Git

1. **Realizado:** dominio v0.7 con grupos de dos, categorías globales, gastos 50/50 y Jev directo; reset inicial de Neon y seed; tests principales y refinamiento de UI móvil.
2. **Realizado según confirmación del usuario (27/10/2026):** primer deploy del proyecto en Vercel desde el repositorio GitHub, rama `main`.
3. **Siguiente:** validar el sitio desplegado con dos cuentas y dispositivos reales: login/logout, cookies Better Auth, gasto personal y compartido, invitaciones, balance, fecha, catálogos y sugerencia TypeSafe. Registrar URL/dominio definitivo sin secretos.
4. **Pendiente:** revisar rotación de credenciales y separación desarrollo/producción; definir errores y reintentos de red (E2E-26); revisar e integrar la PWA online y probar la instalación desde el dominio HTTPS en Android/iPhone; mejorar Jev con datos del piloto y evaluar pruebas HTTP/CSRF de Next.

**Git:** ramas por funcionalidad, Conventional Commits en inglés y merges directos a `main` sin PR. El deploy está confirmado por el usuario, pero el hash concreto del commit publicado y el estado final del worktree no están consignados en esta documentación.
## 10. Fuera del MVP y definición de terminado

No habrá N participantes, `expense_shares`, selección de beneficiarios, repartos configurables, liquidaciones, transferencias, estadísticas, presupuestos, multi-moneda, adjuntos, OCR, asistente conversacional, taxonomías por usuario/grupo, offline ni sincronización en segundo plano.

**Terminado cuando:** una persona registra gastos propios; puede compartirlos 50/50 en cualquiera de sus varios grupos completos de dos; el otro integrante los ve solo dentro del grupo; no puede editarlos; balances acumulados son exactos; categorías globales con color se administran sin filtraciones; Jev sugiere sin imponer; móvil funciona; base/migraciones nuevas son reproducibles y PWA es instalable online. **El dominio v0.7 está implementado y el primer deploy está realizado; la definición completa de terminado sigue pendiente de validación en producción, PWA y gestión de fallos de conexión.**

## 11. Referencias

- Next.js App Router / PWA: https://nextjs.org/docs/app/guides/progressive-web-apps
- Better Auth: https://www.better-auth.com/docs/installation
- Drizzle migrations: https://orm.drizzle.team/docs/migrations
- TypeSafe AI Jev: https://typesafe.ai/
- TypeSafe System One API: https://docs.typesafe.ai/api/system-one
- Impeccable: https://impeccable.style/

> **Principio técnico rector:** esquema pequeño y consistente, dos participantes como invariante real, una sola categoría global por gasto, balances derivados y privacidad aplicada en el servidor.
