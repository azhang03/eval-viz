// The 3D floor of page 1: the pipeline as machines on one line (viz decision 5 and 10).
// Plain three.js. React gives it a host element and calls sync() with the page state; the
// scene reports clicks and hovers through the handlers. A queue runs one open or close at a
// time, so fast clicks never overlap two animations.
import * as THREE from "three";
import { esc } from "../lib/esc";
import { gsap } from "gsap";
import type { Part, Stage } from "../../content/stages";
import { COLOR, disposeTree, ghostBox, mat, rbox, rollerRow, rounded, spinRollers } from "./kit";
import { Overlay, type Tag } from "./overlay";
import { boxesView, type Cam, type View } from "./views";
import { collectView } from "./collectView";
import { runView } from "./runView";
import { scoreView } from "./scoreView";

export type FloorHandlers = {
  openStage: (id: Stage["id"]) => void;
  selectStep: (k: number) => void;
  /** Files to light in the explorer while the mouse is over a machine or a step (null: none). */
  hoverFiles: (files: string[] | null) => void;
  /** The step that an opened line plays now, and its text (null: none). */
  live: (step: number | null, html: string) => void;
};

export type FloorState = { opened: Stage["id"] | null; step: number | null };

const X = [-7.5, -2.5, 2.5, 7.5]; // machine x, in stage order
const HOME: Cam = { zoom: 1, tx: 0.6, ty: 1.6, tz: 0.6 };
const statusText = (s: Stage) => (s.status === "partial" ? "being built" : s.status);
const filesOf = (p: Part) => (p.use ?? []).map(([f]) => f);
const shortFile = (f: string) => f.split("/").pop() ?? f;

type Machine = { stage: Stage; i: number; group: THREE.Group; hit: THREE.Mesh; lamp?: THREE.MeshStandardMaterial; load?: THREE.Object3D;
  /** Roof props: the RUN plug slides in and out of its socket; the SCORE magnifier glints. */
  plug?: THREE.Object3D; glass?: THREE.MeshStandardMaterial };

export class FloorScene {
  private renderer: THREE.WebGLRenderer;
  private rollers: THREE.InstancedMesh | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private camDir = new THREE.Vector3(0.42, 0.78, 1).normalize();
  private cam = { ...HOME, yaw: 0 };
  private overlay: Overlay;
  private machines: Machine[] = [];
  private homeTags: Tag[] = [];
  private beltBuilt = new THREE.Group();
  private beltPlan: THREE.Group;
  private crates: { mesh: THREE.Mesh; t: number; x0: number; x1: number }[] = [];
  private puffs: { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>; t: number }[] = [];
  private view: View | null = null;
  private shown: FloorState = { opened: null, step: null };
  private target: FloorState = { opened: null, step: null };
  private busy = false;
  private hovered: THREE.Object3D | null = null;
  private drag: { x: number; yaw: number; moved: boolean } | null = null;
  private raf = 0;
  private timer = new THREE.Timer();
  private resizeObserver: ResizeObserver;
  private ray = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private alive = true;

  constructor(private host: HTMLElement, overlayRoot: HTMLElement, private stages: Stage[], private on: FloorHandlers) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.prepend(this.renderer.domElement);
    this.overlay = new Overlay(overlayRoot, host, this.camera);

    this.buildWorld();
    this.beltPlan = this.buildBelts();
    this.buildMachines();
    this.buildHomeTags();

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerleave", this.onLeave);
    window.addEventListener("pointerup", this.onUp);
    this.resizeObserver = new ResizeObserver(this.resize); // also follows the moving split
    this.resizeObserver.observe(host);
    this.resize();

