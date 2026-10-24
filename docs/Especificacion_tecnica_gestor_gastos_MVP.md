# Gestor de gastos personales y compartidos — Especificación técnica

**Versión:** 0.4 · **Estado:** propuesta técnica para iniciar el MVP · **Fecha:** 23 de octubre de 2026
**Documento complementario:** `Idea_producto_gestor_gastos.md`

## 1. Objetivo técnico

Construir una **aplicación web instalable (PWA), mobile-first y exclusivamente online** para registrar gastos personales y compartir algunos de ellos en grupos de N participantes. Un usuario puede pertenecer a varios grupos simultáneamente. Cada gasto se guarda **una sola vez**: se muestra en el historial de quien lo pagó y, si corresponde, en **un único grupo seleccionado**.

El MVP incluye **categorías personales y compartidas con descripción**, más **categorización sugerida por Jev (TypeSafe AI)**, para reducir todavía más la fricción de la carga. Prioriza velocidad, sencillez de uso, privacidad y un balance compartido correcto. No busca ser un sistema contable ni incorporar estadísticas o funciones avanzadas.

## 2. Decisiones técnicas

| Componente | Decisión | Motivo / alcance |
| --- | --- | --- |
| Framework | **Next.js (App Router)** | Frontend y lógica de servidor en el mismo proyecto. |
| Lenguaje | **TypeScript** (`strict`) | Tipos explícitos para gastos, importes y permisos. |
| Autenticación | **Better Auth** | Cuentas, sesiones y acceso protegido; correo y contraseña inicialmente. |
| Base de datos | **PostgreSQL en Neon** | Persistencia relacional y consultas simples de gastos/balance. |
| ORM | **Drizzle ORM + Drizzle Kit** (recomendado) | Esquema tipado y migraciones SQL versionadas. **Prisma es alternativa válida** si se prefiere; usar solo uno. |
| Estilos | **Tailwind CSS** | Desarrollo rápido y responsive. |
| Componentes | **shadcn/ui (Base UI, preset Rhea)** | Base de componentes adaptables y accesibles. |
| Diseño | **Skill Impeccable** | Guiar la implementación y revisión visual; no es una dependencia de producción de la app. |
| Validación | **Zod** | Validación compartida de formularios y entradas en servidor. |
| IA de clasificación | **Jev — TypeSafe AI (`typesafe-ai/jev`)** | Elegir una categoría entre opciones provistas por el usuario; no genera texto libre. |
| Integración IA | **Vercel AI SDK 7, API `experimental_decide` + AI Gateway** | Una decisión `choice` en el servidor con las categorías disponibles; verificar versiones por tratarse de una API experimental. |
| PWA | **Manifest de Next.js + íconos + HTTPS** | Instalación y apertura en modo standalone; **sin offline**. |
| Hosting | **Vercel** (propuesta) | Deploy de Next.js con previews por pull request. |
| Gestor de paquetes | **pnpm** | Mantener consistencia con el flujo habitual del proyecto. |

**No agregar al inicio:** backend Express/Nest separado, Redis, colas, microservicios, IndexedDB, sincronización offline, notificaciones push, motor de analítica ni almacenamiento de adjuntos.

## 3. Arquitectura propuesta

**Monolito Next.js modular:**

```text
Celular (PWA) / navegador
          |
          v
Next.js App Router
  ├─ UI: Server Components + Client Components donde haga falta
  ├─ Operaciones: Server Actions (gastos, vínculo, consultas)
  ├─ Auth HTTP: Route Handler de Better Auth
  ├─ Servicios del dominio: permisos + categorías + balance
  └─ Clasificador: Jev a través de AI SDK / AI Gateway (servidor)
          |
          v
    Drizzle ORM
          |
          v
     PostgreSQL
```

- Usar **Server Components** para cargar pantallas/listados y **Client Components** para formularios y estados interactivos.
- Las **Server Actions** pueden cubrir las operaciones internas del MVP; no hace falta diseñar una API REST pública todavía.
- Concentrar consultas y reglas de negocio en funciones de servidor: el componente visual no calcula permisos ni decide qué registros puede leer cada usuario.
- El balance se **deriva de los gastos y sus participaciones persistidas**; no se mantiene una segunda tabla agregada de balances que pueda desincronizarse. Cada grupo tiene saldos aislados.
- La categorización se implementa como **un servicio pequeño y separado**, llamado desde el formulario; no se necesita infraestructura de agentes, embeddings, vectores ni colas.

## 4. Modelo de datos mínimo

La autenticación crea sus propias tablas de usuarios y sesiones a través de Better Auth. El dominio prevé `shared_spaces`, `shared_space_members`, `shared_space_invitations` (o nombre equivalente actual), `categories`, `expenses` y `expense_shares`. **En la tarea actual ya existen o se preparan espacios, membresías, invitaciones y categorías; `expenses` y `expense_shares` se implementarán en una fase posterior.**

### `shared_spaces`

| Campo | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID / ID único | Identificador del espacio. |
| `name` | Texto | Nombre breve, p. ej. «Casa». |
| `created_by` | FK a usuario | Creador del espacio. |
| `created_at` | Timestamp | Alta. |

### `shared_space_members`

| Campo | Tipo conceptual | Descripción |
| --- | --- | --- |
| `space_id` | FK | Espacio. |
| `user_id` | FK a usuario | Integrante. |
| `joined_at` | Timestamp | Incorporación. |

