// Look closer: how the labeler finds gold (labels.label_patch, labeler v2).
// Steps 1 to 6 use a small example file that follows the real rules. Step 7 shows a real
// answer-key line (scikit-learn-10908, from data/fixtures).
import { gsap } from "gsap";
import { fixture10908 } from "../data/load";
import { esc } from "../lib/esc";
import { q, type CloserView } from "./types";

const LH = 17;
const BASE = ["import json", "", "TAX = 0.08", "", "class Cart:", "    def __init__(self):", "        self.items = []", "", "    def add(self, item, qty=1):",
  "        self.items.append((item, qty))", "", "    def total(self):", "        s = sum(i.price * q for i, q in self.items)", "        return s * (1 + TAX)", "", "", "def load(path):",
  "    with open(path) as f:", "        return json.load(f)"];
const ALT: Record<number, string> = { 3: "TAX = 0.0825", 13: "        s = sum(i.price * q for i, q in self.items if q > 0)" };
const NEW = ["    def remove(self, item):", "        self.items = [x for x in self.items if x[0] != item]", ""]; // inserted after base line 11
const fixedRow = (L: number) => (L <= 11 ? L - 1 : L - 1 + NEW.length);
type Def = { id: string; lab: string; b: [number, number] | null; f: [number, number]; d: number };
const DEFS: Def[] = [
  { id: "Cart", lab: "class Cart", b: [5, 14], f: [5, 17], d: 0 },
  { id: "init", lab: "def __init__", b: [6, 7], f: [6, 7], d: 1 },
  { id: "add", lab: "def add", b: [9, 10], f: [9, 10], d: 1 },
  { id: "remove", lab: "def remove . new, not at base", b: null, f: [12, 13], d: 1 },
  { id: "total", lab: "def total", b: [12, 14], f: [15, 17], d: 1 },
  { id: "load", lab: "def load", b: [17, 19], f: [20, 22], d: 0 },
];
const GROUPS = [
  { keys: ["schema", "id", "source", "split", "repo", "base_commit", "language"], c: "#8a7f72", t: "Which task", d: "The ID, the repo, and the exact base commit. All SWE-bench Verified tasks are in the dev split." },
  { keys: ["query", "hints"], c: "#5b6fb5", t: "The search input", d: "<code>query</code> is the issue text. Every system gets the same query. <code>hints</code> are stored but are not part of the query." },
  { keys: ["issue", "fix", "patch", "test_patch"], c: "#6c5a49", t: "The fix", d: "Where the fix came from. <code>patch</code> is the diff the labeler read. Only its code files are kept." },
  { keys: ["gold", "unretrievable"], c: "#e9b440", t: "The labels", d: "Written by the labeler. Hits are graded against <code>gold</code> at file, class, and function level. <code>lines</code> keeps the exact changed lines. Nothing here is new code, so <code>unretrievable</code> is empty." },
  { keys: ["tags"], c: "#2f8f8a", t: "Tags", d: "Facts for slicing the results. <code>hunks_moved: 1</code>: the diff reader moved one hunk to its real place. <code>identifier_in_query: true</code>: the issue names a gold function." },
  { keys: ["labeler"], c: "#d4673f", t: "Labeler version", d: "The labeler version that wrote these labels." },
];

