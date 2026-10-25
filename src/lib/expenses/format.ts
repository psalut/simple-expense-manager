export function formatArs(amountCents: string | bigint): string {
  const cents = typeof amountCents === "bigint" ? amountCents : BigInt(amountCents);
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  const whole = (absolute / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "−" : ""}$${whole},${fraction}`;
}

export function currentDateInBuenosAires(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function normalizeExpenseMonth(
  requestedMonth: string | string[] | undefined,
  today = currentDateInBuenosAires(),
): string {
  const month = Array.isArray(requestedMonth) ? requestedMonth[0] : requestedMonth;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return today.slice(0, 7);
  const [year, numericMonth] = month.split("-").map(Number);
  if (year < 1 || numericMonth < 1 || numericMonth > 12) return today.slice(0, 7);
  return month;
}

export function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatExpenseDate(date: string, today: string): string {
  if (date === today) return "Hoy";
  if (date === shiftDate(today, -1)) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return label[0].toUpperCase() + label.slice(1);
}

export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}
