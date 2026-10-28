"use client";

import { useState, useTransition } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/navigation/section-heading";
import { createSharedSpaceInvitationAction } from "@/app/(app)/groups/actions";
import { GroupExpenses } from "@/components/expenses/group-expenses";
import { callServerAction } from "@/lib/action-result";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";
import type { CategoryView } from "@/lib/categories/types";
import type { ExpenseGroupOption } from "@/components/expenses/expense-editor-dialog";
import type { GroupBalanceView, GroupExpenseView } from "@/lib/server/expenses";
import type { AuthenticatedUserProfile } from "@/lib/server/authenticated-user";

export function GroupDetail({
  space,
  displayName,
  currentUserId,
  groups,
  categories,
  expenses,
  balances,
  month,
  today,
  account,
}: {
  space: SharedSpaceOverview;
  displayName: string;
  currentUserId: string;
  groups: ExpenseGroupOption[];
  categories: CategoryView[];
  expenses: GroupExpenseView[];
  balances: GroupBalanceView[];
  month: string;
  today: string;
  account: Pick<AuthenticatedUserProfile, "name" | "email">;
}) {
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const groupIsFull = space.members.length === 2;

  function createInvitation() {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await callServerAction(() =>
        createSharedSpaceInvitationAction(space.id),
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCode(result.data.code);
      setExpiresAt(result.data.expiresAt);
    });
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Código copiado. Compartilo con una persona para completar Casa.");
    } catch {
      setFeedback("Seleccioná el código y copialo para compartirlo.");
    }
  }

  return groupIsFull ? (
    <GroupExpenses
        groupId={space.id}
        groupName={displayName}
        groups={groups}
        currentUserId={currentUserId}
        categories={categories}
        expenses={expenses}
        balances={balances}
        month={month}
        today={today}
        account={account}
    />
  ) : (
    <>
      <SectionHeading
        title={displayName}
        account={account}
      />

      <section aria-labelledby="group-invitation-heading" className="space-y-4">
        <div>
          <h2 id="group-invitation-heading" className="text-lg font-semibold">
            Invitación
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Invitá a la segunda persona para compartir gastos. El código vence en siete días y se usa una sola vez. Reemplazarlo invalida el anterior.
          </p>
        </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            onClick={createInvitation}
            disabled={isPending}
          >
            <Link2 aria-hidden="true" />
            {isPending ? "Preparando…" : code ? "Reemplazar código" : "Generar invitación"}
          </Button>
        {error && <p className="text-sm text-destructive-foreground" role="alert">{error}</p>}
        {feedback && (
          <p className="text-sm text-success" role="status">
            {feedback}
          </p>
        )}
        {code && !groupIsFull && (
          <div className="max-w-xl space-y-2 rounded-2xl border border-border bg-card p-4">
            <Label htmlFor="group-invitation-value">Código de un solo uso</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="group-invitation-value"
                value={code}
                readOnly
                className="min-h-11 rounded-xl px-3 font-mono text-sm"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 shrink-0"
                onClick={copyCode}
              >
                <Copy aria-hidden="true" />
                Copiar
              </Button>
            </div>
            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                Vence el {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(expiresAt))}.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
