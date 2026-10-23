// Pure helpers for the explorer. Paths are repo paths ("eval/src/cmeval/labels.py"); the
// explorer works with segments under eval/ (["src", "cmeval", "labels.py"]).
import type { TreeNode } from "../data/types";

/** "eval/src/cmeval/labels.py" -> ["src", "cmeval", "labels.py"] */
export const segsOf = (repoPath: string): string[] => repoPath.split("/").slice(1);

/** ["src", "cmeval"] + "labels.py" -> "eval/src/cmeval/labels.py" */
export const repoPathOf = (folder: string[], name: string): string => ["eval", ...folder, name].join("/");

export function nodeAt(root: TreeNode, folder: string[]): TreeNode | null {
  let node: TreeNode | undefined = root;
  for (const seg of folder) {
    node = node?.children?.find((c) => c.name === seg);
    if (!node) return null;
  }
  return node;
}

/** Names in `folder` to light: an item lights if a lit file is the item, or lies inside it. */
export function litItems(folder: string[], files: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const f of files) {
    const segs = segsOf(f);
    if (segs.length <= folder.length) continue;
    if (folder.every((s, i) => segs[i] === s)) out.add(segs[folder.length]!);
  }
  return out;
}
