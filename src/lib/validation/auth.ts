// Input validation for register / login (zod on every boundary).
import { z } from "zod";
import { COUNTRIES } from "../countries";

const countryCodes = COUNTRIES.map((c) => c.code) as [string, ...string[]];

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(80, "That name is a little long (80 characters max)."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(120, "That email is too long.")
      .pipe(z.email("Enter a valid email address.")),
    countryCode: z.enum(countryCodes, { error: "Choose a country." }),
    phoneNumber: z.string().trim().max(30, "That phone number is too long.").default(""),
    password: z.string().min(6, "Use at least 6 characters.").max(200, "That password is too long."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number.").max(120),
  password: z.string().min(1, "Enter your password.").max(200),
  returnUrl: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Turn a zod error into { fieldName: "first message" }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Read a FormData into a plain object of trimmed strings (files are skipped). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
