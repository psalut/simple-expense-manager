export function parseDateOnly(value: string): Date {
  return new Date(value + "T12:00:00.000Z");
}

export function formatDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}
