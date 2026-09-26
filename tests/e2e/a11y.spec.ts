// Automated accessibility scan (axe-core, WCAG 2.1 A/AA) of the main pages.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/classes", "/schedule", "/login", "/register"];

for (const path of PUBLIC_PAGES) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("nextjs-portal") // Next.js dev overlay
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
