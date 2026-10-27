# Activación de Casa

Las decisiones del pedido de implementación de Casa prevalecen sobre los flujos
multigrupo de la documentación v0.7. Los dos documentos de `docs/` se conservan
sin reescribir, según lo solicitado. Categorías y Jev no cambian.

## Configuración de servidor

- `HOUSEHOLD_SPACE_ID`: opcional cuando hay exactamente un grupo llamado `Casa`.
  Si hay varios grupos, el propietario debe elegir explícitamente cuál conservar
  y configurar su ID aquí. Nunca usar una variable `NEXT_PUBLIC_`.
- `AUTH_REGISTRATION_CLOSED=false`: permite crear la segunda cuenta durante la
  vinculación. Es el valor por defecto, para no bloquear una instalación nueva.
- `AUTH_REGISTRATION_CLOSED=true`: Better Auth deshabilita el registro con
  `emailAndPassword.disableSignUp`; `/register` muestra el registro cerrado.
  Además se rechazan nuevas sesiones y operaciones de sesiones existentes de
  cuentas que no sean los dos integrantes de Casa. No se borran esas cuentas.

Cerrar el registro únicamente después de confirmar la identidad de los dos
integrantes y comprobar que ambos pueden iniciar sesión. El control de acceso
falla cerrado si Casa no puede resolverse o no tiene exactamente dos miembros.
Cuenta mantiene nombre, correo y cierre de sesión; no agrega administración.

En Vercel: configurar `AUTH_REGISTRATION_CLOSED=true` en **Production** y en cada
entorno de preview que use esta base; hacer un nuevo deployment de esta rama
cuando corresponda. La variable local no configura Vercel. Verificar con ambas
cuentas, intentar un alta nueva y comprobar que una tercera cuenta no puede
entrar. Las páginas de acceso se generan con la configuración del despliegue.

## Estado anterior al reset total

El inventario de solo lectura encontró cinco grupos, diez membresías, seis gastos
compartidos y cuatro cuentas. Había un único candidato Casa con dos integrantes.
El usuario autorizó eliminar los datos mock durante esta tarea.

`scripts/household-transition.mjs --delete-legacy-mocks` normalizó el nombre a
`Casa` y eliminó, en una transacción, los otros cuatro grupos y sus cuatro gastos
compartidos. Se conservaron las cuatro cuentas, los cuatro gastos privados,
Casa y sus dos gastos compartidos. Categorías no recibió escrituras.
Ambos miembros tenían credenciales y sesiones activas. Se activó
`AUTH_REGISTRATION_CLOSED=true` en `.env.local`, que no forma parte de Git.

`node scripts/household-transition.mjs` ejecuta únicamente el inventario/readiness.
La opción de limpieza es destructiva y solo debe usarse con autorización del
propietario para ese conjunto de datos. No usarla con información real.

## Reset total y migraciones — 27 de octubre de 2026

`drizzle/0001_single_household.sql` contiene una comprobación previa, un índice
único sobre la constante `true` (máximo un grupo global incluso con concurrencia)
y la restricción de nombre `Casa`. No modifica gastos, categorías ni cuentas.
Se conserva el trigger del baseline que impide un tercer miembro.

El preflight confirmó que `neondb.public` pertenece al endpoint Neon configurado
por esta app. En la base solo existían los esquemas `public` y `drizzle` de la
aplicación (además de los internos de PostgreSQL); las FK eran internas, no había
vistas, tablas foráneas ni publicaciones dependientes. Se observó una conexión
`postgres.js` inactiva, compatible con la instancia desplegada de la misma app.
Vercel no fue consultado ni modificado y podría compartir esta base.

Con autorización explícita para descartar todos los datos mock, una transacción
eliminó exclusivamente las nueve tablas públicas del baseline, sus seis funciones
de trigger y `drizzle.__drizzle_migrations`. No se eliminaron las bases de datos ni
los esquemas `public`/`drizzle`; tampoco se tocó `postgres` o `template1`. El
historial anterior de cuatro entradas y los datos de usuarios, sesiones, grupos,
invitaciones, gastos y categorías fueron descartados deliberadamente.

Luego `pnpm db:migrate` aplicó una sola vez `0000_initial_v07.sql` y
`0001_single_household.sql`, en ese orden. El ledger quedó con dos entradas; sus
timestamps y hashes coinciden con el journal y los SQL locales. El seed habitual
`pnpm db:seed` cargó ocho categorías. La verificación final encontró cero cuentas,
usuarios, sesiones, grupos, membresías, invitaciones y gastos; no se crearon datos
QA. No volver a ejecutar el reset sin autorización expresa.

Quedaron validados `shared_spaces_single_household_unique`,
`shared_spaces_household_name_check`, `shared_spaces_member_count_check` y el
trigger del límite de dos miembros. La base queda lista para crear Casa al iniciar
la incorporación, pero todavía no hay cuentas ni grupo. Categorías y Jev no fueron
modificados; Vercel no recibió cambios ni deployment.

## Pasos pendientes para incorporar las dos cuentas

1. Antes del registro, abrir `AUTH_REGISTRATION_CLOSED=false` (o quitar la
   variable) en el runtime que se use para la incorporación. En `.env.local` la
   variable sigue actualmente en `true`; Vercel no fue consultado.
2. La primera persona se registra e inicia sesión, abre `/household` y elige
   **Preparar Casa**. Esto crea el grupo Casa con esa persona como primer miembro.
3. Desde Casa, la primera persona genera una invitación y comparte su código. La
   segunda persona se registra, inicia sesión y usa el código en `/household` para
   unirse. No crear cuentas manualmente en SQL.
4. Confirmar que ambas cuentas pueden iniciar sesión y que Casa muestra exactamente
   dos integrantes.
5. Solo después, configurar `AUTH_REGISTRATION_CLOSED=true` en Production y en
   cada Preview de Vercel que comparta esta base, desplegar cuando se autorice y
   comprobar el acceso de ambas cuentas y el rechazo de una tercera.

## Datos históricos en otros entornos

Si otro entorno conserva varios grupos, no se selecciona Casa solo por su nombre.
Se debe configurar la elección privada del propietario. Casa muestra un acceso
expandible al historial de grupos de los que el usuario es miembro. Las rutas
antiguas validan membresía antes de consultar gastos o redirigir; IDs ajenos
devuelven 404. No se ofrecen nuevas invitaciones ni altas de gastos históricos.
El autor puede conservar la asociación de un gasto existente al editarlo, o
desactivar Compartido; no hay reasignación automática. El listado personal
continúa incluyendo todos sus gastos propios.

## Verificaciones reproducibles

```powershell
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
git diff --check
```

Las unitarias no acceden a una DB. Las pruebas de integración se ejecutan aparte:

```powershell
$env:RUN_DB_INTEGRATION='true'
pnpm test:integration
Remove-Item Env:RUN_DB_INTEGRATION
```

Cada archivo crea un esquema `test_household_<aleatorio>`, verifica el aislamiento
antes de inicializarlo y lo elimina al terminar. Usa conexión directa a Neon,
sin pooler, para conservar `search_path`. No usa las categorías, usuarios ni
gastos públicos como fixtures. El nuevo esquema prueba 0001 y el anterior
preserva los nueve casos de autorización, con un grupo legado sintético.
No reemplazan pruebas HTTP de CSRF/origin ni ensayos de teclado/safe-area en
teléfonos físicos.
