// The TypeScript copies of cmeval rules must give the same answers as the real Python code.
// data/checks/expected.json comes from scripts/check.py, which runs the real functions.
import { describe, expect, it } from "vitest";
import expected from "../data/checks/expected.json";
import { fixture10908 } from "../src/data/load";
import { DEV_PERCENT, SPLIT_SEED, splitOf } from "../src/lib/split";
import { findHunk } from "../src/lib/hunk";
import { hitMatches, lineIou } from "../src/lib/matching";

describe("split rule (tasks.assign_split)", () => {
  it("uses the same seed and dev share as the code", () => {
    expect(SPLIT_SEED).toBe(expected.seed);
    expect(DEV_PERCENT).toBe(expected.devPercent);
  });
  it.each(expected.split)("$id", ({ id, digest, split }) => {
    const r = splitOf(id);
    expect(r.hex).toBe(digest);
    expect(r.split).toBe(split);
  });
});

describe("hunk search (patches._find_hunk)", () => {
  const base = fixture10908.hunk.lines;
  it.each(expected.hunk)("$name", ({ want, stated, lowest, found }) => {
    expect(findHunk(base, want, stated, lowest)).toBe(found);
  });
  it("the fixture says what the hunk view shows: 971 fits at 993", () => {
    expect(fixture10908.hunk.stated).toBe(971);
    expect(fixture10908.hunk.found).toBe(993);
  });
});

describe("match rule (metrics.matching.hit_matches, line_iou)", () => {
  it.each(expected.match)("hit $hit at $level level, IoU $iou", ({ hitPath, start, end, span, lineIou: want, matches, iou }) => {
    const [s0, s1] = span as [number, number];
    if (start !== null && end !== null) expect(lineIou(start, end, s0, s1)).toBeCloseTo(want as number, 12);
    expect(hitMatches({ path: hitPath, start_line: start, end_line: end }, { path: "sklearn/feature_extraction/text.py", start: s0, end: s1 }, iou)).toBe(matches);
  });
});
