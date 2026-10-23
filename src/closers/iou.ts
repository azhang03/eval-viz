// Look closer: when a hit finds a gold function (Decision 2, metrics/matching.py).
// The quality-control station: parts drop onto the tape over the gold slot. The rule comes
// from src/lib/matching.ts, which tests check against the real hit_matches and line_iou.
import { gsap } from "gsap";
import { hitMatches, lineIou, sharedLines } from "../lib/matching";
import { q, svg, type CloserView } from "./types";

const PATH = "sklearn/feature_extraction/text.py";
const FN = [994, 999] as const, CLS = [559, 999] as const;
type Range = readonly [number, number];
type Scene = { dom: Range; hit?: Range; n?: string; cls?: boolean; file?: boolean; rank?: boolean };
const SC: Scene[] = [
  { dom: [980, 1010] },
  { dom: [980, 1010], hit: [995, 997], n: "A" },
  { dom: [980, 1010], hit: [992, 999], n: "B" },
  { dom: [970, 1010], hit: [985, 999], n: "C" },
  { dom: [540, 1020], hit: [559, 999], n: "D", cls: true },
  { dom: [980, 1010], file: true, n: "E" },
  { dom: [975, 1005], rank: true },
];
type Ranked = { n: string; r: Range; what: string; other?: boolean };
const RANKED: Ranked[] = [{ n: "D", r: [559, 999], what: "whole class" }, { n: "C", r: [985, 999], what: "" }, { n: "B", r: [992, 999], what: "" }, { n: "A", r: [995, 997], what: "" }, { n: "F", r: [12, 40], what: "other file", other: true }];

const iou = (h: Range, g: Range) => lineIou(h[0], h[1], g[0], g[1]);
const inside = (h: Range, g: Range) => h[0] >= g[0] && h[1] <= g[1];
const matches = (h: Range, g: Range, thr: number, path = PATH) => hitMatches({ path, start_line: h[0], end_line: h[1] }, { path: PATH, start: g[0], end: g[1] }, thr);
const TX0 = 50, TX1 = 670, TY = 270;

