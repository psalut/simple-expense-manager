# Gestor de gastos personales y compartidos — Especificación técnica

**Versión:** 0.7 · **Fecha:** 24 de octubre de 2026 · **Estado:** arquitectura aprobada; código implementado, reset remoto pendiente de verificar
**Documento complementario:** `Idea_producto_gestor_gastos_v0.7.md`

## 0. Estado real y alcance de esta versión

**Implementado/reportado antes del cambio:** Next.js 16.4.3, TypeScript strict, pnpm, Tailwind 4, shadcn/ui Base UI + Rhea, Better Auth 1.7.12, Neon/PostgreSQL, Drizzle ORM, autenticación, grupos N:M sin límite de integrantes, invitaciones, categorías personales/por grupo y navegación mobile-first. El agente reportó implementación de `expenses`/`expense_shares`, alta/edición/borrado, listas y balances en `feat/expenses-and-balances`, migración `0002` aplicada a Neon y 49 tests, lint, `tsc` y build Webpack aprobados. **No creó commit ni PR; merge no confirmado**. No hay pruebas e2e multiusuario ni revisión física móvil confirmadas. **En ese estado inicial, Jev y PWA todavía no estaban implementados**.

**Objetivo aprobado v0.7:** múltiples grupos por usuario, **máximo dos integrantes por grupo en UI, dominio y BD**, catálogo **global editable** de categorías con color, gastos privados/compartidos, **reparto fijo 50/50**, sin `expense_shares` ni selector de participantes, y Jev para clasificación. El estado de implementación, las verificaciones y cualquier bloqueo del reset remoto se registran al final de este documento.

## 1. Stack y arquitectura

| Componente | Decisión |
| --- | --- |
| App | Next.js App Router, monolito modular; Server Components para lecturas y Client Components para interacción |
| Lenguaje/paquetes | TypeScript strict, pnpm |
| UI | Tailwind 4 + shadcn/ui Base UI (Rhea), diseño mobile-first, skill Impeccable para revisión |
| Auth | Better Auth; sesiones autenticadas en servidor |
| Persistencia | Neon PostgreSQL + Drizzle ORM/Kit, migraciones SQL versionadas |
| Mutaciones | Server Actions protegidas, reglas concentradas en servicios de dominio |
| IA | TypeSafe AI **Jev** mediante llamadas HTTP directas a System One desde el servidor; clave privada `TYPESAFE_API_KEY` |
| PWA/hosting | Manifest + HTTPS, sin offline; Vercel en fase posterior |

No agregar ORM paralelo, backend separado, Redis, colas, sockets, analítica, adjuntos, motor contable ni sincronización offline.

## 2. Nuevo modelo de datos objetivo

Mantener tablas de Better Auth según integración efectiva del repositorio. Los nombres/columnas concretos deben adaptarse al código real; el siguiente es el **contrato de dominio v0.7**.

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

## 6. Jev — sugerencias opcionales con TypeSafe System One

Usar la API oficial de TypeSafe directamente desde el servidor mediante HTTP. El endpoint es `POST https://api.typesafe.ai/v1/systemone`, con `Authorization: Bearer ${process.env.TYPESAFE_API_KEY}`, `Content-Type: application/json`, y `model: "jev-latest"`. La clave es solo de servidor y no usa el prefijo `NEXT_PUBLIC_`.

- La entrada de la ruta autenticada `POST /api/categories/suggest` sigue siendo `{ title: string }`; el cliente no envía categorías ni `userId`.
- El servidor carga las categorías globales activas y crea opciones cerradas `category_0`, `category_1`, … más `no_match`. Esos identificadores los genera el servidor y no son IDs de base de datos.
- El cuerpo de TypeSafe contiene como `state` únicamente el detalle actual. `questions.category.criteria` contiene los nombres y descripciones de las categorías activas; no incluye IDs reales, colores, importes, usuarios, grupos ni historial. Las etiquetas se tratan como datos no confiables.
- TypeSafe devuelve `answers.category.choice` y `answers.category.probabilities`. El servidor acepta solo una opción emitida por él mismo, mapea esa opción al `categoryId` correspondiente y exige una probabilidad mínima de `CATEGORY_SUGGESTION_MIN_PROBABILITY` (por defecto `0.8`). `no_match`, respuesta inesperada o probabilidad baja producen `{ categoryId: null, probability: null }`.
- El servidor vuelve a consultar las categorías activas antes de devolver la sugerencia para descartar una categoría archivada durante la llamada.
- El cliente conserva el debounce de aproximadamente 700 ms, cancela solicitudes anteriores, ignora respuestas obsoletas y no reemplaza una selección manual. Editar un gasto existente no lo reclasifica automáticamente.
- La llamada tiene timeout de 4 segundos y se aborta al vencer. Errores HTTP (incluidos autenticación y rate limit), errores de red, timeout, falta de clave o respuesta malformada dejan disponible la selección manual. No se reintenta ni se registran prompts, respuestas completas o secretos.
- La ruta conserva validación del título, autenticación, límite de 20 solicitudes por usuario por minuto y respuesta `Cache-Control: no-store`. Se omite la llamada si no hay clave o si el catálogo no tiene entre 1 y 200 categorías activas.

