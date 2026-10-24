# Gestor de gastos personales + compartidos

*Documento funcional para iniciar el producto · MVP / versión 0.4 · 23 de octubre de 2026*

**PROPÓSITO**

Una app web sencilla para registrar un gasto una sola vez y, cuando corresponda, incluirlo automáticamente en el balance de uno de sus grupos compartidos (tipo Tricount). El gasto se clasifica en una **categoría creada por el usuario**, que la aplicación puede **sugerir automáticamente con IA** a partir del detalle ingresado. Las categorías pueden ser **personales o compartidas**, sin exigir clasificar dos veces un mismo gasto.

## 1. Problema y oportunidad

Hoy una misma compra para la casa se registra dos veces: en un gestor personal y en otra app para gastos en común. Esa duplicación agrega fricción y desincentiva llevar los gastos al día.

La propuesta combina ambas necesidades sin convertirlas en un sistema contable: cada persona administra sus gastos privados y puede participar de varios grupos, compartiendo en cada uno únicamente los gastos que asigna expresamente a ese grupo.

## 2. Principios de producto

- Carga mínima: importe, detalle, categoría, fecha y opción «Compartido». La categoría puede seleccionarse automáticamente a partir del detalle, pero siempre se puede corregir.
- Un único registro por gasto: marcarlo como compartido no crea una segunda copia.
- Privacidad por defecto: ningún integrante de un grupo accede a los gastos privados ni a las categorías personales de otra persona. El catálogo de un grupo (nombre y descripción de sus categorías) es visible y administrable por los integrantes de ese grupo, no por terceros.
- Balance comprensible: mostrar el saldo individual de cada participante dentro de cada grupo, sin gestión de pagos entre personas.
- Dos ámbitos de categorías: **personales** (propias) y **compartidas** (un catálogo independiente por grupo). Un gasto siempre tiene una sola categoría.
- IA como ayuda, no como dependencia: si se equivoca o no responde, el usuario puede guardar el gasto eligiendo la categoría manualmente.
- Diseño simple, rápido y mobile-first; evitar métricas y funciones que no resuelvan el caso central.

## 3. Usuarios y alcance inicial

Cada persona tiene una cuenta y **puede crear y participar en varios grupos compartidos simultáneamente** (por ejemplo, «Casa», «Viaje» y «Amigos»). Cada grupo puede tener **dos o más participantes, sin un límite fijo de producto**; una misma persona puede pertenecer a muchos grupos. Cada grupo tiene su propio catálogo de categorías, gastos y saldos: nunca se mezclan entre grupos.

Un gasto privado pertenece solo a quien lo creó. Para compartirlo, se selecciona **exactamente un grupo** del que se es miembro; no se permite compartir un mismo gasto en varios grupos en el MVP. El reparto de cada gasto común es **equitativo entre las personas que participaban en ese gasto cuando se creó**, sin porcentajes personalizados.

El caso de dos personas sigue funcionando, pero no es una limitación de arquitectura, datos ni interfaz.

## 4. Experiencia principal

### 4.1 Alta de un gasto

La persona ingresa **detalle**, importe, categoría y fecha (por defecto, hoy). La aplicación intenta sugerir una categoría según el detalle mientras completa el formulario. Un switch «Compartido» aparece desactivado inicialmente.

- **Privado**: permite sus categorías personales y las categorías compartidas de **todos los grupos a los que pertenece**, mostrando el nombre del grupo para desambiguar nombres repetidos.
- **Compartido**: hay que determinar **a qué grupo** pertenece el gasto. Si solo tiene un grupo, puede quedar preseleccionado; si tiene varios, debe seleccionar uno de forma clara antes de guardar. El selector ofrece únicamente las categorías compartidas **de ese grupo**.

Al guardar, el gasto queda en el historial personal de su autor y, si se compartió, aparece también **en el grupo elegido**, sin segunda copia. La IA nunca bloquea el formulario.

### 4.2 Categorías personales y compartidas

Hay **dos ámbitos de categorías** dentro del mismo gestor:

