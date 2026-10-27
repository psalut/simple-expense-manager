"use client";

import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { formatDateOnly, parseDateOnly } from "@/lib/expenses/date-only";

type CalendarProps = {
  value: string;
  onChange: (value: string) => void;
  expanded?: boolean;
};

export function Calendar({ value, onChange, expanded = false }: CalendarProps) {
  const selected = value ? parseDateOnly(value) : undefined;

  return (
    <DayPicker
      mode="single"
      required
      selected={selected}
      onSelect={(date) => onChange(date ? formatDateOnly(date) : "")}
      defaultMonth={selected}
      timeZone="America/Argentina/Buenos_Aires"
      noonSafe
      locale={es}
      weekStartsOn={1}
      showOutsideDays
      classNames={{
        root: expanded ? "relative w-full min-w-0 p-0" : "relative w-fit p-3",
        months: "flex w-full flex-col",
        month: "w-full space-y-4",
        month_caption: `relative flex ${expanded ? "h-11" : "h-9"} items-center justify-center`,
        caption_label: `${expanded ? "text-base" : "text-sm"} font-medium capitalize`,
        nav: expanded
          ? "absolute inset-x-0 top-0 z-10 flex h-11 items-center"
          : "flex items-center gap-1",
        button_previous: `absolute ${expanded ? "top-0 " : ""}left-0 z-10 grid ${expanded ? "size-11" : "size-9"} place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30`,
        button_next: `absolute ${expanded ? "top-0 " : ""}right-0 z-10 grid ${expanded ? "size-11" : "size-9"} place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30`,
        month_grid: expanded ? "w-full table-fixed" : "",
        weekdays: "flex w-full",
        weekday: `${expanded ? "min-w-0 flex-1" : "w-9"} text-center text-xs font-medium text-muted-foreground`,
        weeks: `mt-2 flex w-full flex-col ${expanded ? "gap-0" : "gap-1"}`,
        week: "flex w-full",
        day: `${expanded ? "min-w-0 flex-1" : "size-9"} group relative p-0 text-center text-sm`,
        day_button: `mx-auto grid ${expanded ? "size-11" : "size-9"} place-items-center rounded-lg font-normal tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-3 ${expanded ? "focus-visible:ring-ring" : "focus-visible:ring-ring/30"} group-data-[selected=true]:bg-primary group-data-[selected=true]:text-primary-foreground group-data-[selected=true]:hover:bg-primary`,
        selected: "rounded-lg",
        today:
          "relative font-semibold text-primary after:pointer-events-none after:absolute after:inset-0.5 after:rounded-lg after:border-2 after:border-primary after:content-[''] data-[selected=true]:after:border-primary-foreground",
        outside: "text-muted-foreground/45",
        disabled: "text-muted-foreground/40",
        hidden: "invisible",
      }}
    />
  );
}

