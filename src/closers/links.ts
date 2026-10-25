// Look closer: two ways to find the issue that a PR fixes (collect/links.py). The PR texts and
// both answers come from the real functions on the real PRs (scripts/gen_fresh.py): python/cpython
// #154728, where both ways agree, and apache/airflow #69916, where SWE-bench's rule misses.
import { gsap } from "gsap";
import { fixtureFresh as F } from "../data/load";
import type { FreshExample } from "../data/types";
import { esc } from "../lib/esc";
import { nvLayer, nvNow, nvNum, nvShell } from "./nv";
import type { CloserStep, CloserView } from "./types";

/** The PR text with the real regex matches and the "word: #N" places marked. */
function markedText(e: FreshExample): string {
  const raw = e.real.prText;
  const cls = new Array<string>(raw.length).fill("");
  for (const m of e.real.colonLinks) for (let c = m.start; c < m.end; c++) cls[c] = "near";
  for (const m of e.real.matches) for (let c = m.start; c < m.end; c++) cls[c] = m.closing ? "hit" : "word";
  let out = "";
  for (let c = 0; c < raw.length;) {
    let end = c + 1;
    while (end < raw.length && cls[end] === cls[c]) end++;
    const part = esc(raw.slice(c, end).replace(/\r/g, ""));
    out += cls[c] ? `<span class="lk-${cls[c]}">${part}</span>` : part;
    c = end;
  }
  return out;
}

const nums = (xs: number[]) => (xs.length ? xs.map((x) => `#${x}`).join(", ") : "none");