- **Personal**: la crea y administra cada usuario; solo él la ve y la puede asignar a sus gastos privados.
- **Compartida**: pertenece a **un grupo específico**; todos sus integrantes pueden crearla, verla, editarla y archivarla. Es elegible para gastos privados de sus miembros y para gastos compartidos **de ese grupo**, pero no para otros grupos.

Cada categoría tiene **nombre** (por ejemplo, «Supermercado»), **descripción obligatoria** (qué gastos incluye/excluye, útil para la IA) y estado **activa/archivada**. El ámbito y, en categorías compartidas, el grupo propietario permanecen fijos: para cambiarlos, se crea otra categoría.

Ejemplos: «Videojuegos» puede ser personal; «Supermercado», «Restaurantes» y «Hogar» pueden ser categorías del grupo «Casa». No hace falta que el gasto sea compartido para usar «Supermercado»: una compra individual también puede clasificarse allí sin que otros integrantes vean esa compra.

Cada ámbito evita nombres duplicados entre sus categorías activas, sin distinguir mayúsculas/minúsculas. Se pueden **renombrar, actualizar descripciones y archivar**; las categorías archivadas no pueden elegirse para nuevas asignaciones. Solo se puede eliminar definitivamente una categoría archivada y sin referencias, después de una confirmación explícita. En el estado actual todavía no existe la tabla de gastos, por lo que no hay referencias que reasignar. Cuando exista ese módulo, eliminar una categoría referenciada requerirá elegir una categoría de reemplazo elegible y reasignar sus gastos junto con la eliminación, en una única transacción.

La ruta `/categories` administra las categorías personales y muestra accesos compactos a los catálogos de los grupos del usuario. Cada acceso lleva a `/groups/[groupId]/categories`, que lista únicamente el catálogo del grupo correspondiente; el detalle del grupo ofrece el mismo acceso. No se cargan ni se muestran todas las tarjetas de categorías compartidas juntas en `/categories`. Los nombres iguales de grupo se distinguen en los accesos y cada ruta conserva el ID del grupo. El ámbito queda inferido por la pantalla: alta personal desde `/categories` y alta compartida desde el catálogo del grupo. Los formularios de alta y edición usan un Drawer en móvil y un Dialog en escritorio; editar no permite cambiar el propietario ni el grupo.

### 4.3 Categoría única en los gastos personales y compartidos

**Regla del MVP: un gasto, una única categoría. No hay doble clasificación.**

| Tipo de gasto | Categorías disponibles | Quién puede ver el gasto |
| --- | --- | --- |
| **Personal** (`Compartido` apagado) | Categorías personales del autor **y** categorías compartidas de cualquiera de sus grupos | Solo el autor |
| **Compartido** (`Compartido` encendido) | **Solo** categorías compartidas del grupo elegido | Todos los miembros de ese grupo |

**Ejemplo:** A registra «Compra en Carrefour» con «Supermercado · Casa», pero deja el switch apagado. B, integrante de «Casa», puede usar y editar esa categoría, pero **no ve esa compra** ni cuántos gastos privados la utilizan. Si A activa el switch y selecciona «Casa», conserva la categoría y el gasto aparece en ese grupo; si selecciona «Viaje», deberá elegir una categoría de «Viaje».

**Al cambiar el switch:**

- De **personal a compartido**, se pide el grupo destinatario (si hay varios). Si la categoría pertenece a ese grupo, se conserva sin pedir nada más.
- De **personal a compartido**, si la categoría era personal o pertenece a **otro grupo**, deja de ser válida. El formulario la limpia y **propone una categoría del grupo elegido con IA**, si corresponde; también se puede elegir manualmente. No se reclasifican otros gastos.
- De **compartido a personal**, se mantiene la categoría compartida si la persona continúa siendo miembro del grupo que la posee (también válida para gastos privados).
- Al **cambiar de grupo**, conservar la categoría solamente si pertenece al nuevo grupo; de lo contrario, limpiar y volver a sugerir/elegir. Nunca cambiar el grupo o compartir un gasto de forma silenciosa.
- Si no hay grupos o el grupo elegido no tiene categorías activas, explicar qué falta y ofrecer crear una. No guardar un gasto compartido sin grupo o con una categoría personal/de otro grupo.

