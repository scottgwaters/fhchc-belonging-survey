import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create FHCHC client
  const client = await prisma.client.upsert({
    where: { slug: "fhchc" },
    update: {},
    create: {
      name: "Fair Haven Community Health Care",
      slug: "fhchc",
      themeConfigJson: {
        colors: {
          sage: "#8FA287",
          sageDark: "#47604C",
          sageDeep: "#334B38",
          sageSoft: "#DDE6DE",
          sageTint: "#EEF3EE",
          background: "#F7F9F7",
          surface: "#FCFDFC",
          ink: "#1C1C1C",
          muted: "#6B7280",
          border: "#E8ECE8",
        },
        fontStack:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
      },
      status: "active",
    },
  });

  console.log(`Created client: ${client.name} (${client.slug})`);

  // Create a template campaign
  const campaign = await prisma.campaign.upsert({
    where: {
      id: "template-2026",
    },
    update: {},
    create: {
      id: "template-2026",
      clientId: client.id,
      year: 2026,
      name: "2026 Well-being & Belonging Survey",
      status: "draft",
      isTemplate: true,
      anonymityThreshold: 5,
      introCopy: `Your voice shapes our culture.

Help us build a workplace where every clinician, staff member, and leader feels they belong. Five steps, about four minutes, completely confidential.`,
      invitationCopy: `Dear {{firstName}},

We're launching our annual Well-being & Belonging Survey. Your honest feedback helps us understand what's working and where we can improve.

The survey takes about 4 minutes to complete and is completely confidential. Your individual responses are never shared with your manager or linked to your identity.

{{surveyLink}}

The survey closes on {{closeDate}}.

Thank you for sharing your perspective.`,
    },
  });

  console.log(`Created campaign: ${campaign.name}`);

  // Create question schema
  const schema = await prisma.questionSchema.upsert({
    where: { id: "schema-2026-v1" },
    update: {},
    create: {
      id: "schema-2026-v1",
      campaignId: campaign.id,
      versionName: "2026-v1",
      schemaJson: {
        sections: [
          { key: "wellbeing", label: "Well-being", order: 1 },
          { key: "voice", label: "Voice", order: 2 },
          { key: "culture", label: "Culture", order: 3 },
          { key: "about", label: "About you", order: 4 },
          { key: "open", label: "Your words", order: 5 },
        ],
      },
    },
  });

  // Create sample questions
  const questions = [
    {
      id: "q-energized",
      schemaId: schema.id,
      metricCode: "wellbeing.energized",
      sectionKey: "wellbeing",
      displayOrder: 1,
      prompt: "How have these feelings shown up in your work life recently?",
      helpText:
        "Reflect on the past three to four weeks. There are no right or wrong answers.",
      responseType: "slider",
      required: true,
      optionsJson: {
        items: [
          {
            key: "energized",
            label: "Energized",
            info: "The drive and motivation to engage with your work.",
          },
          {
            key: "supported",
            label: "Supported",
            info: "The sense that your team and leaders have your back.",
          },
          {
            key: "valued",
            label: "Valued",
            info: "Your contributions are recognized and respected.",
          },
        ],
        min: 0,
        max: 100,
        minLabel: "Not at all",
        maxLabel: "Very strongly",
      },
      reportingConfigJson: { favorableThreshold: 60 },
    },
    {
      id: "q-voice",
      schemaId: schema.id,
      metricCode: "voice.heard",
      sectionKey: "voice",
      displayOrder: 1,
      prompt: "How often do you feel your perspective is heard in team decisions?",
      helpText: "Including perspectives that differ from the majority view.",
      responseType: "single_select",
      required: true,
      optionsJson: {
        options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
      },
    },
    {
      id: "q-witnessed",
      schemaId: schema.id,
      metricCode: "culture.witnessed",
      sectionKey: "culture",
      displayOrder: 1,
      prompt:
        "In the past six months, have you witnessed behavior that felt exclusionary or dismissive?",
      helpText:
        "Your response is confidential. Leadership receives only aggregate counts.",
      responseType: "single_select",
      required: true,
      optionsJson: {
        options: ["Yes", "No"],
        sensitive: true,
        reassurance:
          "This is a sensitive question. Skip it if you'd rather — your survey still submits.",
      },
      reverseScore: true,
    },
    {
      id: "q-witnessed-followup",
      schemaId: schema.id,
      metricCode: "culture.witnessed.detail",
      sectionKey: "culture",
      displayOrder: 2,
      prompt: "If you'd like to share more, it helps us act.",
      helpText: "Optional. Please don't include names.",
      responseType: "open_text",
      required: false,
      parentQuestionId: "q-witnessed",
      showIfParentValue: "Yes",
    },
    {
      id: "q-role",
      schemaId: schema.id,
      metricCode: "about.role",
      sectionKey: "about",
      displayOrder: 1,
      prompt: "Which of these best describe your role?",
      helpText: "Select all that apply. Used only to analyze patterns by role type.",
      responseType: "multi_select",
      required: true,
      optionsJson: {
        options: [
          "Registered Nurse (RN)",
          "Physician",
          "Advanced Practice Provider",
          "Clinical support staff",
          "Administrative / Operations",
          "Leadership / Management",
        ],
        allowOther: true,
      },
    },
    {
      id: "q-open",
      schemaId: schema.id,
      metricCode: "open.leadership",
      sectionKey: "open",
      displayOrder: 1,
      prompt: "What would you most like leadership to hear?",
      helpText: "This field is optional. Share as much or as little as you'd like.",
      responseType: "open_text",
      required: false,
    },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: q,
      create: q,
    });
  }

  console.log(`Created ${questions.length} questions`);

  // Optional: seed an admin user from env so credentials login works in dev
  const seedEmail = process.env.ADMIN_SEED_EMAIL;
  const seedPassword = process.env.ADMIN_SEED_PASSWORD;
  if (seedEmail && seedPassword) {
    const passwordHash = await bcrypt.hash(seedPassword, 10);
    const admin = await prisma.adminUser.upsert({
      where: { email: seedEmail.toLowerCase().trim() },
      update: { passwordHash, role: "super_admin" },
      create: {
        email: seedEmail.toLowerCase().trim(),
        name: "Seed Admin",
        role: "super_admin",
        passwordHash,
      },
    });
    console.log(`Seeded admin user: ${admin.email} (super_admin)`);
  } else {
    console.log(
      "Skipping admin seed (set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD to seed one)"
    );
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
