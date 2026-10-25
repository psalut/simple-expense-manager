"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application page error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50dvh] w-full max-w-3xl flex-col items-start justify-center gap-4 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">No pudimos cargar esta pantalla</h1>
      <p className="max-w-lg text-sm leading-6 text-muted-foreground">
        Revisá tu conexión e intentá de nuevo. Tus gastos no se guardan en este dispositivo.
      </p>
      <Button type="button" className="min-h-11" onClick={() => reset()}>Reintentar</Button>
    </main>
  );
}