Todos los integrantes pueden administrar las categorías de su grupo, pero **nunca** modificar los gastos personales de los demás. Editar o archivar una categoría compartida puede afectar cómo se muestran o clasifican los gastos que la usan; no expone los gastos privados ni los modifica retroactivamente.

### 4.4 Sugerencia automática con IA

1. La persona escribe un detalle reconocible, por ejemplo, «Compra en Carrefour».
2. La app evalúa **las categorías permitidas por el switch y el grupo elegido**: personales propias + compartidas de todos sus grupos si es privado; únicamente compartidas del grupo seleccionado si es compartido. Utiliza **nombre, descripción e identidad del grupo** (para desambiguar categorías iguales).
3. Si hay una coincidencia suficientemente clara, completa el campo con la categoría sugerida, de forma visible y modificable.
4. Si la sugerencia es dudosa, no corresponde a ninguna categoría o falla el servicio, la persona elige manualmente.
5. **La elección manual válida tiene prioridad**. La IA nunca sustituye una categoría permitida seleccionada expresamente ni cambia gastos ya guardados de forma automática. Si cambian el detalle, el switch o el grupo seleccionado y la categoría deja de ser elegible, se puede solicitar otra sugerencia entre las opciones permitidas; una respuesta tardía nunca sobrescribe la selección actual.

No hay un asistente conversacional. La IA es una clasificación puntual, silenciosa y opcional en términos de uso: la persona puede guardar sus gastos sin depender de ella. **El importe, la fecha y la marca «Compartido» no se infieren ni se modifican con IA.**

### 4.5 Vista personal

Cada usuario ve todos los gastos que registró, tanto personales como compartidos, y puede editarlos o eliminarlos. No ve los gastos privados cargados por los demás. El importe representa lo que efectivamente pagó, no solo su mitad.

### 4.6 Vista compartida

La sección «Compartidos» presenta **los grupos de los que la persona es miembro**. Al entrar a un grupo, ve sus gastos: importe, detalle, categoría, fecha y pagador. Los gastos y saldos de otros grupos no se mezclan. Todos los integrantes del grupo ven la misma lista, pero **no** los gastos privados de nadie.

El resumen muestra **un saldo individual por participante**: «A favor: $X», «En contra: $Y» o «Equilibrado». El saldo es neto respecto del grupo, **no una lista de transferencias o instrucciones de quién debe pagar a quién**.

### 4.7 Edición y eliminación

Un gasto se modifica desde su único registro. Si cambia el importe o se activa/desactiva «Compartido», el balance compartido se recalcula. Solo quien lo creó puede modificarlo o eliminarlo. Si se cambia el detalle de un gasto existente, **no se reemplaza su categoría sin indicación del usuario**; esta puede ajustarse manualmente.

## 5. Regla de cálculo del balance

Cada grupo tiene un balance independiente. Cada gasto compartido se reparte **equitativamente entre los participantes de ese gasto en el momento de registrarlo**. La pertenencia a un grupo puede crecer con nuevas invitaciones: quien se incorpore después **no asume retroactivamente** parte de gastos anteriores. Se conservará la distribución/participantes del gasto para evitar que los saldos históricos cambien por nuevas incorporaciones; la entidad de participaciones se implementará con el módulo de gastos, no con categorías.

**Fórmula por participante y grupo:** `saldo = total pagado por ese participante − total de sus partes asignadas`. Positivo = a favor; negativo = en contra; cero = equilibrado. La suma de todos los saldos del grupo debe ser siempre cero.

Ejemplo con tres participantes (gastos posteriores a que los tres se incorporaron):

| Participante | Pagó | Parte equitativa | Saldo |
| --- | ---: | ---: | ---: |
| A | $60.000 | $30.000 | **+$30.000** |
| B | $10.000 | $30.000 | **−$20.000** |
| C | $20.000 | $30.000 | **−$10.000** |
| **Total** | **$90.000** | **$90.000** | **$0** |

