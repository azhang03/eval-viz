// Look closer: how a report is made (report.py and metrics/stats.py). It explains the steps from a
// scored run to report.md. The numbers are an example: the run 2026-10-23-dev50-final, made again by
// the committed report code (scripts/gen_results.py checks that the report it makes equals the
// committed report.md). The view makes no claims about results (viz decision 25).
import { gsap } from "gsap";
import { resultsFinal as R } from "../data/load";
import { esc } from "../lib/esc";
import { nvLayer, nvNow, nvNum, nvShell } from "./nv";
import { svg, type CloserStep, type CloserView } from "./types";

const ALPHA = 0.05;
const LABEL: Record<string, string> = {
  grep: "grep (files only)",
  "grep-fn": "grep-fn",
  "grep-fn-plus": "grep-fn-plus",
  "cm-bm25": "codemem: BM25",
  "cm-bm25-code": "codemem: BM25 + code",
  "cm-bm25-code-usage": "codemem: BM25 + code + usage",
};
const label = (name: string) => LABEL[name] ?? name;
const f3 = (v: number | null | undefined) => (v === null || v === undefined ? "-" : v.toFixed(3)); // always 3 decimals here
const signed = (v: number | null) => (v === null ? "-" : `${v >= 0 ? "+" : ""}${v.toFixed(3)}`);
const ci = (c: [number, number] | null) => (c ? `[${signed(c[0])}, ${signed(c[1])}]` : "");
const pFmt = (p: number | null) => (p === null ? "-" : p < 0.001 ? "<0.001" : p.toFixed(3));
const valFmt = (metric: string, v: number | null) => (v === null ? "null" : metric === "tokens_to_first" ? nvNum(v) : String(v));

/** The banner on every step: what the example run is, and what a normal report is. */
const EXAMPLE = `Example numbers from run <code>${esc(R.run)}</code>: an early ${esc(R.split)} run on a ${R.tasks}-task SWE-bench sample. A normal report uses the full task set, and its reported results come from the test split.`;

