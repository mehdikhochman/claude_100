// WCAG AA contrast checks for the colour tokens, read straight from
// globals.css so the test can never drift from the real stylesheet.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match) throw new Error(`Token --${name} not found in globals.css`);
  return match[1].toLowerCase();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const AA_TEXT = 4.5; // normal text
const AA_LARGE = 3; // large text (>= 24px, or >= 19px bold) and UI components

describe("WCAG AA contrast of the design tokens", () => {
  const paper = token("paper");
  const surface = token("surface");
  const forest = token("forest");
  const forestDeep = token("forest-deep");
  const ink = token("ink");
  const slateText = token("slate-text");
  const clayText = token("clay-text");
  const clay = token("clay");
  const danger = token("danger");
  const dangerBg = token("danger-bg");
  const successBg = token("success-bg");
  const warnBg = token("warn-bg");
  const white = "#ffffff";

  const bodyText: [string, string, string][] = [
    ["ink on paper", ink, paper],
    ["ink on surface", ink, surface],
    ["secondary text on paper", slateText, paper],
    ["secondary text on surface", slateText, surface],
    ["clay text (eyebrows) on paper", clayText, paper],
    ["clay text on warn badge", clayText, warnBg],
    ["links (forest) on paper", forest, paper],
    ["links (forest) on surface", forest, surface],
    ["white on forest (buttons, score card)", white, forest],
    ["white on forest deep", white, forestDeep],
    ["confirmed badge text", forestDeep, successBg],
    ["danger text on danger background", danger, dangerBg],
    ["danger text on paper", danger, paper],
    ["secondary text on success background", slateText, successBg],
  ];

  for (const [label, fg, bg] of bodyText) {
    it(`${label} ≥ ${AA_TEXT}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  const largeOrUi: [string, string, string][] = [
    ["white on clay (clay buttons, large text)", white, clay],
    ["clay accent on paper (decorative / large)", clay, paper],
    ["forest on success background (UI)", forest, successBg],
  ];

  for (const [label, fg, bg] of largeOrUi) {
    it(`${label} ≥ ${AA_LARGE}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  }

  it("documents why the raw slate tone is not used for body text", () => {
    // The brief's slate (#7A8478) only reaches ~3.3:1 on paper, so body-size
    // text uses --slate-text instead. This assertion pins that reasoning.
    expect(contrast(token("slate"), paper)).toBeLessThan(AA_TEXT);
    expect(contrast(slateText, paper)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