Los importes se calculan en centavos enteros. Cuando la división deja centavos sobrantes, se asignan al pagador de ese gasto para que la suma de partes sea exactamente el importe (convención inicial simple y determinista). Para grupos de dos se conserva el comportamiento 50/50.

**Fuera del MVP:** registrar liquidaciones, transferencias o pagos para saldar balances; porcentajes personalizados; dividir un gasto entre un subconjunto elegido manualmente. Tampoco se implementará aún salida de miembros de grupos con gastos, para evitar cambiar responsabilidades históricas sin definir reglas adicionales.

## 6. Pantallas mínimas

- Gastos: destino principal para el listado personal y la acción «Agregar gasto». Mientras ese módulo no exista, la ruta `/` mantiene un placeholder y no ofrece creación de gastos.
- Nuevo/editar gasto: formulario breve, con switch de compartido y categoría sugerida por IA, siempre editable.
- Grupos: listado de grupos; cada grupo tiene un detalle con integrantes e invitaciones. Los balances y gastos compartidos se incorporarán con el módulo de gastos.
- Categorías: destino principal con categorías personales y catálogos separados por grupo; creación, edición y archivo con nombre y descripción, con selector de grupo cuando corresponda.
- Cuenta: acceso discreto al cierre de sesión. Crear grupos, unirse e invitar integrantes vive en «Grupos».

En móvil, la navegación principal persistente ofrece **Gastos, Grupos y Categorías** con ícono y etiqueta. En escritorio se adapta a una barra superior. La navegación considera el área segura inferior y deja espacio para el contenido y el teclado virtual.

## 7. Funcionalidades incluidas en el MVP

| ID | Requisito | Prioridad |
| --- | --- | --- |
| F01 | Crear cuenta, iniciar/cerrar sesión y crear/unirse a múltiples grupos con N integrantes. | Imprescindible |
| F02 | Registrar gasto con importe, detalle, categoría, fecha y switch compartido. | Imprescindible |
| F03 | Listar los gastos propios, compartidos y no compartidos. | Imprescindible |
| F04 | Ver los gastos compartidos de cada grupo al que se pertenece, sin mezclarlos. | Imprescindible |
| F05 | Calcular por grupo un saldo individual de cada participante, con reparto igualitario entre los participantes de cada gasto. | Imprescindible |
| F06 | Editar o eliminar un gasto propio y recalcular automáticamente el balance. | Imprescindible |
| F07 | Crear y administrar categorías **personales y de cada grupo**, con nombre y descripción clara. | Imprescindible |
| F08 | Usar una sola categoría por gasto: en privados, personal propia o de cualquier grupo propio; en compartidos, exclusivamente del grupo destinatario. | Imprescindible |
| F09 | Sugerir automáticamente una categoría por IA a partir del detalle y las descripciones de las categorías activas. | Imprescindible |
| F10 | Permitir cambiar o elegir categoría manualmente; continuar si la IA no responde o tiene baja certeza. | Imprescindible |
| F11 | Ofrecer un catálogo separado por grupo a sus integrantes, sin revelar gastos privados clasificados con él. | Imprescindible |
| F12 | Ordenar por fecha y ofrecer navegación básica por mes. | Recomendable |
| F13 | Proveer algunas categorías iniciales de ejemplo, editables. | Recomendable |
| F14 | Ajustar categorías elegibles al cambiar «Compartido» o el grupo destino, conservar solo las válidas y sugerir otra cuando corresponda. | Imprescindible |
| F15 | Permitir múltiples membresías por usuario e invitaciones independientes por grupo, sin límites artificiales de dos integrantes. | Imprescindible |

## 8. Fuera de alcance