export function resultsView(): CloserView {
  const fnStat = (name: string, metric: string) => R.systems.find((s) => s.name === name)?.levels.function?.[metric] ?? null;
  const line = R.systems.filter((s) => s.levels.function);
  const fileOnly = R.systems.filter((s) => !s.levels.function).map((s) => s.name);
  const nFn = fnStat(R.baseline, "mrr")?.n ?? 0;
  const mrrTests = R.primary.filter((p) => p.metric === "mrr");
  const ex = mrrTests[mrrTests.length - 1]!; // one example comparison: the last primary MRR test
  const exRow = R.example_rows[0];

  const steps: CloserStep[] = [
    { t: "The input: one score for each task", d: `A report starts from a scored run. <code>scores.jsonl</code> has one row for each task, system, level, overlap threshold, and metric: here ${nvNum(R.scores_rows)} rows. Each row is one number, for example the MRR of one system on one task. The report reads only the scored run files and the tasks file; it does no search.` },
    { t: "Averages", d: `For each system and metric, the report takes the mean over the tasks. At function level only tasks that have a gold function count: ${nFn} of the ${R.tasks} here. Function MRR leads the report: how early the first right function comes (1 at rank 1, 1/6 at rank 6, 0 if missed).` },
    { t: "Intervals: how sure a mean is", d: `A mean from a few tasks could be different on other tasks. The bootstrap estimates that: draw the tasks again, with replacement, 10,000 times, and take the mean each time. The middle 95% of those means is the interval (the bar). A wide bar means the mean is not sure.` },
    { t: "Paired comparison", d: `Two systems are compared on the same tasks: one difference for each task (system minus baseline), then the mean difference and its interval. The Wilcoxon test asks if the differences lean one way more than chance would give. The baseline is the strong grep (${esc(R.baseline)}), so a lead must beat a fair grep.` },
    { t: "Holm: many tests, one rule", d: `Each test can give a false alarm by chance, so many tests give more. The primary tests are fixed before the results (${R.primary.length} here: each codemem system on function MRR and on tokens to the first right function). Holm raises the p-values of the family, so the chance of any false alarm stays at ${ALPHA * 100}% or less. Example: ${pFmt(ex.p)} becomes ${pFmt(ex.p_holm)}.` },
    { t: "The report file", d: `<code>cmeval report</code> writes all of this to <code>report.md</code>: the main tables at file, function, and class level, the paired comparisons, group tables, the IoU check, latency and size, and task counts. The same scores always give the same report: the tasks are in sorted order and the bootstrap seed is fixed. Warnings at the top flag problems, for example token estimates instead of real counts.` },
  ];

  // the chart: function MRR means (step 2) and their intervals (step 3)
  const W = 720, X0 = 250, X1 = 690, RH = 46, Y0 = 50, H = Y0 + line.length * RH + 60;
  const xs = (v: number) => X0 + v * (X1 - X0); // MRR 0 to 1
  const rowsHtml = R.example_rows.map((r) => `<tr><td>${esc(r.task_id)}</td><td>${esc(r.system)}</td><td>${esc(r.level)}</td><td>${r.iou ?? "-"}</td><td>${esc(r.metric)}</td><td><b>${esc(valFmt(r.metric, r.value))}</b></td></tr>`).join("");
  const holmRows = R.primary.map((p) => `<tr class="${p.p_holm !== null && p.p_holm < ALPHA ? "sig" : ""}"><td>${esc(label(p.system))}</td><td>${p.metric === "mrr" ? "function MRR" : "tokens to first"}</td><td>${pFmt(p.p)}</td><td><b>${pFmt(p.p_holm)}</b></td></tr>`).join("");
  const sectionList = R.sections.map((s) => `<li>${esc(s)}</li>`).join("");

  const html = nvShell("rs",
    `<div class="lyr on" data-l="input"><div class="warn">${EXAMPLE}</div>
       <h5>a few rows of scores.jsonl</h5>
       <table><thead><tr><th>task</th><th>system</th><th>level</th><th>IoU</th><th>metric</th><th>value</th></tr></thead><tbody>${rowsHtml}</tbody></table>
       <div class="note">${exRow ? `The ${esc(exRow.system)} rows for ${esc(exRow.task_id)} grade the same ranked list as the SCORE line.` : ""}</div></div>
     <div class="lyr" data-l="chart"><div class="warn">${EXAMPLE}</div><h5>function MRR: mean, and its 95% interval (higher is better)</h5><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin meet"></svg>
       ${fileOnly.length ? `<div class="note">${fileOnly.map((n) => esc(label(n))).join(", ")} returns files only, so it has no function MRR.</div>` : ""}</div>
     <div class="lyr" data-l="pair"><div class="warn">${EXAMPLE}</div><h5>one paired comparison: ${esc(label(ex.system))} against ${esc(R.baseline)}</h5>
       <div class="pair"><div><span>tasks compared</span><b>${ex.n}</b></div><div><span>${esc(R.baseline)} mean</span><b>${f3(ex.baseline_mean)}</b></div><div><span>${esc(label(ex.system))} mean</span><b>${f3(ex.system_mean)}</b></div>
       <div><span>mean difference [95% interval]</span><b>${signed(ex.diff)} ${ci(ex.ci)}</b></div><div><span>Wilcoxon p (before Holm)</span><b>${pFmt(ex.p)}</b></div></div>
       <div class="note">An interval that contains 0 means the data cannot rule out "no difference".</div></div>
     <div class="lyr" data-l="holm"><div class="warn">${EXAMPLE}</div><h5>the primary tests: p before and after Holm (significant if below ${ALPHA})</h5>
       <table><thead><tr><th>codemem system</th><th>metric</th><th>p</th><th>Holm p</th></tr></thead><tbody>${holmRows}</tbody></table>
       <div class="note">Holm sorts the p-values, multiplies the smallest by ${R.primary.length}, the next by ${R.primary.length - 1}, and so on, and never lets a later one fall below an earlier one.</div></div>
     <div class="lyr" data-l="file"><div class="warn">${EXAMPLE}</div><h5>the sections of report.md, in order</h5><ol class="secs">${sectionList}</ol>
       <div class="note">Warnings in this example: ${R.warnings.length ? R.warnings.map(esc).join("; ") : "none"}.</div></div>`,
    `<div class="facts"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  const bars: SVGRectElement[] = [];
  const dots: SVGGElement[] = [];

  function mount(el: HTMLElement) {
    root = el;
    const s = el.querySelector("svg")!;
    const t = (x: number, y: number, str: string, o: Record<string, string | number> = {}) => { const n = svg("text", { x, y, "font-family": "IBM Plex Mono", "font-size": 12, fill: "#2b2622", ...o }, s); n.textContent = str; return n; };
    const axisY = Y0 + line.length * RH + 6;
    svg("line", { x1: X0, x2: X1, y1: axisY, y2: axisY, stroke: "#8a7f72" }, s);
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { svg("line", { x1: xs(v), x2: xs(v), y1: Y0 - 14, y2: axisY, stroke: "rgba(43,38,34,.08)" }, s); t(xs(v), axisY + 18, String(v), { "text-anchor": "middle", "font-size": 11, fill: "#8a7f72" }); });
    line.forEach((sys, j) => {
      const st = fnStat(sys.name, "mrr");
      const y = Y0 + j * RH + RH / 2;
      const cm = sys.name.startsWith("cm-");
      t(X0 - 12, y + 4, label(sys.name), { "text-anchor": "end" });
      if (st?.ci) bars.push(svg("rect", { x: xs(st.ci[0]), y: y - 7, width: Math.max(2, xs(st.ci[1]) - xs(st.ci[0])), height: 14, rx: 7, fill: cm ? "rgba(47,143,138,.35)" : "rgba(91,111,181,.35)" }, s));
      if (st) {
        const g = svg("g", {}, s);
        svg("circle", { cx: xs(st.mean), cy: y, r: 6, fill: cm ? "#2f8f8a" : "#5b6fb5", stroke: "#2b2622", "stroke-width": 1.5 }, g);
        const v = svg("text", { x: xs(st.mean), y: y - 12, "text-anchor": "middle", "font-family": "IBM Plex Mono", "font-size": 11, "font-weight": 700, fill: "#2b2622" }, g);
        v.textContent = f3(st.mean);
        dots.push(g);
      }
    });
  }

  function show(i: number) {
    if (!root) return;
    run?.progress(1).kill();
    run = gsap.timeline();
    nvNow(root, steps[i]!);
    const layer = ["input", "chart", "chart", "pair", "holm", "file"][i]!;
    nvLayer(root, layer);
    const facts = root.querySelector<HTMLElement>(".facts")!;
    // step 2 shows the means only; step 3 adds the interval bars
    run.set(bars, { opacity: i >= 2 ? 1 : 0 }, 0);
    if (i === 1) run.fromTo(dots, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.1 }, 0.2);
    if (i === 2) run.fromTo(bars, { scaleX: 0, transformOrigin: "50% 50%" }, { scaleX: 1, duration: 0.5, stagger: 0.1 }, 0.2);
    if (i === 0 || i === 4) run.fromTo(root.querySelectorAll(`[data-l="${layer}"] tbody tr`), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.06 }, 0.2);
    if (i === 5) run.fromTo(root.querySelectorAll(".secs li"), { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.04 }, 0.2);
    facts.innerHTML = [
      `<b>rows in scores.jsonl</b> ${nvNum(R.scores_rows)}<br><b>tasks</b> ${R.tasks} <b>systems</b> ${R.systems.length}`,
      `<b>tasks with a gold function</b> ${nFn} of ${R.tasks}<br><b>code</b> report.Scores`,
      `<b>resamples</b> 10,000 <b>interval</b> 95%<br><b>code</b> stats.bootstrap_ci`,
      `<b>baseline</b> ${esc(R.baseline)}<br><b>code</b> stats.differences, stats.wilcoxon`,
      `<b>tests in the family</b> ${R.primary.length}<br><b>code</b> stats.holm`,
      `<b>sections</b> ${R.sections.length}<br><b>code</b> report.report`,
    ][i]!;
  }

  return {
    short: "Report", title: "How a report is made", sig: "report.py . metrics/stats.py", bar: "how a report is made",
    code: ["cmeval.report.report", "cmeval.report.Scores", "cmeval.metrics.stats.bootstrap_ci", "cmeval.metrics.stats.wilcoxon", "cmeval.metrics.stats.holm"],
    steps, html, mount, show,
    dispose() { run?.kill(); },
  };
}
