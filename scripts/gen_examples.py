"""Real example data for the RUN and SCORE lines and their look-closer views: scikit-learn-10908
through the committed cmeval code. Writes data/fixtures/b5.json.

The script never reads the codemem working tree and never writes in codemem or in ~/.cmeval.
1. `git archive <rev>` of codemem into a temp folder, and `uv sync --frozen` there (no codemem extra).
2. `git archive <base commit>` of the scikit-learn bare clone into a temp folder, plus `git init`,
   because ripgrep follows .gitignore only inside a git repo (the real run uses a git worktree).
3. In the snapshot's environment (this file with --inner): keywords, file ranks, grep-fn and
   grep-fn-plus hits, and their grades with the real metric functions. Token counts come from the
   token cache, opened read-only; a text that is not in the cache gets an estimate, marked as one.

4. If the real run files are in CMEVAL_HOME/runs/, the grep, grep-fn, and grep-fn-plus lists made
   here must equal the ones in the run (paths, lines, order, and texts). Else a warning.

Usage:
    python3 -I scripts/gen_examples.py --repo ../codemem            # the newest timeline commit
    python3 -I scripts/gen_examples.py --repo ../codemem --rev f70e851
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "fixtures" / "b5.json"
# The run files that the check compares with: the final dev run has the grep systems at the
# reported code. Older runs are tried next.
CHECK_RUNS = ("2026-10-23-dev50-final", "2026-10-23-dev50-grep2")
TASK_ID = "scikit-learn__scikit-learn-10908"
K = 50  # the run's k
TOP = 10  # hits shown in the views
GOLD_FILE = "sklearn/feature_extraction/text.py"
GOLD_FN = ("CountVectorizer.get_feature_names", 994, 999)
# grep-fn-plus switches, turned on one at a time (the options in configs/baseline.toml)
SWITCHES = [
    ("none", {}),
    ("types", {"types": ["py"]}),
    ("idf", {"types": ["py"], "weighting": "idf"}),
    ("clean", {"types": ["py"], "weighting": "idf", "clean_keywords": True}),
    ("tests_last", {"types": ["py"], "weighting": "idf", "clean_keywords": True, "tests_last": True}),
]


def sh(*args: str, cwd: Path | None = None, stdout=None) -> None:
    subprocess.run(args, cwd=cwd, check=True, stdout=stdout)


def newest_timeline_commit() -> str:
    timeline = json.loads((ROOT / "data" / "timeline.json").read_text(encoding="utf-8"))
    return [b["commit"] for p in timeline["phases"] for f in p["features"] for b in f["batches"] if b["commit"]][-1]


def check_against_runs(out: dict, home: Path) -> None:
    """The lists made here must be the lists of the real run (the views claim they are real)."""
    for name, made in out["_check"].items():
        found = False
        for run in CHECK_RUNS:
            path = home / "runs" / run / f"{name}.jsonl"
            if not path.is_file():
                continue
            line = next((json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if f'"{TASK_ID}"' in l), None)
            if line is None:
                continue
            real = [[h["path"], h.get("start_line"), h.get("end_line"), h["text"]] for h in line["hits"]]
            if real != made:
                raise SystemExit(f"{name}: the list made here is not the list in run {run}")
            print(f"  {name}: same {len(real)} hits as run {run}")
            found = True
            break
        if not found:
            print(f"  warning: no run file for {name}; the list is not checked", file=sys.stderr)


def outer(args) -> int:
    home = Path(os.environ.get("CMEVAL_HOME", Path.home() / ".cmeval"))
    args.rev = args.rev or newest_timeline_commit()
    out_path = Path(args.out) if args.out else OUT
    with tempfile.TemporaryDirectory(prefix="b5-") as tmp:
        snap, base = Path(tmp) / "snap", Path(tmp) / "base"
        snap.mkdir()
        base.mkdir()
        archive = subprocess.run(["git", "-C", str(args.repo), "archive", args.rev], check=True, capture_output=True).stdout
        subprocess.run(["tar", "-x", "-C", str(snap)], input=archive, check=True)
        sh("uv", "sync", "--frozen", "--quiet", cwd=snap / "eval")
        record = next(json.loads(l) for l in (snap / "eval/tasks/swebv-dev50.jsonl").read_text().splitlines() if TASK_ID in l)
        clone = home / "repos" / "scikit-learn__scikit-learn.git"
        archive = subprocess.run(["git", "-C", str(clone), "archive", record["base_commit"]], check=True, capture_output=True).stdout
        subprocess.run(["tar", "-x", "-C", str(base)], input=archive, check=True)
        sh("git", "init", "-q", cwd=base)
        sh("uv", "run", "--frozen", "--quiet", "--project", str(snap / "eval"), "python", "-I", str(Path(__file__).resolve()),
           "--inner", "--snap", str(snap), "--base", str(base), "--home", str(home),
           "--rev", args.rev, "--out", str(Path(tmp) / "made.json"))
        out = json.loads((Path(tmp) / "made.json").read_text(encoding="utf-8"))
    check_against_runs(out, home)  # stops before the fixture is written if the lists differ
    out.pop("_check")  # the full hit texts are only for the check
    tmp_out = out_path.with_suffix(".json.tmp")
    tmp_out.write_text(json.dumps(out, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    tmp_out.replace(out_path)
    return 0


# ---------------------------------------------------------------- inner: runs in the snapshot's venv


def keyword_trace(query: str, max_keywords: int) -> list[dict]:
    """Every candidate in the order extract_keywords sees it, with its source and what happened to it."""
    from cmeval.adapters import keywords as kwmod

    ordered: list[tuple[str, str]] = []
    for span in kwmod._BACKTICK_RE.findall(query):
        span = span.strip().split("(", 1)[0].strip(".,:;")
        if span and " " not in span and len(span) <= 60:
            ordered.append((span, "backtick"))
            if "." in span and len(span.rsplit(".", 1)[-1]) >= 4:
                ordered.append((span.rsplit(".", 1)[-1], "backtick"))
        else:
            identifiers, words = kwmod._candidates(span)
            ordered += [(w, "backtick") for w in identifiers + words]
    identifiers, words = kwmod._candidates(query)
    ordered += [(w, "identifier") for w in identifiers] + [(w, "word") for w in words]

    trace, seen, kept = [], set(), 0
    for raw, source in ordered:
        word = raw.lower()
        if kept == max_keywords:
            status = "over the cap"
        elif not word or word in kwmod.STOP_WORDS:
            status = "stop word"
        elif len(word) < 3:
            status = "too short"
        elif word in seen:
            status = "duplicate"
        else:
            status = "kept"
            seen.add(word)
            kept += 1
        trace.append({"raw": raw, "word": word, "source": source, "status": status})
    # the trace must give exactly the real list
    assert [t["word"] for t in trace if t["status"] == "kept"] == kwmod.extract_keywords(query, max_keywords)
    return trace


def query_marks(query: str) -> list[dict]:
    """Spans of the query and their kind, by the real rules of adapters/keywords.py."""
    from cmeval.adapters import keywords as kwmod

    marks = [{"start": m.start(), "end": m.end(), "kind": "backtick"} for m in kwmod._BACKTICK_RE.finditer(query)]
    for m in kwmod._TOKEN_RE.finditer(query):
        raw = m.group(0)
        token = raw.strip(".")
        if not token:
            continue
        start = m.start() + (len(raw) - len(raw.lstrip(".")))
        followed_by_paren = query[m.end(): m.end() + 1] == "("
        if kwmod._looks_like_identifier(token, followed_by_paren):
            kind = "identifier"
        elif token.isalpha() and len(token) >= 4 and token.lower() not in kwmod.STOP_WORDS:
            kind = "word"
        else:
            kind = "skip"  # a stop word or too short
        marks.append({"start": start, "end": start + len(token), "kind": kind})
    return marks


def inner(args) -> int:
    from cmeval.adapters.grep import GrepRetriever, rank_files, rg_count
    from cmeval.adapters.grep_fn import NOISE_RE, GrepFnRetriever
    from cmeval.adapters.keywords import MAX_KEYWORDS, STOP_WORDS, extract_keywords
    from cmeval.metrics.accuracy import accuracy_metrics
    from cmeval.metrics.matching import file_units, level_gold, raw_relevance
    from cmeval.metrics.tokens import CHARS_PER_TOKEN, EstimateCounter, token_metrics
    from cmeval.adapters.grep import rg_lines
    from cmeval.labels import innermost
    from cmeval.tasks import load_tasks

    snap, base = Path(args.snap), Path(args.base)
    task = next(t for t in load_tasks(snap / "eval/tasks/swebv-dev50.jsonl") if t.id == TASK_ID)
    gold_fns = level_gold(task, "function")
    assert task.gold.files == [GOLD_FILE]
    assert [(s.symbol, s.start, s.end) for s in gold_fns] == [GOLD_FN]

    # ---- keywords
    trace = keyword_trace(task.query, MAX_KEYWORDS)
    keywords = extract_keywords(task.query, MAX_KEYWORDS)
    spare = extract_keywords(task.query, MAX_KEYWORDS + 10)
    cleaned = [kw for kw in spare if not NOISE_RE.search(kw)][:MAX_KEYWORDS]

    # ---- grep: file ranks
    grep = GrepRetriever()
    grep.build(base, base)
    counts = rg_count(grep.rg, base, keywords)
    ranked = rank_files(counts)
    file_rank = {p: i for i, (p, _) in enumerate(ranked, start=1)}

    # ---- token counts: cmeval's own cache file (read-only), else an estimate
    import os as _os
    from cmeval.metrics.tokens import DEFAULT_MODEL
    from cmeval.paths import token_cache_dir
    _os.environ["CMEVAL_HOME"] = args.home  # token_cache_dir() follows CMEVAL_HOME
    cache = token_cache_dir() / f"{DEFAULT_MODEL}.sqlite"
    if not cache.is_file():
        raise SystemExit(f"no token cache at {cache}: the views need real counts")
    db = sqlite3.connect(f"file:{cache}?mode=ro", uri=True)
    overhead = int(db.execute("SELECT value FROM meta WHERE key = 'overhead'").fetchone()[0])
    estimate = EstimateCounter()

    counted: dict[str, tuple[int, bool]] = {}

    def tokens(text: str) -> tuple[int, bool]:
        """(count, is an estimate). Each text is looked up once."""
        if text not in counted:
            row = db.execute("SELECT tokens FROM counts WHERE sha = ?", (hashlib.sha256(text.encode()).hexdigest(),)).fetchone() if text else (0,)
            counted[text] = (row[0], False) if row else (estimate.count([text])[0], True)
        return counted[text]

    def grade(hits, granularity: str) -> dict:
        """The real per-task scoring of score.py: file level on file units, other levels on raw hits."""
        hit_tokens, estimated = zip(*(tokens(h.text) for h in hits)) if hits else ((), ())
        out = {}
        for level in ("file", "class", "function"):
            if granularity == "file" and level != "file":
                continue
            gold = level_gold(task, level)
            relevance = raw_relevance(hits, gold, level, 0.5)
            units = file_units(hits, relevance) if level == "file" else relevance
            metrics = {**accuracy_metrics(units, len(gold), (1, 5, 10, 20, 50)), **token_metrics(list(hit_tokens), relevance, len(gold))}
            out[level] = {"metrics": metrics, "relevance": [sorted(r) for r in relevance], "units": [sorted(u) for u in units],
                          "first": next((i for i, r in enumerate(units, start=1) if r), None)}  # file level: rank in file units
        out["tokens"] = list(hit_tokens)
        out["estimated"] = list(estimated)
        return out

    from cmeval.patches import classify_path

    def hit_dict(h) -> dict:
        # sha: the token-cache key of the hit text; cached: the count came from the cache (not an estimate);
        # kind: "code", "test", or "other", by cmeval's own rule (patches.classify_path)
        return {"path": h.path, "start": h.start_line, "end": h.end_line, "symbol": h.symbol, "score": round(h.score, 6),
                "text": h.text, "matches": (h.extra or {}).get("matches"), "kind": classify_path(h.path)[0],
                "sha": hashlib.sha256(h.text.encode()).hexdigest(), "cached": not tokens(h.text)[1]}

    def gold_rank(hits) -> int | None:
        """Rank of the first hit that finds the gold function, by the real match rule (IoU 0.5)."""
        return next((i for i, r in enumerate(raw_relevance(hits, gold_fns, "function", 0.5), start=1) if r), None)

    def file_units_example() -> dict:
        """The file-units case of eval/tests/test_metrics.py, by the real functions."""
        from cmeval.retriever import Hit as RHit
        hits = [RHit(p) for p in ("x.py", "x.py", "gold.py", "x.py")]
        raw = raw_relevance(hits, ["gold.py"], "file", 0.5)
        units = file_units(hits, raw)
        return {"hits": [h.path for h in hits], "raw": [sorted(r) for r in raw], "units": [sorted(u) for u in units],
                "mrr_raw": accuracy_metrics(raw, 1, (1, 5, 10))["mrr"], "mrr_units": accuracy_metrics(units, 1, (1, 5, 10))["mrr"],
                "note": "eval/tests/test_metrics.py"}

    grep_hits = grep.search(task.query, K)
    systems = {}
    steps = []
    for name, options in SWITCHES:
        r = GrepFnRetriever(name=f"grep-fn+{name}", **options)
        r.build(base, base)
        hits = r.search(task.query, K)
        kws = r._keywords(task.query)
        if options.get("weighting") == "idf":
            weights, file_scores = r._idf(kws)
            files = sorted(file_scores.items(), key=lambda kv: (-kv[1], kv[0]))
        else:
            weights, files = None, rank_files(rg_count(r.rg, base, kws, r.types))
        steps.append({
            "switch": name, "options": options, "keywords": kws,
            "weights": {k: round(v, 4) for k, v in (weights or {}).items()},
            "files": [[p, round(s, 4)] for p, s in files[:TOP]],
            "gold_file_rank": next((i for i, (p, _) in enumerate(files, start=1) if p == GOLD_FILE), None),
            "files_total": len(files),
            "top": [hit_dict(h) for h in hits[:TOP]],
            "gold_fn_rank": gold_rank(hits),
        })
        if name in ("none", "tests_last"):
            systems["grep-fn" if name == "none" else "grep-fn-plus"] = {"hits": hits, "options": options}

    # grep-fn's view of the gold file: each match line and the function it falls in
    gf = GrepFnRetriever()
    gf.build(base, base)
    fns = gf._functions(GOLD_FILE)
    gold_lines = []
    for number, content in rg_lines(gf.rg, base, keywords, [GOLD_FILE]).get(GOLD_FILE, []):
        fn = innermost(fns, number)
        gold_lines.append({"line": number, "text": content.strip()[:120], "fn": fn.symbol if fn else None,
                           "fn_start": fn.start if fn else None, "fn_end": fn.end if fn else None,
                           "keywords": [kw for kw in keywords if kw in content.lower()]})

    # the systems of configs/baseline.toml, grouped by index key the way run.py groups them
    import tomllib
    from cmeval.adapters.grep import NO_INDEX_KEY
    config = tomllib.loads((snap / "eval/configs/baseline.toml").read_text())
    systems_cfg = [{"name": x["name"], "adapter": x["adapter"],
                    "options": {k: v for k, v in x.items() if k not in ("name", "adapter")},
                    # grep adapters return NO_INDEX_KEY; the codemem key hashes only index-time settings, which
                    # are the same for all three codemem systems (signals are a search-time setting)
                    "group": "none" if x["adapter"] in ("grep", "grep_fn") else "codemem"} for x in config["system"]]
    all_tasks = load_tasks(snap / "eval/tasks/swebv-dev50.jsonl")
    from collections import Counter
    repos = sorted(Counter(t.repo for t in all_tasks).items())
    # the real run order (run.order_tasks). ensure_commit may fetch or set clone config, so it is
    # swapped for a read-only check: the commit must already be in the clone.
    from cmeval import repos as repos_mod
    from cmeval.run import order_tasks

    def read_only_ensure(repo: str, sha: str) -> None:
        if not repos_mod.has_commit(repo, sha):
            raise SystemExit(f"{repo}: commit {sha} is not in the local clone")

    repos_mod.ensure_commit = read_only_ensure
    run_order = [{"id": t.id, "repo": t.repo, "commit": t.base_commit[:7]} for group in order_tasks(all_tasks).values() for t in group]

    # search times for this task, from the real runs (read-only; the views label the source)
    runs = Path(args.home) / "runs"
    search_ms = {}
    for name in ("grep", "grep-fn", "grep-fn-plus"):
        for run in CHECK_RUNS:  # the final dev run first
            path = runs / run / f"{name}.jsonl"
            line = next((json.loads(l) for l in path.read_text().splitlines() if f'"{TASK_ID}"' in l), None) if path.is_file() else None
            if line:
                search_ms[name] = {"ms": line["search_ms"], "run": run}
                break

    # the functions of the gold file that hold match lines, for the function strip
    fn_groups: dict[tuple, int] = {}
    for g in gold_lines:
        if g["fn"]:
            key = (g["fn"], g["fn_start"], g["fn_end"])
            fn_groups[key] = fn_groups.get(key, 0) + 1
    gold_fns_with_lines = [{"symbol": k[0], "start": k[1], "end": k[2], "lines": n} for k, n in sorted(fn_groups.items(), key=lambda kv: kv[0][1])]

    out = {
        "rev": args.rev,
        "gold_file_functions": gold_fns_with_lines,
        "gold_file_outside": sum(1 for g in gold_lines if not g["fn"]),
        "run": {"systems": systems_cfg, "no_index_key": NO_INDEX_KEY, "repos": repos, "tasks": len(all_tasks), "order": run_order,
                "search_ms": search_ms},
        "task": {"id": task.id, "repo": task.repo, "base_commit": task.base_commit, "query": task.query,
                 "gold_file": GOLD_FILE, "gold_fn": {"symbol": GOLD_FN[0], "start": GOLD_FN[1], "end": GOLD_FN[2]}},
        "keywords": {"trace": trace, "final": keywords, "cleaned": cleaned, "marks": query_marks(task.query),
                     "dropped_by_cleaning": [kw for kw in spare if NOISE_RE.search(kw)],
                     "stop_words": len(STOP_WORDS), "max": MAX_KEYWORDS},
        "grep": {"files_matched": len(counts), "files": [[p, c] for p, c in ranked[:TOP]], "gold_file_rank": file_rank.get(GOLD_FILE),
                 "file_kinds": {p: classify_path(p)[0] for p, _ in ranked[:TOP]},
                 "hits": [hit_dict(h) for h in grep_hits[:TOP]], "grade": grade(grep_hits, "file")},
        "switches": steps,
        "gold_file_lines": gold_lines,
        "systems": {name: {"options": s["options"], "top": [hit_dict(h) for h in s["hits"][:TOP]],
                           "n_hits": len(s["hits"]), "grade": grade(s["hits"], "line")} for name, s in systems.items()},
        "token_cache": {"overhead": overhead, "chars_per_token_estimate": CHARS_PER_TOKEN},
        "tests_examples": {
            "file_units": file_units_example(),
            "precision": {"units": [[0], [0], []], "n_gold": 2, "metrics": accuracy_metrics([{0}, {0}, set()], 2, (1, 5, 10)),
                          "note": "eval/tests/test_metrics.py: two hits on the same gold item"},
            "tokens": {"hit_tokens": [400, 300, 200, 600], "relevance": [[], [], [0], [1]], "n_gold": 2,
                       "metrics": token_metrics([400, 300, 200, 600], [set(), set(), {0}, {1}], 2, (500, 1000, 1500)),
                       "note": "eval/tests/test_metrics.py"},
        },
    }
    # the run's full hit lists, kept only for the reproduction check (not shown)
    out["_check"] = {name: [[h.path, h.start_line, h.end_line, h.text] for h in s["hits"]] for name, s in systems.items()}
    out["_check"]["grep"] = [[h.path, h.start_line, h.end_line, h.text] for h in grep_hits]
    Path(args.out).write_text(json.dumps(out, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{args.out}: keywords {len(keywords)}, grep gold file rank {file_rank.get(GOLD_FILE)}, "
          + ", ".join(f"{s['switch']} fn rank {s['gold_fn_rank']}" for s in steps))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", type=Path, help="the codemem repo")
    ap.add_argument("--rev", default=None, help="codemem commit (default: the newest timeline commit)")
    ap.add_argument("--out", default=None, help="output file (default: data/fixtures/b5.json)")
    ap.add_argument("--inner", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--snap", help=argparse.SUPPRESS)
    ap.add_argument("--base", help=argparse.SUPPRESS)
    ap.add_argument("--home", help=argparse.SUPPRESS)
    args = ap.parse_args(argv)
    return inner(args) if args.inner else outer(args)


if __name__ == "__main__":
    sys.exit(main())
