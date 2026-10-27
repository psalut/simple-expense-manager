"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  onClick: () => void;
};

export function HeaderCreateAction({ label, onClick }: Props) {
  return (
    <div className="hidden md:block">
      <Button type="button" className="min-h-11 gap-2" onClick={onClick}>
        <Plus aria-hidden="true" />
        {label}
      </Button>
    </div>
  );
}

export function FloatingCreateAction({ label, onClick }: Props) {
  return (
    <Button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="fixed bottom-[calc(5.25rem+var(--mobile-nav-safe-padding))] right-4 z-40 size-14 rounded-full shadow-lg md:hidden"
    >
      <Plus size={24} aria-hidden="true" />
    </Button>
  );
}
