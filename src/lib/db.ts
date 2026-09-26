// Prisma client singleton.
//
// Prisma 7 talks to Postgres through a driver adapter (here: node-postgres).
// In development Next.js hot-reloads modules, so we cache the client on
// `globalThis` to avoid opening a new pool on every reload.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "./env";

/** Build a fresh client for a given URL (tests use this with TEST_DATABASE_URL). */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString, max: 5 });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient(getDatabaseUrl());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
