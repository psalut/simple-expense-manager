
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setIsLoading(true);
    setError("");

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setError("No se pudo cerrar sesión.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Ocurrió un error al cerrar sesión.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="min-h-11"
        onClick={handleLogout}
        disabled={isLoading}
      >
        {isLoading ? "Cerrando sesión..." : "Cerrar sesión"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
