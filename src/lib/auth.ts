import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export type AdminRole = "super_admin" | "campaign_admin" | "viewer";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: AdminRole;
    };
  }

  interface User {
    role: AdminRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AdminRole;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        await prisma.adminUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as AdminRole,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Check if user exists in admin_users table
        const adminUser = await prisma.adminUser.findUnique({
          where: { email: user.email! },
        });

        if (!adminUser) {
          // For now, auto-create as viewer (can be changed to deny access)
          await prisma.adminUser.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              role: "viewer",
            },
          });
        } else {
          // Update last login
          await prisma.adminUser.update({
            where: { email: user.email! },
            data: { lastLoginAt: new Date() },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // Credentials provider returns user with role already populated; OAuth doesn't
        if ("role" in user && user.role) {
          token.id = user.id;
          token.role = user.role;
        } else {
          const adminUser = await prisma.adminUser.findUnique({
            where: { email: user.email! },
          });
          token.id = adminUser?.id ?? user.id;
          token.role = (adminUser?.role as AdminRole) ?? "viewer";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};

/**
 * Get the current session on the server
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Get the current user or throw if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session.user;
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: AdminRole, requiredRole: AdminRole): boolean {
  const roleHierarchy: Record<AdminRole, number> = {
    super_admin: 3,
    campaign_admin: 2,
    viewer: 1,
  };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Require a minimum role level, throw if not met
 */
export async function requireRole(requiredRole: AdminRole) {
  const user = await getCurrentUser();
  if (!hasRole(user.role, requiredRole)) {
    throw new Error(`Requires ${requiredRole} role or higher`);
  }
  return user;
}
