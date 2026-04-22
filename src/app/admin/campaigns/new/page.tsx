import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CampaignForm } from "@/components/admin/CampaignForm";

export default async function NewCampaignPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!hasRole(session.user.role, "campaign_admin")) {
    redirect("/admin");
  }

  const clients = await prisma.client.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#1C1C1C]"
        >
          <ChevronLeft className="h-4 w-4" />
          Campaigns
        </Link>
        <h1 className="mb-6 t-page-title">New campaign</h1>
        {clients.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            No active clients. Create a client first.
          </div>
        ) : (
          <CampaignForm mode="create" clients={clients} />
        )}
      </main>
    </div>
  );
}
