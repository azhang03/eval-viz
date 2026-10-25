// The fresh-task views join data by hand in one place: the drop reasons of each funnel group.
import { describe, expect, it } from "vitest";
import { fixtureFresh as F } from "../src/data/load";
import { FUNNEL_GROUPS, dropTotals } from "../src/closers/funnel";

describe("the funnel view", () => {
  const drops = dropTotals();
  it.each(FUNNEL_GROUPS.map((g, i) => [i, g] as const))("group %i: the reasons add up to the drop", (_, g) => {
    const sum = g.reasons.reduce((n, r) => n + (drops[r] ?? 0), 0);
    expect(sum).toBe((F.total[g.from] ?? 0) - (F.total[g.to] ?? 0));
  });
  it("every drop reason belongs to a group", () => {
    const known = new Set<string>(FUNNEL_GROUPS.flatMap((g) => [...g.reasons]));
    expect(Object.keys(drops).filter((r) => !known.has(r))).toEqual([]);
  });
});
