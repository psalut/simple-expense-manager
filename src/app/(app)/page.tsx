
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          ¡Hola, {session.user.name}!
        </h1>
        <p className="text-muted-foreground">
          Tu gestor de gastos está en construcción.
        </p>
      </div>

      <LogoutButton />
    </main>
  );
}
