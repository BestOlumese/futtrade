/**
 * Username rules, shared by the server validator and the sign-up form so the
 * two can't drift. The client copy is a courtesy — the server is the authority.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Letters, numbers and underscore only. */
const SHAPE = /^[A-Za-z0-9_]+$/;

/**
 * Names that would let someone pass themselves off as the platform or as staff.
 * Compared case-insensitively, like the usernames themselves.
 */
const RESERVED = new Set([
  "admin", "administrator", "root", "system", "support", "help", "moderator",
  "mod", "staff", "official", "futtrade", "futtrade_official", "team",
  "security", "billing", "noreply", "no_reply", "api", "www", "me", "null",
  "undefined", "anonymous", "guest",
]);

export function isValidUsername(value: string): boolean {
  return (
    value.length >= USERNAME_MIN &&
    value.length <= USERNAME_MAX &&
    SHAPE.test(value)
  );
}

export function isReservedUsername(value: string): boolean {
  return RESERVED.has(value.toLowerCase());
}

/**
 * A specific reason, or null when the name is fine. Specific beats generic:
 * "3 more characters" tells someone what to do, "invalid username" doesn't.
 */
export function usernameProblem(value: string): string | null {
  if (value.length === 0) return null;
  if (value.length < USERNAME_MIN) {
    const short = USERNAME_MIN - value.length;
    return `${short} more character${short === 1 ? "" : "s"} needed.`;
  }
  if (value.length > USERNAME_MAX) {
    return `${USERNAME_MAX} characters maximum.`;
  }
  if (!SHAPE.test(value)) {
    return "Letters, numbers and underscore only.";
  }
  if (isReservedUsername(value)) {
    return "That username is reserved.";
  }
  return null;
}
