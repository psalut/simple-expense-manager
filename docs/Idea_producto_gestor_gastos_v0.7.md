# Gestor de gastos personales y compartidos — Idea de producto

**Versión:** 0.7 · **Fecha:** 24 de octubre de 2026 · **Estado:** rediseño funcional aprobado, código implementado; reset remoto pendiente
**Documento complementario:** `Especificacion_tecnica_gestor_gastos_MVP_v0.7.md`

## Estado real y cambio de rumbo

La versión anterior usaba Next.js, Better Auth, Neon/PostgreSQL, Drizzle, grupos con N integrantes y categorías personales/por grupo. El agente informó gastos personales/compartidos, repartos y balances en la rama `feat/expenses-and-balances`, sin commit, PR ni merge confirmados. No constan pruebas end-to-end multiusuario ni validación física móvil. El estado actual de v0.7 se registra al final de este documento.

**Decisión de producto v0.7:** reemplazar esa arquitectura de dominio por una versión realmente limitada a grupos de **como máximo dos personas**, con **catálogo global editable de categorías**, colores y reparto **50/50**. Se solicita reiniciar desde cero el historial de migraciones y la base de **desarrollo**, de manera controlada y con respaldo/verificación del destino. Esta especificación reemplaza las decisiones funcionales incompatibles de v0.6.

## 1. Propósito

Registrar cada gasto **una sola vez**, en el historial de quien lo pagó, con la opción de compartirlo en **uno** de sus grupos de dos personas. Evitar la doble carga entre un gestor personal y una app de gastos en pareja. El reparto es siempre 50/50; la IA **Jev** ayuda a elegir una categoría del catálogo común sin quitarle al usuario el control.

## 2. Principios

- **Mobile-first:** registrar un gasto en pocos toques y con interfaz clara.
- **Privacidad por defecto:** el listado personal contiene **solo gastos creados por el usuario**; los gastos de la otra persona aparecen únicamente al entrar al grupo correspondiente.
- **Múltiples grupos:** una persona puede pertenecer a varios grupos, pero cada uno admite como máximo dos integrantes; no existe una relación de grupo único por usuario.
- **Categorías globales:** un catálogo compartido por toda la app, sin categorías personales ni catálogos por grupo.
- **Catálogo editable:** cualquier usuario autenticado puede crear, editar nombre, descripción y color, archivar, restaurar y eliminar categorías archivadas bajo reglas de integridad.
- **IA no obligatoria:** Jev sugiere una categoría elegible; elección manual siempre disponible.
- **Balances sencillos:** saldo neto por persona y grupo, sin registrar liquidaciones ni transferencias.

## 3. Usuarios y grupos

Cada cuenta puede crear varios grupos y aceptar invitaciones de grupos distintos. Un grupo se crea con su creador como primer integrante y **admite un único segundo integrante**. El cupo se valida también en servidor/transacción para evitar aceptación simultánea de invitaciones por dos personas. No se permiten terceros ni selección de subconjuntos de participantes. Un grupo con una sola persona es un estado transitorio válido hasta que otra acepte la invitación.

**Regla durante ese estado transitorio:** un gasto puede guardarse como privado, pero **no se puede guardar como compartido en un grupo que aún no tiene dos integrantes**. No hay reparto incompleto ni deuda hacia alguien aún no incorporado. No se ofrecen altas de grupo desde el formulario de gasto. Si la persona no tiene grupos, el control «Compartido» se oculta. Si tiene grupos pero ninguno completo, el formulario no permite guardar como compartido y explica brevemente por qué.

## 4. Catálogo global de categorías

Cada categoría tiene identificador, **nombre**, **descripción** (útil para Jev), **color** y estado activa/archivada. Ejemplos iniciales editables: Supermercado, Restaurantes, Transporte, Combustible, Hogar, Salud, Entretenimiento y Otros; la lista y sus colores pueden ajustarse durante el piloto.

- Existe **un único “Supermercado” global**, no “Supermercado · Casa”, ni duplicaciones entre usuarios o grupos.
- Todos los usuarios autenticados ven y pueden administrar el catálogo global. Cualquier cambio de nombre, descripción o color es visible para todos y se refleja en gastos históricos asociados.
- No se admiten nombres duplicados **entre categorías activas**, sin distinguir mayúsculas/minúsculas ni espacios marginales.
- Una categoría archivada **no puede asignarse a gastos nuevos ni usarse como sugerencia de Jev**, pero mantiene su nombre/color en gastos históricos.
- Eliminar definitivamente una categoría archivada exige seleccionar un reemplazo activo si existen gastos asociados. Para no revelar utilización en gastos privados ajenos, puede exigirse siempre un reemplazo al iniciar esa operación; la sustitución y eliminación ocurren de manera atómica, sin revelar gastos afectados ni modificar importes/saldos.
- El color identifica visualmente la categoría en selector y listas; **no** codifica saldo positivo/negativo ni se utiliza para decisiones de Jev. Cuidar contraste y accesibilidad; no depender del color como único identificador.

