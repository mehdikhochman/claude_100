// Prisma 7 configuration. Prisma no longer reads .env on its own, so we load
// it here, then pick the database URL with the same helper the app uses.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getDatabaseUrl } from "./src/lib/env";

/**
 * `prisma generate` (run on `npm install`, including on Vercel) does not need a
 * database, so a missing URL must not break it. Commands that do need one
 * (`migrate deploy`, `db seed`) fail later with Prisma's own clear error, and
 * `npm run build` checks the variables up front via scripts/check-env.mjs.
 */
function optionalDatabaseUrl(): string | undefined {
  try {
    return getDatabaseUrl();
  } catch {
    return undefined;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `prisma db seed` runs this. It is idempotent (skips when users exist).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: optionalDatabaseUrl(),
  },
});
