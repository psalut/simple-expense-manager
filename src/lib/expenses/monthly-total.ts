export function monthlyTotalCents(
  expenses: readonly { id: string; userId: string; expenseDate: string; amountCents: string | bigint }[],
  userId: string,
  month: string,
): bigint {
  const seen = new Set<string>();
  let total = 0n;
  for (const expense of expenses) {
    if (expense.userId !== userId || expense.expenseDate.slice(0, 7) !== month || seen.has(expense.id)) continue;
    seen.add(expense.id);
    total += BigInt(expense.amountCents);
  }
  return total;
}
