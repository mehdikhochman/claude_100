// Password hashing with bcrypt (pure-JS implementation, works on Vercel).
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A real bcrypt hash of a throwaway password. When the account is unknown we
 * still compare against this so a login attempt takes the same time either
 * way (no timing hint about whether the email exists).
 */
export const DUMMY_HASH = "$2b$10$AC.rrYSe2qMm/cETgnAEDu9G0ayRa6aWhprHE4EUjoUgyPzwbHzRO";
