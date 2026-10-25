"""The numbers of the final dev run for the REPORT view, made by the committed cmeval report code.
Writes data/results/dev50-final.json.

The script never reads the codemem working tree and never writes in codemem.
1. `git archive <rev>` of codemem into a temp folder, and `uv sync --frozen` there.
2. Copy eval/results/2026-10-23-dev50-final/ of that snapshot to a temp run folder, and unpack
   scores.jsonl.gz there.
3. In the snapshot's environment (this file with --inner): run cmeval.report.report() on the copy.
   The report.md that it writes must equal the committed one, byte for byte. So the numbers here
   come from the same code and data as the report that the team reads.
4. Means and 95% intervals come from the report's own Scores and bootstrap_ci, with its settings.
   The update vs. rebuild check is read from eval/results/2026-10-23-b4b/compare.md.

Usage:
    python3 -I scripts/gen_results.py --repo ../codemem            # the newest timeline commit
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "results" / "dev50-final.json"
RUN = "2026-10-23-dev50-final"
B4 = "2026-10-23-b4b"
METRICS = ("mrr", "recall@10", "recall@budget1000", "recall@budget8000", "tokens_to_first", "not_found_share")


def newest_timeline_commit() -> str:
    timeline = json.loads((ROOT / "data" / "timeline.json").read_text(encoding="utf-8"))
    return [b["commit"] for p in timeline["phases"] for f in p["features"] for b in f["batches"] if b["commit"]][-1]


def outer(args) -> int:
    rev = args.rev or newest_timeline_commit()
    with tempfile.TemporaryDirectory(prefix="results-") as tmp:
        snap, run_dir = Path(tmp) / "snap", Path(tmp) / RUN
        snap.mkdir()
        archive = subprocess.run(["git", "-C", str(args.repo), "archive", rev], check=True, capture_output=True).stdout
        subprocess.run(["tar", "-x", "-C", str(snap)], input=archive, check=True)
        subprocess.run(["uv", "sync", "--frozen", "--quiet"], cwd=snap / "eval", check=True)
        shutil.copytree(snap / "eval" / "results" / RUN, run_dir)
        with gzip.open(run_dir / "scores.jsonl.gz", "rb") as f:
            (run_dir / "scores.jsonl").write_bytes(f.read())
        (run_dir / "report.md").rename(run_dir / "report.committed.md")
        subprocess.run(["uv", "run", "--frozen", "--quiet", "--project", str(snap / "eval"), "python", "-I",
                        str(Path(__file__).resolve()), "--inner", "--snap", str(snap), "--run-dir", str(run_dir),
                        "--rev", rev], check=True)
    return 0


def b4_check(text: str) -> dict:
    """The table and the result line of compare.md, as plain values."""
    rows = []
    for line in text.splitlines():
        m = re.match(r"\| (\S+) \| (\d+) \| (\d+) \((\d+)%\) \| ([\d.]+) \| ([\d.]+)% \| (\w+) \|$", line)
        if m:
            rows.append({"system": m[1], "tasks": int(m[2]), "same_top": int(m[3]), "largest_metric_diff": float(m[5]),
                         "largest_token_diff_pct": float(m[6]), "result": m[7]})
    result = re.search(r"^## Result: (\w+)", text, re.M)
    assert rows and result, "compare.md has an unknown form"
    return {"run": B4, "result": result[1], "systems": rows}


def inner(args) -> int:
    from cmeval.metrics.stats import bootstrap_ci
    from cmeval.report import DEFAULT_BASELINE, PRIMARY_SYSTEMS, Scores, report
    from cmeval.files import read_jsonl

    snap, run_dir = Path(args.snap), Path(args.run_dir)
    result = report(run_dir, tasks_file=snap / "eval" / "tasks" / "swebv-dev50.jsonl")
    made = (run_dir / "report.md").read_bytes()
    committed = (run_dir / "report.committed.md").read_bytes()
    if made != committed:
        raise SystemExit("the report made here is not the committed report.md; the numbers would not match it")

    meta = json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))
    scores = Scores(read_jsonl(run_dir / "scores.jsonl"))
    names = [s["name"] for s in meta["systems"]]
    gran = {s["name"]: s["granularity"] for s in meta["systems"]}

    def stat(name: str, level: str, metric: str) -> dict | None:
        values = scores.vector(name, level, metric)
        if not values:
            return None
        ci = bootstrap_ci(values)
        return {"mean": round(sum(values) / len(values), 6), "n": len(values),
                "ci": None if ci is None else [round(ci[0], 6), round(ci[1], 6)]}

    systems = []
    for name in names:
        levels = {}
        for level in ("file", "function"):
            if level == "function" and gran[name] == "file":
                continue
            levels[level] = {metric: stat(name, level, metric) for metric in METRICS}
        systems.append({"name": name, "granularity": gran[name], "levels": levels})

    # search time: the median of each system's search_ms, from the run's summary
    import csv
    with (run_dir / "summary.csv").open(encoding="utf-8", newline="") as f:
        summary = list(csv.DictReader(f))
    for s in systems:
        row = next((r for r in summary if r["system"] == s["name"] and r["metric"] == "search_ms_median"), None)
        s["search_ms_median"] = None if row is None else round(float(row["mean"]), 1)

    primary = [{"system": c.system, "level": c.level, "metric": c.metric, "n": c.n,
                "baseline_mean": c.baseline_mean, "system_mean": c.system_mean, "diff": c.diff,
                "ci": None if c.ci is None else list(c.ci), "p": c.test.p, "method": c.test.method,
                "p_holm": c.p_holm, "found": c.found} for c in result.primary]
    tasks_by_repo = {}
    for task in (json.loads(l) for l in (snap / "eval/tasks/swebv-dev50.jsonl").read_text().splitlines()):
        tasks_by_repo[task["repo"]] = tasks_by_repo.get(task["repo"], 0) + 1

    # a few real rows of scores.jsonl, for the view that explains the input of a report:
    # one task, two systems, function level at the main IoU
    example_task = "scikit-learn__scikit-learn-10908"
    rows = [r for r in read_jsonl(run_dir / "scores.jsonl")
            if r["task_id"] == example_task and r["level"] == "function" and r["iou"] == 0.5
            and r["metric"] in ("mrr", "recall@10", "tokens_to_first")
            and r["system"] in (DEFAULT_BASELINE, "cm-bm25-code-usage")]
    rows.sort(key=lambda r: (r["system"] != DEFAULT_BASELINE, ("mrr", "recall@10", "tokens_to_first").index(r["metric"])))
    n_rows = sum(1 for _ in (run_dir / "scores.jsonl").open(encoding="utf-8"))

    out = {
        "rev": args.rev,
        "example_rows": rows,
        # the sections of the report, in order: its "## " and "### " headings
        "sections": [line.lstrip("#").strip() for line in made.decode("utf-8").splitlines() if line.startswith(("## ", "### "))],
        "scores_rows": n_rows,
        "run": RUN,
        "split": meta.get("split"),
        "tasks": result.tasks_scored,
        "repos": len(tasks_by_repo),
        "baseline": DEFAULT_BASELINE,
        "primary_systems": list(PRIMARY_SYSTEMS),
        "code": {"cmeval": (meta.get("cmeval_git") or {}).get("sha", "")[:7],
                 "parts": [{"run": p["run_id"], "systems": p["systems"],
                            "cmeval": ((p.get("cmeval_git") or {}).get("sha") or "")[:7]} for p in meta.get("merged_from", [])]},
        "warnings": result.warnings,
        "systems": systems,
        "primary": primary,
        "b4": b4_check((snap / "eval" / "results" / B4 / "compare.md").read_text(encoding="utf-8")),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(systems)} systems, {len(primary)} primary tests; report.md made again: identical")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", type=Path, help="the codemem repo")
    ap.add_argument("--rev", default=None, help="codemem commit (default: the newest timeline commit)")
    ap.add_argument("--inner", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--snap", help=argparse.SUPPRESS)
    ap.add_argument("--run-dir", help=argparse.SUPPRESS)
    args = ap.parse_args(argv)
    return inner(args) if args.inner else outer(args)


if __name__ == "__main__":
    sys.exit(main())
