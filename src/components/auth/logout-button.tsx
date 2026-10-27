
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { useAppQueryClient } from "@/components/app-query-provider";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useAppQueryClient();
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

      queryClient?.clear();
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
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
