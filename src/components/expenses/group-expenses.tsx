"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ExpenseEditorDialog,
  type ExpenseGroupOption,
} from "@/components/expenses/expense-editor-dialog";
import type { CategoryView } from "@/lib/categories/types";
import { formatArs, formatExpenseDate } from "@/lib/expenses/format";
import type {
  GroupBalanceView,
  GroupExpenseView,
} from "@/lib/server/expenses";

type Props = {
  groupId: string;
  groupName: string;
  groups: ExpenseGroupOption[];
  currentUserId: string;
  categories: CategoryView[];
  expenses: GroupExpenseView[];
  balances: GroupBalanceView[];
  today: string;
  allowCreate?: boolean;
};

export function GroupExpenses({
  groupId,
  groupName,
  groups,
  currentUserId,
  categories,
  expenses,
  balances,
  today,
  allowCreate = true,
}: Props) {
  const router = useRouter();
  const [activeExpense, setActiveExpense] = useState<{
    expense: GroupExpenseView;
    readOnly: boolean;
    key: number;
  } | null>(null);
  const [newExpenseKey, setNewExpenseKey] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const instance = useRef(0);
  const groupIsComplete =
    groups.find((group) => group.id === groupId)?.members.length === 2;

  function openExpense(expense: GroupExpenseView) {
    instance.current += 1;
    setActiveExpense({
      expense,
      readOnly: expense.payerUserId !== currentUserId,
      key: instance.current,
    });
  }

  function addExpense() {
    if (!groupIsComplete || !allowCreate) return;
    instance.current += 1;
    setNewExpenseKey(instance.current);
    setActiveExpense(null);
    setFeedback("");
  }

  return (
    <section className="space-y-8">
      <section aria-labelledby="group-balance-heading" className="space-y-3">
        <header>
          <h2 id="group-balance-heading" className="text-lg font-semibold">Tu balance</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acumulado desde el inicio</p>
          <p className="mt-2 break-words text-sm">{groups.find((group) => group.id === groupId)?.members.map((member) => member.name).join(" · ")}</p>
        </header>
        {groupIsComplete ? (
          <ul className="divide-y divide-border border-y border-border">
            {balances.filter((member) => member.userId === currentUserId).map((member) => {
              const balance = BigInt(member.balanceCents);
              const status =
                balance > 0n ? "A favor" : balance < 0n ? "En contra" : "Equilibrado";
              return (
                <li key={member.userId}>
                  <details>
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 truncate font-medium">Ver desglose</span>
                      <span className="min-w-0 text-right [overflow-wrap:anywhere]">
                        <span className="block text-xs text-muted-foreground">{status}</span>
                        <span className="text-2xl font-semibold tabular-nums">{formatArs(member.balanceCents)}</span>
                      </span>
                    </summary>
                    <dl className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 px-3 py-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Pagaste</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {formatArs(member.paidCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Tu parte</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {formatArs(member.assignedCents)}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
            Los balances aparecen cuando se una la segunda persona. Todavía no se pueden compartir gastos.
          </p>
        )}
      </section>

      <section aria-labelledby="group-expenses-heading" className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 id="group-expenses-heading" className="text-xl font-semibold tracking-tight">
              Gastos compartidos
            </h2>

          </div>
          {groupIsComplete && allowCreate && (
            <Button
              type="button"
              className="min-h-11 shrink-0 gap-2"
              onClick={addExpense}
            >
              <Plus aria-hidden="true" />
              <span className="hidden sm:inline">Agregar gasto</span>
              <span className="sm:hidden">Agregar</span>
            </Button>
          )}
        </header>

        {feedback && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
            {feedback}
          </p>
        )}
        {expenses.length === 0 ? (
          <div className="flex items-start gap-3 border-y border-border py-5">
            <ReceiptText
              size={19}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              {groupIsComplete
                ? "Todavía no hay gastos compartidos en " + groupName + ". Agregá uno cuando alguien pague algo para el grupo."
                : groupName + " necesita una segunda persona antes de compartir gastos."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <button
                  type="button"
                  onClick={() => openExpense(expense)}
                  aria-label={
                    (expense.payerUserId === currentUserId ? "Editar" : "Ver") +
                    " gasto " +
                    expense.description +
                    ", pagó " +
                    expense.payerName +
                    ", " +
                    formatArs(expense.amountCents)
                  }
                  className="flex min-h-[4.5rem] w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/30"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full border border-foreground/15"
                      style={{ backgroundColor: expense.categoryColor }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium">
                        {expense.description}
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {expense.payerName} pagó · {expense.categoryName}
                        {expense.categoryIsArchived ? " · archivada" : ""}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-medium tabular-nums">
                      {formatArs(expense.amountCents)}
                    </span>
                    <span className="mt-1 block text-xs capitalize text-muted-foreground">
                      {formatExpenseDate(expense.expenseDate, today)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExpenseEditorDialog
        key={activeExpense?.key ?? newExpenseKey ?? "closed"}
        open={activeExpense !== null}
        onOpenChange={(open) => {
          if (!open) setActiveExpense(null);
        }}
        groups={groups}
        categories={categories}
        currentUserId={currentUserId}
        today={today}
        initialExpense={activeExpense?.expense ?? null}
        readOnly={activeExpense?.readOnly ?? false}
        onSaved={(message) => {
          setFeedback(message);
          setActiveExpense(null);
          setNewExpenseKey(null);
          if (!allowCreate) router.refresh();
        }}
      />

      <ExpenseEditorDialog
        key={"new-" + (newExpenseKey ?? "closed")}
        open={newExpenseKey !== null}
        onOpenChange={(open) => {
          if (!open) setNewExpenseKey(null);
        }}
        groups={groups}
        categories={categories}
        currentUserId={currentUserId}
        today={today}
        initialExpense={null}
        defaultGroupId={groupId}
        defaultShared
        onSaved={(message) => {
          setFeedback(message);
          setNewExpenseKey(null);
          if (!allowCreate) router.refresh();
        }}
      />
    </section>
  );
}
