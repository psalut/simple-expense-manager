# Gestor simple de gastos

App mobile-first para registrar gastos personales, compartir gastos 50/50 en grupos de dos y administrar un catálogo global de categorías.

## Desarrollo local

1. Instalá dependencias con pnpm install.
2. Copiá .env.example a .env.local y completá las credenciales de una base Neon de desarrollo y Better Auth.
3. Aplicá la migración inicial con pnpm db:migrate.
4. Cargá las categorías iniciales opcionales con pnpm db:seed.
5. Ejecutá pnpm dev y abrí [http://localhost:3000](http://localhost:3000).

El seed usa IDs estables y ON CONFLICT DO NOTHING: se puede repetir sin sobreescribir categorías existentes ni cambios del usuario. Las categorías son editables desde la app.

Las sugerencias Jev son opcionales. Para habilitarlas, configurá `TYPESAFE_API_KEY` en el entorno de servidor. Sin esa clave, o ante errores del servicio, la app deja elegir la categoría manualmente. El umbral conservador por defecto es 0.8; se puede ajustar entre 0.5 y 1 con `CATEGORY_SUGGESTION_MIN_PROBABILITY`.

## Comandos

- pnpm db:generate: genera una migración desde el esquema Drizzle actual.
- pnpm db:migrate: aplica las migraciones al DATABASE_URL configurado; verificá que sea un entorno de desarrollo antes de ejecutarlo.
- pnpm db:seed: carga categorías globales iniciales de forma idempotente.
- pnpm lint: ejecuta ESLint.
- pnpm exec tsc --noEmit: comprueba tipos.
- pnpm test: ejecuta Vitest.
- pnpm exec next build --webpack: compila usando Webpack.
