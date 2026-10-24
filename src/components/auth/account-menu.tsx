"use client";

import { UserRound } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

export function AccountMenu({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const initial = name.trim().slice(0, 1).toLocaleUpperCase("es-AR") || "U";

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <span className="text-sm font-semibold" aria-hidden="true">
            {initial}
          </span>
          <UserRound size={16} className="sr-only" aria-hidden="true" />
        </span>
        <span className="hidden max-w-32 truncate sm:inline">Cuenta</span>
        <span className="sr-only">Abrir opciones de cuenta</span>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
        <div className="mb-4 min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <LogoutButton />
      </div>
    </details>
  );
}
