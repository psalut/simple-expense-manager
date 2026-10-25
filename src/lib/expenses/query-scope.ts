import { and, eq, gte, lt } from "drizzle-orm";
import { expenses } from "@/db/expenses-schema";

export function personalExpenseScope(
  userId: string,
  monthStart: string,
  nextMonthStart: string,
) {
  return and(
    eq(expenses.userId, userId),
    gte(expenses.expenseDate, monthStart),
    lt(expenses.expenseDate, nextMonthStart),
  );
}

export function groupExpenseScope(sharedSpaceId: string) {
  return eq(expenses.sharedSpaceId, sharedSpaceId);
}

export function ownedExpenseScope(expenseId: string, userId: string) {
  return and(eq(expenses.id, expenseId), eq(expenses.userId, userId));
}
