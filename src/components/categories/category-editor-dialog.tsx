"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { createCategoryAction, updateCategoryAction } from "@/app/(app)/categories/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryView } from "@/lib/categories/types";
import { callServerAction } from "@/lib/action-result";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryView | null;
  sharedSpaceId: string | null;
  sharedSpaceName?: string;
  onSaved: (message: string) => void;
};

export function CategoryEditorDialog({
  open,
  onOpenChange,
  category,
  sharedSpaceId,
  sharedSpaceName,
  onSaved,
}: Props) {
  const isMobile = useMobileViewport();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [error, setError] = useState("");
  const [isSaving, startSaveTransition] = useTransition();
  const isSubmitting = useRef(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) return;
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setError("");

    const values = { name, description };
    startSaveTransition(async () => {
      try {
        const result = await callServerAction(() =>
          category
            ? updateCategoryAction(category.id, values, sharedSpaceId)
            : createCategoryAction(values, sharedSpaceId),
        );

        if (!result.success) {
          setError(result.error);
          return;
        }

        onSaved(
          category
            ? "La categoría quedó actualizada."
            : "La categoría quedó guardada.",
        );
        onOpenChange(false);
      } finally {
        isSubmitting.current = false;
      }
    });
  }

  const title = category ? "Editar categoría" : "Nueva categoría";
  const contextDescription = sharedSpaceId
    ? `Se guarda en el catálogo de ${sharedSpaceName ?? "este grupo"}.`
    : "Esta categoría será privada y solo vos podrás administrarla.";

  const form = (
    <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="category-name">Nombre</Label>
        <Input
          id="category-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          autoComplete="off"
          placeholder="Por ejemplo, Supermercado"
          className="min-h-11 rounded-xl px-3"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-description">Descripción</Label>
        <textarea
          id="category-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          maxLength={500}
          rows={3}
          placeholder="Qué gastos incluye y cuáles deberían ir en otra categoría."
          className="min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Definí qué incluye y qué debería ir en otra categoría.
        </p>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => handleOpenChange(false)}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={isSaving}>
          {isSaving ? "Guardando…" : category ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup className="w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl outline-none transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full">
              <Drawer.Content className="mx-auto max-h-[min(92dvh,44rem)] overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Drawer.Title className="text-xl font-semibold">{title}</Drawer.Title>
                    <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                      {contextDescription}
                    </Drawer.Description>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-label="Cerrar formulario"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSaving}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                {form}
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[51] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {contextDescription}
              </Dialog.Description>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Cerrar formulario"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {form}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
