import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const sharedSpaces = pgTable("shared_spaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sharedSpaceMembers = pgTable(
  "shared_space_members",
  {
    id: text("id").primaryKey(),
    sharedSpaceId: text("shared_space_id")
      .notNull()
      .references(() => sharedSpaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shared_space_members_space_user_unique").on(
      table.sharedSpaceId,
      table.userId,
    ),
    index("shared_space_members_space_id_idx").on(table.sharedSpaceId),
  ],
);

export const sharedSpaceInvitations = pgTable(
  "shared_space_invitations",
  {
    id: text("id").primaryKey(),
    sharedSpaceId: text("shared_space_id")
      .notNull()
      .references(() => sharedSpaces.id, { onDelete: "cascade" }),
    inviterUserId: text("inviter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shared_space_invitations_token_hash_unique").on(
      table.tokenHash,
    ),
    index("shared_space_invitations_space_id_idx").on(table.sharedSpaceId),
  ],
);

export const sharedSpaceMembersRelations = relations(
  sharedSpaceMembers,
  ({ one }) => ({
    sharedSpace: one(sharedSpaces, {
      fields: [sharedSpaceMembers.sharedSpaceId],
      references: [sharedSpaces.id],
    }),
    user: one(user, {
      fields: [sharedSpaceMembers.userId],
      references: [user.id],
    }),
  }),
);
