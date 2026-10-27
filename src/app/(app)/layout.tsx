
import { auth } from "@/lib/auth";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { AppNavigation } from "@/components/navigation/app-navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-background px-4 py-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        Saltar al contenido
      </a>
      <header className="hidden border-b border-border bg-card md:block">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="font-semibold tracking-tight">
            <span>Simple Expense Manager</span>
          </Link>
          <div className="flex items-center gap-3">
            <AppNavigation mode="desktop" />
            <AccountMenu
              name={session.user.name}
              email={session.user.email}
            />
          </div>
        </div>
      </header>
      <AppNavigation mode="mobile" />
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
