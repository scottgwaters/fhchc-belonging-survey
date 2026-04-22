import { z } from "zod";
import { THEME_IDS } from "@/lib/themes";
import { welcomeCopySchema } from "@/lib/welcome-copy";

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "closed",
  "archived",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const isoDateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" });

const optionalIsoDate = z
  .union([isoDateString, z.literal("")])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const campaignCreateSchema = z
  .object({
    clientId: z.string().uuid(),
    year: z.number().int().min(2020).max(2100),
    name: z.string().min(2).max(200),
    timezone: z.string().min(1).default("America/New_York"),
    startAt: optionalIsoDate,
    visibleCloseAt: optionalIsoDate,
    tokenExpiresAt: optionalIsoDate,
    introCopy: z.string().max(10_000).optional().nullable(),
    invitationCopy: z.string().max(10_000).optional().nullable(),
    anonymityThreshold: z.number().int().min(2).max(50).default(5),
    theme: z.enum(THEME_IDS).default("teal"),
    logoUrl: z.string().max(1_000_000).optional().nullable(),
    logoAlt: z.string().max(200).optional().nullable(),
    welcomeCopyJson: welcomeCopySchema.optional().nullable(),
    isTemplate: z.boolean().default(false),
    templateSourceId: z.string().uuid().optional().nullable(),
  })
  .refine(
    (v) =>
      !v.startAt ||
      !v.visibleCloseAt ||
      v.visibleCloseAt.getTime() > v.startAt.getTime(),
    { message: "visibleCloseAt must be after startAt", path: ["visibleCloseAt"] }
  )
  .refine(
    (v) =>
      !v.visibleCloseAt ||
      !v.tokenExpiresAt ||
      v.tokenExpiresAt.getTime() >= v.visibleCloseAt.getTime(),
    {
      message: "tokenExpiresAt must be on or after visibleCloseAt",
      path: ["tokenExpiresAt"],
    }
  );

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

const campaignBaseShape = {
  clientId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  name: z.string().min(2).max(200),
  timezone: z.string().min(1),
  startAt: optionalIsoDate,
  visibleCloseAt: optionalIsoDate,
  tokenExpiresAt: optionalIsoDate,
  introCopy: z.string().max(10_000).optional().nullable(),
  invitationCopy: z.string().max(10_000).optional().nullable(),
  anonymityThreshold: z.number().int().min(2).max(50),
  theme: z.enum(THEME_IDS),
  logoUrl: z.string().max(1_000_000).optional().nullable(),
  logoAlt: z.string().max(200).optional().nullable(),
  welcomeCopyJson: welcomeCopySchema.optional().nullable(),
  isTemplate: z.boolean(),
  templateSourceId: z.string().uuid().optional().nullable(),
};

export const campaignUpdateSchema = z.object(campaignBaseShape).partial();

export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

export const campaignStatusSchema = z.object({
  newStatus: z.enum(CAMPAIGN_STATUSES),
  reason: z.string().max(500).optional().nullable(),
  acknowledgedWarning: z.boolean().optional(),
});

export type CampaignStatusInput = z.infer<typeof campaignStatusSchema>;

export const campaignCloneSchema = z.object({
  targetClientId: z.string().uuid(),
  newName: z.string().min(2).max(200),
  newYear: z.number().int().min(2020).max(2100),
});

export type CampaignCloneInput = z.infer<typeof campaignCloneSchema>;
