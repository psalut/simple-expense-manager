CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"shared_space_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_space_members_shared_space_id_user_id_pk" PRIMARY KEY("shared_space_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shared_spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"member_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_spaces_member_count_check" CHECK ("shared_spaces"."member_count" BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"color" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_valid_check" CHECK (char_length(trim(regexp_replace("categories"."name", '[[:space:]]+', ' ', 'g'))) BETWEEN 1 AND 60),
	CONSTRAINT "categories_description_valid_check" CHECK (char_length(trim(regexp_replace("categories"."description", '[[:space:]]+', ' ', 'g'))) BETWEEN 1 AND 500),
	CONSTRAINT "categories_color_valid_check" CHECK ("categories"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"description" text NOT NULL,
	"category_id" text NOT NULL,
	"expense_date" date NOT NULL,
	"shared_space_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive_check" CHECK ("expenses"."amount_cents" > 0),
	CONSTRAINT "expenses_currency_ars_check" CHECK ("expenses"."currency" = 'ARS'),
	CONSTRAINT "expenses_description_valid_check" CHECK (char_length(btrim("expenses"."description")) BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_space_invitations" ADD CONSTRAINT "shared_space_invitations_shared_space_id_shared_spaces_id_fk" FOREIGN KEY ("shared_space_id") REFERENCES "public"."shared_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_space_invitations" ADD CONSTRAINT "shared_space_invitations_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_space_members" ADD CONSTRAINT "shared_space_members_shared_space_id_shared_spaces_id_fk" FOREIGN KEY ("shared_space_id") REFERENCES "public"."shared_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_space_members" ADD CONSTRAINT "shared_space_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spaces" ADD CONSTRAINT "shared_spaces_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shared_space_id_shared_spaces_id_fk" FOREIGN KEY ("shared_space_id") REFERENCES "public"."shared_spaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_space_invitations_token_hash_unique" ON "shared_space_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "shared_space_invitations_space_id_idx" ON "shared_space_invitations" USING btree ("shared_space_id");--> statement-breakpoint
CREATE INDEX "shared_space_members_space_id_idx" ON "shared_space_members" USING btree ("shared_space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_active_name_unique" ON "categories" USING btree (lower(trim(regexp_replace("name", '[[:space:]]+', ' ', 'g')))) WHERE "categories"."is_archived" = false;--> statement-breakpoint
CREATE INDEX "categories_archived_idx" ON "categories" USING btree ("is_archived","name");--> statement-breakpoint
CREATE INDEX "expenses_user_date_idx" ON "expenses" USING btree ("user_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_shared_space_date_idx" ON "expenses" USING btree ("shared_space_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_shared_space_member_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE shared_spaces
  SET member_count = member_count + 1
  WHERE id = NEW.shared_space_id
    AND member_count < 2;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A shared group cannot have more than two members.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'shared_space_member_limit';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shared_space_members_enforce_limit
BEFORE INSERT ON shared_space_members
FOR EACH ROW
EXECUTE FUNCTION enforce_shared_space_member_limit();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION decrement_shared_space_member_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE shared_spaces
  SET member_count = member_count - 1
  WHERE id = OLD.shared_space_id
    AND member_count > 0;

  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shared_space_members_decrement_count
AFTER DELETE ON shared_space_members
FOR EACH ROW
EXECUTE FUNCTION decrement_shared_space_member_count();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_shared_space_member_identity_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.shared_space_id IS DISTINCT FROM OLD.shared_space_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Shared group membership cannot be transferred.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'shared_space_membership_immutable';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shared_space_members_prevent_identity_change
BEFORE UPDATE OF shared_space_id, user_id ON shared_space_members
FOR EACH ROW
EXECUTE FUNCTION prevent_shared_space_member_identity_change();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_removing_member_with_expense_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expenses
    WHERE shared_space_id = OLD.shared_space_id
  ) THEN
    RAISE EXCEPTION 'A member cannot leave a group with shared expense history.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'shared_space_membership_expense_history';
  END IF;

  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shared_space_members_preserve_expense_history
BEFORE DELETE ON shared_space_members
FOR EACH ROW
EXECUTE FUNCTION prevent_removing_member_with_expense_history();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_expense_category_and_group()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_is_archived boolean;
  category_changed boolean;
  group_member_count smallint;
  author_is_member boolean;
BEGIN
  category_changed := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    category_changed := NEW.category_id IS DISTINCT FROM OLD.category_id;
  END IF;

  SELECT is_archived
  INTO category_is_archived
  FROM categories
  WHERE id = NEW.category_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense category does not exist.'
      USING ERRCODE = '23503',
            CONSTRAINT = 'expenses_category_id_categories_id_fk';
  END IF;

  IF category_is_archived AND category_changed THEN
    RAISE EXCEPTION 'A new expense assignment must use an active category.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'expenses_category_active_check';
  END IF;

  IF NEW.shared_space_id IS NOT NULL THEN
    SELECT member_count
    INTO group_member_count
    FROM shared_spaces
    WHERE id = NEW.shared_space_id;

    IF NOT FOUND OR group_member_count <> 2 THEN
      RAISE EXCEPTION 'Shared expenses require a complete two-member group.'
        USING ERRCODE = '23514',
              CONSTRAINT = 'expenses_shared_space_membership_check';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM shared_space_members
      WHERE shared_space_id = NEW.shared_space_id
        AND user_id = NEW.user_id
    )
    INTO author_is_member;

    IF NOT author_is_member THEN
      RAISE EXCEPTION 'The expense author must belong to the selected group.'
        USING ERRCODE = '23514',
              CONSTRAINT = 'expenses_shared_space_membership_check';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER expenses_enforce_category_and_group
BEFORE INSERT OR UPDATE OF category_id, shared_space_id, user_id ON expenses
FOR EACH ROW
EXECUTE FUNCTION enforce_expense_category_and_group();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_shared_space_member_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.member_count := 0;
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Group member count is maintained by membership triggers.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'shared_spaces_member_count_managed';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shared_spaces_protect_member_count
BEFORE INSERT OR UPDATE OF member_count ON shared_spaces
FOR EACH ROW
EXECUTE FUNCTION protect_shared_space_member_count();
