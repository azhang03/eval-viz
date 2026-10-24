// Shared parts of the RUN and SCORE lines: the caption bar, readout notes, and motion helpers.
import * as THREE from "three";
import { gsap } from "gsap";
import { readTime } from "../lib/pace";
import { COLOR, rbox } from "./kit";
import type { Overlay, Tag } from "./overlay";

/**
 * The caption bar under an opened line. It names each phase in plain words (viz decision 23).
 * A phase lasts at least as long as its caption takes to read: say() pads the phase before it,
 * then starts a new one; hold() pads the last phase of a timeline.
 */
export class Caption {
  readonly el: HTMLDivElement;
  private phase = new WeakMap<gsap.core.Timeline, { start: number; need: number }>();

  constructor(root: HTMLElement, intro: string) {
    this.el = document.createElement("div");
    this.el.className = "caption";
    this.el.innerHTML = intro;
    root.appendChild(this.el);
  }

  hold(t: gsap.core.Timeline): gsap.core.Timeline {
    const p = this.phase.get(t);
    if (p && p.need) {
      const used = t.duration() - p.start;
      if (used < p.need) t.to({}, { duration: p.need - used });
      p.need = 0;
    }
    return t;
  }

  say(t: gsap.core.Timeline, html: string, at?: gsap.Position): gsap.core.Timeline {
    this.hold(t);
    t.add(() => {
      this.el.innerHTML = html;
      gsap.fromTo(this.el, { y: 6 }, { y: 0, duration: 0.25, ease: "power2.out" });
    }, at);
    this.phase.set(t, { start: t.duration(), need: readTime(html) });
    return t;
  }

  remove(): void { this.el.remove(); }
}

/** A short readout with real values. Only the CSS class "off" hides it, never GSAP. */
export function note(overlay: Overlay, tags: Tag[], pos: THREE.Vector3, cls = ""): Tag {
  const t = overlay.addTag("", pos, `note off ${cls}`.trim());
  tags.push(t);
  return t;
}
export function setNote(t: Tag, html: string): void { t.el.innerHTML = html; t.el.classList.remove("off"); }
export function hideNote(t: Tag): void { t.el.classList.add("off"); }

/** A small label that follows an object. */
export function mini(overlay: Overlay, tags: Tag[], html: string, follow: THREE.Object3D, dy: number, dz = 0): Tag {
  const t = overlay.addTag(html, new THREE.Vector3(), "mini");
  Object.assign(t, { follow, baseY: 0, dy, dz });
  tags.push(t);
  return t;
}

/**
 * Move an object along an arc, as its own small timeline, so GSAP reads the start position when
 * the arc runs, not when it is built.
 */
export function arc(obj: THREE.Object3D, to: THREE.Vector3, h: number, dur: number): gsap.core.Timeline {
  return gsap.timeline()
    .to(obj.position, { x: to.x, z: to.z, duration: dur, ease: "power1.inOut" }, 0)
    .to(obj.position, { y: to.y + h, duration: dur / 2, ease: "power2.out" }, 0)
    .to(obj.position, { y: to.y, duration: dur / 2, ease: "power2.in" }, dur / 2);
}

/** A straight move, as its own small timeline. */
export function move(obj: THREE.Object3D, to: THREE.Vector3, dur: number, ease = "power1.inOut"): gsap.core.Timeline {
  return gsap.timeline().to(obj.position, { x: to.x, y: to.y, z: to.z, duration: dur, ease });
}

/** A hit list: a flat tray with a few standing cards. */
export function hitTray(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.46, 0.06, 0.36, COLOR.ink, 0.02));
  for (let k = 0; k < 3; k++) {
    const c = rbox(0.05, 0.22, 0.28, k === 0 ? color : COLOR.paper, 0.015);
    c.position.set(-0.13 + k * 0.13, 0.14, 0);
    g.add(c);
  }
  g.visible = false;
  return g;
}

export const ADAPTER_COLOR: Record<string, number> = { grep: COLOR.indigo, grep_fn: COLOR.terra, codemem: 0x6c5a49 };

/** A belt of rollers along x. */
export function rollers(x0: number, x1: number, z: number, y = 0.32, len = 1.04): THREE.Group {
  const g = new THREE.Group();
  for (let x = x0; x <= x1 + 1e-6; x += 0.5) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 10), new THREE.MeshStandardMaterial({ color: COLOR.steel, metalness: 0.4, roughness: 0.4 }));
    r.rotation.x = Math.PI / 2;
    r.position.set(x, y, z);
    g.add(r);
  }
  return g;
}