**Restricciones:** clave compuesta (`space_id`, `user_id`) única para evitar membresía duplicada. **No** imponer índice único sobre `user_id`, ni máximo de dos personas por espacio: la relación es **muchos a muchos**, con N grupos por persona y N miembros por grupo. Las operaciones deben autorizarse por `space_id` explícito y comprobar la membresía en servidor, también para lecturas.

### `shared_space_invitations` (o tabla equivalente del repositorio)

Cada invitación apunta a **un grupo concreto**, utiliza un código impredecible almacenado como hash, tiene vencimiento (siete días según implementación existente) y se acepta **una sola vez**. Se pueden generar múltiples invitaciones para un mismo grupo. La aceptación debe ser transaccional y segura frente a solicitudes concurrentes: bloquear/consumir el token de un solo uso e insertar la membresía idempotentemente o devolver un error controlado ante duplicados. Se mantiene el código sin envío automático de correos, y **no hay límite de integrantes** que comprobar.

Un usuario que ya participa en un grupo puede usar invitaciones de otros grupos sin perder los anteriores. La validación de grupo debe evitar IDOR entre grupos. No introducir roles ni invitaciones masivas en este MVP.

### `categories`

Una sola tabla reúne categorías de **dos ámbitos excluyentes**:

| Campo | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID / ID único | Identificador estable de la categoría. |
| `user_id` | FK a usuario, nullable | Informado **solo** si es una categoría personal; su propietario es el único que puede leerla y administrarla. |
| `shared_space_id` | FK a espacio, nullable | Informado **solo** si es compartida; todos los miembros del grupo pueden verla y administrarla. |
| `name` | `VARCHAR(60)` | Nombre visible («Supermercado», «Transporte»). |
| `description` | `TEXT` | Criterio claro para la IA, obligatorio. |
| `archived_at` | Timestamp nullable | `NULL` = activa; archivada = histórica. |
| `created_at`, `updated_at` | Timestamp | Metadatos mínimos. |

**Integridad:** cada fila debe pertenecer a **exactamente un ámbito**: `user_id` **XOR** `shared_space_id`, mediante un `CHECK` de PostgreSQL. No permitir nombres duplicados entre categorías activas del mismo usuario ni del mismo espacio (índices únicos parciales por ámbito con nombre normalizado en minúsculas). El ámbito **no cambia después del alta**; se crea una nueva categoría si se necesita otra pertenencia.

**Permisos:** categorías personales: CRUD/archivo solamente por propietario. Categorías compartidas: todos los miembros autorizados de ese grupo pueden crear, leer, editar y archivar (sin roles adicionales). Archivar evita **nuevas asignaciones**, pero preserva los gastos históricos. La eliminación física exige categoría archivada y autorización del propietario o miembro del grupo; nunca borrar físicamente categorías referenciadas sin reasignarlas. Cuando existan gastos, mostrar cuántos se afectan, exigir reemplazo elegible para todos y reasignar + eliminar en una transacción. Para una categoría grupal, el reemplazo es otra categoría activa del mismo grupo; para una personal, debe ser elegible para todos los gastos afectados (categoría personal del propietario o de uno de sus grupos). La FK desde `expenses.category_id` debe usar `RESTRICT`/`NO ACTION`, **nunca `ON DELETE CASCADE`**. En el estado actual del repositorio no hay tablas ni referencias de gastos; por eso solo se implementa el borrado confirmado de categorías archivadas sin referencias posibles, sin selector ni reasignación ficticios. **No exponer a otros integrantes conteos, identificadores ni listados de gastos privados** que usen una categoría compartida. Editar su nombre/descripción actualiza su representación y futuras sugerencias, sin alterar importe, privacidad ni categoría asignada a gastos existentes.

Las categorías compartidas están disponibles para gastos **privados del miembro**, incluso si la persona pertenece a varios grupos, y para gastos **compartidos del grupo propietario de esa categoría**. Las personales **solo para gastos privados de su propietario**. Un gasto compartido debe apuntar a una categoría del mismo grupo al que pertenece.

**Selector y servicio de elegibilidad:** con `shared=false`, consultar categorías personales del usuario **más categorías de todos los grupos de los que sea miembro**; con `shared=true`, exigir `sharedSpaceId` concreto validado contra la membresía y consultar **solo** las categorías activas de ese grupo. Los IDs permiten distinguir nombres repetidos: en gastos privados la UI debe mostrar `nombre · grupo` cuando sea una categoría grupal. Al crear una categoría compartida, el usuario elige su grupo; si tiene solo uno, la UI puede preseleccionarlo. El propietario (usuario o grupo) no se puede cambiar mediante edición. Pueden existir ejemplos editables, sin taxonomía global obligatoria.

### `expenses`

| Campo | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID / ID único | Identificador del gasto. |
| `user_id` | FK a usuario | **Autor y pagador** en el MVP. |
| `amount_cents` | Entero positivo (`BIGINT`) | Importe expresado en centavos, sin `float`. |
| `currency` | Texto | `ARS` fijo inicialmente. |
| `description` | Texto | Detalle breve. |
| `category_id` | FK a `categories` | **Una única categoría**: personal del autor o compartida de cualquiera de sus grupos; si el gasto es compartido, **solo compartida del grupo elegido**. |
| `expense_date` | `DATE` | Fecha del gasto, sin hora. |
| `shared_space_id` | FK nullable | `NULL` si es privado; **un único** grupo explícito si es compartido. |
| `created_at`, `updated_at` | Timestamp | Metadatos técnicos. |

