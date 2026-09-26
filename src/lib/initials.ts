/** Avatar initials: first letters of the first and last word ("Rive QA Main" -> "RM"), or two letters of a single word. */
export function initialsOf(name: string | null | undefined, fallback = "U"): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) || [];
  if (!words.length) return fallback;
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}
