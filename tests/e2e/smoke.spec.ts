// The one end-to-end smoke test: signup → book → cancel → waitlist promotion.
//
// It creates its own 1-spot session through the admin UI so it never depends
// on the seed's state, then walks two brand-new members through the flow.
// Needs the seeded admin account (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@legacy.studio";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

const stamp = Date.now().toString(36);
const coach = `E2E ${stamp}`;
const memberA = { name: "Ama Testeur", email: `ama-${stamp}@e2e.local`, password: "secret6" };
const memberB = { name: "Bakary Testeur", email: `bakary-${stamp}@e2e.local`, password: "secret6" };

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email or phone number").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form.form").getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(dashboard|admin)/);
}

async function logout(page: Page) {
  await page.context().clearCookies();
}

async function signup(page: Page, member: { name: string; email: string; password: string }) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(member.name);
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password", { exact: true }).fill(member.password);
  await page.getByLabel("Confirm password").fill(member.password);
  await page.locator("form.form").getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Hello, ${member.name.split(" ")[0]}.`);
}

/** The schedule row for our session, found by its unique coach name. */
function sessionRow(page: Page) {
  return page.locator("li.item", { hasText: `with ${coach}` });
}

test.describe.configure({ mode: "serial" });

test("signup → book → cancel → waitlist promotion", async ({ page }) => {
  // --- Admin creates a 1-spot session for tomorrow --------------------------
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin/sessions/new");
  await page.getByLabel("Class").selectOption({ index: 1 });
  await page.getByLabel("Coach").fill(coach);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  // Tomorrow at 18:05 studio time (the unique coach name is what identifies the session).
  const startsAt = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}T18:05`;
  await page.getByLabel("Starts at").fill(startsAt);
  await page.getByLabel("Capacity").fill("1");
  await page.locator("form.form").getByRole("button", { name: "Create session" }).click();
  await page.waitForURL(/\/admin\/sessions$/);
  await expect(page.locator("tr", { hasText: coach })).toBeVisible();
  await logout(page);

  // --- Member A signs up and books the only spot ---------------------------
  await signup(page, memberA);
  await page.goto("/schedule");
  await expect(sessionRow(page)).toContainText("1 spot left");
  await sessionRow(page).getByRole("button", { name: "Book" }).click();
  await expect(page.getByRole("status")).toContainText("You're booked");
  await expect(sessionRow(page)).toContainText("Booked");
  await expect(sessionRow(page)).toContainText("Full");
  await logout(page);

  // --- Member B signs up, sees Full, joins the waitlist ---------------------
  await signup(page, memberB);
  await page.goto("/schedule");
  await expect(sessionRow(page)).toContainText("Full");
  await sessionRow(page).getByRole("button", { name: /Join waitlist/ }).click();
  await expect(page.getByRole("status")).toContainText("position 1");
  await expect(sessionRow(page)).toContainText("On waitlist");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "On the waitlist" })).toBeVisible();
  await logout(page);

  // --- Member A cancels → the spot must pass to B in the same transaction ---
  await login(page, memberA.email, memberA.password);
  await page.goto("/dashboard");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("li.item", { hasText: `with ${coach}` }).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("status")).toContainText("Booking cancelled");
  await logout(page);

  // --- Member B is promoted: banner + confirmed booking ---------------------
  await login(page, memberB.email, memberB.password);
  await page.goto("/dashboard");
  const banner = page.locator(".notice--promoted");
  await expect(banner).toContainText("You're in!");
  await expect(page.locator("li.item", { hasText: `with ${coach}` })).toContainText("Confirmed");
  await banner.getByRole("button", { name: "Got it" }).click();
  await expect(page.locator(".notice--promoted")).toHaveCount(0);

  // The schedule agrees: still full, B holds the spot.
  await page.goto("/schedule");
  await expect(sessionRow(page)).toContainText("Full");
  await expect(sessionRow(page)).toContainText("Booked");
  await logout(page);

  // --- Admin sees the promotion and tidies up --------------------------------
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin/sessions");
  const row = page.locator("tr", { hasText: coach });
  await expect(row).toContainText("1/1");
  await row.getByRole("link", { name: "Members" }).click();
  await expect(page.locator("li.item", { hasText: memberB.name })).toContainText("from waitlist");
  await page.goto("/admin/sessions");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("tr", { hasText: coach }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("status")).toContainText("Session deleted");
  await page.goto("/admin/audit");
  await expect(page.locator("tbody tr").first()).toContainText("Deleted session");
});
