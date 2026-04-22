import type { BadgeTone } from "@/components/ui/primitives";

/**
 * Single source of truth for mapping semantic statuses → Badge tones.
 * When you need a status pill, look the meaning up here rather than inventing
 * a new color. Keep this map small: if nothing fits, consider whether the
 * concept actually needs a badge.
 */
export const CAMPAIGN_STATUS_TONE: Record<string, BadgeTone> = {
  draft: "gray",
  scheduled: "blue",
  live: "sage",
  closed: "amber",
  archived: "gray",
};

export const QUESTION_STATUS_TONE: Record<string, BadgeTone> = {
  active: "sage",
  draft: "gray",
  hidden: "gray",
  retired: "amber",
};

export const QUESTION_FLAG_TONE = {
  responseType: "sage" as BadgeTone,
  reverseScored: "amber" as BadgeTone,
  followUp: "blue" as BadgeTone,
  sensitive: "amber" as BadgeTone,
  required: "gray" as BadgeTone,
};

export const EMT_TONE: Record<string, BadgeTone> = {
  emt: "sage",
  general: "gray",
};
