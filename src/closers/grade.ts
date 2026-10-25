// Look closer: grading one ranked list (metrics/accuracy.py and metrics/matching.py). The real
// grep-fn-plus top 10 for scikit-learn-10908, graded by the real functions at three levels, and two
// hand-made examples from eval/tests, computed by the same functions (scripts/gen_examples.py).
import { gsap } from "gsap";
import { fixtureB5 as EX } from "../data/load";
import { esc } from "../lib/esc";
import { nv3, nvNow, nvShell, nvShort } from "./nv";
import type { CloserStep, CloserView } from "./types";

const LEVELS = ["file", "class", "function"] as const;

export function gradeView(): CloserView {
  const SY = EX.systems["grep-fn-plus"], G = SY.grade, top = SY.top, T = EX.tests_examples;
  const fm = G.function.metrics, firstFn = G.function.first;
  const firstOfFile = top.map((h, j) => top.findIndex((x) => x.path === h.path) === j); // file units keep the first hit of each file
  const rankIn = (units: number[][]) => units.findIndex((u) => u.length > 0) + 1; // 0: not found
  const fu = T.file_units, pr = T.precision;
  const kRow = (k: number) => `${nv3(fm[`recall@${k}`])}`;
  const steps: CloserStep[] = [
    { t: "One list", d: `The real top ${top.length} of grep-fn-plus for ${esc(EX.task.id)}. The answer key says the fix changed one function: <code>${esc(EX.task.gold_fn.symbol)}</code>. ${firstFn ? `It is at #${firstFn}.` : "It is not in the list."}` },
    { t: "MRR", d: `MRR is 1 divided by the rank of the first right hit. Here it is ${firstFn ? `1/${firstFn} = ` : ""}${nv3(fm.mrr)}. A list with the gold function first scores 1. The report averages MRR over all tasks.` },
    { t: "recall@k and success@k", d: `recall@k is the share of gold functions in the first k hits. success@k is 1 only if all of them are there. Here recall@1 is ${kRow(1)}, recall@5 is ${kRow(5)}, and recall@10 is ${kRow(10)}.` },
    { t: "precision@5", d: `precision@5 is the number of right hits among the first 5, divided by 5. Here it is ${nv3(fm["precision@5"])}. In a test example, two hits on the same gold item both count: precision@5 = ${nv3(pr.metrics["precision@5"])}, but recall@5 = ${nv3(pr.metrics["recall@5"])} (1 of ${pr.n_gold} gold items).` },
    { t: "File level uses file units", d: `At file level a repeated file counts once, at its first place. In the test example ${fu.hits.join(", ")}, the gold file is rank ${rankIn(fu.units)}, not ${rankIn(fu.raw)} (MRR ${nv3(fu.mrr_units)}, not ${nv3(fu.mrr_raw)}). In this list the gold file is at #${G.file.first}.` },
    { t: "Three levels, three answers", d: `The same list gets one grade at each level. ${LEVELS.map((lv) => `${lv[0]!.toUpperCase()}${lv.slice(1)}: rank ${G[lv].first ?? "-"}, MRR ${nv3(G[lv].metrics.mrr)}.`).join(" ")} The report shows all three.` },
  ];
  const rows = top.map((h, j) => `<div class="gr-r${j + 1 === firstFn ? " first" : ""}${j >= 5 ? " after5" : ""}"><span class="rk">#${j + 1}</span><span class="sym">${esc(h.symbol ?? "")}</span><span class="fl">${esc(nvShort(h.path))}${firstOfFile[j] ? "" : " <em>again</em>"}</span>`
    + LEVELS.map((lv) => `<span class="mk m-${lv}">${(G[lv].relevance[j]?.length ?? 0) > 0 ? "&#10003;" : ""}</span>`).join("") + `</div>`).join("");
  const html = nvShell("gr",
    `<div class="lyr on" data-l="list"><div class="gr-h"><span></span><span>hit</span><span>file</span><span class="mk">file</span><span class="mk">class</span><span class="mk">fn</span></div>${rows}</div>`,
    `<div class="score"></div><div class="test"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  const row = (k: string, v: string) => `<div class="sr"><span>${k}</span><b>${v}</b></div>`;
  return {
    short: "Grading", title: "Grading one ranked list", sig: "metrics/accuracy.py . accuracy_metrics", bar: "grading one ranked list",
    code: ["cmeval.metrics.accuracy.accuracy_metrics", "cmeval.metrics.matching.file_units", "cmeval.metrics.matching.raw_relevance"],
    steps, html,
    mount(el) { root = el; },
    show(i) {
      if (!root) return;
      run?.progress(1).kill();
      run = gsap.timeline();
      nvNow(root, steps[i]!);
      for (let k = 0; k < steps.length; k++) root.classList.toggle(`st${k}`, k === i);
      const score = root.querySelector<HTMLElement>(".score")!, test = root.querySelector<HTMLElement>(".test")!;
      test.innerHTML = "";
      if (i === 0) score.innerHTML = row("gold function", esc(EX.task.gold_fn.symbol)) + row("first right hit", firstFn ? `#${firstFn}` : "none");
      if (i === 1) score.innerHTML = row("first right hit", firstFn ? `#${firstFn}` : "none") + row("MRR", `${firstFn ? `1/${firstFn} = ` : ""}${nv3(fm.mrr)}`);
      if (i === 2) score.innerHTML = [1, 5, 10].map((k) => row(`recall@${k} . success@${k}`, `${nv3(fm[`recall@${k}`])} . ${nv3(fm[`success@${k}`])}`)).join("");
      if (i === 3) {
        score.innerHTML = row("precision@5", nv3(fm["precision@5"])) + row("precision@10", nv3(fm["precision@10"]));
        test.innerHTML = `<h5>Test example (eval/tests)</h5><div class="mini">hits: gold A, gold A, other . ${pr.n_gold} gold items</div>` + row("precision@5", nv3(pr.metrics["precision@5"])) + row("recall@5", nv3(pr.metrics["recall@5"]));
      }
      if (i === 4) {
        score.innerHTML = row("file level: first gold file", `#${G.file.first}`) + row("file MRR", nv3(G.file.metrics.mrr));
        test.innerHTML = `<h5>Test example (eval/tests)</h5><div class="mini">${fu.hits.map(esc).join(", ")}</div>` + row("rank on raw hits", `${rankIn(fu.raw)} (MRR ${nv3(fu.mrr_raw)})`) + row("rank on file units", `${rankIn(fu.units)} (MRR ${nv3(fu.mrr_units)})`);
      }
      if (i === 5) score.innerHTML = LEVELS.map((lv) => row(lv, `rank ${G[lv].first ?? "-"} . MRR ${nv3(G[lv].metrics.mrr)}`)).join("");
      run.fromTo(score.children, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.08 }, 0.1);
    },
    dispose() { run?.kill(); },
  };
}
