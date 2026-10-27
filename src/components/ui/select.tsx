"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  color?: string;
};

type SelectFieldProps = {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
};

export function SelectField({
  id,
  value,
  options,
  onValueChange,
  placeholder,
  required = false,
  disabled = false,
  invalid = false,
  describedBy,
  className,
}: SelectFieldProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <SelectPrimitive.Root
      value={value || null}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
      required={required}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 text-left text-base outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOption?.color && (
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-full border border-foreground/15"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <SelectPrimitive.Value placeholder={placeholder}>
            {selectedOption?.label}
          </SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown aria-hidden="true" size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          sideOffset={6}
          align="start"
          alignItemWithTrigger={false}
          className="z-[80] outline-none"
        >
          <SelectPrimitive.Popup className="max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
            <SelectPrimitive.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  {option.color && (
                    <span
                      aria-hidden="true"
                      className="size-3.5 shrink-0 rounded-full border border-foreground/15"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="ml-auto shrink-0">
                    <Check aria-hidden="true" size={16} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
