"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronLeft, ChevronRight, Plus, ReceiptText, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseEditorDialog, type ExpenseGroupOption } from "@/components/expenses/expense-editor-dialog";
import { MonthlyTotalBadge } from "@/components/expenses/monthly-total-badge";
import { FloatingCreateAction, HeaderCreateAction } from "@/components/navigation/create-actions";
import { SectionHeading } from "@/components/navigation/section-heading";
import type { AuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import type { CategoryView } from "@/lib/categories/types";
import { formatArs, formatExpenseDate, formatMonth, shiftMonth } from "@/lib/expenses/format";
import type { PersonalExpenseView } from "@/lib/server/expenses";
import type { PersonalIncomeView } from "@/lib/server/incomes";
import {
  hasPersonalMonthlyIncome,
  personalMonthlyBalanceCents,
} from "@/lib/incomes/personal-monthly-balance";
import { ExpenseCategoryIcon } from "@/components/expenses/expense-category-icon";

type PersonalMovementView = PersonalExpenseView | PersonalIncomeView;

type Props = {
  expenses: PersonalExpenseView[];
  incomes: PersonalIncomeView[];
  categories: CategoryView[];
  groups: ExpenseGroupOption[];
  currentUserId: string;
  account: Pick<AuthenticatedUserProfile, "name" | "email">;
  month: string;
  monthlyTotal: string;
  today: string;
};

export function ExpensesList({ expenses, incomes, categories, groups, currentUserId, account, month, monthlyTotal, today }: Props) {
  const [editor, setEditor] = useState<{
    movement: PersonalMovementView | null;
    key: number;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const instance = useRef(0);

  function openEditor(movement: PersonalMovementView | null) {
    instance.current += 1;
    setEditor({ movement, key: instance.current });
    setFeedback("");
  }

  const movements: PersonalMovementView[] = [
    ...expenses,
    ...incomes,
  ].sort((left, right) => {
    const leftDate = left.kind === "income" ? left.incomeDate : left.expenseDate;
    const rightDate = right.kind === "income" ? right.incomeDate : right.expenseDate;
    return rightDate.localeCompare(leftDate);
  });
  const monthlyBalance = personalMonthlyBalanceCents(expenses, incomes);
  const showMonthlyBalance = hasPersonalMonthlyIncome(incomes);
  const byDate = new Map<string, PersonalMovementView[]>();
  for (const movement of movements) {
    const date = movement.kind === "income" ? movement.incomeDate : movement.expenseDate;
    const items = byDate.get(date) ?? [];
    items.push(movement);
    byDate.set(date, items);
  }

  return (
    <>
      <header className="space-y-1 sm:space-y-3">
        <SectionHeading
          title="Gastos"
          account={account}
          actions={<HeaderCreateAction label="Agregar movimiento" onClick={() => openEditor(null)} />}
        />

        <nav aria-label="Navegar por mes" className="flex min-h-14 items-center justify-between border-y border-border py-2">
          <Link
            href={"/?month=" + shiftMonth(month, -1)}
            aria-label="Mes anterior"
            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1 text-center leading-5">
            <p className="font-medium">{formatMonth(month)}</p>
            <MonthlyTotalBadge amount={monthlyTotal} />
          </div>
          <Link
            href={"/?month=" + shiftMonth(month, 1)}
            aria-label="Mes siguiente"
            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <div className="mt-2 space-y-2">
        {showMonthlyBalance && (
          <p className="text-center text-xs leading-5">
            <span className="inline-flex max-w-full items-center justify-center gap-1 rounded-full bg-brand-bone px-2.5 py-0.5 text-xs leading-5 text-black [overflow-wrap:anywhere]">
              <span>Saldo del mes:</span>
              <span className={`font-semibold tabular-nums ${monthlyBalance > 0n ? "text-success" : monthlyBalance < 0n ? "text-brand-bordeaux" : "text-muted-foreground"}`}>
                {monthlyBalance > 0n ? "+ " : ""}{formatArs(monthlyBalance)}
              </span>
            </span>
          </p>
        )}

        {feedback && <p className="text-sm text-success" role="status">{feedback}</p>}

        {movements.length === 0 ? (
        <section className="max-w-xl space-y-4" aria-labelledby="empty-expenses-heading">
          <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <ReceiptText size={22} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id="empty-expenses-heading" className="text-lg font-semibold">No hay movimientos en este mes</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Cargá un gasto o un ingreso personal. Los gastos compartidos se cargan en Casa.
            </p>
          </div>
          <Button
            type="button"
            className="min-h-11 gap-2"
            onClick={() => openEditor(null)}
          >
            <Plus aria-hidden="true" />
            Agregar movimiento
          </Button>
        </section>
        ) : (
        <div className="space-y-7">
          {[...byDate.entries()].map(([date, items]) => (
            <section key={date} aria-labelledby={"expenses-date-" + date}>
              <h2 id={"expenses-date-" + date} className="mb-2 text-sm font-medium capitalize text-muted-foreground">
                {formatExpenseDate(date, today)}
              </h2>
              <ul className="divide-y divide-border border-y border-border">
                  {items.map((movement) => (
                  <li key={`${movement.kind}-${movement.id}`}>
                    <button
                      type="button"
                      onClick={() => openEditor(movement)}
                      aria-label={
                        "Editar " + (movement.kind === "income" ? "ingreso " : "gasto ") +
                        movement.description +
                        ", " +
                        formatArs(movement.amountCents) +
                        (movement.kind === "expense" && movement.sharedSpaceName ? ", gasto compartido" : "")
                      }
                      className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <MovementIcon movement={movement} />
                        <span className="min-w-0 flex-1">
                          <span className="block line-clamp-2 break-words font-medium leading-5">
                            {movement.description}
                          </span>
                          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            {movement.kind === "income" ? (
                              <span>Ingreso personal</span>
                            ) : (
                              <>
                                <span>
                                  {movement.categoryName}
                                  {movement.categoryIsArchived ? " · archivada" : ""}
                                </span>
                                {movement.sharedSpaceName && (
                                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-grey-olive text-white">
                                    <UsersRound aria-hidden="true" className="size-3.5" />
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                        </span>
                      </span>
                      <span className="min-w-[7.5rem] shrink-0 text-right">
                          <span className={movement.kind === "income" ? "block font-medium tabular-nums text-success" : "block font-medium tabular-nums"}>
                            {movement.kind === "income" ? "+ " : ""}{formatArs(movement.amountCents)}
                          </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        )}
      </div>

      <FloatingCreateAction label="Agregar movimiento" onClick={() => openEditor(null)} />

      <ExpenseEditorDialog
        key={editor?.key ?? "closed"}
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        groups={groups}
        currentUserId={currentUserId}
        categories={categories}
        today={today}
        initialExpense={editor?.movement?.kind === "expense" ? editor.movement : null}
        initialIncome={editor?.movement?.kind === "income" ? editor.movement : null}
        onSaved={(message, outcome) => {
          setFeedback(outcome === "created" || outcome === "deleted" ? "" : message);
          setEditor(null);
        }}
      />
    </>
  );
}

function MovementIcon({ movement }: { movement: PersonalMovementView }) {
  if (movement.kind === "expense") {
    return <ExpenseCategoryIcon color={movement.categoryColor} />;
  }

  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-success/10 text-success"
    >
      <ArrowUp className="size-4" strokeWidth={2.25} />
    </span>
  );
}
