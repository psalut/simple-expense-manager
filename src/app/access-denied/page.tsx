import { LogoutButton } from "@/components/auth/logout-button";

export default function AccessDeniedPage() {
  return <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-4">
    <h1 className="text-2xl font-semibold">Acceso reservado a Casa</h1>
    <p className="text-sm leading-6 text-muted-foreground">Esta cuenta no está vinculada al hogar autorizado. Cerrá sesión para ingresar con una de las dos cuentas de Casa.</p>
    <LogoutButton />
  </main>;
}
