// SCORE as a quality-control line (V1-02 B5). What travels is one ranked list: the real top 10
// hits that grep-fn-plus returned for scikit-learn-10908, one card for each hit, best first. Every
// number comes from the real metric functions (data/fixtures/b5.json). A caption explains each
// station. Stations follow the step order: match hits, accuracy, tokens, latency, score a run.
import * as THREE from "three";
import { gsap } from "gsap";
import type { Stage } from "../../content/stages";
import { fixtureB5 as EX } from "../data/load";
import { esc } from "../lib/esc";
import { hitsInBudget, runningTotals } from "../lib/budget";
import { nv3 as f3, nvNum as nf } from "../closers/nv";
import { reducedMotion } from "../lib/pace";
import { COLOR, disposeTree, mat, rbox } from "./kit";
import { Caption, arc, hideNote, mini, note, rollers, setNote } from "./lines";
import type { Tag } from "./overlay";
import { stepTag, type View, type ViewCtx } from "./views";

const SYSN = "grep-fn-plus";
const MATCH = COLOR.mustard, MISS = 0xb9b2a6, OFF = 0x6c6f78;

export function scoreView(stage: Stage, ctx: ViewCtx): View {
  const parts = stage.parts ?? [];
  const root = new THREE.Group();
  ctx.scene.add(root);
  const SY = EX.systems[SYSN], G = SY.grade, FN = G.function;
  const GOLDFN = EX.task.gold_fn.symbol, TASK = EX.task.id;
  const SX = [-6.4, -3.2, 0, 3.2, 6.4], TY = 0.36;
  const sx = (k: number) => SX[k] ?? 0;
  const tags: Tag[] = [];
  const belt = rbox(15.4, 0.35, 1.3, COLOR.belt, 0.08); belt.position.y = 0.18; root.add(belt);
  const rolls = rollers(-7.4, 7.4, 0, 0.38, 1.34); root.add(rolls);
  const ringMat = new THREE.MeshBasicMaterial({ color: COLOR.mustard, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 56), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.015, -0.5); root.add(ring);
  const stations = parts.map((_, k) => {
    const g = new THREE.Group(); g.position.x = sx(k); root.add(g);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 3.0), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, 1.4, -0.6); g.add(hit);
    return g;
  });
  const [lensS, boardS, meterS, watchS, packS] = stations as [THREE.Group, THREE.Group, THREE.Group, THREE.Group, THREE.Group];

  // 1. the inspection lens over the belt
  [-0.95, 0.95].forEach((z) => { const p = rbox(0.2, 2.2, 0.2, COLOR.indigo); p.position.set(0, 1.1, z); lensS.add(p); });
  {
    const beam = rbox(0.34, 0.26, 2.2, COLOR.indigo); beam.position.y = 2.2; lensS.add(beam);
    const lens = new THREE.Group(); lens.position.set(0, 1.55, 0); lensS.add(lens);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 12, 36), mat(COLOR.ink)); rim.rotation.x = Math.PI / 2; lens.add(rim);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), new THREE.MeshStandardMaterial({ color: 0x9ff5e6, transparent: true, opacity: 0.45, emissive: 0x2fd6c0, emissiveIntensity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    glass.rotation.x = -Math.PI / 2; lens.add(glass);
    const rod = rbox(0.06, 0.55, 0.06, COLOR.ink, 0.02); rod.position.y = 0.33; lens.add(rod);
  }
  // 2. the scoreboard: one row for each number, a lamp at the left of each row
  const BZ1 = -1.25, ROWS = [2.0, 1.62, 1.24, 0.86];
  {
    const b = rbox(3.0, 1.85, 0.14, COLOR.ink, 0.08); b.position.set(0, 1.42, BZ1); boardS.add(b);
    const leg = rbox(0.14, 0.5, 0.14, COLOR.ink, 0.03); leg.position.set(0, 0.25, BZ1); boardS.add(leg);
  }
  const boardLamps = ROWS.map((y) => { const m = new THREE.MeshStandardMaterial({ color: OFF }); const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), m); l.position.set(-1.25, y, BZ1 + 0.09); boardS.add(l); return m; });
  const boardRows = ROWS.map((y) => { const t = ctx.overlay.addTag("", new THREE.Vector3(sx(1) - 1.05, y, BZ1 + 0.1), "brow off"); tags.push(t); return t; });
  // 3. the token meter: a glass column; each hit the agent reads becomes one segment of the fill
  const MAXT = 4000, MH = 2.2, M0 = 0.35, MZ = -1.2; // 4,000 tokens fill the column
  {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, MH, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe9e3, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(0, M0 + MH / 2, MZ); meterS.add(glass);
    const base = rbox(1.1, 0.3, 1.1, COLOR.ink, 0.06); base.position.set(0, 0.15, MZ); meterS.add(base);
  }
  [1000, 4000].forEach((b) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 8, 36), mat(COLOR.terra)); m.rotation.x = Math.PI / 2; m.position.set(0, M0 + (MH * b) / MAXT, MZ); meterS.add(m);
    tags.push(ctx.overlay.addTag(`budget ${nf(b)}`, new THREE.Vector3(sx(2) + 0.55, M0 + (MH * b) / MAXT, MZ), "rowl"));
  });
  const segs: THREE.Mesh[] = [];
  // 4. the stopwatch
  {
    const post = rbox(0.14, 0.9, 0.14, COLOR.ink, 0.03); post.position.set(0, 0.45, -1.2); watchS.add(post);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 40), mat(COLOR.paper)); face.rotation.x = Math.PI / 2; face.position.set(0, 1.55, -1.2); face.castShadow = true; watchS.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 10, 40), mat(COLOR.indigo)); rim.position.set(0, 1.55, -1.12); watchS.add(rim);
    const knob = rbox(0.2, 0.18, 0.2, COLOR.indigo, 0.04); knob.position.set(0, 2.33, -1.2); watchS.add(knob);
  }
  const hand = new THREE.Group(); hand.position.set(0, 1.55, -1.1); watchS.add(hand);
  { const h = rbox(0.05, 0.55, 0.03, COLOR.terra, 0.01); h.position.y = 0.25; hand.add(h); }
  // 5. packing: the rows of scores.jsonl on a shelf; the graded list goes on the bottom board
  [-1.05, 1.05].forEach((x) => { const p = rbox(0.12, 2.3, 0.75, 0xb98a55, 0.03); p.position.set(x, 1.15, -1.55); packS.add(p); });
  [0.45, 1.15, 1.85].forEach((y) => { const b = rbox(2.2, 0.08, 0.78, 0xc99c62, 0.02); b.position.set(0, y, -1.55); packS.add(b); });
  const ROWC = [COLOR.teal, COLOR.indigo, COLOR.indigo, COLOR.indigo, COLOR.terra, COLOR.terra, COLOR.terra]; // file, class x 3 IoUs, function x 3 IoUs
  const rows = ROWC.map((c, j) => { const m = rbox(0.26, 0.42, 0.6, c, 0.04); m.position.set(-0.8 + j * 0.27, 1.15 + 0.26, -1.55); m.visible = false; packS.add(m); return m; });
  const shelfSpot = new THREE.Vector3(sx(4), 0.45 + 0.1, -1.55);

  // the ranked list: a tray with one card for each of the real top 10 hits, best first
  const tray = new THREE.Group(); root.add(tray);
  tray.add(rbox(1.7, 0.1, 0.72, COLOR.ink, 0.03));
  const cardX = (k: number) => -0.68 + k * 0.151;
  const cards = SY.top.map((_, k) => { const c = rbox(0.1, 0.42, 0.56, COLOR.paper, 0.02); c.position.set(cardX(k), 0.26, 0); tray.add(c); return c; });
  const cardMat = (k: number) => cards[k]!.material as THREE.MeshStandardMaterial;
  mini(ctx.overlay, tags, "#1", cards[0]!, 0.62);
  mini(ctx.overlay, tags, `#${cards.length}`, cards[cards.length - 1]!, 0.62);
  const ghost = rbox(0.1, 0.42, 0.56, COLOR.paper, 0.02); ghost.visible = false; root.add(ghost);
  const ghostMat = ghost.material as THREE.MeshStandardMaterial;
  const isMatch = (k: number) => (FN.relevance[k]?.length ?? 0) > 0;
  const paint = (k: number, graded: boolean) => { const m = cardMat(k); m.color.setHex(graded ? (isMatch(k) ? MATCH : MISS) : COLOR.paper); m.emissive.setHex(graded && isMatch(k) ? 0x7a5400 : 0); };

  // readouts (short; the caption carries the explanation)
  const nLens = note(ctx.overlay, tags, new THREE.Vector3(sx(0) + 0.3, 2.6, 0));
  const nMeter = note(ctx.overlay, tags, new THREE.Vector3(sx(2), 2.95, MZ));
  const nWatch = note(ctx.overlay, tags, new THREE.Vector3(sx(3), 2.6, -1.2));
  const nPack = note(ctx.overlay, tags, new THREE.Vector3(sx(4) - 0.6, 3.1, -2.4));
  const NOTES = [nLens, nMeter, nWatch, nPack];
  const C = new Caption(ctx.overlay.root, `<b>Score.</b> Watch one ranked list get graded, station by station. Click a station to repeat its part.`);
  const say = C.say.bind(C), hold = C.hold.bind(C);

  // running totals for the meter (the data tests check that the real recall@budget values agree)
  const cum = runningTotals(G.tokens);
  const fit = (b: number) => hitsInBudget(cum, b); // whole hits only
  const first = FN.first; // rank of the first hit that finds the gold function (null: not found)
  const nMetrics = Object.keys(FN.metrics).length; // metrics for each (level, IoU) pair, as score.py writes them
  const nSets = 1 + 2 * 3; // file level, plus class and function level at 3 IoU thresholds each

  function clearSegs() { segs.splice(0).forEach((m) => { meterS.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }); }
  function prepare(k: number) {
    tray.visible = true; tray.position.set(sx(k), TY, 0); tray.scale.setScalar(1);
    cards.forEach((c, j) => { c.position.y = 0.26; paint(j, k >= 1); });
    if (k < 3) clearSegs();
    boardLamps.forEach((l) => { l.color.setHex(OFF); l.emissive.setHex(0); });
    boardRows.forEach((r) => r.el.classList.add("off"));
    hand.rotation.z = 0; ghost.visible = false; rows.forEach((r) => (r.visible = false));
    NOTES.forEach(hideNote);
  }
  // a segment of the meter's fill for hit k
  function addSeg(k: number) {
    const h = (MH * G.tokens[k]!) / MAXT, y0 = M0 + (MH * (k ? cum[k - 1]! : 0)) / MAXT;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, h, 28), mat(isMatch(k) ? MATCH : 0xe2d8c6, isMatch(k) ? { emissive: 0x7a5400 } : {}));
    m.position.set(0, y0 + h / 2, MZ); meterS.add(m); segs.push(m);
    return m;
  }

  const intro = (t: gsap.core.Timeline) => say(t, `<b>A ranked list arrives.</b> It is what one system (${SYSN}) returned for one task (${esc(TASK)}): its top ${SY.top.length} hits, best first. A hit is one search result: here, one function. Each card is one hit.`, "<");
  const ACT: (() => gsap.core.Timeline)[] = [
    () => { // the lens: each hit against the gold function (the match rule, Decision 2)
      const t = gsap.timeline();
      say(t, `<b>1. Match hits.</b> The answer key says which function the real fix changed: <b>${esc(GOLDFN)}</b> (the "gold" function). Each hit is checked against it.`, 0);
      say(t, `A hit counts if it lies inside the gold function, or if their line ranges overlap by at least half (line IoU 0.5). Gold cards match; grey cards do not.`);
      cards.forEach((c, k) => {
        t.to(tray.position, { x: sx(0) - cardX(k), duration: 0.3, ease: "power2.inOut" })
          .to(c.position, { y: 0.6, duration: 0.15, ease: "power2.out" })
          .add(() => { paint(k, true); setNote(nLens, `#${k + 1} ${esc(SY.top[k]!.symbol ?? "")}: ${isMatch(k) ? `<span class="ok">match</span>` : "no match"}`); })
          .to(c.position, { y: 0.26, duration: 0.2, ease: "bounce.out" }, isMatch(k) ? "+=1.0" : "+=0.25");
      });
      t.to(tray.position, { x: sx(0), duration: 0.3 });
      hold(t);
      return t.add(() => hideNote(nLens)); // the list moves on; its last check is old news
    },
    () => { // the scoreboard: the real numbers for this list, each with its plain meaning
      const m = FN.metrics, t = gsap.timeline();
      say(t, `<b>2. Accuracy.</b> How early do the right answers come? We grade at function level: did the list find the function the fix changed?`, 0);
      const pos = (v: number | null | undefined) => (v ?? 0) > 0;
      const L: [string, boolean, string][] = [
        [`recall@1 <b>${f3(m["recall@1"])}</b>`, pos(m["recall@1"]), `<b>recall@1 = ${f3(m["recall@1"])}.</b> recall@k is the share of gold functions in the first k hits. ${pos(m["recall@1"]) ? "Hit #1 is the gold function." : "Hit #1 is not the gold function, so recall@1 is 0."}`],
        [`recall@10 <b>${f3(m["recall@10"])}</b>`, pos(m["recall@10"]), `<b>recall@10 = ${f3(m["recall@10"])}.</b> ${pos(m["recall@10"]) ? "The gold function is somewhere in the first 10 hits." : "The gold function is not in the first 10 hits."}`],
        [`MRR <b>1/${first ?? "-"} = ${f3(m.mrr)}</b>`, pos(m.mrr), `<b>MRR = ${first ? `1/${first} = ` : ""}${f3(m.mrr)}.</b> MRR is 1 divided by the rank of the first right hit${first ? `. It is at #${first}` : ", or 0 if there is none"}. A perfect list scores 1.`],
        [`success@10 <b>${f3(m["success@10"])}</b>`, pos(m["success@10"]), `<b>success@10 = ${f3(m["success@10"])}.</b> 1 only if every gold function is in the first 10. This task has ${EX.task.gold_fn ? "one" : "none"}${pos(m["success@10"]) ? ", and it is there" : ""}.`],
      ];
      L.forEach(([row, on, why], j) => {
        say(t, why);
        t.add(() => {
          boardLamps[j]!.color.setHex(on ? 0x7dff9a : COLOR.terra); boardLamps[j]!.emissive.setHex(on ? 0x3dff6a : 0x6a1a0a);
          boardRows[j]!.el.innerHTML = row; boardRows[j]!.el.classList.remove("off");
        }, "<");
      });
      return hold(t);
    },
    () => { // the token meter: each hit's text, in rank order, until the first right answer
      const t = gsap.timeline().add(() => clearSegs());
      say(t, `<b>3. Tokens.</b> An agent must read each hit's text. Tokens are the units of text a model reads, and you pay for each one. The meter adds up what the agent reads, hit by hit.`, 0);
      const last = Math.min((first ?? cards.length) - 1, cards.length - 1);
      for (let k = 0; k <= last; k++) {
        let seg: THREE.Mesh | null = null;
        t.add(() => { ghost.visible = true; ghost.scale.setScalar(1); ghostMat.color.copy(cardMat(k).color); cards[k]!.getWorldPosition(ghost.position); })
          .add(arc(ghost, new THREE.Vector3(sx(2), M0 + MH + 0.25, MZ), 0.6, 0.5))
          // the card drops into the glass and settles as its segment of the fill
          .add(() => { seg = addSeg(k); seg.scale.y = 0.01; })
          .to(ghost.scale, { x: 0.5, y: 0.2, z: 0.5, duration: 0.3, ease: "power2.in" })
          .to(ghost.position, { y: M0 + (MH * cum[k]!) / MAXT, duration: 0.3, ease: "power2.in" }, "<")
          .add(() => { ghost.visible = false; if (seg) gsap.to(seg.scale, { y: 1, duration: 0.3, ease: "power2.out" }); })
          .add(() => setNote(nMeter, `#${k + 1}: +${nf(G.tokens[k]!)} = <b>${nf(cum[k]!)}</b> tokens${isMatch(k) ? ` <span class="ok">found</span>` : ""}`), "<")
          .to({}, { duration: isMatch(k) ? 1.2 : 0.45 });
      }
      if (first) {
        const ttf = FN.metrics.tokens_to_first ?? 0;
        say(t, `<b>Tokens to first = ${nf(ttf)}.</b> The agent reads ${first} hits (${nf(ttf)} tokens) before it reaches the gold function. Fewer is better.`);
        const b1 = fit(1000), b4 = fit(4000);
        say(t, `<b>Recall in a budget.</b> If the agent can read only 1,000 tokens, it reads the first ${b1} whole hits (${nf(cum[b1 - 1] ?? 0)} tokens)${(FN.metrics["recall@budget1000"] ?? 0) > 0 ? " and finds the gold function" : " and misses the gold function"}: recall ${f3(FN.metrics["recall@budget1000"])}. With 4,000 tokens it reads ${b4} hits${(FN.metrics["recall@budget4000"] ?? 0) > 0 ? " and finds it" : ""}: recall ${f3(FN.metrics["recall@budget4000"])}.`);
      } else say(t, `<b>Not found.</b> The gold function is not in this list, so tokens to first has no value, and every budget gives recall 0.`);
      return hold(t);
    },
    () => { // the stopwatch: the search time of this task, from the run file
      const ms = EX.run.search_ms[SYSN], t = gsap.timeline();
      say(t, `<b>4. Latency.</b> How fast is the system? This search took <b>${ms ? Math.round(ms.ms) : "-"} ms</b> (from the real run file). The scorer also reports index build and update times; grep needs no index, so they are 0.`, 0);
      t.fromTo(hand.rotation, { z: 0 }, { z: -Math.PI * 2 * (ms ? ms.ms / 1000 : 0), duration: 1.0, ease: "power2.out" }, "<0.3")
        .add(() => setNote(nWatch, ms ? `search <b>${Math.round(ms.ms)} ms</b>` : "no run file for this task"), "<0.2");
      return hold(t);
    },
    () => { // packing: the rows that score.py writes for this task and system; the list goes on the shelf
      const t = gsap.timeline().add(() => rows.forEach((r) => (r.visible = false)));
      say(t, `<b>5. Score a run.</b> The scorer writes every number for this task and system: ${nMetrics} metrics, at file level and at class and function level with 3 overlap thresholds each (${nSets} sets) = <b>${nMetrics * nSets} rows</b> in scores.jsonl.`, 0);
      rows.forEach((r, j) => t.add(() => { r.visible = true; }, j === 0 ? "<0.3" : "+=0.15").fromTo(r.position, { y: 2.4 }, { y: 1.41, duration: 0.35, ease: "bounce.out" }, "<"));
      t.add(() => setNote(nPack, `scores.jsonl: <b>${nMetrics * nSets} rows</b>`), "<");
      say(t, `Then the graded list goes on the shelf, and the next list comes. summary.csv averages each metric over all ${EX.run.tasks} tasks.`);
      t.add(arc(tray, shelfSpot, 0.8, 0.8), "<0.2").to(tray.scale, { x: 0.7, y: 0.7, z: 0.7, duration: 0.8 }, "<");
      return hold(t);
    },
  ];

  const reduced = reducedMotion();
  let token = 0, cur: gsap.core.Timeline | null = null, wait: gsap.core.Tween | null = null, started = false;
  const halt = () => { token++; cur?.kill(); wait?.kill(); };
  function play(k: number | null) {
    halt();
    const my = token;
    const next = () => {
      if (my !== token) return;
      // with reduced motion, a station plays once and the whole line does not loop
      const t = gsap.timeline({ onComplete: () => { if (my === token && !reduced) wait = gsap.delayedCall(k === null ? 0.6 : 1.0, next); } });
      if (k === null) {
        if (!started) { started = true; t.to({}, { duration: 3.0 }); }
        t.add(() => { prepare(0); tray.position.x = -8.6; }).to(tray.position, { x: sx(0), duration: 1.0, ease: "power1.out" });
        intro(t); hold(t);
        t.add(ACT[0]!());
        for (let j = 1; j < 5; j++) t.to(tray.position, { x: sx(j), duration: 0.9, ease: "power1.inOut" }, "+=0.3").add(ACT[j]!());
      } else {
        t.add(() => prepare(k)).add(ACT[k]!());
      }
      cur = t;
    };
    next();
  }

  // build-up when the stage opens
  belt.scale.x = 0.01; rolls.scale.x = 0.01; tray.visible = false;
  ctx.tl.to([belt.scale, rolls.scale], { x: 1, duration: 0.6, ease: "power3.out" }, 0.45);
  stations.forEach((g, k) => { g.scale.setScalar(0.01); ctx.tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "back.out(1.8)" }, 0.6 + k * 0.1); });
  // step labels, in step order (the floor selects them by order), on the floor in front of the belt
  const stepTags = stations.map((g, k) => stepTag(ctx, parts[k]!, k, g, { baseY: 0, dy: 0, dz: 0.85, cls: "below" }));

  return {
    steps: stations,
    cam: { zoom: 1.42, tx: 0, ty: 1.3, tz: 0.2 },
    start() { prepare(0); tray.visible = false; if (!reduced) play(null); },
    select(k) {
      ring.position.x = sx(k);
      gsap.fromTo(ring.scale, { x: 0.8, y: 0.8 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(2)" });
      gsap.to(ringMat, { opacity: 0.9, duration: 0.25 });
      started = true;
      halt();
      const my = token;
      gsap.to(tray.position, { x: sx(k), y: TY, z: 0, duration: 0.5, onComplete: () => { if (my === token) play(k); } });
    },
    clear() { gsap.to(ringMat, { opacity: 0, duration: 0.25 }); if (reduced) { halt(); prepare(0); tray.visible = false; } else play(null); },
    stop: halt,
    close(tl) {
      C.remove();
      [...tags, ...stepTags].forEach((t) => ctx.overlay.removeTag(t));
      tl.to(root.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, ease: "back.in(1.5)" }, 0);
    },
    dispose() {
      halt();
      C.remove();
      root.traverse((o) => gsap.killTweensOf([o.position, o.scale, o.rotation]));
      ctx.scene.remove(root);
      disposeTree(root);
    },
    tick(dt) { rolls.children.forEach((r) => (r.rotation.y += dt * 4)); },
  };
}
