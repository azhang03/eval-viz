// The pipeline map: stages, their steps, and the code that does each step.
// It links the 3D floor (page 1) to the explorer. Kept by hand; /vizup proposes changes.
// The stage status follows the newest manifest (here 96464b4).

import type { DefId, RepoPath } from "../src/data/types";

/** Keys of the "look closer" views. Each view is a design decision, animated step by step. */
export type CloserKey = "labeler" | "hunks" | "split" | "iou" | "keywords" | "grepfn" | "grade" | "tokens" | "results" | "funnel" | "links" | "rewind";

export type StageStatus = "built" | "partial" | "planned";

export type Route = "swebench" | "fresh";

export type Part = {
  /** Step name, shown on the floor and in the cards. */
  n: string;
  /** Block color on the floor (hex). */
  c?: number;
  /** A planned step with no code yet: drawn as a dashed ghost. */
  ghost?: boolean;
  /** The route of a stage with two ways in (COLLECT). No route: the step is on both routes. */
  route?: Route;
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

/**
 * The label of step k. Most stages number their steps 1, 2, 3. A stage with two routes (COLLECT)
 * numbers each route on its own: S1 for SWE-bench, G1 to G5 for fresh tasks from GitHub, and 1 to 4
 * for the steps of both routes, so no route seems to start in the middle. Not F: F1 to F4 name the
 * features.
 */
export function stepLabel(stage: Stage, k: number): string {
  const parts = stage.parts ?? [];
  const part = parts[k];
  if (!part || !parts.some((p) => p.route)) return String(k + 1);
  const place = parts.slice(0, k + 1).filter((p) => p.route === part.route).length;
  return `${part.route === "swebench" ? "S" : part.route === "fresh" ? "G" : ""}${place}`;
}

const SRC = "eval/src/cmeval/";

export const STAGES: Stage[] = [

  { id: "collect", name: "Collect", feat: "F1 + F4", status: "built", out: "tasks/*.jsonl", color: 0xd4673f,
    text: "Builds the answer keys. A task is one real GitHub issue: its text is the search query, and the code just before the fix is what systems search. The fix itself tells which files, classes, and functions are the right answer (\"gold\"). Tasks come in two ways: from SWE-bench Verified, or fresh from GitHub, from fixes made after the model's training data ends. Both ways end in the same labeler and the same task format.",
    parts: [
      { n: "Start import", c: 0xe9b440, route: "swebench", use: [[SRC + "cli.py", ["cmeval.cli.cmd_import"]], [SRC + "importers/swebench.py", ["cmeval.importers.swebench.import_swebench_verified", "cmeval.importers.swebench.balanced_order"]]],
        d: "<code>cmeval import</code> reads SWE-bench rows (an issue, its repo, the commit before the fix, and the fix as a diff). It takes about the same number of rows from each repo, in a fixed order, so one big repo cannot fill the set." },
      { n: "Choose repos", c: 0x5b6fb5, route: "fresh", use: [[SRC + "cli.py", ["cmeval.cli.cmd_repo_stats"]], [SRC + "collect/repo_stats.py", ["cmeval.collect.repo_stats.collect_stats", "cmeval.collect.repo_stats.pr_funnel", "cmeval.collect.repo_stats.code_stats"]]],
        d: "<code>cmeval repo-stats</code> measures candidate repos: their size, their languages, a quick count of merged PRs that close one issue, and how much code codemem would index. People choose the repos from these numbers and list them in a config file. For fresh-v1: 7 Python repos of 16 candidates." },
      { n: "Search merged PRs", c: 0x2f8f8a, route: "fresh", use: [[SRC + "collect/search.py", ["cmeval.collect.search.search_merged_prs", "cmeval.collect.search.date_windows", "cmeval.collect.search.is_bot"]], [SRC + "github.py", ["cmeval.github.GitHub", "cmeval.github.cache_key"]]],
        d: "Lists every PR merged into the repo's main branch after the cutoff, through GitHub's search, 7 days at a time (GitHub gives at most 1,000 results for one search). Each answer is saved on disk, so a second run needs no network. Fixes opened before the cutoff and PRs by bots are dropped." },
      { n: "Find the issue", c: 0xd4673f, route: "fresh", closer: "links", use: [[SRC + "collect/links.py", ["cmeval.collect.links.find_links", "cmeval.collect.links.list_links", "cmeval.collect.links.regex_links"]]],
        d: "Finds the issue that each PR fixes, in two ways: GitHub's own list of the issues a PR closes, and SWE-bench's rule, which looks for words like \"fixes #123\". A PR must link exactly one issue. Each task records which way found its link." },
      { n: "Issue as it was", c: 0xe9b440, route: "fresh", closer: "rewind", use: [[SRC + "collect/issues.py", ["cmeval.collect.issues.fetch_issues", "cmeval.collect.issues.body_at", "cmeval.collect.issues.title_at", "cmeval.collect.issues.build_query", "cmeval.collect.issues.leak"]], [SRC + "collect/candidates.py", ["cmeval.collect.candidates.collect_candidates"]]],
        d: "Rebuilds the issue as it was when the fix PR was opened, from GitHub's edit history (Decision 8). A later edit can describe the fix, so the query uses the earlier title and body. A query that names the fix PR or a fix commit is dropped." },
      { n: "Base and patch", c: 0x6c5a49, route: "fresh", closer: "funnel", use: [[SRC + "collect/tasks_build.py", ["cmeval.collect.tasks_build.candidate_to_task", "cmeval.collect.tasks_build.merge_base", "cmeval.collect.tasks_build.fetch_pr_files"]], [SRC + "repos.py", ["cmeval.repos.parents", "cmeval.repos.diff", "cmeval.repos.apply_check"]]],
        d: "Finds the base commit, the code just before the fix, from the way the PR was merged (Decision 7). Then it makes the patch itself with git, so the patch and the base always match. The patch must touch exactly the PR's files, apply at the base, and change 1 to 5 code files and at most 200 lines." },
      { n: "Time machine", c: 0x2f8f8a, use: [[SRC + "repos.py", ["cmeval.repos.read_file", "cmeval.repos.ensure_commit", "cmeval.repos.ensure_clone"]]],
        d: "Gives each file exactly as it was at the task's base commit: the commit just before the fix. It reads the file from a local copy of the repo's history, so nothing has to be checked out." },
      { n: "Diff reader", c: 0x5b6fb5, closer: "hunks", use: [[SRC + "patches.py", ["cmeval.patches.parse_patch", "cmeval.patches.align_file_diff"]]],
        d: "Reads the fix as a diff. A diff is split into hunks: small blocks of changed lines, each with a stated line number. The stated number can be wrong, so this step finds where each hunk really fits in the old file." },
      { n: "Labeler", c: 0xd4673f, closer: "labeler", use: [[SRC + "labels.py", ["cmeval.labels.label_at_commit", "cmeval.labels.label_patch", "cmeval.labels.find_definitions"]]],
        d: "Decides what counts as the right answer. For each line the fix changed, the function around it, and the class around that, become gold: the code a search system should find. In scikit-learn-10908 the fix changes line 995, so <code>CountVectorizer.get_feature_names</code> is the gold function." },
      { n: "Build and save", c: 0x6c5a49, closer: "split", use: [[SRC + "importers/swebench.py", ["cmeval.importers.swebench.row_to_task"]], [SRC + "collect/tasks_build.py", ["cmeval.collect.tasks_build.build_tasks", "cmeval.collect.tasks_build.write_task_set"]], [SRC + "tasks.py", ["cmeval.tasks.validate", "cmeval.tasks.save_tasks"]], [SRC + "cli.py", ["cmeval.cli.cmd_collect"]]],
        d: "Builds each task (query, base commit, gold labels), checks it, gives it its split (SWE-bench tasks are always dev; fresh tasks are split dev or test by a hash of their ID), and writes the answer key: one JSON line for each task. Fresh tasks also get a meta file with the funnel: the count after each step, and why each PR was dropped." },
    ] },
  { id: "run", name: "Run", feat: "F2 + F3", status: "built", out: "runs/<id>/<system>.jsonl", color: 0x2f8f8a,
    text: "Runs every search system on every task and saves what each one returns. A task is one real GitHub issue, plus the commit just before its fix. For each repo, one copy of the code (the worktree) moves forward from task to task.",
    parts: [
      { n: "The plug", c: 0x2f8f8a, use: [[SRC + "retriever.py", ["cmeval.retriever.Retriever", "cmeval.retriever.check_hits"]]],
        d: "The one interface that every search system implements: build or update an index, then <code>search(query, k)</code> returns a ranked list of hits (best first). <code>check_hits</code> refuses a list that breaks the rules, for example a line hit with no line numbers." },
      { n: "System configs", c: 0xe9b440, use: [[SRC + "systems.py", ["cmeval.systems.load_systems", "cmeval.systems.make_system"]]],
        d: "Reads <code>configs/baseline.toml</code> and makes each system from it. Today there are 6 systems, from 3 adapters: grep, grep-fn, and codemem." },
      { n: "grep", c: 0x5b6fb5, closer: "keywords", use: [[SRC + "adapters/grep.py", ["cmeval.adapters.grep.GrepRetriever", "cmeval.adapters.grep.rg_count", "cmeval.adapters.grep.rank_files"]], [SRC + "adapters/keywords.py", ["cmeval.adapters.keywords.extract_keywords"]]],
        d: "The simplest baseline (Decision 4). It takes keywords from the issue text, runs ripgrep over the repo, and ranks files by how many keyword matches they have." },
      { n: "grep-fn", c: 0xd4673f, closer: "grepfn", use: [[SRC + "adapters/grep_fn.py", ["cmeval.adapters.grep_fn.GrepFnRetriever"]], [SRC + "adapters/grep.py", ["cmeval.adapters.grep.rg_files", "cmeval.adapters.grep.preview_line"]]],
        d: "grep plus the next step an agent takes: it returns the function around each matching line, so grep can be graded at function level. grep-fn-plus adds four options: Python files only, rare words count more (IDF), noisy keywords dropped, test files last. grep-fn-plus is the baseline of the report." },
      { n: "codemem", c: 0x6c5a49, use: [[SRC + "adapters/codemem.py", ["cmeval.adapters.codemem.CodememRetriever"]]],
        d: "Our tool, plugged in through the same interface. Its three systems (bm25, +code, +usage) differ only in their search signals, so they share one index: one build, three searches." },
      { n: "Runner", c: 0x2f8f8a, use: [[SRC + "run.py", ["cmeval.run.run", "cmeval.run.order_tasks"]], [SRC + "files.py", ["cmeval.files.FileLock", "cmeval.files.drop_unfinished_line"]], [SRC + "repos.py", ["cmeval.repos.discard_live"]], [SRC + "cli.py", ["cmeval.cli.cmd_run"]]],
        d: "Runs every system on every task. For each repo, tasks go in commit-date order, so one index moves forward with small updates instead of full rebuilds (Decision 5). A stopped run continues and gives the same results." },
      { n: "Merge runs", c: 0xe9b440, use: [[SRC + "merge.py", ["cmeval.merge.merge"]], [SRC + "cli.py", ["cmeval.cli.cmd_merge"]]],
        d: "<code>cmeval merge</code> writes a new run with the systems of two runs of the same tasks, so one report compares them all. The two runs do not change. Example: the early dev run <code>2026-10-23-dev50-final</code> joins its 3 grep systems and 3 codemem systems this way." },
    ] },
  { id: "score", name: "Score", feat: "F3", status: "built", out: "metrics tables", color: 0x5b6fb5,
    text: "Grades each saved run. For every task it compares each system's ranked list of hits with the answer key (the files, classes, and functions that the real fix changed), and it computes accuracy, reading cost in tokens, and speed.",
    parts: [
      { n: "Match hits", c: 0xe9b440, closer: "iou", use: [[SRC + "metrics/matching.py", ["cmeval.metrics.matching.hit_matches", "cmeval.metrics.matching.line_iou", "cmeval.metrics.matching.raw_relevance"]]],
        d: "Decides which hits are right. A hit is one search result: a file, or a range of lines in a file. A hit finds the gold function (the function the real fix changed) if it lies inside it, or if their line ranges overlap by at least half (line IoU 0.5, Decision 2)." },
      { n: "Accuracy", c: 0x2f8f8a, closer: "grade", use: [[SRC + "metrics/accuracy.py", ["cmeval.metrics.accuracy.accuracy_metrics"]]],
        d: "Counts how early the right answers come. recall@10: the share of gold items in the first 10 hits. MRR: 1 divided by the rank of the first right hit (rank 6 gives 1/6). success@10: 1 only if every gold item is in the first 10. At file, class, and function level." },
      { n: "Tokens", c: 0xd4673f, closer: "tokens", use: [[SRC + "metrics/tokens.py", ["cmeval.metrics.tokens.token_metrics", "cmeval.metrics.tokens.AnthropicCounter"]]],
        d: "Measures reading cost. An agent must read each hit, and tokens are the units of text a model reads and is paid for. Tokens to first: what the agent reads, in rank order, until the first right hit. Recall in a budget: the share of gold found if the agent can read only 1,000 or 4,000 tokens (Decision 6)." },
      { n: "Latency", c: 0x5b6fb5, use: [[SRC + "metrics/latency.py", ["cmeval.metrics.latency.search_latency", "cmeval.metrics.latency.index_costs"]]],
        d: "Measures speed: how long each search took, and how long it took to build or update the index. The numbers come from the run files." },
      { n: "Score a run", c: 0x6c5a49, use: [[SRC + "score.py", ["cmeval.score.score", "cmeval.score.run_tasks"]], [SRC + "cli.py", ["cmeval.cli.cmd_score"]]],
        d: "Writes every number. <code>scores.jsonl</code> has one row for each task, system, level, overlap threshold, and metric. <code>summary.csv</code> has the average of each metric over all tasks." },
    ] },
  { id: "report", name: "Report", feat: "F3", status: "built", out: "report.md", color: 0xe9b440,
    text: "Turns the scores of a run into a report. First a check makes sure that the index shortcut used in RUN gives the same results as full rebuilds. Then the report gives each mean with a 95% interval, and compares each codemem system with the strong grep baseline (grep-fn-plus) on the same tasks.",
    parts: [
      { n: "Update vs. rebuild", c: 0x2f8f8a, use: [[SRC + "compare.py", ["cmeval.compare.compare", "cmeval.compare.in_code", "cmeval.compare.code"]], [SRC + "cli.py", ["cmeval.cli.cmd_compare"]]],
        d: "RUN updates one index from task to task instead of building it again, because a full build is slow. This check runs the same tasks both ways and compares them: the same top 10 hits on at least 95% of tasks, and averages within 0.01 (tokens within 1%). Only then can the results be trusted (Decision 5)." },
      { n: "Intervals", c: 0x5b6fb5, use: [[SRC + "metrics/stats.py", ["cmeval.metrics.stats.bootstrap_ci", "cmeval.metrics.stats.resample_indexes", "cmeval.metrics.stats.quantile"]]],
        d: "A mean over a few tasks could be different on other tasks. The bootstrap draws the tasks again, with replacement, 10,000 times; the middle 95% of those means is the interval. A wide interval means an unsure mean." },
      { n: "Paired tests", c: 0xd4673f, use: [[SRC + "metrics/stats.py", ["cmeval.metrics.stats.paired_bootstrap_ci", "cmeval.metrics.stats.wilcoxon", "cmeval.metrics.stats.holm"]]],
        d: "Compares two systems on the same tasks: one difference for each task, then the Wilcoxon test (do the differences lean one way more than chance?). Many tests give more false alarms by chance, so one Holm correction covers the primary tests, which are fixed before the results." },
      { n: "Write report", c: 0x6c5a49, closer: "results", use: [[SRC + "report.py", ["cmeval.report.report", "cmeval.report.Scores"]], [SRC + "cli.py", ["cmeval.cli.cmd_report"]]],
        d: "<code>cmeval report</code> writes <code>report.md</code>: main tables at file, function, and class level, the paired comparisons, group tables, the IoU check, latency and size, and task counts. The same scores always give the same report." },
    ] },
];
