"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { AdminRole } from "@/lib/auth";

interface AdminHeaderProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role: AdminRole;
  };
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roleLabel = {
    super_admin: "Super Admin",
    campaign_admin: "Campaign Admin",
    viewer: "Viewer",
  }[user.role];

  return (
    <header className="sticky top-0 z-50 border-b border-[#D9DFDA] bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Logo / Brand */}
        <Link
          href="/admin"
          className="flex items-center gap-2 text-sm font-medium text-[#1C1C1C]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2F5D54] text-white">
            B
          </div>
          <span className="hidden sm:inline">Belonging Index</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          <Link
            href="/admin"
            className="text-sm font-medium text-[#374151] transition-colors hover:text-[#1C1C1C]"
          >
            Campaigns
          </Link>
          {user.role === "super_admin" && (
            <Link
              href="/admin/clients"
              className="text-sm font-medium text-[#374151] transition-colors hover:text-[#1C1C1C]"
            >
              Clients
            </Link>
          )}
          <Link
            href="/admin/settings"
            className="text-sm font-medium text-[#374151] transition-colors hover:text-[#1C1C1C]"
          >
            Settings
          </Link>
        </nav>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-full border border-[#D9DFDA] py-1.5 pl-1.5 pr-3 transition-colors hover:bg-[#F7F9F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
          >
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2F5D54] text-xs text-white">
                {user.name?.[0] || user.email[0].toUpperCase()}
              </div>
            )}
            <span className="hidden text-sm text-[#1C1C1C] sm:inline">
              {user.name || user.email}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[#D9DFDA] bg-white py-2 shadow-lg">
              <div className="border-b border-[#E8ECE8] px-4 py-2">
                <p className="text-sm font-medium text-[#1C1C1C]">
                  {user.name || "User"}
                </p>
                <p className="text-xs text-[#6B7280]">{user.email}</p>
                <span className="mt-1.5 inline-flex items-center rounded-full border border-[#BFD0C8] bg-[#DCE8E4] px-2 py-0.5 text-xs font-medium text-[#1D3931]">
                  {roleLabel}
                </span>
              </div>

              <div className="py-1">
                <Link
                  href="/admin/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F7F9F7] hover:text-[#1C1C1C]"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/admin/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F7F9F7] hover:text-[#1C1C1C]"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </div>

              <div className="border-t border-[#E8ECE8] py-1">
                <button
                  onClick={() => signOut({ callbackUrl: "/admin/login" })}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F7F9F7] hover:text-[#1C1C1C]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
