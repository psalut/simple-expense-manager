# Casa — Idea de producto y seguimiento

**Versión documental:** v0.8 (ingresos personales) · **Revisado contra el código:** 16 de noviembre de 2026
**Documento complementario:** `Especificacion_tecnica_gestor_gastos_MVP_v0.7_2026-10-27_actualizada.md`

## 1. Estado actual

El código del repositorio implementa una aplicación privada mobile-first para gastos e ingresos personales, gastos compartidos y reembolsos de dos integrantes de Casa. Las rutas de grupos históricos se conservan para consultar datos autorizados; no constituyen administración de múltiples hogares.

La documentación histórica registra un despliegue previo y pruebas en iPhone, pero el repositorio por sí solo no confirma qué revisión o migraciones están hoy desplegadas. Verificar ese estado en cada entorno. Los gastos se reflejan optimistamente al crear, editar o eliminar; los cambios se confirman y reconcilian con el servidor. Ingresos y reembolsos mantienen su flujo actual.

## 2. Principios del producto

- **Dos usuarios, un hogar:** existe un único espacio compartido llamado **Casa**, con máximo dos integrantes. No hay administración de múltiples grupos en la experiencia habitual.
- **Una sola carga por gasto:** un gasto se registra una vez, como privado o compartido.
- **Ingresos personales:** cada persona puede registrar ingresos visibles solo para ella; no participan en la distribución de gastos de Casa.
- **Privacidad:** en Gastos cada persona ve los gastos que cargó/pagó; en Casa ambos ven los gastos compartidos, incluidos los que pagó la otra persona.
- **Simplicidad:** reparto automático 50/50 y pagos entre integrantes, sin presupuestos.
- **Mobile-first:** tres pestañas, formularios cómodos, navegación inferior y experiencia PWA instalable.
- **Sin offline:** se necesita internet; no se persisten gastos o sesiones en una caché offline.

## 3. Pantallas

### Gastos (`/`)

- Historial personal del usuario del mes elegido: gastos privados, gastos compartidos que pagó e ingresos; cada ingreso se identifica por separado y no tiene categoría.
- Selector de mes y **total gastado mensual centrado inmediatamente debajo** dentro de un badge compacto bordó con texto blanco, mostrando solo el importe. Si el mes tiene al menos un ingreso, debajo de la línea inferior de la sección del mes y antes de los movimientos se muestra el neto personal (ingresos menos gastos de ese mes) dentro de un badge color hueso con la etiqueta «Saldo del mes», incluso cuando el resultado es cero o negativo. Si no hay ingresos, el badge de saldo no aparece.
- Encabezado compacto; alta de movimiento en el encabezado en escritorio y con un botón flotante **+** en móvil.
- Edición y eliminación únicamente de los movimientos propios.

### Casa (`/household`)

- Acceso directo desde la pestaña **Casa**, con ícono de corazón; no hay listado ni selector de hogares; si existen grupos históricos autorizados, aparece un acceso a su historial.
- Selector mensual y total de gastos compartidos de ambos integrantes, centrado debajo del mes en el mismo badge que en Gastos; los gastos del mes se agrupan por día y muestran las iniciales de quien pagó cada uno en un badge con color estable por persona.
- Se muestra el saldo personal acumulado del usuario autenticado en una única fila de ancho completo, con estado a favor, deuda o saldo equilibrado (incluido el cero). No incluye título, subtítulo, desglose ni saldo de la otra persona; tampoco muestra una lista de integrantes. El reparto 50/50 se mantiene como regla del dominio.
- El alta usa un botón en el encabezado en escritorio y un botón flotante **+** en móvil, sin un título interno para la lista de gastos compartidos. Ambos abren el selector de acciones cuando existe una deuda y Casa tiene dos integrantes: cargar un gasto compartido o registrar un reembolso. Sin deuda, se oculta la acción de reembolso y el botón disponible abre directamente el alta de gasto. El selector aparece como bottom sheet en móvil y dialog en escritorio.
- Alta de gasto desde Casa con opción Compartido activada automáticamente. «Registrar reembolso» permite a cualquiera de los integrantes registrar o anular pagos parciales o totales. La actividad mensual intercala gastos y pagos, incluso los anulados; el total mensual suma solo gastos y el balance es acumulado.
- Invitación utilizada únicamente para incorporar a la segunda cuenta durante el onboarding.

### Categorías (`/categories`)

Catálogo global editable, con nombre, descripción, color, ícono y estado activa/archivada. El listado muestra nombre, color y estado; la descripción se consulta al abrir la edición de cada categoría. La pantalla conserva únicamente el título principal «Categorías»; el alta usa un botón en el encabezado en escritorio y un botón flotante **+** en móvil. Se mantiene la posibilidad de archivar, restaurar y eliminar una categoría archivada con reemplazo por otra activa. No existen catálogos de categorías por grupo. Los cambios son visibles para ambos usuarios, sin revelar gastos privados ajenos.

### Cuenta y autenticación

