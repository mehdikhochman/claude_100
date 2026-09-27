#!/usr/bin/env node
// Runs first in `npm run build`. Fails fast, with a clear message, when the
// variables the app cannot live without are missing. Empty values count as missing.

const required = {
  SESSION_SECRET: "Signs the login cookie. Generate one with `openssl rand -base64 32`.",
};

const dbCandidates = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "PRISMA_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

const isSet = (name) => typeof process.env[name] === "string" && process.env[name].trim() !== "";
const problems = [];

for (const [name, hint] of Object.entries(required)) {
  if (!isSet(name)) problems.push(`  - ${name} is missing. ${hint}`);
}

const isPostgresUrl = (name) => isSet(name) && /^postgres(ql)?:\/\//i.test(process.env[name].trim());
// Same rule as src/lib/env.ts: named candidates first, then any other *_URL variable.
const hasDb =
  dbCandidates.some(isPostgresUrl) ||
  Object.keys(process.env).some((name) => name.endsWith("_URL") && name !== "TEST_DATABASE_URL" && isPostgresUrl(name));
if (!hasDb) {
  const accelerate = dbCandidates.find(
    (name) => isSet(name) && /^prisma\+postgres:\/\//i.test(process.env[name].trim()),
  );
  problems.push(
    "  - No postgres:// database URL found in the environment (looked at " + dbCandidates.join(", ") +
      " and any other *_URL variable). Is the Postgres store connected to this project in Vercel → Storage?" +
      (accelerate
        ? ` ${accelerate} is a prisma+postgres:// (Accelerate) URL, which the pg driver cannot use. ` +
          "In Vercel → Storage → your Prisma Postgres database, copy the direct TCP connection string " +
          "(starts with postgres://) into a POSTGRES_URL environment variable."
        : " Set DATABASE_URL to your Postgres connection string."),
  );
}

if (problems.length > 0) {
  console.error("\n✖ LEGACY build stopped: environment is incomplete.\n");
  console.error(problems.join("\n"));
  console.error("\nSee .env.example for the full list of variables.\n");
  process.exit(1);
}

console.log("✔ Environment looks good.");
