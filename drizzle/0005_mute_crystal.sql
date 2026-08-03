ALTER TABLE "brand_profiles" ADD COLUMN "mission_html" text;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "audience_html" text;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "prism_html" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "body_html" text;