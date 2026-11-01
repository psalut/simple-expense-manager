ALTER TABLE "categories" DROP CONSTRAINT "categories_description_valid_check";
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_description_valid_check" CHECK (char_length(trim(regexp_replace("categories"."description", '[[:space:]]+', ' ', 'g'))) BETWEEN 1 AND 1000);