**Decisión central:** no existe una tabla adicional de «gastos compartidos». El campo `shared_space_id` define si el gasto propio participa o no en el espacio común. La visibilidad cambia sin duplicar el registro; incluso con N grupos, un gasto solo puede compartirse en uno.

### `expense_shares` (fase futura de gastos; **no implementar en la corrección actual de categorías**)

| Campo | Tipo conceptual | Descripción |
| --- | --- | --- |
| `expense_id` | FK a gasto | Gasto compartido. |
| `user_id` | FK a usuario | Participante de ese gasto al registrarlo. |
| `share_amount_cents` | `BIGINT` no negativo | Parte asignada al participante, expresada en centavos. |

Clave única compuesta (`expense_id`, `user_id`). Para cada gasto compartido se guardan **participantes y partes en el momento del alta**, sin recalcularlos al ingresar nuevas personas al grupo. Recalcular importes al editar el gasto **entre sus participantes originales**, conservando sus identidades. La suma de partes debe coincidir exactamente con el importe del gasto. **No** agregar una tabla adicional de saldo materializado.

**Convención de redondeo:** para N participantes, asignar `floor(amountCents / N)` a cada uno, excepto al pagador, que asume los centavos sobrantes; `sharePagador = amount − (N−1) × floor(amount/N)`. De este modo la suma es exacta y `saldoPersona = pagado − sumaPartes` produce saldos que suman cero. Una persona que se une después tiene parte **cero en los gastos anteriores**; podrá ver el historial del grupo pero solo participa en repartos futuros. Por simplicidad, **no implementar todavía salida/expulsión de participantes cuando haya gastos históricos**. No admitir gastos compartidos sin participantes ni sin membresía actual del autor.

**Índices sugeridos:** `expenses(user_id, expense_date DESC)`, `expenses(shared_space_id, expense_date DESC)`, `categories(user_id, archived_at)`, `categories(shared_space_id, archived_at)`, dos índices únicos parciales por ámbito para nombres activos normalizados y FK `expenses(category_id)` con `RESTRICT`/`NO ACTION` al borrar categorías.

**Integridad:** al crear un gasto o cambiar su categoría, validar **en servidor y dentro de la operación de guardado** que esté activa y sea elegible según autor, membresía, espacio y valor actual del switch. Si `shared_space_id` es `NULL`, se admite categoría personal del autor o compartida de **cualquier grupo al que pertenezca**; si no es `NULL`, se exige categoría compartida **de ese mismo grupo**, con membresía del autor verificada. Una FK simple no garantiza estas reglas entre filas: implementarlas en el servicio del dominio y cubrirlas con pruebas; si hiciera falta, reforzarlas con restricciones adicionales. Al editar un gasto que conserva su categoría archivada, puede conservarla sin efectuar una nueva asignación. Los importes deben ser positivos y se evita `float`.

### Vinculación a múltiples grupos

Cada usuario puede **crear varios grupos y unirse a grupos existentes**, sin perder sus otras membresías. Para cada grupo, un integrante puede generar **tantas invitaciones individuales como necesite** (código de un solo uso, con caducidad y hash, como ya se implementó), que suman un miembro al grupo correspondiente. No limitar a dos integrantes ni a un grupo por usuario. No hace falta enviar correos automáticamente. No se implementan todavía roles, disolución de grupos ni salidas que alteren repartos históricos.

## 5. Categorización inteligente con TypeSafe AI Jev

### 5.1 Alcance exacto

Objetivo: cuando alguien escribe **«Compra en Carrefour»**, la app identifica **«Supermercado»** utilizando el **nombre y la descripción de las categorías activas permitidas** para ese gasto (personales propias y de todos los grupos propios si es privado; solo comunes del **grupo seleccionado** si está compartido). **Jev** es un modelo de decisiones, no un chat: se le entrega una pregunta de tipo `choice` con un conjunto cerrado de opciones y devuelve una elección y, cuando está disponible, sus probabilidades.

- **Se usa Jev de TypeSafe AI** (`typesafe-ai/jev`) vía **Vercel AI SDK** y **AI Gateway**, desde servidor.
- **No** se le pide crear categorías, generar descripciones, analizar importes, modificar el switch compartido ni inferir fechas.
- **No** se envían gastos históricos ni información de otros integrantes: solo el **detalle actual** y las **categorías activas elegibles** (nombre y descripción, con etiqueta del grupo cuando haga falta distinguir nombres homónimos). Nunca se incluyen categorías personales de otros usuarios, IDs internos de grupos o información de membresías.
- La categoría elegida se guarda **únicamente cuando el usuario guarda el gasto**, como `category_id`. No se registra una clasificación alternativa ni un historial IA.

### 5.2 Interacción en el formulario (sin fricción)