    // intro: the machines drop onto the floor
    this.machines.forEach((m, i) => gsap.from(m.group.position, { y: 6, duration: 0.9, delay: 0.15 + i * 0.12, ease: "bounce.out" }));
    gsap.from(this.cam, { zoom: 0.75, yaw: -0.35, duration: 1.6, ease: "power3.out", onUpdate: this.placeCamera });
    this.tick();
  }

  // ---------- world ----------

  private buildWorld() {
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb8a58c, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12 });
    sun.shadow.radius = 6;
    this.scene.add(sun);
    const floor = new THREE.Mesh(rounded(23, 0.6, 8, 4, 0.25), mat(COLOR.floor));
    floor.position.y = -0.3;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const pts: number[] = [];
    for (let x = -11; x <= 11; x += 1.5) pts.push(x, 0.002, -3.9, x, 0.002, 3.9);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COLOR.tile })));
  }

  /** A solid belt under the built machines, then a dashed ghost belt to the planned ones. */
  private buildBelts(): THREE.Group {
    const lastBuilt = this.stages.reduce((last, s, i) => (s.status === "built" ? i : last), 0);
    const x0 = -10, x1 = (X[lastBuilt] ?? 0) + 1.9;
    const belt = rbox(x1 - x0, 0.35, 1.3, COLOR.belt, 0.08);
    belt.position.set((x0 + x1) / 2, 0.18, 0);
    this.beltBuilt.add(belt);
    this.rollers = rollerRow(x0 + 0.4, x1 - 0.3, 0, 0.38, 1.34, 0.09);
    this.beltBuilt.add(this.rollers);
    this.scene.add(this.beltBuilt);
    const planEnd = 10.2;
    const plan = ghostBox(planEnd - x1, 0.35, 1.3);
    plan.position.set((x1 + planEnd) / 2, 0.18, 0);
    if (lastBuilt < this.stages.length - 1 && x1 < planEnd - 0.5) this.scene.add(plan);  // no planned stage: no ghost belt
    // crates travel between each pair of built machines
    const crateGeo = rounded(0.62, 0.5, 0.62, 2, 0.06);
    for (let i = 0; i + 1 < this.stages.length; i++) {
      if (this.stages[i]?.status !== "built" || this.stages[i + 1]?.status !== "built") continue;
      const a = (X[i] ?? 0) + 1.5, b = (X[i + 1] ?? 0) - 1.5;
      for (let k = 0; k < 3; k++) {
        const mesh = new THREE.Mesh(crateGeo, mat(i === 0 ? COLOR.mustard : COLOR.teal));
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.crates.push({ mesh, t: k / 3, x0: a, x1: b });
      }
    }
    for (let k = 0; k < 6; k++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 1 }));
      this.scene.add(mesh);
      this.puffs.push({ mesh, t: k / 6 });
    }
    return plan;
  }

  private buildMachines() {
    this.stages.forEach((stage, i) => {
      const group = new THREE.Group();
      group.position.set(X[i] ?? 0, 0, 0);
      const m: Machine = { stage, i, group, hit: new THREE.Mesh() };
      if (stage.status === "built") {
        const body = rbox(3, 2.3, 2.6, stage.color ?? COLOR.terra, 0.22);
        body.position.y = 1.5;
        const roof = rbox(3.2, 0.3, 2.8, COLOR.ink, 0.1);
        roof.position.y = 2.8;
        const mouth = rbox(0.2, 0.9, 1.4, 0x1d1a17, 0.05);
        mouth.position.set(1.45, 0.85, 0);
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x7dff9a, emissive: 0x3dff6a, emissiveIntensity: 1.6 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), lampMat);
        lamp.position.set(-0.9, 3.05, 0.9);
        const win = rbox(1.4, 0.7, 0.08, 0xfff1cf, 0.04, { emissive: 0xffd88a, emissiveIntensity: 0.35 });
        win.position.set(-0.2, 1.9, 1.31);
        group.add(body, roof, mouth, lamp, win);
        m.lamp = lampMat;
        if (stage.id === "collect") {
          const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.0, 16), mat(COLOR.ink));
          chim.position.set(0.8, 3.4, -0.6);
          chim.castShadow = true;
          group.add(chim);
        }
        if (stage.id === "run") {
          // a wall socket on the roof, and a plug with two prongs and a cord (bright prongs: they
          // stand in front of the dark roof from the camera)
          const plate = rbox(0.16, 1.05, 1.05, COLOR.paper, 0.06);
          plate.position.set(-0.1, 3.48, -0.3);
          const holes = [-0.2, 0.2].map((z) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.09), mat(0x1d1a17)); h.position.set(-0.01, 3.5, -0.3 + z); return h; });
          const plug = new THREE.Group();
          plug.position.set(0.62, 3.5, -0.3);
          plug.add(rbox(0.46, 0.58, 0.7, COLOR.mustard, 0.1));
          [-0.2, 0.2].forEach((z) => { const pr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), mat(0xeef0f4, { metalness: 0.2, roughness: 0.3, emissive: 0x6a6c70 })); pr.position.set(-0.43, 0, z); pr.castShadow = true; plug.add(pr); });
          const down = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.1), mat(COLOR.ink)); down.position.set(0.18, -0.45, 0);
          const along = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.1), mat(COLOR.ink)); along.position.set(0.53, -0.6, 0);
          plug.add(down, along);
          group.add(plate, ...holes, plug);
          m.plug = plug;
        }
        if (stage.id === "score") {
          // a magnifier sign on the roof
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 12, 32), mat(COLOR.ink));
          ring.position.set(0.5, 3.55, -0.4);
          const glassMat = new THREE.MeshStandardMaterial({ color: 0x9ff5e6, transparent: true, opacity: 0.55, emissive: 0x2fd6c0, emissiveIntensity: 0.25 });
          const glass = new THREE.Mesh(new THREE.CircleGeometry(0.38, 32), glassMat);
          glass.position.set(0.5, 3.55, -0.39);
          const handle = rbox(0.16, 0.6, 0.16, COLOR.mustard, 0.05);
          handle.position.set(0.85, 3.05, -0.4);
          handle.rotation.z = 0.7;
          group.add(ring, glass, handle);
          m.glass = glassMat;
        }
      } else {
        const gb = ghostBox(3, 2.3, 2.6);
        gb.position.y = 1.5;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.04, 3), new THREE.MeshBasicMaterial({ color: COLOR.ghost, transparent: true, opacity: 0.12 }));
        pad.position.y = 0.02;
        group.add(gb, pad);
        if (stage.status === "partial") {
          // under construction: part of the stage exists (a teal block), plus a small crane
          const block = rbox(1.1, 1.0, 1.5, COLOR.teal, 0.12);
          block.position.set(-0.9, 0.85, 0);
          const mast = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), mat(COLOR.mustard));
          mast.position.set(1.2, 1.7, -1.0);
          const jib = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), mat(COLOR.mustard));
          jib.position.set(0.4, 3.4, -1.0);
          const load = rbox(0.5, 0.35, 0.5, COLOR.indigo, 0.05);
          load.position.set(-0.4, 2.2, -1.0);
          group.add(block, mast, jib, load);
          m.load = load;
        }
      }
      const hit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 2.8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.7;
      group.add(hit);
      m.hit = hit;
      this.scene.add(group);
      this.machines.push(m);
    });
  }

  private buildHomeTags() {
    const o = this.overlay;
    this.stages.forEach((s, i) => {
      this.homeTags.push(o.addTag(`${esc(s.name)}<small>${esc(s.feat)} . ${statusText(s)}</small>`, new THREE.Vector3(X[i] ?? 0, 4.4, 0), s.status === "built" ? "" : "ghost"));
      const next = this.stages[i + 1];
      if (s.status === "built" && next) {
        // what the stage ships: a floor sign in front of the belt, between it and the next machine
        const mid = ((X[i] ?? 0) + (X[i + 1] ?? 0)) / 2;
        this.homeTags.push(o.addTag(`<small>ships</small><small><b class="ink">${esc(s.out)}</b></small>`, new THREE.Vector3(mid, 0.3, 1.1), "below"));
      } else if (s.status !== "built") {
        this.homeTags.push(o.addTag(`<small>${esc(s.out)}</small>`, new THREE.Vector3((X[i] ?? 0) + 1.3, 0.2, 2.1), "ghost"));
      }
    });
  }

  // ---------- camera and frame ----------

  private placeCamera = () => {
    const d = this.camDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cam.yaw);
    const t = new THREE.Vector3(this.cam.tx, this.cam.ty, this.cam.tz);
    this.camera.position.copy(t).addScaledVector(d, 40);
    this.camera.lookAt(t);
    this.camera.zoom = this.cam.zoom;
    this.camera.updateProjectionMatrix();
  };

  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    const a = w / h, view = Math.max(11, Math.min(14, 27 / a));
    Object.assign(this.camera, { left: (-view * a) / 2, right: (view * a) / 2, top: view / 2, bottom: -view / 2 });
    this.renderer.setSize(w, h);
    this.placeCamera();
    // setSize clears the canvas: draw now, not on the next frame, or the floor flickers
    this.renderer.render(this.scene, this.camera);
    this.overlay.placeTags();
  };

  /**
   * While a look-closer view covers the floor, the floor stops drawing: it is under a blur and
   * cannot be read, and each new frame would make the browser blur it again. The animations keep
   * their time, so the floor goes on from the right place when the view closes.
   */
  setCovered(covered: boolean): void {
    if (this.covered === covered) return;
    this.covered = covered;
    if (!covered) { this.renderer.render(this.scene, this.camera); this.overlay.placeTags(); }
  }
  private covered = false;

  private tick = () => {
    if (!this.alive) return;
    if (this.covered) { this.timer.update(); this.raf = requestAnimationFrame(this.tick); return; }
    this.timer.update();
    const dt = this.timer.getDelta(), t = this.timer.getElapsed();
    const open = this.shown.opened !== null || this.busy;
    for (const c of this.crates) {
      c.t = (c.t + dt * 0.22) % 1;
      const s = c.t > 0.8 ? Math.max(0.01, 1 - (c.t - 0.8) * 5) : c.t < 0.08 ? c.t / 0.08 : 1;
      c.mesh.position.set(c.x0 + c.t * (c.x1 - c.x0), 0.62, 0);
      c.mesh.scale.setScalar(open ? 0.01 : s);
    }
    if (this.rollers) spinRollers(this.rollers, dt);
    const chimneyX = (X[this.stages.findIndex((s) => s.id === "collect")] ?? X[0]!) + 0.8; // the puffs come out of COLLECT's chimney
    for (const p of this.puffs) {
      p.t = (p.t + dt * 0.35) % 1;
      p.mesh.position.set(chimneyX + p.t * 0.6, 3.9 + p.t * 2.2, -0.6 - p.t * 0.3);
      p.mesh.scale.setScalar((0.5 + p.t * 1.4) * (open ? 0.01 : 1));
      p.mesh.material.opacity = 0.75 * (1 - p.t);
    }
    this.machines.forEach((m, i) => {
      if (m.lamp) m.lamp.emissiveIntensity = 1.1 + Math.sin(t * 4 + i) * 0.6;
      if (m.load) m.load.position.y = 2.2 + Math.sin(t * 1.3) * 0.25;
      if (m.plug) m.plug.position.x = 0.5 + Math.max(0, Math.sin(t * 1.6)) * 0.6; // out (prongs show), then back in
      if (m.glass) m.glass.emissiveIntensity = 0.25 + Math.max(0, Math.sin(t * 2.2)) * 0.5;
    });
    this.view?.tick(dt);
    this.renderer.render(this.scene, this.camera);
    this.overlay.placeTags();
    this.raf = requestAnimationFrame(this.tick);
  };

  // ---------- state ----------

  /** Bring the floor to this state. Opens and closes run one at a time. */
  sync(state: FloorState): void {
    this.target = state;
    void this.pump();
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.alive) {
        const t = this.target;
        if (t.opened !== this.shown.opened) {
          if (this.shown.opened !== null) await this.close();
          else if (t.opened !== null) await this.open(t.opened);
          continue;
        }
        if (t.step !== this.shown.step) {
          this.showStep(t.step);
          continue;
        }
        break;
      }
    } finally {
      this.busy = false;
    }
  }

  private async open(id: Stage["id"]) {
    const i = this.stages.findIndex((s) => s.id === id);
    const m = this.machines[i];
    const stage = this.stages[i];
    if (!m || !stage?.parts) { this.shown = { opened: id, step: null }; return; }
    this.overlay.hideBubble();
    this.unhover();
    this.machines.forEach((x) => (x.group.visible = x === m));
    this.beltPlan.visible = false;
    const tl = gsap.timeline();
    const ctx = { scene: this.scene, overlay: this.overlay, x: X[i] ?? 0, tl, live: this.on.live };
    const make = { collect: collectView, run: runView, score: scoreView }[stage.id as string] ?? boxesView;
    this.view = make(stage, ctx);
    tl.to(this.cam, { ...this.view.cam, yaw: 0, duration: 1.1, ease: "power3.inOut", onUpdate: this.placeCamera }, 0)
      .to(m.group.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.45, ease: "back.in(2)" }, 0.1)
      .add(() => { this.beltBuilt.visible = false; }, 0.4)
      .to(this.homeTags.map((t) => t.el), { opacity: 0, duration: 0.3 }, 0);
    this.shown = { opened: id, step: null };
    await tl;
    if (this.alive && this.shown.opened === id) this.view?.start();
  }

  private async close() {
    const i = this.stages.findIndex((s) => s.id === this.shown.opened);
    const m = this.machines[i];
    const v = this.view;
    this.overlay.hideBubble();
    this.unhover();
    v?.stop();
    const tl = gsap.timeline();
    v?.close(tl);
    if (m) tl.to(m.group.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, 0.55);
    tl.to(this.cam, { ...HOME, duration: 1.0, ease: "power3.inOut", onUpdate: this.placeCamera }, 0.3)
      .to(this.homeTags.map((t) => t.el), { opacity: 1, duration: 0.4 }, 0.9)
      .add(() => { this.machines.forEach((x) => (x.group.visible = true)); this.beltPlan.visible = true; this.beltBuilt.visible = true; }, 0.5);
    await tl;
    v?.dispose();
    if (this.view === v) this.view = null;
    this.shown = { opened: null, step: null };
  }

  private showStep(k: number | null) {
    this.shown = { ...this.shown, step: k };
    const tags = this.overlay.root.querySelectorAll<HTMLElement>(".tag.part");
    tags.forEach((el, j) => el.classList.toggle("sel", j === k));
    if (k === null) this.view?.clear();
    else this.view?.select(k);
  }

  // ---------- pointer ----------

  private pick(e: PointerEvent): { machine?: Machine; step?: number } | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    if (this.shown.opened === null && !this.busy) {
      const hit = this.ray.intersectObjects(this.machines.map((m) => m.hit), false)[0];
      const machine = hit && this.machines.find((m) => m.hit === hit.object);
      return machine ? { machine } : null;
    }
    const steps = this.view?.steps ?? [];
    const hit = this.ray.intersectObjects(steps, true)[0];
    if (!hit) return null;
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
      const k = steps.indexOf(o);
      if (k >= 0) return { step: k };
    }
    return null;
  }

  private onDown = (e: PointerEvent) => { this.drag = { x: e.clientX, yaw: this.cam.yaw, moved: false }; };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || e.target !== this.renderer.domElement) return;
    const p = this.pick(e);
    if (p?.machine?.stage.parts && this.shown.opened === null) this.on.openStage(p.machine.stage.id);
    else if (p?.step !== undefined && this.shown.opened !== null) {
      this.overlay.hideBubble();
      this.on.selectStep(p.step);
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      if (Math.abs(dx) > 4) {
        this.drag.moved = true;
        this.cam.yaw = Math.max(-0.7, Math.min(0.7, this.drag.yaw - dx * 0.004));
        this.placeCamera();
        this.overlay.hideBubble();
      }
      return;
    }
    const p = this.pick(e);
    const obj = p?.machine?.group ?? (p?.step !== undefined ? this.view?.steps[p.step] : undefined) ?? null;
    if (obj === this.hovered) return;
    this.unhover();
    this.hovered = obj;
    this.renderer.domElement.style.cursor = obj ? "pointer" : "default";
    if (!obj || !p) { this.overlay.hideBubble(); this.on.hoverFiles(null); return; }
    if (p.machine) {
      const s = p.machine.stage;
      gsap.to(obj.position, { y: 0.25, duration: 0.35, ease: "back.out(3)" });
      this.on.hoverFiles([...new Set((s.parts ?? []).flatMap(filesOf))]);
      this.overlay.showBubble(`<b>${esc(s.name)}</b><div class="meta">${esc(s.feat)} . ${statusText(s)} . writes ${esc(s.out)}</div>${s.text}${s.parts ? "<br><i>Click to open.</i>" : ""}`, p.machine.hit);
    } else if (p.step !== undefined) {
      const stage = this.stages.find((s) => s.id === this.shown.opened);
      const part = stage?.parts?.[p.step];
      if (!part) return;
      this.on.hoverFiles(filesOf(part));
      const meta = part.use ? filesOf(part).map(shortFile).join(" + ") : "planned";
      this.overlay.showBubble(`<b>${esc(part.n)}</b><div class="meta">${esc(meta)}</div>${part.d}`, obj);
    }
  };

  private onLeave = () => {
    this.unhover();
    this.overlay.hideBubble();
    this.on.hoverFiles(null);
  };

  private unhover() {
    const h = this.hovered;
    if (h && this.machines.some((m) => m.group === h)) gsap.to(h.position, { y: 0, duration: 0.3 });
    this.hovered = null;
    this.renderer.domElement.style.cursor = "default";
  }

  /** Screen center of a machine or a step, relative to the host. Tests use it to aim the mouse. */
  centerOf(target: { stage?: Stage["id"]; step?: number }): [number, number] | null {
    const obj = target.stage ? this.machines.find((m) => m.stage.id === target.stage)?.hit : target.step !== undefined ? this.view?.steps[target.step] : undefined;
    if (!obj) return null;
    const b = this.overlay.screenBox(obj);
    return [b.cx, b.cy];
  }

  // ---------- cleanup ----------

  dispose(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerleave", this.onLeave);
    window.removeEventListener("pointerup", this.onUp);
    this.view?.dispose();
    gsap.killTweensOf(this.cam);
    this.scene.traverse((o) => gsap.killTweensOf([o.position, o.scale, o.rotation]));
    this.overlay.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }
}
