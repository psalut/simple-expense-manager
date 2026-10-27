import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAccountAllowed } from "@/lib/server/household";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Necesitás iniciar sesión.");
    this.name = "AuthenticationRequiredError";
  }
}

export type AuthenticatedUserProfile = {
  id: string;
  name: string;
  email: string;
};

export async function getAuthenticatedUserProfile(): Promise<AuthenticatedUserProfile> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new AuthenticationRequiredError();
  if (!(await isAccountAllowed(session.user.id))) throw new AuthenticationRequiredError();

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

export async function getAuthenticatedUserId(): Promise<string> {
  return (await getAuthenticatedUserProfile()).id;
}
