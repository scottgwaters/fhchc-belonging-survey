import type { ResponseType } from "./validation/question";

export interface QuestionPreset {
  id: string;
  label: string;
  description: string;
  responseType: ResponseType;
  optionsJson: unknown;
  reportingConfigJson?: unknown;
  favorableThreshold?: number;
  allowOther?: boolean;
  sensitive?: boolean;
}

export const LIKERT_4 = ["Strongly Disagree", "Disagree", "Agree", "Strongly Agree"];
export const LIKERT_5 = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
export const LIKERT_5_DK = [...LIKERT_5, "Don't Know"];
export const YES_NO = ["Yes", "No"];
export const YES_NO_DK = ["Yes", "No", "Don't Know"];
export const FREQ_3 = ["Never", "1 or 2 times", "Multiple times"];
export const FREQ_4 = ["Never", "1 or 2 times", "Weekly", "Daily or almost every day"];

export const QUESTION_PRESETS: QuestionPreset[] = [
  {
    id: "likert-4",
    label: "Likert · 4-point agreement",
    description: "Strongly Disagree → Strongly Agree (no neutral)",
    responseType: "single_select",
    optionsJson: { options: LIKERT_4 },
  },
  {
    id: "likert-5",
    label: "Likert · 5-point agreement",
    description: "Adds Neutral midpoint",
    responseType: "single_select",
    optionsJson: { options: LIKERT_5 },
  },
  {
    id: "likert-5-dk",
    label: "Likert · 5-point + Don't Know",
    description: "Adds Don't Know, excluded from favorability denominator",
    responseType: "single_select",
    optionsJson: { options: LIKERT_5_DK },
  },
  {
    id: "yes-no",
    label: "Yes / No",
    description: "Binary choice",
    responseType: "single_select",
    optionsJson: { options: YES_NO },
  },
  {
    id: "yes-no-dk",
    label: "Yes / No / Don't Know",
    description: "Binary with opt-out",
    responseType: "single_select",
    optionsJson: { options: YES_NO_DK },
  },
  {
    id: "freq-3",
    label: "Frequency · 3-way",
    description: "Never / 1–2 times / Multiple times",
    responseType: "single_select",
    optionsJson: { options: FREQ_3 },
  },
  {
    id: "freq-4",
    label: "Frequency · 4-way",
    description: "Never / 1–2 times / Weekly / Daily or almost",
    responseType: "single_select",
    optionsJson: { options: FREQ_4 },
  },
  {
    id: "single-select",
    label: "Single-select · custom options",
    description: "Radio list — one choice from a list you define",
    responseType: "single_select",
    optionsJson: { options: [] },
  },
  {
    id: "multi-select",
    label: "Multi-select · select all that apply",
    description: "Checkbox list, no write-in",
    responseType: "multi_select",
    optionsJson: { options: [] },
  },
  {
    id: "multi-select-other",
    label: "Multi-select + Other write-in",
    description: "Checkbox list with an Other textbox",
    responseType: "multi_select",
    optionsJson: { options: [], allowOther: true },
    allowOther: true,
  },
  {
    id: "agreement-grid",
    label: "Agreement grid · rate many statements",
    description: "Matrix: rows of statements share one Likert scale (FHCHC Q20/Q21)",
    responseType: "likert_grid",
    optionsJson: {
      statements: [] as { key: string; label: string }[],
      scale: LIKERT_5_DK,
    },
  },
  {
    id: "slider-0-100",
    label: "Slider · 0–100",
    description: "Single slider",
    responseType: "slider",
    optionsJson: { min: 0, max: 100 },
    reportingConfigJson: { favorableThreshold: 60 },
    favorableThreshold: 60,
  },
  {
    id: "slider-stack",
    label: "Slider stack · rate many items 0–100",
    description: "Stacked sliders with shared scale (FHCHC Q1)",
    responseType: "slider",
    optionsJson: {
      items: [] as { key: string; label: string }[],
      min: 0,
      max: 100,
      minLabel: "Not at all",
      maxLabel: "Very strongly",
    },
    reportingConfigJson: { favorableThreshold: 60 },
    favorableThreshold: 60,
  },
  {
    id: "short-answer",
    label: "Short answer",
    description: "Free text, one or two lines",
    responseType: "open_text",
    optionsJson: { rows: 2 },
  },
  {
    id: "long-answer",
    label: "Long answer",
    description: "Free text, paragraph",
    responseType: "open_text",
    optionsJson: { rows: 6 },
  },
  {
    id: "numeric",
    label: "Number",
    description: "Numeric input (age, count, years)",
    responseType: "numeric",
    optionsJson: { min: 0 },
  },
  {
    id: "date",
    label: "Date",
    description: "Calendar picker (ISO date)",
    responseType: "date",
    optionsJson: {},
  },
  {
    id: "ranking",
    label: "Ranking · order a list",
    description: "Respondent orders items with up/down buttons",
    responseType: "ranking",
    optionsJson: { options: [] as string[] },
  },
];

export function findPreset(id: string): QuestionPreset | undefined {
  return QUESTION_PRESETS.find((p) => p.id === id);
}
