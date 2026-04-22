import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { PasswordCard } from "@/components/admin/PasswordCard";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  campaign_admin: "Campaign Admin",
  viewer: "Viewer",
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const me = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!me) redirect("/admin/login");

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        <div>
          <h1 className="t-page-title">Profile</h1>
          <p className="mt-2 t-helper">
            Your account details and sign-in credentials.
          </p>
        </div>

        <section className="rounded-2xl border border-[#D9DFDA] bg-white p-6 space-y-4">
          <h2 className="t-section">Account</h2>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <dt className="font-medium text-[#374151]">Name</dt>
            <dd className="col-span-2 text-[#1C1C1C]">{me.name ?? "—"}</dd>

            <dt className="font-medium text-[#374151]">Email</dt>
            <dd className="col-span-2 text-[#1C1C1C]">{me.email}</dd>

            <dt className="font-medium text-[#374151]">Role</dt>
            <dd className="col-span-2">
              <span className="inline-flex items-center rounded-full border border-[#BFD0C8] bg-[#DCE8E4] px-2.5 py-0.5 text-xs font-medium text-[#1D3931]">
                {ROLE_LABELS[me.role] ?? me.role}
              </span>
              {me.role === "viewer" && (
                <span className="ml-2 text-xs text-[#6B7280]">
                  (ask a super admin to promote you if you need write access)
                </span>
              )}
            </dd>

            <dt className="font-medium text-[#374151]">Sign-in method</dt>
            <dd className="col-span-2 text-[#1C1C1C]">
              {me.passwordHash ? "Email / password" : "Google only"}
            </dd>

            <dt className="font-medium text-[#374151]">Last login</dt>
            <dd className="col-span-2 text-[#1C1C1C]">
              {me.lastLoginAt ? DATE_FMT.format(new Date(me.lastLoginAt)) : "—"}
            </dd>

            <dt className="font-medium text-[#374151]">Account created</dt>
            <dd className="col-span-2 text-[#1C1C1C]">
              {DATE_FMT.format(new Date(me.createdAt))}
            </dd>
          </dl>
        </section>

        <section className="rounded-2xl border border-[#D9DFDA] bg-white p-6 space-y-4">
          <h2 className="t-section">
            {me.passwordHash ? "Change password" : "Set a password"}
          </h2>
          <PasswordCard hasPassword={Boolean(me.passwordHash)} />
        </section>
      </main>
    </div>
  );
}
