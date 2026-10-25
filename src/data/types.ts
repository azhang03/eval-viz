// The shape of the generated data in data/. scripts/gen_manifest.py and scripts/gen_fixtures.py write it.

/** A dotted definition ID, for example "cmeval.labels.label_patch" or "cmeval.retriever.Retriever.search". */
export type DefId = string;
/** A repo-relative path, for example "eval/src/cmeval/labels.py". */
export type RepoPath = string;

export type TreeNode = {
  name: string;
  type: "dir" | "file";
  path?: RepoPath;
  /** Set for files the explainer skips, with the reason. */
  boilerplate?: string;
  children?: TreeNode[];
};

export type Method = { id: DefId; name: string; sig: string; doc: string; line: number; end: number };

export type FunctionDef = { id: DefId; kind: "function"; name: string; sig: string; doc: string; line: number; end: number };

export type ClassDef = {
  id: DefId;
  kind: "class";
  name: string;
  bases: string[];
  doc: string;
  line: number;
  end: number;
  methods: Method[];
};

export type Definition = FunctionDef | ClassDef;

export type ModuleInfo = { module: string; doc: string; lines: number; items: Definition[] };

export type Manifest = {
  commit: string;
  short: string;
  date: string;
  subject: string;
  tree: TreeNode;
  files: Record<RepoPath, ModuleInfo>;
  /** Definitions in cmeval that each function or method calls. */
  calls: Record<DefId, DefId[]>;
  calledBy: Record<DefId, DefId[]>;
  /** The file of each definition. */
  where: Record<DefId, RepoPath>;
};

export type Batch = { id: string; title: string; commit: string | null; date: string | null; added: string };
export type Feature = { id: string; title: string; batches: Batch[] };
export type Phase = { id: string; title: string; features: Feature[] };
export type Timeline = { phases: Phase[] };

export type Span = { path: RepoPath; start: number; end: number; symbol: string | null };

/** One line of an answer key (tasks/*.jsonl). Only the fields the site uses are typed. */
export type TaskRecord = {
  id: string;
  repo: string;
  base_commit: string;
  query: string;
  gold: { files: RepoPath[]; classes: Span[]; functions: Span[]; lines: Span[] };
  unretrievable: { files: RepoPath[]; classes: Span[]; functions: Span[] };
  tags: Record<string, unknown>;
  labeler: string;
  [field: string]: unknown;
};

export type HunkExample = {
  path: RepoPath;
  baseCommit: string;
  fileLines: number;
  header: string;
  /** Hunk lines with their first character: " " context, "-" removed, "+" added. */
  body: string[];
  /** 1-based line the hunk header states, and the line where it really fits. */
  stated: number;
  found: number;
  /** Base lines from line `from` on. */
  from: number;
  lines: string[];
};

export type Fixture10908 = {
  task: { file: string; rev: string; bytes: number; record: TaskRecord };
  hunk: HunkExample;
};

// ---- B5 examples (data/fixtures/b5.json, scripts/gen_examples.py): scikit-learn-10908 through the
// committed cmeval code. Only the fields the site uses are typed.

/** Metric name to value, as accuracy_metrics and token_metrics return them (null: no value). */
export type Metrics = Record<string, number | null>;

export type LevelGrade = { first: number | null; metrics: Metrics; relevance: number[][]; units: number[][] };

export type B5Hit = {
  path: RepoPath; start: number | null; end: number | null; symbol: string | null; score: number;
  text: string; matches: number | null; sha: string; cached: boolean;
  /** "code", "test", or "other", by cmeval's own rule (patches.classify_path). */
  kind: string;
};

export type B5System = {
  options: Record<string, unknown>;
  n_hits: number;
  top: B5Hit[];
  grade: { tokens: number[]; estimated: boolean[]; file: LevelGrade; class: LevelGrade; function: LevelGrade };
};

export type B5Switch = {
  switch: "none" | "types" | "idf" | "clean" | "tests_last";
  options: Record<string, unknown>;
  keywords: string[];
  weights: Record<string, number>;
  files: [string, number][];
  files_total: number;
  gold_file_rank: number | null;
  gold_fn_rank: number | null;
  top: B5Hit[];
};

