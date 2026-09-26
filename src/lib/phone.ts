// Phone number normalisation.
//
// We store two things for a member:
//   phone       — a readable display form, e.g. "+225 07 08 09 10 11"
//   phoneDigits — digits of dial code + number, e.g. "2250708091011" (unique)
//
// phoneDigits is what login-by-phone and the uniqueness check use, so the
// same local number can exist under two different country codes.
import { DEFAULT_COUNTRY, findCountry } from "./countries";

export type NormalizedPhone = { display: string; digits: string };

/** Keep digits only. "+225 07-08" -> "22507 08" -> "2250708". */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Combine a country (ISO code) and the number the member typed.
 * Returns null when the number is empty, or an error string when malformed.
 */
export function normalizePhone(
  countryCode: string,
  rawNumber: string,
): NormalizedPhone | null | { error: string } {
  const number = digitsOnly(rawNumber);
  if (number === "") return null;

  const country = findCountry(countryCode) ?? DEFAULT_COUNTRY;
  if (number.length < 4 || number.length > 15) {
    return { error: "Enter a valid phone number (4 to 15 digits)." };
  }

  const dialDigits = digitsOnly(country.dial);
  return {
    digits: dialDigits + number,
    display: `${country.dial} ${groupDigits(number)}`,
  };
}

/** "0708091011" -> "07 08 09 10 11" for readability. */
function groupDigits(number: string): string {
  return number.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/**
 * Candidate phoneDigits values for a login identifier typed without a
 * country dropdown. We try the digits as typed and, when the member typed a
 * local number, the same digits behind the studio's default dial code.
 */
export function loginPhoneCandidates(identifier: string): string[] {
  const digits = digitsOnly(identifier);
  if (digits.length < 4) return [];
  const candidates = new Set<string>([digits]);
  const trimmed = identifier.trim();
  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) {
    candidates.add(digitsOnly(DEFAULT_COUNTRY.dial) + digits);
  }
  return [...candidates];
}
