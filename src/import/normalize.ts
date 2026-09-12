/** NFKC, lowercase, collapse whitespace [D15]. */
export function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function contentFingerprint(
  title: string,
  description: string,
  subtaskTitles: readonly string[],
): string {
  return [
    normalizeText(title),
    normalizeText(description),
    ...subtaskTitles.map(normalizeText),
  ].join("\u001f");
}

/**
 * Possible-duplicate heuristic [D15]: normalised titles equal, or one contains
 * the other. Thresholds are otherwise deferred.
 */
export function titlesPossiblyDuplicate(a: string, b: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  return left === right || left.includes(right) || right.includes(left);
}
