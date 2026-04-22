"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-[#F7F9F7]">{children}</div>
    </SessionProvider>
  );
}
