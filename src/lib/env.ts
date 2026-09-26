// Central place to read environment variables.
//
// Rules:
// - Empty strings count as "not set" (Vercel sometimes injects "" for unused
//   integration variables).
// - The database URL is chosen from several candidate names because the
//   Vercel Marketplace (Prisma Postgres / Neon) exposes different ones.

/** Return the env value, or undefined when missing or empty/whitespace. */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Candidate variables, in order of preference. */
const DATABASE_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

/**
 * Pick the first usable Postgres connection string.
 * `prisma+postgres://` (Prisma Accelerate) URLs are skipped: the pg driver
 * adapter needs a plain `postgres://` / `postgresql://` TCP URL.
 */
export function getDatabaseUrl(): string {
  for (const name of DATABASE_URL_CANDIDATES) {
    const value = readEnv(name);
    if (value && /^postgres(ql)?:\/\//i.test(value)) return value;
  }
  throw new Error(
    "No database URL found. Set DATABASE_URL to a postgres:// connection string " +
      "(see .env.example).",
  );
}

/** Secret used to sign the auth JWT. Must be set in every environment. */
export function getSessionSecret(): string {
  const secret = readEnv("SESSION_SECRET");
  if (!secret) {
    throw new Error("SESSION_SECRET is missing. Generate one with `openssl rand -base64 32`.");
  }
  return secret;
}

/** IANA timezone the studio operates in. Everything is displayed in this zone. */
export function getStudioTimezone(): string {
  return readEnv("STUDIO_TIMEZONE") ?? "Africa/Abidjan";
}

/** True when the Vercel Blob token is configured (avatar uploads enabled). */
export function hasBlobToken(): boolean {
  return Boolean(readEnv("BLOB_READ_WRITE_TOKEN"));
}