## 7. Reinicio de migraciones y base de desarrollo

**Decisión explícita del usuario:** empezar de cero con las migraciones para no arrastrar estructura N-personas, `expense_shares`, categorías por ámbito ni las migraciones históricas `0000`, `0001`, `0002` del prototipo.

**Procedimiento esperado, antes de ejecutar operaciones destructivas:**

1. Inspeccionar `drizzle.config`, esquema Better Auth, configuración de Neon, variables de entorno y conexiones. **Identificar inequívocamente la base de desarrollo**; jamás asumir que `DATABASE_URL` no apunta a producción.
2. Registrar un respaldo/exportación de esquema/datos si hay algo valioso y una forma de recuperación. Avisar que se perderán **usuarios, sesiones, invitaciones, categorías, gastos y membresías** en la base reseteada.
3. Reescribir el esquema Drizzle para la arquitectura v0.7, integrando tablas Better Auth y dominios en un único esquema coherente.
4. Resetear **solo la base/schema de desarrollo validado**, incluido su historial de migraciones, y reemplazar los SQL/snapshots del repositorio por **una nueva migración inicial** generada con Drizzle Kit. No conservar referencias a migraciones anteriores en el historial nuevo.
5. Aplicar la nueva migración **una sola vez** a la base limpia; verificar tablas, constraints, índices y registro de migración. Si la estrategia exige pasos particulares de Better Auth, documentarlos y mantener migración única coherente.
6. Agregar seed **idempotente** de categorías globales iniciales (nombre, descripción, color), sin imponerlas como categorías inmutables. No crear cuentas reales de usuario por seed salvo datos locales de testing claramente separados.
7. Documentar comandos, destino del reset, qué se eliminó y verificación; **no borrar ni tocar entornos productivos**. Si no se puede validar el entorno con seguridad, detener el paso destructivo y comunicar bloqueo; el agente puede seguir con código/tests sin destruir datos.

**Importante:** no ejecutar un simple `drizzle-kit migrate` sobre el esquema anterior tras borrar archivos; eso no equivale a un reset real.

## 8. Pruebas y aceptación

