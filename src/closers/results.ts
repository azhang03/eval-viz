// Look closer: the first results (REPORT). The numbers of the final dev run, made again by the
// committed report code from eval/results/ (scripts/gen_results.py checks that the report it makes
// equals the committed report.md). Every number and every verdict here is read from that data.
import { gsap } from "gsap";
import { resultsFinal as R } from "../data/load";
import { esc } from "../lib/esc";
import { nvLayer, nvNow, nvNum, nvShell } from "./nv";
import { svg, type CloserStep, type CloserView } from "./types";

const ALPHA = 0.05;
const LABEL: Record<string, string> = {
  grep: "grep (files only)",
  "grep-fn": "grep-fn (naive)",
  "grep-fn-plus": "grep-fn-plus (strong grep)",
  "cm-bm25": "codemem: BM25",
  "cm-bm25-code": "codemem: BM25 + code",
  "cm-bm25-code-usage": "codemem: BM25 + code + usage",
};
const label = (name: string) => LABEL[name] ?? name;
// short names for the narrow test table
const SHORT: Record<string, string> = { "cm-bm25": "BM25", "cm-bm25-code": "BM25 + code", "cm-bm25-code-usage": "BM25 + code + usage" };
const shortLabel = (name: string) => SHORT[name] ?? name;
const nv3 = (v: number | null | undefined) => (v === null || v === undefined ? "-" : v.toFixed(3)); // always 3 decimals in this view
const signed = (v: number | null, digits = 3) => (v === null ? "-" : `${v >= 0 ? "+" : ""}${digits === 0 ? nvNum(Math.round(v)) : v.toFixed(digits)}`);
const ci = (c: [number, number] | null, digits = 3) => (c ? `[${signed(c[0], digits)}, ${signed(c[1], digits)}]` : "");
const pFmt = (p: number | null) => (p === null ? "-" : p < 0.001 ? "<0.001" : p.toFixed(3));

