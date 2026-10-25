"""Write data/fixtures/fresh.json: real data for the fresh-task route of COLLECT and its views.

- From codemem at one commit (git show): the fresh-v1 meta file (the 13-step funnel for each
  repo, drop reasons, link methods, stats), the two example tasks from fresh-v1.jsonl, the
  candidate repos of the repo-stats run, and the repos of configs/fresh-v1.toml.
- From the GitHub response cache in CMEVAL_HOME (default ~/.cmeval), read only: the example PRs
  and their issues as GitHub gave them to the collector.
- The real link and issue functions (collect/links.py, collect/issues.py), loaded from git with
  check.load, run on those answers. Their answers go into the fixture, so the views show what
  the code does. A check: the query that the real functions build equals the task's query.

Run it once, then commit the fixture. The site build never needs the cache.

Usage:
    python3 -I scripts/gen_fresh.py --repo ../codemem [--rev COMMIT]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tomllib
from datetime import date, timedelta
from pathlib import Path

sys.dont_write_bytecode = True  # no __pycache__ in scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent))
from check import git, load  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "fixtures" / "fresh.json"
TASKS = "eval/tasks/fresh-v1.jsonl"
META = "eval/tasks/fresh-v1.meta.json"
CONFIG = "eval/configs/fresh-v1.toml"
STATS = "eval/results/2026-10-23-repo-stats/stats.json"
SRC = "eval/src/cmeval/"
# The crate on the fresh route: a bot added the fix PR to the issue body 7 seconds after the PR
# was opened, so the issue as it was then is the one without it.
CRATE = "python__cpython-154728"
# The links example: airflow's PR template writes "closes: #N", which SWE-bench's regex misses.
LINKS = "apache__airflow-69916"
PR_KEYS = ("number", "url", "title", "body", "createdAt", "mergedAt", "changedFiles")


def newest_timeline_commit() -> str:
    timeline = json.loads((ROOT / "data" / "timeline.json").read_text(encoding="utf-8"))
    return [b["commit"] for p in timeline["phases"] for f in p["features"] for b in f["batches"] if b["commit"]][-1]


def cached_answers(cache: Path, prs: set[str], issues: set[str]) -> tuple[dict, dict]:
    """The PR nodes (with the fields of the collector's search) and the issue nodes, by URL.

    Files are read in name order and the first answer wins, so the result does not change
    between runs. Search pages from repo-stats have fewer fields (no title); they are skipped.
    """
    found_prs: dict[str, dict] = {}
    found_issues: dict[str, dict] = {}
    for path in sorted(cache.glob("*.json")):
        response = json.loads(path.read_text(encoding="utf-8"))["response"]
        data = response.get("data") if isinstance(response, dict) else None
        if not data:
            continue
        for node in (data.get("search") or {}).get("nodes") or []:
            if node and node.get("url") in prs and "title" in node:
                found_prs.setdefault(node["url"], node)
        for key, node in (data.get("repository") or {}).items():
            if key.startswith("i") and node and node.get("url") in issues:
                found_issues.setdefault(node["url"], node)
    return found_prs, found_issues


def pr_view(pr: dict) -> dict:
    commits = pr["commits"]["nodes"]
    return {
        **{k: pr[k] for k in PR_KEYS},
        "mergeCommit": (pr.get("mergeCommit") or {}).get("oid"),
        "commits": [{"oid": c["commit"]["oid"], "message": c["commit"]["message"]} for c in commits],
        "closingList": [{"number": n["number"], "repo": n["repository"]["nameWithOwner"]}
                        for n in pr["closingIssuesReferences"]["nodes"]],
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", required=True, type=Path, help="path to the codemem repo")
    ap.add_argument("--rev", default=None, help="codemem commit (default: the newest timeline commit)")
    args = ap.parse_args(argv)
    rev = git(args.repo, "rev-parse", "--short=7", args.rev or newest_timeline_commit()).strip()

    # split("\n"), not splitlines(): issue texts can hold Unicode line separators
    tasks = {t["id"]: t for t in (json.loads(line) for line in git(args.repo, "show", f"{rev}:{TASKS}").split("\n") if line)}
    meta = json.loads(git(args.repo, "show", f"{rev}:{META}"))
    stats = json.loads(git(args.repo, "show", f"{rev}:{STATS}"))
    config = tomllib.loads(git(args.repo, "show", f"{rev}:{CONFIG}"))

    # the real functions, loaded from git
    tasks_ns = load(args.repo, rev, SRC + "tasks.py", {"clean_query", "_HTML_COMMENT_RE"}, {"re": re})
    search_ns = load(args.repo, rev, SRC + "collect/search.py", {"is_bot", "KNOWN_BOTS", "date_windows", "SEARCH_CAP"},
                     {"date": date, "timedelta": timedelta})
    links = load(args.repo, rev, SRC + "collect/links.py",
                 {"issues_pattern", "pr_text", "regex_links", "list_links", "find_links", "PR_KEYWORDS", "_COMMENTS_RE"},
                 {"re": re})
    issues = load(args.repo, rev, SRC + "collect/issues.py",
                  {"body_at", "title_at", "hints_before", "build_query", "leak", "_SHA_WORD_RE"},
                  {"re": re, "clean_query": tasks_ns["clean_query"], "is_bot": search_ns["is_bot"]})

    examples = {name: tasks[tid] for name, tid in (("crate", CRATE), ("links", LINKS))}
    home = Path(os.environ.get("CMEVAL_HOME", Path.home() / ".cmeval"))
    cache = home / "gh-cache"
    if not cache.exists():
        print(f"missing GitHub cache: {cache} (run cmeval collect first)", file=sys.stderr)
        return 1
    prs, found_issues = cached_answers(cache, {t["fix"]["url"] for t in examples.values()},
                                       {t["issue"]["url"] for t in examples.values()})

    out_examples = {}
    for name, task in examples.items():
        pr = prs.get(task["fix"]["url"])
        issue = found_issues.get(task["issue"]["url"])
        if pr is None or issue is None:
            print(f"{task['id']}: PR or issue not in the GitHub cache", file=sys.stderr)
            return 1
        repo = task["repo"]
        text = links["pr_text"](pr)
        matches = []
        for m in links["issues_pattern"](repo).finditer(text):
            matches.append({"start": m.start(), "end": m.end(), "word": m.group(1), "number": int(m.group(2)),
                            "closing": m.group(1).lower() in links["PR_KEYWORDS"]})
        when = pr["createdAt"]
        body, body_after, missing = issues["body_at"](issue, when)
        title, title_after = issues["title_at"](issue, when)
        query = issues["build_query"](title, body)
        if query != task["query"]:
            print(f"{task['id']}: the real functions build another query than the task file has", file=sys.stderr)
            return 1
        now_query = issues["build_query"](issue["title"], issue.get("body") or "")
        edits = sorted(issue["userContentEdits"]["nodes"], key=lambda e: e["editedAt"])
        out_examples[name] = {
            "id": task["id"], "repo": repo, "split": task["split"], "baseCommit": task["base_commit"],
            "mergeType": task["fix"]["merge_type"],
            "gold": task["gold"], "tags": task["tags"],
            "pr": pr_view(pr),
            "issue": {
                "number": issue["number"], "url": issue["url"], "createdAt": issue["createdAt"],
                "title": issue["title"], "body": issue.get("body") or "",
                "versions": [{"at": e["editedAt"], "body": e["diff"]} for e in edits],
                "renames": [n for n in issue["timelineItems"]["nodes"] if n],
            },
            "real": {
                "prText": text, "matches": matches,
                "listLinks": sorted(links["list_links"](pr, repo)),
                "regexLinks": sorted(links["regex_links"](pr, repo)),
                "findLinks": {str(k): v for k, v in links["find_links"](pr, repo).items()},
                # an illustration for the links view: the same PR with "word: #N" written as "word #N"
                "regexWithoutColon": sorted(links["regex_links"](
                    {**pr, "body": re.sub(r"(\w+): #", r"\1 #", pr.get("body") or "")}, repo)),
                "bodyAt": {"body": body, "editedAfter": body_after, "missing": missing},
                "titleAt": {"title": title, "renamedAfter": title_after},
                "query": query,
                "leak": issues["leak"](query, pr),
                # the same check on the issue as it is today, to show why the earlier version is used
                "queryNow": now_query,
                "leakNow": issues["leak"](now_query, pr),
            },
        }

    repos = meta["repos"]
    steps = [s["key"] for s in meta["funnel_steps"]]
    fixture = {
        "rev": rev,
        "config": meta["config"], "since": meta["since"], "until": meta["until"], "settings": meta["settings"],
        "labeler": meta["labeler"],
        "searchCap": search_ns["SEARCH_CAP"],
        "windows": [[a.isoformat(), b.isoformat()] for a, b in search_ns["date_windows"](
            date.fromisoformat(meta["since"]), date.fromisoformat(meta["until"]))],
        "steps": meta["funnel_steps"],
        "total": {k: sum(r["counts"][k] for r in repos.values()) for k in steps},
        "linkMethods": {m: sum(r["link_methods"].get(m, 0) for r in repos.values()) for m in ("both", "list", "regex")},
        "repos": {name: {"counts": r["counts"], "dropReasons": r["drop_reasons"], "linkMethods": r["link_methods"],
                         "tasks": meta["stats"]["tasks_per_repo"].get(name, 0)}
                  for name, r in sorted(repos.items(), key=lambda kv: -kv[1]["counts"]["merged"])},
        "stats": meta["stats"],
        "candidates": [{"repo": r["repo"], "possible": r["funnel"]["body_100"], "pythonShare": round(r["python_share"], 3)}
                       for r in stats["repos"]],
        "chosen": [r["name"] for r in config["repo"]],
        "examples": out_examples,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixture, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    t = fixture["total"]
    print(f"{OUT.relative_to(ROOT)}: funnel {t['merged']:,} -> {t['no_leak']:,} -> {t['labeled']:,}; "
          f"examples {', '.join(e['id'] for e in out_examples.values())}; from codemem {rev}")
    for e in out_examples.values():
        r = e["real"]
        print(f"  {e['id']}: links {r['findLinks']}, body edited after {r['bodyAt']['editedAfter']}, "
              f"leak then {r['leak']!r}, leak now {r['leakNow']!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
