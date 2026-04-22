import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminUsersCard } from "@/components/admin/AdminUsersCard";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const isSuperAdmin = hasRole(session.user.role, "super_admin");

  const adminUsers = isSuperAdmin
    ? await prisma.adminUser.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          lastLoginAt: true,
          passwordHash: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <div>
          <h1 className="t-page-title">Settings</h1>
          <p className="mt-2 t-helper max-w-2xl">
            Workspace configuration. Account &amp; password live on{" "}
            <Link
              href="/admin/profile"
              className="font-medium text-[#1C1C1C] underline decoration-[#2F5D54] underline-offset-4 hover:decoration-[#244943]"
            >
              your profile
            </Link>
            .
          </p>
        </div>

        {!isSuperAdmin && (
          <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6 t-helper">
            Workspace settings (admin users) require the{" "}
            <code className="rounded bg-[#DCE8E4] px-1.5 py-0.5 text-[12px] text-[#1D3931]">
              super_admin
            </code>{" "}
            role.
          </div>
        )}

        {isSuperAdmin && (
          <section className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
            <h2 className="t-section mb-4">Admin users</h2>
            <AdminUsersCard
              users={adminUsers.map((u) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                role: u.role,
                lastLoginAt: u.lastLoginAt,
                hasPassword: u.passwordHash !== null,
              }))}
              currentUserId={session.user.id}
            />
          </section>
        )}

      </main>
    </div>
  );
}
