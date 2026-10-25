"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Plus, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptSharedSpaceInvitationAction, createSharedSpaceAction } from "@/app/(app)/groups/actions";
import { callServerAction } from "@/lib/action-result";
import { getSharedSpaceDisplayName } from "@/lib/shared-spaces/display-name";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";

type DialogMode = "create" | "join" | null;

export function GroupsManager({
  spaces,
}: {
  spaces: SharedSpaceOverview[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (dialogMode && !dialog.open) dialog.showModal();
    if (!dialogMode && dialog.open) dialog.close();
  }, [dialogMode]);

  function openDialog(mode: Exclude<DialogMode, null>) {
    setError("");
    setFeedback("");
    setDialogMode(mode);
  }

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
      setDialogMode(null);
      setFeedback("El grupo quedó creado. Ya podés invitar a sus integrantes.");
    });
  }

  function joinSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = new FormData(form).get("code");
    setError("");
    setFeedback("");

    startTransition(async () => {
      const result = await callServerAction(() =>
        acceptSharedSpaceInvitationAction(code),
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      form.reset();
      setDialogMode(null);
      setFeedback("Ya formás parte del grupo.");
    });
  }

  return (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Grupos</h1>
          <p className="text-sm text-muted-foreground">
            Cada grupo admite como máximo dos integrantes. Podés participar en varios.
          </p>
        </div>
        <div className="grid gap-2 sm:flex">
          <Button
            type="button"
            className="min-h-11 w-full gap-2 sm:w-auto"
            onClick={() => openDialog("create")}
          >
            <Plus aria-hidden="true" />
            Crear grupo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full gap-2 sm:w-auto"
            onClick={() => openDialog("join")}
          >
            <UsersRound aria-hidden="true" />
            Unirse a un grupo
          </Button>
        </div>
      </header>

      {feedback && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {feedback}
        </p>
      )}
      {error && !dialogMode && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="my-groups-heading" className="space-y-4">
        <h2 id="my-groups-heading" className="text-xl font-semibold">
          Mis grupos <span className="font-normal text-muted-foreground">· {spaces.length}</span>
        </h2>
        {spaces.length === 0 ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Todavía no tenés grupos. Creá uno o unite con un código de invitación.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {spaces.map((space) => (
              <li key={space.id}>
                <Link
                  href={`/groups/${space.id}`}
                  className="group block h-full rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">
                        {getSharedSpaceDisplayName(space, spaces)}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {space.members.length} de 2 integrantes
                      </p>
                    </div>
                    <ArrowUpRight
                      size={18}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </div>
                  <span className="sr-only">Ver detalle de {space.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby="group-action-title"
        onClose={() => setDialogMode(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/40 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="group-action-title" className="text-xl font-semibold">
                {dialogMode === "create" ? "Crear un grupo" : "Unirse a un grupo"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dialogMode === "create"
                  ? "Después vas a poder invitar a otras personas."
                  : "Pegá el código de invitación que te compartieron."}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Cerrar"
              onClick={() => dialogRef.current?.close()}
              disabled={isPending}
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          {dialogMode === "create" ? (
            <form className="mt-5 space-y-4" onSubmit={createSpace}>
              <div className="space-y-2">
                <Label htmlFor="new-group-name">Nombre del grupo</Label>
                <Input
                  id="new-group-name"
                  name="name"
                  maxLength={80}
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="Por ejemplo, Casa o Viaje"
                  className="min-h-11 rounded-xl px-3"
                />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => dialogRef.current?.close()}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="min-h-11" disabled={isPending}>
                  {isPending ? "Creando…" : "Crear grupo"}
                </Button>
              </div>
            </form>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={joinSpace}>
              <div className="space-y-2">
                <Label htmlFor="group-invitation-code">Código de invitación</Label>
                <Input
                  id="group-invitation-code"
                  name="code"
                  autoFocus
                  autoComplete="off"
                  maxLength={50}
                  required
                  placeholder="Pegá el código"
                  className="min-h-11 rounded-xl px-3 font-mono text-sm"
                />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => dialogRef.current?.close()}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="min-h-11" disabled={isPending}>
                  <Check aria-hidden="true" />
                  {isPending ? "Vinculando…" : "Unirme al grupo"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
