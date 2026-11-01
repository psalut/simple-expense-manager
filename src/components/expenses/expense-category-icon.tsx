import { DynamicIcon, type IconName } from "lucide-react/dynamic";

export function ExpenseCategoryIcon({ color, icon }: { color: string; icon?: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full"
      style={{
        color,
        backgroundColor: `${color}1A`,
      }}
    >
      <DynamicIcon name={(icon || "tag") as IconName} className="size-4" strokeWidth={2.25} />
    </span>
  );
}
