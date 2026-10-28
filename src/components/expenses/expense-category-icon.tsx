import { ArrowDown } from "lucide-react";

export function ExpenseCategoryIcon({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full"
      style={{
        color,
        backgroundColor: `${color}1A`,
      }}
    >
      <ArrowDown className="size-4" strokeWidth={2.25} />
    </span>
  );
}
