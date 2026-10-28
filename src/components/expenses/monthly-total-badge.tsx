import { formatArs } from "@/lib/expenses/format";

export function MonthlyTotalBadge({
  amount,
}: {
  amount: string | bigint;
}) {
  return (
    <p className="mt-1.5">
      <span className="inline-flex max-w-full items-center justify-center rounded-full bg-brand-bordeaux px-2.5 py-0.5 text-sm font-semibold leading-5 text-white tabular-nums [overflow-wrap:anywhere]">
        {formatArs(amount)}
      </span>
    </p>
  );
}
