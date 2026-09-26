// Prisma 7 configuration. Prisma no longer reads .env on its own, so we load
// it here, then pick the database URL with the same helper the app uses.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getDatabaseUrl } from "./src/lib/env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `prisma db seed` runs this. It is idempotent (skips when users exist).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
