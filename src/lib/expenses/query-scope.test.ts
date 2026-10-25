import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  groupExpenseScope,
  ownedExpenseScope,
  personalExpenseScope,
} from "./query-scope";

const dialect = new PgDialect();

describe("expense database query scopes", () => {
  it("filters the personal history in SQL by author and month", () => {
    const query = dialect.sqlToQuery(personalExpenseScope("user-a", "2026-10-01", "2026-11-01")!);
    expect(query.sql).toContain('"expenses"."user_id" = $1');
    expect(query.sql).toContain('"expenses"."expense_date" >= $2');
    expect(query.sql).toContain('"expenses"."expense_date" < $3');
    expect(query.params).toEqual(["user-a", "2026-10-01", "2026-11-01"]);
  });

  it("filters group history by the exact group and includes every author", () => {
    const query = dialect.sqlToQuery(groupExpenseScope("space-casa"));
    expect(query.sql).toContain('"expenses"."shared_space_id" = $1');
    expect(query.params).toEqual(["space-casa"]);
    expect(query.sql).not.toContain('"expenses"."user_id"');
  });

  it("requires both expense ID and authenticated owner for mutations", () => {
    const query = dialect.sqlToQuery(ownedExpenseScope("expense-1", "user-a")!);
    expect(query.sql).toContain('"expenses"."id" = $1');
    expect(query.sql).toContain('"expenses"."user_id" = $2');
    expect(query.params).toEqual(["expense-1", "user-a"]);
  });
});