**Consecuencia de privacidad aceptada:** al ser un catálogo global editable, modificar una categoría puede afectar la presentación de gastos de otras personas; eso no autoriza a consultar esos gastos ni sus cantidades.

## 5. Alta de gasto

Formulario único en **Drawer móvil / Dialog escritorio**, reutilizado desde listado personal y desde detalle de grupo:

1. **Importe** positivo en ARS, con teclado numérico adecuado y soporte de centavos.
2. **Detalle** breve, obligatorio.
3. **Categoría** global activa, preseleccionable por Jev y modificable manualmente. No mostrar nombres de grupos junto a la categoría.
4. **Fecha** de gasto, por defecto la del día, editable para gastos anteriores.
5. **Compartido** desactivado por defecto cuando se abre desde el listado personal. Solo aparece si el usuario pertenece al menos a un grupo; al activarlo exige **grupo completo de dos integrantes**.

Si el usuario pertenece a un solo grupo completo, puede quedar preseleccionado; si dispone de varios, elige explícitamente uno. **La lista de categorías NO cambia al activar Compartido o cambiar de grupo:** el catálogo global es idéntico. No hay selector de participantes: el reparto siempre es 50/50 entre los dos integrantes del grupo.

Desde el detalle de un grupo completo, «Agregar gasto» abre el mismo formulario con grupo preseleccionado y Compartido activo. Nunca se crea una segunda copia del gasto.

## 6. Categorización automática con Jev

Al escribir un detalle, por ejemplo «Compra en Carrefour», Jev analiza el **detalle actual** y los **nombres/descripciones de categorías globales activas**. Con coincidencia suficientemente segura, muestra «Supermercado · Sugerida» en el formulario. La persona puede elegir otra categoría y **su elección manual prevalece**. Si Jev falla, no responde o no encuentra coincidencia clara, la carga manual sigue disponible; no se inventan categorías.

La sugerencia se consulta desde el servidor a la API oficial de TypeSafe AI. El servidor envía solo el detalle y las opciones activas del catálogo global; la categorización es opcional y nunca bloquea el guardado manual.

- No enviar datos de otras personas, historiales, importes, balances ni identificadores de grupos.
- No disparar solicitudes por cada tecla; descartar respuestas obsoletas si cambia el detalle o el usuario selecciona manualmente.
- Cambiar «Compartido» o grupo **no invalida por sí solo una categoría global**, porque todas son elegibles en ambos casos.
- En edición no reclasificar automáticamente un gasto ya guardado: la categoría solo cambia por una elección expresa.
- La sugerencia es una mejora de UX, nunca requisito para guardar el gasto.

## 7. Listados y detalle

### Gastos personales (`/`)

Solo gastos **creados por el usuario**, privados y compartidos, ordenados por fecha descendente y agrupados por día. Navegación básica por mes. Cada fila indica detalle, categoría y color, importe y un indicador discreto de Compartido cuando corresponda. CTA «Agregar gasto» cómodo en móvil. Sin estadísticas ni filtros complejos.

### Gastos de cada grupo (`/groups/[id]`)

Todos y solo los gastos compartidos con **ese grupo**: fecha, detalle, importe, categoría/color y nombre de quien pagó. Un gasto creado por la otra persona **jamás aparece en el historial personal**, aun si el usuario debe asumir la mitad.

### Consulta y edición

Tocar un gasto abre su detalle. **Solo el autor/pagador** puede editar o eliminar, desde el mismo Drawer/Dialog con datos precargados. Otro integrante puede ver importe, detalle, categoría, fecha, pagador, grupo y **reparto 50/50**, en modo solo lectura sin controles de mutación.

El autor puede cambiar importe, detalle, fecha, categoría, el switch Compartido y el grupo elegido. Si cambia de grupo, se recalcula el reparto para la pareja del nuevo grupo y se actualizan ambos balances. Si desactiva Compartido, el gasto queda únicamente en su historial personal. La eliminación es definitiva y requiere confirmación; no hay gesto de deslizar para eliminar.

## 8. Balances por grupo

Para cada gasto compartido, **el pagador asumió el desembolso total** y cada integrante del grupo debe la mitad del gasto. Los saldos son **acumulados desde el inicio**; no se reinician por mes y no mezclan distintos grupos.