1. El usuario escribe el detalle. Cuando termina (por ejemplo, al salir del campo o tras una pausa de ~700 ms), si no eligió manualmente una categoría, el cliente solicita **una** sugerencia. No llamar al modelo en cada tecla.
2. Se muestra un estado discreto «Buscando categoría…», sin bloquear importe, fecha ni switch compartido. Si la respuesta llega tarde, se ignora si cambió el detalle o si el usuario ya eligió una categoría. Si el título cambia después de una preselección IA, se invalida esa propuesta y se puede solicitar otra, **salvo que exista una selección manual**.
3. Con coincidencia de suficiente probabilidad, **preseleccionar en el borrador del formulario**: «Supermercado · sugerida». El usuario puede reemplazarla desde el selector sin confirmaciones adicionales.
4. Si el detalle es ambiguo, la categoría propuesta no supera el umbral, no hay categorías activas, la IA tarda demasiado o el servicio falla, **no se inventa una respuesta**: dejar la selección manual disponible. Un formulario sin categoría seleccionada no puede guardarse, pero **nunca depende de una respuesta IA** para completarla.
5. El sistema **no modifica categorías existentes ni reclasifica gastos ya guardados** al editar título o descripción. En edición, el usuario puede cambiar la categoría explícitamente, con un futuro botón de «Volver a sugerir» solo si resulta útil.
6. Al activar «Compartido», **seleccionar el grupo**: con un único grupo propio se puede preseleccionar; con varios, exigir elección explícita. **Conservar la categoría solo si pertenece a ese mismo grupo**; de lo contrario limpiarla y sugerir otra entre las categorías de ese grupo. Al desactivar «Compartido», conservar una categoría de grupo si sigue siendo accesible. Al cambiar de grupo, invalidar categoría y sugerencias previas salvo que el ID de categoría realmente pertenezca al grupo nuevo. No borrar importe/detalle/fecha ni compartir sin acción explícita. Las respuestas IA obsoletas deben ignorarse ante cualquier cambio de título, switch o grupo.

### 5.3 Contrato mínimo de servidor

Crear un Route Handler protegido `POST /api/categories/suggest` (o una Server Action si el formulario lo permite) con entrada validada por Zod:

```ts
// Entrada: { title: string, shared: boolean, sharedSpaceId?: string }
// Salida de éxito: { categoryId: string, probability: number | null }
// Salida sin propuesta: { categoryId: null, probability: null }
```

**No aceptar `userId` ni listas de categorías desde el cliente.** `sharedSpaceId` **sí se envía como selector de contexto** cuando `shared=true`, pero **nunca** como prueba de autorización. El servidor identifica al usuario con Better Auth, comprueba que pertenece al `sharedSpaceId` elegido y carga **solo** sus categorías activas. Cuando `shared=false`, consulta personales del usuario y compartidas de **todos sus grupos**; las opciones homónimas se distinguen por su ID y contexto de grupo. Si se marca `shared=true`, **es obligatorio** un grupo válido y las candidatas se restringen a ese grupo. Tras la respuesta del modelo, volver a verificar categoría activa y elegible para el estado/grupo seleccionados. No guardar sugerencias no confirmadas.

### 5.4 Ejemplo conceptual de integración

Ejemplo orientativo con **AI SDK 7.0.128+**. `experimental_decide` es el nombre actual de la API; `experimental_evaluate` es un alias anterior en desuso. El contrato debe verificarse con las versiones fijadas en `pnpm-lock.yaml`.

```ts
import { experimental_decide as decide } from 'ai';

type Candidate = { id: string; name: string; description: string };

async function suggestCategory(title: string, categories: Candidate[]) {
  if (!title.trim() || categories.length === 0) return null;

  // Claves cortas controladas por servidor; solo IDs propios, nunca arbitrarios.
  const options = new Map(categories.map((c, i) => [`cat_${i}`, c]));
  const criteria = Object.fromEntries(
    [...options].map(([key, c]) => [key, `${c.name}: ${c.description}`]),
  );
  criteria.no_match = 'Ninguna categoría aplica claramente a este gasto';

  const result = await decide({
    model: 'typesafe-ai/jev',
    state: { expenseTitle: title.trim() },
    questions: {
      expenseCategory: {
        type: 'choice',
        instructions: 'Clasificá el gasto según el título. Elegí no_match si no hay coincidencia clara.',
        criteria,
      },
    },
    maxRetries: 1,
  });

  const answer = result.answers.expenseCategory;
  const selected = answer?.choice;
  const candidate = selected ? options.get(selected) : undefined;
  const probability = selected ? answer?.probabilities?.[selected] : undefined;

  // Umbral de ejemplo, NO calibrado: ajustar con gastos reales del piloto.
  const threshold = 0.8;
  if (!candidate || probability === undefined || probability < threshold) return null;

  return { categoryId: candidate.id, probability };
}
```

Esta función corre **solo en el servidor**, envuelta por validación de sesión, límite de longitud del título, control básico de frecuencia, timeout (p. ej., 2–4 s) y `try/catch` para devolver `null` ante fallos. El ejemplo no representa por sí solo un endpoint seguro completo.

**Probabilidades:** usar la probabilidad de la categoría elegida (`answer.probabilities[choice]`) y no confundirla con la métrica separada de confianza del proveedor. El umbral `0.8` es **provisional**; validarlo con gastos reales y ajustarlo priorizando evitar clasificaciones erróneas. Si falta la distribución, no asumir probabilidad = 1: se deja la elección manual.

### 5.5 Privacidad, coste y resiliencia

