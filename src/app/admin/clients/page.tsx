import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ClientsCard } from "@/components/admin/ClientsCard";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!hasRole(session.user.role, "super_admin")) redirect("/admin");

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { campaigns: true } } },
  });

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div>
          <h1 className="t-page-title">Clients</h1>
          <p className="mt-2 t-helper max-w-2xl">
            Manage the organizations that run campaigns on this platform. Select a
            client to see all of their campaigns.
          </p>
        </div>

        <ClientsCard
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            status: c.status,
            _count: c._count,
          }))}
        />
      </main>
    </div>
  );
}
