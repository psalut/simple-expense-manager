"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callServerAction } from "@/lib/action-result";
import {
  archiveCategoryAction,
  createCategoryAction,
  deleteArchivedCategoryAction,
  getArchivedCategoriesAction,
  updateCategoryAction,
} from "@/app/(app)/categories/actions";
import type { CategoryView } from "@/lib/categories/types";
import type { CategoryScope } from "@/lib/categories/policy";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";

type Props = {
  categories: CategoryView[];
  spaces: SharedSpaceOverview[];
};

export function CategoriesManager({ categories, spaces }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<CategoryScope>("personal");
  const [sharedSpaceId, setSharedSpaceId] = useState(
    spaces.length === 1 ? spaces[0].id : "",
  );
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [archived, setArchived] = useState<CategoryView[] | null>(null);
  const [isLoadingArchived, startArchivedTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const personal = categories.filter((category) => category.scope === "personal");
  const shared = categories.filter((category) => category.scope === "shared");
  const archivedPersonal =
    archived?.filter((category) => category.scope === "personal") ?? [];
  const archivedShared =
    archived?.filter((category) => category.scope === "shared") ?? [];

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError("");
    setFeedback("");

    startSaveTransition(async () => {
      const result = await callServerAction(() => createCategoryAction({
        name: formData.get("name"),
        description: formData.get("description"),
        scope,
        sharedSpaceId: scope === "shared" ? sharedSpaceId : null,
      }));
      if (!result.success) {
        setError(result.error);
        return;
      }
      form.reset();
      setScope("personal");
      setSharedSpaceId(spaces.length === 1 ? spaces[0].id : "");
      setCreating(false);
      setFeedback("La categoría quedó guardada.");
      router.refresh();
    });
  }

  function toggleArchived() {
    if (archived !== null) {
      setArchived(null);
      return;
    }

    startArchivedTransition(async () => {
      const result = await callServerAction(getArchivedCategoriesAction);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setArchived(result.data);
    });
  }

  const archivedCount = archived?.length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Categorías</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Definí qué incluye cada categoría. Esa descripción también ayudará a
            sugerir clasificaciones en el futuro.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full gap-2 sm:w-auto"
          onClick={() => {
            setCreating((value) => !value);
            setError("");
            setFeedback("");
          }}
          aria-expanded={creating}
          aria-controls="category-form"
        >
          {creating ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {creating ? "Cerrar formulario" : "Nueva categoría"}
        </Button>
      </header>

      {feedback && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {feedback}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {creating && (
        <section
          id="category-form"
          aria-labelledby="category-form-heading"
          className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 sm:p-6"
        >
          <h2 id="category-form-heading" className="text-lg font-semibold">
            Crear categoría
          </h2>
          <form className="mt-5 grid gap-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="category-scope">Ámbito</Label>
              <select
                id="category-scope"
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as CategoryScope)
                }
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
              >
                <option value="personal">Personal</option>
                <option value="shared" disabled={spaces.length === 0}>
                  Compartida
                </option>
              </select>
              {spaces.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Primero creá un grupo o unite a uno.
                </p>
              )}
            </div>
            {scope === "shared" && spaces.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="category-shared-space">Grupo</Label>
                <select
                  id="category-shared-space"
                  value={sharedSpaceId}
                  onChange={(event) => setSharedSpaceId(event.target.value)}
                  required
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
                >
                  {spaces.length > 1 && <option value="">Elegí un grupo</option>}
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {getSpaceDisplayName(space, spaces)} · {space.members.length} integrantes
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Solo los miembros de este grupo verán y administrarán la categoría.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="category-name">Nombre</Label>
              <Input
                id="category-name"
                name="name"
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
                required
                maxLength={500}
                rows={3}
                placeholder="Qué gastos incluye y cuáles deberían ir en otra categoría."
                className="min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Aclarar qué incluye y qué excluye ayuda a clasificar mejor.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Guardando…" : "Guardar categoría"}
              </Button>
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <CategoryGroup
          id="personal"
          title="Mis categorías"
          description="Solo vos podés verlas y administrarlas."
          categories={personal}
          archivedCategories={archivedPersonal}
          hasLoadedArchived={archived !== null}
          isSaving={isSaving}
          onUpdate={(id, values) =>
            callServerAction(() => updateCategoryAction(id, values)).then((result) => {
              if (result.success) {
                setFeedback("La categoría quedó actualizada.");
                router.refresh();
              } else {
                setError(result.error);
              }
              return result;
            })
          }
          onArchive={(category) => archive(category)}
        />
        {spaces.map((space) => (
          <CategoryGroup
            key={space.id}
            id={`space-${space.id}`}
            title={getSpaceDisplayName(space, spaces)}
            description={`Catálogo compartido · ${space.members.length} integrantes`}
            categories={shared.filter((category) => category.sharedSpaceId === space.id)}
            archivedCategories={archivedShared.filter((category) => category.sharedSpaceId === space.id)}
            hasLoadedArchived={archived !== null}
            isSaving={isSaving}
            isShared
            onUpdate={(id, values) =>
              callServerAction(() => updateCategoryAction(id, values)).then((result) => {
                if (result.success) {
                  setFeedback("La categoría quedó actualizada.");
                  router.refresh();
                } else {
                  setError(result.error);
                }
                return result;
              })
            }
            onArchive={(category) => archive(category)}
          />
        ))}
      </div>

      <div className="border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={toggleArchived}
          disabled={isLoadingArchived}
        >
          <Archive aria-hidden="true" />
          {isLoadingArchived
            ? "Cargando…"
            : archived !== null
              ? "Ocultar archivadas"
              : "Ver categorías archivadas"}
          {archivedCount !== undefined && ` (${archivedCount})`}
        </Button>
      </div>

      {archived !== null && (
        <div className="grid gap-8 lg:grid-cols-2">
          <CategoryGroup
            id="personal-archived"
            title="Mis categorías archivadas"
            description="Se conservan para referencias históricas y no se ofrecen para nuevas asignaciones."
            categories={[]}
            archivedCategories={archivedPersonal}
            hasLoadedArchived
            isSaving={isSaving}
            onUpdate={async () => ({ success: false, error: "No disponible." })}
            onArchive={async () => ({ success: false, error: "No disponible." })}
            onDelete={(category) => removeArchivedCategory(category)}
            archivedOnly
          />
          {spaces.map((space) => (
            <CategoryGroup
              key={`archived-${space.id}`}
              id={`archived-space-${space.id}`}
              title={`${getSpaceDisplayName(space, spaces)} · archivadas`}
              description="Se conservan para referencias históricas y no se ofrecen para nuevas asignaciones."
              categories={[]}
              archivedCategories={archivedShared.filter((category) => category.sharedSpaceId === space.id)}
              hasLoadedArchived
              isSaving={isSaving}
              onUpdate={async () => ({ success: false, error: "No disponible." })}
              onArchive={async () => ({ success: false, error: "No disponible." })}
              onDelete={(category) => removeArchivedCategory(category)}
              archivedOnly
              isShared
            />
          ))}
        </div>
      )}
    </div>
  );

  async function archive(category: CategoryView) {
    const confirmed = window.confirm(
      `¿Archivar “${category.name}”? No estará disponible para nuevas asignaciones.`,
    );
    if (!confirmed) return { success: false as const, error: "Cancelado." };

    setError("");
    const result = await callServerAction(() =>
      archiveCategoryAction(category.id),
    );
    if (result.success) {
      setFeedback("La categoría quedó archivada.");
      setArchived(null);
      router.refresh();
    } else {
      setError(result.error);
    }
    return result;
  }

  async function removeArchivedCategory(category: CategoryView) {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente “${category.name}”? Esta acción es irreversible y solo se permite si no tiene gastos asociados.`,
    );
    if (!confirmed) return { success: false as const, error: "" };

    setError("");
    const result = await callServerAction(() =>
      deleteArchivedCategoryAction(category.id),
    );
    if (result.success) {
      setFeedback(`Se eliminó “${category.name}” definitivamente.`);
      setArchived((current) =>
        current?.filter((archivedCategory) => archivedCategory.id !== category.id) ?? null,
      );
      router.refresh();
    } else {
      setError(result.error);
    }
    return result;
  }
}

function getSpaceDisplayName(space: SharedSpaceOverview, spaces: SharedSpaceOverview[]) {
  const duplicateName = spaces.some((other) => other.id !== space.id && other.name === space.name);
  return duplicateName ? space.name + " · " + space.id.slice(0, 6) : space.name;
}

type CategoryGroupProps = {
  id: string;
  title: string;
  description: string;
  categories: CategoryView[];
  archivedCategories: CategoryView[];
  hasLoadedArchived: boolean;
  isSaving: boolean;
  onUpdate: (
    id: string,
    values: { name: string; description: string },
  ) => Promise<{ success: boolean; error?: string }>;
  onArchive: (
    category: CategoryView,
  ) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (
    category: CategoryView,
  ) => Promise<{ success: boolean; error?: string }>;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  archivedOnly?: boolean;
  isShared?: boolean;
};

function CategoryGroup({
  id,
  title,
  description,
  categories,
  archivedCategories,
  hasLoadedArchived,
  isSaving,
  onUpdate,
  onArchive,
  onDelete,
  emptyActionLabel,
  onEmptyAction,
  archivedOnly = false,
  isShared = false,
}: CategoryGroupProps) {
  const visibleCategories = archivedOnly ? archivedCategories : categories;

  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-4 space-y-1">
        <h2
          id={`${id}-heading`}
          className="flex items-center gap-2 text-xl font-semibold"
        >
          {isShared && <Users size={19} aria-hidden="true" />}
          {title}
          <span className="text-sm font-normal text-muted-foreground">
            {visibleCategories.length}
          </span>
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {visibleCategories.length > 0 ? (
        <ul className="divide-y divide-border rounded-2xl bg-card px-4 shadow-sm ring-1 ring-foreground/10">
          {visibleCategories.map((category) => (
            <li key={category.id} className="py-4 first:pt-4 last:pb-4">
              <CategoryRow
                category={category}
                disabled={isSaving}
                onUpdate={onUpdate}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl bg-muted/50 p-5">
          <p className="text-sm text-muted-foreground">
            {archivedOnly || hasLoadedArchived
              ? "Todavía no hay categorías en esta lista."
              : "Todavía no hay categorías activas."}
          </p>
          {emptyActionLabel && onEmptyAction && (
            <Button
              type="button"
              variant="link"
              className="mt-2 min-h-11 px-0"
              onClick={onEmptyAction}
            >
              {emptyActionLabel}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

type CategoryRowProps = {
  category: CategoryView;
  disabled: boolean;
  onUpdate: CategoryGroupProps["onUpdate"];
  onArchive: CategoryGroupProps["onArchive"];
  onDelete?: CategoryGroupProps["onDelete"];
};

function CategoryRow({ category, disabled, onUpdate, onArchive, onDelete }: CategoryRowProps) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage("");
    startTransition(async () => {
      const result = await onUpdate(category.id, {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
      });
      if (!result.success) {
        setMessage(result.error ?? "No se pudo guardar el cambio.");
        return;
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <form className="space-y-3" onSubmit={save}>
        <div className="space-y-2">
          <Label htmlFor={`edit-name-${category.id}`}>Nombre</Label>
          <Input
            id={`edit-name-${category.id}`}
            name="name"
            defaultValue={category.name}
            maxLength={80}
            required
            className="min-h-11 rounded-xl px-3"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`edit-description-${category.id}`}>Descripción</Label>
          <textarea
            id={`edit-description-${category.id}`}
            name="description"
            defaultValue={category.description}
            maxLength={500}
            rows={3}
            required
            className="min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
          />
        </div>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={isPending}>
            <Check aria-hidden="true" />
            {isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{category.name}</h3>
          {category.isArchived && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Archivada
            </span>
          )}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {category.description}
        </p>
      </div>
      {!category.isArchived && (
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => setEditing(true)}
            aria-label={`Editar ${category.name}`}
          >
            <Pencil aria-hidden="true" />
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 text-destructive hover:text-destructive"
            disabled={disabled || isArchiving}
            onClick={() => {
              setIsArchiving(true);
              void onArchive(category).finally(() => setIsArchiving(false));
            }}
            aria-label={`Archivar ${category.name}`}
          >
            <Archive aria-hidden="true" />
            {isArchiving ? "Archivando…" : "Archivar"}
          </Button>
        </div>
      )}
      {category.isArchived && onDelete && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 shrink-0 text-destructive hover:text-destructive"
          disabled={disabled || isDeleting}
          onClick={() => {
            setIsDeleting(true);
            void onDelete(category).finally(() => setIsDeleting(false));
          }}
          aria-label={`Eliminar definitivamente ${category.name}`}
        >
          <Trash2 aria-hidden="true" />
          {isDeleting ? "Eliminando…" : "Eliminar definitivamente"}
        </Button>
      )}
    </div>
  );
}
