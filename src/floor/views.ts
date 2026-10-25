// What a stage turns into when you open it (viz decision 10). COLLECT is an assembly line with
// a task crate that travels through 5 stations. Other stages open into plain blocks until they
// get their own line (V1-02 B5).
import * as THREE from "three";
import { esc } from "../lib/esc";
import { gsap } from "gsap";
import type { Part, Stage } from "../../content/stages";
import { COLOR, disposeTree, ghostBox, mat, rbox, rollerRow, spinRollers } from "./kit";
import type { Overlay, Tag } from "./overlay";

export type Cam = { zoom: number; tx: number; ty: number; tz: number };

export type View = {
  /** One object for each step, in step order. Picking and bubbles use them. */
  steps: THREE.Object3D[];
  cam: Cam;
  /** Called when the open animation ends. */
  start(): void;
  select(k: number): void;
  clear(): void;
  stop(): void;
  /** Adds the close animation to the timeline. */
  close(tl: gsap.core.Timeline): void;
  dispose(): void;
  tick(dt: number): void;
};

export type ViewCtx = { scene: THREE.Scene; overlay: Overlay; x: number; tl: gsap.core.Timeline };


export function stepTag(ctx: ViewCtx, p: Part, k: number, obj: THREE.Object3D, o: { baseY: number; dy: number; dz?: number; cls?: string; extra?: string }): Tag {
  const tag = ctx.overlay.addTag(`${k + 1}. ${esc(p.n)}${p.ghost ? "<small>planned</small>" : ""}${o.extra ?? ""}`, new THREE.Vector3(), `part${p.ghost ? " ghost" : ""}${o.cls ? ` ${o.cls}` : ""}`);
  Object.assign(tag, { follow: obj, baseY: o.baseY, dy: o.dy, dz: o.dz ?? 0.2 });
  gsap.fromTo(tag.el, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 1.0 + k * 0.08 });
  return tag;
}

/** Plain blocks, one for each step. */
export function boxesView(stage: Stage, ctx: ViewCtx): View {
  const parts = stage.parts ?? [];
  const n = parts.length;
  const tags: Tag[] = [];
  const baseY: number[] = [];
  const steps = parts.map((p, k) => {
    const h = 1.1 + (k % 2) * 0.35;
    const obj: THREE.Object3D = p.ghost ? ghostBox(1.25, h, 1.5) : rbox(1.25, h, 1.5, p.c ?? COLOR.ghost, 0.14);
    baseY[k] = 0.35 + h / 2;
    obj.position.set(ctx.x, 1.5, 0);
    obj.scale.setScalar(0.01);
    ctx.scene.add(obj);
    const tx = ctx.x - (n - 1) * 1.2 + k * 2.4, t0 = 0.45 + k * 0.07;
    ctx.tl.to(obj.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(2)" }, t0)
      .to(obj.position, { x: tx, duration: 0.8, ease: "power3.out" }, t0)
      .to(obj.position, { y: baseY[k], duration: 0.8, ease: "bounce.out" }, t0);
    tags.push(stepTag(ctx, p, k, obj, { baseY: baseY[k]!, dy: 2.25 + (k % 2) * 0.35 }));
    return obj;
  });
  const lift = (k: number | null) => steps.forEach((o, j) => gsap.to(o.position, { y: (baseY[j] ?? 0) + (j === k ? 0.45 : 0), duration: 0.4, ease: j === k ? "back.out(3)" : "power2.out" }));
  return {
    steps,
    cam: { zoom: 1.45, tx: ctx.x, ty: 2.0, tz: 0.8 },
    start() {},
    select: (k) => lift(k),
    clear: () => lift(null),
    stop() {},
    close(tl) {
      tags.forEach((t) => ctx.overlay.removeTag(t));
      steps.forEach((o, k) => tl.to(o.position, { x: ctx.x, y: 1.5, duration: 0.5, ease: "power3.in" }, k * 0.04).to(o.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3 }, 0.3 + k * 0.04));
    },
    dispose() { steps.forEach((o) => { gsap.killTweensOf([o.position, o.scale]); ctx.scene.remove(o); disposeTree(o); }); },
    tick() {},
  };
}

