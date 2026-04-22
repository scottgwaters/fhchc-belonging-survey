# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Development Commands

```bash
# Start local database
docker compose up -d

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start dev server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Architecture

- **Framework:** Next.js 16 with App Router
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js with Google OAuth
- **Email:** SendGrid
- **Deployment:** Docker on Dailey OS

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router pages and API routes |
| `src/components/survey/` | Survey question components |
| `src/components/ui/` | Design system components |
| `src/lib/` | Shared utilities (db, auth, email, reporting) |
| `prisma/` | Database schema and migrations |

## Privacy Model (Trusted Separation)

The system tracks completion separately from responses:
- `distribution_recipients` - WHO was invited (has identity, no response data)
- `responses` - WHAT was answered (anonymous, no identity link)

At submission, the token-to-response link is severed. This allows reminders without compromising anonymity.

## Design Tokens

Use the sage palette defined in PRD Section 13A.2:
- Sage: `#8FA287` (accent)
- Background: `#F7F9F7`
- Surface: `#FCFDFC`
- Ink: `#1C1C1C`

## Implementation Status

### Completed (Milestones 1-7)

| Component | File | Notes |
|-----------|------|-------|
| Data Model | `prisma/schema.prisma` | 15 tables (added `reminder_sends`; `distribution_recipients.deleted_at`) |
| Auth Config | `src/lib/auth.ts` | NextAuth: Google OAuth + email/password (CredentialsProvider) |
| Audit Logging | `src/lib/audit.ts` | Tracks admin actions |
| Admin Console | `src/app/admin/*` | Dashboard, users |
| Campaign CRUD | `src/app/admin/campaigns/*`, `src/app/api/admin/campaigns/*` | Create, edit, detail, status transitions, clone — optimistic concurrency (PRD §11 MVP), audit logged |
| Campaign helpers | `src/lib/campaigns.ts`, `src/lib/validation/campaign.ts` | PRD §10.2 transitions, 3-day default token grace (PRD §29), Zod validation |
| Recipient upload | `src/app/api/admin/campaigns/[id]/distribution-upload/route.ts`, `src/lib/csv.ts` | CSV parse + validate per PRD §8.17.2; all-or-nothing; merge/skip on conflict |
| Token issuance | `src/lib/tokens.ts` | HMAC-SHA256 with `INVITE_TOKEN_PEPPER` (PRD §15.3); base64url URL token |
| Invitation send | `src/app/api/admin/campaigns/[id]/send-invites/route.ts`, `src/lib/email.ts` | SendGrid; falls back to stdout logger when no API key (dev) |
| Recipients page | `src/app/admin/campaigns/[id]/recipients/page.tsx` | Upload, table, summary tiles, send-invites action |
| Schema editor | `src/app/admin/campaigns/[id]/schema/page.tsx`, `src/components/admin/QuestionEditor.tsx`, `src/components/admin/SchemaList.tsx`, `src/app/api/admin/campaigns/[id]/schema/questions/**` | Form-based question CRUD with edit-history, conditional follow-ups via parent_question_id, auto-creates schema row if missing |
| Survey landing | `src/app/survey/[token]/page.tsx`, `src/components/survey/TokenLanding.tsx`, `src/lib/survey.ts` | PRD §12.3 states (Welcome / Resume / Already submitted / Invalid + Expired collapsed for anti-enumeration) |
| Survey shell | `src/components/survey/SurveyChrome.tsx`, `src/components/survey/SurveyShell.tsx` | Sticky top nav with Confidential indicator, sage progress bar, sticky bottom Back/Continue, debounced + interval auto-save |
| Question renderer | `src/components/survey/QuestionRenderer.tsx` | 5 input patterns: slider (single + multi-item stack), single_select, multi_select with Other write-in, open_text, conditional follow-up |
| Survey APIs | `src/app/api/survey/session/**` | start (creates draft only — never `responses`), GET state, save (auto-save), submit (atomic transaction per §8.3) |

### Docker

`docker compose up -d --build` brings up the full stack (Postgres + app), runs Prisma migrations, seeds an admin user, and starts Next.js. Default login: `admin@fhchc.local` / `admin1234` (override via `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`). All required pepper secrets and `SENDGRID_API_KEY` are env-overridable; without `SENDGRID_API_KEY` emails are logged to the app container's stdout.

### Remaining (Milestones 8-12)

- EMT Verbal Code Flow + brute-force protection (§8.8 / §15.3.1 / §15.4)
- Reporting Engine (§21) — favorability, reverse scoring, DK floor, suppression
- Excel/CSV Export (§8.12, BR-7)
- Scheduled Reminders (Dailey OS cron at `/api/cron/reminders`)
- Production Deployment + ops docs
