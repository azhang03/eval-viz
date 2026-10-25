// What a stage turns into when you open it (viz decision 10): the shared view types, step labels,
// and plain blocks for a stage without its own line. The lines are collectView.ts, runView.ts,
// and scoreView.ts.
import * as THREE from "three";
import { esc } from "../lib/esc";
import { gsap } from "gsap";
import { STAGES, stepLabel, type Part, type Stage } from "../../content/stages";
import { COLOR, disposeTree, ghostBox, rbox } from "./kit";
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

export type ViewCtx = {
  scene: THREE.Scene; overlay: Overlay; x: number; tl: gsap.core.Timeline;
  /** The step that plays now and its text, for the rail (null: none). */
  live: (step: number | null, html: string) => void;
};


export function stepTag(ctx: ViewCtx, p: Part, k: number, obj: THREE.Object3D, o: { baseY: number; dy: number; dz?: number; cls?: string; extra?: string }): Tag {
  const stage = STAGES.find((s) => s.parts?.includes(p));
  const label = stage ? stepLabel(stage, k) : String(k + 1);
  const tag = ctx.overlay.addTag(`${label}. ${esc(p.n)}${p.ghost ? "<small>planned</small>" : ""}${o.extra ?? ""}`, new THREE.Vector3(), `part${p.ghost ? " ghost" : ""}${o.cls ? ` ${o.cls}` : ""}`);
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
