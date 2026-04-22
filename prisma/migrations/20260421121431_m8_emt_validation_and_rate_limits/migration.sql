-- AlterTable
ALTER TABLE "response_drafts" ADD COLUMN     "emt_attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emt_locked_at" TIMESTAMP(3),
ADD COLUMN     "emt_validation_source" TEXT,
ADD COLUMN     "is_emt_flagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "rate_limit_attempts" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_attempts_bucket_attempted_at_idx" ON "rate_limit_attempts"("bucket", "attempted_at");
