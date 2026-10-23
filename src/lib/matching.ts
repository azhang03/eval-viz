// The match rule (Decisions 2 and 3), as in cmeval.metrics.matching. tests/truth.test.ts checks
// it against the real functions from codemem.

export type HitLike = { path: string; start_line: number | null; end_line: number | null };
export type SpanLike = { path: string; start: number; end: number };

/** Lines shared by both ranges / lines covered by either range. */
export function lineIou(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const inter = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart) + 1);
  const union = Math.max(aEnd, bEnd) - Math.min(aStart, bStart) + 1;
  return inter / union;
}

/** Does a hit find a gold class or function: same file, has lines, and inside it or IoU >= iou. */
export function hitMatches(hit: HitLike, span: SpanLike, iou: number): boolean {
  if (hit.path !== span.path || hit.start_line === null || hit.end_line === null) return false;
  if (span.start <= hit.start_line && hit.end_line <= span.end) return true; // the hit points into the gold item
  return lineIou(hit.start_line, hit.end_line, span.start, span.end) >= iou;
}

/** Shared lines of two ranges (for the view's "shared / either" text). */
export function sharedLines(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart) + 1);
}
