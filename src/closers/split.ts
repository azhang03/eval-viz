// Look closer: dev or test, from a hash (tasks.assign_split). The page runs the same SHA-256
// and the same rule (src/lib/split.ts, checked against the real function).
import { gsap } from "gsap";
import { esc } from "../lib/esc";
import { DEV_PERCENT, SPLIT_SEED, splitOf } from "../lib/split";
import { q, svg, type CloserView } from "./types";

const EX = ["pandas-dev__pandas-60123", "django__django-19001", "pytorch__pytorch-150321", "vercel__next.js-80412", "rust-lang__rust-140000"];
const RC = [560, 225] as const, RR = 120;
const cellAng = (b: number) => -Math.PI / 2 + ((b + 0.5) / 100) * Math.PI * 2;
const DEV = "#2f8f8a", TEST = "#5b6fb5";

type Anim = { hash?: boolean; num?: boolean; ball?: boolean };

const SAMPLE = 5000;
let sampleShare: number | null = null; // share of dev over SAMPLE IDs; the same every time, so computed once
function devShare(): number {
  if (sampleShare === null) {
    let dev = 0;
    for (let k = 0; k < SAMPLE; k++) if (splitOf(`fresh__repo-${k}`).split === "dev") dev++;
    sampleShare = dev / SAMPLE;
  }
  return sampleShare;
}