- Registrar liquidaciones, transferencias o pagos para saldar el balance entre usuarios.
- Repartos variables o porcentajes personalizados, selección manual de beneficiarios por gasto y salidas/expulsiones de integrantes con gastos históricos.
- Gráficos avanzados, presupuestos, objetivos, conciliación bancaria o importación automática.
- Multimoneda, tasas de cambio, adjuntos de comprobantes y reportes extensos.
- Chat con IA, análisis predictivo, etiquetado múltiple, categorías jerárquicas, creación automática de categorías o reclasificación masiva.
- Equivalencias automáticas entre categorías personales de distintos usuarios, sincronización de catálogos privados o doble categorización de un gasto.
- Auditorías o historial de cambios expuesto al usuario, roles complejos y administración empresarial.

## 9. Modelo conceptual de datos

| Entidad | Datos principales / propósito |
| --- | --- |
| Usuario | ID, nombre, correo y credenciales administradas por el proveedor de autenticación. |
| EspacioCompartido | ID y nombre opcional del espacio (p. ej., «Casa»). |
| Miembro | Relación usuario–grupo; varios miembros por grupo y varios grupos por usuario. |
| Invitación | Código de un solo uso con caducidad, asociado a un grupo concreto. |
| Categoría | ID, nombre, descripción, estado (activa/archivada) y **un ámbito excluyente**: usuario propietario o espacio compartido. |
| Gasto | ID, autor/pagador, importe, moneda, detalle, **una única categoría elegible**, fecha y grupo destinatario opcional (nunca varios grupos). |
| ParticipaciónGasto (fase de gastos) | Referencia a gasto, usuario participante e importe de su parte; conserva el reparto histórico aunque el grupo incorpore nuevas personas. |

> Un gasto pertenece siempre a un usuario y tiene **una sola categoría**. Un gasto privado admite categoría personal propia o compartida del espacio; uno compartido exige categoría del mismo espacio compartido. **Usar una categoría de cualquier grupo no revela el gasto privado a los demás miembros.**

## 10. Reglas de negocio y privacidad

- Solo el autor del gasto puede editarlo o eliminarlo.
- Los gastos no compartidos nunca se devuelven en las consultas de otros miembros de ningún grupo.
- El importe debe ser positivo; fecha y categoría son obligatorias. Se usa ARS como moneda inicial.
- El servidor valida las categorías elegibles: **personales del autor o de cualquiera de sus grupos** para gastos privados; **solo del grupo destinatario** para gastos compartidos. No se puede asignar una categoría privada a un gasto compartido.
- Todos los integrantes de un grupo pueden consultar **nombre y descripción de las categorías de ese grupo**, además de crearlas, editarlas y archivarlas; los demás usuarios no. Nadie puede consultar categorías personales ajenas ni inferir qué gastos privados usan categorías grupales.
- Una categoría archivada permanece visible en gastos históricos, pero no se ofrece para nuevas asignaciones. Solo se elimina definitivamente si no tiene gastos asociados; una categoría en uso requiere reemplazo y reasignación atómica cuando se implemente ese flujo.
- Solo las categorías **activas y elegibles para el estado del switch y grupo** se ofrecen a Jev con sus descripciones; nunca categorías personales ajenas. La IA **no puede crear ni modificar categorías**.
- La sugerencia nunca modifica un gasto guardado sin una acción expresa del usuario; el fallo de la IA no impide guardar con elección manual.
- La fecha por defecto es la actual, pero se permite cargar compras anteriores.
- El saldo se calcula **por grupo** sobre sus gastos vigentes y los participantes históricos de cada gasto; no se reinicia por mes ni se redivide al añadir integrantes.
- Si se quita el marcado «Compartido», el gasto permanece en el listado personal y desaparece de la vista del grupo donde estaba compartido.

## 11. Criterios de aceptación

El MVP se considera funcional cuando se cumplen estos escenarios:

