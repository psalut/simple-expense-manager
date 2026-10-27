# Gestor de gastos personales y compartidos — Idea de producto

**Versión:** 0.7 · **Actualizado:** 27 de octubre de 2026 · **Estado:** primera publicación en Vercel realizada; PWA pendiente
**Documento complementario:** `Especificacion_tecnica_gestor_gastos_MVP_v0.7.md`

## Estado real y cambio de rumbo

La simplificación v0.7 **ya fue implementada** según los informes del agente: varios grupos por usuario con un máximo de dos integrantes por grupo, catálogo global editable con color, gastos únicos privados/compartidos, balance 50/50 sin selección de participantes y sugerencias de Jev mediante la **API directa de TypeSafe AI** (sin AI Gateway). La nueva migración inicial `0000_initial_v07.sql` y el seed de categorías fueron aplicados por el usuario a Neon después de borrar las tablas anteriores; las pruebas posteriores funcionaron contra ese esquema.

**Pruebas funcionales:** la reejecución automatizada registró 23 PASS / 1 FAIL / 3 BLOCKED / 2 NOT RUN. Luego el usuario volvió a probar satisfactoriamente fecha de edición, ciclo privado/compartido, sugerencias de Jev con HTTP 200 y experiencia móvil. El fallo de fecha del reporte no se reprodujo manualmente (sin que conste una corrección de código). La seguridad de Server Actions pasó **9/9 pruebas con PostgreSQL real** y sesiones de tres usuarios; falta verificar específicamente el transporte HTTP/CSRF/origin de Next.js.

**Evolución de UI (26–27/10/2026):** se refinó la experiencia móvil: encabezado global oculto en móvil, acceso a Cuenta junto al título, inputs y selectores coherentes con Rhea, calendario ampliado con selección de hoy y acciones Cancelar/Aplicar, switch Compartido al final, scroll y foco más cuidados. Los agentes reportaron pruebas visuales de navegador a 360/375/390 px y escritorio, pero no un ensayo físico completo en iOS/Android.

**Primer despliegue:** el usuario confirmó el **27 de octubre de 2026** que realizó el primer deploy en Vercel desde GitHub (`main`). No se proporcionó aún la URL definitiva ni resultados de una ronda de uso sobre producción; no se asume validada la autenticación, la conexión a Neon o Jev desde el dominio publicado hasta probarlos.

**Pendientes conocidos:** definir/probar pérdida de conexión y reintentos (E2E-26), afinar Jev con el uso, validar producción con dos cuentas, completar PWA e instalación en dispositivos. La exposición previa de secretos de `.env.local` motivó recomendación de rotación; **no está confirmada**. El último hash de commit, merge y estado del worktree no constan en este seguimiento.

Esta versión reemplaza definitivamente la arquitectura N-personas y categorías por usuario/grupo de v0.6. En `docs/` solo se conservarán este documento y la especificación técnica; los reportes temporales E2E se eliminan del repositorio, pero se conservan las pruebas automatizadas reproducibles.

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

## 12. Estado de entrega y siguientes pasos

- **Completado:** arquitectura simplificada, grupos de máximo dos, categorías globales editables con color, gastos privados/compartidos, balances 50/50, baseline/seed de Neon y Jev directo a TypeSafe.
- **Validado antes de publicar:** flujos de categorías, grupos, invitaciones, edición, reparto y privacidad; 9/9 pruebas de autorización contra PostgreSQL real; verificaciones manuales de fecha, Jev y experiencia móvil. El módulo de UI se refinó en iteraciones adicionales.
- **Desplegado:** primer deploy en Vercel confirmado por el usuario el 27/10/2026, importando la rama `main` desde GitHub. **Aún no hay constancia de un smoke test productivo ni URL final registrada.**
- **Próximo paso:** pruebas desde el dominio de producción y un celular real, con dos cuentas; comprobar login/cookies, Neon, Jev, gastos y balances. Revisar rotación de secretos y separación de entornos antes de extender el piloto.
- **Pendiente posterior:** PWA instalable online, comportamiento de error/reintento sin conexión (E2E-26), calibración futura de Jev y eventual prueba HTTP/CSRF de Server Actions.
- **Documentación y Git:** mantener únicamente estos dos `.md` de seguimiento en `docs/` y tests reproducibles en código, sin reportes efímeros; ramas por funcionalidad, commits Conventional Commits en inglés y merge directo a `main` sin PR.
> **Principio rector:** una carga por gasto, una categoría global con color, varios grupos pero siempre de dos, reparto 50/50 y IA que ahorra toques.
