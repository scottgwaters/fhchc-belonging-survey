-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "theme_config_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_at" TIMESTAMP(3),
    "visible_close_at" TIMESTAMP(3),
    "token_expires_at" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "intro_copy" TEXT,
    "invitation_copy" TEXT,
    "reminder_copy_json" JSONB,
    "anonymity_threshold" INTEGER NOT NULL DEFAULT 5,
    "emt_code_hash" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "template_source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_status_log" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "previous_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_schemas" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "version_name" TEXT NOT NULL,
    "schema_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT NOT NULL,
    "metric_code" TEXT,
    "section_key" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "help_text" TEXT,
    "response_type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options_json" JSONB,
    "parent_question_id" TEXT,
    "show_if_parent_value" TEXT,
    "reverse_score" BOOLEAN NOT NULL DEFAULT false,
    "reporting_config_json" JSONB,
    "active_status" TEXT NOT NULL DEFAULT 'active',
    "comparable_to_prior" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_edit_history" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "field_changed" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by_user_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "employee_identifier" TEXT,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "location_code" TEXT,
    "role_code" TEXT,
    "expected_rollup_group" TEXT,
    "is_emt_expected" BOOLEAN NOT NULL DEFAULT false,
    "invite_token_hash" TEXT NOT NULL,
    "invite_sent_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "bounce_status" TEXT,
    "bounce_reason" TEXT,
    "email_updated_at" TIMESTAMP(3),
    "original_email" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distribution_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_sends" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "reminder_offset" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "anonymous_session_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "is_emt_flagged" BOOLEAN NOT NULL DEFAULT false,
    "emt_validation_source" TEXT,
    "anomaly_flag_json" JSONB,
    "respondent_location_code" TEXT,
    "respondent_role_code" TEXT,
    "respondent_rollup_group" TEXT,
    "is_test_data" BOOLEAN NOT NULL DEFAULT false,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_items" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "value_text" TEXT,
    "value_number" DECIMAL(10,2),
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_drafts" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "invite_token_hash" TEXT NOT NULL,
    "anonymous_session_id" TEXT NOT NULL,
    "response_items_json" JSONB NOT NULL,
    "section_progress" TEXT,
    "last_saved_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_rollups" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "raw_group_code" TEXT NOT NULL,
    "raw_group_label" TEXT NOT NULL,
    "parent_group_code" TEXT NOT NULL,
    "parent_group_label" TEXT NOT NULL,
    "suppress_if_below_threshold" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "org_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_url" TEXT,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "distribution_recipients_invite_token_hash_key" ON "distribution_recipients"("invite_token_hash");

-- CreateIndex
CREATE INDEX "distribution_recipients_campaign_id_idx" ON "distribution_recipients"("campaign_id");

-- CreateIndex
CREATE INDEX "distribution_recipients_email_idx" ON "distribution_recipients"("email");

-- CreateIndex
CREATE INDEX "reminder_sends_campaign_id_idx" ON "reminder_sends"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_sends_campaign_id_recipient_id_reminder_offset_key" ON "reminder_sends"("campaign_id", "recipient_id", "reminder_offset");

-- CreateIndex
CREATE UNIQUE INDEX "responses_anonymous_session_id_key" ON "responses"("anonymous_session_id");

-- CreateIndex
CREATE INDEX "responses_campaign_id_idx" ON "responses"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "response_items_response_id_question_id_key" ON "response_items"("response_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "response_drafts_invite_token_hash_key" ON "response_drafts"("invite_token_hash");

-- CreateIndex
CREATE INDEX "response_drafts_campaign_id_idx" ON "response_drafts"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_rollups_campaign_id_raw_group_code_key" ON "org_rollups"("campaign_id", "raw_group_code");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_source_id_fkey" FOREIGN KEY ("template_source_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_status_log" ADD CONSTRAINT "campaign_status_log_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_status_log" ADD CONSTRAINT "campaign_status_log_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_schemas" ADD CONSTRAINT "question_schemas_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "question_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_parent_question_id_fkey" FOREIGN KEY ("parent_question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_edit_history" ADD CONSTRAINT "question_edit_history_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_edit_history" ADD CONSTRAINT "question_edit_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_recipients" ADD CONSTRAINT "distribution_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_sends" ADD CONSTRAINT "reminder_sends_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "distribution_recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_rollups" ADD CONSTRAINT "org_rollups_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "Account_user_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "Session_user_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