- API key de AI Gateway **solo en el servidor** (`AI_GATEWAY_API_KEY` o autenticación OIDC según despliegue). Ninguna llamada directa desde el navegador.
- No enviar nombres/correos de personas, IDs internos de grupos, membresías, saldos ni listas de gastos privados al clasificador. Solo se permite una etiqueta del grupo si resulta necesaria para desambiguar categorías homónimas.
- Revisar la política de retención del proveedor y, si está disponible y habilitado, usar **Zero Data Retention / No Training** para estas solicitudes; los títulos y descripciones se consideran datos de usuarios.
- Control de coste básico: evitar llamadas por cada tecla, caché en el cliente solo para el título actual si hace falta, **un intento por entrada estable**, presupuesto del proveedor y protección razonable contra abuso del endpoint. No hace falta Redis ni un sistema de observabilidad de IA para el MVP.
- No persistir prompts, respuestas completas o títulos de gastos en logs técnicos. Solo errores mínimos sin datos sensibles.
- Una caída de Jev **no bloquea** alta ni edición: el selector manual sigue operativo.
- Las descripciones de categorías pueden contener instrucciones escritas por usuarios: se tratan **como datos**, no como órdenes que puedan modificar permisos, esquema o flujo.

### 5.6 Validaciones de aceptación de la IA

| Caso | Resultado esperado |
| --- | --- |
| «Compra en Carrefour» y categoría «Supermercado» bien descrita | Sugerencia de «Supermercado» si supera el umbral. |
| «Uber al trabajo» y categoría «Transporte» | Sugerencia de «Transporte» si supera el umbral. |
| «Transferencia a Juan» sin categoría pertinente | No asignar por fuerza; permitir selección manual. |
| Usuario cambia «Supermercado» por «Hogar» | Respetar siempre «Hogar» en el gasto guardado. |
| Detalle cambia mientras hay una solicitud pendiente | Ignorar la respuesta obsoleta. |
| Gasto privado de B | Jev recibe categorías personales de B y compartidas de **todos sus grupos**, nunca personales de A ni de grupos ajenos. |
| Gasto compartido de B para «Casa» | Jev recibe **solo** categorías compartidas de «Casa», no las de «Viaje» ni personales. |
| Cambio de «Casa» a «Viaje» | La categoría de «Casa» deja de ser válida, se limpia y se descarta cualquier sugerencia antigua. |
| Activar «Compartido» con una categoría personal seleccionada | Limpiar esa categoría; sugerir otra del grupo seleccionado si corresponde, sin cambiar otros campos. |
| Desactivar «Compartido» con categoría compartida | Mantener esa misma categoría. |
| Categoría archivada | No se ofrece a Jev ni en gastos nuevos; se conserva en gastos históricos. |
| Timeout/error del modelo | El usuario sigue guardando manualmente, sin perder importe ni detalle. |

---

## 6. Reglas de negocio y cálculo del saldo

### Registro y visibilidad

1. Todo gasto tiene un propietario/pagador (`user_id`).
2. **Mis gastos** lista solo gastos creados por el usuario autenticado, sean privados o compartidos.
3. **Compartidos** muestra los grupos del usuario y permite seleccionar uno. La vista de un grupo lista solamente gastos con `shared_space_id` de **ese grupo**, si existe membresía comprobada. Los integrantes ven importe, detalle, **categoría del grupo**, fecha y pagador; ningún integrante accede a categorías personales o gastos privados de otro.
4. Cada registro existe una vez en la base: aparecer en dos pantallas **no** equivale a contabilizarlo dos veces.
5. Únicamente el autor puede editar o eliminar su gasto. Si activa/desactiva «Compartido» o modifica el importe, el saldo se recalcula a partir de los registros actuales.
6. Un gasto no puede asociarse a un espacio del cual su autor no sea integrante.
7. `expense.category_id` debe ser elegible: para privados, personal del autor **o categoría de cualquiera de sus grupos**; para compartidos, **categoría del grupo seleccionado**. Cambiar «Compartido» o de grupo conserva `category_id` únicamente si sigue siendo válido; si deja de serlo, exige elegir otra categoría antes de guardar. Nunca añade otro registro.
8. Cambiar una categoría de nombre refleja ese nombre en los gastos previos; archivarla no elimina ni rompe los gastos ya cargados. Una categoría común puede figurar en gastos privados: **eso no autoriza a listar esos gastos, ni revelar su existencia o cantidad** a otros integrantes.

### Reparto equitativo de N integrantes y saldos por grupo

- Cada grupo admite **N participantes** y cada persona puede integrar **varios grupos**. El saldo se calcula **por grupo**, sin mezclar gastos ni categorías de otros grupos; moneda inicial **ARS**.
- Para cada gasto, el reparto es equitativo entre los **participantes presentes al registrarlo**, almacenados en `expense_shares`. Si se une otra persona después, **no** asume gastos anteriores; nuevos gastos sí se reparten entre los integrantes que correspondan en ese momento. La edición del importe conserva las identidades participantes originales y recalcula sus partes.
- El saldo individual = `suma importes pagados por ese usuario en el grupo − suma de sus partes de gastos del grupo`. Saldo positivo: a favor; negativo: en contra; cero: equilibrado. **La suma de todos los saldos debe ser cero**, incluidos gastos con centavos sobrantes.
- El sobrante de `amountCents / N` queda asignado al pagador del gasto (como se detalla en `expense_shares`). Usar aritmética entera (`BIGINT`) y pruebas para N=2, 3, 5 y casos no divisibles.
- Ejemplo para A, B y C, todos presentes desde el inicio: A paga $60.000, B $10.000 y C $20.000. Cada parte es $30.000. Saldos: **A +$30.000**, **B −$20.000** y **C −$10.000**.
- **No** implementar transferencias, liquidaciones, cobros, ni la asignación de quién debe pagar a quién. La sección compartida muestra balances, no un mecanismo de compensación.

