import { afterEach, describe, expect, it } from "vitest";
import { getDatabaseUrl, readEnv } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("readEnv", () => {
  it("treats empty and whitespace values as missing", () => {
    process.env.X_TEST = "";
    expect(readEnv("X_TEST")).toBeUndefined();
    process.env.X_TEST = "   ";
    expect(readEnv("X_TEST")).toBeUndefined();
    process.env.X_TEST = " value ";
    expect(readEnv("X_TEST")).toBe("value");
  });
});

describe("getDatabaseUrl", () => {
  it("skips empty DATABASE_URL and falls back to the next candidate", () => {
    process.env.DATABASE_URL = "";
    process.env.POSTGRES_PRISMA_URL = "";
    process.env.POSTGRES_URL = "postgres://u:p@host/db";
    expect(getDatabaseUrl()).toBe("postgres://u:p@host/db");
  });

  it("skips prisma+postgres:// (Accelerate) URLs the pg adapter cannot use", () => {
    process.env.DATABASE_URL = "prisma+postgres://accelerate.prisma-data.net/?api_key=x";
    process.env.POSTGRES_URL = "postgresql://u:p@host/db";
    expect(getDatabaseUrl()).toBe("postgresql://u:p@host/db");
  });

  it("throws a helpful error when nothing usable is set", () => {
    for (const k of ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
      delete process.env[k];
    }
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL/);
  });
});
