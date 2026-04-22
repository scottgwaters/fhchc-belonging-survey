// Seeds the full FHCHC 2026 questionnaire from
// "Resources/2. FHCHC Employee Survey Questionnaire 2026 (Final).rtfd"
// into the FHCHC template campaign's active question_schemas row.
//
// Idempotent: clears existing questions in the target schema first, then
// re-inserts. Safe to re-run during dev — but DO NOT run against a campaign
// that already has responses (it would orphan response_items via cascade).
//
// Run via:
//   docker compose exec app node prisma/seed-questionnaire.mjs
// or locally:
//   node prisma/seed-questionnaire.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// Section definitions (display ordering implied by question.displayOrder)
// ----------------------------------------------------------------------------

const SECTIONS = {
  wellbeing: "wellbeing",
  experience_12mo: "experience_12mo",
  experience_1mo: "experience_1mo",
  agreement: "agreement",
  reflections: "reflections",
  about_you: "about_you",
};

const FREQ_3 = ["Never", "1 or 2 times", "Multiple times"];
const FREQ_4 = ["Never", "1 or 2 times", "Weekly", "Daily or almost"];
const AGREE_5 = [
  "Strongly DISAGREE",
  "Disagree",
  "Agree",
  "Strongly AGREE",
  "Don't Know",
];
const AGREE_4 = ["Strongly DISAGREE", "Disagree", "Agree", "Strongly AGREE"];

// ----------------------------------------------------------------------------
// Question definitions
//
// Each entry produces ONE row in `questions`. Multi-item agreement matrices
// are flattened into one row per item per the PRD's "no matrix on mobile" rule
// (§13A.7) — each becomes a standalone radio card.
// ----------------------------------------------------------------------------

