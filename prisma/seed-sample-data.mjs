#!/usr/bin/env node
/**
 * Seeds realistic sample data onto the `template-2026` campaign:
 *   - ~80 distribution recipients across a mix of locations / roles / EMT
 *   - Invited-only, in-progress (draft), and completed states
 *   - Completed rows include ResponseItems keyed off the schema's active
 *     questions so /admin/campaigns/.../reporting has something to show
 *
 * Idempotent: every sample row is tagged with `example.sample+N@fhchc.local`
 * so reruns first clear prior sample rows before recreating them.
 *
 * Usage (from repo root):
 *   docker compose exec app node prisma/seed-sample-data.mjs
 * Or inside the running container's shell:
 *   node prisma/seed-sample-data.mjs
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const CAMPAIGN_ID = process.env.SAMPLE_CAMPAIGN_ID || "template-2026";
const SAMPLE_EMAIL_DOMAIN = "example.sample.fhchc.local"; // tag to safely wipe

const LOCATIONS = [
  { code: "bella_vista", rollup: "bella_vista", label: "Bella Vista" },
  { code: "grand_ave_50", rollup: "grand_ave", label: "50 Grand Ave Medical/Midwifery" },
  { code: "dental_grand", rollup: "grand_ave", label: "Dental Office (Grand Avenue)" },
  { code: "grand_ave_374a", rollup: "grand_ave", label: "374 Grand Ave, Building A" },
  { code: "grand_ave_374b", rollup: "grand_ave", label: "374 Grand Ave, Building B" },
  { code: "sargent_150", rollup: "sargent", label: "150 Sargent Drive" },
  { code: "fair_haven_hs", rollup: "schools", label: "Fair Haven High School" },
  { code: "wilbur_cross", rollup: "schools", label: "Wilbur Cross" },
  { code: "mobile", rollup: "mobile_unit", label: "Mobile Unit" },
];

const ROLES = [
  "Registered Nurse (RN)",
  "Physician",
  "Advanced Practice Provider",
  "Clinical support staff",
  "Administrative / Operations",
  "Leadership / Management",
];

const RANDOM_SEED = 0xbe710;
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function hashToken(raw) {
  const pepper = process.env.INVITE_TOKEN_PEPPER || "dev_pepper_32_chars_minimum_seed_ok";
  return crypto.createHmac("sha256", pepper).update(raw).digest("hex");
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Build a fake but reasonable answer for a question, based on its responseType. */
function answerFor(question, rand) {
  const opts = question.optionsJson ?? {};
  switch (question.responseType) {
    case "slider": {
      if (opts.items && Array.isArray(opts.items)) {
        const out = {};
        for (const it of opts.items) {
          // Center around 62 with +/- 25 variance
          out[it.key] = Math.max(0, Math.min(100, Math.round(62 + (rand() - 0.5) * 50)));
        }
        return { json: out };
      }
      return { numeric: Math.round(50 + (rand() - 0.5) * 60) };
    }
    case "single_select": {
      const options = opts.options ?? [];
      if (!options.length) return null;
      // Skew toward favorable answers (~70% one of top two)
      const favorable = options.slice(0, 2);
      const pool = rand() < 0.7 ? favorable : options;
      const value = pool[Math.floor(rand() * pool.length)];
      return { text: value };
    }
    case "multi_select": {
      const options = opts.options ?? [];
      if (!options.length) return null;
      const picks = options.filter(() => rand() < 0.35);
      const selected = picks.length ? picks : [options[0]];
      return { json: { selected, other_text: "" } };
    }
    case "open_text":
      if (rand() > 0.35) return null; // many skip
      return {
        text: pick(rand, [
          "I appreciate how supportive my team has been.",
          "More communication from leadership on change would help.",
          "Staffing ratios continue to be a pain point.",
          "I feel pride in the work we do for our community.",
          "Recognition for behind-the-scenes contributions would go a long way.",
        ]),
      };
    case "likert_grid": {
      const scale = opts.scale ?? [];
      const statements = opts.statements ?? [];
      if (!statements.length || !scale.length) return null;
      const out = {};
      for (const s of statements) {
        // Skew favorable: last two options chosen ~65%
        const favorable = scale.slice(-2);
        const pool = rand() < 0.65 ? favorable : scale;
        out[s.key] = pool[Math.floor(rand() * pool.length)];
      }
      return { json: out };
    }
    case "numeric":
      return { numeric: Math.round(rand() * 40) };
    case "date":
      return { text: daysAgo(Math.floor(rand() * 365)).toISOString().slice(0, 10) };
    case "ranking": {
      const options = opts.options ?? [];
      if (!options.length) return null;
      const order = [...options].sort(() => rand() - 0.5);
      return { json: { order: order.slice(0, opts.topN ?? order.length) } };
    }
    default:
      return null;
  }
}

