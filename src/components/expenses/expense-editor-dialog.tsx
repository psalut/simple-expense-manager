"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/(app)/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryView } from "@/lib/categories/types";
import { splitAmountCents } from "@/lib/expenses/policy";
import { shouldApplyAutomaticSuggestion } from "@/lib/categories/suggestion-policy";
import { formatArs } from "@/lib/expenses/format";
import type {
  GroupExpenseView,
  PersonalExpenseView,
} from "@/lib/server/expenses";
import { callServerAction } from "@/lib/action-result";

export type ExpenseGroupOption = {
  id: string;
  name: string;
  members: { userId: string; name: string }[];
};

type SuggestionStatus = "idle" | "loading" | "suggested" | "none" | "unavailable";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ExpenseGroupOption[];
  currentUserId: string;
  categories: CategoryView[];
  today: string;
  initialExpense: PersonalExpenseView | GroupExpenseView | null;
  defaultGroupId?: string | null;
  defaultShared?: boolean;
  readOnly?: boolean;
  onSaved: (message: string) => void;
};

export function ExpenseEditorDialog({
  open,
  onOpenChange,
  groups,
  currentUserId,
  categories,
  today,
  initialExpense,
  defaultGroupId = null,
  defaultShared = false,
  readOnly = false,
  onSaved,
}: Props) {
  const isMobile = useMobileViewport();
  const completeGroups = groups.filter(
    (group) =>
      group.members.length === 2 &&
      group.members.some((member) => member.userId === currentUserId),
  );
  const initialShared =
    initialExpense?.sharedSpaceId !== null &&
    initialExpense?.sharedSpaceId !== undefined
      ? true
      : defaultShared;
  const initialGroupId =
    initialExpense?.sharedSpaceId ??
    defaultGroupId ??
    (defaultShared && completeGroups.length === 1 ? completeGroups[0].id : "");

  const [description, setDescription] = useState(initialExpense?.description ?? "");
  const [amount, setAmount] = useState(
    initialExpense ? centsToInput(initialExpense.amountCents) : "",
  );
  const [expenseDate, setExpenseDate] = useState(
    initialExpense?.expenseDate ?? today,
  );
  const [shared, setShared] = useState(initialShared);
  const [groupId, setGroupId] = useState(initialGroupId);
  const [categoryId, setCategoryId] = useState(initialExpense?.categoryId ?? "");
  const [error, setError] = useState("");
  const [suggestionStatus, setSuggestionStatus] =
    useState<SuggestionStatus>("idle");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const manualCategorySelection = useRef(false);
  const suggestionRequest = useRef(0);
  const suggestionController = useRef<AbortController | null>(null);
  const submitting = useRef(false);

  const historicalCategory: CategoryView | null = initialExpense
    ? {
        id: initialExpense.categoryId,
        name: initialExpense.categoryName,
        description: "",
        color: initialExpense.categoryColor,
        isArchived: initialExpense.categoryIsArchived,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }
    : null;
  const selectedCategory =
    categories.find((category) => category.id === categoryId) ??
    (historicalCategory?.id === categoryId ? historicalCategory : null);
  const categoriesForSelect = [
    ...categories,
    ...(historicalCategory &&
    historicalCategory.isArchived &&
    !categories.some((category) => category.id === historicalCategory.id)
      ? [historicalCategory]
      : []),
  ];
  const selectedGroup = groups.find((group) => group.id === groupId) ?? null;
  const canShare = completeGroups.length > 0;

  useEffect(() => {
    if (
      !open ||
      readOnly ||
      initialExpense ||
      manualCategorySelection.current ||
      description.trim().length < 3
    ) {
      return;
    }

    const requestId = ++suggestionRequest.current;
    const controller = new AbortController();
    suggestionController.current?.abort();
    suggestionController.current = controller;
    setSuggestionStatus("loading");

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/categories/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: description.trim() }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("suggestion_unavailable");
        const result = (await response.json()) as {
          categoryId?: unknown;
          probability?: unknown;
          unavailable?: unknown;
        };

        if (!shouldApplyAutomaticSuggestion(
          requestId,
          suggestionRequest.current,
          manualCategorySelection.current,
        )) {
          return;
        }

        const suggested =
          typeof result.categoryId === "string"
            ? categories.find(
                (category) =>
                  category.id === result.categoryId && !category.isArchived,
              )
            : undefined;

        if (
          suggested &&
          typeof result.probability === "number"
        ) {
          setCategoryId(suggested.id);
          setSuggestionStatus("suggested");
        } else if (result.unavailable === true) {
          setSuggestionStatus("unavailable");
        } else {
          setSuggestionStatus("none");
        }
      } catch {
        if (
          !controller.signal.aborted &&
          shouldApplyAutomaticSuggestion(
            requestId,
            suggestionRequest.current,
            manualCategorySelection.current,
          )
        ) {
          setSuggestionStatus("unavailable");
        }
      }
    }, 700);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [categories, description, initialExpense, open, readOnly]);

  function changeShared(nextShared: boolean) {
    setError("");
    if (nextShared && !canShare) return;

    if (nextShared) {
      const nextGroupId =
        defaultGroupId ??
        (completeGroups.length === 1 ? completeGroups[0].id : "");
      setShared(true);
      setGroupId(nextGroupId);
      return;
    }

    setShared(false);
    setGroupId("");
  }

  function chooseCategory(nextCategoryId: string) {
    manualCategorySelection.current = true;
    suggestionRequest.current += 1;
    suggestionController.current?.abort();
    setCategoryId(nextCategoryId);
    setSuggestionStatus("idle");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || readOnly) return;
    submitting.current = true;
    setError("");

    if (shared && !groupId) {
      setError(
        completeGroups.length > 1
          ? "Elegí el grupo antes de continuar."
          : "Elegí un grupo completo para compartir este gasto.",
      );
      submitting.current = false;
      return;
    }
    if (shared && !completeGroups.some((group) => group.id === groupId)) {
      setError("Ese grupo todavía necesita dos integrantes para compartir gastos.");
      submitting.current = false;
      return;
    }
    if (!categoryId) {
      setError("Elegí una categoría para guardar el gasto.");
      submitting.current = false;
      return;
    }

    const draft = {
      amount,
      description,
      categoryId,
      expenseDate,
      sharedSpaceId: shared ? groupId : null,
    };

    startSaving(async () => {
      try {
        const result = await callServerAction(() =>
          initialExpense
            ? updateExpenseAction(initialExpense.id, draft)
            : createExpenseAction(draft),
        );
        if (!result.success) {
          setError(result.error);
          return;
        }
        onOpenChange(false);
        onSaved(
          initialExpense
            ? "El gasto quedó actualizado."
            : "El gasto quedó guardado.",
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  function removeExpense() {
    if (!initialExpense || submitting.current) return;
    submitting.current = true;
    setError("");
    startSaving(async () => {
      try {
        const result = await callServerAction(() =>
          deleteExpenseAction(initialExpense.id),
        );
        if (!result.success) {
          setError(result.error);
          setShowDeleteConfirmation(false);
          return;
        }
        setShowDeleteConfirmation(false);
        onOpenChange(false);
        onSaved("El gasto se eliminó.");
      } finally {
        submitting.current = false;
      }
    });
  }

  const title = readOnly
    ? "Detalle del gasto"
    : initialExpense
      ? "Editar gasto"
      : "Nuevo gasto";
  const content = readOnly && initialExpense ? (
    <ReadOnlyExpense
      expense={initialExpense as GroupExpenseView}
      currentUserId={currentUserId}
      group={selectedGroup}
    />
  ) : (
    <>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Importe</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-muted-foreground">
              $
            </span>
            <Input
              id="expense-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              placeholder="0,00"
              aria-describedby="expense-amount-help"
              className="min-h-[4.5rem] rounded-2xl bg-muted/40 pl-10 pr-4 text-3xl font-semibold tabular-nums"
            />
          </div>
          <p id="expense-amount-help" className="text-xs text-muted-foreground">
            Pesos argentinos. Podés usar coma o punto para los centavos.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-description">Detalle</Label>
          <Input
            id="expense-description"
            name="description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              if (!manualCategorySelection.current) {
                setCategoryId("");
                setSuggestionStatus("idle");
              }
            }}
            maxLength={200}
            required
            autoComplete="off"
            placeholder="Por ejemplo, compras para la cena"
            className="min-h-11 rounded-xl px-3"
          />
        </div>

        {groups.length > 0 && (
          <div className="space-y-3 rounded-xl border border-border px-3 py-3">
            <div className="flex min-h-12 items-center justify-between gap-4">
              <div className="min-w-0">
                <Label
                  htmlFor="expense-shared"
                  className={canShare ? "cursor-pointer font-medium" : "font-medium"}
                >
                  Compartido
                </Label>
                <p className="text-xs text-muted-foreground">
                  {shared
                    ? "Se verá en el grupo elegido."
                    : "Solo vos vas a ver este gasto."}
                </p>
              </div>
              <button
                id="expense-shared"
                type="button"
                role="switch"
                aria-checked={shared}
                aria-label="Compartir este gasto con un grupo"
                disabled={!canShare}
                onClick={() => changeShared(!shared)}
                className={
                  "relative h-11 w-14 shrink-0 rounded-full bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 before:absolute before:left-1/2 before:top-1/2 before:h-7 before:w-12 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:transition-colors " +
                  (shared
                    ? "before:bg-primary"
                    : "before:bg-muted-foreground/35")
                }
              >
                <span
                  className={
                    "absolute top-2 size-7 rounded-full bg-background shadow-sm transition-transform " +
                    (shared ? "left-6" : "left-1")
                  }
                />
              </button>
            </div>
            {!canShare && (
              <p className="text-xs leading-5 text-muted-foreground">
                Tus grupos todavía necesitan una segunda persona para compartir gastos.
              </p>
            )}
            {shared && (
              <div className="space-y-2">
                <Label htmlFor="expense-group">Grupo</Label>
                <select
                  id="expense-group"
                  value={groupId}
                  onChange={(event) => {
                    setGroupId(event.target.value);
                    setError("");
                  }}
                  required
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
                >
                  {completeGroups.length !== 1 && (
                    <option value="">Elegí un grupo</option>
                  )}
                  {completeGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                {completeGroups.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Elegí en cuál de tus grupos compartirlo.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="expense-category">Categoría</Label>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-full border border-foreground/15"
              style={{
                backgroundColor: selectedCategory?.color ?? "transparent",
              }}
            />
            <select
              id="expense-category"
              value={categoryId}
              onChange={(event) => chooseCategory(event.target.value)}
              required
              aria-describedby="expense-category-help"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
            >
              <option value="">Elegí una categoría</option>
              {categoriesForSelect.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isArchived ? " · archivada (solo historial)" : ""}
                </option>
              ))}
            </select>
          </div>
          <p id="expense-category-help" className="text-xs text-muted-foreground">
            {suggestionStatus === "loading"
              ? "Buscando sugerencia…"
              : suggestionStatus === "suggested"
                ? "Sugerida por Jev. Podés elegir otra categoría."
                : suggestionStatus === "none"
                  ? "Sin coincidencia clara. Elegí una categoría."
                  : suggestionStatus === "unavailable"
                    ? "Sugerencia no disponible. Podés elegir una categoría manualmente."
                    : selectedCategory?.isArchived
                      ? "La categoría archivada se conserva en este gasto histórico."
                      : "La sugerencia nunca impide elegir otra categoría."}
          </p>
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay categorías activas.{" "}
              <Link
                href="/categories"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Abrir catálogo
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-date">Fecha</Label>
          <Input
            id="expense-date"
            name="expenseDate"
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            required
            className="min-h-11 rounded-xl px-3"
          />
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          {initialExpense && (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 sm:mr-auto"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={isSaving}
            >
              Eliminar gasto
            </Button>
          )}
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
            {isSaving
              ? "Guardando…"
              : initialExpense
                ? "Guardar cambios"
                : "Guardar gasto"}
          </Button>
        </div>
      </form>

      <AlertDialog.Root
        open={showDeleteConfirmation}
        onOpenChange={(nextOpen) => {
          if (!isSaving) setShowDeleteConfirmation(nextOpen);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6">
            <div>
              <AlertDialog.Title className="text-lg font-semibold">
                ¿Eliminar este gasto?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                Se quitará de tu historial y, si está compartido, también del balance del grupo.
              </AlertDialog.Description>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                onClick={removeExpense}
                disabled={isSaving}
              >
                {isSaving ? "Eliminando…" : "Eliminar"}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup className="w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl outline-none transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full">
              <Drawer.Content className="mx-auto max-h-[min(92dvh,48rem)] overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Drawer.Title className="text-xl font-semibold">{title}</Drawer.Title>
                    <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                      {readOnly
                        ? "Gasto compartido del grupo, en modo de consulta."
                        : "Registrá lo que pagaste."}
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
                {content}
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
                {readOnly
                  ? "Gasto compartido del grupo, en modo de consulta."
                  : "Registrá lo que pagaste."}
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
          {content}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) return;
    onOpenChange(nextOpen);
  }
}

function ReadOnlyExpense({
  expense,
  currentUserId,
  group,
}: {
  expense: GroupExpenseView;
  currentUserId: string;
  group: ExpenseGroupOption | null;
}) {
  const split = splitAmountCents(BigInt(expense.amountCents));
  const otherMember = group?.members.find(
    (member) => member.userId !== expense.payerUserId,
  );
  const payerShare = split.payerShareCents.toString();
  const otherShare = split.otherShareCents.toString();

  return (
    <div className="mt-5 space-y-4">
      <p className="text-3xl font-semibold tabular-nums">
        {formatArs(expense.amountCents)}
      </p>
      <dl className="divide-y divide-border rounded-xl border border-border px-4">
        <DetailRow label="Detalle" value={expense.description} />
        <DetailRow label="Pagó" value={expense.payerName} />
        <DetailRow
          label="Categoría"
          value={expense.categoryName + (expense.categoryIsArchived ? " · archivada" : "")}
        />
        <DetailRow label="Grupo" value={expense.sharedSpaceName ?? "Grupo"} />
        <DetailRow label="Fecha" value={formatDateOnly(expense.expenseDate)} />
      </dl>
      <section aria-labelledby="readonly-expense-split" className="space-y-2">
        <h3 id="readonly-expense-split" className="font-medium">
          Reparto por mitades
        </h3>
        <ul className="divide-y divide-border rounded-xl border border-border px-4">
          <li className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {expense.payerName}
              {expense.payerUserId === currentUserId ? " · vos" : ""}
            </span>
            <span className="shrink-0 tabular-nums">{formatArs(payerShare)}</span>
          </li>
          <li className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {otherMember?.name ?? "Otro integrante"}
              {otherMember?.userId === currentUserId ? " · vos" : ""}
            </span>
            <span className="shrink-0 tabular-nums">{formatArs(otherShare)}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 flex-col justify-center gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm sm:text-right">{value}</dd>
    </div>
  );
}

function centsToInput(cents: string): string {
  const value = BigInt(cents);
  const whole = (value / 100n).toString();
  const fraction = (value % 100n).toString().padStart(2, "0");
  return whole + "," + fraction;
}

function formatDateOnly(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
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
