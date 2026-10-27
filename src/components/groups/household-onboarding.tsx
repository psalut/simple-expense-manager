"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acceptSharedSpaceInvitationAction, createSharedSpaceAction } from "@/app/(app)/groups/actions";
import { callServerAction } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppUser } from "@/components/app-query-provider";
import { invalidateHouseholdAndExpenses } from "@/lib/app-data/query-keys";

export function HouseholdOnboarding({ empty, canJoin }: { empty: boolean; canJoin: boolean }) {
  const user = useAppUser();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function run(create: boolean) {
    setError("");
    startTransition(async () => {
      const result = await callServerAction(() => create ? createSharedSpaceAction("Casa") : acceptSharedSpaceInvitationAction(code));
      if (!result.success) setError(result.error);
      else void invalidateHouseholdAndExpenses(queryClient, user.id);
    });
  }
  return <section className="max-w-md space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">{empty ? "Prepará Casa para vincular a la segunda persona." : canJoin ? "Ingresá el código que te compartió la otra persona para unirte a Casa." : "Casa no admite nuevas vinculaciones o está pendiente de configuración. Consultá al propietario para revisar tu acceso."}</p>
    {empty ? <Button className="min-h-11" disabled={pending} onClick={() => run(true)}>{pending ? "Preparando…" : "Preparar Casa"}</Button> :
      canJoin ? <form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); if (!pending) run(false); }}>
        <Label htmlFor="household-code">Código de invitación</Label>
        <Input id="household-code" className="min-h-11" value={code} onChange={(event) => setCode(event.target.value)} required maxLength={50} autoComplete="off" />
        <Button type="submit" className="min-h-11" disabled={pending || !code.trim()}>{pending ? "Vinculando…" : "Unirme a Casa"}</Button>
      </form> : null}
    {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
  </section>;
}