**Saldo de cada integrante = total pagado por esa persona en el grupo − suma de sus partes asignadas.** Positivo = a favor; negativo = en contra; cero = equilibrado. La suma de los dos saldos siempre es exactamente cero.

Los importes se calculan en centavos enteros. Ante un centavo impar, la parte del pagador recibe el centavo extra: para un importe de **$100,01**, el pagador asume **$50,01** y la otra persona **$50,00**. Al cambiar el pagador no hay una opción de formulario: el pagador sigue siendo el autor del gasto.

El detalle de grupo muestra los saldos de **ambos integrantes** con estado A favor / En contra / Equilibrado. Al tocar un saldo, se despliegan **total pagado** y **parte asignada**. No hay instrucciones de quién paga a quién, cobros ni liquidaciones.

## 9. Pantallas mínimas y navegación

- **Gastos** (inicio `/`): listado personal, selector mensual, CTA, Drawer/Dialog para gasto.
- **Grupos** (`/groups`): grupos propios, invitaciones y detalle con gastos y balances de una pareja. Mantener acceso a varios grupos.
- **Categorías** (`/categories`): catálogo global editable con nombre, descripción, color, archivado/restauración y borrado seguro. **Eliminar la ruta de categorías por grupo** y los enlaces antiguos hacia ella.
- **Cuenta**: registro/login/logout existentes con Better Auth.
- **PWA** online instalable: fase posterior, sin offline.

Mantener la navegación inferior móvil **Gastos / Grupos / Categorías**, Tailwind + shadcn/ui Rhea y accesibilidad de toques, foco y contraste.

## 10. Criterios de aceptación

- Una cuenta puede crear y pertenecer a **varios** grupos; cada grupo rechaza un tercer integrante, incluso ante invitaciones aceptadas simultáneamente.
- Un grupo incompleto (una persona) no admite gastos compartidos hasta sumar a su segundo miembro.
- Existe un solo catálogo global y se puede usar la misma categoría en gastos privados y compartidos; no aparecen nombres duplicados por ámbito.
- Todos pueden crear/editar/archivar categorías, incluido su color, sin acceder a gastos privados ajenos.
- Categorías archivadas continúan visibles en históricos, no en altas. El borrado con reemplazo preserva gastos, importes y balances.
- El listado personal muestra solo gastos registrados por la propia persona; el listado grupal solo los compartidos del grupo.
- Tocar un gasto ajeno desde grupo muestra todo su detalle en **solo lectura**; nadie salvo el autor puede editarlo o eliminarlo.
- Un gasto compartido se reparte **50/50**, sin selector de participantes, y los dos saldos suman cero incluso con centavos impares.
- Cambiar importe, grupo o estado compartido, o eliminar el gasto, recalcula saldos sin duplicaciones.
- Jev sugiere categorías globales activas, respeta la selección manual y permite guardar si falla.
- La experiencia es usable a 360–390 px y comunica errores/falta de conexión.

## 11. Fuera del MVP

Terceros integrantes, selección de participantes, repartos distintos de 50/50, pagos/liquidaciones, multi-moneda, analítica y presupuestos, adjuntos/OCR, chat con IA, reclasificación automática de gastos existentes, offline/sincronización, roles avanzados y migración de datos históricos del prototipo de desarrollo.

## 12. Plan de transición (definición original)

1. Congelar esta definición y actualizar documentación.
2. Inspeccionar el repositorio y validar qué partes de la entrega de gastos existen en la rama actual.
3. **Confirmar que Neon usado es exclusivamente desarrollo**, respaldar lo necesario, resetear esquema/datos e historial de migraciones **sin tocar ninguna base productiva o compartida por error**.
4. Construir la nueva migración inicial y adaptar dominio, autorización, grupos, catálogo y gastos al modelo v0.7.
5. Rehacer pruebas unitarias/integración, probar con **dos cuentas y dos grupos** y verificar móvil.
6. Integrar Jev y posteriormente PWA/despliegue.

**Git:** rama por funcionalidad, Conventional Commits en inglés y merge directo a `main`, sin PR. No presuponer commits/merges de entregas anteriores que el agente haya dejado pendientes.

> **Principio rector:** una carga por gasto, una categoría global con color, varios grupos pero siempre de dos, reparto 50/50 y IA que ahorra toques.

## Estado de implementación — 24 de octubre de 2026

El código v0.7 y su baseline local están preparados; el reset remoto sigue pendiente porque con la configuración disponible no se pudo verificar que el endpoint Neon apunte inequívocamente a desarrollo. No se cambió la base, no se aplicó migración y no se cargó seed. Las verificaciones locales aprobadas y los límites de revisión están detallados en la especificación técnica.
