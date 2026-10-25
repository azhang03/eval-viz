// The generated example and result data must be fresh and agree with themselves.
// The numbers come from the real cmeval code (scripts/gen_examples.py, scripts/gen_results.py).
import { describe, expect, it } from "vitest";
import { fixtureB5, latestCommit, resultsFinal } from "../src/data/load";

describe("generated data is fresh", () => {
  it("b5.json was made at the newest timeline commit", () => expect(fixtureB5.rev).toBe(latestCommit));
  it("dev50-final.json was made at the newest timeline commit", () => expect(resultsFinal.rev).toBe(latestCommit));
});

describe("b5 examples agree with themselves", () => {
  it("the keyword trace keeps exactly the final list", () => {
    expect(fixtureB5.keywords.trace.filter((t) => t.status === "kept").map((t) => t.word)).toEqual(fixtureB5.keywords.final);
  });
  it("every token count is from the cache, not an estimate", () => {
    for (const s of Object.values(fixtureB5.systems)) expect(s.grade.estimated.slice(0, s.top.length).every((e) => !e)).toBe(true);
  });
  it.each([500, 1000, 2000, 4000, 8000])("recall within %i tokens agrees with the running totals (whole hits only)", (budget) => {
    for (const s of Object.values(fixtureB5.systems)) {
      const g = s.grade, fn = g.function;
      let spent = 0, k = 0;
      while (k < g.tokens.length && spent + g.tokens[k]! <= budget) spent += g.tokens[k++]!;
      const found = fn.relevance.slice(0, k).some((r) => r.length > 0);
      expect(found).toBe((fn.metrics[`recall@budget${budget}`] ?? 0) > 0);
    }
  });
  it("at every level, the stored rank of the first right item agrees with its MRR", () => {
    const lists = [...Object.values(fixtureB5.systems).map((s) => s.grade), fixtureB5.grep.grade];
    for (const g of lists) for (const lv of ["file", "class", "function"] as const) {
      const level = g[lv];
      if (!level) continue;
      expect(level.metrics.mrr).toBeCloseTo(level.first === null ? 0 : 1 / level.first, 6);
    }
  });
  it("tokens to first is the running total at the first right hit", () => {
    for (const s of Object.values(fixtureB5.systems)) {
      const g = s.grade, first = g.function.first;
      const total = first === null ? null : g.tokens.slice(0, first).reduce((a, b) => a + b, 0);
      expect(g.function.metrics.tokens_to_first).toBe(total);
    }
  });
});

describe("final results", () => {
  it("has the 6 primary tests of the design (3 codemem systems x 2 metrics)", () => {
    expect(resultsFinal.primary.length).toBe(6);
    expect(new Set(resultsFinal.primary.map((p) => p.system))).toEqual(new Set(resultsFinal.primary_systems));
  });
  it("the update vs. rebuild check passed", () => expect(resultsFinal.b4.result).toBe("PASS"));
});
