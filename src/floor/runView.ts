// RUN as a dispatch hub (V1-02 B5). The runner sends each task to every system through one plug:
// a wall with one port for each system. A query goes out through its port, the hit list comes back
// through the same port, and check_hits tests the list there. A caption names each phase.
// Stations follow the step order: plug, configs, grep, grep-fn, codemem, runner, merge.
// Every value comes from data/fixtures/b5.json and data/results/dev50-final.json (real code).
import * as THREE from "three";
import { gsap } from "gsap";
import type { Stage } from "../../content/stages";
import { fixtureB5 as EX, resultsFinal } from "../data/load";
import { esc } from "../lib/esc";
import { nvShort as short } from "../closers/nv";
import { reducedMotion } from "../lib/pace";
import { COLOR, disposeTree, mat, rbox, spinRollers } from "./kit";
import { ADAPTER_COLOR, Caption, arc, hideNote, hitTray, mini, move, note, rollers, setNote } from "./lines";
import type { Tag } from "./overlay";
import { stepTag, type View, type ViewCtx } from "./views";

const OFF = 0x6c6f78;

export function runView(stage: Stage, ctx: ViewCtx): View {
  const parts = stage.parts ?? [];
  const root = new THREE.Group();
  ctx.scene.add(root);
  const R = EX.run, SYS = R.systems;
  const DZ = 2.0, WZ = 0.2, BZ = -2.0; // dispatcher, plug wall, booth row (z)
  const RK = new THREE.Vector3(-7.4, 0, -0.7), SH = new THREE.Vector3(7.4, 0, -0.7); // config rack, run-file shelf
  const MG = new THREE.Vector3(8.3, 0, 2.2); // merge station, in front of the run-file shelf
  const BX: Record<string, number> = { grep: -3.6, grep_fn: 0, codemem: 3.6 };
  const PW = 0.56, PB = 0.12, PT = 0.64, PY = (PB + PT) / 2; // port width, bottom, top, middle (y)
  // one port for each system in configs/baseline.toml, in front of its adapter's booth
  const portX = SYS.map((x) => { const same = SYS.filter((y) => y.adapter === x.adapter); const j = same.indexOf(x); return BX[x.adapter]! + (j - (same.length - 1) / 2) * 0.72; });
  const station = (x: number, z: number, hw: number, hh: number, hd: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = hh / 2;
    g.add(hit);
    return g;
  };
  const wall = station(0, WZ, 9.8, 1.6, 0.6);
  const rack = station(RK.x, RK.z, 1.9, 2.6, 1.3);
  const gB = station(BX.grep!, BZ, 2.3, 2.7, 1.6);
  const fB = station(BX.grep_fn!, BZ, 2.3, 2.7, 1.6);
  const cB = station(BX.codemem!, BZ, 2.3, 3.0, 1.6);
  const disp = station(0, DZ, 2.3, 2.0, 2.0);
  const mg = station(MG.x, MG.z, 3.0, 1.8, 2.0);
  const stations = [wall, rack, gB, fB, cB, disp, mg];
  const extras: THREE.Object3D[] = []; // objects outside the stations that also grow in when the stage opens
  const tags: Tag[] = [];

  // 1. the plug: a wall with one open port for each system, a lamp over each port
  {
    const W = 4.8, edges = [-W, ...portX.flatMap((x) => [x - PW / 2, x + PW / 2]), W];
    for (let e = 0; e < edges.length; e += 2) {
      const w = edges[e + 1]! - edges[e]!;
      if (w > 0.01) { const p = rbox(w, PT - PB, 0.3, COLOR.ink, 0.02); p.position.set((edges[e]! + edges[e + 1]!) / 2, PY, 0); wall.add(p); }
    }
    const top = rbox(2 * W, 0.46, 0.3, COLOR.ink, 0.05); top.position.y = PT + 0.23; wall.add(top);
    const sill = rbox(2 * W, PB, 0.3, COLOR.ink, 0.02); sill.position.y = PB / 2; wall.add(sill);
  }
  const lamps = portX.map((x, j) => {
    const frame = rbox(PW + 0.08, 0.06, 0.32, ADAPTER_COLOR[SYS[j]!.adapter]!, 0.02); frame.position.set(x, PT - 0.02, 0.01); wall.add(frame);
    const m = new THREE.MeshStandardMaterial({ color: OFF, emissive: 0x000000 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), m); l.position.set(x, PT + 0.24, 0.17); wall.add(l);
    return m;
  });
  const lampTo = (t: gsap.core.Timeline, j: number, color: number, emissive: number, at?: gsap.Position) => t.add(() => { lamps[j]!.color.setHex(color); lamps[j]!.emissive.setHex(emissive); }, at);
  const lampOff = (j: number) => { lamps[j]!.color.setHex(OFF); lamps[j]!.emissive.setHex(0); };
  // a cable from the back of each port to its booth
  portX.forEach((x) => { const c = rbox(0.07, 0.06, WZ - BZ - 0.95, COLOR.ink, 0.02); c.position.set(x, 0.05, (WZ - 0.15 + BZ + 0.65) / 2); root.add(c); extras.push(c); });

  // 2. the config rack: one TOML card for each system. At the start of a run each card takes its port.
  [-0.85, 0.85].forEach((x) => { const p = rbox(0.1, 2.3, 0.7, 0xb98a55, 0.03); p.position.set(x, 1.15, 0); rack.add(p); });
  [0.5, 1.25, 2.0].forEach((y) => { const b = rbox(1.8, 0.07, 0.72, 0xc99c62, 0.02); b.position.set(0, y, 0); rack.add(b); });
  const cardHome = SYS.map((_, j) => new THREE.Vector3(RK.x - 0.42 + (j % 2) * 0.84, [0.5, 1.25, 2.0][Math.floor(j / 2)]! + 0.245, RK.z));
  const cardPort = (j: number) => new THREE.Vector3(portX[j]!, PT + 0.46 + 0.21, WZ);
  const cards = SYS.map((x) => {
    const c = new THREE.Group(); root.add(c); extras.push(c);
    c.add(rbox(0.5, 0.42, 0.06, COLOR.paper, 0.03));
    const band = rbox(0.5, 0.1, 0.07, ADAPTER_COLOR[x.adapter]!, 0.02); band.position.y = 0.16; c.add(band);
    [-0.02, -0.1].forEach((y) => { const l = rbox(0.34, 0.025, 0.07, 0xb9b2a6, 0.005); l.position.y = y; c.add(l); });
    return c;
  });
  const cardsHome = () => cards.forEach((c, j) => c.position.copy(cardHome[j]!));
  const cardsOnWall = () => cards.forEach((c, j) => c.position.copy(cardPort(j)));

  // 3. grep: a booth with the real match counts of its top 10 files as bars on the roof
  { const body = rbox(2.0, 1.5, 1.3, COLOR.indigo, 0.12); body.position.y = 0.75; gB.add(body); }
  const maxCount = EX.grep.files[0]![1];
  const bars = EX.grep.files.map(([path, count], j) => {
    const gold = path === EX.task.gold_file;
    const bg = new THREE.Group(); bg.position.set(-0.81 + j * 0.18, 1.5, 0); gB.add(bg);
    const b = rbox(0.13, 1.0, 0.5, gold ? COLOR.mustard : COLOR.paper, 0.03, gold ? { emissive: 0x7a5400 } : {}); b.position.y = 0.5; bg.add(b);
    bg.scale.y = 0.01; bg.userData.h = 0.15 + (0.85 * count) / maxCount;
    return bg;
  });
  // 4. grep-fn: function boxes on the roof, and four "plus" switches on the front
  { const body = rbox(2.0, 1.5, 1.3, COLOR.terra, 0.12); body.position.y = 0.75; fB.add(body); }
  const fnBoxes = Array.from({ length: 10 }, (_, j) => { const b = rbox(0.15, 0.15, 0.15, COLOR.paper, 0.03); b.position.set(-0.81 + j * 0.18, 1.6, 0); b.scale.setScalar(0.01); fB.add(b); return b; });
  const switches = [0, 1, 2, 3].map((j) => {
    const base = rbox(0.3, 0.3, 0.06, COLOR.ink, 0.03); base.position.set(-0.6 + j * 0.4, 0.95, 0.68); fB.add(base);
    const lever = new THREE.Group(); lever.position.set(-0.6 + j * 0.4, 0.95, 0.72); fB.add(lever);
    const stick = rbox(0.07, 0.24, 0.07, COLOR.paper, 0.02); stick.position.y = 0.1; lever.add(stick);
    lever.rotation.x = 0.6;
    return lever;
  });
  // 5. codemem: one shared index block, and one nozzle for each codemem system
  const CM = SYS.filter((x) => x.adapter === "codemem"), nCM = CM.length;
  { const body = rbox(2.0, 1.3, 1.3, 0x6c5a49, 0.12); body.position.y = 0.65; cB.add(body); }
  const layers = Array.from({ length: 5 }, (_, j) => { const l = rbox(1.4, 0.18, 0.9, COLOR.indigo, 0.03, { transparent: true, opacity: 0.85 }); l.position.set(0, 1.4 + j * 0.2, -0.05); l.scale.setScalar(0.01); cB.add(l); return l; });
  const nozzles = CM.map((_, j) => (j - (nCM - 1) / 2) * 0.5).map((x) => { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.4, 14), mat(COLOR.steel, { metalness: 0.4, roughness: 0.4 })); n.position.set(x, 1.0, 0.75); n.rotation.x = Math.PI / 2; n.castShadow = true; cB.add(n); return n; });

  // 6. the dispatcher: a platform, the worktree (a folder), and the leak-check lamp
  { const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.3, 40), mat(COLOR.teal)); plat.position.y = 0.15; plat.castShadow = plat.receiveShadow = true; disp.add(plat); }
  const tree = new THREE.Group(); tree.position.set(-0.45, 0.3, -0.62); disp.add(tree);
  {
    const back = rbox(0.72, 0.5, 0.06, 0xc99a2e, 0.04); back.position.set(0, 0.3, -0.03); tree.add(back);
    const tab = rbox(0.28, 0.1, 0.06, 0xc99a2e, 0.03); tab.position.set(-0.22, 0.58, -0.03); tree.add(tab);
    const paper = rbox(0.6, 0.42, 0.02, COLOR.paper, 0.01); paper.position.set(0, 0.34, 0.01); tree.add(paper);
    const front = rbox(0.72, 0.4, 0.06, COLOR.mustard, 0.04); front.position.set(0, 0.22, 0.05); tree.add(front);
  }
  mini(ctx.overlay, tags, "worktree", tree, 0.85);
  const lampMat = new THREE.MeshStandardMaterial({ color: OFF, emissive: 0x000000 });
  {
    const post = rbox(0.06, 0.55, 0.06, COLOR.ink, 0.02); post.position.set(0.45, 0.57, -0.62); disp.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), lampMat); lamp.position.set(0.45, 0.9, -0.62); disp.add(lamp);
  }
  const belt = rbox(6.6, 0.3, 1.0, COLOR.belt, 0.08); belt.position.set(-4.6, 0.15, DZ); root.add(belt);
  const rolls = rollers(-7.7, -1.5, DZ); root.add(rolls);
  // the run-file shelf: one row for each system file, one small tray for each line
  const shelf = new THREE.Group(); shelf.position.copy(SH); root.add(shelf);
  [-0.95, 0.95].forEach((x) => { const p = rbox(0.1, 2.5, 0.7, 0xb98a55, 0.03); p.position.set(x, 1.25, 0); shelf.add(p); });
  const rowY = (j: number) => 0.1 + 0.4 * j;
  SYS.forEach((_, j) => { const b = rbox(1.8, 0.05, 0.72, 0xc99c62, 0.02); b.position.set(0, rowY(j) - 0.03, 0); shelf.add(b); });
  const slotPos = (j: number, n: number) => new THREE.Vector3(SH.x - 0.72 + n * 0.205, rowY(j) + 0.03, SH.z);
  const SLOTS = 8, TRAY_SMALL = 0.36;
  const slots = SYS.map((x, j) => Array.from({ length: SLOTS }, (_, n) => { const t = hitTray(ADAPTER_COLOR[x.adapter]!); t.scale.setScalar(TRAY_SMALL); t.position.copy(slotPos(j, n)); root.add(t); return t; }));
  const rowTags = SYS.map((x, j) => { const t = ctx.overlay.addTag(`${esc(x.name)}.jsonl`, new THREE.Vector3(SH.x + 1.35, rowY(j) + 0.12, SH.z + 0.3), "rowl off"); tags.push(t); return t; });

  // 7. merge runs: two run racks stay as they are; a new rack gets a copy of each row
  const PARTS = resultsFinal.code.parts;
  const runRack = (x: number, rows: number, color: (j: number) => number, h: number) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0); mg.add(g);
    [-0.5, 0.5].forEach((px) => { const p = rbox(0.08, h, 0.5, 0xb98a55, 0.03); p.position.set(px, h / 2, 0); g.add(p); });
    const items = Array.from({ length: rows }, (_, j) => {
      const b = rbox(0.9, 0.04, 0.52, 0xc99c62, 0.01); b.position.set(0, 0.08 + j * 0.2, 0); g.add(b);
      const item = rbox(0.7, 0.12, 0.36, color(j), 0.03); item.position.set(0, 0.16 + j * 0.2, 0); g.add(item);
      return item;
    });
    return { g, items };
  };
  const sysColor = (name: string) => ADAPTER_COLOR[SYS.find((s) => s.name === name)?.adapter ?? "codemem"]!;
  // one rack for each part of the example merged run, and one for the new run (sizes from the data)
  const nA = PARTS[0]?.systems.length ?? 0, nB = PARTS[1]?.systems.length ?? 0;
  const rackA = runRack(-1.0, nA, (j) => sysColor(PARTS[0]?.systems[j] ?? ""), 0.1 + 0.2 * nA);
  const rackB = runRack(1.0, nB, (j) => sysColor(PARTS[1]?.systems[j] ?? ""), 0.1 + 0.2 * nB);
  const rackC = runRack(0, nA + nB, () => COLOR.paper, 0.1 + 0.2 * (nA + nB)); rackC.g.position.z = 0.75;
  rackC.items.forEach((it) => (it.visible = false));
  rackC.g.scale.setScalar(0.01);
  mini(ctx.overlay, tags, "grep run", rackA.g, 0.95);
  mini(ctx.overlay, tags, "codemem run", rackB.g, 0.95);
  const copies = [...rackA.items, ...rackB.items].map((it) => { const c = it.clone(); c.material = it.material.clone(); c.visible = false; root.add(c); return c; });

  // the task: a sheet of paper (the issue text) on a small pallet, with a band in its repo's color
  const REPO_COLOR = [COLOR.teal, COLOR.indigo, COLOR.terra, COLOR.mustard, 0x6c5a49];
  const task = new THREE.Group(); root.add(task);
  task.add(rbox(0.86, 0.1, 0.66, COLOR.ink, 0.03));
  {
    const sheet = rbox(0.74, 0.04, 0.56, COLOR.paper, 0.01); sheet.position.y = 0.07; task.add(sheet);
    [-0.12, 0.0, 0.12].forEach((z, q) => { const l = rbox(q === 2 ? 0.34 : 0.56, 0.012, 0.04, 0xb9b2a6, 0.004); l.position.set(q === 2 ? -0.11 : 0, 0.095, z); task.add(l); });
  }
  const band = rbox(0.74, 0.02, 0.1, REPO_COLOR[0]!, 0.005); band.position.set(0, 0.1, -0.22); task.add(band);
  const bandMat = band.material as THREE.MeshStandardMaterial;
  const queries = SYS.map(() => { const m = new THREE.Group(); m.add(rbox(0.34, 0.03, 0.26, COLOR.paper, 0.01)); const l = rbox(0.24, 0.01, 0.03, 0xb9b2a6, 0.004); l.position.y = 0.02; m.add(l); m.visible = false; root.add(m); return m; });
  const trays = SYS.map((x) => { const t = hitTray(ADAPTER_COLOR[x.adapter]!); root.add(t); return t; });
  const badTray = hitTray(COLOR.terra); root.add(badTray);
  const sparks = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: 0 })); root.add(m); return m; });

  // live readouts (real values) and the caption
  const nTask = note(ctx.overlay, tags, new THREE.Vector3(-2.9, 0.05, DZ + 0.75), "below"); // in front of the belt's end, so the worktree stays in view
  const nGrep = note(ctx.overlay, tags, new THREE.Vector3(BX.grep!, 2.6, BZ));
  const nFn = note(ctx.overlay, tags, new THREE.Vector3(BX.grep_fn!, 2.6, BZ));
  const nCm = note(ctx.overlay, tags, new THREE.Vector3(BX.codemem!, 2.6, BZ));
  const nWall = note(ctx.overlay, tags, new THREE.Vector3(2.0, 0.05, WZ + 0.7), "below");
  const nRack = note(ctx.overlay, tags, new THREE.Vector3(RK.x, 2.5, RK.z));
  const nShelf = note(ctx.overlay, tags, new THREE.Vector3(SH.x, 2.9, SH.z));
  const nMerge = note(ctx.overlay, tags, new THREE.Vector3(MG.x - 2.4, 1.0, MG.z - 0.6)); // left of the racks, so the new rack stays in view
  const NOTES = [nTask, nGrep, nFn, nCm, nWall, nRack, nShelf, nMerge];
  const C = new Caption(ctx.overlay.root, `<b>Run.</b> Watch one run, task by task. Click a station to repeat its part.`);
  const say = C.say.bind(C), hold = C.hold.bind(C);

  const ORDER = R.order; // the real run order (run.order_tasks)
  let taskNo = 0;
  const inFront = (j: number) => new THREE.Vector3(portX[j]!, PY, WZ + 0.5);
  const behind = (j: number) => new THREE.Vector3(portX[j]!, PY, WZ - 0.5);
  const boothTop = (a: string) => new THREE.Vector3(BX[a]!, 1.65, BZ);
  const onDisp = (j: number) => new THREE.Vector3(-0.5 + (j % 3) * 0.5, 0.45 + Math.floor(j / 3) * 0.12, DZ + 0.1 - Math.floor(j / 3) * 0.35);
  const repoIdx = (repo: string) => R.repos.findIndex((r) => r[0] === repo);

  function reset() {
    task.visible = false; queries.forEach((m) => (m.visible = false)); trays.forEach((t) => { t.visible = false; t.scale.setScalar(1); }); badTray.visible = false;
    lampMat.color.setHex(OFF); lampMat.emissive.setHex(0); portX.forEach((_, j) => lampOff(j));
    bars.forEach((b) => (b.scale.y = 0.01)); fnBoxes.forEach((b) => b.scale.setScalar(0.01)); switches.forEach((l) => (l.rotation.x = 0.6));
    copies.forEach((c) => (c.visible = false)); rackC.items.forEach((it) => (it.visible = false)); rackC.g.scale.setScalar(0.01);
    NOTES.forEach(hideNote);
  }

  // the start of a run: make_system for each config; each system takes its port
  function configs() {
    const t = gsap.timeline().add(() => { reset(); cardsHome(); setNote(nRack, `configs/baseline.toml: <b>${SYS.length} systems</b>`); });
    say(t, `<b>The run starts.</b> Each config card becomes a system (make_system) and takes its port in the plug.`, 0);
    cards.forEach((c, j) => {
      t.add(arc(c, cardPort(j), 1.4, 0.75), j === 0 ? ">0.4" : "<0.15");
      lampTo(t, j, 0xfff1cf, 0x8a7a40, ">-0.05");
    });
    t.add(() => { setNote(nWall, `${SYS.length} ports: ${SYS.map((x) => esc(x.name)).join(", ")}`); portX.forEach((_, j) => lampOff(j)); }, "+=0.4");
    return hold(t.to({}, { duration: 1.2 }));
  }

  // one task, phase by phase
  function wholeTask() {
    const cur = ORDER[taskNo]!, first = taskNo === 0 || ORDER[taskNo - 1]!.repo !== cur.repo;
    const repoN = R.repos[repoIdx(cur.repo)]![1], inRepo = ORDER.slice(0, taskNo + 1).filter((x) => x.repo === cur.repo).length;
    const t = gsap.timeline();
    // 1. a task arrives
    t.add(() => {
      reset(); bandMat.color.setHex(REPO_COLOR[repoIdx(cur.repo) % REPO_COLOR.length]!);
      task.visible = true; task.scale.setScalar(1); task.position.set(-7.8, 0.36, DZ);
      setNote(nTask, `task ${taskNo + 1} of ${ORDER.length}: <b>${esc(cur.id)}</b>`);
    });
    say(t, `<b>1. A task arrives:</b> the issue text and its base commit. Tasks go repo by repo, in commit-date order (${esc(cur.repo)}: ${inRepo} of ${repoN}).`, "<");
    t.add(move(task, new THREE.Vector3(0, 0.36, DZ), 1.4));
    // 2. the worktree moves to the base commit; leak check
    say(t, `<b>2. The worktree moves to the base commit.</b> Leak check: HEAD must be that commit, so no system sees the fix.`, ">0.2");
    t.add(() => setNote(nTask, `${esc(cur.id)}: worktree at <b>${cur.commit}</b>`), "<")
      .fromTo(tree.rotation, { y: 0 }, { y: Math.PI * 2, duration: 0.9, ease: "power2.inOut" }, "<0.3")
      .add(() => { lampMat.color.setHex(0x7dff9a); lampMat.emissive.setHex(0x3dff6a); setNote(nTask, `${esc(cur.id)}: HEAD = <b>${cur.commit}</b> <span class="ok">ok</span>`); }, "+=0.5")
      .to({}, { duration: 0.9 });
    // 3. index groups
    say(t, first ? `<b>3. Index.</b> grep needs no index. codemem <b>builds</b> one index for its ${nCM} systems (the first task of a repo).`
      : `<b>3. Index.</b> grep needs no index. codemem <b>updates</b> its one index to the new commit (Decision 5).`);
    t.add(() => { setNote(nGrep, `no index`); setNote(nCm, first ? `<b>build</b> once for ${nCM} systems` : `<b>update</b> once for ${nCM} systems`); }, "<");
    if (first) layers.forEach((l, j) => t.fromTo(l.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.3, ease: "back.out(2)" }, j === 0 ? "<0.2" : "<0.15"));
    else t.to(layers[4]!.scale, { y: 1.6, duration: 0.25, yoyo: true, repeat: 1 }, "<0.2");
    t.to({}, { duration: 0.8 });
    // 4. the query goes out through each port
    say(t, `<b>4. The query goes out through each system's port.</b> All ${SYS.length} systems get the same issue text.`);
    SYS.forEach((x, j) => {
      t.add(() => { queries[j]!.visible = true; queries[j]!.position.set(0, 0.5, DZ); }, j === 0 ? ">" : "<0.08")
        .add(move(queries[j]!, inFront(j), 0.55), "<")
        .add(move(queries[j]!, behind(j), 0.35, "none"), ">");
      lampTo(t, j, 0x9fd0ff, 0x2a6aff, "<");
      t.add(arc(queries[j]!, boothTop(x.adapter), 0.5, 0.45), ">");
    });
    t.add(() => { queries.forEach((m) => (m.visible = false)); portX.forEach((_, j) => lampOff(j)); });
    // 5. each system searches
    say(t, `<b>5. Each system searches</b> and returns a ranked list of hits (up to k = 50).`);
    bars.forEach((b, j) => t.to(b.scale, { y: b.userData.h as number, duration: 0.3, ease: "back.out(2)" }, j === 0 ? "<" : "<0.03"));
    fnBoxes.forEach((b) => t.to(b.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: "back.out(3)" }, "<0.03"));
    nozzles.forEach((n) => t.to(n.scale, { x: 1.3, z: 1.3, duration: 0.12, yoyo: true, repeat: 1 }, "<0.08"));
    t.to({}, { duration: 0.6 });
    // 6. each list comes back through its port; check_hits
    say(t, `<b>6. Each list comes back through its port.</b> check_hits tests the contract there: at most k hits, real paths, line numbers on line hits.`);
    SYS.forEach((x, j) => {
      t.add(() => { trays[j]!.visible = true; trays[j]!.position.copy(boothTop(x.adapter)); }, j === 0 ? ">" : "<0.1")
        .add(move(trays[j]!, behind(j), 0.55), "<")
        .add(move(trays[j]!, inFront(j), 0.35, "none"), ">");
      lampTo(t, j, 0x7dff9a, 0x3dff6a, "<0.15");
      t.add(move(trays[j]!, onDisp(j), 0.45), ">");
    });
    t.add(() => setNote(nWall, `check_hits: <span class="ok">${SYS.length} of ${SYS.length} ok</span>`), "<");
    // 7. each list becomes one line in its system's file
    const n = taskNo % SLOTS;
    say(t, `<b>7. The runner writes each list</b> as one line in its system's file, then takes the next task.`, ">0.4");
    t.add(() => { if (n === 0) slots.forEach((row) => row.forEach((m) => (m.visible = false))); rowTags.forEach((r) => r.el.classList.remove("off")); setNote(nShelf, `one line for each task`); }, "<");
    SYS.forEach((_, j) => {
      t.add(arc(trays[j]!, slotPos(j, n), 0.9, 0.7), j === 0 ? ">" : "<0.06")
        .to(trays[j]!.scale, { x: TRAY_SMALL, y: TRAY_SMALL, z: TRAY_SMALL, duration: 0.7, ease: "power1.in" }, "<")
        .add(() => { slots[j]![n]!.visible = true; trays[j]!.visible = false; }, ">");
    });
    hold(t);
    t.to(task.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.4, ease: "back.in(2)" }, "+=0.2")
      .add(() => { taskNo = (taskNo + 1) % ORDER.length; });
    return t;
  }

  // one station on repeat
  const rankText = (r: number | null) => r === null ? `<span class="bad">not in top ${EX.systems["grep-fn"].n_hits}</span>` : r <= 10 ? `<span class="ok">rank ${r}</span>` : `<b>rank ${r}</b>`;
  const NAMES: Record<string, string> = { none: "no options", types: "+ Python only", idf: "+ IDF", clean: "+ clean keywords", tests_last: "+ tests last (plus)" };
  const ACT: (() => gsap.core.Timeline)[] = [
    () => { // the plug: a good list passes its port; a line hit without line numbers is refused
      const t = gsap.timeline().add(() => reset());
      // a good list from the first codemem port; a bad list (a line hit with no line numbers) at the first grep-fn port
      const good = Math.max(0, SYS.findIndex((x) => x.adapter === "codemem")), bad = Math.max(0, SYS.findIndex((x) => x.adapter === "grep_fn"));
      say(t, `<b>The plug.</b> Every system talks to the runner through the same port. A list must pass check_hits there.`, 0);
      t.add(() => { trays[good]!.visible = true; trays[good]!.position.copy(boothTop("codemem")); })
        .add(move(trays[good]!, behind(good), 0.6)).add(move(trays[good]!, inFront(good), 0.4, "none"));
      lampTo(t, good, 0x7dff9a, 0x3dff6a, "<0.15");
      t.add(() => setNote(nWall, `check_hits: <span class="ok">ok</span> (1 &le; start &le; end on every line hit)`), "<")
        .add(move(trays[good]!, onDisp(good), 0.5))
        .add(() => { badTray.visible = true; badTray.position.copy(boothTop("grep_fn")); }, "+=0.3")
        .add(move(badTray, behind(bad), 0.6));
      lampTo(t, bad, 0xff7a5a, 0xff3a1a, ">");
      t.add(() => {
        setNote(nWall, `<span class="bad">RetrieverError</span>: a line hit without line numbers`);
        sparks.forEach((sp, q) => {
          const a = (q / sparks.length) * Math.PI * 2;
          sp.position.copy(behind(bad)); sp.material.opacity = 1;
          gsap.to(sp.position, { x: portX[bad]! + Math.cos(a) * 0.5, y: PY + Math.sin(a) * 0.5, duration: 0.45, ease: "power2.out" });
          gsap.to(sp.material, { opacity: 0, duration: 0.45 });
        });
      }, "<")
        .add(move(badTray, boothTop("grep_fn"), 0.6, "power2.out"), ">0.3")
        .add(() => { badTray.visible = false; lampOff(bad); }, "+=0.5");
      return hold(t.to({}, { duration: 1.0 }));
    },
    () => configs(),
    () => { // grep: ripgrep counts matches in each file; files rank by count
      const t = gsap.timeline().add(() => { reset(); setNote(nGrep, `<b>${EX.grep.files_matched}</b> files match`); });
      say(t, `<b>grep.</b> ripgrep counts the keyword matches in each file. Files rank by count. The bars are the real top 10 for ${esc(EX.task.id)}.`, 0);
      bars.forEach((b, j) => t.to(b.scale, { y: b.userData.h as number, duration: 0.35, ease: "back.out(2)" }, j === 0 ? ">0.3" : "<0.12"));
      const rank = EX.grep.gold_file_rank; // the bars show the top 10 only
      t.add(() => setNote(nGrep, rank === null ? `gold file: <b>not found</b>` : `gold file <b>${esc(short(EX.task.gold_file))}</b>: rank ${rank}`), "+=0.2");
      return hold(t.to({}, { duration: 2.4 }));
    },
    () => { // grep-fn: functions around the match lines; then the four plus switches, one at a time
      const t = gsap.timeline().add(() => reset());
      say(t, `<b>grep-fn.</b> Each match line falls into the function around it. grep-fn-plus turns on four switches. The gold function's rank for ${esc(EX.task.id)}:`, 0);
      EX.switches.forEach((sw, q) => {
        if (q > 0) t.to(switches[q - 1]!.rotation, { x: -0.6, duration: 0.3, ease: "back.out(3)" }, ">0.4");
        t.add(() => fnBoxes.forEach((b, j) => {
          const gold = sw.gold_fn_rank === j + 1, m = b.material as THREE.MeshStandardMaterial;
          m.color.setHex(gold ? COLOR.mustard : COLOR.paper); m.emissive.setHex(gold ? 0x7a5400 : 0x000000);
        }));
        fnBoxes.forEach((b, j) => t.fromTo(b.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.22, ease: "back.out(3)" }, j === 0 ? ">" : "<0.03"));
        t.add(() => setNote(nFn, `${NAMES[sw.switch]}: gold fn ${rankText(sw.gold_fn_rank)}`), "<");
        t.to({}, { duration: 1.4 });
      });
      return hold(t.to({}, { duration: 1.2 }));
    },
    () => { // codemem: one build, then one search for each codemem system, on the same index
      const t = gsap.timeline().add(() => { reset(); layers.forEach((l) => l.scale.setScalar(0.01)); setNote(nCm, `one index for ${nCM} systems: <b>one build</b>`); });
      say(t, `<b>codemem.</b> The ${nCM} codemem systems have the same index settings, so they share one index: one build, ${nCM} searches.`, 0);
      layers.forEach((l, j) => t.fromTo(l.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.3, ease: "back.out(2)" }, j === 0 ? ">0.3" : "<0.15"));
      t.add(() => setNote(nCm, `<b>${nCM} searches</b>: ${CM.map((x) => esc(x.name)).join(" . ")}`), ">0.3");
      const cmIdx = SYS.flatMap((x, k) => (x.adapter === "codemem" ? [k] : []));
      nozzles.forEach((n, j) => {
        const tr = trays[cmIdx[j] ?? 0]!;
        t.to(n.scale, { x: 1.35, z: 1.35, duration: 0.14, yoyo: true, repeat: 1 }, ">0.2")
          .add(() => { tr.visible = true; tr.position.set(BX.codemem! + (j - (nCM - 1) / 2) * 0.5, 1.0, BZ + 0.9); }, "<")
          .to(tr.position, { z: BZ + 1.3, y: 0.06, duration: 0.5, ease: "bounce.out" }, "<");
      });
      return hold(t.to({}, { duration: 1.6 }));
    },
    () => wholeTask(),
    () => { // merge runs: a copy of each row goes into a new rack; the two runs stay as they are
      const t = gsap.timeline().add(() => reset());
      const [a, b] = PARTS;
      say(t, `<b>Merge runs.</b> Example: run ${esc(resultsFinal.run)} (an early dev run) joins two runs of the same ${resultsFinal.tasks} tasks: the ${a?.systems.length ?? 0} grep systems (run again after a grep-fn fix) and the ${b?.systems.length ?? 0} codemem systems (from an earlier run, so their index builds did not run again).`, 0);
      t.to(rackC.g.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(1.8)" }, ">0.4");
      // positions of the rack items at full size (the racks do not move; rack C grows in above)
      const at = (rack: { g: THREE.Group; items: THREE.Mesh[] }, j: number) => new THREE.Vector3().copy(MG).add(rack.g.position).add(rack.items[j]!.position);
      copies.forEach((c, j) => {
        const from = j < nA ? at(rackA, j) : at(rackB, j - nA), dst = rackC.items[j]!;
        t.add(() => { c.position.copy(from); c.visible = true; }, j === 0 ? ">0.2" : ">-0.35")
          .add(arc(c, at(rackC, j), 0.6, 0.6), "<")
          .add(() => { c.visible = false; dst.visible = true; }, ">");
      });
      t.to({}, { duration: 0.8 });
      say(t, `merge copies the run files into a new run. The two runs do not change. The new run is scored next.`);
      t.add(() => setNote(nMerge, `new run: <b>${(a?.systems.length ?? 0) + (b?.systems.length ?? 0)} systems</b>`), "<");
      return hold(t.to({}, { duration: 1.2 }));
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
      // with reduced motion, a station plays once and the whole run does not loop
      const t = gsap.timeline({ onComplete: () => { if (my === token && !reduced) wait = gsap.delayedCall(k === null ? 0.5 : 1.0, next); } });
      if (k === null && !started) { started = true; t.to({}, { duration: 3.0 }).add(configs()); } // a run makes its systems once, at the start
      else { if (k === null) cardsOnWall(); t.add(k === null ? wholeTask() : ACT[k]!()); }
      cur = t;
    };
    next();
  }

  // build-up when the stage opens: every part grows in with its station
  [belt.scale, rolls.scale].forEach((sc) => (sc.x = 0.01));
  ctx.tl.to([belt.scale, rolls.scale], { x: 1, duration: 0.6, ease: "power3.out" }, 0.45);
  [...stations, shelf].forEach((g, k) => { g.scale.setScalar(0.01); ctx.tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "back.out(1.8)" }, 0.6 + k * 0.08); });
  cardsHome();
  extras.forEach((o) => { o.scale.setScalar(0.01); ctx.tl.to(o.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(1.6)" }, 1.0); });
  reset();
  slots.forEach((row) => row.forEach((m) => (m.visible = false)));
  // step labels, in step order (the floor selects them by order): above the booths, the rack, and
  // the shelf; on the floor in front of the wall, the dispatcher, and the merge station
  const wallAnchor = new THREE.Object3D(); wallAnchor.position.x = 4.4; wall.add(wallAnchor);
  const mergeAnchor = new THREE.Object3D(); mergeAnchor.position.set(2.0, 0, 0.2); mg.add(mergeAnchor);
  const stepTags = [
    stepTag(ctx, parts[0]!, 0, wallAnchor, { baseY: 0, dy: 0, dz: 0.45, cls: "below" }),
    stepTag(ctx, parts[1]!, 1, rack, { baseY: 0, dy: 3.2 }),
    stepTag(ctx, parts[2]!, 2, gB, { baseY: 0, dy: 3.4 }),
    stepTag(ctx, parts[3]!, 3, fB, { baseY: 0, dy: 3.4 }),
    stepTag(ctx, parts[4]!, 4, cB, { baseY: 0, dy: 3.4 }),
    stepTag(ctx, parts[5]!, 5, disp, { baseY: 0, dy: 0, dz: 1.15, cls: "below" }),
    stepTag(ctx, parts[6]!, 6, mergeAnchor, { baseY: 0, dy: 0, dz: 0, cls: "below" }), // beside the racks: the floor edge is close
  ];
  const ringMat = new THREE.MeshBasicMaterial({ color: COLOR.mustard, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.42, 56), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; root.add(ring);

  return {
    steps: stations,
    cam: { zoom: 1.22, tx: 0, ty: 0.9, tz: -0.6 },
    start() { if (reduced) { cardsOnWall(); return; } play(null); },
    select(k) {
      const g = stations[k]!, sx = k === 0 ? 3.6 : 1;
      ring.position.x = g.position.x; ring.position.z = g.position.z;
      gsap.fromTo(ring.scale, { x: 0.8 * sx, y: 0.8 }, { x: sx, y: 1, duration: 0.4, ease: "back.out(2)" });
      gsap.to(ringMat, { opacity: 0.9, duration: 0.25 });
      started = true;
      if (k !== 1) cardsOnWall();
      play(k);
    },
    clear() { gsap.to(ringMat, { opacity: 0, duration: 0.25 }); halt(); reset(); if (!reduced) play(null); },
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
    tick(dt) { spinRollers(rolls, dt); },
  };
}
