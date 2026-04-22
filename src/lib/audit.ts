import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type AuditAction =
  | "campaign.create"
  | "campaign.update"
  | "campaign.delete"
  | "campaign.status_change"
  | "campaign.clone"
  | "schema.create"
  | "schema.update"
  | "question.create"
  | "question.update"
  | "question.delete"
  | "distribution.upload"
  | "distribution.send_invites"
  | "distribution.send_reminders"
  | "export.generate"
  | "export.download"
  | "admin.login"
  | "admin.role_change"
  | "response.flag"
  | "response.unflag"
  | "platform.export"
  | "platform.import";

export type AuditEntityType =
  | "campaign"
  | "question_schema"
  | "question"
  | "distribution_recipient"
  | "response"
  | "export"
  | "admin_user"
  | "platform";

interface AuditLogParams {
  actorUserId: string | null;
  actionType: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  actorUserId,
  actionType,
  entityType,
  entityId,
  metadata,
}: AuditLogParams) {
  return prisma.auditLog.create({
    data: {
      actorUserId,
      actionType,
      entityType,
      entityId,
      metadataJson: metadata ?? Prisma.JsonNull,
    },
  });
}

/**
 * Log a campaign status change with reason
 */
export async function logCampaignStatusChange(
  campaignId: string,
  previousStatus: string,
  newStatus: string,
  changedByUserId: string,
  reason?: string
) {
  // Create status log entry
  await prisma.campaignStatusLog.create({
    data: {
      campaignId,
      previousStatus,
      newStatus,
      changedByUserId,
      reason,
    },
  });

  // Also create audit log
  await createAuditLog({
    actorUserId: changedByUserId,
    actionType: "campaign.status_change",
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      previousStatus,
      newStatus,
      reason,
    },
  });
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogsForEntity(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50
) {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

/**
 * Get recent audit logs for a user
 */
export async function getAuditLogsForUser(userId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: {
      actorUserId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
