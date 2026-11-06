"use server";
import { getAuthenticatedUserId, AuthenticationRequiredError } from "@/lib/server/authenticated-user";
import { createHouseholdPayment, voidHouseholdPayment, PaymentError } from "@/lib/server/household-payments";
import type { ActionResult } from "@/lib/action-result";

async function run(operation: (id: string) => Promise<{ id: string }>): Promise<ActionResult<{ id: string }>> {
  try { return { success: true, data: await operation(await getAuthenticatedUserId()) }; }
  catch (error) {
    return { success: false, error: error instanceof PaymentError || error instanceof AuthenticationRequiredError ? error.message : "No se pudo completar la operación. Intentá nuevamente." };
  }
}
export async function createPaymentAction(input: unknown) { return run((id) => createHouseholdPayment(id, input)); }
export async function voidPaymentAction(paymentId: unknown) { return run((id) => voidHouseholdPayment(id, paymentId)); }