El cálculo se implementará durante el módulo de gastos: **la tarea actual de ajuste de categorías/espacios no debe crear `expenses` ni `expense_shares`**.

## 7. Autenticación, autorización y privacidad

- **Better Auth** administra registro, login, logout y sesión. Reutilizar sus tablas de usuarios; no implementar contraseñas ni sesiones propias.
- Todas las consultas y mutaciones consultan la **sesión en el servidor**; nunca se confía en un `user_id` enviado desde el cliente.
- Para ver gastos privados: `expense.user_id === session.user.id`.
- Para listar grupos o consultar uno concreto: buscar **solo las membresías del usuario** y comprobar pertenencia al `shared_space_id` elegido antes de leer gastos, catálogo o saldo. No inferir ni utilizar un grupo global «activo» sin validar la selección.
- Para editar/eliminar: verificar **propiedad del gasto**, además de que el espacio compartido asignado sea válido.
- No cargar gastos privados ajenos para filtrarlos después en el navegador: **el servidor debe excluirlos en la consulta**.
- Para categorías, filtrar por **`categories.user_id = session.user.id` o `categories.shared_space_id IN (grupos autorizados para ese usuario)`**, según ámbito y operación. Solo el propietario lee o administra las personales; los integrantes de cada grupo leen y administran **solo su catálogo**, incluidas descripciones. Los endpoints del catálogo común no deben exponer ningún gasto privado ni estadísticas que permitan inferirlo.
- En alta/edición de gasto, rechazar toda **nueva asignación** de categoría ajena, archivada o no elegible para el switch/grupo elegido; no confiar en el resultado de IA como autorización. Una categoría archivada puede permanecer en un gasto histórico si no se modifica `category_id`.
- Mantener claves de Better Auth y `DATABASE_URL` solo en variables de entorno del servidor; HTTPS en producción.
- Evitar cachear datos personales como contenido público o compartido entre sesiones.
- Para el primer piloto cerrado puede usarse acceso controlado; **antes de abrir el registro al público**, completar recuperación/verificación de correo y protección básica contra abuso de cuentas e invitaciones.

## 8. PWA: primera versión online

**Objetivo:** que se pueda agregar a la pantalla de inicio y abrir como una app, **no** que funcione sin internet.

Implementación inicial:

- Crear `src/app/manifest.ts` con `name`, `short_name`, `start_url`, `display: 'standalone'`, colores e íconos.
- Proveer íconos de **192×192** y **512×512** píxeles, además del favicon; personalizar metaetiquetas cuando corresponda.
- Servir la aplicación por **HTTPS** en producción.
- Verificar instalación/apertura en Android y en iPhone; el flujo de instalación varía por navegador (en iOS suele realizarse desde «Compartir» → «Agregar a pantalla de inicio»).
- Mostrar un error claro cuando falla una solicitud por falta de red y permitir reintentar. **No almacenar gastos localmente** ni prometer escritura offline.
- No incorporar por ahora service worker propio, caché offline, sincronización en segundo plano ni push. Si algún dispositivo exige un ajuste adicional para la instalación, resolverlo sin incorporar una estrategia de persistencia offline.

**Prueba de aceptación PWA:** instalada y abierta desde su ícono, la app muestra login, permite cargar/ver gastos con internet y comunica que se necesita conexión si esta falla.

## 9. UI y experiencia mobile-first

**Pantallas del MVP:**

1. Acceso / registro.
2. **Mis gastos**: lista, orden por fecha, filtro simple por mes y CTA principal «Agregar gasto».
3. **Nuevo / editar gasto**: importe, detalle, **selector único de categoría con sugerencia IA editable**, fecha (por defecto hoy), switch «Compartido» (desactivado por defecto) y selector de **grupo destino** solo al compartir. Categorías elegibles cambian según switch/grupo y conservan únicamente las selecciones válidas.
4. **Compartidos**: selector/listado de grupos; dentro de cada uno, saldos individuales y gastos con pagador, sin funciones para saldar.
5. **Cuenta / grupos**: listar, crear y unirse a varios grupos, invitar a más integrantes y cerrar sesión.
6. **Categorías** (acceso secundario desde Cuenta): crear, editar y archivar con nombre y descripción, diferenciando claramente **Personales** y **Compartidas por grupo**, con un único flujo de formulario; elegir grupo al crear categoría compartida.

**Criterios de diseño:**

