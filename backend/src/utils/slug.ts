import { randomUUID } from "crypto";

export const slugify = (input: string): string => {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (base.length === 0) {
    return randomUUID().slice(0, 8);
  }
  return base;
};

/**
 * Resolve a unique slug by appending -2, -3, ... if `exists` reports the
 * candidate is taken. Caller supplies a lookup that returns true when the
 * candidate is in use.
 */
export const uniqueSlug = async (
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> => {
  const root = slugify(base);
  let candidate = root;
  let suffix = 1;
  while (await exists(candidate)) {
    suffix += 1;
    candidate = `${root}-${suffix}`;
    if (suffix > maxAttempts) {
      candidate = `${root}-${randomUUID().slice(0, 8)}`;
      break;
    }
  }
  return candidate;
};
