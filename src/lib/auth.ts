import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isAccountAllowed, isRegistrationClosed } from "@/lib/server/household";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: isRegistrationClosed(),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (!(await isAccountAllowed(session.userId))) return false;
          return { data: session };
        },
      },
    },
  },
});