- **Grupos:** crear dos grupos con el mismo usuario; invitaciones de uso único; dos cuentas como máximo por grupo; prueba de carreras de dos aceptaciones concurrentes; un grupo de uno no permite compartir gastos.
- **Catálogo:** CRUD global, color hex válido, nombres activos únicos normalizados, archivado, histórico, reemplazo atómico sin filtración de referencias privadas, seed repetible.
- **Gastos:** alta/edición/eliminación de propios; visibilidad exclusiva en listado personal; lectura grupal permitida únicamente a miembros; ajenos en solo lectura y mutaciones ajenas rechazadas en backend.
- **50/50:** importes pares/impares, cambio de importe/grupo, eliminación, suma cero y grupos aislados. Aritmética BIGINT sin `float`.
- **Jev:** mock de `choice`, `no_match`, baja probabilidad, timeout, respuesta tardía, selección manual y categoría archivada concurrentemente.
- **UI:** teclado en móvil, accesibilidad del Drawer, navegación inferior, selector de color, vacíos, fallo de red y responsive real.
- Validaciones: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm exec next build --webpack`, `git diff --check`; verificar también build normal si es viable. La aprobación automática **no sustituye** e2e con dos usuarios y dos grupos.

## 9. Entregas y Git

1. Actualización de documentación y definición v0.7 (**este documento**).
2. Refactorización de esquema, reset de dev y seed global.
3. Simplificación de grupos, categorías, gastos, balances y pantallas existentes.
4. Jev en alta de gastos con fallback manual.
5. PWA online, pruebas funcionales en dispositivos y despliegue/piloto.

**Flujo:** rama por funcionalidad, tests, Conventional Commits **en inglés**, merge directo a `main` **sin PR**. Evitar múltiples commits triviales; sugerencia de commit al completar la refactorización: `refactor: simplify groups and global expense categories`; si Jev queda en commit separado: `feat: suggest expense categories with jev`. El agente debe **informar detalladamente qué hizo, decisiones, migraciones, riesgos y verificaciones**. No asumir commits ejecutados.

## 10. Fuera del MVP y definición de terminado

No habrá N participantes, `expense_shares`, selección de beneficiarios, repartos configurables, liquidaciones, transferencias, estadísticas, presupuestos, multi-moneda, adjuntos, OCR, asistente conversacional, taxonomías por usuario/grupo, offline ni sincronización en segundo plano.

**Terminado cuando:** una persona registra gastos propios; puede compartirlos 50/50 en cualquiera de sus varios grupos completos de dos; el otro integrante los ve solo dentro del grupo; no puede editarlos; balances acumulados son exactos; categorías globales con color se administran sin filtraciones; Jev sugiere sin imponer; móvil funciona; base/migraciones nuevas son reproducibles y PWA es instalable online. Hasta entonces, **v0.7 es especificación objetivo, no reporte de implementación**.

## 11. Referencias

- Next.js App Router / PWA: https://nextjs.org/docs/app/guides/progressive-web-apps
- Better Auth: https://www.better-auth.com/docs/installation
- Drizzle migrations: https://orm.drizzle.team/docs/migrations
- TypeSafe System One API: https://docs.typesafe.ai/api/system-one
- TypeSafe Choice primitive: https://docs.typesafe.ai/primitives/choice
- TypeSafe API errors: https://docs.typesafe.ai/api/errors
- Impeccable: https://impeccable.style/

> **Principio técnico rector:** esquema pequeño y consistente, dos participantes como invariante real, una sola categoría global por gasto, balances derivados y privacidad aplicada en el servidor.

## Registro de ejecución — 24 de octubre de 2026

- La implementación v0.7 está en el repositorio: grupos limitados a dos, categorías globales, gastos privados/compartidos sin tabla de participaciones, balances 50/50 y sugerencias Jev en servidor. La migración local es un baseline inicial generado con Drizzle Kit y contiene además triggers PostgreSQL para controlar concurrencia, cupo, historial de membresías, asignación de categorías y autoría/pertenencia de gastos compartidos.
- El baseline y el seed idempotente están preparados, pero **no se aplicaron**. El destino leído de .env.local identifica la base neondb en el endpoint ep-morning-poetry-b6dofnor, pero no permite confirmar el proyecto ni la rama de Neon. No hay NEON_API_KEY configurada y la consulta de solo lectura falló con DNS ENOTFOUND. Por eso no se pudo verificar entorno de desarrollo ni hacer exportación; no se ejecutaron reset, migración ni seed, y no se modificaron datos remotos.
- La integración Jev usa llamadas HTTP directas a TypeSafe System One. El cuerpo mínimo, el mapeo de opciones, el timeout, el umbral, la revalidación y el fallback manual están especificados en §6; requiere `TYPESAFE_API_KEY` solo en servidor.
- Validaciones locales: 26 tests aprobados, TypeScript, ESLint, Drizzle Kit check y builds final de Webpack y Turbopack aprobados. Tras limpiar .next, se habilitó con revisión de política el acceso de red requerido para descargar las fuentes ya usadas por el layout (Geist, Geist Mono e Inter); no se modificó la tipografía. Dos intentos predeterminados anteriores se interrumpieron sin progreso, pero el intento final completó. No se hicieron e2e con dos cuentas ni una inspección visual en navegador.
- El subcomando audit no está implementado por el launcher Impeccable instalado. La revisión estática mobile-first y el detector Impeccable se hicieron; detect devolvió una lista vacía. Esto no sustituye revisar el render en un teléfono.
