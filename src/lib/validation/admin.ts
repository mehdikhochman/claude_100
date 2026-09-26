// Validation for the admin forms (classes and sessions).
import { z } from "zod";

export const classSchema = z.object({
  name: z.string().trim().min(2, "Give the class a name.").max(60, "Keep the name under 60 characters."),
  type: z.string().trim().min(2, "Add a type, e.g. Pilates or Run.").max(40, "Keep the type under 40 characters."),
  durationMinutes: z.coerce
    .number({ error: "Enter the duration in minutes." })
    .int("Whole minutes only.")
    .min(10, "At least 10 minutes.")
    .max(240, "At most 240 minutes."),
  level: z.string().trim().min(2, "Add a level, e.g. Beginner.").max(40, "Keep the level under 40 characters."),
  description: z.string().trim().min(10, "Describe the class in a sentence or two.").max(600, "Keep the description under 600 characters."),
});

export type ClassInput = z.infer<typeof classSchema>;

export const sessionSchema = z.object({
  classId: z.string().min(1, "Choose a class."),
  coachName: z.string().trim().min(2, "Add the coach's name.").max(60, "Keep the coach name under 60 characters."),
  /** datetime-local value in studio time, e.g. "2026-07-03T07:00". Parsed by the action. */
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Pick a date and time."),
  capacity: z.coerce
    .number({ error: "Enter the capacity." })
    .int("Whole numbers only.")
    .min(1, "At least 1 spot.")
    .max(200, "At most 200 spots."),
});

export type SessionInput = z.infer<typeof sessionSchema>;
