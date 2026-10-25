"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseEditorDialog, type ExpenseGroupOption } from "@/components/expenses/expense-editor-dialog";
import type { CategoryView } from "@/lib/categories/types";
import { formatArs, formatExpenseDate, formatMonth, shiftMonth } from "@/lib/expenses/format";
import type { PersonalExpenseView } from "@/lib/server/expenses";

type Props = {
  expenses: PersonalExpenseView[];
  categories: CategoryView[];
  groups: ExpenseGroupOption[];
  currentUserId: string;
  month: string;
  today: string;
};

export function ExpensesList({ expenses, categories, groups, currentUserId, month, today }: Props) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ expense: PersonalExpenseView | null; key: number } | null>(null);
  const [feedback, setFeedback] = useState("");
  const instance = useRef(0);

  function openEditor(expense: PersonalExpenseView | null) {
    instance.current += 1;
    setEditor({ expense, key: instance.current });
    setFeedback("");
  }

  const byDate = new Map<string, PersonalExpenseView[]>();
  for (const expense of expenses) {
    const items = byDate.get(expense.expenseDate) ?? [];
    items.push(expense);
    byDate.set(expense.expenseDate, items);
  }

  return (
    <>
      <header className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Gastos</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tus gastos personales y los que compartiste.
            </p>
          </div>
          <div className="hidden md:block">
            <Button type="button" className="min-h-11 gap-2" onClick={() => openEditor(null)}>
              <Plus aria-hidden="true" />
              Agregar gasto
            </Button>
          </div>
        </div>

        <nav aria-label="Navegar por mes" className="flex min-h-12 items-center justify-between border-y border-border py-1">
          <Link
            href={"/?month=" + shiftMonth(month, -1)}
            aria-label="Mes anterior"
            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
          <p className="font-medium">{formatMonth(month)}</p>
          <Link
            href={"/?month=" + shiftMonth(month, 1)}
            aria-label="Mes siguiente"
            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        </nav>
      </header>

      {feedback && <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300" role="status">{feedback}</p>}

      {expenses.length === 0 ? (
        <section className="mt-10 max-w-xl space-y-4" aria-labelledby="empty-expenses-heading">
          <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <ReceiptText size={22} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id="empty-expenses-heading" className="text-lg font-semibold">No hay gastos en este mes</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Cargá lo que pagaste. Si querés, podés compartirlo con uno de tus grupos.
            </p>
          </div>
        </section>
      ) : (
        <div className="mt-6 space-y-7">
          {[...byDate.entries()].map(([date, items]) => (
            <section key={date} aria-labelledby={"expenses-date-" + date}>
              <h2 id={"expenses-date-" + date} className="mb-2 text-sm font-medium capitalize text-muted-foreground">
                {formatExpenseDate(date, today)}
              </h2>
              <ul className="divide-y divide-border border-y border-border">
                {items.map((expense) => (
                  <li key={expense.id}>
                    <button
                      type="button"
                      onClick={() => openEditor(expense)}
                      aria-label={"Editar " + expense.description + ", " + formatArs(expense.amountCents)}
                      className="flex min-h-[4.5rem] w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/30"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="size-3 shrink-0 rounded-full border border-foreground/15"
                          style={{ backgroundColor: expense.categoryColor }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-medium">{expense.description}</span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">
                            {expense.categoryName}
                            {expense.categoryIsArchived ? " · archivada" : ""}
                            {expense.sharedSpaceName && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                                Compartido · {expense.sharedSpaceName}
                              </span>
                            )}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-medium tabular-nums">{formatArs(expense.amountCents)}</span>
                        <span className="mt-1 block text-xs capitalize text-muted-foreground">
                          {formatExpenseDate(expense.expenseDate, today)}
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

      <Button
        type="button"
        aria-label="Agregar gasto"
        onClick={() => openEditor(null)}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 size-14 rounded-full shadow-lg md:hidden"
      >
        <Plus size={24} aria-hidden="true" />
      </Button>

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
        initialExpense={editor?.expense ?? null}
        onSaved={(message) => {
          setFeedback(message);
          setEditor(null);
          router.refresh();
        }}
      />
    </>
  );
}