export function iouView(): CloserView {
  const html = `<div class="box-in qc2">
    <div class="panes">
      <div class="stagebox"><svg viewBox="0 0 720 420" preserveAspectRatio="xMidYMid meet"></svg><div class="stamp"></div></div>
      <div class="side">
        <div class="planned">Decision 2 . metrics/matching.py (F3 B2)</div>
        <svg class="gauge" viewBox="0 0 260 150" width="100%" style="max-height:150px"></svg>
        <div class="form"></div>
        <h5 class="lvh">Result at each level</h5>
        <div class="levels"><div class="lv" data-l="file"><small>file</small><span></span></div><div class="lv" data-l="class"><small>class</small><span></span></div><div class="lv" data-l="function"><small>function</small><span></span></div></div>
        <div class="rank"><h5>Ranked hits (function level)</h5>
          <div class="thr">IoU threshold <button class="btn" data-t="0.3">0.3</button><button class="btn on" data-t="0.5">0.5</button><button class="btn" data-t="0.7">0.7</button></div>
          <table></table><div class="mrr"></div></div>
      </div>
    </div>
  </div>`;
  let root!: HTMLElement;
  let ticks!: SVGGElement, rows!: SVGGElement, crate!: SVGGElement;
  let clsBr!: SVGPathElement, clsT!: SVGTextElement, slot!: SVGRectElement, over!: SVGRectElement, slotT!: SVGTextElement, part!: SVGRectElement, partT!: SVGTextElement;
  let red!: SVGPathElement, green!: SVGPathElement, needle!: SVGPathElement, gnum!: SVGTextElement;
  let dom: [number, number] = [980, 1010];
  let run: gsap.core.Timeline | null = null;
  let thr = 0.5;
  const sx = (v: number) => TX0 + ((v - dom[0]) / (dom[1] - dom[0])) * (TX1 - TX0);
  const GC = [130, 128] as const, GR = 100;
  const arc = (a0: number, a1: number, r: number) => {
    const p = (a: number) => [GC[0] + r * Math.cos(Math.PI * (1 - a)), GC[1] - r * Math.sin(Math.PI * (1 - a))] as const;
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const setThr = (t: number) => { red.setAttribute("d", arc(0, t, GR)); green.setAttribute("d", arc(t, 1, GR)); };
  const mono = (a: Record<string, string | number>) => ({ "font-family": "IBM Plex Mono", ...a });

  function mount(el: HTMLElement) {
    root = el;
    const s = q<SVGSVGElement>(el, ".stagebox svg");
    svg("rect", { x: TX0 - 16, y: TY, width: TX1 - TX0 + 32, height: 60, rx: 12, fill: "#e9b440", stroke: "#2b2622", "stroke-width": 2 }, s);
    ticks = svg("g", {}, s);
    clsBr = svg("path", { fill: "none", stroke: "#c9962b", "stroke-width": 2.5, opacity: 0 }, s);
    clsT = svg("text", mono({ y: TY + 96, "font-size": 12, fill: "#8a5a14", opacity: 0 }), s);
    clsT.textContent = `gold class: CountVectorizer ${CLS[0]}-${CLS[1]}`;
    slot = svg("rect", { y: TY - 2, height: 20, rx: 3, fill: "#2b2622" }, s);
    over = svg("rect", { y: TY - 2, height: 20, fill: "#ffd35a", opacity: 0 }, s);
    slotT = svg("text", mono({ y: TY - 10, "font-size": 12, fill: "#8a7f72" }), s);
    slotT.textContent = `gold function ${FN[0]}-${FN[1]}`;
    part = svg("rect", { y: -80, height: 44, rx: 9, fill: "#2f8f8a", stroke: "#2b2622", "stroke-width": 2, opacity: 0 }, s);
    partT = svg("text", mono({ y: -90, "font-size": 13, fill: "#2b2622", opacity: 0 }), s);
    crate = svg("g", { opacity: 0 }, s);
    svg("rect", { x: 210, y: 90, width: 300, height: 90, rx: 12, fill: "#5b6fb5", stroke: "#2b2622", "stroke-width": 2 }, crate);
    svg("text", mono({ x: 360, y: 130, "text-anchor": "middle", "font-size": 13, fill: "#fff" }), crate).textContent = PATH;
    svg("text", mono({ x: 360, y: 154, "text-anchor": "middle", "font-size": 12, fill: "#dfe5ff" }), crate).textContent = "no line numbers (grep)";
    rows = svg("g", {}, s);
    const gauge = q<SVGSVGElement>(el, ".gauge");
    red = svg("path", { stroke: "#c8432f", "stroke-width": 16, fill: "none", opacity: 0.85 }, gauge);
    green = svg("path", { stroke: "#2f8f5a", "stroke-width": 16, fill: "none", opacity: 0.85 }, gauge);
    setThr(0.5);
    [0, 0.5, 1].forEach((a) => {
      const x = GC[0] + (GR - 24) * Math.cos(Math.PI * (1 - a)), y = GC[1] - (GR - 24) * Math.sin(Math.PI * (1 - a));
      svg("text", mono({ x, y: y + 4, "text-anchor": "middle", "font-size": 11, fill: "#8a7f72" }), gauge).textContent = String(a);
    });
    needle = svg("path", { d: `M${GC[0]} ${GC[1]} L${GC[0] - GR + 8} ${GC[1]}`, stroke: "#2b2622", "stroke-width": 4, "stroke-linecap": "round" }, gauge);
    svg("circle", { cx: GC[0], cy: GC[1], r: 8, fill: "#2b2622" }, gauge);
    gnum = svg("text", { x: GC[0], y: GC[1] - 26, "text-anchor": "middle", "font-family": "Archivo Black", "font-size": 18, fill: "#2b2622" }, gauge);
    gsap.set(needle, { svgOrigin: `${GC[0]} ${GC[1]}`, rotation: 0 });
    el.querySelectorAll<HTMLButtonElement>(".thr button").forEach((b) => (b.onclick = () => {
      thr = Number(b.dataset.t);
      el.querySelectorAll(".thr button").forEach((x) => x.classList.toggle("on", x === b));
      setThr(thr);
      ranking(true);
    }));
  }

  function drawTicks() {
    ticks.innerHTML = "";
    const span = dom[1] - dom[0], step = span > 200 ? 10 : 1, lab = span > 200 ? 100 : 5;
    for (let v = Math.ceil(dom[0] / step) * step; v <= dom[1]; v += step) {
      const big = v % lab === 0;
      svg("path", { d: `M${sx(v)} ${TY + 60} v${big ? -18 : -8}`, stroke: "#2b2622", "stroke-width": big ? 1.6 : 1 }, ticks);
      if (big) svg("text", mono({ x: sx(v), y: TY + 36, "text-anchor": "middle", "font-size": 12, fill: "#2b2622" }), ticks).textContent = String(v);
    }
  }
  function lay(sc: Scene) {
    drawTicks();
    slot.setAttribute("x", String(sx(FN[0])));
    slot.setAttribute("width", String(sx(FN[1] + 1) - sx(FN[0])));
    slotT.setAttribute("x", String(Math.min(sx(FN[0]) - 40, TX1 - 150)));
    const c0 = Math.max(sx(CLS[0]), TX0 - 10);
    clsBr.setAttribute("d", `M${c0} ${TY + 68} v12 H${sx(CLS[1] + 1)} v-12`);
    clsT.setAttribute("x", String(c0));
    if (sc.hit) {
      part.setAttribute("x", String(sx(sc.hit[0])));
      part.setAttribute("width", String(Math.max(5, sx(sc.hit[1] + 1) - sx(sc.hit[0]))));
      partT.setAttribute("x", String(Math.max(TX0, sx(sc.hit[0]))));
      const a = Math.max(sc.hit[0], FN[0]), b = Math.min(sc.hit[1], FN[1]);
      over.setAttribute("x", String(sx(a)));
      over.setAttribute("width", String(Math.max(0, sx(b + 1) - sx(a))));
    }
  }
  type Verdict = { file: boolean; class: boolean | null; function: boolean | null } | null;
  function verdicts(sc: Scene): Verdict {
    if (sc.file) return { file: true, class: null, function: null };
    if (!sc.hit) return null;
    return { file: true, class: matches(sc.hit, CLS, 0.5), function: matches(sc.hit, FN, 0.5) };
  }
  function side(sc: Scene) {
    const form = q(root, ".form");
    if (sc.rank) form.innerHTML = "Each gold function counts once, at the rank of the first hit that matches it.";
    else if (sc.file) form.innerHTML = `hit: <b>${PATH}</b><br>no start or end line<br>graded at file level only`;
    else if (!sc.hit) form.innerHTML = `gold: <b>${FN[0]}-${FN[1]}</b> (6 lines)<br>rule (a): hit inside gold<br>rule (b): IoU = shared / either &ge; 0.5`;
    else {
      const sh = sharedLines(sc.hit[0], sc.hit[1], FN[0], FN[1]), u = Math.round(sh / iou(sc.hit, FN));
      form.innerHTML = `hit ${sc.n}: <b>${sc.hit[0]}-${sc.hit[1]}</b><br>inside gold? <b>${inside(sc.hit, FN) ? "yes" : "no"}</b><br>IoU = ${sh} / ${u} = <b>${iou(sc.hit, FN).toFixed(2)}</b>${sc.cls ? `<br>class level: IoU with ${CLS[0]}-${CLS[1]} = <b>${iou(sc.hit, CLS).toFixed(2)}</b>` : ""}`;
    }
    const v = verdicts(sc);
    root.querySelectorAll<HTMLElement>(".lv").forEach((el) => {
      const x = v ? v[el.dataset.l as "file" | "class" | "function"] : undefined;
      el.className = `lv${x === true ? " ok" : x === false ? " no" : x === null ? " na" : ""}`;
      q(el, "span").textContent = x === true ? "✓ match" : x === false ? "✗ no" : x === null ? "n/a" : "-";
    });
  }
  type Row = Ranked & { k: number; v: number; ok: boolean };
  let rankRows: Row[] = [];
  function drawRankBars(animate: boolean) {
    rows.innerHTML = "";
    rankRows.forEach((r, j) => {
      const y = 30 + j * 44, x0 = r.other ? TX0 : Math.max(TX0 - 10, sx(r.r[0])), x1 = r.other ? TX0 + 40 : sx(r.r[1] + 1), w = Math.max(5, x1 - x0);
      const bar = svg("rect", { x: x0, y, width: w, height: 30, rx: 7, fill: r.other ? "#8a7f72" : r.ok ? "#2f8f5a" : "#c8432f", opacity: 0.85 }, rows);
      const inBar = w > 120;
      const t = svg("text", mono({ x: inBar ? x0 + 8 : x1 + 8, y: y + 20, "font-size": 12, fill: inBar ? "#fff" : "#2b2622" }), rows);
      t.textContent = `#${r.k} ${r.n}${r.other ? " . other file" : sx(r.r[0]) < TX0 ? ` ◀ from ${r.r[0]}` : ""}`;
      if (animate) gsap.from([bar, t], { opacity: 0, x: -20, duration: 0.3, delay: j * 0.08 });
    });
  }
  function ranking(animate: boolean) {
    const list: Row[] = RANKED.map((h, k) => ({ ...h, k: k + 1, v: h.other ? 0 : iou(h.r, FN), ok: matches(h.r, FN, thr, h.other ? "sklearn/other.py" : PATH) }));
    const first = list.find((r) => r.ok);
    q(root, ".rank table").innerHTML = `<tr><td>rank</td><td>hit</td><td>IoU</td><td>match</td></tr>` + list.map((r) =>
      `<tr class="${r === first ? "first" : r.ok ? "dup" : ""}"><td>${r.k}</td><td>${r.n} ${r.other ? r.what : r.r.join("-")}${r.what && !r.other ? ` (${r.what})` : ""}</td><td>${r.other ? "-" : r.v.toFixed(2)}</td><td>${r.ok ? (r === first ? "✓ counts" : "✓ already found") : "✗"}</td></tr>`).join("");
    q(root, ".mrr").textContent = first ? `first match at rank ${first.k} . MRR = 1/${first.k} = ${(1 / first.k).toFixed(2)}` : "no match . MRR = 0";
    rankRows = list;
    drawRankBars(animate);
  }
  function needleTo(sc: Scene, tl: gsap.core.Timeline, at: number) {
    const hit = sc.hit;
    const v = hit ? (inside(hit, FN) ? 1 : iou(hit, FN)) : 0, o = { v: 0 };
    tl.to(needle, { rotation: v * 180, duration: 0.9, ease: "elastic.out(1, 0.45)" }, at)
      .to(o, { v: hit ? iou(hit, FN) : 0, duration: 0.6, onUpdate: () => { gnum.textContent = !hit ? (sc.file ? "n/a" : "IoU") : inside(hit, FN) ? "inside" : o.v.toFixed(2); } }, at);
  }
  function stamp(sc: Scene, tl: gsap.core.Timeline, at: number) {
    const st = q(root, ".stamp"), v = verdicts(sc);
    if (!v || sc.rank) { tl.set(st, { opacity: 0 }, 0); return; }
    const ok = sc.file ? true : v.function;
    tl.add(() => { st.textContent = sc.file ? "FILE ONLY" : ok ? "PASS" : "REJECT"; st.style.color = sc.file ? "#5b6fb5" : ok ? "#2f8f5a" : "#c8432f"; }, at)
      .fromTo(st, { opacity: 0, scale: 2.2, rotation: -22 }, { opacity: 0.9, scale: 1, rotation: -10, duration: 0.28, ease: "power4.in" }, at);
  }

  function show(i: number) {
    if (run) { run.progress(1).kill(); run = null; }
    const sc = SC[i] ?? SC[0]!;
    const tl = (run = gsap.timeline());
    root.classList.toggle("ranked", !!sc.rank);
    tl.set(q(root, ".stamp"), { opacity: 0 }, 0);
    const z = { a: dom[0], b: dom[1] };
    tl.to(z, { a: sc.dom[0], b: sc.dom[1], duration: 0.8, ease: "power3.inOut", onUpdate: () => { dom = [z.a, z.b]; lay(sc); if (sc.rank) drawRankBars(false); } }, 0);
    tl.to([slot, slotT, ticks], { opacity: 1, duration: 0.3 }, 0);
    if (!sc.rank) tl.to(rows, { opacity: 0, duration: 0.3 }, 0);
    tl.to([clsBr, clsT], { opacity: sc.cls ? 1 : 0, duration: 0.4 }, sc.cls ? 0.9 : 0);
    if (sc.cls) tl.to(slotT, { opacity: 0, duration: 0.2 }, 0.3); // part D covers the slot label
    tl.to(crate, { opacity: 0, duration: 0.2 }, 0);
    tl.set([part, partT, over], { opacity: 0 }, 0);
    side(sc);
    if (sc.rank) {
      setThr(thr);
      ranking(false);
      tl.fromTo(rows, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5).to([slot, slotT], { opacity: 0.25, duration: 0.3 }, 0);
      needleTo({ dom: sc.dom }, tl, 0);
      return;
    }
    if (sc.hit) {
      partT.textContent = `part ${sc.n}: ${sc.hit[0]}-${sc.hit[1]}`;
      tl.fromTo(part, { opacity: 1, attr: { y: -60 } }, { attr: { y: TY - 48 }, duration: 0.7, ease: "bounce.out" }, 0.7)
        .fromTo(partT, { opacity: 0 }, { opacity: 1, attr: { y: TY - 56 }, duration: 0.3 }, 1.2)
        .fromTo(over, { opacity: 0 }, { opacity: 1, duration: 0.2, repeat: 3, yoyo: true }, 1.4)
        .set(over, { opacity: 1 }, 2.2);
    }
    if (sc.file) tl.fromTo(crate, { opacity: 1, y: -160 }, { y: 0, duration: 0.7, ease: "bounce.out" }, 0.3).to([slot, slotT], { opacity: 0.25, duration: 0.3 }, 0.3);
    setThr(0.5);
    needleTo(sc, tl, 1.4);
    stamp(sc, tl, 2.2);
  }

  return {
    short: "Match rule", title: "When a hit finds a gold function", sig: "Decision 2 . metrics.matching.hit_matches", bar: "the match rule",
    code: ["cmeval.metrics.matching.hit_matches", "cmeval.metrics.matching.line_iou"],
    steps: [
      { t: "The gold slot", d: "Gold for scikit-learn-10908 at function level: <code>get_feature_names</code>, lines 994 to 999. A search hit is a part with a path and a line range. Does it fit the slot?" },
      { t: "Inside the slot", d: "Part A covers 995 to 997. It is inside the gold range, so it matches by rule (a). IoU is not needed. Small hits that point into the right function get credit." },
      { t: "IoU 0.5 or more", d: "Part B starts 2 lines early. Shared: 6 lines. Either: 8. IoU = 6 / 8 = 0.75. That is 0.5 or more, so it matches by rule (b). Small boundary differences are fine." },
      { t: "Below 0.5", d: "Part C also takes the end of the function above. Shared: 6. Either: 15. IoU = 0.40. No match. The agent would still have to search inside it." },
      { t: "Big hits", d: "Part D is the whole class, 559 to 999. IoU = 0.01: no match at function level. At class level the gold is <code>CountVectorizer</code>, and D matches there. Big hits get credit only at the level they really point to." },
      { t: "No line numbers", d: "Plain grep returns files, not lines. Its hits are graded at file level only. Class and function level show n/a, never 0 (Decision 4)." },
      { t: "Ranked hits", d: "A system returns a ranked list. Each gold function counts once, at the rank of the first hit that matches it. Change the IoU threshold: the report also shows 0.3 and 0.7 as a check." },
    ],
    html, mount, show,
    dispose() { run?.kill(); },
  };
}
