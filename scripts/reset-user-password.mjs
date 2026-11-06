import { config } from "dotenv";
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";
import { createInterface } from "node:readline/promises";

config({ path: ".env.local" });

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this script in an interactive terminal so the password stays hidden.");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function finish(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(buffer) {
      for (const character of buffer.toString("utf8")) {
        if (character === "\u0003") return finish(new Error("Canceled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") {
          value = Array.from(value).slice(0, -1).join("");
        } else if (character >= " ") {
          value += character;
        }
      }
    }

    process.stdin.on("data", onData);
  });
}

const email = argument("--email")?.trim();
const confirmedEmail = argument("--confirm-email")?.trim();
const databaseUrl = process.env.DATABASE_URL;

if (!email || email !== confirmedEmail) {
  console.error("Provide the account email twice with --email and --confirm-email.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Add it to .env.local or the current environment.");
  process.exit(1);
}

const databaseHost = new URL(databaseUrl).hostname;
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);
if (!isLocalDatabase && !process.argv.includes("--allow-remote-database")) {
  console.error("This DATABASE_URL points to a remote database. Add --allow-remote-database only after confirming the target environment.");
  process.exit(1);
}

if (!isLocalDatabase) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = await terminal.question(`Target database host: ${databaseHost}. Type "ALLOW REMOTE" to continue: `);
  terminal.close();
  if (confirmation !== "ALLOW REMOTE") {
    console.error("Canceled; no changes made.");
    process.exit(1);
  }
}

const password = await readHidden("New password (min. 8 characters): ");
if (password.length < 8) {
  console.error("Password must contain at least 8 characters.");
  process.exit(1);
}
const repeatedPassword = await readHidden("Repeat new password: ");
if (password !== repeatedPassword) {
  console.error("Passwords do not match.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
try {
  const passwordHash = await hashPassword(password);
  const updatedEmail = await sql.begin(async (transaction) => {
    const [user] = await transaction`
      SELECT id, email FROM "user"
      WHERE lower(email) = lower(${email})
      FOR UPDATE
    `;
    if (!user) throw new Error("No account was found for that email.");

    const credentials = await transaction`
      SELECT id FROM "account"
      WHERE user_id = ${user.id} AND provider_id = 'credential'
      FOR UPDATE
    `;
    if (credentials.length !== 1) {
      throw new Error("Expected exactly one password credential; no changes made.");
    }

    await transaction`
      UPDATE "account"
      SET password = ${passwordHash}, updated_at = NOW()
      WHERE id = ${credentials[0].id}
    `;
    await transaction`DELETE FROM "session" WHERE user_id = ${user.id}`;
    return user.email;
  });

  console.log(`Password updated for ${updatedEmail}. Existing sessions were revoked.`);
} finally {
  await sql.end();
}