/** COLLECT as an assembly line: dock, vault, scanner, stamping press, packing. */
export function assemblyView(stage: Stage, ctx: ViewCtx): View {
  const parts = stage.parts ?? [];
  const root = new THREE.Group();
  ctx.scene.add(root);
  const SX = [-6.4, -3.2, 0, 3.2, 6.4], TY = 0.61; // station x, crate height on the belt
  const sx = (k: number) => SX[k] ?? 0;
  const belt = rbox(15.4, 0.35, 1.3, COLOR.belt, 0.08);
  belt.position.y = 0.18;
  root.add(belt);
  const rolls = rollerRow(-7.4, 7.41, 0, 0.38, 1.34, 0.09);
  root.add(rolls);
  const ringMat = new THREE.MeshBasicMaterial({ color: COLOR.mustard, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 56), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.015, -0.5);
  root.add(ring);

  const stations = parts.map((_, k) => {
    const g = new THREE.Group();
    g.position.x = sx(k);
    root.add(g);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 3.0), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 1.4, -0.6);
    g.add(hit);
    return g;
  });
  const st = (k: number) => stations[k] ?? new THREE.Group();

  // 1. dock: one stack of row crates for each repo
  const REPO = [COLOR.teal, COLOR.indigo, COLOR.terra];
  const tops: THREE.Object3D[] = [];
  {
    const g = st(0);
    const pallet = rbox(2.3, 0.16, 1.3, 0xb98a55, 0.03);
    pallet.position.set(0, 0.08, -1.55);
    g.add(pallet);
    REPO.forEach((c, r) => {
      for (let j = 0; j < 3; j++) {
        const b = rbox(0.5, 0.48, 0.5, c, 0.05);
        b.position.set(-0.72 + r * 0.72, 0.16 + 0.25 + j * 0.5, -1.55);
        g.add(b);
        if (j === 2) tops.push(b);
      }
    });
  }
  // 2. vault: a dial that turns back to the base commit, and a door
  const pivot = new THREE.Group(), hand = new THREE.Group();
  {
    const g = st(1);
    const body = rbox(1.8, 1.9, 1.1, 0x6c6f78, 0.12);
    body.position.set(0, 0.95, -1.4);
    g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 12, 40), mat(COLOR.ink));
    rim.position.set(0, 1.0, -0.84);
    g.add(rim);
    pivot.position.set(-0.6, 1.0, -0.8);
    g.add(pivot);
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 40), mat(0xa9adb6, { metalness: 0.3, roughness: 0.5 }));
    door.rotation.x = Math.PI / 2;
    door.position.set(0.6, 0, 0);
    door.castShadow = true;
    pivot.add(door);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), mat(0xfff1cf));
    face.position.set(0.6, 0, 0.065);
    pivot.add(face);
    hand.position.set(0.6, 0, 0.075);
    pivot.add(hand);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.02), mat(COLOR.terra));
    needle.position.y = 0.1;
    hand.add(needle);
    for (let a = 0; a < 12; a++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.01), mat(COLOR.ink));
      const ang = (a / 12) * Math.PI * 2;
      t.position.set(0.6 + Math.sin(ang) * 0.25, Math.cos(ang) * 0.25, 0.07);
      t.rotation.z = -ang;
      pivot.add(t);
    }
  }
  // 3. scanner arch: a light that sweeps the sheet
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x2fd6c0, transparent: true, opacity: 0, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.1, 1.3), scanMat);
  {
    const g = st(2);
    [-0.95, 0.95].forEach((z) => { const p = rbox(0.24, 2.0, 0.24, COLOR.terra); p.position.set(0, 1.0, z); g.add(p); });
    const beam = rbox(0.4, 0.32, 2.3, COLOR.terra);
    beam.position.y = 2.1;
    g.add(beam);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 1.6), new THREE.MeshStandardMaterial({ color: 0x9ff5e6, emissive: 0x2fd6c0, emissiveIntensity: 1.2 }));
    lamp.position.y = 1.93;
    g.add(lamp);
    scan.position.y = 1.35;
    g.add(scan);
  }
  // 4. stamping press
  const head = new THREE.Group();
  {
    const g = st(3);
    [-0.95, 0.95].forEach((z) => { const c = rbox(0.24, 2.7, 0.24, COLOR.ink); c.position.set(0, 1.35, z); g.add(c); });
    const top = rbox(0.5, 0.36, 2.3, COLOR.ink);
    top.position.y = 2.7;
    g.add(top);
    head.position.y = 2.05;
    g.add(head);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 14), mat(COLOR.steel, { metalness: 0.5, roughness: 0.3 }));
    rod.position.y = 0.6;
    head.add(rod);
    head.add(rbox(0.95, 0.24, 0.95, COLOR.steel, 0.05, { metalness: 0.3 }));
    const face = rbox(0.85, 0.06, 0.85, COLOR.mustard, 0.02);
    face.position.y = -0.14;
    head.add(face);
  }
  // 5. packing: the answer-key shelf
  const slots: THREE.Mesh[] = [];
  let packed = 0;
  {
    const g = st(4);
    [-1.05, 1.05].forEach((x) => { const p = rbox(0.12, 2.3, 0.75, 0xb98a55, 0.03); p.position.set(x, 1.15, -1.55); g.add(p); });
    [0.45, 1.15, 1.85].forEach((y) => { const b = rbox(2.2, 0.08, 0.78, 0xc99c62, 0.02); b.position.set(0, y, -1.55); g.add(b); });
    const backboard = rbox(2.2, 2.3, 0.05, 0xe2c79a, 0.02);
    backboard.position.set(0, 1.15, -1.92);
    g.add(backboard);
    [0.45, 1.15, 1.85].forEach((y) => {
      for (let c = 0; c < 5; c++) {
        const m = rbox(0.3, 0.3, 0.3, COLOR.mustard, 0.04);
        m.position.set(-0.76 + c * 0.38, y + 0.19, -1.55);
        m.visible = false;
        g.add(m);
        slots.push(m);
      }
    });
  }

  // the task crate and what it carries
  const task = new THREE.Group();
  task.position.set(sx(0), TY, 0);
  root.add(task);
  const crate = rbox(0.7, 0.5, 0.7, COLOR.teal, 0.06);
  task.add(crate);
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.62), mat(COLOR.paper));
  sheet.position.y = 0.26;
  task.add(sheet);
  const STRIPE_Z = [-0.18, 0.02, 0.14];
  const stripes = STRIPE_Z.map((z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.05), mat(COLOR.terra, { emissive: COLOR.terra, emissiveIntensity: 0.3 }));
    m.position.set(0, 0.015, z);
    sheet.add(m);
    return m;
  });
  const cls = new THREE.Group();
  cls.position.y = 0.5;
  task.add(cls);
  const clsGeo = new THREE.BoxGeometry(0.62, 0.4, 0.58);
  const clsBoxMat = new THREE.MeshStandardMaterial({ color: COLOR.terra, transparent: true, opacity: 0.22, depthWrite: false });
  const clsEdgeMat = new THREE.LineBasicMaterial({ color: COLOR.terra });
  cls.add(new THREE.Mesh(clsGeo, clsBoxMat), new THREE.LineSegments(new THREE.EdgesGeometry(clsGeo), clsEdgeMat));
  const fnA = rbox(0.24, 0.22, 0.22, COLOR.paper, 0.04);
  fnA.position.set(0.13, -0.05, -0.08);
  cls.add(fnA);
  const fnB = rbox(0.2, 0.18, 0.2, COLOR.paper, 0.04);
  fnB.position.set(-0.16, -0.07, 0.1);
  cls.add(fnB);
  const check = new THREE.Group();
  check.position.set(0, 0.95, 0.2);
  task.add(check);
  {
    const cm = mat(0x2f8f5a, { emissive: 0x2f8f5a, emissiveIntensity: 0.4 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), cm);
    a.position.set(-0.08, -0.03, 0);
    a.rotation.z = 0.8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.08), cm);
    b.position.set(0.07, 0.05, 0);
    b.rotation.z = -0.6;
    check.add(a, b);
  }
  const sparks = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd35a, transparent: true, opacity: 0 }));
    root.add(m);
    return m;
  });
  const GOLD = COLOR.mustard, WHITE = COLOR.paper, TERRA = COLOR.terra;
  let trip = 0;
  let counter: HTMLElement | null = null;

  // the state of the crate when it arrives at station k
  function prepare(k: number) {
    task.visible = true;
    task.scale.setScalar(1);
    task.position.set(sx(k), TY, 0);
    sheet.visible = k >= 2;
    stripes.forEach((m, j) => { m.visible = k >= 3; m.position.z = STRIPE_Z[j] ?? 0; });
    cls.visible = k >= 4;
    cls.scale.setScalar(1);
    cls.position.y = 0.5;
    fnA.material.color.setHex(k >= 4 ? GOLD : WHITE);
    fnA.material.emissive.setHex(k >= 4 ? 0x7a5400 : 0x000000);
    clsEdgeMat.color.setHex(k >= 4 ? GOLD : TERRA);
    clsBoxMat.color.setHex(k >= 4 ? GOLD : TERRA);
    check.visible = false;
    tops.forEach((t) => (t.visible = true));
    pivot.rotation.y = 0;
    hand.rotation.z = 0;
    scanMat.opacity = 0;
    head.position.y = 2.05;
    sheet.position.set(0, 0.26, 0);
  }
  const ACT: (() => gsap.core.Timeline)[] = [
    () => { // dock: take the next repo's stack (round-robin, as in balanced_order)
      const r = trip++ % 3, top = tops[r];
      return gsap.timeline()
        .add(() => { crate.material.color.setHex(REPO[r] ?? COLOR.teal); if (top) top.visible = false; task.position.set(sx(0) - 0.72 + r * 0.72, 1.42, -1.55); task.scale.setScalar(0.72); })
        .to(task.position, { y: 2.0, duration: 0.35, ease: "power2.out" })
        .to(task.position, { x: sx(0), z: 0, duration: 0.55, ease: "power1.inOut" })
        .to(task.scale, { x: 1, y: 1, z: 1, duration: 0.4 }, "<")
        .to(task.position, { y: TY, duration: 0.45, ease: "bounce.out" })
        .add(() => { if (top) top.visible = true; }, "+=0.2");
    },
    () => // vault: the dial turns back in time, the door opens, the base file comes out
      gsap.timeline()
        .to(hand.rotation, { z: Math.PI * 4, duration: 1.0, ease: "power2.inOut" })
        .to(pivot.rotation, { y: -1.45, duration: 0.45, ease: "back.out(1.6)" })
        .add(() => { sheet.visible = true; sheet.position.set(0, 0.4, -0.75); })
        .to(sheet.position, { y: 0.75, duration: 0.25, ease: "power2.out" })
        .to(sheet.position, { z: 0, duration: 0.35 })
        .to(sheet.position, { y: 0.26, duration: 0.3, ease: "bounce.out" })
        .to(pivot.rotation, { y: 0, duration: 0.4, ease: "power2.in" }),
    () => { // scanner: a sweep, then the changed lines light up; one hunk slides to its real place
      const s0 = stripes[0]!, s1 = stripes[1]!, s2 = stripes[2]!;
      return gsap.timeline()
        .to(scanMat, { opacity: 0.45, duration: 0.15 })
        .fromTo(scan.position, { x: -0.55 }, { x: 0.55, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: 1 })
        .add(() => { s1.visible = true; s2.visible = true; }, 0.6)
        .add(() => { s0.visible = true; s0.position.z = 0.26; }, 0.9)
        .to(s0.position, { z: -0.18, duration: 0.5, ease: "back.out(1.4)" }, 1.25)
        .to(scanMat, { opacity: 0, duration: 0.2 });
    },
    () => // press: class and function boxes rise; the press stamps the innermost one gold
      gsap.timeline()
        .add(() => { cls.visible = true; })
        .fromTo(cls.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: "back.out(2)" })
        .fromTo(cls.position, { y: 0.3 }, { y: 0.5, duration: 0.45 }, "<")
        .to(head.position, { y: 1.33, duration: 0.22, ease: "power3.in" }, "+=0.25")
        .add(() => {
          fnA.material.color.setHex(GOLD);
          fnA.material.emissive.setHex(0x7a5400);
          clsEdgeMat.color.setHex(GOLD);
          clsBoxMat.color.setHex(GOLD);
          sparks.forEach((sp, j) => {
            const a = (j / sparks.length) * Math.PI * 2;
            sp.position.set(sx(3), TY + 0.7, 0);
            sp.material.opacity = 1;
            gsap.to(sp.position, { x: sx(3) + Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, y: TY + 0.9, duration: 0.5, ease: "power2.out" });
            gsap.to(sp.material, { opacity: 0, duration: 0.5, ease: "power1.in" });
          });
        })
        .to(task.scale, { y: 0.9, duration: 0.08, yoyo: true, repeat: 1 })
        .to(head.position, { y: 2.05, duration: 0.5, ease: "power2.out" }, "+=0.05"),
    () => { // packing: validate (check mark), then the task goes on the shelf
      const slot = slots[packed % slots.length]!;
      return gsap.timeline()
        .add(() => { check.visible = true; })
        .fromTo(check.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: "back.out(3)" })
        .to(cls.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3 }, "+=0.3")
        .add(() => { check.visible = false; })
        .to(task.position, { y: 2.3, duration: 0.35, ease: "power2.out" })
        .to(task.position, { x: sx(4) + slot.position.x, z: slot.position.z, duration: 0.5 })
        .to(task.scale, { x: 0.43, y: 0.43, z: 0.43, duration: 0.5 }, "<")
        .to(task.position, { y: slot.position.y, duration: 0.3, ease: "bounce.out" })
        .add(() => {
          if (packed % slots.length === 0) slots.forEach((m) => (m.visible = false));
          slot.visible = true;
          slot.material = crate.material.clone();
          task.visible = false;
          packed++;
          if (counter) counter.textContent = `${Math.min(packed, 50)} of 50 tasks`;
        });
    },
  ];

  // run modes: the full loop, or one station on repeat. A token stops old runs.
  let token = 0;
  let cur: gsap.core.Timeline | null = null;
  let wait: gsap.core.Tween | null = null;
  const halt = () => { token++; cur?.kill(); wait?.kill(); };
  function play(k: number | null) {
    halt();
    const my = token;
    const next = () => {
      if (my !== token) return;
      const t = gsap.timeline({ onComplete: () => { if (my === token) wait = gsap.delayedCall(k === null ? 0.3 : 0.9, next); } });
      if (k === null) {
        t.add(() => prepare(0)).add(ACT[0]!());
        for (let j = 1; j < 5; j++) t.to(task.position, { x: sx(j), duration: 0.9, ease: "power1.inOut" }, "+=0.2").add(ACT[j]!());
      } else {
        t.add(() => prepare(k)).add(ACT[k]!());
      }
      cur = t;
    };
    next();
  }

  // build-up animation when the stage opens
  belt.scale.x = 0.01;
  rolls.scale.x = 0.01;
  task.visible = false;
  ctx.tl.to([belt.scale, rolls.scale], { x: 1, duration: 0.6, ease: "power3.out" }, 0.45);
  stations.forEach((g, k) => { g.scale.setScalar(0.01); ctx.tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "back.out(1.8)" }, 0.6 + k * 0.1); });
  // labels stand on the floor in front of the belt, so they never cover a station
  const tags = stations.map((g, k) => stepTag(ctx, parts[k]!, k, g, { baseY: 0, dy: 0, dz: 0.85, cls: "below", extra: k === 4 ? `<small class="ctr">0 of 50 tasks</small>` : "" }));
  counter = tags[4]?.el.querySelector(".ctr") ?? null;

  return {
    steps: stations,
    cam: { zoom: 1.42, tx: 0, ty: 1.3, tz: 0.4 },
    start() { prepare(0); play(null); },
    select(k) {
      ring.position.x = sx(k);
      gsap.fromTo(ring.scale, { x: 0.8, y: 0.8 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(2)" });
      gsap.to(ringMat, { opacity: 0.9, duration: 0.25 });
      halt();
      gsap.to(task.position, { x: sx(k), y: TY, z: 0, duration: 0.5, onComplete: () => play(k) });
    },
    clear() { gsap.to(ringMat, { opacity: 0, duration: 0.25 }); play(null); },
    stop: halt,
    close(tl) {
      tags.forEach((t) => ctx.overlay.removeTag(t));
      tl.to(root.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, ease: "back.in(1.5)" }, 0);
    },
    dispose() {
      halt();
      root.traverse((o) => gsap.killTweensOf([o.position, o.scale, o.rotation]));
      ctx.scene.remove(root);
      disposeTree(root);
    },
    tick(dt) { spinRollers(rolls, dt); },
  };
}
