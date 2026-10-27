"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Drawer } from "@base-ui/react/drawer";
import { Menu } from "@base-ui/react/menu";
import {
  Archive,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  archiveCategoryAction,
  deleteArchivedCategoryAction,
  restoreArchivedCategoryAction,
} from "@/app/(app)/categories/actions";
import { useAppUser } from "@/components/app-query-provider";
import { StaleDataNotice } from "@/components/app-data/query-feedback";
import { CategoryEditorDialog } from "@/components/categories/category-editor-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import type { CategoryView } from "@/lib/categories/types";
import { callServerAction } from "@/lib/action-result";
import { useArchivedCategoriesData } from "@/lib/app-data/client";
import { invalidateAllPrivateAppData } from "@/lib/app-data/query-keys";

type Props = {
  title: string;
  description?: string;
  categories: CategoryView[];
  replacementCategories: CategoryView[];
};

type Confirmation = {
  action: "archive" | "delete";
  category: CategoryView;
};

export function CategoryCatalog({
  title,
  description,
  categories,
  replacementCategories,
}: Props) {
  const user = useAppUser();
  const queryClient = useQueryClient();
  const isMobile = useMobileViewport();
  const [editor, setEditor] = useState<{
    category: CategoryView | null;
    instance: number;
  } | null>(null);
  const editorInstance = useRef(0);
  const [archivesOpen, setArchivesOpen] = useState(false);
  const archivedQuery = useArchivedCategoriesData(archivesOpen);
  const archived = archivedQuery.data ?? null;
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isMutating, startMutation] = useTransition();
  const isMutatingRef = useRef(false);

  function openEditor(category: CategoryView | null) {
    setError("");
    setFeedback("");
    editorInstance.current += 1;
    setEditor({ category, instance: editorInstance.current });
  }

  function toggleArchives() {
    setError("");
    setArchivesOpen((open) => !open);
  }

  function requestConfirmation(action: Confirmation["action"], category: CategoryView) {
    setConfirmationError("");
    setReplacementCategoryId("");
    setConfirmation({ action, category });
  }

  function confirmAction() {
    if (!confirmation || isMutatingRef.current) return;
    isMutatingRef.current = true;
    setConfirmationError("");
    const current = confirmation;

    startMutation(async () => {
      try {
        const result = await callServerAction(() =>
          current.action === "archive"
            ? archiveCategoryAction(current.category.id)
            : deleteArchivedCategoryAction(
                current.category.id,
                replacementCategoryId,
              ),
        );

        if (!result.success) {
          setConfirmationError(result.error);
          return;
        }

        if (current.action === "archive") {
          setFeedback("La categoría quedó archivada.");
        } else {
          setFeedback(`Se eliminó “${current.category.name}” definitivamente.`);
        }
        void invalidateAllPrivateAppData(queryClient, user.id);
        setConfirmation(null);
      } finally {
        isMutatingRef.current = false;
      }
    });
  }

  function restoreCategory(category: CategoryView) {
    if (isMutatingRef.current) return;
    isMutatingRef.current = true;
    setError("");
    setFeedback("");

    startMutation(async () => {
      try {
        const result = await callServerAction(() =>
          restoreArchivedCategoryAction(category.id),
        );
        if (!result.success) {
          setError(result.error);
          return;
        }

        setFeedback(`Se restauró “${category.name}”.`);
        void invalidateAllPrivateAppData(queryClient, user.id);
      } finally {
        isMutatingRef.current = false;
      }
    });
  }

  const archivedCount = archived?.length;
  const confirmationTitle =
    confirmation?.action === "archive"
      ? "¿Archivar categoría?"
      : confirmation
        ? "¿Eliminar categoría?"
        : "Confirmación de categoría";
  const confirmationDescription = confirmation
    ? confirmation.action === "archive"
      ? "“" +
        confirmation.category.name +
        "” dejará de estar disponible para nuevas asignaciones y se conservará para el historial."
      : "“" +
        confirmation.category.name +
        "” se eliminará. Si hay gastos asociados, se reasignarán a la categoría que elijas; sus importes y partes no cambian."
    : "";
  const confirmationBody = (
    <>
      {confirmation?.action === "delete" && (
        <div className="space-y-2">
          <Label htmlFor="category-replacement">Categoría activa de reemplazo</Label>
          <SelectField
            id="category-replacement"
            value={replacementCategoryId}
            onValueChange={setReplacementCategoryId}
            options={replacementCategories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            placeholder="Elegí una categoría"
            required
          />
          <p className="text-xs leading-5 text-muted-foreground">
            La reasignación y el borrado se guardan juntos. No se muestran datos del historial de gastos.
          </p>
          {replacementCategories.length === 0 && (
            <p className="text-sm text-destructive" role="status">
              No hay categorías activas elegibles. Creá o restaurá una categoría antes de eliminar esta.
            </p>
          )}
        </div>
      )}
      {confirmationError && (
        <p className="text-sm text-destructive" role="alert">{confirmationError}</p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setConfirmation(null)}
          disabled={isMutating}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          onClick={confirmAction}
          disabled={
            isMutating ||
            (confirmation?.action === "delete" &&
              (!replacementCategoryId || replacementCategories.length === 0))
          }
        >
          {isMutating
            ? confirmation?.action === "archive"
              ? "Archivando…"
              : "Eliminando…"
            : confirmation?.action === "archive"
              ? "Archivar"
              : "Eliminar definitivamente"}
        </Button>
      </div>
    </>
  );

  return (
    <section aria-labelledby="category-catalog-title" className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="category-catalog-title" className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        <Button
          type="button"
          className="min-h-11 shrink-0 gap-2"
          onClick={() => openEditor(null)}
        >
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">Nueva categoría</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </header>

      {feedback && <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">{feedback}</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {categories.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {categories.map((category) => (
            <li key={category.id}>
              <CategoryCard
                category={category}
                disabled={isMutating}
                onEdit={() => openEditor(category)}
                onArchive={() => requestConfirmation("archive", category)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          El catálogo todavía está vacío. Creá la primera categoría para empezar.
        </p>
      )}

      <div className="border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 gap-2 px-2"
          onClick={toggleArchives}
          disabled={archivedQuery.isFetching && !archived}
          aria-expanded={archivesOpen}
        >
          <Archive aria-hidden="true" />
          {archivedQuery.isFetching && !archived
            ? "Cargando archivadas…"
            : archivesOpen
              ? "Ocultar categorías archivadas"
              : "Ver categorías archivadas"}
          {archivedCount !== undefined && (
            <span className="text-muted-foreground">
              ({archivedCount} {archivedCount === 1 ? "categoría" : "categorías"})
            </span>
          )}
        </Button>

        {archivesOpen && archivedQuery.isError && !archived && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            No se pudieron cargar las categorías archivadas. Intentá cerrar y abrir esta sección.
          </p>
        )}
        {archivesOpen && archivedQuery.isError && archived && <StaleDataNotice />}

        {archivesOpen && archived !== null && (
          <section
            className="mt-3 space-y-2"
            role="region"
            aria-label="Categorías archivadas"
          >
            {archived.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted-foreground">
                No hay categorías archivadas.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {archived.map((category) => (
                  <li key={category.id}>
                    <CategoryCard
                      category={category}
                      disabled={isMutating}
                      onRestore={() => restoreCategory(category)}
                      onDelete={() => requestConfirmation("delete", category)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <CategoryEditorDialog
        key={editor?.instance ?? "closed"}
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        category={editor?.category ?? null}
        onSaved={(message) => {
          void invalidateAllPrivateAppData(queryClient, user.id);
          setFeedback(message);
          setError("");
          setEditor(null);
        }}
      />

      {isMobile ? (
        <Drawer.Root
          open={confirmation !== null}
          onOpenChange={(open) => {
            if (!open && !isMutating) {
              setConfirmation(null);
              setConfirmationError("");
            }
          }}
        >
          <Drawer.Portal>
            <Drawer.Backdrop className="fixed inset-0 z-[60] bg-black/40" />
            <Drawer.Viewport className="fixed inset-0 z-[60] flex items-end justify-center">
              <Drawer.Popup className="w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl outline-none">
                <Drawer.Content className="mx-auto max-h-[min(85dvh,36rem)] space-y-4 overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Drawer.Title className="text-lg font-semibold">{confirmationTitle}</Drawer.Title>
                      <Drawer.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                        {confirmationDescription}
                      </Drawer.Description>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label="Cerrar confirmación"
                      onClick={() => setConfirmation(null)}
                      disabled={isMutating}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  {confirmationBody}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <AlertDialog.Root
          open={confirmation !== null}
          onOpenChange={(open) => {
            if (!open && !isMutating) {
              setConfirmation(null);
              setConfirmationError("");
            }
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-black/40" />
            <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <AlertDialog.Title className="text-lg font-semibold">{confirmationTitle}</AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                    {confirmationDescription}
                  </AlertDialog.Description>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="Cerrar confirmación"
                  onClick={() => setConfirmation(null)}
                  disabled={isMutating}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              {confirmationBody}
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      )}
    </section>
  );
}

type CategoryCardProps = {
  category: CategoryView;
  disabled: boolean;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
};

function CategoryCard({
  category,
  disabled,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: CategoryCardProps) {
  return (
    <article className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-full border border-foreground/15"
            style={{ backgroundColor: category.color }}
          />
          <h3 className="break-words font-medium">{category.name}</h3>
          {category.isArchived && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Archivada
            </span>
          )}
        </div>
        <ExpandableDescription description={category.description} name={category.name} />
      </div>

      <Menu.Root>
        <Menu.Trigger
          aria-label={"Acciones de " + category.name}
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <MoreHorizontal aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="top" align="end" sideOffset={6} collisionPadding={12} className="z-[70]">
            <Menu.Popup className="min-w-52 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
          {onEdit && (
            <Menu.Item
              className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
              disabled={disabled}
              onClick={onEdit}
            >
              <Pencil aria-hidden="true" />
              Editar
            </Menu.Item>
          )}
          {onArchive && (
            <Menu.Item
              className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-3 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive data-[disabled]:opacity-50"
              disabled={disabled}
              onClick={onArchive}
            >
              <Archive aria-hidden="true" />
              Archivar
            </Menu.Item>
          )}
          {onRestore && (
            <Menu.Item
              className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
              disabled={disabled}
              onClick={onRestore}
            >
              <RotateCcw aria-hidden="true" />
              Restaurar
            </Menu.Item>
          )}
          {onDelete && (
            <Menu.Item
              className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-3 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive data-[disabled]:opacity-50"
              disabled={disabled}
              onClick={onDelete}
            >
              <Trash2 aria-hidden="true" />
              Eliminar definitivamente
            </Menu.Item>
          )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </article>
  );
}

function ExpandableDescription({ description, name }: { description: string; name: string }) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [canExpand, setCanExpand] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const element = measureRef.current;
    if (!element) return;
    const measure = () => setCanExpand(element.getBoundingClientRect().height > 49);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [description]);

  return (
    <div className="relative min-w-0">
      {canExpand ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Contraer" : "Expandir"} descripción de ${name}`}
          className="block min-h-11 w-full cursor-pointer py-1 text-left text-sm leading-6 text-muted-foreground hover:underline hover:decoration-dotted hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 whitespace-pre-wrap break-words"
          style={expanded ? undefined : twoLineClampStyle}
          onClick={() => setExpanded((value) => !value)}
        >
          {description}
        </button>
      ) : (
        <p
          className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground"
          style={twoLineClampStyle}
        >
          {description}
        </p>
      )}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible pointer-events-none absolute inset-x-0 top-0 block whitespace-pre-wrap break-words text-sm leading-6"
      >
        {description}
      </span>
    </div>
  );
}

const twoLineClampStyle = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden",
};

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
