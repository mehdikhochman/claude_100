// Runs inside every test worker before the test file is imported.
// The app must never touch the development database from a test.
import "dotenv/config";

const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testUrl) {
  throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
}
process.env.DATABASE_URL = testUrl;
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret";
process.env.STUDIO_TIMEZONE ??= "Africa/Abidjan";
