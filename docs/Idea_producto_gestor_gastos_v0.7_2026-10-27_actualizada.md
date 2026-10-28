# Casa — Idea de producto y seguimiento

**Versión documental:** v0.8 (ingresos personales) · **Actualizado:** 27 de octubre de 2026
**Documento complementario:** `Especificacion_tecnica_gestor_gastos_MVP_v0.7_2026-10-27_actualizada.md`

## 1. Estado actual

**Casa** es una aplicación privada y mobile-first para registrar gastos personales y los gastos compartidos de **dos personas**. Ya está desplegada en Vercel, conectada a Neon e instalada y validada como PWA en iPhone. El registro público está cerrado tras crear las dos cuentas.

La refactorización a un único hogar y la implementación PWA fueron confirmadas por el usuario como correctas en producción. La optimización más reciente de navegación con caché fue implementada en la rama `perf/navigation-caching` y probada satisfactoriamente por el usuario **en local**. **No consta todavía commit, merge ni despliegue de esa optimización**; distinguirla de la versión publicada hasta que se integre a `main`.

El registro de ingresos personales está implementado en el árbol de trabajo. Aún no tiene commit, migración aplicada, merge ni despliegue.

## 2. Principios del producto

- **Dos usuarios, un hogar:** existe un único espacio compartido llamado **Casa**, con máximo dos integrantes. No hay administración de múltiples grupos en la experiencia habitual.
- **Una sola carga por gasto:** un gasto se registra una vez, como privado o compartido.
- **Ingresos personales:** cada persona puede registrar ingresos visibles solo para ella; no participan en la distribución de gastos de Casa.
- **Privacidad:** en Gastos cada persona ve los gastos que cargó/pagó; en Casa ambos ven los gastos compartidos, incluidos los que pagó la otra persona.
- **Simplicidad:** reparto automático 50/50, sin liquidaciones, transferencias ni presupuestos.
- **Mobile-first:** tres pestañas, formularios cómodos, navegación inferior y experiencia PWA instalable.
- **Sin offline:** se necesita internet; no se persisten gastos o sesiones en una caché offline.

## 3. Pantallas

### Gastos (`/`)

- Historial personal del usuario del mes elegido: gastos privados, gastos compartidos que pagó e ingresos; cada ingreso se identifica por separado y no tiene categoría.
- Selector de mes y **total gastado mensual centrado inmediatamente debajo** dentro de un badge compacto bordó con texto blanco, mostrando solo el importe. Debajo de la línea inferior de la sección del mes y antes de los movimientos, mostrar el neto personal dentro de un badge color hueso con la etiqueta «Saldo del mes», centrado y con igual espacio vertical hacia arriba y hacia abajo.
- Encabezado compacto; alta de movimiento en el encabezado en escritorio y con un botón flotante **+** en móvil.
- Edición y eliminación únicamente de los movimientos propios.

### Casa (`/household`)

- Acceso directo desde la pestaña **Casa**, con ícono de corazón; no hay listado ni selector de grupos.
- Selector mensual y total de gastos compartidos de ambos integrantes, centrado debajo del mes en el mismo badge que en Gastos; los gastos del mes se agrupan por día y muestran las iniciales de quien pagó cada uno en un badge con color estable por persona.
- Se muestra el saldo personal acumulado del usuario autenticado en una única fila de ancho completo, con estado a favor, deuda o saldo equilibrado (incluido el cero). No incluye título, subtítulo, desglose ni saldo de la otra persona; tampoco muestra una lista de integrantes. El reparto 50/50 se mantiene como regla del dominio.
- El alta usa un botón en el encabezado en escritorio y un botón flotante **+** en móvil, sin un título interno para la lista de gastos compartidos.
- Alta de gasto desde Casa con opción Compartido activada automáticamente.
- Invitación utilizada únicamente para incorporar a la segunda cuenta durante el onboarding.

### Categorías (`/categories`)

**Sin cambios funcionales respecto de la implementación anterior.** Catálogo global editable, con nombre, descripción, color y estado activa/archivada. El listado muestra nombre, color y estado; la descripción se consulta al abrir la edición de cada categoría. La pantalla conserva únicamente el título principal «Categorías»; el alta usa un botón en el encabezado en escritorio y un botón flotante **+** en móvil. Se mantiene la posibilidad de archivar, restaurar y eliminar con reemplazo seguro cuando corresponde. No existen catálogos de categorías por grupo. Los cambios son visibles para ambos usuarios, sin revelar gastos privados ajenos.

### Cuenta y autenticación

Better Auth gestiona sesiones. El registro público está cerrado después de registrar las dos cuentas. Cada usuario ve únicamente los datos autorizados; una sesión inválida no debe conservar datos privados visibles.

## 4. Registro de gastos

