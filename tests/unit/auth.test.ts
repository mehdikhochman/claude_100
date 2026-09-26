import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/token";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { hashPassword, verifyPassword, DUMMY_HASH } from "@/lib/auth/password";
import { loginPhoneCandidates, normalizePhone } from "@/lib/phone";
import { COUNTRIES, flagEmoji } from "@/lib/countries";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation/auth";

describe("session token", () => {
  it("round-trips a signed JWT", async () => {
    const token = await createSessionToken({ userId: "user_1", role: "ADMIN" });
    expect(await verifySessionToken(token)).toEqual({ userId: "user_1", role: "ADMIN" });
  });

  it("rejects tampered or garbage tokens", async () => {
    const token = await createSessionToken({ userId: "user_1", role: "MEMBER" });
    expect(await verifySessionToken(token.slice(0, -3) + "abc")).toBeNull();
    expect(await verifySessionToken("not-a-token")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});

describe("safeReturnUrl", () => {
  it("accepts local paths", () => {
    expect(safeReturnUrl("/schedule?day=1")).toBe("/schedule?day=1");
  });
  it("rejects anything that could leave the site", () => {
    expect(safeReturnUrl("https://evil.com")).toBe("/dashboard");
    expect(safeReturnUrl("//evil.com")).toBe("/dashboard");
    expect(safeReturnUrl("/\\evil.com")).toBe("/dashboard");
    expect(safeReturnUrl("javascript:alert(1)")).toBe("/dashboard");
    expect(safeReturnUrl("")).toBe("/dashboard");
    expect(safeReturnUrl(null, "/admin")).toBe("/admin");
  });
  it("never loops back to the auth pages", () => {
    expect(safeReturnUrl("/login?returnUrl=/x")).toBe("/dashboard");
    expect(safeReturnUrl("/register")).toBe("/dashboard");
  });
});

describe("passwords", () => {
  it("hashes and verifies with bcrypt", async () => {
    const hash = await hashPassword("secret6");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("secret6", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("has a valid dummy hash for constant-time failures", async () => {
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
  });
});

describe("phone normalisation", () => {
  it("builds display + digits from country and number", () => {
    expect(normalizePhone("CI", "07 08 09 10 11")).toEqual({
      display: "+225 07 08 09 10 11",
      digits: "2250708091011",
    });
  });
  it("allows the same local number under different country codes", () => {
    const ci = normalizePhone("CI", "0708091011");
    const fr = normalizePhone("FR", "0708091011");
    expect(ci && "digits" in ci && fr && "digits" in fr && ci.digits !== fr.digits).toBe(true);
  });
  it("treats an empty number as 'no phone'", () => {
    expect(normalizePhone("CI", "   ")).toBeNull();
  });
  it("rejects nonsense", () => {
    expect(normalizePhone("CI", "12")).toEqual({ error: expect.stringContaining("valid phone") });
  });
  it("tries the studio dial code for local numbers at login", () => {
    expect(loginPhoneCandidates("07 08 09 10 11")).toEqual(["0708091011", "2250708091011"]);
    expect(loginPhoneCandidates("+225 07 08 09 10 11")).toEqual(["2250708091011"]);
  });
});

describe("countries", () => {
  it("has every country with a unique ISO code and Côte d'Ivoire as default", () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    expect(codes.size).toBe(COUNTRIES.length);
    expect(COUNTRIES.length).toBeGreaterThan(230);
    expect(COUNTRIES.find((c) => c.code === "CI")?.dial).toBe("+225");
    expect(flagEmoji("CI")).toBe("🇨🇮");
  });
});

describe("auth schemas", () => {
  it("reports field-level errors and lowercases email", () => {
    const result = registerSchema.safeParse({
      name: "A",
      email: "Person@Example.COM",
      countryCode: "CI",
      phoneNumber: "",
      password: "123",
      confirmPassword: "456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.name).toMatch(/full name/);
      expect(errors.password).toMatch(/6 characters/);
      expect(errors.confirmPassword).toMatch(/match/);
      expect(errors.email).toBeUndefined();
    }
    const ok = registerSchema.safeParse({
      name: "Awa Koné",
      email: "Person@Example.COM",
      countryCode: "CI",
      phoneNumber: "",
      password: "secret6",
      confirmPassword: "secret6",
    });
    expect(ok.success && ok.data.email).toBe("person@example.com");
  });
  it("requires an identifier and password to log in", () => {
    const result = loginSchema.safeParse({ identifier: "", password: "" });
    expect(result.success).toBe(false);
  });
});
