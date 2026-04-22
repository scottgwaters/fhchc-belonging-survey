"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  lastLoginAt: Date | string | null;
  hasPassword: boolean;
}

interface Props {
  users: AdminUserRow[];
  currentUserId: string;
}

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

function formatLastLogin(v: Date | string | null): string {
  if (!v) return "never";
  return DATE_FMT.format(new Date(v));
}

export function AdminUsersCard({ users, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("viewer");
  const [newPassword, setNewPassword] = useState("");
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  function changeRole(id: string, role: string) {
    setError(null);
    setActiveId(id);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await res.json().catch(() => ({}));
      setActiveId(null);
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  function createUser() {
    setError(null);
    setCreateMsg(null);
    if (newPassword && newPassword.length < 8) {
      setError("Password must be at least 8 characters (or leave blank for Google sign-in only)");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName || null,
          role: newRole,
          password: newPassword || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setCreateMsg(
        newPassword
          ? `Created ${body.email} as ${body.role}. They can sign in with email + password now.`
          : `Created ${body.email} as ${body.role}. They'll be assigned this role on first Google sign-in.`
      );
      setNewEmail("");
      setNewName("");
      setNewRole("viewer");
      setNewPassword("");
      setCreating(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#6B7280]">
        New Google sign-ins default to <code>viewer</code>. You can also pre-create
        a user here and they&rsquo;ll get the role you set on first sign-in.
      </p>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
      {createMsg && (
        <p className="rounded-xl bg-[#DCE8E4] p-3 text-xs text-[#1D3931]">
          {createMsg}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-[#E8ECE8]">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F9F7] text-left text-xs uppercase tracking-wider text-[#6B7280]">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Auth</th>
              <th className="px-4 py-2 font-medium">Last login</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[#E8ECE8]">
                <td className="px-4 py-2 align-top">
                  <p className="text-[#1C1C1C]">{u.name ?? u.email}</p>
                  {u.name && <p className="text-xs text-[#6B7280]">{u.email}</p>}
                  {u.id === currentUserId && (
                    <span className="mt-0.5 inline-block rounded-full bg-[#DCE8E4] px-2 py-0.5 text-xs text-[#244943]">
                      you
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 align-top text-xs text-[#6B7280]">
                  {u.hasPassword ? "password" : "google"}
                </td>
                <td className="px-4 py-2 align-top text-xs text-[#6B7280]">
                  {formatLastLogin(u.lastLoginAt)}
                </td>
                <td className="px-4 py-2 align-top">
                  <select
                    value={u.role}
                    disabled={isPending && activeId === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="rounded-xl border border-[#E8ECE8] bg-white px-2 py-1 text-xs"
                  >
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E8ECE8] px-3 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F7F9F7]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add user
        </button>
      ) : (
        <div className="rounded-2xl border border-[#E8ECE8] bg-white p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="alice@example.com"
                autoComplete="off"
                className="input"
              />
            </Field>
            <Field label="Name (optional)">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Alice Example"
                className="input"
              />
            </Field>
            <Field label="Role">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="input"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Initial password (optional)">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank for Google-only"
                autoComplete="new-password"
                className="input"
              />
            </Field>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            If you leave the password blank, the user can sign in with Google
            and will be auto-matched to this account by email. They can set a
            password later from their Profile.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
                setNewEmail("");
                setNewName("");
                setNewRole("viewer");
                setNewPassword("");
              }}
              className="rounded-full border border-[#E8ECE8] px-3 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F7F9F7]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || !newEmail}
              onClick={createUser}
              className="rounded-full bg-[#1C1C1C] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D3931] disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create user"}
            </button>
          </div>
          <style jsx>{`
            .input {
              width: 100%;
              border: 1px solid #e8ece8;
              border-radius: 12px;
              padding: 8px 12px;
              background: white;
              font-size: 14px;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#6B7280]">{label}</span>
      {children}
    </label>
  );
}
