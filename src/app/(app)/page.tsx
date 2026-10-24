
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-6">
      <section className="max-w-2xl space-y-5">
        <p className="text-sm text-muted-foreground">Hola, {session.user.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Ordená tus categorías antes de empezar a registrar gastos.
        </h1>
        <p className="max-w-xl leading-7 text-muted-foreground">
          Creá categorías personales y, cuando te vincules con otra persona, un
          catálogo compartido. Los gastos todavía no están disponibles.
        </p>
        <Link
          href="/categories"
          className={buttonVariants({ className: "min-h-11" })}
        >
          Administrar categorías
        </Link>
      </section>
    </main>
  );
}