Formulario reutilizado en Drawer móvil y Dialog de escritorio. Al crear desde Gastos, el encabezado muestra «Nuevo movimiento» a la izquierda y un selector segmentado Gasto/Ingreso a la derecha, con Gasto seleccionado inicialmente. Gasto conserva importe positivo en ARS, detalle, categoría global activa, fecha y el selector Compartido apagado. Ingreso conserva importe, detalle y fecha; no muestra categoría ni selector compartido. Al editar, el título es «Editar gasto» o «Editar ingreso» y el tipo queda fijo. Al alternar durante el alta se limpian categoría y grupo, conservando importe, detalle y fecha. El detalle usa el placeholder «Ingresá un detalle». El importe agrupa los miles con puntos mientras se escribe, acepta coma o punto para ingresar hasta dos decimales y muestra dos cifras decimales si se ingresan centavos (por ejemplo, `500000` → `500.000` y `1020.8` → `1.020,80`). Desde Casa, Compartido inicia activado y no se muestra el selector de tipo ni se ofrecen ingresos. No hay selector de hogar, grupo ni participantes. Al guardar un movimiento y confirmar el servidor la operación, se muestra un toast de éxito temporal.

Los ingresos se guardan en una entidad independiente con titular, importe en centavos, detalle y fecha. Son visibles solo para su titular. El saldo personal mensual suma los ingresos y resta los gastos del historial personal de ese mes; el total gastado conserva solo gastos. Los ingresos no afectan balances, deudas, repartos ni listados de Casa.

Los gastos compartidos se reparten 50/50 entre los dos integrantes. Cuando el importe en centavos es impar, el centavo adicional corresponde al pagador. El pagador es el autor del gasto. Otros integrantes pueden consultar un gasto compartido en solo lectura, nunca editarlo o borrarlo.

## 5. Clasificación automática Jev

Se mantiene la sugerencia de categorías con Jev mediante la API HTTP directa de TypeSafe AI. Solo se solicitan sugerencias para gastos nuevos; Ingreso no ejecuta Jev. La selección manual tiene prioridad, la sugerencia no impide guardar el gasto y el catálogo global permanece como fuente de categorías elegibles. No se envían historiales de gastos, balances ni datos de la otra persona para clasificar.

## 6. PWA

- Nombre de instalación **Casa**.
- Manifest de App Router, íconos definitivos Android (estándar y maskable), ícono Apple y favicon.
- Apertura `standalone` y ajustes de áreas seguras para móvil.
- Instalación desde Chrome/Safari de iPhone confirmada por el usuario como correcta.
- Sin service worker, notificaciones push, persistencia offline ni sincronización en segundo plano.

## 7. Rendimiento y caché — nueva mejora

Implementada en `perf/navigation-caching` y validada localmente por el usuario:

- TanStack Query v5 guarda datos privados **solo en memoria** por usuario.
- `staleTime`: **5 minutos**; invalidaciones tras crear, editar y eliminar gastos; revalidación de Casa al entrar para detectar cambios hechos desde el otro teléfono.
- Gastos, Casa y Categorías consumen endpoints autenticados; las respuestas HTTP privadas declaran `Cache-Control: private, no-store`.
- Se redujeron lecturas repetidas de sesión/Casa y se unificó la lectura mensual de gastos y su total, conservando operaciones monetarias exactas con `BigInt`.
- La caché se elimina al perder la sesión y no se persiste en disco.
- El usuario confirmó que la navegación optimizada **funcionó excelente** en sus pruebas locales. No constan métricas numéricas reproducibles de antes/después.

**Consistencia esperada:** los cambios propios invalidan la caché de consultas afectadas. Los cambios de la otra persona se comprueban al entrar en Casa; no hay sincronización en tiempo real ni WebSockets.

## 8. Estado de calidad y pendientes

**Verificado en esta iteración de performance:** `pnpm lint`, TypeScript, **53 pruebas**, `git diff --check` y `pnpm build` con Turbopack (compilación exitosa según salida compartida por el usuario). El agente también compiló con webpack; un fallo anterior del worker CSS no se reprodujo al repetir el build local. La prueba de navegación local fue satisfactoria.

**Verificado para ingresos personales en el árbol de trabajo:** 64 pruebas unitarias, lint, TypeScript y compilación webpack pasan. La compilación predeterminada de Turbopack quedó más de dos minutos en `compile` y se interrumpió. La prueba de integración no pudo conectarse al host de Neon por un fallo DNS (`ENOTFOUND`); la migración no fue aplicada.

**Verificaciones anteriores:** refactorización Casa (46 unitarias y 14 de integración en esa etapa), permisos y flujos de gastos, uso de Neon con esquema reiniciado (`0000_initial_v07.sql` + `0001_single_household.sql`), creación de dos cuentas, cierre de registro, despliegue en Vercel e instalación real de la PWA en iPhone.

**Pendientes inmediatos:** revisar el diff de `perf/navigation-caching`, commit Conventional Commit, merge directo a `main`, push y validación de rendimiento en la versión de producción desplegada. Confirmar luego navegación y coherencia del balance entre los dos dispositivos en producción.

**Pendientes no bloqueantes:** mejorar mensajes/reintentos ante pérdida de conexión, afinar Jev según uso real y considerar controles HTTP/CSRF adicionales si se amplía la cobertura de seguridad. Mantener el producto sencillo.

## 9. Convenciones de trabajo

- Ramas por funcionalidad; merges directos a `main`, sin PR.
- Commits Conventional Commits en inglés; para esta mejora: `perf: speed up tab navigation with client caching`.
- Conservar documentación vigente en `docs/` y tests reproducibles; no subir informes temporales de E2E ni secretos.

**Principio rector:** un único Casa para dos, gastos privados o compartidos, categorías globales intactas, reparto 50/50 y navegación rápida.
