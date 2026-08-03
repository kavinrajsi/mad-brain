ALTER TABLE "brand_profiles" ADD COLUMN "prism" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "rules" jsonb DEFAULT '[]'::jsonb;