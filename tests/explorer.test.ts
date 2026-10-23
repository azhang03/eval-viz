import { describe, expect, it } from "vitest";
import { litItems, nodeAt, repoPathOf, segsOf } from "../src/lib/explorer";
import type { TreeNode } from "../src/data/types";

const files = ["eval/src/cmeval/labels.py", "eval/src/cmeval/importers/swebench.py", "eval/tasks/swebv-dev50.jsonl"];

describe("explorer helpers", () => {
  it("lights the folders that lead to a lit file", () => {
    expect([...litItems([], files)].sort()).toEqual(["src", "tasks"]);
    expect([...litItems(["src"], files)]).toEqual(["cmeval"]);
    expect([...litItems(["src", "cmeval"], files)].sort()).toEqual(["importers", "labels.py"]);
  });
  it("lights nothing in a folder off the path, or below the file", () => {
    expect(litItems(["tests"], files).size).toBe(0);
    expect(litItems(["src", "cmeval", "importers", "swebench.py"], files).size).toBe(0);
  });
  it("converts between repo paths and segments", () => {
    expect(segsOf("eval/src/cmeval/labels.py")).toEqual(["src", "cmeval", "labels.py"]);
    expect(repoPathOf(["src", "cmeval"], "labels.py")).toBe("eval/src/cmeval/labels.py");
  });
  it("finds a node by its folder path", () => {
    const tree: TreeNode = { name: "eval", type: "dir", children: [{ name: "src", type: "dir", children: [{ name: "a.py", type: "file" }] }] };
    expect(nodeAt(tree, ["src"])?.children?.length).toBe(1);
    expect(nodeAt(tree, ["nope"])).toBeNull();
  });
});
