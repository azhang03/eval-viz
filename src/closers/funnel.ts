// Look closer: the yield funnel of the fresh-task collector (collect/candidates.py and
// collect/tasks_build.py). The counts and drop reasons are the real fresh-v1 meta file
// (eval/tasks/fresh-v1.meta.json at the timeline commit, through scripts/gen_fresh.py).
import { gsap } from "gsap";
import { fixtureFresh as F } from "../data/load";
import { esc } from "../lib/esc";
import { nvLayer, nvNow, nvNum, nvShell } from "./nv";
import type { CloserStep, CloserView } from "./types";

/**
 * The funnel steps in groups, with the drop reasons of each group. The meta file counts reasons
 * without their step, so this list joins them; tests/fresh.test.ts checks that the reasons of
 * each group add up to the drop between its first and last step.
 */
export const FUNNEL_GROUPS = [
  { from: "merged", to: "not_bot", reasons: ["fix PR opened before the start date", "bot author"] },
  { from: "not_bot", to: "one_link", reasons: ["no linked issue", "several linked issues"] },
  { from: "one_link", to: "no_leak", reasons: ["link is a PR, not an issue", "issue not found", "issue opened after the fix PR", "short body", "body version not stored by GitHub", "leak"] },
  { from: "no_leak", to: "labeled", reasons: ["merge commit not found", "merge commit has no parent", "rebase base not found", "more than 100 files", "file list differs", "patch does not apply", "no code files", "too many code files", "too many changed lines", "label error", "only new files", "invalid task", "git error"] },
] as const;

/** Drop reason -> count, over all repos. */
export function dropTotals(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of Object.values(F.repos)) for (const [k, n] of Object.entries(r.dropReasons)) out[k] = (out[k] ?? 0) + n;
  return out;
}

