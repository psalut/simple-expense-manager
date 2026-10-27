import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, vi } from "vitest";
import * as schema from "@/db/schema";

if (process.env.RUN_DB_INTEGRATION !== "true" || !process.env.DATABASE_URL) {
  throw new Error("DB tests require explicit RUN_DB_INTEGRATION=true and DATABASE_URL. Each file uses a disposable isolated schema.");
}

export const integrationSchema = "test_household_" + randomUUID().replaceAll("-", "");
const admin = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
// Transaction poolers do not preserve session settings. Tests use direct connections.
const directUrl = new URL(process.env.DATABASE_URL);
directUrl.hostname = directUrl.hostname.replace("-pooler", "");
export const integrationSql = postgres(directUrl.toString(), {
  prepare: false, max: 6, connection: { options: "-c search_path=" + integrationSchema }, onnotice: () => {},
});
export const integrationDb = drizzle({ client: integrationSql, schema });

await admin`CREATE SCHEMA ${admin(integrationSchema)}`;
try {
  const [identity] = await integrationSql`SELECT current_schema() AS schema`;
  if (identity.schema !== integrationSchema) throw new Error("Refusing to initialize: isolated search_path was not honored");
  const baseline = (await readFile("drizzle/0000_initial_v07.sql", "utf8")).replaceAll('"public"', '"' + integrationSchema + '"');
  for (const statement of baseline.split("--> statement-breakpoint")) {
    if (statement.trim()) await integrationSql.unsafe(statement);
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
