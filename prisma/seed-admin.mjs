// Minimal admin seeder for container boot. Pure JS so we don't need tsx/esbuild
// in the production image. Run via: node prisma/seed-admin.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;

if (!email || !password) {
  console.log("[seed-admin] ADMIN_SEED_EMAIL/PASSWORD not set, skipping.");
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 10);
const normalized = email.toLowerCase().trim();

const admin = await prisma.adminUser.upsert({
  where: { email: normalized },
  update: { passwordHash, role: "super_admin" },
  create: {
    email: normalized,
    name: "Seed Admin",
    role: "super_admin",
    passwordHash,
  },
});

console.log(`[seed-admin] Upserted ${admin.email} (super_admin)`);
await prisma.$disconnect();
