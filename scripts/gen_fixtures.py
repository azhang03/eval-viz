"""Write data/fixtures/10908.json: real data for the labeler and hunk views.

- The answer-key line for scikit-learn__scikit-learn-10908, from eval/tasks/swebv-dev50.jsonl
  in codemem (read with git show).
- The hunk example: the first hunk of that task's patch, and base lines 940 to 1002 of
  sklearn/feature_extraction/text.py at the task's base commit. These lines come from the
  local scikit-learn clone in CMEVAL_HOME (default ~/.cmeval), also with git show.

Run it once, then commit the fixture. The site build never needs the clone.

Usage:
    python3 -I scripts/gen_fixtures.py --repo ../codemem [--rev COMMIT]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASK_ID = "scikit-learn__scikit-learn-10908"
TASK_FILE = "eval/tasks/swebv-dev50.jsonl"
SNIPPET = (940, 1002)  # base lines that the hunk view shows
EXPECTED_FOUND = 993


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout


def find_hunk(base: list[str], want: list[str], stated: int, lowest: int) -> int | None:
    """The same search as cmeval.patches._find_hunk: the stated index, then the nearest exact match."""
    if not want:
        return stated if lowest <= stated <= len(base) else None
    highest = len(base) - len(want)
    for distance in range(0, max(stated - lowest, highest - stated, 0) + 1):
        for start in (stated - distance, stated + distance) if distance else (stated,):
            if lowest <= start <= highest and base[start:start + len(want)] == want:
                return start
    return None


def first_hunk(patch: str) -> tuple[str, list[str]]:
    lines = patch.split("\n")
    h = next(i for i, line in enumerate(lines) if line.startswith("@@"))
    body: list[str] = []
    for line in lines[h + 1:]:
        if line.startswith("@@") or line.startswith("diff "):
            break
        body.append(line)
    while body and body[-1] == "":
        body.pop()
    return lines[h], body


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", required=True, type=Path, help="path to the codemem repo")
    ap.add_argument("--rev", default=None, help="codemem commit to read the task file from (default: the newest timeline commit)")
    args = ap.parse_args(argv)

    rev = args.rev
    if rev is None:
        timeline = json.loads((ROOT / "data" / "timeline.json").read_text(encoding="utf-8"))
        rev = [b["commit"] for p in timeline["phases"] for f in p["features"] for b in f["batches"] if b["commit"]][-1]

    raw = next(line for line in git(args.repo, "show", f"{rev}:{TASK_FILE}").splitlines() if json.loads(line)["id"] == TASK_ID)
    record = json.loads(raw)

    home = Path(os.environ.get("CMEVAL_HOME", Path.home() / ".cmeval"))
    clone = home / "repos" / (record["repo"].replace("/", "__") + ".git")
    if not clone.exists():
        print(f"missing clone: {clone} (run a cmeval import first)", file=sys.stderr)
        return 1
    path = record["gold"]["files"][0]
    base_text = git(clone, "show", f"{record['base_commit']}:{path}")
    base = base_text.split("\n")

    header, body = first_hunk(record["patch"])
    m = re.match(r"@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@", header)
    assert m, header
    want = [line[1:] for line in body if line[:1] in (" ", "-")]
    stated = int(m.group(1)) - 1
    found = find_hunk(base, want, stated, 0)
    assert found is not None and found + 1 == EXPECTED_FOUND, f"hunk found at {found}, expected {EXPECTED_FOUND}"

    lo, hi = SNIPPET
    fixture = {
        "task": {"file": TASK_FILE, "rev": git(args.repo, "rev-parse", "--short=7", rev).strip(), "bytes": len(raw.encode("utf-8")), "record": record},
        "hunk": {
            "path": path,
            "baseCommit": record["base_commit"],
            "fileLines": len(base) - (1 if base_text.endswith("\n") else 0),
            "header": header,
            "body": body,
            "stated": stated + 1,
            "found": found + 1,
            "from": lo,
            "lines": base[lo - 1:hi],
        },
    }
    out = ROOT / "data" / "fixtures" / "10908.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fixture, sort_keys=True, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: task from {rev}, hunk {stated + 1} -> {found + 1} (offset +{found - stated})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
