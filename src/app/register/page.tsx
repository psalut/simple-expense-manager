import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { isRegistrationClosed } from "@/lib/server/household";

export default function RegisterPage() {
  if (!isRegistrationClosed()) return <RegisterForm />;
  return <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-4">
    <h1 className="text-2xl font-semibold">Registro cerrado</h1>
    <p className="text-sm leading-6 text-muted-foreground">Casa ya tiene sus dos cuentas. Iniciá sesión con una cuenta autorizada.</p>
    <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/login">Iniciar sesión</Link>
  </main>;
}