- Diseñar primero para **360–390 px de ancho**, luego tablet y escritorio.
- Navegación primaria mínima: **Mis gastos** y **Compartidos** (con selector simple de grupo); CTA de carga fácilmente alcanzable con una mano.
- Campo de importe con teclado numérico adecuado; fechas y categorías con valores iniciales útiles.
- El proceso de registrar un gasto debería requerir **muy pocos toques**; no abrir formularios extensos. La sugerencia de categoría debe aparecer en el selector sin abrir una conversación ni un modal de IA.
- Mostrar un indicador discreto «Sugerida» y permitir que cualquier categoría se cambie con un toque. Si el usuario ya eligió, no volver a sugerir automáticamente.
- Descripciones de categorías: breve ayuda contextual y un ejemplo concreto de lo que incluyen o excluyen; gestionarlas fuera del formulario de gasto, salvo una acción mínima «Crear categoría» cuando faltan opciones. Al crear se selecciona ámbito Personal/Compartida (predeterminado Personal), y grupo específico si es compartida; ámbito y grupo propietario son inmutables.
- Evitar doble scroll, tablas demasiado anchas, tarjetas de estadísticas, gráficos y opciones que no se usan a diario.
- Usar **Tailwind + shadcn/ui** como base e **Impeccable** para diseñar, criticar y pulir componentes reales; mantener contraste, foco visible y objetivos táctiles cómodos.
- Estados indispensables: cargando, vacío, error, guardado exitoso y falta de conexión.

## 10. Organización sugerida del repositorio

```text
src/
  app/
    (auth)/                # Login y registro
    (app)/
      gastos/              # Listado personal y formulario
      compartidos/         # Lista de grupos + balance y gastos de grupo
      cuenta/              # Usuario, vínculo y acceso a categorías
      categorias/          # Gestión simple de categorías
    api/auth/[...all]/route.ts
    api/categories/suggest/route.ts   # Clasificador IA protegido
    manifest.ts
  components/
    ui/                    # shadcn/ui
    expenses/              # Formulario y filas de gasto
    shared/                # Grupos, saldos y listado compartido
    categories/            # Selector, editor y estados de sugerencia
  db/
    schema/                # Tablas de Better Auth + dominio
    index.ts               # Conexión Drizzle
  lib/
    auth.ts                # Better Auth en servidor
    auth-client.ts         # Better Auth en cliente
  features/
    expenses/              # Schemas Zod, consultas y mutaciones
    shared/                # Membresías N:M, permisos y balance por grupo
    invitations/           # Vínculo entre cuentas
    categories/            # CRUD, archivado y comprobación de propiedad
    classification/        # Servicio Jev con AI SDK, permisos y manejo de fallos
public/
  icon-192.png
  icon-512.png
drizzle/                    # Migraciones
```

La estructura es orientativa: puede empezar más pequeña y reorganizarse si crece. Evitar abstraer prematuramente todo en capas genéricas.

## 11. Calidad y pruebas mínimas

**Automatizar solo lo crítico inicialmente:**

- **Vitest**: pruebas unitarias del saldo para 2, 3 y 5 personas, sumatoria cero, centavos sobrantes, edición y nuevos miembros sin reparto retroactivo (al implementar gastos).
- Pruebas de integración de permisos: un usuario no puede leer gastos privados ajenos ni editar gastos compartidos del otro.
- Pruebas de vínculo: se admiten 3 o más integrantes por grupo, una persona puede pertenecer a 2 o más grupos, no hay membresía duplicada, los códigos son de un solo uso y las invitaciones de diferentes grupos no se confunden.
- Prueba funcional con 3+ cuentas y 2+ grupos: crear gasto privado, crear compartido, modificarlo, desmarcarlo y comprobar aislamientos y saldos de cada grupo sin afectar al otro.
- **Categorías**: verificar nombre/descripción, exclusividad de ámbito, unicidad por ámbito, edición/archivo común para todos los miembros autorizados, borrado solo de archivadas y sin referencias, prohibición de asignar categorías personales ajenas, categorías de otro grupo o personales a gastos compartidos, archivo sin romper históricos y ausencia de filtraciones de gastos privados incluso si usan categorías comunes. Al implementar gastos, cubrir reemplazo elegible y reasignación + eliminación transaccional, incluidos rollback y concurrencia.
- **IA**: mock del servicio Jev para selección válida, opción `no_match`, incertidumbre, error, timeout, respuestas obsoletas (detalle o switch), conjuntos de candidatas distintos y prioridad de selección manual válida. Pilotear ejemplos reales antes de fijar el umbral.
- Pruebas manuales en iPhone/Android de formulario, teclado, scroll, instalación y fallos de red.

No agregar un servicio complejo de auditoría ni telemetría de producto al MVP. Conservar únicamente registros técnicos mínimos para diagnosticar errores **sin datos sensibles**.

## 12. Infraestructura y despliegue

- **Repo Git** y flujo de trabajo por ramas de funcionalidad + pull request.
- Entornos: **desarrollo** con Neon PostgreSQL (ya configurado), **preview** por PR y **producción** (Next.js en Vercel y Neon, con bases/branches separadas por entorno).
- Variables mínimas según versión de las librerías: URL de PostgreSQL, secreto de Better Auth, URL base de autenticación y **credencial de AI Gateway** (si no se usa OIDC en el despliegue). No comitear `.env`.
- Migraciones versionadas: `pnpm drizzle-kit generate` y `pnpm drizzle-kit migrate` en un proceso controlado; no ejecutar cambios destructivos de esquema automáticamente al recibir tráfico.
- Tener copias de seguridad del PostgreSQL productivo y procedimiento básico para restaurarlo antes de abrir el producto a terceros.
- Elegir región de hosting/base coherente con usuarios principales para evitar latencia innecesaria; Neon ya fue elegido y configurado para el proyecto.