export function linksView(): CloserView {
  const A = F.examples.crate, B = F.examples.links;
  const hit = A.real.prText.slice(A.real.matches[0]?.start ?? 0, A.real.matches[0]?.end ?? 0);
  const near = B.real.colonLinks[0] ? B.real.prText.slice(B.real.colonLinks[0].start, B.real.colonLinks[0].end) : "";
  const howA = A.real.findLinks[String(A.issue.number)] ?? "none";
  const howB = B.real.findLinks[String(B.issue.number)] ?? "none";
  const titleRef = A.pr.title.split(":")[0] ?? "";
  const af = F.repos[B.repo]!, afRegex = (af.linkMethods.both ?? 0) + (af.linkMethods.regex ?? 0), afAll = af.counts.no_leak ?? 0;
  const L = F.linkMethods, all = L.both + L.list + L.regex, byRegex = L.both + L.regex;
  const steps: CloserStep[] = [
    { t: "Two ways to find the issue", d: `A task needs the one issue that its PR fixes. The collector asks in two ways, on every PR. The first is GitHub's own list of the issues a PR closes. GitHub fills it from closing words in the PR description and from links set by hand. For ${esc(A.repo)} PR #${A.pr.number}, the list has ${nums(A.real.listLinks)}.` },
    { t: "SWE-bench's rule", d: `The second is the rule that SWE-bench used: a closing word (close, fix, resolve, and their forms), a space, then "#" or the issue's web address, then the number. It reads the PR title, the PR body, and every commit message. Here it finds "${esc(hit)}". The title's "${esc(titleRef)}" does not count: it has no "#".` },
    { t: "Both agree", d: `Both ways find issue #${A.issue.number}, so the task records its link as "${esc(howA)}". A PR must link exactly one issue. With no issue or more than one, it is dropped.` },
    { t: "When the rule misses", d: `${esc(B.repo)} PR #${B.pr.number}: its template writes "${esc(near)}". The colon is not a space, so SWE-bench's rule finds nothing. GitHub's list has ${nums(B.real.listLinks)}, so the task records "${esc(howB)}". The same real function on the same text without the colon finds ${nums(B.real.regexWithoutColon)} (an illustration). In ${esc(B.repo)}, the rule finds ${afRegex} of ${afAll} links.` },
    { t: "Why we keep both", d: `Of ${nvNum(all)} candidates, both ways found ${nvNum(L.both)}, GitHub's list only ${nvNum(L.list)}, and the rule only ${nvNum(L.regex)}. So SWE-bench's own rule finds ${Math.round((byRegex / all) * 100)}% of the links. Every task records how its link was found, so a task set with SWE-bench's rule only is one filter.` },
  ];
  const panel = (e: FreshExample) => `<div class="qhead">${esc(e.repo)} . PR #${e.pr.number} . title, body, commit messages</div><div class="qtext">${markedText(e)}</div>`;
  const html = nvShell("lk",
    `<div class="lyr on" data-l="a">${panel(A)}</div><div class="lyr" data-l="b">${panel(B)}</div>`,
    `<div class="lk-ways"><div class="lk-way" data-w="list"><i></i><b>GitHub's list</b><span></span></div><div class="lk-way" data-w="regex"><i></i><b>SWE-bench's rule</b><span></span></div></div><div class="facts"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  const way = (w: "list" | "regex", state: "off" | "on" | "miss" | "wait", text: string) => {
    const el = root?.querySelector<HTMLElement>(`.lk-way[data-w="${w}"]`);
    if (!el) return;
    el.className = `lk-way ${state}`;
    el.querySelector("span")!.innerHTML = text;
  };
  return {
    short: "Links", title: "Two ways to find the issue", sig: "collect/links.py . find_links", bar: "two ways to find the issue",
    code: ["cmeval.collect.links.find_links", "cmeval.collect.links.list_links", "cmeval.collect.links.regex_links", "cmeval.collect.links.issues_pattern", "cmeval.collect.links.pr_text"],
    steps, html,
    mount(el) { root = el; },
    show(i) {
      if (!root) return;
      run?.progress(1).kill();
      run = gsap.timeline();
      nvNow(root, steps[i]!);
      nvLayer(root, i === 3 ? "b" : "a");
      root.classList.toggle("marks", i >= 1);
      const facts = root.querySelector<HTMLElement>(".facts")!;
      if (i <= 2) {
        way("list", "on", nums(A.real.listLinks));
        way("regex", i === 0 ? "wait" : "on", i === 0 ? "" : nums(A.real.regexLinks));
        facts.innerHTML = i === 2 ? `<b>link</b> #${A.issue.number} . ${esc(howA)}` : "";
      } else if (i === 3) {
        way("list", "on", nums(B.real.listLinks));
        way("regex", "miss", nums(B.real.regexLinks));
        facts.innerHTML = `<b>link</b> #${B.issue.number} . ${esc(howB)}<br><b>without the colon</b> ${nums(B.real.regexWithoutColon)}<br><b>${esc(B.repo)}</b> the rule finds ${afRegex} of ${afAll}`;
      } else {
        way("list", "on", `${nvNum(L.both + L.list)} of ${nvNum(all)}`);
        way("regex", "on", `${nvNum(byRegex)} of ${nvNum(all)}`);
        facts.innerHTML = `<b>both</b> ${nvNum(L.both)}<br><b>list only</b> ${nvNum(L.list)}<br><b>rule only</b> ${nvNum(L.regex)}`;
      }
      run.fromTo(root.querySelectorAll(".lk-way.on, .lk-way.miss"), { scale: 0.96 }, { scale: 1, duration: 0.3, ease: "back.out(2)", stagger: 0.1 });
      // scroll only the text pane, so the mark is in view (the layer is the mark's offset parent)
      const lyr = root.querySelector<HTMLElement>(`.lyr[data-l="${i === 3 ? "b" : "a"}"]`);
      const mark = lyr?.querySelector<HTMLElement>(".lk-hit, .lk-near");
      if (lyr && mark && i >= 1) gsap.to(lyr, { scrollTop: Math.max(0, mark.offsetTop - lyr.clientHeight / 3), duration: 0.4 });
    },
    dispose() { run?.kill(); },
  };
}