const QUESTIONS = [
  // -------------------- Q1: Emotion slider stack (10 items) -----------------
  {
    metricCode: "wellbeing.emotions",
    sectionKey: SECTIONS.wellbeing,
    displayOrder: 10,
    prompt:
      "We want to know how you feel about your work. Over the LAST FEW MONTHS, how often have you felt each of these about your work?",
    helpText:
      "Consider your daily role, team, patients, supervisor, and the organization's processes and culture. 0 = not at all, 100 = very strongly.",
    responseType: "slider",
    required: true,
    optionsJson: {
      min: 0,
      max: 100,
      minLabel: "Not at all",
      maxLabel: "Very strongly",
      items: [
        {
          key: "safe",
          label: "Safe",
          info: "Feeling welcomed and comfortable sharing thoughts, ideas and values without fear of retribution.",
        },
        {
          key: "worried",
          label: "Worried",
          info: "Feeling uneasy or concerned about potential outcomes, often anticipating problems or uncertainty about what might happen next.",
        },
        {
          key: "respected",
          label: "Respected",
          info: "Feeling accepted and being treated fairly and with dignity.",
        },
        {
          key: "frustrated",
          label: "Frustrated",
          info: "Feeling blocked or hindered from achieving goals or expectations, often leading to irritation or discouragement.",
        },
        {
          key: "connected",
          label: "Connected",
          info: "Feeling a sense of belonging, having meaningful interactions with co-workers, supervisors, and leaders, and feeling aligned to the organization's values.",
        },
        {
          key: "stressed",
          label: "Stressed",
          info: "Feeling mentally or physically overwhelmed when demands or pressures exceed the ability to cope or focus.",
        },
        {
          key: "acknowledged",
          label: "Acknowledged",
          info: "Feeling seen and valued and being recognized for your unique contributions.",
        },
        {
          key: "disrespected",
          label: "Disrespected",
          info: "Feeling dismissed, undervalued, or treated without consideration, dignity, or fairness.",
        },
        {
          key: "supported",
          label: "Supported",
          info: "Feeling that you are provided what is needed to get the work done and achieve your potential, while having a healthy work-life balance.",
        },
        {
          key: "empowered",
          label: "Empowered",
          info: "Feeling involved, with a sense of purpose and confidence contributing towards achieving the organization's vision.",
        },
      ],
    },
    reverseScore: false, // per-item polarity is handled in reporting via metric_code suffixes
    reportingConfigJson: {
      favorableThreshold: 60,
      perItemReverse: ["worried", "frustrated", "stressed", "disrespected"],
    },
  },

  // -------------------- Q2: Open text reflection on Q1 ----------------------
  {
    metricCode: "wellbeing.emotions.why",
    sectionKey: SECTIONS.wellbeing,
    displayOrder: 20,
    prompt:
      "Can you share a few reasons about why you responded this way to the first question?",
    helpText:
      "We read and review every comment and delete information that may identify you.",
    responseType: "open_text",
    required: false,
  },

  // -------------------- Q3-Q9: Last 12 months frequency ---------------------
  {
    metricCode: "exp12.unsafe",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 10,
    prompt:
      "During the last 12 MONTHS how often did you feel unsafe (uncomfortable sharing thoughts, ideas and disagreements without fear of retribution) during an interaction with someone at work?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_3, sensitive: true },
    reverseScore: true,
  },
  {
    metricCode: "exp12.team_connect",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 20,
    prompt:
      "During the last 12 MONTHS how often did your team connect informally to get to know each other better?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_3 },
    reverseScore: false,
  },
  {
    metricCode: "exp12.emt_recognize",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 30,
    prompt:
      "During the last 12 MONTHS how often did a member of EMT recognize you/your team for your/their contributions?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_3 },
    reverseScore: false,
  },
  {
    metricCode: "exp12.coworker_support",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 40,
    prompt:
      "During the last 12 MONTHS how often did you feel supported by your co-workers?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_3 },
    reverseScore: false,
  },
  {
    metricCode: "exp12.implement_ideas",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 50,
    prompt:
      "During the last 12 MONTHS how often did you have the opportunity to implement your ideas to achieve an important goal?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_3 },
    reverseScore: false,
  },
  {
    metricCode: "exp12.supervisor_overwork",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 60,
    prompt:
      "During the last 12 MONTHS how often did your immediate supervisor step in to help your team to prevent members from being overworked?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_3 },
    reverseScore: false,
  },
  // Q9 — parent of conditional Q10
  {
    key: "q9_witnessed",
    metricCode: "exp12.harassment_witnessed",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 70,
    prompt:
      "During the last 12 MONTHS how often did you experience or witness harassment or other form of misconduct at work?",
    responseType: "single_select",
    required: true,
    optionsJson: {
      options: FREQ_3,
      sensitive: true,
      reassurance:
        "This is a sensitive question. Skip it if you'd rather — your survey still submits.",
    },
    reverseScore: true,
  },
  // Q10 — follow-up: shown only when Q9 != "Never"
  {
    metricCode: "exp12.harassment_reported",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 75,
    prompt:
      "I, or someone else, made an official complaint or report of the harassment or misconduct.",
    helpText:
      "Shown because you indicated above that you experienced or witnessed something.",
    responseType: "single_select",
    required: false,
    optionsJson: { options: ["Yes", "No", "Don't know"] },
    parentKey: "q9_witnessed",
    showIfParentValue: "1 or 2 times",
  },
  // Also branch for "Multiple times" — second clone with same prompt
  {
    metricCode: "exp12.harassment_reported_multi",
    sectionKey: SECTIONS.experience_12mo,
    displayOrder: 76,
    prompt:
      "I, or someone else, made an official complaint or report of the harassment or misconduct.",
    helpText:
      "Shown because you indicated above that you experienced or witnessed something.",
    responseType: "single_select",
    required: false,
    optionsJson: { options: ["Yes", "No", "Don't know"] },
    parentKey: "q9_witnessed",
    showIfParentValue: "Multiple times",
  },

  // -------------------- Q11-Q19: Last 1 month frequency ---------------------
  {
    metricCode: "exp1mo.different_view",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 10,
    prompt:
      "In the LAST 1 MONTH or so at work how often did you express a different point of view to your immediate supervisor?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },
  {
    metricCode: "exp1mo.interrupted",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 20,
    prompt:
      "In the LAST 1 MONTH or so at work how often did someone interrupt you or talk over you in a meeting?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
    reverseScore: true,
  },
  {
    metricCode: "exp1mo.supervisor_opinion",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 30,
    prompt:
      "In the LAST 1 MONTH or so at work how often did your immediate supervisor ask you for your opinion on an important topic?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },
  {
    metricCode: "exp1mo.positive_coworker",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 40,
    prompt:
      "In the LAST 1 MONTH or so at work how often did you have a positive, meaningful interaction with a co-worker(s)?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },
  {
    metricCode: "exp1mo.supervisor_thanks",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 50,
    prompt:
      "In the LAST 1 MONTH or so at work how often did your immediate supervisor thank you (email, in-person, call)?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },
  {
    metricCode: "exp1mo.constructive_feedback",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 60,
    prompt:
      "In the LAST 1 MONTH or so at work how often did you receive helpful constructive feedback on your work?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },
  {
    metricCode: "exp1mo.team_decision",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 70,
    prompt:
      "In the LAST 1 MONTH or so at work how often were you involved in your team's decision-making process?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },
  {
    metricCode: "exp1mo.accepted_team",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 80,
    prompt:
      "In the LAST 1 MONTH or so at work how often did you feel accepted and valued in your team?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },
  {
    metricCode: "exp1mo.offered_support",
    sectionKey: SECTIONS.experience_1mo,
    displayOrder: 90,
    prompt:
      "In the LAST 1 MONTH or so at work how often did you offer to support a co-worker?",
    responseType: "single_select",
    required: true,
    optionsJson: { options: FREQ_4 },
  },

  // -------------------- Q20: 5-point agreement matrix (with Don't Know) -----
  ...[
    ["agree.share_thoughts", "Our work culture makes me feel comfortable sharing my thoughts, ideas, and values without fear of negative consequences.", false],
    ["agree.emt_communications", "The Executive Management Team's (EMT) communications are genuine and transparent.", false],
    ["agree.disconnected_vision", "I feel disconnected from the organization's current vision and values.", true],
    ["agree.emt_input", "Members of EMT solicit and act on employees' input.", false],
    ["agree.supervisor_wellbeing", "My immediate supervisor cares about my well-being.", false],
    ["agree.learn_skills", "I have opportunities to learn and apply new skills.", false],
    ["agree.report_unethical", "The organization encourages people to report abusive or unethical behavior.", false],
    ["agree.accountability", "People are held accountable for \"bad\" behavior regardless of their title or performance.", false],
    ["agree.supervisor_respect", "My immediate supervisor treats people with respect and dignity.", false],
    ["agree.cross_team_connection", "The organization fosters connections and collaboration across teams.", false],
    ["agree.promotions_acknowledge", "Promotions acknowledge people's work contributions.", false],
    ["agree.unsupported", "I don't feel supported or have the necessary resources to meet my job expectations.", true],
    ["agree.contributes_success", "My work contributes to the success of FHCHC.", false],
    ["agree.emt_visible", "Members of EMT are visible.", false],
    ["agree.emt_approachable", "Members of EMT are accessible and approachable.", false],
    ["agree.cross_dept_collab", "Our people collaborate well across departments and functions.", false],
    ["agree.excellent_service", "I feel like we provide excellent customer service.", false],
    ["agree.qi_goals_known", "Quality improvement goals are known throughout the organization.", false],
    ["agree.supervisor_sees_best", "I feel like my immediate supervisor sees the best in me.", false],
    ["agree.positions_filled", "Open positions in my department/work area are filled quickly.", false],
  ].map(([metricCode, prompt, reverse], idx) => ({
    metricCode,
    sectionKey: SECTIONS.agreement,
    displayOrder: 100 + idx,
    prompt,
    responseType: "single_select",
    required: true,
    optionsJson: { options: AGREE_5 },
    reverseScore: reverse,
  })),

  // -------------------- Q21: 4-point agreement (no Don't Know) --------------
  ...[
    ["agree2.proud", "I am proud to work at FHCHC.", false],
    ["agree2.recommend_work", "I would recommend FHCHC as a great place to work.", false],
    ["agree2.recommend_care", "I would recommend FHCHC as an excellent place to receive care.", false],
    ["agree2.frustration", "My work is a major source of frustration.", true],
    ["agree2.respect_supervisor", "I respect my immediate supervisor.", false],
    ["agree2.go_above", "I go above and beyond my assigned tasks.", false],
    ["agree2.creative_ideas", "I am encouraged to share new and creative ideas.", false],
    ["agree2.look_forward", "I look forward to going to work.", false],
    ["agree2.intent_to_leave", "I plan to look for another job in the next 12 or so months.", true],
    ["agree2.prof_dev", "I have participated in professional development in the last 18 months.", false],
    ["agree2.training", "I receive the necessary training to do my job well.", false],
    ["agree2.equipment", "I have the necessary equipment and supplies to do my job well.", false],
    ["agree2.promotion_reqs", "I understand requirements for promotions in my area.", false],
  ].map(([metricCode, prompt, reverse], idx) => ({
    metricCode,
    sectionKey: SECTIONS.agreement,
    displayOrder: 200 + idx,
    prompt,
    responseType: "single_select",
    required: true,
    optionsJson: { options: AGREE_4 },
    reverseScore: reverse,
  })),

  // -------------------- Q22-Q24: Reflections & belonging --------------------
  {
    metricCode: "open.what_we_do_well",
    sectionKey: SECTIONS.reflections,
    displayOrder: 10,
    prompt: "What do we do well at FHCHC and should keep on doing?",
    responseType: "open_text",
    required: false,
  },
  {
    metricCode: "open.actions_to_take",
    sectionKey: SECTIONS.reflections,
    displayOrder: 20,
    prompt:
      "What 2 or 3 actions would you take to enhance any aspect of FHCHC operations or culture?",
    helpText:
      "You can also use this space to share feedback, suggestions, and any other information you would like to share. We will edit responses as needed to disguise people's identities.",
    responseType: "open_text",
    required: false,
  },
  {
    metricCode: "wellbeing.belonging",
    sectionKey: SECTIONS.reflections,
    displayOrder: 30,
    prompt:
      "After reflecting on your responses so far and considering the last few months or so, how often have you felt these ways at work?",
    responseType: "slider",
    required: true,
    optionsJson: {
      min: 0,
      max: 100,
      minLabel: "Not at all",
      maxLabel: "Very strongly",
      items: [
        { key: "included", label: "Included" },
        { key: "belong", label: "Like I belong" },
      ],
    },
    reportingConfigJson: { favorableThreshold: 60 },
  },

  // -------------------- Q25: Location ---------------------------------------
  {
    metricCode: "about.location",
    sectionKey: SECTIONS.about_you,
    displayOrder: 10,
    prompt: "What location do you primarily work at?",
    helpText:
      "We will need full participation in order to report results — averages — for smaller locations. For smaller work teams, only averages will be calculated to protect everyone's anonymity.",
    responseType: "single_select",
    required: true,
    optionsJson: {
      options: [
        "Bella Vista",
        "50 Grand Ave Medical/Midwifery",
        "Dental Office (Grand Avenue)",
        "374 Grand Ave, Building A (Katrina Clark Building)",
        "374 Grand Ave, Building B (new building)",
        "150 Sargent Drive",
        "School-based Health Center",
        "Shoreline Family Health Care",
        "East Haven/Trolley Square",
        "Pharmacy (both locations)",
        "Prefer not to answer",
      ],
    },
  },

  // -------------------- Q26: Role (multi-select with Other) -----------------
  {
    metricCode: "about.role",
    sectionKey: SECTIONS.about_you,
    displayOrder: 20,
    prompt: "Which best describes your role? Select all that apply.",
    helpText:
      "We have combined titles where there are 3 or fewer people to protect your identity.",
    responseType: "multi_select",
    required: true,
    optionsJson: {
      allowOther: true,
      options: [
        "Behavioral health operations and navigation",
        "Care Coordination (Ryan White, WIC, Access to Care, Language Services, Cancer Prevention)",
        "Data and Analytics",
        "Director/Assistant Director/Manager",
        "Executive Management Team (EMT)",
        "Facilities",
        "Finance Department",
        "Human Resources Department",
        "Health Information Management (HIM)",
        "IT Department",
        "Marketing/Business Development/Food as Medicine",
        "Medical Assistant or Dental Assistant",
        "Provider - Medical/Dental (MD, DO, DMD, APRN, PA)",
        "Provider – Midwifery",
        "Provider – Behavioral Health",
        "Registered Nurse (RN) or Licensed Practical Nurse (LPN)",
        "Patient Access (Front Desk, Call Center, Referrals, Pre-registration, Billing and Coding)",
        "Pharmacy",
        "Administrative Assistant",
        "Prefer Not to Answer",
      ],
    },
  },

  // -------------------- Q27: Tenure ----------------------------------------
  {
    metricCode: "about.tenure",
    sectionKey: SECTIONS.about_you,
    displayOrder: 30,
    prompt: "How many years have you worked at FHCHC?",
    responseType: "single_select",
    required: true,
    optionsJson: {
      options: [
        "Less than 1 year",
        "1 to 3 years",
        "4 to 10 years",
        "More than 10 years",
        "Prefer not to answer",
      ],
    },
  },

  // -------------------- Q28: Final open text --------------------------------
  {
    metricCode: "open.final_thoughts",
    sectionKey: SECTIONS.about_you,
    displayOrder: 40,
    prompt:
      "This is an opportunity to provide any other comments, suggestions or ideas.",
    responseType: "open_text",
    required: false,
  },
];

// ----------------------------------------------------------------------------
// Driver
// ----------------------------------------------------------------------------

async function main() {
  // Locate the FHCHC client + template campaign
  const client = await prisma.client.findUnique({ where: { slug: "fhchc" } });
  if (!client) {
    throw new Error("Client 'fhchc' not found. Run `npm run db:seed` first.");
  }

  let campaign = await prisma.campaign.findFirst({
    where: { clientId: client.id, isTemplate: true },
  });
  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        clientId: client.id,
        year: 2026,
        name: "2026 Well-being & Belonging Survey (Template)",
        status: "draft",
        isTemplate: true,
        anonymityThreshold: 5,
      },
    });
    console.log(`[seed-questionnaire] Created template campaign ${campaign.id}`);
  }

  // Refuse to overwrite if real responses exist (production safety)
  const responseCount = await prisma.response.count({
    where: { campaignId: campaign.id, isTestData: false, isPreview: false },
  });
  if (responseCount > 0) {
    throw new Error(
      `Refusing: ${responseCount} production responses already exist for this campaign. Aborting.`
    );
  }

  // Use the most recent schema or create a fresh one
  let schema = await prisma.questionSchema.findFirst({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
  });
  if (!schema) {
    schema = await prisma.questionSchema.create({
      data: {
        campaignId: campaign.id,
        versionName: "2026-final",
        schemaJson: {},
      },
    });
    console.log(`[seed-questionnaire] Created schema ${schema.versionName}`);
  }

  // Wipe existing questions in this schema so the seed is idempotent.
  // ResponseItem cascades from Response (not Question), so deleting questions
  // would orphan response_items. We've already asserted no responses exist.
  // Children must be removed before parents (FK on parent_question_id).
  await prisma.question.deleteMany({
    where: { schemaId: schema.id, parentQuestionId: { not: null } },
  });
  await prisma.question.deleteMany({ where: { schemaId: schema.id } });

  // Insert in two passes: parents first, then conditional follow-ups.
  const idByKey = new Map();
  const parentRows = QUESTIONS.filter((q) => !q.parentKey);
  const childRows = QUESTIONS.filter((q) => q.parentKey);

  for (const q of parentRows) {
    const created = await prisma.question.create({
      data: {
        schemaId: schema.id,
        metricCode: q.metricCode ?? null,
        sectionKey: q.sectionKey,
        displayOrder: q.displayOrder,
        prompt: q.prompt,
        helpText: q.helpText ?? null,
        responseType: q.responseType,
        required: q.required ?? true,
        optionsJson: q.optionsJson ?? undefined,
        reverseScore: q.reverseScore ?? false,
        reportingConfigJson: q.reportingConfigJson ?? undefined,
        activeStatus: "active",
        comparableToPrior: true,
      },
    });
    if (q.key) idByKey.set(q.key, created.id);
  }

  for (const q of childRows) {
    const parentId = idByKey.get(q.parentKey);
    if (!parentId) {
      console.warn(`[seed-questionnaire] Skip ${q.metricCode}: parent ${q.parentKey} not found`);
      continue;
    }
    await prisma.question.create({
      data: {
        schemaId: schema.id,
        metricCode: q.metricCode ?? null,
        sectionKey: q.sectionKey,
        displayOrder: q.displayOrder,
        prompt: q.prompt,
        helpText: q.helpText ?? null,
        responseType: q.responseType,
        required: q.required ?? false,
        optionsJson: q.optionsJson ?? undefined,
        parentQuestionId: parentId,
        showIfParentValue: q.showIfParentValue ?? null,
        reverseScore: q.reverseScore ?? false,
        activeStatus: "active",
        comparableToPrior: true,
      },
    });
  }

  console.log(
    `[seed-questionnaire] Inserted ${parentRows.length + childRows.length} questions into ${schema.versionName} (${campaign.id})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
