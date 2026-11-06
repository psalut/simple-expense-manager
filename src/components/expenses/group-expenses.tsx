"use client";

import { useState } from "react";
import Link from "next/link";
import { inSelectedMonth } from "@/lib/household-payments/activity";
import { PaymentDialog } from "@/components/groups/payment-dialog";
import { HouseholdCreateActions } from "@/components/groups/household-create-actions";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { SectionHeading } from "@/components/navigation/section-heading";
import {
  ExpenseEditorDialog,
  type ExpenseGroupOption,
} from "@/components/expenses/expense-editor-dialog";
import { ExpenseCategoryIcon } from "@/components/expenses/expense-category-icon";
import { MonthlyTotalBadge } from "@/components/expenses/monthly-total-badge";
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
  HouseholdPaymentView,
} from "@/lib/server/expenses";
import type { AuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { getPersonInitials } from "@/lib/people/initials";

type Props = {
  groupId: string;
  groupName: string;
  groups: ExpenseGroupOption[];
  currentUserId: string;
  categories: CategoryView[];
  expenses: GroupExpenseView[];
  balances: GroupBalanceView[];
  payments?: HouseholdPaymentView[];
  month?: string;
  today: string;
  account: Pick<AuthenticatedUserProfile, "name" | "email">;
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
  payments = [],
  month,
  today,
  account,
  allowCreate = true,
}: Props) {
  const router = useRouter();
  const [activeExpense, setActiveExpense] = useState<{
    expense: GroupExpenseView;
    readOnly: boolean;
    key: number;
  } | null>(null);
  const [newExpenseKey, setNewExpenseKey] = useState<number | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<HouseholdPaymentView | "new" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [instance, setInstance] = useState(0);
  const groupIsComplete =
    groups.find((group) => group.id === groupId)?.members.length === 2;
  const groupMemberIds = (groups.find((group) => group.id === groupId)?.members ?? [])
    .map((member) => member.userId)
    .sort();
  const payerBadgeClasses = new Map<string, string>(
    groupMemberIds.map((userId, index) => [
      userId,
      index === 0
        ? "bg-brand-grey-olive text-white"
        : "bg-brand-bone text-black",
    ]),
  );
  const personalBalance = balances.find(
    (member) => member.userId === currentUserId,
  );
  const balance = personalBalance ? BigInt(personalBalance.balanceCents) : 0n;
  const balanceAmount = balance < 0n ? -balance : balance;
  const balanceStatus =
    balance > 0n
      ? "Tenés a favor"
      : balance < 0n
        ? "Debés"
        : "Saldo equilibrado";
  const balanceStatusClassName =
    balance > 0n
      ? "text-success"
      : balance < 0n
        ? "text-destructive-foreground"
        : "text-muted-foreground";
  const visibleExpenses = expenses.filter((expense) => inSelectedMonth(expense.expenseDate, month));
  const monthlyTotal = visibleExpenses.reduce(
    (total, expense) => total + BigInt(expense.amountCents),
    0n,
  );
  const visiblePayments = payments.filter((payment) => inSelectedMonth(payment.paymentDate, month));
  const activity = [
    ...visibleExpenses.map((expense) => ({ kind: "expense" as const, date: expense.expenseDate, createdAt: expense.createdAt, expense })),
    ...visiblePayments.map((payment) => ({ kind: "payment" as const, date: payment.paymentDate, createdAt: payment.createdAt, payment })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const activityByDate = new Map<string, typeof activity>();
  for (const item of activity) activityByDate.set(item.date, [...(activityByDate.get(item.date) ?? []), item]);
  const payer = balances.find((member) => BigInt(member.balanceCents) < 0n);
  const receiver = balances.find((member) => BigInt(member.balanceCents) > 0n);

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
              className="flex min-h-[4.5rem] w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <ExpenseCategoryIcon color={expense.categoryColor} icon={expense.categoryIcon} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">
                    {expense.description}
                  </span>
                  {groupName === "Casa" ? (
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0 text-[10px] font-medium leading-4 ${payerBadgeClasses.get(expense.payerUserId) ?? "bg-brand-ash-grey text-black"}`}
                      >
                        {getPersonInitials(expense.payerName)}
                      </span>
                      <span className="min-w-0 truncate">
                        {expense.categoryName}
                        {expense.categoryIsArchived ? " · archivada" : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {expense.payerName} pagó · {expense.categoryName}
                      {expense.categoryIsArchived ? " · archivada" : ""}
                    </span>
                  )}
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

  function renderPaymentRow(payment: HouseholdPaymentView) {
    const title =
      payment.payerUserId === currentUserId
        ? `Reembolso a ${payment.receiverName}`
        : payment.receiverUserId === currentUserId
          ? `Reembolso de ${payment.payerName}`
          : "Reembolso entre integrantes";
    const status = payment.voidedAt ? "Anulado" : "Entre integrantes";
    const accessibleName = [
      title,
      payment.voidedAt ? "Reembolso anulado" : status,
      formatArs(payment.amountCents),
    ]
      .filter(Boolean)
      .join(". ");

    return (
      <button
        key={"payment-" + payment.id}
        type="button"
        onClick={() => setPaymentDialog(payment)}
        aria-label={accessibleName}
        className="flex min-h-[4.5rem] w-full items-center justify-between gap-3 border-y border-border py-3 text-left hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid size-8 shrink-0 place-items-center rounded-full ${payment.voidedAt ? "bg-muted text-muted-foreground" : "bg-brand-grey-olive/10 text-brand-grey-olive"}`}
          >
            <ArrowLeftRight className="size-4" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium ${payment.voidedAt ? "text-muted-foreground" : ""}`}>
              {title}
            </span>
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {status}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block font-medium tabular-nums ${payment.voidedAt ? "text-muted-foreground" : ""}`}>
            {formatArs(payment.amountCents)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div>
      <header className="space-y-1 sm:space-y-3">
        <SectionHeading
          title={groupName}
          account={account}
          actions={groupIsComplete && allowCreate ? (
            <HouseholdCreateActions
              hasActiveDebt={balanceAmount > 0n && Boolean(payer && receiver)}
              onAddExpense={addExpense}
              onRegisterPayment={() => setPaymentDialog("new")}
            />
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
              <MonthlyTotalBadge amount={monthlyTotal} />
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
      <section aria-label={`Saldo personal de ${groupName}`}>
          {groupIsComplete ? (
            personalBalance ? (
              <p className="flex min-h-14 w-full items-center justify-between gap-4 border-y border-border py-3">
                <span className={`min-w-0 font-medium ${balanceStatusClassName}`}>
                  {balanceStatus}
                </span>
                <span className="min-w-0 flex-1 text-right font-medium tabular-nums [overflow-wrap:anywhere]">
                  {formatArs(balanceAmount)}
                </span>
              </p>
            ) : (
              <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground" role="status">
                Todavía no pudimos calcular tu saldo en este grupo.
              </p>
            )
          ) : (
            <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
              Los balances aparecen cuando se una la segunda persona. Todavía no se pueden compartir gastos.
            </p>
          )}
      </section>

      <section aria-label="Actividad de Casa" className="space-y-3">
        {feedback && (
          <p className="text-sm text-success" role="status">
            {feedback}
          </p>
        )}
        {activity.length === 0 ? (
          <div className="flex items-start gap-3 border-y border-border py-5"><ReceiptText size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" /><p className="text-sm text-muted-foreground">{month ? "No hay movimientos compartidos en " + formatMonth(month) + "." : "Todavía no hay movimientos compartidos."}</p></div>
        ) : <div className="space-y-7">{[...activityByDate.entries()].map(([date, items]) => <section key={date}><h3 className="mb-2 text-sm font-medium capitalize text-muted-foreground">{formatExpenseDate(date, today)}</h3><div>{items.map((item) => item.kind === "expense" ? <div key={"expense-" + item.expense.id}>{renderExpenseRows([item.expense], false)}</div> : renderPaymentRow(item.payment))}</div></section>)}</div>}

      </section>
      </section>

      {paymentDialog && <PaymentDialog key={paymentDialog === "new" ? "new" : paymentDialog.id} open onClose={() => setPaymentDialog(null)} userId={currentUserId} payer={payer ?? { userId: "", name: "" }} receiver={receiver ?? { userId: "", name: "" }} debt={balanceAmount} today={today} payment={paymentDialog === "new" ? undefined : paymentDialog} />}

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
        allowIncomeCreation={false}
        readOnly={activeExpense?.readOnly ?? false}
        onSaved={(message, outcome) => {
          setFeedback(outcome === "created" || outcome === "deleted" ? "" : message);
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
        allowIncomeCreation={false}
        defaultGroupId={groupId}
        defaultShared
        onSaved={(message, outcome) => {
          setFeedback(outcome === "created" || outcome === "deleted" ? "" : message);
          setNewExpenseKey(null);
          if (!allowCreate) router.refresh();
        }}
      />
    </div>
  );
}
