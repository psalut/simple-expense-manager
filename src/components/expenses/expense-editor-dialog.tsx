"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { Toast } from "@base-ui/react/toast";
import { NumericFormat } from "react-number-format";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/(app)/expenses/actions";
import {
  createIncomeAction,
  deleteIncomeAction,
  updateIncomeAction,
} from "@/app/(app)/incomes/actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import type { CategoryView } from "@/lib/categories/types";
import { splitAmountCents } from "@/lib/expenses/policy";
import { switchMovementDraft } from "@/lib/expenses/movement-draft";
import {
  shouldApplyAutomaticSuggestion,
  shouldRequestCategorySuggestion,
} from "@/lib/categories/suggestion-policy";
import { formatArs } from "@/lib/expenses/format";
import type {
  GroupExpenseView,
  PersonalExpenseView,
} from "@/lib/server/expenses";
import type { PersonalIncomeView } from "@/lib/server/incomes";
import { callServerAction } from "@/lib/action-result";
import {
  invalidateExpenseRelatedData,
  invalidatePersonalExpenseData,
} from "@/lib/app-data/query-keys";
import { cn } from "@/lib/utils";

const expenseControlClassName =
  "h-11 min-h-11 rounded-xl border-input bg-background px-3 py-2 text-base font-normal text-foreground placeholder:text-muted-foreground md:text-base";

export type ExpenseGroupOption = {
  id: string;
  name: string;
  members: { userId: string; name: string }[];
};

type SuggestionStatus = "idle" | "loading" | "suggested" | "none" | "unavailable";
export type ExpenseSaveOutcome = "created" | "updated" | "deleted";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ExpenseGroupOption[];
  currentUserId: string;
  categories: CategoryView[];
  today: string;
  initialExpense: PersonalExpenseView | GroupExpenseView | null;
  initialIncome?: PersonalIncomeView | null;
  allowIncomeCreation?: boolean;
  defaultGroupId?: string | null;
  defaultShared?: boolean;
  readOnly?: boolean;
  onSaved: (message: string, outcome: ExpenseSaveOutcome) => void;
};

