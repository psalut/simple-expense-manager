CREATE TABLE "shared_space_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_space_id" text NOT NULL,
	"inviter_user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_space_members" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_space_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"user_id" text,
	"shared_space_id" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_owner_xor_shared_space_check" CHECK (("categories"."user_id" IS NOT NULL AND "categories"."shared_space_id" IS NULL) OR ("categories"."user_id" IS NULL AND "categories"."shared_space_id" IS NOT NULL)),
	CONSTRAINT "categories_name_valid_check" CHECK (char_length(btrim("categories"."name")) BETWEEN 1 AND 80),
	CONSTRAINT "categories_description_valid_check" CHECK (char_length(btrim("categories"."description")) BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "shared_space_invitations" ADD CONSTRAINT "shared_space_invitations_shared_space_id_shared_spaces_id_fk" FOREIGN KEY ("shared_space_id") REFERENCES "public"."shared_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_space_invitations" ADD CONSTRAINT "shared_space_invitations_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_space_members" ADD CONSTRAINT "shared_space_members_shared_space_id_shared_spaces_id_fk" FOREIGN KEY ("shared_space_id") REFERENCES "public"."shared_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_space_members" ADD CONSTRAINT "shared_space_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_shared_space_id_shared_spaces_id_fk" FOREIGN KEY ("shared_space_id") REFERENCES "public"."shared_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shared_space_invitations_token_hash_unique" ON "shared_space_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "shared_space_invitations_space_id_idx" ON "shared_space_invitations" USING btree ("shared_space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_space_members_space_user_unique" ON "shared_space_members" USING btree ("shared_space_id","user_id");--> statement-breakpoint
CREATE INDEX "shared_space_members_space_id_idx" ON "shared_space_members" USING btree ("shared_space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_active_name_unique" ON "categories" USING btree (lower(btrim("name")),"user_id") WHERE "categories"."is_archived" = false AND "categories"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_shared_active_name_unique" ON "categories" USING btree (lower(btrim("name")),"shared_space_id") WHERE "categories"."is_archived" = false AND "categories"."shared_space_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "categories_user_archived_idx" ON "categories" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "categories_shared_space_archived_idx" ON "categories" USING btree ("shared_space_id","is_archived");