export type FixtureB5 = {
  rev: string;
  task: { id: string; repo: string; base_commit: string; query: string; gold_file: RepoPath; gold_fn: { symbol: string; start: number; end: number } };
  keywords: {
    trace: { raw: string; word: string; source: "backtick" | "identifier" | "word"; status: "kept" | "duplicate" | "stop word" | "too short" | "over the cap" }[];
    final: string[]; cleaned: string[]; dropped_by_cleaning: string[];
    marks: { start: number; end: number; kind: "backtick" | "identifier" | "word" | "skip" }[];
    stop_words: number; max: number;
  };
  grep: { files_matched: number; files: [string, number][]; file_kinds: Record<string, string>; gold_file_rank: number | null; hits: B5Hit[]; grade: B5System["grade"] };
  switches: B5Switch[];
  gold_file_lines: { line: number; text: string; fn: string | null; fn_start: number | null; fn_end: number | null; keywords: string[] }[];
  gold_file_functions: { symbol: string; start: number; end: number; lines: number }[];
  gold_file_outside: number;
  systems: Record<"grep-fn" | "grep-fn-plus", B5System>;
  run: {
    systems: { name: string; adapter: "grep" | "grep_fn" | "codemem"; options: Record<string, unknown>; group: string }[];
    no_index_key: string;
    repos: [string, number][];
    tasks: number;
    order: { id: string; repo: string; commit: string }[];
    search_ms: Record<string, { ms: number; run: string }>;
  };
  token_cache: { overhead: number; chars_per_token_estimate: number };
  tests_examples: {
    file_units: { hits: string[]; raw: number[][]; units: number[][]; mrr_raw: number; mrr_units: number; note: string };
    precision: { units: number[][]; n_gold: number; metrics: Metrics; note: string };
    tokens: { hit_tokens: number[]; relevance: number[][]; n_gold: number; metrics: Metrics; note: string };
  };
};

// ---- the final dev run (data/results/dev50-final.json, scripts/gen_results.py)

export type Stat = { mean: number; n: number; ci: [number, number] | null } | null;

export type ResultsFinal = {
  rev: string;
  /** A few real rows of scores.jsonl (one task, two systems, function level). */
  example_rows: { task_id: string; system: string; level: string; iou: number | null; metric: string; value: number | null }[];
  scores_rows: number;
  /** The report's section headings, in order. */
  sections: string[];
  run: string;
  split: string;
  tasks: number;
  repos: number;
  baseline: string;
  primary_systems: string[];
  code: { cmeval: string; parts: { run: string; systems: string[]; cmeval: string }[] };
  warnings: string[];
  systems: { name: string; granularity: "file" | "line"; search_ms_median: number | null; levels: Partial<Record<"file" | "function", Record<string, Stat>>> }[];
  primary: {
    system: string; level: string; metric: string; n: number; baseline_mean: number | null; system_mean: number | null;
    diff: number | null; ci: [number, number] | null; p: number | null; method: string; p_holm: number | null;
    found: Record<"both" | "system only" | "baseline only" | "neither", number> | null;
  }[];
  b4: { run: string; result: string; systems: { system: string; tasks: number; same_top: number; largest_metric_diff: number; largest_token_diff_pct: number; result: string }[] };
};

// ---- the fresh-task route of COLLECT (data/fixtures/fresh.json, scripts/gen_fresh.py)

export type FunnelCounts = Record<string, number>;

export type FreshExample = {
  id: string;
  repo: string;
  split: "dev" | "test";
  baseCommit: string;
  mergeType: "squash" | "merge" | "rebase";
  gold: { files: RepoPath[]; functions: { path: RepoPath; start: number; end: number; symbol: string }[] };
  tags: Record<string, unknown>;
  pr: {
    number: number; url: string; title: string; body: string; createdAt: string; mergedAt: string; changedFiles: number;
    mergeCommit: string | null;
    commits: { oid: string; message: string }[];
    closingList: { number: number; repo: string }[];
  };
  issue: {
    number: number; url: string; createdAt: string; title: string; body: string;
    versions: { at: string; body: string | null }[];
    renames: { createdAt: string; previousTitle: string; currentTitle: string }[];
  };
  /** Answers of the real collector functions on this PR and issue. */
  real: {
    prText: string;
    matches: { start: number; end: number; word: string; number: number; closing: boolean }[];
    listLinks: number[];
    regexLinks: number[];
    findLinks: Record<string, "list" | "regex" | "both">;
    /** Display only: the spans of "word: #N" in prText. */
    colonLinks: { start: number; end: number }[];
    regexWithoutColon: number[];
    /** version: the index in issue.versions of the body that body_at returned (null: none of them). */
    bodyAt: { body: string; editedAfter: boolean; missing: boolean; version: number | null };
    titleAt: { title: string; renamedAfter: boolean };
    query: string;
    leak: string | null;
    queryNow: string;
    leakNow: string | null;
  };
};

export type FixtureFresh = {
  rev: string;
  config: string;
  since: string;
  until: string;
  settings: { min_body_chars: number; extra_bots: string[]; max_code_files: number; max_code_lines: number };
  labeler: string;
  searchCap: number;
  windows: [string, string][];
  steps: { key: string; text: string }[];
  total: FunnelCounts;
  linkMethods: Record<"both" | "list" | "regex", number>;
  repos: Record<string, { counts: FunnelCounts; dropReasons: Record<string, number>; linkMethods: Record<string, number>; tasks: number }>;
  stats: { tasks: number; tasks_per_split: Record<string, number>; tasks_per_repo: Record<string, number>; share_gold_all_python: number; merge_types: Record<string, number> };
  candidates: { repo: string; possible: number; pythonShare: number }[];
  chosen: string[];
  edited: { tasks: number; body: number; title: number };
  examples: { crate: FreshExample; links: FreshExample };
};
