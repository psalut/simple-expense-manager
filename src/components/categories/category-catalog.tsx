"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
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
  getArchivedCategoriesAction,
  restoreArchivedCategoryAction,
} from "@/app/(app)/categories/actions";
import { CategoryEditorDialog } from "@/components/categories/category-editor-dialog";
import { Button } from "@/components/ui/button";
import type { CategoryView } from "@/lib/categories/types";
import { callServerAction } from "@/lib/action-result";

type Props = {
  title: string;
  description?: string;
  categories: CategoryView[];
  sharedSpaceId: string | null;
  sharedSpaceName?: string;
};

type Confirmation = {
  action: "archive" | "delete";
  category: CategoryView;
};

export function CategoryCatalog({
  title,
  description,
  categories,
  sharedSpaceId,
  sharedSpaceName,
}: Props) {
  const router = useRouter();
  const [editor, setEditor] = useState<{
    category: CategoryView | null;
    instance: number;
  } | null>(null);
  const editorInstance = useRef(0);
  const [archived, setArchived] = useState<CategoryView[] | null>(null);
  const [archivesOpen, setArchivesOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isLoadingArchives, startLoadArchives] = useTransition();
  const [isMutating, startMutation] = useTransition();
  const isMutatingRef = useRef(false);

  function openEditor(category: CategoryView | null) {
    setError("");
    setFeedback("");
    editorInstance.current += 1;
    setEditor({ category, instance: editorInstance.current });
  }

  function toggleArchives() {
    if (archivesOpen) {
      setArchivesOpen(false);
      return;
    }

    setArchivesOpen(true);
    if (archived !== null) return;

    setError("");
    startLoadArchives(async () => {
      const result = await callServerAction(() =>
        getArchivedCategoriesAction(sharedSpaceId),
      );
      if (!result.success) {
        setError(result.error);
        setArchivesOpen(false);
        return;
      }
      setArchived(result.data);
    });
  }

  function requestConfirmation(action: Confirmation["action"], category: CategoryView) {
    setConfirmationError("");
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
            ? archiveCategoryAction(current.category.id, sharedSpaceId)
            : deleteArchivedCategoryAction(current.category.id, sharedSpaceId),
        );

        if (!result.success) {
          setConfirmationError(result.error);
          return;
        }

        if (current.action === "archive") {
          setFeedback("La categoría quedó archivada.");
          setArchived(null);
        } else {
          setFeedback(`Se eliminó “${current.category.name}” definitivamente.`);
          setArchived((items) =>
            items?.filter((item) => item.id !== current.category.id) ?? null,
          );
        }
        setConfirmation(null);
        router.refresh();
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
          restoreArchivedCategoryAction(category.id, sharedSpaceId),
        );
        if (!result.success) {
          setError(result.error);
          return;
        }

        setFeedback(`Se restauró “${category.name}”.`);
        setArchived((items) =>
          items?.filter((item) => item.id !== category.id) ?? null,
        );
        router.refresh();
      } finally {
        isMutatingRef.current = false;
      }
    });
  }

  const archivedCount = archived?.length;

  return (
    <section aria-labelledby="category-catalog-title" className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="category-catalog-title" className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
        <ul className="space-y-2">
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
          {sharedSpaceId
            ? "Todavía no hay categorías en este grupo."
            : "Todavía no creaste categorías personales."}
        </p>
      )}

      <div className="border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 gap-2 px-2"
          onClick={toggleArchives}
          disabled={isLoadingArchives}
          aria-expanded={archivesOpen}
        >
          <Archive aria-hidden="true" />
          {isLoadingArchives
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
              <ul className="space-y-2">
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
        sharedSpaceId={sharedSpaceId}
        sharedSpaceName={sharedSpaceName}
        onSaved={(message) => {
          setFeedback(message);
          setError("");
          setEditor(null);
          router.refresh();
        }}
      />

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
          <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <AlertDialog.Title className="text-lg font-semibold">
                  {confirmation?.action === "archive"
                    ? "¿Archivar categoría?"
                    : confirmation
                      ? "¿Eliminar categoría?"
                      : "Confirmación de categoría"}
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {confirmation
                    ? confirmation.action === "archive"
                      ? `“${confirmation.category.name}” dejará de estar disponible para nuevas asignaciones y se conservará para el historial.`
                      : `“${confirmation.category.name}” se eliminará definitivamente del catálogo. Esta acción no se puede deshacer.`
                    : null}
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

            {confirmationError && (
              <p className="text-sm text-destructive" role="alert">{confirmationError}</p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
                disabled={isMutating}
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
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
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
  const actionsRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    actionsRef.current?.removeAttribute("open");
  }

  return (
    <article className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words font-medium">{category.name}</h3>
          {category.isArchived && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Archivada
            </span>
          )}
        </div>
        <ExpandableDescription description={category.description} name={category.name} />
      </div>

      <details ref={actionsRef} className="relative shrink-0">
        <summary
          aria-label={`Acciones de ${category.name}`}
          className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden"
        >
          <MoreHorizontal aria-hidden="true" />
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1 min-w-52 rounded-xl border border-border bg-popover p-1 shadow-lg">
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full justify-start"
              disabled={disabled}
              onClick={() => {
                closeMenu();
                onEdit();
              }}
            >
              <Pencil aria-hidden="true" />
              Editar
            </Button>
          )}
          {onArchive && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full justify-start text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => {
                closeMenu();
                onArchive();
              }}
            >
              <Archive aria-hidden="true" />
              Archivar
            </Button>
          )}
          {onRestore && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full justify-start"
              disabled={disabled}
              onClick={() => {
                closeMenu();
                onRestore();
              }}
            >
              <RotateCcw aria-hidden="true" />
              Restaurar
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full justify-start text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => {
                closeMenu();
                onDelete();
              }}
            >
              <Trash2 aria-hidden="true" />
              Eliminar definitivamente
            </Button>
          )}
        </div>
      </details>
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