export function splitView(): CloserView {
  const html = `<div class="box-in sp">
    <div class="panes">
      <div class="mach"><svg viewBox="0 0 720 420" preserveAspectRatio="xMidYMid meet"></svg></div>
      <div class="side">
        <div class="facts"></div>
        <div class="blk" data-b="4"><h5>Try your own</h5><div class="try"><input type="text" spellcheck="false" value="${EX[0]}"></div><div class="ex">${EX.map((e) => `<span class="chip" data-ex="${e}">${e}</span>`).join("")}</div></div>
        <div class="blk" data-b="5"><h5>Task pool</h5><button class="btn addt">Add 20 tasks</button><div class="pool"></div><div class="share"></div><div class="share big"></div></div>
      </div>
    </div>
  </div>`;
  let root!: HTMLElement;
  let hasher!: SVGGElement, dig!: SVGGElement, num!: SVGGElement, ring!: SVGGElement, gear!: SVGGElement, ball!: SVGCircleElement;
  let cardT!: SVGTextElement, hexA!: SVGTextElement, hexB!: SVGTextElement, bigT!: SVGTextElement, bucketT!: SVGTextElement, splitT!: SVGTextElement;
  let id = EX[0]!;
  let lastI = -1;
  let run: gsap.core.Timeline | null = null;
  const pool: string[] = [];
  let poolN = 0;
  const text = (p: Element, x: number, y: number, s: string | number, a: Record<string, string | number> = {}) => {
    const t = svg("text", { x, y, "font-family": "IBM Plex Mono", "font-size": 12, fill: "#2b2622", ...a }, p);
    t.textContent = String(s);
    return t;
  };

  function mount(el: HTMLElement) {
    root = el;
    const s = q<SVGSVGElement>(el, ".mach svg");
    // card -> hasher -> digest -> number -> ring
    const card = svg("g", {}, s);
    svg("rect", { x: 24, y: 28, width: 320, height: 48, rx: 10, fill: "#fff", stroke: "#2b2622", "stroke-width": 2 }, card);
    cardT = text(card, 40, 58, id, { "font-size": 13 });
    text(s, 24, 20, "task ID", { fill: "#8a7f72", "font-size": 11 });
    hasher = svg("g", {}, s);
    svg("rect", { x: 24, y: 104, width: 320, height: 56, rx: 12, fill: "#2b2622" }, hasher);
    text(hasher, 40, 128, "sha256(", { fill: "#e9b440", "font-size": 13 });
    text(hasher, 40, 147, `"${SPLIT_SEED}:" + id)`, { fill: "#fffaf2", "font-size": 12 });
    gear = svg("g", {}, hasher);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; svg("rect", { x: 312 + Math.cos(a) * 13 - 4, y: 132 + Math.sin(a) * 13 - 4, width: 8, height: 8, fill: "#e9b440" }, gear); }
    svg("circle", { cx: 312, cy: 132, r: 11, fill: "#e9b440" }, gear);
    dig = svg("g", {}, s);
    text(dig, 24, 188, "digest (hex)", { fill: "#8a7f72", "font-size": 11 });
    hexA = text(dig, 24, 210, "", { "font-size": 12.5 });
    hexB = text(dig, 24, 228, "", { "font-size": 12.5, fill: "#8a7f72" });
    num = svg("g", {}, s);
    text(num, 24, 266, "first 8 bytes as a number", { fill: "#8a7f72", "font-size": 11 });
    bigT = text(num, 24, 288, "", { "font-size": 13 });
    text(num, 24, 322, "mod 100", { fill: "#8a7f72", "font-size": 11 });
    bucketT = text(num, 24, 360, "", { "font-size": 34, "font-family": "Archivo Black" });
    splitT = text(num, 120, 358, "", { "font-size": 18, "font-family": "Archivo Black" });
    // a ring of 100 buckets
    ring = svg("g", {}, s);
    const p = (a: number, r: number) => `${RC[0] + Math.cos(a) * r} ${RC[1] + Math.sin(a) * r}`;
    for (let b = 0; b < 100; b++) {
      const a0 = -Math.PI / 2 + (b / 100) * Math.PI * 2, a1 = -Math.PI / 2 + ((b + 1) / 100) * Math.PI * 2 - 0.012, r0 = RR - 26, r1 = RR;
      svg("path", { d: `M${p(a0, r0)} L${p(a0, r1)} A${r1} ${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r0)} A${r0} ${r0} 0 0 0 ${p(a0, r0)}`, fill: b < DEV_PERCENT ? DEV : TEST, opacity: 0.8 }, ring);
    }
    [0, 20, 50, 80].forEach((b) => { const a = -Math.PI / 2 + (b / 100) * Math.PI * 2; text(ring, RC[0] + Math.cos(a) * (RR + 16), RC[1] + Math.sin(a) * (RR + 16) + 4, b, { "text-anchor": "middle", fill: "#8a7f72", "font-size": 11 }); });
    text(ring, RC[0], RC[1] - 6, `dev 0-${DEV_PERCENT - 1}`, { "text-anchor": "middle", fill: DEV, "font-size": 13, "font-weight": 700 });
    text(ring, RC[0], RC[1] + 14, `test ${DEV_PERCENT}-99`, { "text-anchor": "middle", fill: TEST, "font-size": 13, "font-weight": 700 });
    ball = svg("circle", { r: 11, fill: "#e9b440", stroke: "#2b2622", "stroke-width": 2.5, cx: RC[0], cy: RC[1] - RR - 40 }, s);
    const input = q<HTMLInputElement>(el, "input");
    input.oninput = () => { id = input.value.trim() || " "; compute(true); };
    el.querySelectorAll<HTMLElement>("[data-ex]").forEach((c) => (c.onclick = () => { input.value = c.dataset.ex ?? ""; id = input.value; compute(true); }));
    q(el, ".addt").onclick = () => addTasks(20);
    addTasks(40, false);
    // a large sample shows the long-run share
    q(el, ".share.big").textContent = `over ${SAMPLE.toLocaleString("en-US")} IDs: ${(devShare() * 100).toFixed(1)}% dev`;
  }

  // anim: which parts move this time. true means all of them.
  function compute(anim: Anim | true | null, tl?: gsap.core.Timeline) {
    const A: Anim = anim === true ? { hash: true, num: true, ball: true } : anim ?? {};
    const r = splitOf(id);
    cardT.textContent = id.length > 38 ? `${id.slice(0, 36)}...` : id;
    hexA.innerHTML = `<tspan fill="#c4562f" font-weight="600">${r.first}</tspan>${r.hex.slice(16, 40)}`;
    hexB.textContent = r.hex.slice(40);
    bigT.textContent = r.big.toString();
    bucketT.textContent = String(r.bucket);
    splitT.textContent = r.split;
    splitT.setAttribute("fill", r.split === "dev" ? DEV : TEST);
    splitT.setAttribute("x", String(24 + String(r.bucket).length * 26 + 14));
    const a = cellAng(r.bucket), bx = RC[0] + Math.cos(a) * (RR - 13), by = RC[1] + Math.sin(a) * (RR - 13);
    const t = tl ?? gsap.timeline();
    if (A.hash) t.to(gear, { rotation: "+=360", svgOrigin: "312 132", duration: 0.6, ease: "power2.inOut" }, 0).fromTo([hexA, hexB], { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.3);
    if (A.num) t.fromTo(bigT, { opacity: 0 }, { opacity: 1, duration: 0.3 }, A.hash ? 0.5 : 0.1)
      .fromTo(bucketT, { opacity: 0, scale: 1.5, svgOrigin: "60 350" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, A.hash ? 0.7 : 0.4);
    if (A.ball) {
      // the ball spins around the ring and settles on the bucket
      const o = { a: -Math.PI / 2, r: RR + 34 };
      t.set(ball, { attr: { cx: RC[0], cy: RC[1] - RR - 34 } }, 0.6)
        .to(o, { a: a + Math.PI * 4, r: RR - 13, duration: 1.4, ease: "power3.out", onUpdate: () => { ball.setAttribute("cx", String(RC[0] + Math.cos(o.a) * o.r)); ball.setAttribute("cy", String(RC[1] + Math.sin(o.a) * o.r)); } }, 0.6);
    } else {
      ball.setAttribute("cx", String(bx));
      ball.setAttribute("cy", String(by));
    }
    const color = r.split === "dev" ? DEV : TEST;
    q(root, ".facts").innerHTML = `<div><b>id</b>${esc(id)}</div><div><b>digest</b>${r.first}...</div><div><b>number</b>${r.big}</div><div><b>bucket</b>${r.bucket} &rarr; <span style="color:${color};font-weight:700">${r.split}</span></div>`;
  }

  function addTasks(n: number, animate = true) {
    const pl = q(root, ".pool");
    for (let k = 0; k < n; k++) {
      const tid = `fresh__repo-${1000 + poolN * 37}`;
      poolN++;
      const s = splitOf(tid).split;
      pool.push(s);
      const el = document.createElement("i");
      el.className = s;
      el.textContent = tid.replace("fresh__repo-", "#");
      el.title = tid;
      pl.appendChild(el);
      if (animate) gsap.from(el, { scale: 0, duration: 0.3, delay: k * 0.04, ease: "back.out(3)" });
    }
    const dev = pool.filter((s) => s === "dev").length;
    q(root, ".share").textContent = `${pool.length} tasks . ${dev} dev (${Math.round((dev / pool.length) * 100)}%)`;
  }

  function show(i: number) {
    const forward = i === lastI + 1;
    lastI = i;
    if (run) { run.progress(1).kill(); run = null; }
    root.querySelectorAll<HTMLElement>(".blk").forEach((b) => b.classList.toggle("on", Number(b.dataset.b) === i));
    const tl = (run = gsap.timeline());
    // what is lit in each step; the ball shows only once the ring is explained
    const parts = [hasher, dig, num, ring];
    const vis = ([[ring], [hasher, dig], [hasher, dig, num], parts, parts, parts] as SVGGElement[][])[i] ?? parts;
    parts.forEach((p) => tl.to(p, { opacity: vis.includes(p) ? 1 : 0.12, duration: 0.3 }, 0));
    tl.to(ball, { opacity: i >= 3 ? 1 : 0, duration: 0.25 }, 0);
    // the word dev or test appears once the rule is explained, after the ball lands
    tl.to(splitT, { opacity: i >= 3 ? 1 : 0, duration: 0.3 }, i === 3 && forward ? 2.0 : 0);
    if (i === 4) { compute(true, tl); setTimeout(() => q<HTMLInputElement>(root, "input").focus(), 50); return; }
    const anim: (Anim | null)[] = [null, { hash: true }, { num: true }, { ball: true }, null, null];
    compute(forward ? anim[i] ?? null : null, tl);
  }

  return {
    short: "Split rule", title: "Dev or test, from a hash", sig: `tasks.assign_split . seed ${SPLIT_SEED}`, bar: "the split rule",
    code: ["cmeval.tasks.assign_split"],
    steps: [
      { t: "Two splits", d: "Dev tasks are for building and tuning. Test tasks run only at milestones. SWE-bench Verified tasks are all dev. Fresh tasks (F4) get their split from a hash: about 20% dev, 80% test." },
      { t: "Hash the ID", d: `<code>assign_split</code> hashes <code>"${SPLIT_SEED}:" + task ID</code> with SHA-256. The seed is fixed, so the hash never changes.` },
      { t: "A number from 0 to 99", d: "The first 8 bytes of the digest are read as one big number. That number mod 100 is the task's bucket." },
      { t: `Below ${DEV_PERCENT} is dev`, d: `Buckets 0 to ${DEV_PERCENT - 1} are dev. Buckets ${DEV_PERCENT} to 99 are test.` },
      { t: "Try your own", d: "Type any task ID. The page runs the same SHA-256 and the same rule as <code>tasks.assign_split</code>." },
      { t: "Old tasks never move", d: "Each split depends only on the task's own ID. Adding tasks never moves an old task, and over many tasks about 20% land in dev." },
    ],
    html, mount, show,
    dispose() { run?.kill(); },
  };
}
