// Runs once before the e2e tests. Repeated local runs register and log in from
// the same IP, which would eventually trip the rate limits, so we clear the
// counters when the database is reachable. Against a remote deployment
// (E2E_BASE_URL set, no DATABASE_URL) this is skipped. Uses `pg` directly so
// the setup does not depend on the app's TypeScript modules.
import "dotenv/config";
import { Client } from "pg";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('DELETE FROM "RateLimit"');
  } catch (error) {
    console.warn("e2e global setup: could not reset rate limits:", (error as Error).message);
  } finally {
    await client.end().catch(() => undefined);
  }
}
