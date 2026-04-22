-- Per-campaign welcome page copy overrides (trust cards + principles)
ALTER TABLE "campaigns" ADD COLUMN "welcome_copy_json" JSONB;