Better Auth gestiona sesiones. El cierre del registro y la restricción a los dos integrantes dependen de `AUTH_REGISTRATION_CLOSED`; verificar la configuración efectiva de cada entorno. Cada usuario ve únicamente los datos autorizados; una sesión inválida no debe conservar datos privados visibles.

## 4. Registro de gastos

Formulario reutilizado en Drawer móvil y Dialog de escritorio. Al crear desde Gastos, el encabezado muestra «Nuevo movimiento» a la izquierda y un selector segmentado Gasto/Ingreso a la derecha, con Gasto seleccionado inicialmente. Gasto conserva importe positivo en ARS, detalle, categoría global activa, fecha y el selector Compartido apagado. Ingreso conserva importe, detalle y fecha; no muestra categoría ni selector compartido. Al editar, el título es «Editar gasto» o «Editar ingreso» y el tipo queda fijo. Al alternar durante el alta se limpian categoría y grupo, conservando importe, detalle y fecha. El detalle usa el placeholder «Ingresá un detalle». El importe agrupa los miles con puntos mientras se escribe, acepta coma o punto para ingresar hasta dos decimales y muestra dos cifras decimales si se ingresan centavos (por ejemplo, `500000` → `500.000` y `1020.8` → `1.020,80`). Desde Casa, Compartido inicia activado y no se muestra el selector de tipo ni se ofrecen ingresos. No hay selector de hogar, grupo ni participantes. Al crear, editar o eliminar un movimiento y confirmar el servidor la operación, se muestra un toast de éxito temporal.

Los ingresos se guardan en una entidad independiente con titular, importe en centavos, detalle y fecha. Son visibles solo para su titular. El saldo personal mensual suma los ingresos y resta los gastos del historial personal de ese mes; el total gastado conserva solo gastos. Los ingresos no afectan balances, deudas, repartos ni listados de Casa.

Los reembolsos se registran en centavos y con fecha no futura; no son gastos ni ingresos personales. No se permite ingresar ni editar notas y no se prevé solicitarlas en este flujo. La columna `note` puede conservarse por compatibilidad con datos históricos. Una versión anterior proponía una nota opcional; esa propuesta quedó descartada. Para corregirlos se anulan y se registran de nuevo. La dirección se deriva de la deuda vigente.

Los gastos compartidos se reparten 50/50 entre los dos integrantes. Cuando el importe en centavos es impar, el centavo adicional corresponde al pagador. El pagador es el autor del gasto. Otros integrantes pueden consultar un gasto compartido en solo lectura, nunca editarlo o borrarlo.

## 5. Clasificación automática Jev

Se mantiene la sugerencia de categorías con Jev mediante la API HTTP directa de TypeSafe AI. Solo se solicitan sugerencias para gastos nuevos; Ingreso no ejecuta Jev. La selección manual tiene prioridad, la sugerencia no impide guardar el gasto y el catálogo global permanece como fuente de categorías elegibles. No se envían historiales de gastos, balances ni datos de la otra persona para clasificar.

## 6. PWA

- Nombre de instalación **Casa**.
- Manifest de App Router, íconos definitivos Android (estándar y maskable), ícono Apple y favicon.
- Apertura `standalone` y ajustes de áreas seguras para móvil.
- Instalación desde Chrome/Safari de iPhone confirmada por el usuario como correcta.
- Sin service worker, notificaciones push, persistencia offline ni sincronización en segundo plano.

## 7. Rendimiento y caché

TanStack Query v5 mantiene consultas privadas en memoria por usuario; Gastos también se segmenta por mes. Los datos permanecen frescos cinco minutos y la caché inactiva se conserva hasta treinta. Los gastos se actualizan de inmediato en las vistas personales y de Casa, y se revalidan las claves afectadas tras la respuesta del servidor. Las operaciones sobre el mismo gasto se ordenan; un error revierte solo ese cambio. El balance acumulado de Casa, calculado por el servidor, se identifica como pendiente de sincronización hasta recibir una lectura confirmada. Casa también se consulta en segundo plano al entrar para detectar cambios de la otra persona. No hay sincronización en tiempo real. Las respuestas HTTP privadas son `private, no-store`.

## 8. Estado y pendientes

El código contiene ingresos personales, reembolsos, caché de navegación, actualizaciones optimistas de gastos y las migraciones correspondientes. Su presencia no demuestra que estén desplegados o aplicados en una base concreta. Sigue pendiente verificar el estado real de cada entorno. Los informes de validación anteriores describen ejecuciones históricas, no resultados de esta auditoría; los comandos reproducibles figuran en el [README](../README.md).

## 9. Convenciones de trabajo

Mantener la documentación y las pruebas junto al código, usar commits Conventional Commits en inglés y no subir secretos. El historial de transición y sus operaciones sensibles está en [Activación de Casa](../HOUSEHOLD_TRANSITION.md).

**Principio rector:** un único Casa para dos, gastos privados o compartidos, categorías globales intactas, reparto 50/50 y navegación rápida.
