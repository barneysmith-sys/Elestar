export type AccountRole = "candidate" | "employer";

export function parseAccountRole(value: unknown): AccountRole | null {
  if (value === "candidate" || value === "creative") return "candidate";
  if (value === "employer" || value === "firm") return "employer";
  return null;
}

export function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function parsePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 8 || value.length > 128) return null;
  return value;
}

/** Login must accept whatever Auth stored — do not re-apply signup rules. */
export function parseLoginPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const password = value;
  if (!password || password.length > 128) return null;
  return password;
}
