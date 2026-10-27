"use client";

import { useState, type Ref } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileOpen?: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
  className?: string;
};

export function DatePicker({
  id,
  value,
  onChange,
  describedBy,
  invalid = false,
  isMobile = false,
  mobileOpen = false,
  onMobileOpen,
  triggerRef,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value ? formatDatePickerLabel(value) : "Elegí una fecha";
  const triggerClassName = cn(
    "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 text-left text-base outline-none transition-[color,box-shadow] hover:bg-muted/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring data-[invalid]:border-destructive data-[invalid]:ring-3 data-[invalid]:ring-destructive md:text-sm",
    className,
  );
  const triggerContent = (
    <>
      <span>{selectedLabel}</span>
      <CalendarDays
        aria-hidden="true"
        size={18}
        className="shrink-0 text-muted-foreground"
      />
    </>
  );

  if (isMobile) {
    return (
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-expanded={mobileOpen}
        aria-controls={mobileOpen ? "mobile-expense-date-selection" : undefined}
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={triggerClassName}
        onClick={onMobileOpen}
      >
        {triggerContent}
      </button>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        ref={triggerRef}
        id={id}
        type="button"
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={triggerClassName}
      >
        {triggerContent}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[80] max-w-[calc(100vw-1.5rem)] outline-none"
        >
          <Popover.Popup className="max-h-[min(26rem,var(--available-height))] overflow-auto overscroll-contain rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg outline-none">
            <Calendar
              value={value}
              onChange={(nextValue) => {
                onChange(nextValue);
                setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function formatDatePickerLabel(value: string): string {
  const parts = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(value + "T12:00:00.000Z"));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
}

