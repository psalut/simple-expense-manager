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
  onSaved: (message: string) => void;
};

export function CategoryEditorDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: Props) {
  const isMobile = useMobileViewport();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [color, setColor] = useState(category?.color ?? "#2F6F66");
  const [error, setError] = useState("");
  const [isSaving, startSaveTransition] = useTransition();
  const isSubmitting = useRef(false);
  const pickerColor = /^#[\da-f]{6}$/i.test(color) ? color : "#2F6F66";
  const colorIsInvalid = color.length > 0 && !/^#[\da-f]{6}$/i.test(color);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) return;
    onOpenChange(nextOpen);
  }

  function changeColor(value: string) {
    const nextColor = value.toUpperCase();
    setColor(nextColor);
    if (/^#[\da-f]{6}$/i.test(nextColor)) setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting.current) return;
    if (!/^#[\da-f]{6}$/i.test(color)) {
      setError("Ingresá un color hexadecimal de seis caracteres.");
      return;
    }
    isSubmitting.current = true;
    setError("");

    const values = { name, description, color };
    startSaveTransition(async () => {
      try {
        const result = await callServerAction(() =>
          category
            ? updateCategoryAction(category.id, values)
            : createCategoryAction(values),
        );

        if (!result.success) {
          setError(result.error);
          return;
        }

        onSaved(category ? "La categoría quedó actualizada." : "La categoría quedó guardada.");
        onOpenChange(false);
      } finally {
        isSubmitting.current = false;
      }
    });
  }

  const title = category ? "Editar categoría" : "Nueva categoría";
  const form = (
    <form
      className={
        isMobile
          ? "mt-5 flex min-h-0 flex-1 flex-col"
          : "mt-5 grid gap-4"
      }
      onSubmit={handleSubmit}
    >
      <div
        className={
          isMobile
            ? "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4"
            : "grid gap-4"
        }
      >
      <div className="space-y-2">
        <Label htmlFor="category-name">Nombre</Label>
        <Input
          id="category-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={60}
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
          Esta descripción también ayuda a Jev a sugerir la categoría correcta.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-color">Color de la categoría · HEX</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Elegir color de categoría"
            value={pickerColor}
            onChange={(event) => changeColor(event.target.value)}
            className="size-11 cursor-pointer rounded-xl border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Input
            id="category-color"
            name="color"
            value={color}
            onChange={(event) => changeColor(event.target.value)}
            required
            maxLength={7}
            spellCheck={false}
            autoCapitalize="characters"
            placeholder="#2F6F66"
            aria-invalid={colorIsInvalid || undefined}
            aria-describedby="category-color-help"
            className="min-h-11 max-w-36 rounded-xl px-3 font-mono text-sm"
          />
          <span
            aria-hidden="true"
            className="size-8 shrink-0 rounded-full border border-foreground/15"
            style={{ backgroundColor: pickerColor }}
          />
        </div>
        <p id="category-color-help" className="text-xs text-muted-foreground">
          {colorIsInvalid
            ? "Usá # seguido de seis caracteres hexadecimales."
            : "Elegí una muestra o ingresá el código hexadecimal."}
        </p>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </div>

      <div
        className={
          "flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end " +
          (isMobile
            ? "sticky bottom-0 -mx-5 mt-3 bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_24px_-20px_rgba(0,0,0,0.5)] sm:-mx-6 sm:px-6"
            : "")
        }
      >
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
            <Drawer.Popup className="flex max-h-[min(92dvh,44rem)] w-full max-w-xl flex-col overflow-hidden overscroll-contain rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl outline-none transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full">
              <Drawer.Content className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-5 pt-5 sm:px-6 sm:pt-6">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                <div className="flex shrink-0 items-start justify-between gap-4">
                  <div>
                    <Drawer.Title className="text-xl font-semibold">{title}</Drawer.Title>
                    <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                      Las categorías y sus colores son visibles para todas las cuentas.
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
                Las categorías y sus colores son visibles para todas las cuentas.
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
