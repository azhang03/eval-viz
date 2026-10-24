// Look closer: from matching lines to functions (adapters/grep_fn.py), then the four switches of
// grep-fn-plus, on the real scikit-learn-10908 results (scripts/gen_examples.py runs the real code).
import { gsap } from "gsap";
import { fixtureB5 as EX } from "../data/load";
import { esc } from "../lib/esc";
import { isNotCode, isTestPath, nvLayer, nvNow, nvNum, nvShell, nvShort } from "./nv";
import { svg, type CloserStep, type CloserView } from "./types";

const kindOf = (p: string) => (isTestPath(p) ? "a test file" : isNotCode(p) ? "not code" : "code");

export function grepfnView(): CloserView {
  const S = EX.switches, GF = EX.task.gold_file, GFN = EX.task.gold_fn;
  const nHits = EX.systems["grep-fn"].n_hits;
  const rankTxt = (r: number | null) => (r === null ? `<span class="bad">not in the top ${nHits}</span>` : `<span class="${r <= 10 ? "ok" : ""}">rank ${r}</span>`);
  const sw = (name: string) => S.find((s) => s.switch === name)!;
  const wsorted = Object.entries(sw("idf").weights).sort((a, b) => b[1] - a[1]);
  const inside = EX.gold_file_lines.filter((l) => l.fn).length, outside = EX.gold_file_outside;
  const files = EX.grep.files, goldRank = EX.grep.gold_file_rank ?? 0;
  const top1 = files[0]![0], after = files[goldRank]?.[0];
  const testWins = (name: string) => isTestPath(sw(name).top[0]?.path ?? "");
  const steps: CloserStep[] = [
    { t: "Files by match count", d: `grep counts the keyword matches in each file and ranks files by count. ${nvNum(EX.grep.files_matched)} files match. Rank 1 is <code>${esc(nvShort(top1))}</code> (${kindOf(top1)}). The gold file <code>${esc(nvShort(GF))}</code> is rank ${goldRank}${after ? `, and right after it is <code>${esc(nvShort(after))}</code> (${kindOf(after)})` : ""}.` },
    { t: "Into functions", d: `An agent's next step is to read the function around each match. grep-fn does the same: each matching line in <code>${esc(nvShort(GF))}</code> drops into the innermost function around it. ${inside} lines land in a function; ${outside} lines are outside every function and are dropped.` },
    { t: "Rank the functions", d: `With no options, a function scores its number of matches.${testWins("none") ? " Long test functions that repeat common words win." : ""} The gold function <code>${esc(GFN.symbol.split(".").pop() ?? "")}</code>: ${rankTxt(sw("none").gold_fn_rank)}.` },
    { t: "+ Python files only", d: `The first switch searches only Python files, not docs, images, and data. ${nvNum(sw("none").files_total)} files become ${nvNum(sw("types").files_total)}. The gold function: ${rankTxt(sw("types").gold_fn_rank)}.${testWins("types") ? " Test functions still win." : ""}` },
    { t: "+ IDF weights", d: `A rare keyword says more than a common one. With IDF, a function scores the weights of the different keywords it has, not the raw count. "${esc(wsorted[0]![0])}" weighs ${wsorted[0]![1].toFixed(2)}; "${esc(wsorted[wsorted.length - 1]![0])}" weighs ${wsorted[wsorted.length - 1]![1].toFixed(2)}. The gold function: ${rankTxt(sw("idf").gold_fn_rank)}.` },
    { t: "+ clean keywords", d: `This switch drops keywords that cannot name code (web addresses, paths, file names, hashes). ${EX.keywords.dropped_by_cleaning.length ? "This issue has some." : "This issue has none, so nothing changes."} The gold function: ${rankTxt(sw("clean").gold_fn_rank)}.` },
    { t: "+ tests last", d: `The last switch puts functions in test files after all other functions. An agent looks for the code to fix, not its tests. The gold function: ${rankTxt(sw("tests_last").gold_fn_rank)}. All four switches together are grep-fn-plus.` },
  ];
  const maxC = files[0]![1];
  const fileRows = files.map(([p, n], j) => {
    const tag = isTestPath(p) ? "test" : isNotCode(p) ? "not code" : "";
    return `<div class="fr${p === GF ? " gold" : ""}"><span class="rk">${j + 1}</span><span class="pth">${esc(nvShort(p))}${tag ? ` <em>${tag}</em>` : ""}</span><span class="bw"><i style="width:${((100 * n) / maxC).toFixed(1)}%"></i></span><span class="ct">${n}</span></div>`;
  }).join("");
  const html = nvShell("gf",
    `<div class="lyr on" data-l="files"><h5>grep: files ranked by match count (top 10)</h5>${fileRows}</div>
     <div class="lyr" data-l="strip"><h5>${esc(GF)}: match lines and functions</h5><svg viewBox="0 0 720 360" preserveAspectRatio="xMidYMid meet"></svg></div>
     <div class="lyr" data-l="rank"><h5>grep-fn: functions ranked (top 10)</h5><div class="sw"></div><div class="rt"></div><div class="gl"></div></div>`,
    `<div class="facts"></div>`);

  // rows (y): matching lines at the top, function boxes, the dropped lane, the line-number axis
  const X0 = 24, X1 = 696, LINES = Math.max(...EX.gold_file_lines.map((l) => l.line), ...EX.gold_file_functions.map((f) => f.end)), TOPY = 40, BY = 140, BH = 64, DY = 252, AY = 300;
  const xl = (l: number) => X0 + ((l - 1) / (LINES - 1)) * (X1 - X0);
  const GOLD = "#e9b440", MUTED = "#8a7f72", INK = "#2b2622";
  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  let ticks: SVGRectElement[] = [];

  function mount(el: HTMLElement) {
    root = el;
    const s = el.querySelector("svg")!;
    const txt = (x: number, y: number, str: string | number, o: Record<string, string | number> = {}) => { const t = svg("text", { x, y, "font-family": "IBM Plex Mono", "font-size": 11, fill: MUTED, ...o }, s); t.textContent = String(str); return t; };
    svg("line", { x1: X0, x2: X1, y1: AY, y2: AY, stroke: MUTED, "stroke-width": 1 }, s);
    const marks = [1, 300, 600, 900, 1200].filter((l) => l < LINES).concat(LINES);
    marks.forEach((l) => txt(xl(l), AY + 16, l, { "text-anchor": "middle", "font-size": 10 }));
    txt(X0, AY + 34, `line number in ${nvShort(GF)}`, { "font-size": 10 });
    txt(X0, TOPY - 10, `matching lines (${EX.gold_file_lines.length}), at their line numbers`);
    svg("rect", { x: X0, y: DY - 4, width: X1 - X0, height: 22, rx: 5, fill: "rgba(43,38,34,.04)", stroke: "#d9ccb8", "stroke-dasharray": "4 3" }, s);
    txt(X0, DY - 10, `outside every function: dropped (${outside})`, { fill: "#a5372a" });
    for (const f of EX.gold_file_functions) {
      const gold = f.symbol === GFN.symbol, x = xl(f.start), wd = Math.max(3, xl(f.end) - x);
      svg("rect", { x, y: BY, width: wd, height: BH, rx: 3, fill: gold ? GOLD : "#efe6d6", stroke: gold ? "#8a5a14" : "#b9a98f", "stroke-width": gold ? 2 : 1 }, s);
    }
    txt(X0, BY - 36, "functions (boxes); each line drops into the innermost function around it");
    const lab = (f: (typeof EX.gold_file_functions)[number], gold: boolean) => {
      const x = xl((f.start + f.end) / 2);
      svg("line", { x1: x, x2: x, y1: BY - 4, y2: BY - 12, stroke: gold ? "#8a5a14" : MUTED }, s);
      txt(x, BY - 15, `${gold ? "gold: " : ""}${f.symbol.split(".").pop()} (${f.lines} lines)`, { "text-anchor": "middle", fill: gold ? "#8a5a14" : INK, "font-weight": gold ? 700 : 400 });
    };
    const gfn = EX.gold_file_functions.find((f) => f.symbol === GFN.symbol);
    if (gfn) lab(gfn, true);
    const most = EX.gold_file_functions.reduce((a, b) => (b.lines > a.lines ? b : a));
    if (most !== gfn) lab(most, false);
    ticks = EX.gold_file_lines.map((l) => { const r = svg("rect", { x: xl(l.line) - 1, y: TOPY, width: 2.4, height: 14, fill: l.fn === GFN.symbol ? "#d4673f" : "#5b6fb5" }, s); r.dataset.fn = l.fn ?? ""; return r; });
  }

  function rankTable(q: number) {
    if (!root) return;
    const s = S[q]!;
    root.querySelector(".sw")!.innerHTML = ["Python only", "IDF", "clean keywords", "tests last"].map((n, j) => `<span class="pill${j < q ? " on" : ""}">${n}</span>`).join("");
    root.querySelector(".rt")!.innerHTML = s.top.map((h, j) =>
      `<div class="fr${h.symbol === GFN.symbol && h.path === GF ? " gold" : ""}"><span class="rk">${j + 1}</span><span class="pth">${esc(h.symbol ?? "")}${isTestPath(h.path) ? " <em>test</em>" : ""}</span><span class="fl">${esc(nvShort(h.path))}</span></div>`).join("");
    root.querySelector(".gl")!.innerHTML = `gold function <code>${esc(GFN.symbol)}</code>: ${rankTxt(s.gold_fn_rank)}`;
    run?.fromTo(root.querySelectorAll(".rt .fr"), { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.04 }, 0.2);
  }

  function show(i: number) {
    if (!root) return;
    run?.progress(1).kill();
    run = gsap.timeline();
    nvNow(root, steps[i]!);
    const facts = root.querySelector<HTMLElement>(".facts")!;
    if (i === 0) {
      nvLayer(root, "files");
      run.fromTo(root.querySelectorAll('[data-l="files"] .bw i'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, stagger: 0.05, transformOrigin: "0 50%" }, 0.2);
      facts.innerHTML = `<b>files that match</b> ${nvNum(EX.grep.files_matched)}<br><b>gold file</b> ${esc(nvShort(GF))}: rank ${goldRank}`;
    } else if (i === 1) {
      nvLayer(root, "strip");
      // every tick starts in the top row; it ends in its function box, or in the dropped lane (and stays there)
      ticks.forEach((t, j) => {
        const into = !!t.dataset.fn;
        run!.fromTo(t, { attr: { y: TOPY, fill: t.dataset.fn === GFN.symbol ? "#d4673f" : "#5b6fb5" } },
          into ? { attr: { y: BY + 6 + (j % 5) * 10 }, duration: 0.6, ease: "bounce.out" } : { attr: { y: DY, fill: "#b9b2a6" }, duration: 0.6, ease: "bounce.out" }, 0.6 + (j % 40) * 0.02);
      });
      facts.innerHTML = `<b>match lines in this file</b> ${EX.gold_file_lines.length}<br><b>inside a function</b> ${inside}<br><b>outside, dropped</b> ${outside}<br><b>gold function</b> ${esc(GFN.symbol)} (${GFN.start}-${GFN.end})`;
    } else {
      nvLayer(root, "rank");
      rankTable(i - 2);
      const s = S[i - 2]!;
      facts.innerHTML = `<b>files searched</b> ${nvNum(s.files_total)}<br><b>gold file rank</b> ${s.gold_file_rank}<br><b>keywords</b> ${s.keywords.length}`
        + (s.switch === "idf" ? `<h5>IDF weights (real)</h5>${wsorted.slice(0, 3).concat(wsorted.slice(-3)).map(([k, v]) => `<div class="wt"><span>${esc(k)}</span><i style="width:${((v / wsorted[0]![1]) * 100).toFixed(0)}%"></i><b>${v.toFixed(2)}</b></div>`).join("")}` : "");
    }
  }

  return {
    short: "grep-fn", title: "From matching lines to functions", sig: "adapters/grep_fn.py . GrepFnRetriever", bar: "from matching lines to functions",
    code: ["cmeval.adapters.grep_fn.GrepFnRetriever", "cmeval.adapters.grep.rg_files"],
    steps, html, mount, show,
    dispose() { run?.kill(); },
  };
}
