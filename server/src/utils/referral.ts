import crypto from "crypto";

const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters, excluding ambiguous 0, O, 1, I

/**
 * Generates a clean, unambiguous short referral code.
 * Example: REF-K8P2X9
 */
export function generateReferralCode(prefix = "REF", length = 6): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return `${prefix}-${code}`;
}
