"""Write one manifest for each codemem commit: the facts about cmeval at that commit.

A manifest lists the eval folder tree, each Python module in cmeval, each definition in it
(signature, first docstring paragraph, lines), and the call links between definitions.

The script reads codemem only through git (ls-tree, show, log). It never reads the working
tree and never writes to codemem.

Usage:
    python3 -I scripts/gen_manifest.py --repo ../codemem COMMIT [COMMIT ...]
    python3 -I scripts/gen_manifest.py --repo ../codemem --all     # every commit in data/timeline.json
"""

from __future__ import annotations

import argparse
import ast
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "manifest"
EVAL = "eval"
PKG_ROOT = "eval/src/"
BOILERPLATE = {
    "__init__.py": "Marks a folder as a Python package. Holds a one-line docstring and no logic.",
    "uv.lock": "Lock file from uv. It pins the exact version of every dependency. uv writes it; nobody edits it.",
    "pyproject.toml": "Python project file: package name, dependencies, and the cmeval command entry point.",
    ".python-version": "The Python version that uv uses for this project.",
}


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout


def module_of(path: str) -> str:
    """eval/src/cmeval/metrics/matching.py -> cmeval.metrics.matching"""
    mod = path[len(PKG_ROOT):-3].replace("/", ".")
    return mod.removesuffix(".__init__")


def first_par(node: ast.AST) -> str:
    return (ast.get_docstring(node) or "").split("\n\n")[0].replace("\n", " ")


