CREATE TABLE "household_payments" (
 "id" text PRIMARY KEY NOT NULL,
 "shared_space_id" text NOT NULL REFERENCES "shared_spaces"("id") ON DELETE RESTRICT,
 "payer_user_id" text NOT NULL,
 "receiver_user_id" text NOT NULL,
 "created_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
 "amount_cents" bigint NOT NULL CHECK ("amount_cents" > 0),
 "currency" text DEFAULT 'ARS' NOT NULL CHECK ("currency" = 'ARS'),
 "payment_date" date NOT NULL,
 "note" text CHECK ("note" IS NULL OR char_length("note") <= 200),
 "idempotency_key" text NOT NULL,
 "created_at" timestamp DEFAULT now() NOT NULL,
 "voided_at" timestamp,
 "voided_by_user_id" text REFERENCES "user"("id") ON DELETE RESTRICT,
 CONSTRAINT "household_payments_different_members" CHECK ("payer_user_id" <> "receiver_user_id"),
 CONSTRAINT "household_payments_void_pair" CHECK (("voided_at" IS NULL) = ("voided_by_user_id" IS NULL)),
 CONSTRAINT "household_payments_payer_member_fk" FOREIGN KEY ("shared_space_id", "payer_user_id") REFERENCES "shared_space_members"("shared_space_id", "user_id") ON DELETE RESTRICT,
 CONSTRAINT "household_payments_receiver_member_fk" FOREIGN KEY ("shared_space_id", "receiver_user_id") REFERENCES "shared_space_members"("shared_space_id", "user_id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX "household_payments_idempotency_idx" ON "household_payments" ("shared_space_id", "created_by_user_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX "household_payments_space_date_idx" ON "household_payments" ("shared_space_id", "payment_date");
