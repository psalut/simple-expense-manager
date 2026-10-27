import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10 });
const cleanup = process.argv.includes("--delete-legacy-mocks");

try {
  const result = await sql.begin(cleanup ? "read write" : "read only", async (tx) => {
    if (cleanup) {
      // Maintenance operation: exclude inserts/updates until all checks and deletions commit.
      await tx`LOCK TABLE shared_spaces, shared_space_members, shared_space_invitations, expenses IN EXCLUSIVE MODE`;
    }
    const spaces = await tx`SELECT id, name FROM shared_spaces`;
    const candidates = spaces.filter((space) => space.name.trim().toLowerCase() === "casa");
    const [counts] = await tx`SELECT
      (SELECT count(*)::int FROM shared_spaces) AS groups,
      (SELECT count(*)::int FROM shared_space_members) AS memberships,
      (SELECT count(*)::int FROM expenses WHERE shared_space_id IS NOT NULL) AS shared_expenses,
      (SELECT count(*)::int FROM expenses WHERE shared_space_id IS NULL) AS private_expenses,
      (SELECT count(*)::int FROM "user") AS accounts`;
    if (candidates.length !== 1) {
      if (cleanup) throw new Error("Cleanup requires exactly one Casa; no changes made");
      return { counts, ready: false };
    }
    const [readiness] = await tx`SELECT
      count(*)::int AS members,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM account a WHERE a.user_id=m.user_id AND a.provider_id='credential' AND a.password IS NOT NULL))::int AS accounts_with_credentials,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM session s WHERE s.user_id=m.user_id AND s.expires_at > now()))::int AS accounts_with_active_session
      FROM shared_space_members m WHERE m.shared_space_id=${candidates[0].id}`;
    if (!cleanup) return { counts, readiness, ready: readiness.members === 2 && readiness.accounts_with_credentials === 2 };
    if (readiness.members !== 2 || readiness.accounts_with_credentials !== 2) throw new Error("Casa needs two accounts with credentials; no changes made");
    await tx`UPDATE shared_spaces SET name='Casa' WHERE id=${candidates[0].id}`;
    const deletedExpenses = await tx`DELETE FROM expenses WHERE shared_space_id IS NOT NULL AND shared_space_id <> ${candidates[0].id} RETURNING id`;
    const deletedGroups = await tx`DELETE FROM shared_spaces WHERE id <> ${candidates[0].id} RETURNING id`;
    return { deleted_mock_groups: deletedGroups.length, deleted_mock_shared_expenses: deletedExpenses.length, retained_groups: 1, readiness, private_expenses_preserved: counts.private_expenses, accounts_preserved: counts.accounts, categories_untouched: true };
  });
  console.log(JSON.stringify(result));
} catch (error) {
  // Never print driver errors: they can include connection strings or SQL parameters.
  console.error(error instanceof Error && !('code' in error) ? error.message : "Transition failed; transaction rolled back");
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}
