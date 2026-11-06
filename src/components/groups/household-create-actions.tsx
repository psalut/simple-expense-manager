"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { ArrowLeftRight, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingCreateAction, HeaderCreateAction } from "@/components/navigation/create-actions";

type Props = {
  hasActiveDebt: boolean;
  onAddExpense: () => void;
  onRegisterPayment: () => void;
};

export function HouseholdCreateActions({
  hasActiveDebt,
  onAddExpense,
  onRegisterPayment,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  function openActions() {
    if (hasActiveDebt) {
      setOpen(true);
      return;
    }
    onAddExpense();
  }

  function chooseAction(action: "expense" | "payment") {
    setOpen(false);
    if (action === "expense") onAddExpense();
    else if (hasActiveDebt) onRegisterPayment();
  }

  const choices = (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-14 w-full justify-start gap-3 px-4 py-3 text-left whitespace-normal"
        onClick={() => chooseAction("expense")}
      >
        <ReceiptText aria-hidden="true" className="size-5" />
        <span>Cargar gasto compartido</span>
      </Button>
      {hasActiveDebt && (
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-14 w-full justify-start gap-3 px-4 py-3 text-left whitespace-normal"
          onClick={() => chooseAction("payment")}
        >
          <ArrowLeftRight aria-hidden="true" className="size-5" />
          <span>Registrar reembolso</span>
        </Button>
      )}
    </div>
  );

  return (
    <>
      <HeaderCreateAction
        label={hasActiveDebt ? "Agregar" : "Agregar gasto"}
        onClick={openActions}
      />
      <FloatingCreateAction label="Agregar a Casa" onClick={openActions} />

      {mobile ? (
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Portal>
            <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40" />
            <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
              <Drawer.Popup className="w-full max-w-xl rounded-t-3xl border border-border bg-card shadow-xl">
                <Drawer.Content className="space-y-3 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                  <Drawer.Title className="text-lg font-semibold">Agregar a Casa</Drawer.Title>
                  <Drawer.Description className="text-sm text-muted-foreground">
                    Elegí qué querés registrar.
                  </Drawer.Description>
                  {choices}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
            <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-2xl border border-border bg-card p-6 shadow-xl">
              <Dialog.Title className="text-lg font-semibold">Agregar a Casa</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Elegí qué querés registrar.
              </Dialog.Description>
              {choices}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
