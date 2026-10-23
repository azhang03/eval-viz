// The hunk search, as in cmeval.patches._find_hunk: try the stated index first, then the
// nearest exact match (1 up, 1 down, 2 up, 2 down, ...). tests/truth.test.ts checks it against
// the real function from codemem.

/** 0-based start index where `want` equals the base lines exactly, or null. */
export function findHunk(base: string[], want: string[], stated: number, lowest: number): number | null {
  if (want.length === 0) return lowest <= stated && stated <= base.length ? stated : null;
  for (const start of searchOrder(base.length, want.length, stated, lowest)) {
    if (want.every((line, j) => base[start + j] === line)) return start;
  }
  return null;
}

/** Every start index the search tries, in order. The hunk view animates this list. */
export function* searchOrder(baseLength: number, wantLength: number, stated: number, lowest: number): Generator<number> {
  const highest = baseLength - wantLength;
  const maxDistance = Math.max(stated - lowest, highest - stated, 0);
  for (let distance = 0; distance <= maxDistance; distance++) {
    const starts = distance === 0 ? [stated] : [stated - distance, stated + distance];
    for (const start of starts) if (lowest <= start && start <= highest) yield start;
  }
}