def signature(f: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    s = f"{f.name}({ast.unparse(f.args)})"
    return s + (f" -> {ast.unparse(f.returns)}" if f.returns else "")


def build_tree(files: list[str]) -> dict:
    root: dict = {"name": EVAL, "type": "dir", "children": {}}
    for path in files:
        node = root
        parts = path.split("/")[1:]
        for i, part in enumerate(parts):
            last = i == len(parts) - 1
            kids = node["children"]
            if part not in kids:
                kids[part] = {"name": part, "type": "file" if last else "dir", "children": {}}
                if last:
                    kids[part]["path"] = path
                    if part in BOILERPLATE:
                        kids[part]["boilerplate"] = BOILERPLATE[part]
            node = kids[part]

    def to_list(node: dict) -> dict:
        out = {k: v for k, v in node.items() if k != "children"}
        if node["type"] == "dir":
            kids = sorted(node["children"].values(), key=lambda n: (n["type"] != "dir", n["name"].lower()))
            out["children"] = [to_list(k) for k in kids]
        return out

    return to_list(root)


def relative_imports(tree: ast.Module, mod: str, is_package: bool) -> dict[str, str]:
    """Local name -> dotted target, for relative imports anywhere in the module (also inside functions)."""
    pkg = mod if is_package else mod.rsplit(".", 1)[0]
    alias: dict[str, str] = {}
    for n in ast.walk(tree):
        if isinstance(n, ast.ImportFrom) and n.level:
            base = pkg.split(".")
            base = base[: len(base) - (n.level - 1)]
            target = ".".join(base + ([n.module] if n.module else []))
            for a in n.names:
                alias[a.asname or a.name] = f"{target}.{a.name}"
    return alias


def manifest(repo: Path, rev: str) -> dict:
    files = git(repo, "ls-tree", "-r", "--name-only", rev, EVAL).split()
    py = [p for p in files if p.startswith(PKG_ROOT) and p.endswith(".py")]
    modules: dict[str, dict] = {}
    nodes: dict[str, ast.AST] = {}  # definition ID -> its function node
    owner: dict[str, tuple[str, str | None]] = {}  # definition ID -> (module, class or None)
    aliases: dict[str, dict[str, str]] = {}
    where: dict[str, str] = {}

    for path in py:
        src = git(repo, "show", f"{rev}:{path}")
        tree = ast.parse(src)
        mod = module_of(path)
        aliases[mod] = relative_imports(tree, mod, path.endswith("__init__.py"))
        items = []
        for n in tree.body:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                fid = f"{mod}.{n.name}"
                nodes[fid], owner[fid], where[fid] = n, (mod, None), path
                items.append({"id": fid, "kind": "function", "name": n.name, "sig": signature(n), "doc": first_par(n), "line": n.lineno, "end": n.end_lineno})
            elif isinstance(n, ast.ClassDef):
                cid = f"{mod}.{n.name}"
                owner[cid], where[cid] = (mod, None), path
                methods = []
                for m in n.body:
                    if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        mid = f"{cid}.{m.name}"
                        nodes[mid], owner[mid], where[mid] = m, (mod, cid), path
                        methods.append({"id": mid, "name": m.name, "sig": signature(m), "doc": first_par(m), "line": m.lineno, "end": m.end_lineno})
                items.append({"id": cid, "kind": "class", "name": n.name, "bases": [ast.unparse(b) for b in n.bases], "doc": first_par(n), "line": n.lineno, "end": n.end_lineno, "methods": methods})
        modules[path] = {"module": mod, "doc": first_par(tree), "lines": len(src.splitlines()), "items": items}

    known = set(where)

    def resolve(mod: str, cls: str | None, expr: ast.AST) -> str | None:
        alias = aliases[mod]
        if isinstance(expr, ast.Name):
            local = f"{mod}.{expr.id}"
            return local if local in known else alias.get(expr.id)
        if isinstance(expr, ast.Attribute) and isinstance(expr.value, ast.Name):
            if expr.value.id == "self" and cls:
                return f"{cls}.{expr.attr}"  # a method of the same class
            base = alias.get(expr.value.id)
            return f"{base}.{expr.attr}" if base else None
        return None

    calls: dict[str, list[str]] = {}
    for fid, node in nodes.items():
        mod, cls = owner[fid]
        found: set[str] = set()
        for n in ast.walk(node):
            if isinstance(n, ast.Call):
                target = resolve(mod, cls, n.func)
                if target in known and target != fid:
                    found.add(target)
        # a function passed as a default value is a call site too (label_fn=label_at_commit)
        for d in node.args.defaults + [d for d in node.args.kw_defaults if d is not None]:
            target = resolve(mod, cls, d)
            if target in known and target != fid:
                found.add(target)
        calls[fid] = sorted(found)

    called_by: dict[str, list[str]] = {}
    for a, targets in calls.items():
        for b in targets:
            called_by.setdefault(b, []).append(a)

    full, date, subject = git(repo, "log", "-1", "--format=%H%n%ad%n%s", "--date=short", rev).splitlines()
    return {
        "commit": full,
        "short": full[:7],
        "date": date,
        "subject": subject,
        "tree": build_tree(files),
        "files": modules,
        "calls": {k: v for k, v in sorted(calls.items())},
        "calledBy": {k: sorted(v) for k, v in sorted(called_by.items())},
        "where": dict(sorted(where.items())),
    }


def timeline_commits() -> list[str]:
    timeline = json.loads((ROOT / "data" / "timeline.json").read_text(encoding="utf-8"))
    return [b["commit"] for p in timeline["phases"] for f in p["features"] for b in f["batches"] if b["commit"]]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", required=True, type=Path, help="path to the codemem repo")
    ap.add_argument("--all", action="store_true", help="every commit in data/timeline.json")
    ap.add_argument("commits", nargs="*")
    args = ap.parse_args(argv)
    commits = timeline_commits() if args.all else args.commits
    if not commits:
        ap.error("give commits or --all")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for rev in commits:
        m = manifest(args.repo, rev)
        out = OUT_DIR / f"{m['short']}.json"
        out.write_text(json.dumps(m, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
        n_defs = len(m["where"])
        n_links = sum(len(v) for v in m["calls"].values())
        print(f"{out.relative_to(ROOT)}: {len(m['files'])} modules, {n_defs} definitions, {n_links} call links")
    return 0


if __name__ == "__main__":
    sys.exit(main())
