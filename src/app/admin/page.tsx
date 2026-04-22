import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CampaignList } from "@/components/admin/CampaignList";

export default async function AdminDashboard() {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  const campaigns = await prisma.campaign.findMany({
    include: {
      client: {
        select: {
          name: true,
          slug: true,
        },
      },
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
    // Templates first (so the "use as starting point" rows are easy to find),
    // then real campaigns by year desc.
    orderBy: [{ isTemplate: "desc" }, { year: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="t-page-title">Campaigns</h1>
            <p className="mt-2 t-helper">
              Manage survey campaigns across all clients.
            </p>
          </div>

          {(session.user.role === "super_admin" ||
            session.user.role === "campaign_admin") && (
            <Link
              href="/admin/campaigns/new"
              className="inline-flex h-11 items-center rounded-full bg-[#1C1C1C] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1D3931] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
            >
              New campaign
            </Link>
          )}
        </div>

        {/* Campaign list */}
        <CampaignList campaigns={campaigns} userRole={session.user.role} />
      </main>
    </div>
  );
}
