// Look closer: what reading costs (metrics/tokens.py). The real hit texts and token counts of the
// grep-fn-plus top 10 for scikit-learn-10908, from the token cache (scripts/gen_examples.py).
import { gsap } from "gsap";
import { fixtureB5 as EX } from "../data/load";
import { esc } from "../lib/esc";
import { hitsInBudget as fit, runningTotals } from "../lib/budget";
import { nv3, nvLayer, nvNow, nvNum, nvShell, nvShort } from "./nv";
import type { CloserStep, CloserView } from "./types";

const BUD = [500, 1000, 2000, 4000, 8000];
const MAXT = 8000;

export function tokensView(): CloserView {
  const SY = EX.systems["grep-fn-plus"], G = SY.grade, FN = G.function, h1 = SY.top[0]!;
  const baseSys = EX.systems["grep-fn"], base = baseSys.grade, OH = EX.token_cache.overhead;
  const cum = runningTotals(G.tokens), bcum = runningTotals(base.tokens);
  const first = FN.first, ttf = FN.metrics.tokens_to_first ?? null;
  const cached = SY.top.filter((h) => h.cached).length;
  const found = (b: number) => (FN.metrics[`recall@budget${b}`] ?? 0) > 0;
  const steps: CloserStep[] = [
    { t: "What a hit costs", d: `An agent must read a hit before it can use it. This is the real text of hit #1 (${esc(h1.symbol ?? "")}), exactly as the agent sees it. It is ${nvNum(G.tokens[0]!)} tokens. Tokens are the units of text a model reads, and you pay for each one.` },
    { t: "The count", d: `The scorer asks the model's token-count API to count each text. The API adds ${OH} tokens around any message, so the scorer takes ${OH} off: ${nvNum(G.tokens[0]! + OH)} - ${OH} = ${nvNum(G.tokens[0]!)}.` },
    { t: "The cache", d: `Counting costs an API call, so each count is saved. The key is the sha256 of the text: the same text is counted once and then read from the cache. ${cached === SY.top.length ? `All ${cached}` : `${cached} of ${SY.top.length}`} texts here came from the cache.` },
    { t: "Tokens to first", d: `The agent reads the hits in rank order. The running total when it reaches the first right hit is "tokens to first": ${first && ttf !== null ? `${nvNum(ttf)} tokens at #${first}` : "no value, because it never reaches one"}. Fewer is better.` },
    { t: "Budgets", d: (() => {
        const ok = BUD.filter(found), no = BUD.filter((b) => !found(b));
        return `What if the agent can read only a fixed number of tokens? Only whole hits fit. ${no.length ? `At ${no.map(nvNum).join(", ")} tokens the gold function is not yet read: recall 0. ` : ""}${ok.length ? `From ${nvNum(ok[0]!)} tokens on it is read: recall 1. ` : ""}The 1,000 budget fits ${fit(cum, 1000)} whole hits.`;
      })() },
    { t: "Compare: grep-fn with no options", d: base.function.first === null
        ? `The plain grep-fn list for the same task never reaches the gold function in its ${baseSys.n_hits} hits. So it has no tokens-to-first value, and recall is 0 at every budget. Better ranking means cheaper reading.`
        : `The plain grep-fn list reaches the gold function at #${base.function.first}, after ${nvNum(base.function.metrics.tokens_to_first ?? 0)} tokens.` },
  ];
  const bar = (c: number[], rel: number[][], tok: number[], cls: string) => {
    let x = 0, out = "";
    for (let k = 0; k < c.length && x < MAXT; k++) {
      const wd = Math.min(tok[k]!, MAXT - x);
      out += `<i class="${(rel[k]?.length ?? 0) > 0 ? "g" : ""}" style="left:${((x / MAXT) * 100).toFixed(2)}%;width:${((wd / MAXT) * 100).toFixed(2)}%" title="#${k + 1}: ${tok[k]}"></i>`;
      x += tok[k]!;
    }
    return `<div class="tb ${cls}">${out}</div>`;
  };
  const html = nvShell("tk",
    `<div class="lyr on" data-l="text"><h5>hit #1 . ${esc(h1.symbol ?? "")} . ${esc(nvShort(h1.path))} ${h1.start}-${h1.end}</h5><pre class="hit">${esc(h1.text)}</pre><div class="big">${nvNum(G.tokens[0]!)} tokens</div></div>
     <div class="lyr" data-l="count"><div class="flow"><div class="bx">the hit text</div><span>&rarr;</span><div class="bx">token-count API<br><b>${nvNum(G.tokens[0]! + OH)}</b></div><span>&rarr;</span><div class="bx">minus overhead<br><b>${OH}</b></div><span>&rarr;</span><div class="bx gold">stored count<br><b>${nvNum(G.tokens[0]!)}</b></div></div></div>
     <div class="lyr" data-l="cache"><h5>token cache: sha256 of the text &rarr; count</h5>${SY.top.map((h, k) => `<div class="cr"><span>#${k + 1}</span><code>${h.sha.slice(0, 16)}...</code><b>${nvNum(G.tokens[k]!)}</b><em>${h.cached ? "cached" : "estimate"}</em></div>`).join("")}</div>
     <div class="lyr" data-l="bar"><h5>tokens read, hit by hit (0 to ${nvNum(MAXT)}); gold = the right hit</h5>
       <div class="lanes"><div class="lane"><small>grep-fn-plus</small>${bar(cum, FN.relevance, G.tokens, "a")}</div>
       <div class="lane base"><small>grep-fn (no options)</small>${bar(bcum, base.function.relevance, base.tokens, "b")}</div>
       <div class="buds">${BUD.map((b) => `<div class="bud${b === MAXT ? " end" : ""}" style="left:${((b / MAXT) * 100).toFixed(2)}%"><span>${nvNum(b)}</span></div>`).join("")}</div></div>
       <div class="ttf"></div></div>`,
    `<div class="facts"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  return {
    short: "Tokens", title: "What reading costs", sig: "metrics/tokens.py . token_metrics", bar: "what reading costs",
    code: ["cmeval.metrics.tokens.token_metrics", "cmeval.metrics.tokens.AnthropicCounter"],
    steps, html,
    mount(el) { root = el; },
    show(i) {
      if (!root) return;
      run?.progress(1).kill();
      run = gsap.timeline();
      nvNow(root, steps[i]!);
      const facts = root.querySelector<HTMLElement>(".facts")!;
      root.classList.toggle("withbud", i >= 4);
      root.classList.toggle("withbase", i >= 5);
      if (i === 0) { nvLayer(root, "text"); facts.innerHTML = `<b>hit #1</b> ${nvNum(G.tokens[0]!)} tokens<br><b>lines of text</b> ${h1.text.split("\n").length}`; }
      if (i === 1) { nvLayer(root, "count"); run.fromTo(root.querySelectorAll(".flow > *"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.15 }, 0.2); facts.innerHTML = `<b>overhead</b> ${OH} tokens, measured once and saved in the cache`; }
      if (i === 2) { nvLayer(root, "cache"); run.fromTo(root.querySelectorAll(".cr"), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.05 }, 0.2); facts.innerHTML = `<b>cached</b> ${cached} of ${SY.top.length}`; }
      if (i >= 3) {
        nvLayer(root, "bar");
        if (i === 3) run.fromTo(root.querySelectorAll(".tb.a i"), { opacity: 0 }, { opacity: 1, duration: 0.15, stagger: 0.12 }, 0.2);
        root.querySelector(".ttf")!.innerHTML = first && ttf !== null ? `tokens to first: <b>${nvNum(ttf)}</b> (#${first})` : "not found";
        const bm = base.function.metrics;
        facts.innerHTML = i === 3 ? `<b>running total at #${first ?? "-"}</b> ${ttf === null ? "-" : nvNum(ttf)}`
          : i === 4 ? BUD.map((b) => `<b>${nvNum(b)}</b> ${fit(cum, b)} hits, recall ${nv3(FN.metrics[`recall@budget${b}`])}`).join("<br>")
          : `<b>grep-fn tokens to first</b> ${bm.tokens_to_first === null || bm.tokens_to_first === undefined ? "no value (not found)" : nvNum(bm.tokens_to_first)}<br>` + BUD.map((b) => `<b>${nvNum(b)}</b> recall ${nv3(bm[`recall@budget${b}`])}`).join("<br>");
      }
    },
    dispose() { run?.kill(); },
  };
}
