import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, vi } from "vitest";
import * as schema from "@/db/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.RUN_DB_INTEGRATION !== "true" || !testDatabaseUrl) {
  throw new Error("DB tests require RUN_DB_INTEGRATION=true and an explicit TEST_DATABASE_URL pointing to a disposable local database.");
}
const parsedTestUrl = new URL(testDatabaseUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsedTestUrl.hostname) || !/^\/casa_test(?:_[a-z0-9_]+)?$/.test(parsedTestUrl.pathname)) {
  throw new Error("Refusing integration tests: TEST_DATABASE_URL must point to a local database named casa_test or casa_test_<suffix>.");
}

export const integrationSchema = "test_household_" + randomUUID().replaceAll("-", "");
const admin = postgres(testDatabaseUrl, { prepare: false, max: 1, onnotice: () => {} });
// Transaction poolers do not preserve session settings. Tests use direct connections.
const directUrl = new URL(testDatabaseUrl);
directUrl.hostname = directUrl.hostname.replace("-pooler", "");
export const integrationSql = postgres(directUrl.toString(), {
  prepare: false, max: 6, connection: { options: "-c search_path=" + integrationSchema }, onnotice: () => {},
});
export const integrationDb = drizzle({ client: integrationSql, schema });

await admin`CREATE SCHEMA ${admin(integrationSchema)}`;
try {
  const [identity] = await integrationSql`SELECT current_schema() AS schema`;
  if (identity.schema !== integrationSchema) throw new Error("Refusing to initialize: isolated search_path was not honored");
  for (const migrationPath of ["drizzle/0000_initial_v07.sql", "drizzle/0002_personal_incomes.sql", "drizzle/0003_category_icons.sql", "drizzle/0004_category_description_1000.sql", "drizzle/0005_household_payments.sql"]) {
    const migration = (await readFile(migrationPath, "utf8")).replaceAll('"public"', '"' + integrationSchema + '"');
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await integrationSql.unsafe(statement);
    }
  }
} catch (error) {
  await integrationSql.end();
  await admin`DROP SCHEMA ${admin(integrationSchema)} CASCADE`;
  await admin.end();
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
  const message = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]") : "unknown";
  throw new Error(`Could not initialize isolated integration schema (${code}): ${message}`);
}

// Never mutate or seed the application's public tables.
process.env.AUTH_REGISTRATION_CLOSED = "false";
delete process.env.HOUSEHOLD_SPACE_ID;
vi.mock("@/db", () => ({ db: integrationDb }));
vi.mock("server-only", () => ({}));

afterAll(async () => {
  await integrationSql.end({ timeout: 3 });
  await admin`DROP SCHEMA ${admin(integrationSchema)} CASCADE`;
  await admin.end({ timeout: 3 });
});