export function ExpenseEditorDialog({
  open,
  onOpenChange,
  groups,
  currentUserId,
  categories,
  today,
  initialExpense,
  initialIncome = null,
  allowIncomeCreation = true,
  defaultGroupId = null,
  defaultShared = false,
  readOnly = false,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const toastManager = Toast.useToastManager();
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
  const isExistingIncome = initialIncome !== null;

  const [isIncome, setIsIncome] = useState(isExistingIncome);
  const [description, setDescription] = useState(
    initialIncome?.description ?? initialExpense?.description ?? "",
  );
  const [amount, setAmount] = useState(
    initialIncome
      ? centsToInput(initialIncome.amountCents)
      : initialExpense
        ? centsToInput(initialExpense.amountCents)
        : "",
  );
  const [expenseDate, setExpenseDate] = useState(
    initialIncome?.incomeDate ?? initialExpense?.expenseDate ?? today,
  );
  const [mobileDateSelectionOpen, setMobileDateSelectionOpen] = useState(false);
  const [draftExpenseDate, setDraftExpenseDate] = useState(expenseDate);
  const [shared, setShared] = useState(isExistingIncome ? false : initialShared);
  const [groupId, setGroupId] = useState(isExistingIncome ? "" : initialGroupId);
  const [categoryId, setCategoryId] = useState(
    isExistingIncome ? "" : initialExpense?.categoryId ?? "",
  );
  const [error, setError] = useState("");
  const [suggestionStatus, setSuggestionStatus] =
    useState<SuggestionStatus>("idle");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const manualCategorySelection = useRef(false);
  const suggestionRequest = useRef(0);
  const suggestionController = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const dateHeadingRef = useRef<HTMLHeadingElement>(null);
  const hadMobileDateSelectionOpen = useRef(false);

  useEffect(() => {
    if (mobileDateSelectionOpen) {
      const frame = window.requestAnimationFrame(() => {
        dateHeadingRef.current?.focus();
      });
      hadMobileDateSelectionOpen.current = true;
      return () => window.cancelAnimationFrame(frame);
    }

    if (hadMobileDateSelectionOpen.current && open) {
      const frame = window.requestAnimationFrame(() => {
        dateTriggerRef.current?.focus();
      });
      hadMobileDateSelectionOpen.current = false;
      return () => window.cancelAnimationFrame(frame);
    }
  }, [mobileDateSelectionOpen, open]);

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
  const categoryOptions = categoriesForSelect.map((category) => ({
    value: category.id,
    label: category.name + (category.isArchived ? " · archivada (solo historial)" : ""),
    color: category.color,
  }));
  const selectedGroup = groups.find((group) => group.id === groupId) ?? null;
  const historicalShared = Boolean(initialExpense?.sharedSpaceId && !groups.some((group) => group.id === initialExpense.sharedSpaceId));
  const canShare = completeGroups.length === 1;

  useEffect(() => {
    if (!shouldRequestCategorySuggestion({
      open,
      readOnly,
      isIncome,
      hasExistingMovement: Boolean(initialExpense || initialIncome),
      manualSelectionMade: manualCategorySelection.current,
      description,
    })) {
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
  }, [categories, description, initialExpense, initialIncome, isIncome, open, readOnly]);

  function changeMovementType(nextIncome: boolean) {
    if (initialExpense || initialIncome || readOnly || isSaving || !allowIncomeCreation) return;
    const nextDraft = switchMovementDraft(
      {
        kind: isIncome ? "income" : "expense",
        amount,
        description,
        date: expenseDate,
        categoryId,
        shared,
        groupId,
      },
      nextIncome ? "income" : "expense",
    );
    setIsIncome(nextDraft.kind === "income");
    setAmount(nextDraft.amount);
    setDescription(nextDraft.description);
    setExpenseDate(nextDraft.date);
    setError("");
    setCategoryId(nextDraft.categoryId);
    setShared(nextDraft.shared);
    setGroupId(nextDraft.groupId);
    manualCategorySelection.current = false;
    suggestionRequest.current += 1;
    suggestionController.current?.abort();
    setSuggestionStatus("idle");
  }

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

  function cancelMobileDateSelection() {
    setDraftExpenseDate(expenseDate);
    setMobileDateSelectionOpen(false);
  }

  function applyMobileDateSelection() {
    if (!draftExpenseDate) return;
    setExpenseDate(draftExpenseDate);
    setMobileDateSelectionOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || readOnly) return;
    submitting.current = true;
    setError("");

    if (!isIncome && shared && !groupId) {
      setError(
        "Casa necesita dos integrantes vinculados para compartir este gasto.",
      );
      submitting.current = false;
      return;
    }
    if (!isIncome && shared && !historicalShared && !completeGroups.some((group) => group.id === groupId)) {
      setError("Ese grupo todavía necesita dos integrantes para compartir gastos.");
      submitting.current = false;
      return;
    }
    if (!isIncome && !categoryId) {
      setError("Elegí una categoría para guardar el gasto.");
      submitting.current = false;
      return;
    }
    if (!expenseDate) {
      setError("Elegí una fecha para guardar el gasto.");
      submitting.current = false;
      return;
    }

    const expenseDraft = {
      amount,
      description,
      categoryId,
      expenseDate,
      sharedSpaceId: shared ? groupId : null,
    };
    const incomeDraft = {
      amount,
      description,
      incomeDate: expenseDate,
    };

    startSaving(async () => {
      try {
        const savingIncome = isIncome || initialIncome !== null;
        const result = savingIncome
          ? await callServerAction(() =>
              initialIncome
                ? updateIncomeAction(initialIncome.id, incomeDraft)
                : createIncomeAction(incomeDraft),
            )
          : await callServerAction(() =>
              initialExpense
                ? updateExpenseAction(initialExpense.id, expenseDraft)
                : createExpenseAction(expenseDraft),
            );
        if (!result.success) {
          setError(result.error);
          return;
        }
        if (savingIncome) {
          void invalidatePersonalExpenseData(queryClient, currentUserId);
        } else {
          void invalidateExpenseRelatedData(queryClient, currentUserId);
        }
        const isUpdating = initialExpense !== null || initialIncome !== null;
        const outcome = isUpdating ? "updated" : "created";
        if (outcome === "created") {
          toastManager.add({
            id: savingIncome ? "income-created" : "expense-created",
            type: "success",
            title: savingIncome ? "Ingreso guardado" : "Gasto guardado",
            timeout: 3500,
            priority: "low",
          });
        }
        onOpenChange(false);
        onSaved(
          savingIncome
            ? isUpdating ? "El ingreso quedó actualizado." : "El ingreso quedó guardado."
            : isUpdating ? "El gasto quedó actualizado." : "El gasto quedó guardado.",
          outcome,
        );
      } finally {
        submitting.current = false;
      }
    });
  }

  function removeMovement() {
    if ((!initialExpense && !initialIncome) || submitting.current) return;
    submitting.current = true;
    setError("");
    startSaving(async () => {
      try {
        const result = initialIncome
          ? await callServerAction(() => deleteIncomeAction(initialIncome.id))
          : await callServerAction(() => deleteExpenseAction(initialExpense!.id));
        if (!result.success) {
          setError(result.error);
          setShowDeleteConfirmation(false);
          return;
        }
        if (initialIncome) {
          void invalidatePersonalExpenseData(queryClient, currentUserId);
        } else {
          void invalidateExpenseRelatedData(queryClient, currentUserId);
        }
        toastManager.add({
          id: initialIncome ? "income-deleted" : "expense-deleted",
          type: "success",
          title: initialIncome ? "Ingreso eliminado" : "Gasto eliminado",
          timeout: 3500,
          priority: "low",
        });
        setShowDeleteConfirmation(false);
        onOpenChange(false);
        onSaved("", "deleted");
      } finally {
        submitting.current = false;
      }
    });
  }

  const deleteLabel = initialIncome ? "ingreso" : "gasto";
  const deleteDescription = initialIncome
    ? "Se quitará de tu historial personal."
    : "Se quitará de tu historial y, si está compartido, también del balance de Casa.";
  const deleteConfirmationBody = (
    <>
      {error && <p className="text-sm text-destructive-foreground" role="alert">{error}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
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
          onClick={removeMovement}
          disabled={isSaving}
        >
          {isSaving ? "Eliminando…" : `Eliminar ${deleteLabel}`}
        </Button>
      </div>
    </>
  );

  const title = readOnly
    ? "Detalle del gasto"
    : initialIncome
      ? "Editar ingreso"
      : initialExpense
        ? "Editar gasto"
        : allowIncomeCreation
          ? "Nuevo movimiento"
          : "Nuevo gasto";
  const showMovementTypeSelector =
    !initialExpense && !initialIncome && !readOnly && allowIncomeCreation;
  const content = readOnly && initialExpense ? (
    <ReadOnlyExpense
      expense={initialExpense as GroupExpenseView}
      currentUserId={currentUserId}
      group={selectedGroup}
    />
  ) : (
    <>
      <form
        className={
          isMobile
            ? "mt-4 flex min-h-0 flex-1 flex-col"
            : "mt-5 space-y-4"
        }
        onSubmit={submit}
      >
        <div
          className={
            isMobile
              ? "mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]"
              : undefined
          }
        >
        <div className={isMobile ? "space-y-4 px-3 pt-1 pb-4 sm:px-4" : "space-y-4"}>
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Importe</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-medium text-muted-foreground">
              $
            </span>
            <NumericFormat
              id="expense-amount"
              name="amount"
              customInput={Input}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              valueIsNumericString
              decimalSeparator=","
              allowedDecimalSeparators={[",", "."]}
              decimalScale={2}
              allowNegative={false}
              thousandSeparator="."
              fixedDecimalScale={/\.\d/.test(amount)}
              onValueChange={({ value }) => setAmount(value)}
              required
              placeholder="0,00"
              aria-describedby="expense-amount-help"
              className={`${expenseControlClassName} pl-9 font-semibold tabular-nums`}
            />
          </div>
          <p id="expense-amount-help" className="sr-only">
            Importe en pesos argentinos. Ingresá coma o punto para escribir centavos.
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
            placeholder="Ingresá un detalle"
            className={expenseControlClassName}
          />
        </div>

        {!isIncome && (
        <div className="space-y-2">
          <Label htmlFor="expense-category">Categoría</Label>
          <SelectField
            id="expense-category"
            value={categoryId}
            options={categoryOptions}
            onValueChange={chooseCategory}
            placeholder="Elegí una categoría"
            required
            describedBy="expense-category-help"
            className={cn(expenseControlClassName, !categoryId && "text-muted-foreground")}
          />
          <p id="expense-category-help" className="text-xs text-muted-foreground empty:hidden">
            {suggestionStatus === "loading"
              ? "Jev está buscando una sugerencia…"
              : suggestionStatus === "suggested"
                ? "Sugerida por Jev · podés cambiarla."
                : suggestionStatus === "none"
                  ? "Jev no encontró una opción clara."
                  : suggestionStatus === "unavailable"
                    ? "Jev no está disponible."
                    : selectedCategory?.isArchived
                      ? "Categoría archivada · se conserva en el historial."
                      : ""}
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
        )}

        <div className="space-y-2">
          <Label htmlFor="expense-date">Fecha</Label>
          <p id="expense-date-help" className="sr-only">
            Fecha obligatoria. Elegí una fecha para guardar el {isIncome ? "ingreso" : "gasto"}.
          </p>
          <DatePicker
            id="expense-date"
            value={expenseDate}
            onChange={setExpenseDate}
            describedBy="expense-date-help"
            isMobile={isMobile}
            mobileOpen={mobileDateSelectionOpen}
            onMobileOpen={() => {
              setDraftExpenseDate(expenseDate);
              setMobileDateSelectionOpen(true);
            }}
            triggerRef={dateTriggerRef}
            invalid={Boolean(error && !expenseDate)}
            className={cn(expenseControlClassName, !expenseDate && "text-muted-foreground")}
          />
        </div>
        {!isIncome && (
          <div className="space-y-4">
            <div className={cn(expenseControlClassName, "flex items-center justify-between gap-3 border py-0")}>
              <div className="min-w-0">
                <Label
                  htmlFor="expense-shared"
                  className={cn(
                    "text-base font-normal text-foreground",
                    canShare && "cursor-pointer",
                  )}
                >
                  Compartido
                </Label>
              </div>
              <button
                id="expense-shared"
                type="button"
                role="switch"
                aria-checked={shared}
                aria-label="Compartir este gasto con Casa"
                disabled={!canShare && !shared}
                onClick={() => changeShared(!shared)}
                className={
                  "relative h-11 w-14 shrink-0 rounded-full bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 before:absolute before:left-1/2 before:top-1/2 before:h-7 before:w-12 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:transition-colors " +
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
            {historicalShared && shared && <p className="text-xs leading-5 text-muted-foreground">Este gasto conserva su grupo histórico. Al dejar de compartirlo, solo podrás volver a compartirlo en Casa.</p>}
            {!canShare && (
              <p className="text-xs leading-5 text-muted-foreground">
                Para compartir gastos, primero vinculá a la segunda persona en Casa.
              </p>
            )}

          </div>
        )}

        </div>
        </div>
        {error && <p className={"text-sm text-destructive-foreground " + (isMobile ? "px-5 sm:px-6" : "")} role="alert">{error}</p>}

        <div
          className={
            "flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end " +
            (isMobile
              ? "mt-3 shrink-0 bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_24px_-20px_rgba(0,0,0,0.5)] sm:px-6"
              : "")
          }
        >
          {(initialExpense || initialIncome) && (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 sm:mr-auto"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={isSaving}
            >
              Eliminar {initialIncome ? "ingreso" : "gasto"}
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
                : initialExpense || initialIncome
                ? "Guardar cambios"
                  : `Guardar ${isIncome ? "ingreso" : "gasto"}`}
          </Button>
        </div>
      </form>

      {isMobile ? (
        <Drawer.Root
          open={showDeleteConfirmation}
          onOpenChange={(nextOpen) => {
            if (!isSaving) setShowDeleteConfirmation(nextOpen);
          }}
        >
          <Drawer.Portal>
            <Drawer.Backdrop className="fixed inset-0 z-[60] bg-black/40" />
            <Drawer.Viewport className="fixed inset-0 z-[60] flex items-end justify-center">
              <Drawer.Popup className="w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl outline-none">
                <Drawer.Content className="mx-auto max-h-[min(80dvh,32rem)] space-y-4 overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                  <div>
                    <Drawer.Title className="text-lg font-semibold">¿Eliminar este {deleteLabel}?</Drawer.Title>
                    <Drawer.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                      {deleteDescription}
                    </Drawer.Description>
                  </div>
                  {deleteConfirmationBody}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <AlertDialog.Root
          open={showDeleteConfirmation}
          onOpenChange={(nextOpen) => {
            if (!isSaving) setShowDeleteConfirmation(nextOpen);
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-black/40" />
            <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6">
              <div>
                <AlertDialog.Title className="text-lg font-semibold">
                  ¿Eliminar este {deleteLabel}?
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {deleteDescription}
                </AlertDialog.Description>
              </div>
              {deleteConfirmationBody}
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup
              className={
                "relative flex max-h-[min(92dvh,48rem)] w-full max-w-xl flex-col overflow-hidden overscroll-contain rounded-t-3xl border border-border bg-card text-card-foreground shadow-xl outline-none transition-[height,transform] duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full " +
                (!readOnly || mobileDateSelectionOpen ? "h-[min(92dvh,48rem)]" : "")
              }
              onKeyDownCapture={(event) => {
                if (event.key === "Escape" && mobileDateSelectionOpen) {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelMobileDateSelection();
                }
              }}
            >
              <Drawer.Content className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden pt-5 sm:pt-6">
                <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                {mobileDateSelectionOpen ? (
                  <section
                    id="mobile-expense-date-selection"
                    aria-label="Seleccionar fecha del gasto"
                    className="flex min-h-0 flex-1 flex-col px-5 sm:px-6"
                  >
                    <div className="flex shrink-0 items-center border-b border-border pb-2">
                      <Drawer.Title
                        ref={dateHeadingRef}
                        tabIndex={-1}
                        className="text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring"
                      >
                        Seleccionar fecha
                      </Drawer.Title>
                    </div>
                    <div className="flex min-h-0 min-w-0 w-full flex-1 items-start justify-center overflow-y-auto overscroll-contain px-1 pt-3 pb-4">
                      <Calendar
                        value={draftExpenseDate}
                        onChange={setDraftExpenseDate}
                        expanded
                      />
                    </div>
                    <div className="-mx-5 grid shrink-0 grid-cols-[auto_1fr_1fr] gap-2 border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 px-3"
                        onClick={() => setDraftExpenseDate(today)}
                      >
                        Hoy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 px-3"
                        onClick={cancelMobileDateSelection}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="min-h-11 px-3"
                        onClick={applyMobileDateSelection}
                        disabled={!draftExpenseDate}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </section>
                ) : (
                  <>
                    <div className="flex shrink-0 items-center gap-2 px-5 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <Drawer.Title className="break-words text-base font-semibold leading-5 sm:text-xl sm:leading-6">{title}</Drawer.Title>
                        {readOnly && (
                          <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                            Gasto compartido del grupo, en modo de consulta.
                          </Drawer.Description>
                        )}
                      </div>
                      {showMovementTypeSelector && (
                        <MovementTypeSelector
                          isIncome={isIncome}
                          disabled={isSaving}
                          onChange={changeMovementType}
                        />
                      )}
                    </div>
                    {readOnly ? (
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">
                        {content}
                      </div>
                    ) : (
                      content
                    )}
                  </>
                )}
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
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-xl font-semibold leading-6">{title}</Dialog.Title>
              {readOnly && (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Gasto compartido del grupo, en modo de consulta.
                </Dialog.Description>
              )}
            </div>
            {showMovementTypeSelector && (
              <MovementTypeSelector
                isIncome={isIncome}
                disabled={isSaving}
                onChange={changeMovementType}
              />
            )}
          </div>
          {content}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isMobile && mobileDateSelectionOpen) {
      cancelMobileDateSelection();
      return;
    }
    if (!nextOpen && isSaving) return;
    onOpenChange(nextOpen);
  }
}

function MovementTypeSelector({
  isIncome,
  disabled,
  onChange,
}: {
  isIncome: boolean;
  disabled: boolean;
  onChange: (nextIncome: boolean) => void;
}) {
  return (
    <fieldset disabled={disabled} className="shrink-0 disabled:opacity-60">
      <legend className="sr-only">Tipo de movimiento</legend>
      <div className="relative grid h-11 grid-cols-2 rounded-lg">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1 bottom-1 rounded-lg bg-muted"
        />
        <label className="relative flex h-full min-w-14 cursor-pointer items-center justify-center px-2 text-sm font-medium">
          <input
            className="peer sr-only"
            type="radio"
            name="movement-type"
            value="expense"
            checked={!isIncome}
            onChange={() => onChange(false)}
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-1 bottom-1 rounded-l-lg transition-colors ${!isIncome ? "bg-primary" : "bg-transparent"}`}
          />
          <span className={`pointer-events-none relative z-10 ${!isIncome ? "text-primary-foreground" : "text-muted-foreground"}`}>
            Gasto
          </span>
        </label>
        <label className="relative flex h-full min-w-14 cursor-pointer items-center justify-center px-2 text-sm font-medium">
          <input
            className="peer sr-only"
            type="radio"
            name="movement-type"
            value="income"
            checked={isIncome}
            onChange={() => onChange(true)}
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-1 bottom-1 rounded-r-lg transition-colors ${isIncome ? "bg-primary" : "bg-transparent"}`}
          />
          <span className={`pointer-events-none relative z-10 ${isIncome ? "text-primary-foreground" : "text-muted-foreground"}`}>
            Ingreso
          </span>
        </label>
      </div>
    </fieldset>
  );
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
  return whole + "." + fraction;
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
