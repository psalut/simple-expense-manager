"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, UsersRound } from "lucide-react";
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
      setFeedback("Código copiado. Compartilo con una persona para completar el grupo.");
    } catch {
      setFeedback("Seleccioná el código y copialo para compartirlo.");
    }
  }

  return (
    <>
      <SectionHeading
        title={displayName}
        description={`${space.members.length} de 2 integrantes`}
        account={account}
      />

      <GroupExpenses
        groupId={space.id}
        groupName={displayName}
        groups={groups}
        currentUserId={currentUserId}
        categories={categories}
        expenses={expenses}
        balances={balances}
        today={today}
      />

      <section aria-labelledby="group-members-heading" className="space-y-4">
        <h2 id="group-members-heading" className="flex items-center gap-2 text-lg font-semibold">
          <UsersRound size={19} aria-hidden="true" />
          Integrantes
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
          {space.members.map((member) => (
            <li key={member.userId} className="py-3 text-sm first:pt-4 last:pb-4">
              {member.name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="group-invitation-heading" className="space-y-4">
        <div>
          <h2 id="group-invitation-heading" className="text-lg font-semibold">
            Invitación
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {groupIsFull
              ? "Este grupo ya tiene dos integrantes y puede compartir gastos."
              : "El grupo necesita una segunda persona para poder compartir gastos. Cada código se usa una vez y vence en siete días."}
          </p>
        </div>
        {groupIsFull ? (
          <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            No se pueden sumar más integrantes.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            onClick={createInvitation}
            disabled={isPending}
          >
            <Link2 aria-hidden="true" />
            {isPending ? "Preparando…" : code ? "Generar otro código" : "Generar invitación"}
          </Button>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {feedback && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
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
