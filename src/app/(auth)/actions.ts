"use server";
// Register / login / logout Server Actions.
//
// Both forms use useActionState, so each action receives the previous state
// and the FormData, and returns { errors, values } on failure. On success it
// sets the session cookie and redirects (redirect() throws, so it must be
// called outside try/catch).
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { setFlash } from "@/lib/flash";
import { loginPhoneCandidates, normalizePhone } from "@/lib/phone";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import {
  LIMITS,
  clearRateLimit,
  clientIpFromHeaders,
  hitRateLimit,
  rateLimitMessage,
} from "@/lib/rate-limit";
import { fieldErrors, formDataToObject, loginSchema, registerSchema } from "@/lib/validation/auth";

export type AuthFormState = {
  /** Field name -> message. "form" is the general, non-field error. */
  errors?: Record<string, string>;
  /** What the member typed, so the form can keep it after an error. */
  values?: Record<string, string>;
};

/** Never reveal whether the account or the password was the problem. */
const LOGIN_FAILED = "We couldn't sign you in. Check your details and try again.";

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = formDataToObject(formData);
  const values = {
    name: raw.name ?? "",
    email: raw.email ?? "",
    countryCode: raw.countryCode ?? DEFAULT_COUNTRY_CODE,
    phoneNumber: raw.phoneNumber ?? "",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const ip = clientIpFromHeaders(await headers());
  const limit = await hitRateLimit(`register:ip:${ip}`, LIMITS.registerPerIp.limit, LIMITS.registerPerIp.windowMs);
  if (!limit.ok) return { errors: { form: rateLimitMessage(limit) }, values };

  const phone = normalizePhone(parsed.data.countryCode, parsed.data.phoneNumber);
  if (phone && "error" in phone) return { errors: { phoneNumber: phone.error }, values };

  const [emailTaken, phoneTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
    phone ? prisma.user.findUnique({ where: { phoneDigits: phone.digits }, select: { id: true } }) : null,
  ]);
  const errors: Record<string, string> = {};
  if (emailTaken) errors.email = "An account with this email already exists. Try logging in.";
  if (phoneTaken) errors.phoneNumber = "An account with this phone number already exists.";
  if (Object.keys(errors).length > 0) return { errors, values };

  let user: { id: string; role: "MEMBER" | "ADMIN"; name: string };
  try {
    user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: phone?.display ?? null,
        phoneDigits: phone?.digits ?? null,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: { id: true, role: true, name: true },
    });
  } catch (error) {
    // Two people registering the same email at the same instant: the unique
    // index wins and we show the same friendly message.
    if (isUniqueViolation(error)) {
      return { errors: { form: "That email or phone number was just taken. Please try again." }, values };
    }
    throw error;
  }

  await setSessionCookie(user);
  await setFlash("success", `Welcome to LEGACY, ${user.name.split(" ")[0]}. Your account is ready.`);
  redirect("/dashboard");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = formDataToObject(formData);
  const values = { identifier: raw.identifier ?? "", returnUrl: raw.returnUrl ?? "" };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const identifier = parsed.data.identifier.toLowerCase();
  const ip = clientIpFromHeaders(await headers());
  const accountKey = `login:account:${identifier}`;
  const [ipLimit, accountLimit] = await Promise.all([
    hitRateLimit(`login:ip:${ip}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowMs),
    hitRateLimit(accountKey, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs),
  ]);
  if (!ipLimit.ok || !accountLimit.ok) {
    return { errors: { form: rateLimitMessage(ipLimit.ok ? accountLimit : ipLimit) }, values };
  }

  // Email or phone? Anything with an @ is treated as an email.
  const user = identifier.includes("@")
    ? await prisma.user.findUnique({ where: { email: identifier } })
    : await prisma.user.findFirst({ where: { phoneDigits: { in: loginPhoneCandidates(identifier) } } });

  // Always run bcrypt so timing does not reveal whether the account exists.
  const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) return { errors: { form: LOGIN_FAILED }, values };

  await clearRateLimit(accountKey);
  await setSessionCookie(user);

  const fallback = user.role === "ADMIN" ? "/admin" : "/dashboard";
  redirect(safeReturnUrl(parsed.data.returnUrl, fallback));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  await setFlash("info", "You have been logged out.");
  redirect("/");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}
