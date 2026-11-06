import { amountInputToCents, isValidIsoDate } from "@/lib/expenses/policy";

export function validatePayment(input: unknown, today: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const amountCents = amountInputToCents(value.amount);
  const date = typeof value.date === "string" ? value.date : "";
  const key = typeof value.key === "string" ? value.key : "";
  const expectedPayer = typeof value.expectedPayer === "string" ? value.expectedPayer : "";
  if (!amountCents || !isValidIsoDate(date) || date > today || !/^[a-zA-Z0-9-]{16,100}$/.test(key) || !expectedPayer || expectedPayer.length > 100) return null;
  return { amountCents, date, key, expectedPayer };
}
