import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
});

try {
  const result = await sql`SELECT 1 AS ok`;
  console.log("Conexión a Neon exitosa:", result[0].ok);
} finally {
  await sql.end();
}
