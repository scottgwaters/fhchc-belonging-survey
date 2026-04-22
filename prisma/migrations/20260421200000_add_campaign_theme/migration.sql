-- Add per-campaign theme + logo (drives respondent-facing palette + branding)
ALTER TABLE "campaigns" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'teal';
ALTER TABLE "campaigns" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "logo_alt" TEXT;