## 13. Orden de implementación

| Fase | Entregable comprobable |
| --- | --- |
| **0. Base técnica** | Next.js, TypeScript, pnpm, Tailwind, shadcn/ui, Impeccable preparado y PostgreSQL/Drizzle. |
| **1. Acceso y vínculo** | Better Auth, sesión, creación de **múltiples grupos por usuario** e invitaciones individuales para N integrantes. |
| **2. Categorías y registro personal** | Crear/editar/archivar categorías **personales y por grupo** con descripciones y permisos por ámbito/grupo; alta/edición/eliminación y listado de gastos privados con categorías elegibles. |
| **3. Sugerencias IA** | Integrar Jev (Choice) según categorías elegibles para switch **y grupo seleccionado**, preselección editable, fallback manual, invalidación de respuestas obsoletas y tests. |
| **4. Compartidos** | Selector de grupo al compartir, categorías **solo del grupo**, consulta para miembros, participaciones históricas y balances de N personas por grupo, con tests. |
| **5. PWA y refinamiento** | Manifest, íconos, pruebas de instalación, UX mobile-first y manejo de falta de red. |
| **6. Piloto** | Uso cotidiano en grupos de 2, 3 y más integrantes, calibración de sugerencias y despliegue estable. |

## 14. Explícitamente fuera del MVP

- Modo offline y sincronización posterior.
- Registrar pagos, transferencias o liquidaciones entre integrantes.
- Repartos configurables, porcentajes o subconjuntos arbitrarios por gasto, varias monedas y conversión de divisas; también la salida/expulsión de miembros con repartos históricos.
- Gráficos, tableros estadísticos, presupuestos, suscripciones, automatizaciones o importaciones bancarias.
- Adjuntos, OCR, **chat con IA, creación o edición automática de categorías, reclasificación masiva**, notificaciones push, servicios en tiempo real o app móvil nativa. **Solo entra la IA puntual de sugerencia de categoría.**
- Equivalencias entre categorías privadas de distintos usuarios, taxonomías globales, múltiples categorías por gasto y estadísticas por categoría.
- Administración compleja de organizaciones, roles finos e historial de auditoría visible.

## 15. Definición de terminado (MVP)

- [ ] Un usuario crea **varios grupos**, participa en más de uno y cada grupo admite **tres o más integrantes**, con invitaciones seguras.
- [ ] Cada uno carga un gasto una vez y lo encuentra en su lista personal.
- [ ] Un gasto marcado «Compartido» aparece **solo en el grupo elegido**, además del historial personal del autor.
- [ ] Ningún usuario puede consultar ni modificar los gastos privados del otro.
- [ ] Cada grupo presenta saldo **por integrante**; la suma es cero, se recalcula al editar/eliminar/desmarcar y nuevas incorporaciones no redividen gastos históricos.
- [ ] Cada usuario puede crear/administrar categorías privadas; cada grupo administra **su propio catálogo** entre sus miembros, sin alterar gastos históricos al archivarlas.
- [ ] Un gasto privado puede usar categoría personal propia o de cualquiera de sus grupos, pero uno compartido usa **solo una categoría del grupo seleccionado**. Ningún integrante ve gastos privados de otros, aunque usen categorías de grupo.
- [ ] Jev sugiere una categoría acorde con el detalle, entre las opciones permitidas; el usuario puede cambiarla antes de guardar.
- [ ] Si la IA no ofrece una respuesta confiable o está caída, se puede completar el gasto manualmente.
- [ ] Ninguna sugerencia tardía cambia una elección manual ni se reescriben gastos históricos automáticamente.
- [ ] La interfaz resulta cómoda para cargar gastos desde el celular.
- [ ] La aplicación se puede agregar a la pantalla de inicio y abrir en modo app.
- [ ] Todas las operaciones requieren conexión; fallos de red se explican sin pérdida silenciosa de información.
- [ ] No existe la funcionalidad de saldar deudas.

## 16. Referencias técnicas

- [Next.js — Progressive Web Apps](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js — Manifest](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
- [Better Auth — Instalación e integración con Next.js](https://better-auth.com/docs/installation)
- [Drizzle — Migraciones](https://orm.drizzle.team/docs/migrations)
- [Impeccable — Sitio y documentación](https://impeccable.style/)
- [TypeSafe AI — Jev](https://typesafe.ai/)
- [Vercel AI Gateway — TypeSafe AI / Jev](https://vercel.com/ai-gateway/models/jev)
- [Vercel — Guía para `experimental_decide` (SDK 7.0.128+)](https://vercel.com/i/ai-sdk-evaluation-to-decisions)
- [Vercel — Ejemplo práctico de Jev con elección entre opciones](https://vercel.com/i/using-jev-in-tanstack-start-with-tanstack-ai)
- [Vercel — Probabilidades y umbrales de Jev](https://vercel.com/i/jev-probabilities-and-thresholds)

---

**Principio rector:** una sola carga por gasto, categorías personales y un catálogo por grupo sin doble clasificación, varios grupos por usuario, IA que ahorra tiempo sin decidir por el usuario, privacidad por defecto, saldos por grupo correctos y una interfaz que dé ganas de usar todos los días. Cualquier incorporación que no ayude a eso se posterga.
