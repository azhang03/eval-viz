// The pipeline map: stages, their steps, and the code that does each step.
// It links the 3D floor (page 1) to the explorer. Kept by hand; /vizup proposes changes.
// The stage status follows the newest manifest (here f70e851).

import type { DefId, RepoPath } from "../src/data/types";

/** Keys of the "look closer" views. Each view is a design decision, animated step by step. */
export type CloserKey = "labeler" | "hunks" | "split" | "iou";

export type StageStatus = "built" | "partial" | "planned";

export type Part = {
  /** Step name, shown on the floor and in the cards. */
  n: string;
  /** Block color on the floor (hex). */
  c?: number;
  /** A planned step with no code yet: drawn as a dashed ghost. */
  ghost?: boolean;
  closer?: CloserKey;
  /** The files of this step and the definitions it uses in each file. */
  use?: [RepoPath, DefId[]][];
  /** One or two sentences; small HTML is allowed. */
  d: string;
};

export type Stage = {
  id: "collect" | "run" | "score" | "report";
  name: string;
  feat: string;
  status: StageStatus;
  /** What the stage writes. */
  out: string;
  /** Machine color on the floor (hex). */
  color?: number;
  text: string;
  parts?: Part[];
};

const SRC = "eval/src/cmeval/";

export const STAGES: Stage[] = [

  { id: "collect", name: "Collect", feat: "F1 + F4", status: "built", out: "tasks/*.jsonl", color: 0xd4673f,
    text: "Builds answer keys. Reads SWE-bench rows, checks out the base commit, reads the fix diff, and marks the gold files, classes, and functions.",
    parts: [
      { n: "Start import", c: 0xe9b440, use: [[SRC + "cli.py", ["cmeval.cli.cmd_import"]], [SRC + "importers/swebench.py", ["cmeval.importers.swebench.import_swebench_verified", "cmeval.importers.swebench.balanced_order"]]],
        d: "<code>cmeval import</code> starts the importer. It takes SWE-bench rows in a balanced order over repos." },
      { n: "Time machine", c: 0x2f8f8a, use: [[SRC + "repos.py", ["cmeval.repos.read_file", "cmeval.repos.ensure_commit", "cmeval.repos.ensure_clone"]]],
        d: "Gives each file exactly as it was at the task's base commit, from a bare clone, with no checkout." },
      { n: "Diff reader", c: 0x5b6fb5, closer: "hunks", use: [[SRC + "patches.py", ["cmeval.patches.parse_patch", "cmeval.patches.align_file_diff"]]],
        d: "Reads the fix diff and finds the real changed lines, even when a hunk states the wrong line number." },
      { n: "Labeler", c: 0xd4673f, closer: "labeler", use: [[SRC + "labels.py", ["cmeval.labels.label_at_commit", "cmeval.labels.label_patch", "cmeval.labels.find_definitions"]]],
        d: "Turns the innermost function and class around each changed line gold." },
      { n: "Build and save", c: 0x6c5a49, closer: "split", use: [[SRC + "importers/swebench.py", ["cmeval.importers.swebench.row_to_task"]], [SRC + "tasks.py", ["cmeval.tasks.validate", "cmeval.tasks.save_tasks"]]],
        d: "Builds each task, validates it, and writes the answer key one JSON line for each task." },
    ] },
  { id: "run", name: "Run", feat: "F2 + F3", status: "built", out: "runs/<id>/<system>.jsonl", color: 0x2f8f8a,
    text: "Sends each query to each system through one plug, and saves the ranked hits and timings. For each repo, one index moves forward from commit to commit.",
    parts: [
      { n: "The plug", c: 0x2f8f8a, use: [[SRC + "retriever.py", ["cmeval.retriever.Retriever", "cmeval.retriever.check_hits"]]],
        d: "The interface every system implements, the <code>Hit</code> type, and the contract check." },
      { n: "System configs", c: 0xe9b440, use: [[SRC + "systems.py", ["cmeval.systems.load_systems", "cmeval.systems.make_system"]]],
        d: "Reads system configs (TOML) and builds each system from its adapter." },
      { n: "grep", c: 0x5b6fb5, use: [[SRC + "adapters/grep.py", ["cmeval.adapters.grep.GrepRetriever", "cmeval.adapters.grep.rg_count", "cmeval.adapters.grep.rank_files"]], [SRC + "adapters/keywords.py", ["cmeval.adapters.keywords.extract_keywords"]]],
        d: "The offline grep baseline (Decision 4): ripgrep over keywords from the issue, files ranked by match count." },
      { n: "grep-fn", c: 0xd4673f, use: [[SRC + "adapters/grep_fn.py", ["cmeval.adapters.grep_fn.GrepFnRetriever"]], [SRC + "adapters/grep.py", ["cmeval.adapters.grep.rg_files"]]],
        d: "grep plus the step an agent takes next: it returns the functions around the matching lines (Decision 4). grep-fn-plus turns on four options (Python files only, IDF weights, clean keywords, tests last) and is the baseline of the report." },
      { n: "codemem", c: 0x6c5a49, use: [[SRC + "adapters/codemem.py", ["cmeval.adapters.codemem.CodememRetriever"]]],
        d: "The only file in cmeval that imports codemem. It plugs codemem in through the same interface." },
      { n: "Runner", c: 0x2f8f8a, use: [[SRC + "run.py", ["cmeval.run.run", "cmeval.run.order_tasks"]], [SRC + "files.py", ["cmeval.files.FileLock", "cmeval.files.drop_unfinished_line"]], [SRC + "repos.py", ["cmeval.repos.discard_live"]], [SRC + "cli.py", ["cmeval.cli.cmd_run"]]],
        d: "Runs every system on every task. For each repo, tasks go in base-commit date order, so one index moves forward with updates (Decision 5). A stopped run resumes with the same results." },
      { n: "Merge runs", c: 0xe9b440, use: [[SRC + "merge.py", ["cmeval.merge.merge"]], [SRC + "cli.py", ["cmeval.cli.cmd_merge"]]],
        d: "<code>cmeval merge</code> adds a system that ran on its own (for example grep-fn-plus) to an earlier run of the same tasks, so one report compares them all." },
    ] },
  { id: "score", name: "Score", feat: "F3", status: "built", out: "metrics tables", color: 0x5b6fb5,
    text: "Reads saved run files and grades hits against gold at file, class, and function level.",
    parts: [
      { n: "Match hits", c: 0xe9b440, closer: "iou", use: [[SRC + "metrics/matching.py", ["cmeval.metrics.matching.hit_matches", "cmeval.metrics.matching.line_iou", "cmeval.metrics.matching.raw_relevance"]]],
        d: "Decision 2: a hit finds a gold function if it is inside it, or if line IoU is 0.5 or more." },
      { n: "Accuracy", c: 0x2f8f8a, use: [[SRC + "metrics/accuracy.py", ["cmeval.metrics.accuracy.accuracy_metrics"]]],
        d: "Recall@k, precision@k, success@k, and MRR, at file, class, and function level." },
      { n: "Tokens", c: 0xd4673f, use: [[SRC + "metrics/tokens.py", ["cmeval.metrics.tokens.token_metrics", "cmeval.metrics.tokens.AnthropicCounter"]]],
        d: "Tokens to the first relevant hit, and recall inside a token budget (Decision 6)." },
      { n: "Latency", c: 0x5b6fb5, use: [[SRC + "metrics/latency.py", ["cmeval.metrics.latency.search_latency", "cmeval.metrics.latency.index_costs"]]],
        d: "Search time, build and update time, and index size, from the run files." },
      { n: "Score a run", c: 0x6c5a49, use: [[SRC + "score.py", ["cmeval.score.score", "cmeval.score.run_tasks"]], [SRC + "cli.py", ["cmeval.cli.cmd_score"]]],
        d: "Reads a saved run and writes the metrics next to its files." },
    ] },
  { id: "report", name: "Report", feat: "F3", status: "built", out: "report.md", color: 0xe9b440,
    text: "Checks that index updates are valid, then turns the scores into tables with intervals and paired tests against the baseline, grep-fn-plus.",
    parts: [
      { n: "Update vs. rebuild", c: 0x2f8f8a, use: [[SRC + "compare.py", ["cmeval.compare.compare", "cmeval.compare.in_code"]], [SRC + "cli.py", ["cmeval.cli.cmd_compare"]]],
        d: "Decision 5: a run with index updates and a run with full rebuilds must find the same code. Required before any results are reported." },
      { n: "Intervals", c: 0x5b6fb5, use: [[SRC + "metrics/stats.py", ["cmeval.metrics.stats.bootstrap_ci", "cmeval.metrics.stats.resample_indexes", "cmeval.metrics.stats.quantile"]]],
        d: "A 95% bootstrap interval for each mean: 10,000 resamples with a fixed seed." },
      { n: "Paired tests", c: 0xd4673f, use: [[SRC + "metrics/stats.py", ["cmeval.metrics.stats.paired_bootstrap_ci", "cmeval.metrics.stats.wilcoxon", "cmeval.metrics.stats.holm"]]],
        d: "Each system against the baseline on the same tasks: the paired difference, the Wilcoxon test, and one Holm correction over the primary tests." },
      { n: "Write report", c: 0x6c5a49, use: [[SRC + "report.py", ["cmeval.report.report", "cmeval.report.Scores"]], [SRC + "cli.py", ["cmeval.cli.cmd_report"]]],
        d: "<code>cmeval report</code> writes <code>report.md</code>: main tables, paired comparisons, groups, the IoU check, latency, and task counts." },
    ] },
];
