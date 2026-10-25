// Look closer: the issue as it was when the fix PR was opened (collect/issues.py, Decision 8).
// The real issue python/cpython #154726, its stored versions, and the answers of the real
// body_at, title_at, build_query, and leak (scripts/gen_fresh.py). The script checks that the
// query here equals the query in the committed task file.
import { gsap } from "gsap";
import { fixtureFresh as F } from "../data/load";
import { esc } from "../lib/esc";
import { secondsBetween as seconds } from "../lib/util";
import { nvLayer, nvNow, nvNum, nvShell } from "./nv";
import type { CloserStep, CloserView } from "./types";

const when = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;

export function rewindView(): CloserView {
  const E = F.examples.crate, I = E.issue, R = E.real, pr = E.pr;
  const versions = I.versions;
  const used = R.bodyAt.version ?? -1; // the version that the real body_at returned (-1: none of them)
  const later = versions.find((v) => v.at > pr.createdAt); // the first edit after the fix PR opened
  // display only: the lines that a version has and the version before it does not
  const added = (k: number) => {
    const before = new Set((versions[k - 1]?.body ?? "").split("\n"));
    return (versions[k]?.body ?? "").split("\n").filter((l) => l.trim() && !before.has(l));
  };
  const events = [
    { at: I.createdAt, label: "issue opened" },
    ...versions.slice(1).map((v) => ({ at: v.at, label: v.at > pr.createdAt ? "body edited (after the fix PR)" : "body edited" })),
    ...I.renames.map((r) => ({ at: r.createdAt, label: "title renamed" })),
    { at: pr.createdAt, label: `fix PR #${pr.number} opened`, cut: true },
    { at: pr.mergedAt, label: "fix merged" },
  ].sort((a, b) => a.at.localeCompare(b.at));
  const lateLines = later ? added(versions.indexOf(later)) : [];
  const visible = lateLines.filter((l) => !l.trim().startsWith("<!--"));
  const steps: CloserStep[] = [
    { t: "An issue has a history", d: `Issues are edited after they are written. An edit after the fix exists can describe the fix, and then the query would give the answer away. These are the real events of ${esc(E.repo)} issue #${I.number}, in order (not to scale).` },
    { t: "Every stored version", d: `GitHub keeps each version of an issue body. This issue has ${versions.length}. ${later ? `The first edit after the fix PR was opened came ${seconds(pr.createdAt, later.at)} s later, and it adds ${visible.length ? `"${esc(visible.join(" "))}"` : "hidden lines"}: a link to the fix PR.` : ""}` },
    { t: "Back to when the fix PR opened", d: `<code>body_at</code> takes the newest version from before that moment${versions[used] ? `: the one from ${esc(when(versions[used]!.at))}` : ""}. ${R.bodyAt.editedAfter ? "The task is tagged: body edited after the fix." : ""} <code>title_at</code> does the same with title renames. ${I.renames.length ? "" : "This title was never renamed, so it stays."}` },
    { t: "The query", d: `<code>build_query</code> joins the title, a blank line, and the body, and removes hidden HTML comments. Code blocks and the visible template text stay, as an agent would see them. This is the query of the task: the script checks that it equals the query in the task file.` },
    { t: "The leak check", d: `<code>leak</code> drops a query that names the fix PR (#${pr.number}) or one of its commits. This query ${R.leak ? `fails: ${esc(R.leak)}` : "passes"}. Run on the issue as it is today, <code>leak</code> ${R.leakNow ? `fails: ${esc(R.leakNow)}` : `also finds nothing, because "gh-${pr.number}" has no "#"`}. So here the step back in time is what keeps the fix PR out of the query.` },
    { t: "Across fresh-v1", d: `Of ${nvNum(F.edited.tasks)} tasks, ${nvNum(F.edited.body)} have a body and ${nvNum(F.edited.title)} have a title that changed after the fix PR was opened. Their queries use the earlier versions.` },
  ];

  const line = events.map((e) => `<div class="rw-ev${e.cut ? " cut" : ""}"><i></i><b>${esc(e.label)}</b><span>${esc(when(e.at))} UTC</span></div>`).join("");
  const cards = versions.map((v, k) => {
    const lines = k === 0 ? (v.body ?? "").split("\n").filter((l) => l.trim()).slice(0, 3) : added(k);
    const tag = v.at > pr.createdAt ? `<em class="late">after the fix PR</em>` : k === used ? `<em class="used">used for the query</em>` : "";
    return `<div class="rw-v${v.at > pr.createdAt ? " late" : ""}${k === used ? " used" : ""}"><div class="rw-vh">version ${k + 1} . ${esc(when(v.at))} ${tag}</div>`
      + `<div class="rw-vb">${k === 0 ? "<small>the first lines</small>" : "<small>lines this edit adds</small>"}${lines.map((l) => `<code>${esc(l)}</code>`).join("")}</div></div>`;
  }).join("");
  const title = R.titleAt.title;
  const body = R.query.slice(title.length).replace(/^\n+/, "");
  const html = nvShell("rw",
    `<div class="lyr on" data-l="time"><div class="qhead">${esc(E.repo)} . issue #${I.number}</div><div class="rw-line">${line}</div></div>`
    + `<div class="lyr" data-l="versions"><div class="qhead">stored versions of the body</div>${cards}</div>`
    + `<div class="lyr" data-l="query"><div class="qhead">the query of ${esc(E.id)}</div><div class="qtext"><b>${esc(title)}</b>\n\n${esc(body)}</div></div>`,
    `<div class="facts"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  return {
    short: "Issue as it was", title: "The issue as it was when the fix PR was opened", sig: "collect/issues.py . body_at", bar: "the issue as it was",
    code: ["cmeval.collect.issues.body_at", "cmeval.collect.issues.title_at", "cmeval.collect.issues.build_query", "cmeval.collect.issues.leak", "cmeval.collect.issues.fetch_issues"],
    steps, html,
    mount(el) { root = el; },
    show(i) {
      if (!root) return;
      run?.progress(1).kill();
      run = gsap.timeline();
      nvNow(root, steps[i]!);
      nvLayer(root, i === 0 ? "time" : i <= 2 ? "versions" : i <= 4 ? "query" : "time");
      root.classList.toggle("pick", i >= 2);
      const facts = root.querySelector<HTMLElement>(".facts")!;
      if (i === 0) {
        facts.innerHTML = `<b>events</b> ${events.length}<br><b>fix PR opened</b> ${esc(when(pr.createdAt))}`;
        run.fromTo(root.querySelectorAll(".rw-ev"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.12 });
      } else if (i === 1) {
        facts.innerHTML = `<b>versions</b> ${versions.length}${later ? `<br><b>first edit after the fix PR</b> ${seconds(pr.createdAt, later.at)} s` : ""}`;
        run.fromTo(root.querySelectorAll(".rw-v"), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.12 });
      } else if (i === 2) {
        facts.innerHTML = `<b>body</b> ${versions[used] ? `version ${used + 1} (${esc(when(versions[used]!.at))})` : "the current body"}<br><b>title</b> ${R.titleAt.renamedAfter ? "the title before the rename" : "no rename"}`;
        run.fromTo(root.querySelectorAll(".rw-v.late"), { opacity: 1 }, { opacity: 0.35, duration: 0.4 });
      } else if (i === 3) {
        facts.innerHTML = `<b>query</b> ${nvNum(R.query.length)} characters<br><b>equals the task file</b> yes`;
      } else if (i === 4) {
        facts.innerHTML = `<b>this query</b> ${R.leak ? `<span class="bad">${esc(R.leak)}</span>` : `<span class="ok">passes</span>`}<br><b>today's text</b> ${R.leakNow ? esc(R.leakNow) : "passes too: gh-" + pr.number + " has no #"}`;
      } else {
        facts.innerHTML = `<b>tasks</b> ${nvNum(F.edited.tasks)}<br><b>body edited after</b> ${nvNum(F.edited.body)}<br><b>title edited after</b> ${nvNum(F.edited.title)}`;
      }
    },
    dispose() { run?.kill(); },
  };
}
