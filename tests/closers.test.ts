// Every look-closer view must open from a step and link only code that exists.
import { describe, expect, it } from "vitest";
import { latestManifest } from "../src/data/load";
import { STAGES } from "../content/stages";
import { VIEWS } from "../src/closers/registry";

const manifest = await latestManifest();

describe("look-closer views", () => {
  it("every step's closer key has a view", () => {
    const keys = STAGES.flatMap((s) => (s.parts ?? []).map((p) => p.closer).filter((k): k is NonNullable<typeof k> => !!k));
    expect(keys.filter((k) => !(k in VIEWS))).toEqual([]);
  });
  it.each(Object.keys(VIEWS))("%s links only definitions that exist, and has steps", (key) => {
    const v = VIEWS[key as keyof typeof VIEWS]();
    expect(v.code.filter((id) => !(id in manifest.where))).toEqual([]);
    expect(v.steps.length).toBeGreaterThan(0);
    for (const s of v.steps) expect(s.d).not.toMatch(/undefined|NaN|null/);
  });
});