export function resultsView(): CloserView {
  const fnStat = (name: string, metric: string) => R.systems.find((s) => s.name === name)?.levels.function?.[metric] ?? null;
  const line = R.systems.filter((s) => s.levels.function);
  const fileOnly = R.systems.filter((s) => !s.levels.function).map((s) => s.name);
  const best = [...line].sort((a, b) => (fnStat(b.name, "mrr")?.mean ?? 0) - (fnStat(a.name, "mrr")?.mean ?? 0))[0]!;
  const naive = fnStat("grep-fn", "mrr"), strong = fnStat(R.baseline, "mrr"), top = fnStat(best.name, "mrr");
  const mrrTests = R.primary.filter((p) => p.metric === "mrr");
  const ttfTests = R.primary.filter((p) => p.metric === "tokens_to_first");
  const sig = R.primary.filter((p) => p.p_holm !== null && p.p_holm < ALPHA);
  const bestTest = mrrTests.find((p) => p.system === best.name);
  const bestTtf = ttfTests.find((p) => p.system === best.name);
  const b4 = R.b4, b4MaxTok = Math.max(...b4.systems.map((s) => s.largest_token_diff_pct));
  const b4AllSame = b4.systems.every((s) => s.same_top === s.tasks);

  const steps: CloserStep[] = [
    { t: "What was measured", d: `${R.tasks} real GitHub issues from ${R.repos} Python repos (SWE-bench Verified, ${esc(R.split)} split). For each issue, every system searched the code as it was just before the fix. The answer key is the code the fix changed. ${line.length + fileOnly.length} systems: grep, two grep-fn baselines, and three codemem setups. The ${esc(R.split)} split guides development; it is not the final result.` },
    { t: "The main number: function MRR", d: `Function MRR asks how early the first right function comes (1 at rank 1, 1/6 at rank 6, 0 if missed), averaged over the ${top?.n ?? R.tasks} tasks that have a gold function. The bar is the 95% interval: the range the average would likely fall in for other tasks of this kind. The best system is ${esc(label(best.name))}: ${nv3(top?.mean)} ${ci(top?.ci ?? null)}.` },
    { t: "A weak baseline, then a strong one", d: `The proposal's grep-fn ranks by raw match counts, so long functions, test files, and docs win: MRR ${nv3(naive?.mean)}. Four switches fix that (see RUN, grep-fn, Look closer): grep-fn-plus scores ${nv3(strong?.mean)}, ${naive && strong && naive.mean > 0 ? `${(strong.mean / naive.mean).toFixed(1)} times as high` : "much higher"}. The report tests against the strong grep, so a win must be a real win.` },
    { t: "The six primary tests", d: `Fixed before the results: each codemem system against ${esc(R.baseline)}, on the same tasks, on function MRR and on tokens to the first right function. One Holm correction over all ${R.primary.length} tests keeps the chance of any false alarm at ${ALPHA * 100}% or less. Significant: <b>${sig.length} of ${R.primary.length}</b>.${bestTest ? ` ${esc(label(best.name))}: MRR ${signed(bestTest.diff)} ${ci(bestTest.ci)}, Holm p ${pFmt(bestTest.p_holm)}.` : ""}` },
    { t: "Reading cost", d: `An agent pays for every token it reads. Within 1,000 tokens, ${esc(label(best.name))} finds ${nv3(fnStat(best.name, "recall@budget1000")?.mean)} of the gold functions, against ${nv3(fnStat(R.baseline, "recall@budget1000")?.mean)} for ${esc(R.baseline)}.${bestTtf?.found ? ` On the same tasks, it finds ${bestTtf.found["system only"]} that ${esc(R.baseline)} misses, and misses ${bestTtf.found["baseline only"]} that ${esc(R.baseline)} finds.` : ""}` },
    { t: "Checks and caveats", d: `The index check passed (${esc(b4.result)}): with index updates and with full rebuilds, ${b4AllSame ? "every system had the same top 10 on every task" : "the top 10s agreed"}; token counts differed by at most ${b4MaxTok}%. Caveats: these are ${esc(R.split)} tasks; grep-fn-plus was tuned on them, so it is a little flattered; and with ${R.tasks} tasks a gain of about 0.1 MRR is hard to tell from chance. The fresh test split (F4) comes next.` },
  ];

  // the interval chart (function MRR), one row for each line-level system
  const W = 720, X0 = 250, X1 = 690, RH = 46, Y0 = 50, H = Y0 + line.length * RH + 60;
  const xs = (v: number) => X0 + v * (X1 - X0); // MRR 0 to 1
  const testRows = R.primary.map((p) => `<tr class="${p.p_holm !== null && p.p_holm < ALPHA ? "sig" : ""}"><td>${esc(shortLabel(p.system))}</td><td>${p.metric === "mrr" ? "function MRR" : "tokens to first"}</td><td>${p.n}</td><td>${p.metric === "mrr" ? nv3(p.baseline_mean) : nvNum(Math.round(p.baseline_mean ?? 0))}</td><td>${p.metric === "mrr" ? nv3(p.system_mean) : nvNum(Math.round(p.system_mean ?? 0))}</td><td>${signed(p.diff, p.metric === "mrr" ? 3 : 0)} <small>${ci(p.ci, p.metric === "mrr" ? 3 : 0)}</small></td><td>${pFmt(p.p_holm)}</td><td>${p.p_holm !== null && p.p_holm < ALPHA ? "yes" : "no"}</td></tr>`).join("");
  const costRows = line.map((s) => `<tr class="${s.name === best.name ? "best" : ""} ${s.name === R.baseline ? "base" : ""}"><td>${esc(label(s.name))}</td><td>${nv3(fnStat(s.name, "recall@budget1000")?.mean)}</td><td>${nv3(fnStat(s.name, "recall@budget8000")?.mean)}</td><td>${nv3(fnStat(s.name, "not_found_share")?.mean)}</td></tr>`).join("");
  const foundRows = ttfTests.filter((p) => p.found).map((p) => `<tr><td>${esc(shortLabel(p.system))}</td><td>${p.found!.both}</td><td>${p.found!["system only"]}</td><td>${p.found!["baseline only"]}</td><td>${p.found!.neither}</td></tr>`).join("");
  const b4Rows = b4.systems.map((s) => `<tr><td>${esc(s.system)}</td><td>${s.same_top} of ${s.tasks}</td><td>${s.largest_metric_diff.toFixed(4)}</td><td>${s.largest_token_diff_pct}%</td><td>${esc(s.result)}</td></tr>`).join("");
  const parts = R.code.parts.map((p) => `<li>${p.systems.map((n) => esc(label(n))).join(", ")}: run <code>${esc(p.run)}</code> at cmeval <code>${esc(p.cmeval)}</code></li>`).join("");

  const html = nvShell("rs",
    `<div class="lyr on" data-l="intro">
       <div class="cards"><div><b>${R.tasks}</b><span>tasks</span></div><div><b>${R.repos}</b><span>repos</span></div><div><b>${line.length + fileOnly.length}</b><span>systems</span></div><div><b>3</b><span>levels: file, class, function</span></div></div>
       <h5>Run ${esc(R.run)}: two runs of the same tasks, merged</h5><ul class="parts">${parts}</ul>
       <div class="warn">${esc(R.split)} split: guidance for development, not the final result.</div></div>
     <div class="lyr" data-l="chart"><h5>function MRR, mean and 95% interval (higher is better)</h5><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin meet"></svg>
       ${fileOnly.length ? `<div class="note">${fileOnly.map((n) => esc(label(n))).join(", ")} returns files only, so it has no function MRR.</div>` : ""}</div>
     <div class="lyr" data-l="tests"><h5>primary tests: each codemem system against ${esc(R.baseline)} (Holm over ${R.primary.length}, significant at ${ALPHA})</h5>
       <table><thead><tr><th>codemem</th><th>metric</th><th>tasks</th><th>baseline</th><th>codemem</th><th>difference [95% CI]</th><th>Holm p</th><th>significant</th></tr></thead><tbody>${testRows}</tbody></table>
       <div class="note">Tokens to first is paired on the tasks both systems found. Negative is better (fewer tokens).</div></div>
     <div class="lyr" data-l="cost"><h5>gold functions found within a token budget (function level)</h5>
       <table><thead><tr><th>system</th><th>within 1,000</th><th>within 8,000</th><th>never found</th></tr></thead><tbody>${costRows}</tbody></table>
       <h5>who finds the gold function (tasks), against ${esc(R.baseline)}</h5>
       <table><thead><tr><th>codemem</th><th>both</th><th>system only</th><th>${esc(R.baseline)} only</th><th>neither</th></tr></thead><tbody>${foundRows}</tbody></table></div>
     <div class="lyr" data-l="checks"><h5>update vs. rebuild check (${esc(b4.run)}): ${esc(b4.result)}</h5>
       <table><thead><tr><th>system</th><th>same top 10</th><th>largest metric difference</th><th>largest token difference</th><th>result</th></tr></thead><tbody>${b4Rows}</tbody></table>
       <h5>caveats</h5><ul class="cav"><li>${esc(R.split)} split: these tasks guided the design.</li><li>grep-fn-plus was tuned on these tasks, so it is a little flattered.</li><li>${R.tasks} tasks give little power. A fresh test split (F4) comes next.</li></ul></div>`,
    `<div class="facts"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  const rowsG: SVGGElement[] = [];

  function mount(el: HTMLElement) {
    root = el;
    const s = el.querySelector("svg")!;
    const t = (x: number, y: number, str: string, o: Record<string, string | number> = {}) => { const n = svg("text", { x, y, "font-family": "IBM Plex Mono", "font-size": 12, fill: "#2b2622", ...o }, s); n.textContent = str; return n; };
    // the axis: 0 to 1, with marks
    const axisY = Y0 + line.length * RH + 6;
    svg("line", { x1: X0, x2: X1, y1: axisY, y2: axisY, stroke: "#8a7f72" }, s);
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { svg("line", { x1: xs(v), x2: xs(v), y1: Y0 - 14, y2: axisY, stroke: "rgba(43,38,34,.08)" }, s); t(xs(v), axisY + 18, String(v), { "text-anchor": "middle", "font-size": 11, fill: "#8a7f72" }); });
    line.forEach((sys, j) => {
      const st = fnStat(sys.name, "mrr"), r10 = fnStat(sys.name, "recall@10");
      const y = Y0 + j * RH + RH / 2;
      const g = svg("g", { class: `row ${sys.name === R.baseline ? "base" : ""} ${sys.name.startsWith("cm-") ? "cm" : "gr"}` }, s);
      const lab = svg("text", { x: X0 - 12, y: y + 4, "text-anchor": "end", "font-family": "IBM Plex Mono", "font-size": 12, fill: "#2b2622" }, g); lab.textContent = label(sys.name);
      if (st?.ci) svg("rect", { x: xs(st.ci[0]), y: y - 7, width: Math.max(2, xs(st.ci[1]) - xs(st.ci[0])), height: 14, rx: 7, fill: sys.name.startsWith("cm-") ? "rgba(47,143,138,.35)" : "rgba(91,111,181,.35)" }, g);
      if (st) {
        svg("circle", { cx: xs(st.mean), cy: y, r: 6, fill: sys.name.startsWith("cm-") ? "#2f8f8a" : "#5b6fb5", stroke: "#2b2622", "stroke-width": 1.5 }, g);
        const v = svg("text", { x: xs(st.mean), y: y - 12, "text-anchor": "middle", "font-family": "IBM Plex Mono", "font-size": 11, "font-weight": 700, fill: "#2b2622" }, g); v.textContent = nv3(st.mean);
      }
      const r = svg("text", { x: X1 + 2, y: y + 4, "text-anchor": "end", "font-family": "IBM Plex Mono", "font-size": 10, fill: "#8a7f72" }, g); r.textContent = r10 ? `R@10 ${nv3(r10.mean)}` : "";
      rowsG.push(g);
    });
  }

  function show(i: number) {
    if (!root) return;
    run?.progress(1).kill();
    run = gsap.timeline();
    nvNow(root, steps[i]!);
    const facts = root.querySelector<HTMLElement>(".facts")!;
    const layer = ["intro", "chart", "chart", "tests", "cost", "checks"][i]!;
    nvLayer(root, layer);
    // step 3 (the baselines) dims the codemem rows; step 2 shows all rows
    rowsG.forEach((g) => run!.to(g, { opacity: i === 2 && g.classList.contains("cm") ? 0.2 : 1, duration: 0.3 }, 0));
    if (i === 1) run.fromTo(rowsG, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.12 }, 0.2);
    if (i === 3 || i === 4 || i === 5) run.fromTo(root.querySelectorAll(`[data-l="${layer}"] tbody tr`), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.06 }, 0.2);
    facts.innerHTML = [
      `<b>run</b> ${esc(R.run)}<br><b>baseline</b> ${esc(R.baseline)}<br><b>primary systems</b> ${R.primary_systems.map(esc).join(", ")}`,
      line.map((s) => `<b>${esc(s.name)}</b> ${nv3(fnStat(s.name, "mrr")?.mean)}`).join("<br>"),
      `<b>grep-fn</b> ${nv3(naive?.mean)}<br><b>grep-fn-plus</b> ${nv3(strong?.mean)}`,
      `<b>significant</b> ${sig.length} of ${R.primary.length}<br><b>smallest Holm p</b> ${pFmt(Math.min(...R.primary.map((p) => p.p_holm ?? 1)))}`,
      line.map((s) => `<b>${esc(s.name)}</b> ${nv3(fnStat(s.name, "recall@budget1000")?.mean)} within 1,000`).join("<br>"),
      `<b>index check</b> ${esc(b4.result)}<br><b>largest token difference</b> ${b4MaxTok}%`,
    ][i]!;
  }

  return {
    short: "Results", title: "The first results", sig: `report . ${R.run}`, bar: "the first results",
    code: ["cmeval.report.report", "cmeval.metrics.stats.bootstrap_ci", "cmeval.metrics.stats.holm"],
    steps, html, mount, show,
    dispose() { run?.kill(); },
  };
}
