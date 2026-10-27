"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { FloatingCreateAction, HeaderCreateAction } from "@/components/navigation/create-actions";
import { SectionHeading } from "@/components/navigation/section-heading";
import {
  ExpenseEditorDialog,
  type ExpenseGroupOption,
} from "@/components/expenses/expense-editor-dialog";
import type { CategoryView } from "@/lib/categories/types";
import {
  formatArs,
  formatExpenseDate,
  formatMonth,
  shiftMonth,
} from "@/lib/expenses/format";
import type {
  GroupBalanceView,
  GroupExpenseView,
} from "@/lib/server/expenses";
import type { AuthenticatedUserProfile } from "@/lib/server/authenticated-user";

type Props = {
  groupId: string;
  groupName: string;
  groups: ExpenseGroupOption[];
  currentUserId: string;
  categories: CategoryView[];
  expenses: GroupExpenseView[];
  balances: GroupBalanceView[];
  month?: string;
  today: string;
  account: Pick<AuthenticatedUserProfile, "name" | "email">;
  allowCreate?: boolean;
  showBalance?: boolean;
};

export function GroupExpenses({
  groupId,
  groupName,
  groups,
  currentUserId,
  categories,
  expenses,
  balances,
  month,
  today,
  account,
  allowCreate = true,
  showBalance = true,
}: Props) {
  const router = useRouter();
  const [activeExpense, setActiveExpense] = useState<{
    expense: GroupExpenseView;
    readOnly: boolean;
    key: number;
  } | null>(null);
  const [newExpenseKey, setNewExpenseKey] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [instance, setInstance] = useState(0);
  const groupIsComplete =
    groups.find((group) => group.id === groupId)?.members.length === 2;
  const visibleExpenses = month
    ? expenses.filter((expense) => expense.expenseDate.slice(0, 7) === month)
    : expenses;
  const monthlyTotal = visibleExpenses.reduce(
    (total, expense) => total + BigInt(expense.amountCents),
    0n,
  );
  const expensesByDate = new Map<string, GroupExpenseView[]>();

  for (const expense of visibleExpenses) {
    const items = expensesByDate.get(expense.expenseDate) ?? [];
    items.push(expense);
    expensesByDate.set(expense.expenseDate, items);
  }

  function openExpense(expense: GroupExpenseView) {
    const key = instance + 1;
    setInstance(key);
    setActiveExpense({
      expense,
      readOnly: expense.payerUserId !== currentUserId,
      key,
    });
  }

  function addExpense() {
    if (!groupIsComplete || !allowCreate) return;
    const key = instance + 1;
    setInstance(key);
    setNewExpenseKey(key);
    setActiveExpense(null);
    setFeedback("");
  }

  function renderExpenseRows(items: GroupExpenseView[], includeDate: boolean) {
    return (
      <ul className="divide-y divide-border border-y border-border">
        {items.map((expense) => (
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
              className="flex min-h-[4.5rem] w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
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
                {includeDate && (
                  <span className="mt-1 block text-xs capitalize text-muted-foreground">
                    {formatExpenseDate(expense.expenseDate, today)}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <header className="space-y-1 sm:space-y-3">
        <SectionHeading
          title={groupName}
          account={account}
          actions={groupIsComplete && allowCreate ? (
            <HeaderCreateAction label="Agregar gasto" onClick={addExpense} />
          ) : undefined}
        />
        {month && (
          <nav
            aria-label="Navegar por mes"
            className="flex min-h-14 items-center justify-between border-y border-border py-1"
          >
            <Link
              href={"/household?month=" + shiftMonth(month, -1)}
              aria-label="Mes anterior"
              className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <ChevronLeft aria-hidden="true" />
            </Link>
            <div className="min-w-0 flex-1 text-center leading-5">
              <p className="font-medium">{formatMonth(month)}</p>
              <p className="text-sm font-medium tabular-nums [overflow-wrap:anywhere]">
                {formatArs(monthlyTotal)}
              </p>
            </div>
            <Link
              href={"/household?month=" + shiftMonth(month, 1)}
              aria-label="Mes siguiente"
              className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <ChevronRight aria-hidden="true" />
            </Link>
          </nav>
        )}
      </header>

      <section className="mt-4 space-y-6 sm:mt-6 sm:space-y-8">
      {showBalance && (
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
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
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
      )}

      <section aria-label="Gastos compartidos" className="space-y-3">
        {feedback && (
          <p className="text-sm text-success" role="status">
            {feedback}
          </p>
        )}
        {visibleExpenses.length === 0 ? (
          <div className="flex items-start gap-3 border-y border-border py-5">
            <ReceiptText
              size={19}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              {month && expenses.length > 0
                ? "No hay gastos compartidos en " + formatMonth(month) + "."
                : groupIsComplete
                  ? "Todavía no hay gastos compartidos en " + groupName + ". Agregá uno cuando alguien pague algo para el grupo."
                  : groupName + " necesita una segunda persona antes de compartir gastos."}
            </p>
          </div>
        ) : month ? (
          <div className="space-y-7">
            {[...expensesByDate.entries()].map(([date, items]) => (
              <section
                key={date}
                aria-labelledby={"shared-expenses-date-" + date}
              >
                <h3
                  id={"shared-expenses-date-" + date}
                  className="mb-2 text-sm font-medium capitalize text-muted-foreground"
                >
                  {formatExpenseDate(date, today)}
                </h3>
                {renderExpenseRows(items, false)}
              </section>
            ))}
          </div>
        ) : (
          renderExpenseRows(visibleExpenses, true)
        )}
      </section>
      </section>

      {groupIsComplete && allowCreate && (
        <FloatingCreateAction label="Agregar gasto" onClick={addExpense} />
      )}

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
    </div>
  );
}
