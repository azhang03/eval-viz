"""Write data/checks/expected.json: answers from the real cmeval code, for the site's tests.

The site has its own TypeScript copies of two rules (the split rule and the hunk search) to
animate them. This script loads the real Python functions from codemem at the newest timeline
commit and records their answers on fixed inputs. tests/truth.test.ts then checks that the
TypeScript copies give the same answers.

Only the needed definitions are loaded: their source is read with git show, picked out with
ast, and run in a small namespace. Nothing is imported from the codemem working tree.

Usage:
    python3 -I scripts/check.py --repo ../codemem
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import subprocess
import sys
from types import SimpleNamespace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPLIT_IDS = [
    "scikit-learn__scikit-learn-10908",
    "django__django-11099",
    "pandas-dev__pandas-60123",
    "django__django-19001",
    "pytorch__pytorch-150321",
    "vercel__next.js-80412",
    "rust-lang__rust-140000",
    "fresh__repo-1037",
    "fresh__repo-1999",
    "",
    "a task id with spaces and ünïcode",
]


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout


def load(repo: Path, rev: str, path: str, names: set[str], extra: dict | None = None) -> dict:
    """Run only the top-level definitions and assignments called `names` from one module.

    `extra` gives the names they use from other modules (for example `re`, or a function loaded before).
    """
    tree = ast.parse(git(repo, "show", f"{rev}:{path}"))
    picked = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names:
            picked.append(node)
        elif isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in names for t in node.targets):
            picked.append(node)
    found = {n.name if hasattr(n, "name") else n.targets[0].id for n in picked}
    missing = names - found
    if missing:
        raise SystemExit(f"{path} at {rev}: not found: {', '.join(sorted(missing))}")
    namespace: dict = {"hashlib": hashlib, "__name__": "cmeval_check", **(extra or {})}
    # postponed annotations, so type names from other modules (Hit, Span) need not exist here
    future = ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)
    module = ast.fix_missing_locations(ast.Module(body=[future, *picked], type_ignores=[]))
    exec(compile(module, f"{rev}:{path}", "exec"), namespace)
    return namespace


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", required=True, type=Path, help="path to the codemem repo")
    args = ap.parse_args(argv)

    timeline = json.loads((ROOT / "data" / "timeline.json").read_text(encoding="utf-8"))
    rev = [b["commit"] for p in timeline["phases"] for f in p["features"] for b in f["batches"] if b["commit"]][-1]

    tasks = load(args.repo, rev, "eval/src/cmeval/tasks.py", {"assign_split", "DEFAULT_SPLIT_SEED", "DEV_PERCENT"})
    patches = load(args.repo, rev, "eval/src/cmeval/patches.py", {"_find_hunk"})
    assign_split, find_hunk = tasks["assign_split"], patches["_find_hunk"]

    split = []
    for task_id in SPLIT_IDS:
        digest = hashlib.sha256(f"{tasks['DEFAULT_SPLIT_SEED']}:{task_id}".encode("utf-8")).hexdigest()
        split.append({"id": task_id, "digest": digest, "split": assign_split(task_id)})

    # hunk cases on the fixture lines (base lines from fixture["from"] on)
    fixture = json.loads((ROOT / "data" / "fixtures" / "10908.json").read_text(encoding="utf-8"))["hunk"]
    base, first = fixture["lines"], fixture["from"]
    want = [line[1:] for line in fixture["body"] if line[:1] in (" ", "-")]
    broken = list(want)
    broken[2] = '        """Return a list of feature names."""'
    cases = [
        ("the real hunk", want, fixture["stated"], first),
        ("stated at the real place", want, fixture["found"], first),
        ("lowest bound below the match", want, fixture["stated"], fixture["found"] - 1),
        ("lowest bound above the match", want, fixture["stated"], fixture["found"] + 1),
        ("changed docstring: no match", broken, fixture["stated"], first),
        ("empty hunk", [], fixture["stated"], first),
    ]
    hunk = []
    for name, w, stated_line, lowest_line in cases:
        start = find_hunk(base, w, stated_line - first, lowest_line - first)
        hunk.append({"name": name, "want": w, "stated": stated_line - first, "lowest": lowest_line - first, "found": start})

    # match rule cases: the hits of the match-rule view against the 10908 gold function and class
    matching = load(args.repo, rev, "eval/src/cmeval/metrics/matching.py", {"line_iou", "hit_matches"})
    path = "sklearn/feature_extraction/text.py"
    spans = {"function": (994, 999), "class": (559, 999)}
    hits = {"A": (path, 995, 997), "B": (path, 992, 999), "C": (path, 985, 999), "D": (path, 559, 999),
            "other file": ("sklearn/other.py", 994, 999), "no lines": (path, None, None), "edge": (path, 990, 999)}
    match = []
    for name, (hpath, start, end) in hits.items():
        for level, (s0, s1) in spans.items():
            for iou in (0.3, 0.5, 0.7):
                hit = SimpleNamespace(path=hpath, start_line=start, end_line=end)
                span = SimpleNamespace(path=path, start=s0, end=s1)
                value = matching["line_iou"](start, end, s0, s1) if start is not None else None
                match.append({"hit": name, "level": level, "iou": iou, "hitPath": hpath, "start": start, "end": end,
                              "span": [s0, s1], "lineIou": value, "matches": matching["hit_matches"](hit, span, iou)})

    out = ROOT / "data" / "checks" / "expected.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    result = {"rev": rev, "seed": tasks["DEFAULT_SPLIT_SEED"], "devPercent": tasks["DEV_PERCENT"], "split": split, "hunk": hunk, "match": match}
    out.write_text(json.dumps(result, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: {len(split)} split cases, {len(hunk)} hunk cases, {len(match)} match cases, from codemem {rev}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
