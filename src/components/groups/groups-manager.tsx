"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import Link from "next/link";
import { ArrowUpRight, Check, Plus, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/navigation/section-heading";
import { acceptSharedSpaceInvitationAction, createSharedSpaceAction } from "@/app/(app)/groups/actions";
import { callServerAction } from "@/lib/action-result";
import { getSharedSpaceDisplayName } from "@/lib/shared-spaces/display-name";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";
import type { AuthenticatedUserProfile } from "@/lib/server/authenticated-user";

type DialogMode = "create" | "join" | null;

export function GroupsManager({
  spaces,
  account,
}: {
  spaces: SharedSpaceOverview[];
  account: Pick<AuthenticatedUserProfile, "name" | "email">;
}) {
  const isMobile = useMobileViewport();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);

  function openDialog(mode: Exclude<DialogMode, null>) {
    setError("");
    setFeedback("");
    setDialogMode(mode);
  }

  function createSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = event.currentTarget;
    const name = new FormData(form).get("name");
    setError("");
    setFeedback("");

    startTransition(async () => {
      try {
        const result = await callServerAction(() => createSharedSpaceAction(name));
        if (!result.success) {
          setError(result.error);
          return;
        }
        form.reset();
        setDialogMode(null);
        setFeedback("El grupo quedó creado. Ya podés invitar a sus integrantes.");
      } finally {
        submitting.current = false;
      }
    });
  }

  function joinSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = event.currentTarget;
    const code = new FormData(form).get("code");
    setError("");
    setFeedback("");

    startTransition(async () => {
      try {
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
      } finally {
        submitting.current = false;
      }
    });
  }

  const dialogTitle =
    dialogMode === "create" ? "Crear un grupo" : "Unirse a un grupo";
  const dialogDescription =
    dialogMode === "create"
      ? "Después vas a poder invitar a otra persona."
      : "Pegá el código de invitación que te compartieron.";
  const dialogForm =
    dialogMode === "create" ? (
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
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setDialogMode(null)}
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
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setDialogMode(null)}
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
    );

  return (
    <>
      <SectionHeading
        title="Grupos"
        account={account}
      />

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="my-groups-heading" className="text-xl font-semibold">
            Mis grupos <span className="font-normal text-muted-foreground">· {spaces.length}</span>
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => openDialog("create")}
            >
              <Plus aria-hidden="true" />
              Crear
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => openDialog("join")}
            >
              <UsersRound aria-hidden="true" />
              Unirse
            </Button>
          </div>
        </div>
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

      {isMobile ? (
        <Drawer.Root
          open={dialogMode !== null}
          onOpenChange={(open) => {
            if (!open && !isPending) setDialogMode(null);
          }}
        >
          <Drawer.Portal>
            <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40" />
            <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
              <Drawer.Popup className="w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl outline-none">
                <Drawer.Content className="mx-auto max-h-[min(85dvh,36rem)] overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                  <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Drawer.Title className="text-xl font-semibold">{dialogTitle}</Drawer.Title>
                      <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                        {dialogDescription}
                      </Drawer.Description>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label="Cerrar"
                      onClick={() => setDialogMode(null)}
                      disabled={isPending}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  {dialogForm}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <Dialog.Root
          open={dialogMode !== null}
          onOpenChange={(open) => {
            if (!open && !isPending) setDialogMode(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
            <Dialog.Popup className="fixed left-1/2 top-1/2 z-[51] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-xl font-semibold">{dialogTitle}</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    {dialogDescription}
                  </Dialog.Description>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="Cerrar"
                  onClick={() => setDialogMode(null)}
                  disabled={isPending}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              {dialogForm}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}