- A registra un gasto privado: A lo ve; B no puede verlo en ninguna pantalla ni consulta.
- A registra un gasto compartido: figura una vez en «Mis gastos» de A y una vez en la vista común de ambos, referenciando el mismo gasto.
- A paga $80.000 y B $40.000 en gastos compartidos: el espacio muestra $20.000 a favor de A.
- A edita su gasto de $80.000 a $60.000: el balance se actualiza sin intervención manual.
- A desactiva «Compartido»: el gasto sigue siendo personal y deja de participar del balance.
- A y B pertenecen a «Casa» y tienen acceso a la categoría «Supermercado»; si A registra «Compra en Carrefour», la IA puede proponerla tanto para un gasto privado como para uno compartido.
- A puede sustituir la sugerencia por «Hogar» antes de guardar; el gasto conserva **la selección manual**.
- Si la IA falla, no hay coincidencia o A no tiene categorías activas, el flujo informa qué falta y deja seleccionar o crear una categoría sin perder el gasto en edición.
- A registra un gasto privado en la categoría compartida «Supermercado»: B ve y puede editar esa categoría, pero **no** ve el gasto ni sabe que se utilizó. Al compartirlo, B ve el gasto sin duplicaciones.
- B conserva categorías privadas propias; la IA de B usa sus categorías privadas y las de **todos sus grupos** en gastos privados, pero **solo las del grupo seleccionado** en gastos compartidos.
- Si A selecciona una categoría personal y activa «Compartido» para «Casa», la categoría se limpia y puede recibir una nueva sugerencia compartida, sin volver a introducir el resto del gasto.
- Si A desactiva «Compartido» con una categoría del grupo elegido, esta se conserva. Si cambia de «Casa» a «Viaje», la categoría se limpia salvo que pertenezca a «Viaje».
- Archivar cualquier categoría no rompe los gastos ya guardados ni los saldos.
- Una categoría activa debe archivarse antes de eliminarla. Una categoría archivada sin gastos puede eliminarse con confirmación; si tiene gastos asociados, se conserva hasta elegir un reemplazo válido y reasignar las referencias sin alterar los datos del gasto.
- A pertenece a «Casa» y «Viaje»; B solo a «Casa»; C solo a «Viaje». A puede administrar ambos catálogos; B nunca accede al catálogo de «Viaje» ni C al de «Casa».
- A crea un grupo de tres integrantes y cada nuevo miembro se suma con invitación propia de un solo uso. El historial de gastos anterior al ingreso de C no se redistribuye a C.
- En el ejemplo de A=$60.000, B=$10.000 y C=$20.000, se muestran saldos +$30.000, −$20.000 y −$10.000 en ese grupo, sin afectar otros grupos.
- No aparece ninguna acción para saldar deudas ni registrar transferencias entre integrantes.

## 12. Decisiones para arrancar

Defaults propuestos: reparto equitativo entre N participantes históricos por gasto, moneda ARS, **varios grupos por usuario y N integrantes por grupo**, balance acumulado **por grupo**, **categorías personales y un catálogo por grupo**, sugerencia con **Jev de TypeSafe AI**, y edición de gastos exclusiva por autor. La selección automática solo actúa en el formulario, antes de guardar, y únicamente cuando existe suficiente certeza. Son decisiones revisables después del piloto.

## 13. Primer plan de implementación

Etapa 1 · Base: autenticación, usuarios, creación/unión de múltiples grupos por invitación y estructura de gastos.

Etapa 2 · Categorías: alta, edición y archivo de categorías personales y compartidas **de cada grupo**, con validación de permisos, selección de grupo y descripciones claras.

Etapa 3 · Uso diario: carga, listado y edición rápida de gastos personales con switch compartido.

Etapa 4 · Sugerencias IA: clasificación con Jev según categorías elegibles para el switch, selección editable, manejo de cambios de ámbito, incertidumbre y fallos.

Etapa 5 · Balance y privacidad: vista independiente por grupo, cálculo equitativo con saldos por persona, conservación de participantes históricos y aislamiento de gastos privados aunque usen categorías compartidas.

Etapa 6 · Validación: probar con distintos grupos (2, 3 y más personas), medir errores de clasificación y pulir la interfaz mobile-first.

> Criterio rector: si una función no reduce la doble carga, el esfuerzo de categorizar o la comprensión del saldo, no entra en la primera versión. La IA debe **ahorrar toques**, no agregar pasos.
