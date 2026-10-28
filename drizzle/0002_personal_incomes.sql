CREATE TABLE "incomes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"description" text NOT NULL,
	"income_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "incomes_amount_positive_check" CHECK ("incomes"."amount_cents" > 0),
	CONSTRAINT "incomes_currency_ars_check" CHECK ("incomes"."currency" = 'ARS'),
	CONSTRAINT "incomes_description_valid_check" CHECK (char_length(btrim("incomes"."description")) BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incomes_user_date_idx" ON "incomes" USING btree ("user_id","income_date");