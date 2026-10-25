import type { Fixture10908, FixtureB5, Manifest, ResultsFinal, Timeline } from "./types";
import timelineJson from "../../data/timeline.json";
import fixtureJson from "../../data/fixtures/10908.json";
import b5Json from "../../data/fixtures/b5.json";
import resultsJson from "../../data/results/dev50-final.json";

export const timeline = timelineJson as Timeline;
export const fixture10908 = fixtureJson as unknown as Fixture10908;
/** scikit-learn-10908 through the RUN and SCORE code (scripts/gen_examples.py). */
export const fixtureB5 = b5Json as unknown as FixtureB5;
/** The final dev run, made again by the real report code (scripts/gen_results.py). */
export const resultsFinal = resultsJson as unknown as ResultsFinal;

// One lazy chunk for each manifest, so a page loads only the commits it shows.
const manifests = import.meta.glob<Manifest>("../../data/manifest/*.json", { import: "default" });

/** Batch commits that have a manifest, oldest first (timeline order). */
export const batchCommits: string[] = timeline.phases.flatMap((p) => p.features.flatMap((f) => f.batches.map((b) => b.commit))).filter((c): c is string => c !== null);

export const latestCommit: string = (() => {
  const last = batchCommits[batchCommits.length - 1];
  if (!last) throw new Error("data/timeline.json has no batch with a commit");
  return last;
})();

export async function manifestFor(commit: string): Promise<Manifest> {
  const load = manifests[`../../data/manifest/${commit}.json`];
  if (!load) throw new Error(`no manifest for commit ${commit}; run npm run gen`);
  return load();
}

export function latestManifest(): Promise<Manifest> {
  return manifestFor(latestCommit);
}
