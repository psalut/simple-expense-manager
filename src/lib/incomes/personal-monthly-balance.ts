export function personalMonthlyBalanceCents(
  expenses: readonly { amountCents: string | bigint }[],
  incomes: readonly { amountCents: string | bigint }[],
): bigint {
  const spent = expenses.reduce(
    (total, expense) => total + BigInt(expense.amountCents),
    0n,
  );
  const received = incomes.reduce(
    (total, income) => total + BigInt(income.amountCents),
    0n,
  );
  return received - spent;
}

export function hasPersonalMonthlyIncome(
  incomes: readonly { amountCents: string | bigint }[],
): boolean {
  return incomes.length > 0;
}
