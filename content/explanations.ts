// Hand-written explanations, keyed by definition ID (see data/manifest/*.json for the IDs).
// A new manifest never changes this file. Definitions without an entry show their docstring.
// The text can use small HTML: <code>, <b>, <i>, and entities such as &lt;.

import type { DefId } from "../src/data/types";

export type Explanation = {
  /** One or two sentences: what the definition does. */
  what: string;
  /** "How it works", as numbered steps. */
  steps: string[];
  /** A note under the steps: why it is built this way, or a real example. */
  aside?: string;
};

export const EXPLANATIONS: Record<DefId, Explanation> = {
  "cmeval.cli.cmd_import": { what: "Runs <code>cmeval import</code>. It picks the output file, starts the importer, and prints what was written and what was skipped.",
    steps: ["Output file: <code>--out</code>, or <code>tasks/swebv-dev&lt;n&gt;.jsonl</code>.", "Run <code>import_swebench_verified(n, seed, revision, out)</code>.", "Print \"N tasks written\", or \"only K of N found; file not changed\".", "Print each skipped row with its reason, then the label stats.", "Exit code 0 only if the file was written."] },
  "cmeval.importers.swebench.import_swebench_verified": { what: "The importer. It takes rows in a balanced order, labels each row, and keeps the first n good tasks. It writes the file only when it has all n.",
    steps: ["No rows given: download the dataset at a pinned revision and load the rows.", "For each row in <code>balanced_order(rows, seed)</code>, until there are n tasks:", "Label it with <code>label_at_commit</code>. A <code>LabelError</code> skips the row and records the reason.", "No gold code file: skip. Else build the task with <code>row_to_task</code>.", "<code>validate(task)</code> finds problems: skip. Else keep the task.", "Sort by repo and ID. If all n were found: <code>save_tasks</code>, then write the <code>.meta.json</code> file."],
    aside: "A failed run never replaces a committed task file. Git or network errors stop the import, so a repo is never missing without notice." },
  "cmeval.importers.swebench.balanced_order": { what: "Gives a fixed row order that takes about the same number of rows from each repo.",
    steps: ["Group the rows by repo.", "For each repo, in sorted order: sort its rows by ID, then shuffle them with the seed <code>\"&lt;seed&gt;:&lt;repo&gt;\"</code>.", "Take one row from each repo in turn (round-robin) until every queue is empty."],
    aside: "The same seed always gives the same order. Small repos run out first; the rest of the rows come from bigger repos." },
  "cmeval.importers.swebench.row_to_task": { what: "Turns one SWE-bench row and its labels into a <code>Task</code> (one line of the answer key).",
    steps: ["Clean the query: remove hidden HTML comments (<code>clean_query</code>).", "Read the PR number from the instance ID.", "Keep only the code part of the patch (<code>split_patch</code>).", "Add tags: label counts, <code>has_test_patch</code>, <code>identifier_in_query</code>.", "Build the <code>Task</code> with split \"dev\" and the labeler version."] },
  "cmeval.repos.ensure_clone": { what: "Clones a repo once, as a bare clone (git data only, no working files).",
    steps: ["The clone does not exist: clone into <code>&lt;name&gt;.partial</code> with <code>core.autocrlf=false</code>, then rename it to the final name.", "Set <code>core.autocrlf=false</code> on the clone, also on clones made before this setting.", "Return the clone path."],
    aside: "A stopped clone never looks like a finished one, because only a complete clone gets the final name. <code>core.autocrlf=false</code> keeps line endings as they are, so file contents, hit texts, and token counts are the same on Windows and on a Mac." },
  "cmeval.repos.ensure_commit": { what: "Makes sure the clone has one exact commit.",
    steps: ["The sha must be a full 40-character sha.", "<code>ensure_clone(repo)</code>.", "The commit is there: done.", "Fetch all branches and tags.", "Still missing: fetch the commit by its sha.", "Still missing: <code>RepoError</code>."] },
  "cmeval.repos.read_file": { what: "Reads one file as it was at a commit, with no checkout. This is the code time machine.",
    steps: ["<code>ensure_commit(repo, commit)</code>.", "Run <code>git show &lt;commit&gt;:&lt;path&gt;</code> and keep the raw bytes.", "The file does not exist at that commit: return None. Any other git error: <code>RepoError</code>.", "Decode the bytes as UTF-8."],
    aside: "Bytes, not text mode. Text mode can change line endings, and that can move line numbers." },
  "cmeval.patches.parse_patch": { what: "Reads a unified diff into one <code>FileChange</code> for each file.",
    steps: ["Parse the diff with unidiff.", "For each file: path, status (added, modified, deleted), file class (code, test, other), and language.", "Record the base-side lines that the change touches."] },
  "cmeval.patches.align_file_diff": { what: "Applies a one-file diff to the base file the way <code>git apply</code> does, and finds the real line numbers.",
    steps: ["For each hunk: <i>want</i> = its context lines and removed lines.", "Try the line that the hunk states. Not an exact match: look 1 line up, 1 down, 2 up, 2 down, and so on, for the nearest exact match.", "No exact match anywhere: <code>PatchMismatch</code>. The diff does not belong to this base.", "Record the offset (found line minus stated line). Copy the base lines and apply the changes.", "Return the fixed text, changed base lines, insertion points, offsets, and added lines."],
    aside: "Example: in scikit-learn-10908 the hunk says line 971, but the matching lines are lower in the file. The search finds them, so the labels point at the real code." },
  "cmeval.labels.label_at_commit": { what: "Labels a patch against a repo at one commit. It joins the labeler to the code time machine.",
    steps: ["Call <code>label_patch(patch, read_base)</code>.", "<code>read_base(path)</code> is <code>repos.read_file(repo, commit, path)</code>."] },
  "cmeval.labels.label_patch": { what: "The labeler. It finds the gold files, classes, and functions that a fix changed.",
    steps: ["<code>parse_patch</code>. Skip files that are not code.", "A new file does not exist at base: its code goes to <i>unretrievable</i>.", "Else read the base file and <code>align_file_diff</code> to get the real changed lines.", "The file is gold. Each changed line range goes to <code>gold.lines</code>.", "<code>find_definitions</code> on the base file. For each changed line, the innermost function and the innermost class around it turn gold.", "Added lines are placed in the fixed file, then mapped back to base definitions.", "Definitions that exist only after the fix go to <i>unretrievable</i>."],
    aside: "A new method added after method A makes the class gold, not A. Only code that existed at the base commit can be gold." },
  "cmeval.labels.find_definitions": { what: "Finds all named functions and classes in a source file, with tree-sitter.",
    steps: ["Parse the source with the language's tree-sitter grammar.", "Walk the tree. Each function or class node in the language table becomes a <code>Definition</code>: kind, qualified name (for example <code>Class.method</code>), start and end line.", "Anonymous functions do not count.", "Also return whether the parse had errors."] },
  "cmeval.tasks.validate": { what: "Checks one task against the schema and returns every problem. An empty list means the task is valid.",
    steps: ["Check each field and its type.", "Check the gold paths and line spans.", "Collect every problem, not only the first one."] },
  "cmeval.tasks.save_tasks": { what: "Validates all tasks, then writes the file in a way that a crash cannot break.",
    steps: ["<code>validate</code> each task and look for duplicate IDs.", "Any problem: raise <code>TaskError</code> with the full list. Nothing is written.", "Write one JSON line for each task to a temp file next to the target.", "Rename the temp file over the target in one step.", "Any error: delete the temp file."] },
  "cmeval.retriever.check_hits": { what: "Checks a system's hits against the contract before anyone grades them.",
    steps: ["Granularity must be \"file\" or \"line\".", "At most k hits.", "Each hit is a <code>Hit</code> with a repo-relative path.", "File systems: no line numbers. Line systems: start and end on every hit, with 1 &le; start &le; end.", "Any break: <code>RetrieverError</code>."],
    aside: "Without this check, a missing line range would turn into a file-level hit without notice (Decision 4)." },
  "cmeval.retriever.Retriever": { what: "The plug. The runner talks only to this interface. grep, grep-fn, codemem, and later systems are adapters that implement it.",
    steps: ["<code>describe()</code>: everything needed to repeat a run.", "<code>index_key()</code>: a hash of index settings. Same key, shared index.", "<code>build()</code> and <code>update()</code>: full index, or catch up after the repo moved.", "<code>search(query, k)</code>: best hits first.", "<code>close()</code>: free models and files."] },
  "cmeval.systems.make_system": { what: "Builds one retrieval system from its config entry.",
    steps: ["Look up the adapter's module and factory in <code>ADAPTERS</code> (fake, grep, grep_fn, codemem).", "Import it. A missing package gives a <code>SystemsError</code> that names the system.", "Call the factory with the settings. Bad settings, or any other error (for example ripgrep is missing), give a <code>SystemsError</code> that names the system.", "The result must implement <code>Retriever</code> and have a valid granularity."] },
  "cmeval.systems.load_systems": { what: "Reads a TOML file of system configs.",
    steps: ["Parse the TOML.", "<code>parse_systems</code> checks each entry: a safe, unique name and a known adapter."] },
  "cmeval.adapters.fake.FakeRetriever": { what: "A fake system for tests and dry runs. No real search, so it is fast and gives the same result every time.",
    steps: ["Read the repo's files with one suffix.", "Rank files by how many query words they contain.", "A script can fix the hits for a query, so runner tests know the right answer in advance."] },
  "cmeval.metrics.matching.hit_matches": { what: "Decides if one hit finds one gold class or function (Decisions 2 and 3).",
    steps: ["The hit is in another file, or it has no line numbers: no match.", "The hit lies inside the gold range: match (rule a).", "Else: match if <code>line_iou</code> of the two ranges is at least the threshold (rule b). The threshold is 0.5. The score also checks 0.3 and 0.7."],
    aside: "File level does not use this function. A hit finds a gold file when the paths are equal." },
  "cmeval.metrics.matching.line_iou": { what: "Line IoU of two line ranges: the lines in both ranges, divided by the lines in either range.",
    steps: ["Shared lines: from the later start to the earlier end, or 0 if the ranges do not overlap.", "Lines in either range: from the earlier start to the later end.", "Divide the first number by the second."],
    aside: "Example from scikit-learn-10908: a hit on lines 992 to 999 and the gold function on 994 to 999 share 6 lines, and 8 lines are in either. IoU = 6 / 8 = 0.75." },

};