/** The answer-key record as pretty JSON lines; long text is shortened, everything else as stored. */
function jsonLines(record: Record<string, unknown>): string {
  const gOf = (k: string) => GROUPS.findIndex((g) => g.keys.includes(k));
  const val = (v: unknown): string | null => {
    if (v === null) return `<span class="z">null</span>`;
    if (typeof v === "boolean") return `<span class="z">${v}</span>`;
    if (typeof v === "number") return `<span class="n">${v}</span>`;
    if (typeof v === "string") {
      const flat = JSON.stringify(v);
      return flat.length > 64 ? `<span class="s">${esc(flat.slice(0, 52))}</span><span class="cut"> ... ${v.length} chars"</span>` : `<span class="s">${esc(flat)}</span>`;
    }
    if (Array.isArray(v)) return v.length ? null : "[]";
    const o = v as Record<string, unknown>;
    return Object.values(o).every((x) => x === null || typeof x !== "object") ? `{${Object.entries(o).map(([k, x]) => `<span class="k">"${esc(k)}"</span>: ${val(x)}`).join(", ")}}` : null;
  };
  const out: string[] = [];
  const line = (ind: number, html: string, g: number) => out.push(`<div class="jl" style="--ind:${ind}${g >= 0 ? `;--gc:${GROUPS[g]!.c}` : ""}"${g >= 0 ? ` data-g="${g}"` : ""}>${html}</div>`);
  const emit = (k: string | null, v: unknown, ind: number, g: number, last: boolean) => {
    const comma = last ? "" : ",", inline = val(v), kk = k === null ? "" : `<span class="k">"${esc(k)}"</span>: `;
    if (inline !== null) { line(ind, kk + inline + comma, g); return; }
    const arr = Array.isArray(v);
    const entries: [string | null, unknown][] = arr ? (v as unknown[]).map((x) => [null, x]) : Object.entries(v as Record<string, unknown>);
    line(ind, kk + (arr ? "[" : "{"), g);
    entries.forEach(([k2, x], j) => emit(k2, x, ind + 1, g, j === entries.length - 1));
    line(ind, (arr ? "]" : "}") + comma, g);
  };
  line(0, "{", -1);
  const keys = Object.keys(record);
  keys.forEach((k, j) => emit(k, record[k], 1, gOf(k), j === keys.length - 1));
  line(0, "}", -1);
  return out.join("");
}

