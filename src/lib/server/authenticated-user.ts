import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Necesitás iniciar sesión.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getAuthenticatedUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new AuthenticationRequiredError();
  return session.user.id;
}