async function wipeExisting(campaignId) {
  // Identify sample recipients by tagged email
  const sampleRecipients = await prisma.distributionRecipient.findMany({
    where: { campaignId, email: { contains: SAMPLE_EMAIL_DOMAIN } },
    select: { id: true, inviteTokenHash: true },
  });
  if (sampleRecipients.length === 0) {
    return { wipedRecipients: 0, wipedResponses: 0, wipedDrafts: 0 };
  }
  const tokenHashes = sampleRecipients.map((r) => r.inviteTokenHash);

  // Delete drafts linked to these tokens
  const wipedDrafts = await prisma.responseDraft.deleteMany({
    where: { inviteTokenHash: { in: tokenHashes } },
  });
  // Delete responses created FROM these drafts (match by anonymousSessionId
  // via any leftover drafts isn't possible — instead delete responses tagged
  // with `is_test_data = false` AND whose `anonymous_session_id` starts with
  // our sample prefix). We just tag sample sessions with a stable prefix.
  const wipedResponses = await prisma.response.deleteMany({
    where: { campaignId, anonymousSessionId: { startsWith: "sample_" } },
  });
  // Delete the sample recipients themselves
  const wipedRecipients = await prisma.distributionRecipient.deleteMany({
    where: { id: { in: sampleRecipients.map((r) => r.id) } },
  });
  return {
    wipedRecipients: wipedRecipients.count,
    wipedResponses: wipedResponses.count,
    wipedDrafts: wipedDrafts.count,
  };
}

