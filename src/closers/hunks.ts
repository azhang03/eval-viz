// Look closer: how a hunk finds its real place (patches.align_file_diff, _find_hunk).
// Real data: the first hunk of scikit-learn-10908 and its base file lines (data/fixtures).
// The search order comes from src/lib/hunk.ts, which tests check against the real _find_hunk.
import { gsap } from "gsap";
import { fixture10908 } from "../data/load";
import { esc } from "../lib/esc";
import { searchOrder } from "../lib/hunk";
import { q, type CloserView } from "./types";

const LH = 17;

export function hunksView(): CloserView {
  const H = fixture10908.hunk;
  const body = H.body;
  const want = body.filter((l) => l[0] !== "+").map((l) => l.slice(1));
  const added = body.filter((l) => l[0] === "+").map((l) => l.slice(1));
  const N = want.length, FROM = H.from, TO = FROM + H.lines.length - 1;
  const at = (L: number) => H.lines[L - FROM];
  // the insert point: the added lines follow the base line before them in the hunk
  const insAfter = (() => { let L = H.found - 1; for (const l of body) { if (l[0] === "+") return L; L++; } return L; })();
  const EDIT = 2; // the last step pretends the docstring line differs, so no position matches
  const ALT = '        """Return a list of feature names."""';
  const wantAt = (j: number, broken: boolean) => (broken && j === EDIT ? ALT : want[j]!);
  const rowMatch = (start: number, j: number, broken: boolean) => at(start + j) === wantAt(j, broken);
  // the real search order, up to the exact match (1-based lines)
  const order: number[] = [];
  for (const s of searchOrder(H.fileLines, N, H.stated - 1, 0)) {
    order.push(s + 1);
    if (s + 1 === H.found) break;
  }
  const iFound = order.length - 1;
  const orderAt = (k: number) => order[k] ?? H.stated;

  const html = `<div class="box-in hk">
    <div class="panes">
      <div class="code"><div class="fname">${esc(H.path)} . base commit . ${H.fileLines} lines</div>
        <div class="view"><div class="inner"></div></div>
        <div class="mini"><i class="m-view"></i><i class="m-st"></i><i class="m-win"></i></div>
      </div>
      <div class="side">
        <h5>The hunk (scikit-learn-10908)</h5>
        <div class="hunk"></div>
        <div class="legend2">Blue lines must be in the base file. Marks show the comparison at the window.</div>
        <div class="read"><div><b>stated</b><span>${H.stated}</span></div><div><b>trying</b><span class="r-try">-</span></div><div><b>distance</b><span class="r-d">-</span></div><div><b>equal</b><span class="r-eq">-</span></div></div>
        <div class="why">Without the search, the stated lines would point at the <code>inverse_transform</code> docstring, and the wrong function would be gold.</div>
        <div class="err"><b>LabelError, row skipped</b><br><code>${esc(H.path)}: hunk at base line ${H.stated} matches nowhere in the base file (first expected line ${esc(JSON.stringify(want[0] ?? "").replace(/"/g, "'"))})</code></div>
        <h5 style="margin-top:12px">Tried, in order</h5>
        <div class="ticker"></div>
      </div>
    </div>
  </div>`;

  let root!: HTMLElement, inner!: HTMLElement, view!: HTMLElement, ticker!: HTMLElement, win!: HTMLElement, ghost!: HTMLElement, goldb!: HTMLElement, mini!: HTMLElement;
  const rows = new Map<number, HTMLElement>();
  const addRows: HTMLElement[] = [];
  let hunkRows: HTMLElement[] = [];
  let lastI = -1;
  let run: gsap.core.Timeline | null = null;
  const rowTop = (L: number, applied = false) => (L - FROM + (applied && L > insAfter ? added.length : 0)) * LH;
  const read = (cls: string, text: string | number) => { q(root, cls).textContent = String(text); };
  const miniAt = (cls: string, L: number, L2?: number) => {
    const m = q(mini, cls), h = mini.clientHeight;
    m.style.top = `${(L / H.fileLines) * h}px`;
    if (L2) m.style.height = `${Math.max(4, ((L2 - L) / H.fileLines) * h)}px`;
  };

  function mount(el: HTMLElement) {
    root = el; inner = q(el, ".inner"); view = q(el, ".view"); ticker = q(el, ".ticker"); mini = q(el, ".mini");
    for (let L = FROM; L <= TO; L++) {
      const d = document.createElement("div");
      d.className = "r";
      d.innerHTML = `<span class="no">${L}</span><span class="tx">${esc(at(L) ?? "") || " "}</span>`;
      inner.appendChild(d);
      rows.set(L, d);
    }
    added.forEach((tx) => { const d = document.createElement("div"); d.className = "r add"; d.innerHTML = `<span class="no">+</span><span class="tx">${esc(tx)}</span>`; inner.appendChild(d); addRows.push(d); });
    win = document.createElement("div"); win.className = "win"; win.innerHTML = `<span class="tag2"></span>`; inner.appendChild(win);
    ghost = document.createElement("div"); ghost.className = "ghost2"; ghost.innerHTML = `<span>stated place: inside inverse_transform</span>`; inner.appendChild(ghost);
    goldb = document.createElement("div"); goldb.className = "goldb"; goldb.innerHTML = `<span>def get_feature_names . gold</span>`; inner.appendChild(goldb);
    const hk = q(el, ".hunk");
    hk.innerHTML = `<div class="hl h">${esc(H.header)}</div>` + body.map((l) => `<div class="hl ${l[0] !== "+" ? "w" : "p"}"><span class="mk"></span><span class="tx">${esc(l) || " "}</span></div>`).join("");
    hunkRows = [...hk.querySelectorAll<HTMLElement>(".hl.w")];
    win.style.height = `${N * LH}px`;
    ghost.style.top = `${rowTop(H.stated) - 3}px`;
    ghost.style.height = `${N * LH + 6}px`;
    requestAnimationFrame(() => { miniAt(".m-st", H.stated); miniAt(".m-view", FROM, TO); });
  }

  const scrollTo = (L: number, instant = false) => {
    const y = view.clientHeight / 2 - (L - FROM + N / 2) * LH;
    gsap.to(inner, { y: Math.min(0, y), duration: instant ? 0 : 0.5, ease: "power2.inOut" });
  };
  function marks(start: number | null, broken: boolean) {
    let eq = 0;
    hunkRows.forEach((row, j) => {
      const ok = start !== null && rowMatch(start, j, broken);
      if (ok) eq++;
      const hm = q(row, ".mk");
      hm.textContent = start === null ? "" : ok ? "✓" : "✗";
      hm.style.color = ok ? "#2f8f5a" : "#c8432f";
      row.classList.toggle("alt", broken && j === EDIT);
      q(row, ".tx").textContent = ` ${wantAt(j, broken)}`;
    });
    return eq;
  }
  function setWin(start: number | null, broken = false) {
    if (start === null) {
      win.style.opacity = "0";
      read(".r-try", "-"); read(".r-d", "-"); read(".r-eq", "-");
      marks(null, broken);
      return;
    }
    win.style.opacity = "1";
    win.style.top = `${rowTop(start)}px`;
    const eq = marks(start, broken);
    win.classList.toggle("hit", eq === N);
    q(win, ".tag2").textContent = eq === N ? `exact match at ${start}` : `${eq} of ${N} equal`;
    read(".r-try", start); read(".r-d", Math.abs(start - H.stated)); read(".r-eq", `${eq}/${N}`);
    miniAt(".m-win", start);
  }
  function tick(count: number, broken = false) {
    ticker.innerHTML = order.slice(0, count).map((line) => {
      let eq = 0;
      for (let j = 0; j < N; j++) if (line >= FROM && line + j <= TO && rowMatch(line, j, broken)) eq++;
      return `<i class="${line === H.stated ? "st" : eq === N ? "ok" : eq >= 1 ? "near" : ""}">${line}</i>`;
    }).join("");
  }
  function applied(on: boolean) {
    for (let L = FROM; L <= TO; L++) rows.get(L)!.style.top = `${rowTop(L, on)}px`;
    addRows.forEach((d, j) => { d.style.top = `${(insAfter - FROM + 1 + j) * LH}px`; d.classList.toggle("on", on); });
    goldb.style.top = `${rowTop(H.found + 1, on) - 3}px`;
    goldb.style.height = `${(6 + (on ? added.length : 0)) * LH + 6}px`;
    goldb.style.opacity = on ? "1" : "0";
    ghost.style.opacity = on ? "1" : "0";
    q(root, ".why").classList.toggle("on", on);
  }
  // the final picture of step i
  function still(i: number) {
    applied(i === 4);
    q(root, ".err").classList.toggle("on", i === 5);
    win.style.transition = "none";
    if (i === 0) { setWin(null); tick(0); scrollTo(H.stated, true); }
    if (i === 1) { setWin(H.stated); tick(1); scrollTo(H.stated, true); }
    if (i === 2) { const line = orderAt(iFound - 2); setWin(line); tick(iFound - 1); scrollTo(line, true); }
    if (i === 3 || i === 4) { setWin(H.found); tick(iFound + 1); scrollTo(H.found, true); }
    if (i === 4) win.style.opacity = "0";
    if (i === 5) {
      setWin(H.found, true); tick(iFound + 1, true); scrollTo(H.found, true);
      read(".r-try", "all"); read(".r-d", "-"); read(".r-eq", `<${N}`);
      q(win, ".tag2").textContent = "no exact match";
    }
    requestAnimationFrame(() => { win.style.transition = ""; });
  }

  function show(i: number) {
    const forward = i === lastI + 1;
    lastI = i;
    if (run) { run.progress(1).kill(); run = null; }
    if (!forward || i === 0) { still(i); return; }
    const tl = (run = gsap.timeline());
    if (i === 1) {
      still(0);
      tl.add(() => { setWin(H.stated); tick(1); })
        .fromTo(win, { scale: 1.15, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" })
        .fromTo(hunkRows.map((r) => q(r, ".mk")), { scale: 0 }, { scale: 1, duration: 0.2, stagger: 0.12, ease: "back.out(3)" }, "<0.1");
    } else if (i === 2) {
      still(1);
      // slow at first, then faster
      for (let k = 1; k < iFound - 1; k++) {
        const line = orderAt(k), d = k < 5 ? 0.55 : k < 11 ? 0.22 : 0.09;
        tl.add(() => { setWin(line); tick(k + 1); scrollTo(line); }).to({}, { duration: d });
      }
    } else if (i === 3) {
      still(2);
      [iFound - 1, iFound].forEach((k, j) => tl.add(() => { setWin(orderAt(k)); tick(k + 1); scrollTo(orderAt(k)); }).to({}, { duration: j ? 0.1 : 0.7 }));
      tl.fromTo(win, { boxShadow: "0 0 0 0 rgba(47,143,90,.5)" }, { boxShadow: "0 0 0 16px rgba(47,143,90,0)", duration: 0.7, repeat: 1 });
    } else if (i === 4) {
      still(3);
      // first the stated place (wrong), then the real one
      tl.to(win, { opacity: 0, duration: 0.3 })
        .add(() => { scrollTo(H.stated); ghost.style.opacity = "1"; q(root, ".why").classList.add("on"); }).to({}, { duration: 1.6 })
        .add(() => { scrollTo(H.found); applied(true); })
        .fromTo(addRows, { x: -14 }, { x: 0, duration: 0.35, stagger: 0.1, ease: "back.out(2)" }, "+=0.45");
    } else if (i === 5) {
      still(3);
      tl.add(() => { marks(H.found, true); }).to({}, { duration: 0.9 });
      // the window sweeps this part of the file; the minimap marker sweeps the whole file
      for (let L = FROM; L <= TO - N + 1; L += 2) tl.add(() => { setWin(L, true); scrollTo(L); }).to({}, { duration: 0.05 });
      const m = { L: TO };
      tl.to(m, { L: H.fileLines, duration: 0.7, ease: "none", onUpdate: () => miniAt(".m-win", m.L) }).add(() => still(5));
    }
  }

  return {
    short: "Hunk alignment", title: "How a hunk finds its real place", sig: "patches.align_file_diff . _find_hunk", bar: "hunk alignment",
    code: ["cmeval.patches.align_file_diff", "cmeval.patches._find_hunk"],
    steps: [
      { t: "The hunk", d: `The fix diff says: at base line <b>${H.stated}</b>, these ${N} lines are in the file (context lines, plus removed lines if any). The ${added.length} green lines are added. Only the ${N} base lines are compared.` },
      { t: "Try the stated line", d: `<code>align_file_diff</code> works like <code>git apply</code> with no fuzz: every line must be equal. At line ${H.stated} the file has the <code>inverse_transform</code> docstring, so the lines do not match.` },
      { t: "Search outward", d: "<code>_find_hunk</code> tries the nearest positions first: 1 line up, 1 down, 2 up, 2 down, and so on. Blank lines give near misses (1 or 2 of 6), but a near miss is still a miss." },
      { t: "Exact match", d: `At distance ${H.found - H.stated} the window fits at line <b>${H.found}</b>: all ${N} lines are equal. The offset is +${H.found - H.stated}. The patch was written against a slightly different version of this file.` },
      { t: "Apply at the real place", d: `The ${added.length} added lines go after base line ${insAfter}, inside <code>get_feature_names</code>. That is the gold function (${H.found + 1} to ${H.found + 6}). The task records <code>hunks_moved: 1</code>.` },
      { t: "No match anywhere", d: "If no position matches all lines, the diff does not belong to this base. <code>PatchMismatch</code> stops the labeler, and the importer skips the row with the reason. Later hunks search only below the one before." },
    ],
    html, mount, show,
    dispose() { run?.kill(); gsap.killTweensOf(inner); },
  };
}