export function labelerView(): CloserView {
  const ex = fixture10908.task;
  const html = `<div class="box-in lab" style="--lh:${LH}px">
    <div class="panes">
      <div class="code"><div class="fname">shop/cart.py . example file</div><div class="lines"></div></div>
      <div class="side">
        <div class="layer diff"><h5>The fix (unified diff)</h5>
          <div class="h">@@ -3 +3 @@</div><div class="m">-TAX = 0.08</div><div class="p">+TAX = 0.0825</div>
          <div class="h">@@ -11,0 +12,3 @@</div><div class="p">+    def remove(self, item):</div><div class="p">+        self.items = [x for x in self.items if x[0] != item]</div><div class="p">+</div>
          <div class="h">@@ -13 +16 @@</div><div class="m">-        s = sum(i.price * q for i, q in self.items)</div><div class="p">+        s = sum(i.price * q for i, q in self.items if q &gt; 0)</div>
        </div>
        <div class="layer result off"><h5>Labels for this file</h5>
          <div class="grp">gold</div>
          <div class="row" data-r="1"><span class="k">files</span><span>shop/cart.py</span></div>
          <div class="row" data-r="3"><span class="k">classes</span><span>Cart . 5-14</span></div>
          <div class="row" data-r="3"><span class="k">functions</span><span>Cart.total . 12-14</span></div>
          <div class="grp">not gold</div>
          <div class="row" data-r="5"><span class="k">functions</span><span>Cart.add, the method above the new one</span></div>
          <div class="grp">unretrievable</div>
          <div class="row" data-r="5"><span class="k">functions</span><span>Cart.remove (new in the fix)</span></div>
          <div class="grp">tags</div>
          <div class="row" data-r="4"><span class="k">module_level</span><span>true (line 3)</span></div>
        </div>
      </div>
    </div>
    <div class="key off"><div class="json"></div><div class="notes"></div></div>
  </div>`;

  type Line = { d: HTMLElement; L: number; kind: "base" } | { d: HTMLElement; n: number; kind: "new" };
  let root!: HTMLElement, caret!: HTMLElement, probe!: HTMLElement, key!: HTMLElement, json!: HTMLElement;
  const lines: Line[] = [];
  const defs = new Map<string, { df: Def; d: HTMLElement }>();
  let lastI = -1;
  let run: gsap.core.Timeline | null = null;

  const hot = (j: number, on: boolean) => {
    key.querySelectorAll(`.jl[data-g="${j}"]`).forEach((l) => l.classList.toggle("hot", on));
    key.querySelector(`.note[data-g="${j}"]`)?.classList.toggle("hot", on);
  };
  const scrollToGroup = (j: number) => {
    const first = key.querySelector<HTMLElement>(`.jl[data-g="${j}"]`);
    if (first) json.scrollTo({ top: first.offsetTop - 40 });
  };

  function mount(el: HTMLElement) {
    root = el;
    const box = q(el, ".lines");
    BASE.forEach((tx, j) => {
      const L = j + 1, d = document.createElement("div");
      d.className = "ln";
      const alt = ALT[L];
      d.innerHTML = `<span class="no">${L}</span><span class="tx"><span class="cur">${esc(tx) || " "}</span>${alt ? `<span class="alt">${esc(alt)}</span>` : ""}</span>${L === 3 ? `<span class="badge">outside every function</span>` : ""}`;
      box.appendChild(d);
      lines.push({ d, L, kind: "base" });
    });
    NEW.forEach((tx, j) => {
      const d = document.createElement("div");
      d.className = "ln add hide";
      d.innerHTML = `<span class="no">${12 + j}</span><span class="tx">${esc(tx) || " "}</span>`;
      box.appendChild(d);
      lines.push({ d, n: j, kind: "new" });
    });
    DEFS.forEach((df) => { const d = document.createElement("div"); d.className = "def"; d.innerHTML = `<span class="lab">${df.lab}</span>`; box.appendChild(d); defs.set(df.id, { df, d }); });
    caret = document.createElement("div"); caret.className = "caret"; caret.innerHTML = `<span>+ 3 lines: a new method</span>`; box.appendChild(caret);
    probe = document.createElement("div"); probe.className = "probe"; box.appendChild(probe);
    key = q(el, ".key");
    json = q(key, ".json");
    json.innerHTML = `<div class="src">${esc(ex.file)} . 1 line of ${ex.bytes.toLocaleString("en-US")} bytes . shown pretty-printed, long text shortened</div>` + jsonLines(ex.record);
    q(key, ".notes").innerHTML = GROUPS.map((g, j) => `<div class="note" data-g="${j}" style="--gc:${g.c}"><b>${g.t}</b>${g.d}</div>`).join("")
      + `<div class="real">In this task the fix inserts 3 lines inside <code>get_feature_names</code>. That method exists at base, so it is the gold function (lines 994 to 999), and <code>CountVectorizer</code> (559 to 999) is the gold class.</div>`;
    key.querySelectorAll<HTMLElement>(".note").forEach((n) => {
      const j = Number(n.dataset.g);
      n.onmouseenter = () => { hot(j, true); scrollToGroup(j); };
      n.onmouseleave = () => hot(j, false);
    });
  }

  type Box = { top: number; height: number; left: number; right: number };
  const rect = (r0: number, r1: number, depth: number): Box => ({ top: r0 * LH - 4, height: (r1 - r0 + 1) * LH + 7, left: 34 + depth * 16, right: 12 + depth * 10 });
  const place = (el: HTMLElement, r: Box) => Object.assign(el.style, { top: `${r.top}px`, height: `${r.height}px`, left: `${r.left}px`, right: `${r.right}px` });
  const def = (id: string) => defs.get(id)!.d;

  // the whole picture for step i; CSS transitions animate the change
  function apply(i: number) {
    const fixed = i >= 5;
    for (const o of lines) {
      if (o.kind === "base") {
        o.d.style.top = `${(fixed ? fixedRow(o.L) : o.L - 1) * LH}px`;
        q(o.d, ".no").textContent = String(fixed ? fixedRow(o.L) + 1 : o.L);
        o.d.classList.toggle("chg", i >= 1 && (o.L === 3 || o.L === 13));
        o.d.classList.toggle("fixed", fixed && !!ALT[o.L]);
        o.d.querySelector(".badge")?.classList.toggle("on", i >= 4);
      } else {
        o.d.style.top = `${(11 + o.n) * LH}px`;
        o.d.classList.toggle("hide", !fixed);
      }
    }
    for (const { df, d } of defs.values()) {
      const span = fixed ? df.f : df.b;
      d.classList.toggle("on", i >= 2 && !!span && (df.id !== "remove" || fixed));
      if (span) place(d, rect(span[0] - 1, span[1] - 1, df.d));
      d.classList.toggle("gold", i >= 3 && df.id === "total");
      d.classList.toggle("goldc", i >= 3 && df.id === "Cart");
      d.classList.toggle("newdef", df.id === "remove");
    }
    caret.style.top = `${11 * LH}px`;
    caret.classList.toggle("on", i >= 1 && !fixed);
    q(root, ".diff").classList.toggle("off", i >= 1);
    q(root, ".result").classList.toggle("off", i < 1);
    root.querySelectorAll<HTMLElement>(".row").forEach((r) => { const at = Number(r.dataset.r); r.classList.toggle("on", i >= at); r.classList.toggle("fresh", i === at); });
    key.classList.toggle("off", i < 6);
  }

  // a probe ring that starts at a line and grows to each box it checks, outward
  function probeTo(tl: gsap.core.Timeline, targets: [Box, (() => void) | null][]) {
    targets.forEach(([r, after], j) => {
      tl.to(probe, { top: r.top, height: r.height, left: r.left, right: r.right, opacity: 1, duration: j ? 0.45 : 0.01, ease: "power2.inOut" });
      if (after) tl.add(after).to({}, { duration: 0.35 });
    });
    tl.to(probe, { opacity: 0, duration: 0.25 });
  }

  function show(i: number) {
    const forward = i === lastI + 1;
    lastI = i;
    if (run) { run.progress(1).kill(); run = null; } // finish an old step at once, so it never ends after a new one starts
    gsap.killTweensOf(probe);
    gsap.set(probe, { opacity: 0 });
    if (forward && i === 3) {
      apply(2);
      run = gsap.timeline();
      probeTo(run, [[rect(12, 12, 1.6), null], [rect(11, 13, 1), () => def("total").classList.add("gold")], [rect(4, 13, 0), () => def("Cart").classList.add("goldc")]]);
      run.add(() => apply(3));
    } else if (forward && i === 5) {
      apply(5);
      run = gsap.timeline({ delay: 0.7 });
      probeTo(run, [[rect(11, 12, 1.6), null],
        [rect(11, 12, 1), () => { gsap.fromTo(def("remove"), { x: -4 }, { x: 4, duration: 0.06, repeat: 5, yoyo: true, clearProps: "x" }); }],
        [rect(4, 16, 0), () => { gsap.fromTo(def("Cart"), { scale: 1 }, { scale: 1.01, duration: 0.15, yoyo: true, repeat: 1 }); }]]);
    } else if (forward && i === 6) {
      apply(6);
      json.scrollTop = 0;
      run = gsap.timeline();
      run.fromTo(key.querySelectorAll(".jl"), { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.018, clearProps: "opacity,transform" }, 0.2)
        .fromTo(key.querySelectorAll(".note, .real"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.08, clearProps: "opacity,transform" }, 0.4)
        .add(() => { hot(3, true); scrollToGroup(3); })
        .add(() => hot(3, false), "+=2.2");
    } else apply(i);
  }

  return {
    short: "Labeler", title: "How the labeler finds gold", sig: "labels.label_patch . labeler v2", bar: "the labeler",
    code: ["cmeval.labels.label_patch", "cmeval.labels.innermost", "cmeval.labels.find_definitions"],
    steps: [
      { t: "The fix", d: "The fix changes 3 places in <code>shop/cart.py</code>, an example file. The labeler starts from the file at the base commit (the time machine) and the aligned diff (the diff reader)." },
      { t: "Changed lines", d: "Lines 3 and 13 change. The new method is a pure insertion after line 11. Every code file with a changed line is gold." },
      { t: "Definitions", d: "<code>find_definitions</code> parses the base file with tree-sitter. Each named class and function becomes a box. Boxes nest: methods sit inside their class." },
      { t: "Innermost wins", d: "Line 13 is inside <code>total</code> and inside <code>Cart</code>. The innermost function (<code>total</code>) and the innermost class (<code>Cart</code>) turn gold. Outer functions do not." },
      { t: "Outside every function", d: "Line 3 is outside every function and class. It adds no gold function or class. The task gets the tag <code>module_level_change</code>. The file is still gold." },
      { t: "Added lines", d: "Added lines are placed in the fixed file. <code>remove</code> does not exist at the base commit, so no system can find it: it goes to <i>unretrievable</i>. The innermost definition that exists at base is <code>Cart</code>. The method above, <code>add</code>, does not turn gold." },
      { t: "The answer key", d: "A real answer key: one line of <code>tasks/swebv-dev50.jsonl</code>, the task for scikit-learn-10908. The labeler wrote the <code>gold</code> and <code>unretrievable</code> parts. Hover a note to find its fields." },
    ],
    html, mount, show,
    dispose() { run?.kill(); gsap.killTweensOf(probe); },
  };
}
