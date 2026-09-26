// Runs once per `vitest` invocation, in the main process: migrate the test DB.
import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) throw new Error("TEST_DATABASE_URL is not set. See .env.example.");

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
