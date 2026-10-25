import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Definí DATABASE_URL en .env.local para cargar las categorías iniciales.");
}

const categories = [
  ["seed-supermercado", "Supermercado", "Alimentos, bebidas y compras de almacén.", "#2F6F66"],
  ["seed-vivienda", "Vivienda", "Alquiler, expensas, reparaciones y artículos para el hogar.", "#8A5A44"],
  ["seed-servicios", "Servicios", "Electricidad, gas, agua, internet y telefonía.", "#C17A20"],
  ["seed-transporte", "Transporte", "Combustible, transporte público, taxi y mantenimiento.", "#446B9E"],
  ["seed-salud", "Salud", "Medicamentos, consultas, estudios y cuidado personal.", "#A84D62"],
  ["seed-comidas", "Comidas", "Restaurantes, delivery, café y salidas para comer.", "#8B5FA8"],
  ["seed-educacion", "Educación", "Cursos, útiles, libros y gastos de estudio.", "#397D87"],
  ["seed-otros", "Otros", "Gastos que no encajan en las demás categorías.", "#667085"],
];

const client = postgres(connectionString, { prepare: false, max: 1 });
try {
  await client.begin(async (transaction) => {
    for (const [id, name, description, color] of categories) {
      await transaction.unsafe(
        "INSERT INTO categories (id, name, description, color) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [id, name, description, color],
      );
    }
  });
} finally {
  await client.end();
}
