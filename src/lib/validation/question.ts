import { z } from "zod";

export const RESPONSE_TYPES = [
  "slider",
  "single_select",
  "multi_select",
  "open_text",
  "likert_grid",
  "numeric",
  "date",
  "ranking",
] as const;
export type ResponseType = (typeof RESPONSE_TYPES)[number];

export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  slider: "Slider (0–100)",
  single_select: "Single-select (radio)",
  multi_select: "Multi-select (checkboxes)",
  open_text: "Open text",
  likert_grid: "Matrix / Likert grid",
  numeric: "Number",
  date: "Date",
  ranking: "Ranking",
};

export const ACTIVE_STATUSES = ["draft", "active", "hidden", "retired"] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export const questionCreateSchema = z.object({
  schemaId: z.string().uuid(),
  metricCode: z.string().min(1).max(120).optional().nullable(),
  sectionKey: z.string().min(1).max(80),
  displayOrder: z.number().int().min(0).max(10_000),
  prompt: z.string().min(1).max(2000),
  helpText: z.string().max(2000).optional().nullable(),
  responseType: z.enum(RESPONSE_TYPES),
  required: z.boolean().default(true),
  optionsJson: z.unknown().optional().nullable(),
  parentQuestionId: z.string().uuid().optional().nullable(),
  showIfParentValue: z.string().max(500).optional().nullable(),
  reverseScore: z.boolean().default(false),
  reportingConfigJson: z.unknown().optional().nullable(),
  activeStatus: z.enum(ACTIVE_STATUSES).default("active"),
  comparableToPrior: z.boolean().default(true),
});

export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;

export const questionUpdateSchema = questionCreateSchema.partial().omit({
  schemaId: true,
});
export type QuestionUpdateInput = z.infer<typeof questionUpdateSchema>;
