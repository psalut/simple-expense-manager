-- Apply only after the owner has resolved historical groups. This migration never
-- deletes, merges, renames or reassigns data. An incompatible database aborts.
DO $$
BEGIN
  IF (SELECT count(*) FROM shared_spaces) > 1 OR EXISTS (SELECT 1 FROM shared_spaces WHERE name <> 'Casa') THEN
    RAISE EXCEPTION 'Household transition pending: resolve historical groups before applying 0001.';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX "shared_spaces_single_household_unique" ON "shared_spaces" USING btree ((true));--> statement-breakpoint
ALTER TABLE "shared_spaces" ADD CONSTRAINT "shared_spaces_household_name_check" CHECK ("shared_spaces"."name" = 'Casa');