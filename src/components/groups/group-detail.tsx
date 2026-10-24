"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Copy, Link2, Tags, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSharedSpaceInvitationAction } from "@/app/(app)/groups/actions";
import { callServerAction } from "@/lib/action-result";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";

export function GroupDetail({
  space,
  displayName,
}: {
  space: SharedSpaceOverview;
  displayName: string;
}) {
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  function createInvitation() {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await callServerAction(() =>
        createSharedSpaceInvitationAction(space.id),
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCode(result.data.code);
      setExpiresAt(result.data.expiresAt);
    });
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Código copiado. Compartilo con quienes quieras sumar a este grupo.");
    } catch {
      setFeedback("Seleccioná el código y copialo para compartirlo.");
    }
  }

  return (
    <>
      <header className="space-y-2">
        <h1 className="break-words text-3xl font-semibold tracking-tight">
          {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {space.members.length} {space.members.length === 1 ? "integrante" : "integrantes"}
        </p>
      </header>

      <Link
        href={`/groups/${space.id}/categories`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Tags size={19} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block font-medium">Categorías</span>
            <span className="block text-sm text-muted-foreground">
              Administrar el catálogo de {displayName}
            </span>
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </Link>

      <section aria-labelledby="group-members-heading" className="space-y-4">
        <h2 id="group-members-heading" className="flex items-center gap-2 text-lg font-semibold">
          <UsersRound size={19} aria-hidden="true" />
          Integrantes
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
          {space.members.map((member) => (
            <li key={member.userId} className="py-3 text-sm first:pt-4 last:pb-4">
              {member.name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="group-invitation-heading" className="space-y-4">
        <div>
          <h2 id="group-invitation-heading" className="text-lg font-semibold">
            Invitaciones
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cada código se usa una vez y vence en siete días. Generá uno nuevo para cada persona.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          onClick={createInvitation}
          disabled={isPending}
        >
          <Link2 aria-hidden="true" />
          {isPending ? "Preparando…" : code ? "Generar otro código" : "Generar invitación"}
        </Button>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {feedback && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
            {feedback}
          </p>
        )}
        {code && (
          <div className="max-w-xl space-y-2 rounded-2xl border border-border bg-card p-4">
            <Label htmlFor="group-invitation-value">Código de un solo uso</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="group-invitation-value"
                value={code}
                readOnly
                className="min-h-11 rounded-xl px-3 font-mono text-sm"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 shrink-0"
                onClick={copyCode}
              >
                <Copy aria-hidden="true" />
                Copiar
              </Button>
            </div>
            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                Vence el {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(expiresAt))}.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
