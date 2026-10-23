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
