import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import {
  parseAndValidateRecipientsCsv,
  type RecipientRow,
} from "@/lib/csv";
import { hashInviteToken, generateInviteToken } from "@/lib/tokens";

interface UploadBody {
  csv: string;
  // "merge" updates existing rows by employee_identifier; "skip" leaves them
  onConflict?: "merge" | "skip";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasRole(session.user.role, "campaign_admin")) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  let body: UploadBody;
  try {
    body = (await req.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Missing 'csv' field" }, { status: 400 });
  }
  const onConflict = body.onConflict ?? "skip";

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Optional: load known rollup groups for validation
  const rollups = await prisma.orgRollup.findMany({
    where: { campaignId: id },
    select: { rawGroupCode: true },
  });
  const knownRollupGroups = new Set(rollups.map((r) => r.rawGroupCode));

  const validation = parseAndValidateRecipientsCsv(
    body.csv,
    undefined,
    undefined,
    knownRollupGroups
  );

  if (validation.errors.length > 0) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: validation.errors,
        unknownHeaders: validation.unknownHeaders,
        validRowCount: validation.valid.length,
      },
      { status: 400 }
    );
  }

  // Check against existing rows in the campaign
  const existing = await prisma.distributionRecipient.findMany({
    where: { campaignId: id },
    select: { id: true, email: true, employeeIdentifier: true },
  });
  const existingByEmpId = new Map(
    existing.filter((e) => e.employeeIdentifier).map((e) => [e.employeeIdentifier!, e])
  );
  const existingByEmail = new Map(existing.map((e) => [e.email.toLowerCase(), e]));

  const toCreate: RecipientRow[] = [];
  const toUpdate: { id: string; row: RecipientRow }[] = [];
  const skipped: { row: RecipientRow; reason: string }[] = [];

  for (const row of validation.valid) {
    const matchByEmp = existingByEmpId.get(row.employee_identifier);
    const matchByEmail = existingByEmail.get(row.email);
    const match = matchByEmp ?? matchByEmail;

    if (match) {
      if (onConflict === "merge") {
        toUpdate.push({ id: match.id, row });
      } else {
        skipped.push({ row, reason: "Already in campaign (merge=skip)" });
      }
    } else {
      toCreate.push(row);
    }
  }

  // For new rows we need a placeholder invite_token_hash since the column is
  // unique+required. We fill with an unused random hash that's overwritten when
  // /send-invites issues a real token. This keeps the upload free of
  // token-issuance side effects (PRD §8.17.2).
  await prisma.$transaction(async (tx) => {
    for (const row of toCreate) {
      const placeholder = generateInviteToken();
      await tx.distributionRecipient.create({
        data: {
          campaignId: id,
          email: row.email,
          employeeIdentifier: row.employee_identifier,
          firstName: row.first_name ?? null,
          locationCode: row.location_code ?? null,
          roleCode: row.role_code ?? null,
          expectedRollupGroup: row.expected_rollup_group ?? null,
          isEmtExpected: row.is_emt_expected ?? false,
          inviteTokenHash: placeholder.hash,
        },
      });
    }
    for (const { id: recipientId, row } of toUpdate) {
      await tx.distributionRecipient.update({
        where: { id: recipientId },
        data: {
          firstName: row.first_name ?? null,
          locationCode: row.location_code ?? null,
          roleCode: row.role_code ?? null,
          expectedRollupGroup: row.expected_rollup_group ?? null,
          isEmtExpected: row.is_emt_expected ?? false,
          // If email changed for the same employee_identifier, preserve original
          ...(row.email && {
            email: row.email,
          }),
        },
      });
    }
  });

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "distribution.upload",
    entityType: "campaign",
    entityId: id,
    metadata: {
      created: toCreate.length,
      updated: toUpdate.length,
      skipped: skipped.length,
      unknownHeaders: validation.unknownHeaders,
    },
  });

  return NextResponse.json(
    {
      created: toCreate.length,
      updated: toUpdate.length,
      skipped: skipped.length,
      unknownHeaders: validation.unknownHeaders,
    },
    { status: 200 }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const recipients = await prisma.distributionRecipient.findMany({
    where: { campaignId: id, deletedAt: null },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      employeeIdentifier: true,
      firstName: true,
      locationCode: true,
      roleCode: true,
      isEmtExpected: true,
      inviteSentAt: true,
      reminderCount: true,
      completedAt: true,
      bounceStatus: true,
    },
  });

  return NextResponse.json({ recipients });
}

// Suppress an unused-import warning if Prisma is not referenced elsewhere
void Prisma;
void hashInviteToken;
