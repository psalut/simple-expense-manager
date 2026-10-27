import "server-only";

import {
  AccountAccessDeniedError,
  AuthenticationRequiredError,
} from "@/lib/server/authenticated-user";
import { ExpenseError } from "@/lib/server/expenses";
import { measureServerWork } from "@/lib/server/performance";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

export async function privateAppDataRoute<T>(
  label: string,
  load: () => Promise<T>,
) {
  return measureServerWork(`request.${label}`, async () => {
    try {
      return Response.json(await load(), { headers: privateHeaders });
    } catch (error) {
      if (error instanceof AccountAccessDeniedError) {
        return Response.json(
          { error: "No tenés acceso a esta cuenta." },
          { status: 403, headers: privateHeaders },
        );
      }
      if (error instanceof AuthenticationRequiredError) {
        return Response.json(
          { error: "Necesitás iniciar sesión." },
          { status: 401, headers: privateHeaders },
        );
      }
      if (error instanceof ExpenseError) {
        return Response.json(
          { error: "No tenés acceso a estos datos." },
          { status: 403, headers: privateHeaders },
        );
      }

      console.error(`[app-data] request failed: ${label}`);
      return Response.json(
        { error: "No se pudieron cargar los datos." },
        { status: 500, headers: privateHeaders },
      );
    }
  });
}
