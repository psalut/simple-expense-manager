import type { ReactNode } from "react";
import { AccountMenu } from "@/components/auth/account-menu";
import type { AuthenticatedUserProfile } from "@/lib/server/authenticated-user";

export function SectionHeading({
  title,
  account,
  actions,
}: {
  title: string;
  account: Pick<AuthenticatedUserProfile, "name" | "email">;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <div className="md:hidden">
            <AccountMenu name={account.name} email={account.email} />
          </div>
        </div>
      </div>
    </header>
  );
}
