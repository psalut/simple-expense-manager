"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { getPersonInitials } from "@/lib/people/initials";

export function AccountMenu({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const initials = getPersonInitials(name, email);
  const normalizedName = name.trim().replace(/\s+/gu, " ").toLocaleLowerCase("es-AR");
  const avatarSrc =
    normalizedName === "antonella vassallo"
      ? "/dog.png"
      : normalizedName === "pablo salut"
        ? "/cat.png"
        : null;
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideInteraction = (event: Event) => {
      const menu = menuRef.current;
      if (
        menu?.open &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      ) {
        menu.open = false;
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (event.key !== "Escape" || !menu?.open) return;

      menu.open = false;
      menu.querySelector("summary")?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("focusin", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("focusin", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details ref={menuRef} className="group relative">
      <summary
        aria-label="Abrir opciones de cuenta"
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <span className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold" aria-hidden="true">
              {initials}
            </span>
          )}
          <UserRound size={16} className="sr-only" aria-hidden="true" />
        </span>
        <span className="hidden max-w-32 truncate sm:inline">Cuenta</span>
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
