// The hand-written content must point at code that exists in the newest manifest.
import { describe, expect, it } from "vitest";
import { latestManifest } from "../src/data/load";
import { EXPLANATIONS } from "../content/explanations";
import { STAGES, stepLabel } from "../content/stages";

const manifest = await latestManifest();

describe("content matches the newest manifest", () => {
  it("every explained definition exists", () => {
    const missing = Object.keys(EXPLANATIONS).filter((id) => !(id in manifest.where));
    expect(missing).toEqual([]);
  });

  it("every step uses files and definitions that exist, and each definition is in its file", () => {
    const problems: string[] = [];
    for (const stage of STAGES) {
      for (const part of stage.parts ?? []) {
        if (part.ghost && part.use) problems.push(`${stage.id} / ${part.n}: a ghost part has code`);
        if (!part.ghost && !part.use) problems.push(`${stage.id} / ${part.n}: a built part has no code`);
        for (const [file, ids] of part.use ?? []) {
          if (!(file in manifest.files)) problems.push(`${stage.id} / ${part.n}: no file ${file}`);
          for (const id of ids) {
            if (!(id in manifest.where)) problems.push(`${stage.id} / ${part.n}: no definition ${id}`);
            else if (manifest.where[id] !== file) problems.push(`${stage.id} / ${part.n}: ${id} is in ${manifest.where[id]}, not ${file}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("each route of COLLECT numbers its steps on its own", () => {
    const collect = STAGES.find((s) => s.id === "collect")!;
    expect((collect.parts ?? []).map((_, k) => stepLabel(collect, k))).toEqual(["S1", "G1", "G2", "G3", "G4", "G5", "1", "2", "3", "4"]);
    const run = STAGES.find((s) => s.id === "run")!;
    expect(stepLabel(run, 0)).toBe("1");
  });

  it("a built stage has no ghost parts, and a planned stage has no code", () => {
    for (const stage of STAGES) {
      const parts = stage.parts ?? [];
      if (stage.status === "built") expect(parts.filter((p) => p.ghost).map((p) => p.n)).toEqual([]);
      if (stage.status === "planned") expect(parts.filter((p) => p.use).map((p) => p.n)).toEqual([]);
    }
  });
});

// Not a failure: the list of public definitions that still show only their docstring.
it("coverage report", () => {
  const explained = new Set(Object.keys(EXPLANATIONS));
  const byModule = new Map<string, string[]>();
  for (const info of Object.values(manifest.files)) {
    for (const item of info.items) {
      if (item.name.startsWith("_") || explained.has(item.id)) continue;
      const list = byModule.get(info.module) ?? [];
      list.push(item.name);
      byModule.set(info.module, list);
    }
  }
  const total = [...byModule.values()].reduce((n, l) => n + l.length, 0);
  const lines = [...byModule].map(([mod, names]) => `  ${mod}: ${names.join(", ")}`);
  // vitest hides console output of passing tests, so write to stdout directly (no Node types needed)
  const stdout = (globalThis as { process?: { stdout: { write(text: string): void } } }).process?.stdout;
  stdout?.write(`coverage at ${manifest.short}: ${explained.size} explained, ${total} public definitions without an explanation\n${lines.join("\n")}\n`);
  expect(total).toBeGreaterThanOrEqual(0);
});
