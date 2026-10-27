"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, ReceiptText, Tags } from "lucide-react";

const destinations = [
  { href: "/", label: "Gastos", Icon: ReceiptText },
  { href: "/household", label: "Casa", Icon: Heart },
  { href: "/categories", label: "Categorías", Icon: Tags },
] as const;

export function AppNavigation({
  mode,
}: {
  mode: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (mode === "desktop") return;

    const isTextEntry = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      target.matches(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea',
      );

    const syncKeyboardState = () => {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const viewportShrunk =
        window.visualViewport !== null &&
        window.visualViewport !== undefined &&
        window.innerHeight - window.visualViewport.height > 120;

      setKeyboardOpen(
        isMobile && (isTextEntry(document.activeElement) || viewportShrunk),
      );
    };

    const handleFocusOut = () => window.setTimeout(syncKeyboardState, 0);
    const viewport = window.visualViewport;

    document.addEventListener("focusin", syncKeyboardState);
    document.addEventListener("focusout", handleFocusOut);
    window.addEventListener("resize", syncKeyboardState);
    viewport?.addEventListener("resize", syncKeyboardState);

    return () => {
      document.removeEventListener("focusin", syncKeyboardState);
      document.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("resize", syncKeyboardState);
      viewport?.removeEventListener("resize", syncKeyboardState);
    };
  }, [mode]);

  return (
    <>
      {mode === "desktop" && (
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-1 md:flex"
        >
          {destinations.map(({ href, label }) => {
            const active = isDestinationActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {mode === "mobile" && !keyboardOpen && (
        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="mx-auto flex min-h-16 max-w-lg items-stretch px-2">
            {destinations.map(({ href, label, Icon }) => {
              const active = isDestinationActive(pathname, href);

              return (
                <li key={href} className="flex min-w-0 flex-1">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className="flex min-h-16 w-full flex-col items-center justify-center gap-1 border-t-2 border-transparent px-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:border-primary aria-[current=page]:bg-muted/60 aria-[current=page]:text-foreground"
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span className="max-w-full truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

function isDestinationActive(pathname: string | null, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname?.startsWith(`${href}/`) === true;
}