export function funnelView(): CloserView {
  const T = F.total, keys = F.steps.map((s) => s.key), drops = dropTotals();
  const max = T[keys[0]!] ?? 1;
  const n = (k: string) => nvNum(T[k] ?? 0);
  const groupDrop = (g: number) => (T[FUNNEL_GROUPS[g]!.from] ?? 0) - (T[FUNNEL_GROUPS[g]!.to] ?? 0);
  const repos = Object.entries(F.repos);
  const big = repos[0]!;
  const share = Math.round((big[1].tasks / F.stats.tasks) * 100);
  const dev = F.stats.tasks_per_split.dev ?? 0, test = F.stats.tasks_per_split.test ?? 0;
  const steps: CloserStep[] = [
    { t: "From merged PRs to tasks", d: `The collector checks every PR merged into the ${F.chosen.length} repos from ${esc(F.since)} to ${esc(F.until)}. Each bar is the number of PRs left after one check: from ${n("merged")} merged PRs to ${n("labeled")} tasks. For each PR it drops, the funnel keeps the step and the reason.` },
    { t: "The cutoff and bots", d: `A fix must be opened on or after ${esc(F.since)}: its code was not public before the model's training data ends. ${nvNum(drops["fix PR opened before the start date"] ?? 0)} PRs were opened before. PRs by bots (dependabot, renovate, and others) are dropped too: ${nvNum(drops["bot author"] ?? 0)}.` },
    { t: "One linked issue", d: `The largest drop. A task needs an issue: its text is the query. ${nvNum(drops["no linked issue"] ?? 0)} PRs link no issue, and ${nvNum(drops["several linked issues"] ?? 0)} link more than one, so the query would be unclear. ${n("one_link")} PRs are left.` },
    { t: "The issue checks", d: `The link must be an issue, not a PR, and the issue must be opened before the fix PR. Its body (as it was then) must have at least ${F.settings.min_body_chars} characters, and the query must not name the fix. ${n("no_leak")} PRs pass: these are the candidates.` },
    { t: "The git checks", d: `With the full clone: the base commit, our own patch, the PR's file list, the apply check, the size limits (1 to ${F.settings.max_code_files} code files, at most ${F.settings.max_code_lines} changed lines), and the labels. The most common drop: the fix changes no code file (only tests or docs). ${n("labeled")} tasks are left.` },
    { t: "Each repo", d: `The repos give very different numbers. ${esc(big[0])} alone gives ${nvNum(big[1].tasks)} tasks, ${share}% of the set. So the report shows the results of each repo next to the pooled numbers.` },
    { t: "The split", d: `Each task gets its split from a hash of its ID: ${nvNum(dev)} dev and ${nvNum(test)} test. Dev tasks are for building and tuning; test tasks are for the reported results. ${Math.round(F.stats.share_gold_all_python * 100)}% of the tasks change only Python code; the main comparison uses those.` },
  ];

  // the meta file names two settings in a step text; show their values from the same file
  const stepText = (t: string) => t.replace("max_code_files", String(F.settings.max_code_files)).replace("max_code_lines", String(F.settings.max_code_lines));
  const bars = F.steps.map((s, i) => {
    const w = ((T[s.key] ?? 0) / max) * 100;
    return `<div class="fn-r" data-k="${esc(s.key)}"><span class="fn-i">${i + 1}</span><span class="fn-t">${esc(stepText(s.text))}</span><span class="fn-bar"><i style="width:${w.toFixed(2)}%"></i></span><b>${n(s.key)}</b></div>`;
  }).join("");
  const repoMax = Math.max(...repos.map(([, r]) => r.counts.merged ?? 0));
  const repoRows = repos.map(([name, r]) => {
    const seg = (v: number, cls: string) => `<i class="${cls}" style="width:${((v / repoMax) * 100).toFixed(2)}%"></i>`;
    return `<div class="fn-repo"><span class="fn-rn">${esc(name)}</span><span class="fn-stack">${seg(r.counts.merged ?? 0, "m")}${seg(r.counts.no_leak ?? 0, "c")}${seg(r.tasks, "t")}</span><b>${nvNum(r.counts.merged ?? 0)} &rarr; ${nvNum(r.counts.no_leak ?? 0)} &rarr; ${nvNum(r.tasks)}</b></div>`;
  }).join("");
  const html = nvShell("fn",
    `<div class="lyr on" data-l="bars"><div class="fn-h">fresh-v1 funnel . PRs left after each check</div>${bars}</div>`
    + `<div class="lyr" data-l="repos"><div class="fn-h">each repo . merged PRs &rarr; candidates &rarr; tasks</div>${repoRows}<div class="fn-key"><i class="m"></i>merged <i class="c"></i>candidates <i class="t"></i>tasks</div></div>`
    + `<div class="lyr" data-l="split"><div class="fn-h">the split . ${nvNum(F.stats.tasks)} tasks</div><div class="fn-split"><i class="dev" style="flex:${dev}">dev ${nvNum(dev)}</i><i class="test" style="flex:${test}">test ${nvNum(test)}</i></div></div>`,
    `<div class="facts"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  const lit = (g: number | null) => {
    const on = g === null ? new Set(keys) : new Set(keys.slice(keys.indexOf(FUNNEL_GROUPS[g]!.from), keys.indexOf(FUNNEL_GROUPS[g]!.to) + 1));
    root?.querySelectorAll<HTMLElement>(".fn-r").forEach((r) => r.classList.toggle("dim", !on.has(r.dataset.k ?? "")));
  };
  return {
    short: "Funnel", title: "From merged PRs to tasks", sig: "collect/candidates.py . Funnel", bar: "the yield funnel of fresh-v1",
    code: ["cmeval.collect.candidates.Funnel", "cmeval.collect.candidates.collect_candidates", "cmeval.collect.tasks_build.build_tasks", "cmeval.collect.tasks_build.write_task_set"],
    steps, html,
    mount(el) { root = el; },
    show(i) {
      if (!root) return;
      run?.progress(1).kill();
      run = gsap.timeline();
      nvNow(root, steps[i]!);
      nvLayer(root, i === 5 ? "repos" : i === 6 ? "split" : "bars");
      const facts = root.querySelector<HTMLElement>(".facts")!;
      if (i === 0) {
        lit(null);
        facts.innerHTML = `<b>merged</b> ${n("merged")}<br><b>candidates</b> ${n("no_leak")}<br><b>tasks</b> ${n("labeled")}`;
        run.fromTo(root.querySelectorAll(".fn-bar i"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left", duration: 0.5, stagger: 0.06 });
      } else if (i <= 4) {
        const g = i - 1;
        lit(g);
        const rows = FUNNEL_GROUPS[g]!.reasons.filter((r) => drops[r]).map((r) => `<div class="fn-d"><span>${esc(r)}</span><b>${nvNum(drops[r]!)}</b></div>`).join("");
        facts.innerHTML = `<b>dropped here</b> ${nvNum(groupDrop(g))}${rows}`;
        run.fromTo(facts.querySelectorAll(".fn-d"), { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.06 });
      } else if (i === 5) {
        facts.innerHTML = repos.map(([name, r]) => `<div class="fn-d"><span>${esc(name)}</span><b>${nvNum(r.tasks)}</b></div>`).join("");
        run.fromTo(root.querySelectorAll(".fn-stack i"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left", duration: 0.45, stagger: 0.03 });
      } else {
        facts.innerHTML = `<b>dev</b> ${nvNum(dev)}<br><b>test</b> ${nvNum(test)}<br><b>only Python gold code</b> ${Math.round(F.stats.share_gold_all_python * 100)}%`;
        run.fromTo(root.querySelectorAll(".fn-split i"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left", duration: 0.5, stagger: 0.15 });
      }
    },
    dispose() { run?.kill(); },
  };
}
