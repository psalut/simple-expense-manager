"use client";
import { useEffect, useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { Toast } from "@base-ui/react/toast";
import { useQueryClient } from "@tanstack/react-query";
import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPaymentAction, voidPaymentAction } from "@/app/(app)/household/payments/actions";
import { callServerAction } from "@/lib/action-result";
import { appDataQueryKeys } from "@/lib/app-data/query-keys";
import { amountInputToCents } from "@/lib/expenses/policy";
import { formatArs } from "@/lib/expenses/format";
import type { HouseholdPaymentView } from "@/lib/server/expenses";

export function PaymentDialog({ open, onClose, userId, payer, receiver, debt, today, payment }: {
  open: boolean; onClose: () => void; userId: string; payer: { userId: string; name: string }; receiver: { userId: string; name: string }; debt: bigint; today: string; payment?: HouseholdPaymentView;
}) {
  const [originalPayer] = useState(payer);
  const [originalReceiver] = useState(receiver);
  const [originalDebt] = useState(debt);
  const [mobile, setMobile] = useState(false);
  const [amount, setAmount] = useState(() => `${debt / 100n}.${String(debt % 100n).padStart(2, "0")}`);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  useEffect(() => { const q = window.matchMedia("(max-width: 767px)"); const update = () => setMobile(q.matches); update(); q.addEventListener("change", update); return () => q.removeEventListener("change", update); }, []);
  const cents = amountInputToCents(amount);
  function submit() {
    setError("");
    startTransition(async () => {
      const result = payment ? await callServerAction(() => voidPaymentAction(payment.id)) : await callServerAction(() => createPaymentAction({ amount, date, note, key, expectedPayer: originalPayer.userId }));
      if (!result.success) { setError(result.error); await queryClient.invalidateQueries({ queryKey: appDataQueryKeys.household(userId) }); return; }
      await queryClient.invalidateQueries({ queryKey: appDataQueryKeys.household(userId) });
      toast.add({ title: payment ? "Pago anulado" : "Pago registrado", timeout: 3500 });
      onClose();
    });
  }
  const content = payment ? <div className="space-y-4">
    <p>{payment.payerName} le pagó a {payment.receiverName}</p><p className="font-medium tabular-nums">{formatArs(payment.amountCents)}</p>
    {payment.note && <p className="break-words text-sm text-muted-foreground">{payment.note}</p>}
    {payment.voidedAt ? <p>Anulado</p> : confirm ? <div className="space-y-3"><p>¿Anular este pago? El saldo de Casa se volverá a calcular.</p><div className="flex gap-2"><Button className="min-h-11" variant="outline" onClick={() => setConfirm(false)} disabled={pending}>Volver</Button><Button className="min-h-11" variant="destructive" onClick={submit} disabled={pending}>{pending ? "Anulando…" : "Confirmar anulación"}</Button></div></div> : <Button className="min-h-11" variant="destructive" onClick={() => setConfirm(true)}>Anular pago</Button>}
    {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
  </div> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <p>{originalPayer.name} le paga a {originalReceiver.name}</p>
    <div className="space-y-2"><Label htmlFor="payment-amount">Importe</Label><NumericFormat id="payment-amount" customInput={Input} className="min-h-11" value={amount} onValueChange={(values) => setAmount(values.value)} thousandSeparator="." decimalSeparator="," allowedDecimalSeparators={[",", "."]} decimalScale={2} allowNegative={false} inputMode="decimal" required /></div>
    <div className="space-y-2"><Label htmlFor="payment-date">Fecha</Label><Input id="payment-date" className="min-h-11" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} required /></div>
    <div className="space-y-2"><Label htmlFor="payment-note">Nota (opcional)</Label><Input id="payment-note" className="min-h-11" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>
    {cents && cents <= originalDebt && <p className="text-sm text-muted-foreground">Después del pago: {cents === originalDebt ? "saldo equilibrado" : `${originalPayer.name} deberá ${formatArs(originalDebt - cents)}`}.</p>}
    {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
    <Button className="min-h-11 w-full" type="submit" disabled={pending}>{pending ? "Guardando…" : "Registrar pago"}</Button>
  </form>;
  const title = payment ? "Pago entre integrantes" : "Registrar pago";
  return mobile ? <Drawer.Root open={open} onOpenChange={(v) => { if (!v && !pending) onClose(); }}><Drawer.Portal><Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40" /><Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center"><Drawer.Popup className="w-full max-w-xl rounded-t-3xl border border-border bg-card shadow-xl"><Drawer.Content className="max-h-[85dvh] space-y-4 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"><Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>{content}</Drawer.Content></Drawer.Popup></Drawer.Viewport></Drawer.Portal></Drawer.Root> : <Dialog.Root open={open} onOpenChange={(v) => { if (!v && !pending) onClose(); }}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" /><Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"><Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>{content}</Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
