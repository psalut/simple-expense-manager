"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callServerAction } from "@/lib/action-result";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";
import {
  acceptSharedSpaceInvitationAction,
  createSharedSpaceAction,
  createSharedSpaceInvitationAction,
} from "@/app/(app)/categories/actions";

export function SharedSpacePanel({
  spaces,
}: {
  spaces: SharedSpaceOverview[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function createSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("name");
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await callServerAction(() => createSharedSpaceAction(name));
      if (!result.success) {
        setError(result.error);
        return;
      }
      form.reset();
      setFeedback("El grupo quedó creado. Ya podés invitar a sus integrantes.");
      router.refresh();
    });
  }

  function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const inviteCode = new FormData(form).get("code");
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await callServerAction(() =>
        acceptSharedSpaceInvitationAction(inviteCode),
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      form.reset();
      setCode("");
      setFeedback("Ya formás parte del grupo.");
      router.refresh();
    });
  }

  return (
    <section
      id="shared-space"
      aria-labelledby="shared-space-heading"
      className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-xl bg-secondary p-2 text-secondary-foreground">
          <Users size={20} aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 id="shared-space-heading" className="text-lg font-semibold">
            Grupos compartidos
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Cada grupo tiene su propio catálogo. Compartirlo no muestra los gastos privados de sus integrantes.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
      {feedback && <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300" role="status">{feedback}</p>}

      <div className="mt-5 grid gap-6 border-b border-border pb-6 sm:grid-cols-2">
        <form className="space-y-3" onSubmit={createSpace}>
          <div className="space-y-2">
            <Label htmlFor="shared-space-name">Crear un grupo</Label>
            <Input
              id="shared-space-name"
              name="name"
              maxLength={80}
              required
              placeholder="Por ejemplo, Casa o Viaje"
              className="min-h-11 rounded-xl px-3"
            />
          </div>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={isPending}>
            {isPending ? "Creando…" : "Crear grupo"}
          </Button>
        </form>

        <form className="space-y-3" onSubmit={acceptInvitation}>
          <div className="space-y-2">
            <Label htmlFor="shared-invitation-input">Unirme a otro grupo</Label>
            <Input
              id="shared-invitation-input"
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              maxLength={50}
              required
              placeholder="Pegá el código que recibiste"
              className="min-h-11 rounded-xl px-3"
            />
          </div>
          <Button
            type="submit"
            className="min-h-11 w-full sm:w-auto"
            variant="secondary"
            disabled={isPending}
          >
            <Check aria-hidden="true" />
            {isPending ? "Vinculando…" : "Unirme con código"}
          </Button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        <h3 className="font-medium">Tus grupos · {spaces.length}</h3>
        {spaces.length === 0 ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Todavía no pertenecés a grupos. Creá uno o unite con un código de invitación.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {spaces.map((space, index) => (
              <li key={space.id} className={index === 0 ? "" : "border-t border-border pt-4"}>
                <SharedSpaceCard space={space} displayName={getSpaceDisplayName(space, spaces)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SharedSpaceCard({
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
    <article className="space-y-4">
      <div>
        <h4 className="font-semibold">{displayName}</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          {space.members.length} {space.members.length === 1 ? "integrante" : "integrantes"}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {space.members.map((member) => (
            <li key={member.userId} className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />
              {member.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">
          Cada código se usa una vez y vence en siete días. Podés generar códigos sucesivos para sumar más integrantes.
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          onClick={createInvitation}
          disabled={isPending}
        >
          <Link2 aria-hidden="true" />
          {isPending ? "Preparando…" : code ? "Generar otro código" : "Invitar integrantes"}
        </Button>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {feedback && <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">{feedback}</p>}
        {code && (
          <div className="space-y-2">
            <Label htmlFor={"invite-" + space.id}>Código de un solo uso</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={"invite-" + space.id}
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
      </div>
    </article>
  );
}

function getSpaceDisplayName(space: SharedSpaceOverview, spaces: SharedSpaceOverview[]) {
  const duplicateName = spaces.some((other) => other.id !== space.id && other.name === space.name);
  return duplicateName ? space.name + " · " + space.id.slice(0, 6) : space.name;
}
