// Look closer: how grep picks its search words (adapters/keywords.py). The real issue text of
// scikit-learn-10908 is marked by the real keyword rules (scripts/gen_examples.py runs them).
import { gsap } from "gsap";
import { fixtureB5 as EX } from "../data/load";
import { esc } from "../lib/esc";
import { nvNow, nvNum, nvShell } from "./nv";
import type { CloserStep, CloserView } from "./types";

const SRC = { backtick: 1, identifier: 2, word: 3 } as const;

export function keywordsView(): CloserView {
  const K = EX.keywords, raw = EX.task.query, Q = raw.replace(/\r/g, "");
  const kept = K.trace.filter((x) => x.status === "kept");
  const cnt = (s: string) => K.trace.filter((x) => x.status === s).length;
  const firstRaw = K.trace.find((t) => t.status === "kept")?.raw;
  const dropped = K.dropped_by_cleaning;
  const steps: CloserStep[] = [
    { t: "The issue", d: `grep cannot search for a whole issue. It needs a few search words. This is the real issue text of ${esc(EX.task.id)}.${firstRaw ? ` grep takes words as the issue spells them: its first search word will be "${esc(firstRaw)}".` : ""}` },
    { t: "Backtick spans first", d: "Code in backticks is the strongest hint of what to search for. Each span goes into the list first, in order." },
    { t: "Then names that look like code", d: "Next come words that look like code names: with a dot, an underscore, or a capital inside (NotFittedError), or followed by \"(\"." },
    { t: "Then plain words", d: `Last come plain words: 4 or more letters, and not one of the ${K.stop_words} stop words ("the", "should", ...). Grey words are stop words or too short; they never count.` },
    { t: "Clean up", d: `Every candidate is lowercased. A word seen before is a duplicate. The list stops at ${K.max} words. For this issue: ${cnt("kept")} kept, ${cnt("duplicate")} duplicates, ${cnt("over the cap")} after the cap.` },
    { t: "grep-fn-plus cleaning", d: `grep-fn-plus also drops keywords that cannot name code: web addresses, paths, file names, and commit hashes. ${dropped.length ? `This issue has ${dropped.length}, so its list has ${K.cleaned.length} words.` : `This issue has none, so its list is the same ${K.cleaned.length} words.`}` },
  ];
  // the query as spans: each character gets its backtick flag and its token kind (from the real rules)
  const bt = new Array<boolean>(raw.length).fill(false), kind = new Array<string>(raw.length).fill("");
  for (const m of K.marks) for (let c = m.start; c < m.end; c++) { if (m.kind === "backtick") bt[c] = true; else kind[c] = m.kind; }
  let text = "";
  for (let c = 0; c < raw.length;) {
    let e = c + 1;
    while (e < raw.length && bt[e] === bt[c] && kind[e] === kind[c]) e++;
    const part = esc(raw.slice(c, e).replace(/\r/g, ""));
    text += bt[c] || kind[c] ? `<span class="${bt[c] ? "bt " : ""}${kind[c] ? `k-${kind[c]}` : ""}">${part}</span>` : part;
    c = e;
  }
  const html = nvShell("kw",
    `<div class="lyr on" data-l="q"><div class="qhead">issue text . ${esc(EX.task.id)}</div><div class="qtext">${text}</div></div>`,
    `<h5>Search words, in order</h5><div class="chips"></div><div class="facts"></div>`);

  let root: HTMLElement | null = null;
  let run: gsap.core.Timeline | null = null;
  return {
    short: "Search words", title: "How grep picks its search words", sig: "adapters/keywords.py . extract_keywords", bar: "how grep picks its search words",
    code: ["cmeval.adapters.keywords.extract_keywords"],
    steps, html,
    mount(el) { root = el; },
    show(i) {
      if (!root) return;
      run?.progress(1).kill();
      nvNow(root, steps[i]!);
      root.classList.remove("s1", "s2", "s3", "s4");
      if (i >= 1) root.classList.add(`s${Math.min(i, 4)}`);
      const chips = root.querySelector<HTMLElement>(".chips")!, facts = root.querySelector<HTMLElement>(".facts")!;
      const upto = i >= 4 ? 3 : i; // which sources are in the list so far
      const list = kept.filter((x) => SRC[x.source] <= upto);
      chips.innerHTML = list.map((x, j) => `<span class="kc src-${x.source}">${i >= 4 ? `<i>${j + 1}</i>` : ""}${esc(i >= 4 ? x.word : x.raw)}</span>`).join("");
      run = gsap.timeline();
      const fresh = [...chips.children].filter((_, j) => (i < 4 ? SRC[list[j]!.source] === upto : true));
      if (fresh.length) run.fromTo(fresh, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25, stagger: 0.05 });
      if (i === 0) { root.querySelector<HTMLElement>(".qtext")!.scrollTop = 0; facts.innerHTML = `<b>length</b> ${nvNum(Q.length)} characters, ${Q.split("\n").length} lines`; }
      else if (i < 4) facts.innerHTML = `<b>so far</b> ${list.length} words`;
      else if (i === 4) facts.innerHTML = `<b>kept</b> ${cnt("kept")} <b>duplicates</b> ${cnt("duplicate")} <b>after the cap</b> ${cnt("over the cap")}`;
      else facts.innerHTML = `<b>dropped by cleaning</b> ${dropped.length ? dropped.map(esc).join(", ") : "none on this issue"}`;
    },
    dispose() { run?.kill(); },
  };
}
