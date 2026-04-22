import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CampaignList } from "@/components/admin/CampaignList";
import { Badge } from "@/components/ui/primitives";
import { ClientStatusToggle } from "@/components/admin/ClientStatusToggle";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!hasRole(session.user.role, "super_admin")) redirect("/admin");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      campaigns: {
        include: {
          client: { select: { name: true, slug: true } },
          _count: {
            select: {
              recipients: true,
              responses: {
                where: {
                  isComplete: true,
                  isTestData: false,
                  isPreview: false,
                },
              },
            },
          },
        },
        orderBy: [{ isTemplate: "desc" }, { year: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!client) notFound();

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div>
          <Link
            href="/admin/clients"
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#1C1C1C]"
          >
            <ChevronLeft className="h-4 w-4" />
            Clients
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-page-title">{client.name}</h1>
            <Badge tone={client.status === "active" ? "sage" : "gray"}>
              {client.status}
            </Badge>
          </div>
          <p className="mt-2 t-helper">
            Slug:{" "}
            <code className="rounded bg-[#F7F9F7] px-1.5 py-0.5 text-xs">
              {client.slug}
            </code>
            {" · "}
            {client.campaigns.length} campaign
            {client.campaigns.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="t-section">Status</h2>
          </div>
          <ClientStatusToggle clientId={client.id} status={client.status} />
        </div>

        <div>
          <h2 className="t-section mb-4">Campaigns</h2>
          <CampaignList
            campaigns={client.campaigns.map((c) => ({
              id: c.id,
              name: c.name,
              year: c.year,
              status: c.status,
              isTemplate: c.isTemplate,
              startAt: c.startAt,
              visibleCloseAt: c.visibleCloseAt,
              client: c.client,
              _count: c._count,
            }))}
            userRole={session.user.role}
          />
        </div>
      </main>
    </div>
  );
}
