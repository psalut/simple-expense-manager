import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAccountAllowed } from "@/lib/server/household";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Necesitás iniciar sesión.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AccountAccessDeniedError extends AuthenticationRequiredError {
  constructor() {
    super();
    this.name = "AccountAccessDeniedError";
  }
}

export type AuthenticatedUserProfile = {
  id: string;
  name: string;
  email: string;
};

export const getAuthenticatedSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export const getAuthenticatedUserProfile = cache(async (): Promise<AuthenticatedUserProfile> => {
  const session = await getAuthenticatedSession();
  if (!session?.user?.id) throw new AuthenticationRequiredError();
  if (!(await isAccountAllowed(session.user.id))) throw new AccountAccessDeniedError();

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
});

export async function getAuthenticatedUserId(): Promise<string> {
  return (await getAuthenticatedUserProfile()).id;
}