async function main() {
  const campaign = await prisma.campaign.findUnique({
    where: { id: CAMPAIGN_ID },
    select: { id: true, name: true, status: true },
  });
  if (!campaign) {
    throw new Error(
      `Campaign '${CAMPAIGN_ID}' not found. Run prisma/seed.ts first, then re-run this.`
    );
  }
  console.log(`Target campaign: ${campaign.name} (${campaign.id}, status=${campaign.status})`);

  const wiped = await wipeExisting(CAMPAIGN_ID);
  if (wiped.wipedRecipients > 0) {
    console.log(
      `Cleared prior sample data: ${wiped.wipedRecipients} recipients, ` +
        `${wiped.wipedDrafts} drafts, ${wiped.wipedResponses} responses`
    );
  }

  const schema = await prisma.questionSchema.findFirst({
    where: { campaignId: CAMPAIGN_ID },
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        where: { activeStatus: "active" },
        orderBy: [{ sectionKey: "asc" }, { displayOrder: "asc" }],
      },
    },
  });
  const questions = schema?.questions ?? [];
  if (questions.length === 0) {
    console.warn("⚠ No active questions found — recipients will seed but Results will be empty.");
  }

  const rand = rng(RANDOM_SEED);
  const TOTAL = 80;
  // Distribution: 22 invited-only, 15 in-progress drafts, 43 completed
  const plan = [];
  for (let i = 0; i < TOTAL; i++) {
    const role = ROLES[Math.floor(rand() * ROLES.length)];
    const loc = LOCATIONS[Math.floor(rand() * LOCATIONS.length)];
    const isEmtExpected = rand() < 0.12;
    plan.push({
      i,
      email: `example.sample+${String(i + 1).padStart(2, "0")}@${SAMPLE_EMAIL_DOMAIN}`,
      firstName: `Sample${i + 1}`,
      employeeIdentifier: `SAMPLE-${String(1000 + i)}`,
      locationCode: loc.code,
      rollup: loc.rollup,
      roleCode: role.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      role,
      isEmtExpected,
    });
  }

  // Decide state for each
  const INVITED_ONLY_COUNT = 22;
  const IN_PROGRESS_COUNT = 15;
  const COMPLETED_COUNT = TOTAL - INVITED_ONLY_COUNT - IN_PROGRESS_COUNT; // 43

  const shuffled = [...plan].sort(() => rand() - 0.5);
  const invitedOnly = new Set(shuffled.slice(0, INVITED_ONLY_COUNT).map((p) => p.i));
  const inProgress = new Set(
    shuffled.slice(INVITED_ONLY_COUNT, INVITED_ONLY_COUNT + IN_PROGRESS_COUNT).map((p) => p.i)
  );
  // Everyone else = completed

  let recipientCount = 0;
  let draftCount = 0;
  let responseCount = 0;
  let itemCount = 0;

  for (const p of plan) {
    const token = `sample_${crypto.randomBytes(16).toString("hex")}`;
    const hash = hashToken(token);
    const sessionId = `sample_${crypto.randomBytes(12).toString("hex")}`;

    let status = "completed";
    if (invitedOnly.has(p.i)) status = "invited";
    else if (inProgress.has(p.i)) status = "in_progress";

    const inviteSentAt = daysAgo(14 - Math.floor(rand() * 10));
    const lastActivityAt = status === "invited" ? null : daysAgo(Math.max(0, 13 - Math.floor(rand() * 12)));
    const startedAt = status === "invited" ? null : lastActivityAt;
    const completedAt = status === "completed" ? daysAgo(Math.floor(rand() * 10)) : null;

    const recipient = await prisma.distributionRecipient.create({
      data: {
        campaignId: CAMPAIGN_ID,
        email: p.email,
        firstName: p.firstName,
        employeeIdentifier: p.employeeIdentifier,
        locationCode: p.locationCode,
        roleCode: p.roleCode,
        expectedRollupGroup: p.rollup,
        isEmtExpected: p.isEmtExpected,
        inviteTokenHash: hash,
        inviteSentAt,
        startedAt,
        lastActivityAt,
        completedAt,
      },
    });
    recipientCount++;

    if (status === "in_progress" && questions.length > 0) {
      // Partial responses — up to first N% of questions answered
      const answered = {};
      const coverage = 0.25 + rand() * 0.5; // 25–75% answered
      for (const q of questions) {
        if (rand() > coverage) continue;
        const a = answerFor(q, rand);
        if (!a) continue;
        if (a.text !== undefined) answered[q.id] = a.text;
        else if (a.numeric !== undefined) answered[q.id] = a.numeric;
        else if (a.json !== undefined) answered[q.id] = a.json;
      }
      if (Object.keys(answered).length > 0) {
        await prisma.responseDraft.create({
          data: {
            campaignId: CAMPAIGN_ID,
            inviteTokenHash: hash,
            anonymousSessionId: sessionId,
            responseItemsJson: answered,
            sectionProgress: questions[0].sectionKey,
            isEmtFlagged: false,
          },
        });
        draftCount++;
      }
    }

    if (status === "completed" && questions.length > 0) {
      const items = [];
      for (const q of questions) {
        if (!q.required && rand() < 0.3) continue; // some skip optional
        const a = answerFor(q, rand);
        if (!a) continue;
        items.push({
          questionId: q.id,
          valueText: a.text ?? null,
          valueNumber: a.numeric !== undefined ? a.numeric : null,
          valueJson: a.json ?? null,
        });
      }

      await prisma.response.create({
        data: {
          campaignId: CAMPAIGN_ID,
          anonymousSessionId: sessionId,
          submittedAt: completedAt,
          isComplete: true,
          isEmtFlagged: p.isEmtExpected && rand() < 0.6, // ~60% of EMT-expected validated
          emtValidationSource: p.isEmtExpected ? "code" : null,
          respondentLocationCode: p.locationCode,
          respondentRoleCode: p.roleCode,
          respondentRollupGroup: p.rollup,
          isTestData: false,
          isPreview: false,
          items: { create: items },
        },
      });
      responseCount++;
      itemCount += items.length;
    }
  }

  console.log("");
  console.log("Sample data seeded:");
  console.log(`  Recipients       ${recipientCount}`);
  console.log(`    Invited only:  ${INVITED_ONLY_COUNT}`);
  console.log(`    In progress:   ${IN_PROGRESS_COUNT}`);
  console.log(`    Completed:     ${COMPLETED_COUNT}`);
  console.log(`  Drafts created:  ${draftCount}`);
  console.log(`  Responses:       ${responseCount} (${itemCount} items)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
