/**
 * Converts text to a clean URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Robustly checks if a club's name matches an incoming slug,
 * handling variations like "and" vs "&" vs omitted "and".
 */
export function matchesClubSlug(clubName: string, querySlug: string): boolean {
  const s1 = slugify(clubName);
  const s2 = slugify(querySlug);
  if (s1 === s2) return true;

  // Also compare without "-and-" stopwords
  const clean1 = s1.replace(/-and-/g, "-");
  const clean2 = s2.replace(/-and-/g, "-");
  if (clean1 === clean2) return true;

  return clean1.includes(clean2) || clean2.includes(clean1);
}
