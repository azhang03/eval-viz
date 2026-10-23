// The Finder-style explorer (bottom left of page 1). It shows one folder of eval/ at a time.
// Light highlights: the files of the hovered machine or step, else of the selected step.
// Dark highlight: the file of the front card in the rail (viz decision 8).
import { STAGES } from "../../../content/stages";
import { manifest } from "../../data/current";
import type { TreeNode } from "../../data/types";
import { litItems, nodeAt, repoPathOf, segsOf } from "../../lib/explorer";
import { explorer, registerGrid, walkTo } from "../../state/explorer";
import { rail } from "../../state/rail";
import { system } from "../../state/system";
import { useStore } from "../../state/store";
import { openFile } from "./cards";
import "./Explorer.css";

const PLACES: [string, string[]][] = [
  ["eval", []],
  ["src/cmeval", ["src", "cmeval"]],
  ["importers", ["src", "cmeval", "importers"]],
  ["adapters", ["src", "cmeval", "adapters"]],
  ["metrics", ["src", "cmeval", "metrics"]],
  ["tasks", ["tasks"]],
  ["tests", ["tests"]],
];
const BOILERPLATE: [string, string][] = [
  ["pyproject.toml", "eval/pyproject.toml"],
  ["uv.lock", "eval/uv.lock"],
  [".python-version", "eval/.python-version"],
  ["__init__.py", "eval/src/cmeval/__init__.py"],
];
const EXT: Record<string, [string, string]> = {
  py: ["py", "var(--teal)"], toml: ["toml", "var(--terra)"], md: ["md", "#6c5a49"], jsonl: ["jsonl", "#c9962b"], json: ["json", "#c9962b"], lock: ["lock", "var(--ink-dim)"],
};

function Icon({ node }: { node: TreeNode }) {
  if (node.type === "dir") return <div className="ico dir" />;
  const ext = node.name.includes(".") ? node.name.split(".").pop() ?? "" : "";
  const [label, color] = EXT[ext] ?? [ext || "txt", "var(--ink-dim)"];
  return <div className="ico file"><b style={{ background: color }}>{label}</b></div>;
}

/** The repo path of the front card's file: a file card, or the file of a function card. */
function frontFile(): string | null {
  return rail.get().cards.at(-1)?.path ?? null;
}

export function Explorer() {
  const path = useStore(explorer, (s) => s.path);
  const hover = useStore(system, (s) => s.hover);
  const stepFiles = useStore(system, (s) => {
    const part = STAGES.find((st) => st.id === s.opened)?.parts?.[s.step ?? -1];
    return (part?.use ?? []).map(([f]) => f).join("\n");
  });
  const front = useStore(rail, () => frontFile());
  const m = manifest();
  const node = nodeAt(m.tree, path) ?? m.tree;
  const lit = litItems(path, hover ?? (stepFiles ? stepFiles.split("\n") : []));
  const dark = front ? litItems(path, [front]) : new Set<string>();
  const frontSegs = front ? segsOf(front) : null;
  const showFile = frontSegs && frontSegs.length === path.length + 1 && path.every((s, i) => frontSegs[i] === s) ? frontSegs.at(-1) : null;
  const segs = ["eval", ...path];

  return (
    <section className="finder">
      <div className="tbar">
        <div className="dots"><i style={{ background: "var(--terra)" }} /><i style={{ background: "var(--mustard)" }} /><i style={{ background: "var(--teal)" }} /></div>
        <button className="btn up" title="Up one folder" disabled={!path.length} onClick={() => void walkTo(path.slice(0, -1))}>&uarr;</button>
        <div className="path">
          {segs.map((s, i) => (
            <span key={i}>
              {i > 0 && <span className="gt">&rsaquo;</span>}
              <span className={`seg${i === segs.length - 1 && !showFile ? " cur" : ""}`} onClick={() => void walkTo(path.slice(0, i))}>{s}</span>
            </span>
          ))}
          {showFile && <><span className="gt">&rsaquo;</span><span className="seg cur">{showFile}</span></>}
        </div>
      </div>
      <div className="fbody">
        <nav className="side">
          <h5>Places</h5>
          {PLACES.map(([label, p]) => (
            <div key={label} className={`it${p.join("/") === path.join("/") ? " on" : ""}`} onClick={() => void walkTo(p)}>
              <span className="sq" />{label}
            </div>
          ))}
          <h5 className="bp-h">Boilerplate</h5>
          {BOILERPLATE.map(([label, file]) => (
            <div key={label} className="it bp" onClick={() => void openFile(file)}>
              <span className="ring" />{label}
            </div>
          ))}
        </nav>
        <div className="grid" ref={registerGrid}>
          {(node.children ?? []).map((n) => {
            const cls = ["item", n.boilerplate && "bp", lit.has(n.name) && "lit", dark.has(n.name) && "sel"].filter(Boolean).join(" ");
            return (
              <div key={n.name} className={cls} data-name={n.name} onClick={() => (n.type === "dir" ? void walkTo([...path, n.name]) : void openFile(repoPathOf(path, n.name)))}>
                <Icon node={n} />
                <div className="nm">{n.name}</div>
                {n.boilerplate && <span className="bp-tag">boilerplate</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
