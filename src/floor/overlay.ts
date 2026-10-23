// HTML on top of the canvas: labels that follow 3D points, and the hover bubble.
import * as THREE from "three";
import { gsap } from "gsap";

export type Tag = {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  /** If set, the label follows this object (dy and dz from its rest position). */
  follow?: THREE.Object3D;
  baseY?: number;
  dy?: number;
  dz?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Overlay {
  private tags: Tag[] = [];
  private bpos: HTMLDivElement;
  private bubble: HTMLDivElement;
  private v = new THREE.Vector3();
  private box = new THREE.Box3();
  private corner = new THREE.Vector3();

  constructor(readonly root: HTMLElement, private host: HTMLElement, private camera: THREE.Camera) {
    this.bpos = document.createElement("div");
    this.bpos.className = "bpos";
    this.bubble = document.createElement("div");
    this.bubble.className = "bubble";
    this.bpos.appendChild(this.bubble);
    root.appendChild(this.bpos);
  }

  project(p: THREE.Vector3): [number, number] {
    this.v.copy(p).project(this.camera);
    return [((this.v.x + 1) / 2) * this.host.clientWidth, ((1 - this.v.y) / 2) * this.host.clientHeight];
  }

  addTag(html: string, pos: THREE.Vector3, cls = ""): Tag {
    const el = document.createElement("div");
    el.className = `tag ${cls}`.trim();
    el.innerHTML = html;
    this.root.insertBefore(el, this.bpos);
    const tag: Tag = { el, pos };
    this.tags.push(tag);
    return tag;
  }

  removeTag(tag: Tag): void {
    tag.el.remove();
    this.tags = this.tags.filter((t) => t !== tag);
  }

  placeTags(): void {
    for (const t of this.tags) {
      if (t.follow) {
        t.follow.getWorldPosition(t.pos);
        t.pos.y += (t.dy ?? 0) - (t.baseY ?? 0) * t.follow.scale.y;
        t.pos.z += t.dz ?? 0.2;
      }
      const [x, y] = this.project(t.pos);
      t.el.style.left = `${x}px`;
      t.el.style.top = `${y}px`;
    }
  }

  /** The object's box on screen. */
  screenBox(obj: THREE.Object3D) {
    this.box.setFromObject(obj);
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (let i = 0; i < 8; i++) {
      const { min, max } = this.box;
      this.corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
      const [x, y] = this.project(this.corner);
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    return { l, t, r, b, cx: (l + r) / 2, cy: (t + b) / 2 };
  }

  /** The bubble goes above the object if there is room, else beside or below it; it never covers it (viz decision 9). */
  showBubble(html: string, obj: THREE.Object3D): void {
    const bubble = this.bubble;
    bubble.innerHTML = html;
    const W = this.host.clientWidth, H = this.host.clientHeight, G = 14, M = 8;
    const w = bubble.offsetWidth, h = bubble.offsetHeight, bx = this.screenBox(obj);
    const tries: [string, boolean, () => [number, number]][] = [
      ["above", bx.t - G - h >= M, () => [clamp(bx.cx - w / 2, M, W - M - w), bx.t - G - h]],
      ["right", bx.r + G + w <= W - M, () => [bx.r + G, clamp(bx.cy - h / 2, M, H - h - M)]],
      ["left", bx.l - G - w >= M, () => [bx.l - G - w, clamp(bx.cy - h / 2, M, H - h - M)]],
      ["below", bx.b + G + h <= H - M, () => [clamp(bx.cx - w / 2, M, W - M - w), bx.b + G]],
    ];
    const pick = tries.find((t) => t[1]) ?? tries[1]!;
    const [side, , pos] = pick;
    const [x, y] = pos();
    this.bpos.style.left = `${x}px`;
    this.bpos.style.top = `${y}px`;
    bubble.className = `bubble ${side}`;
    const ax = clamp(bx.cx - x, 20, w - 20), ay = clamp(bx.cy - y, 20, h - 20);
    bubble.style.setProperty("--ax", `${ax}px`);
    bubble.style.setProperty("--ay", `${ay}px`);
    const from = { above: [0, 8, `${ax}px 100%`], below: [0, -8, `${ax}px 0%`], right: [-8, 0, `0% ${ay}px`], left: [8, 0, `100% ${ay}px`] }[side] as [number, number, string];
    gsap.killTweensOf(bubble);
    gsap.fromTo(bubble, { opacity: 0, scale: 0.9, x: from[0], y: from[1], transformOrigin: from[2] }, { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.28, ease: "back.out(2)" });
  }

  hideBubble(): void {
    gsap.killTweensOf(this.bubble);
    gsap.to(this.bubble, { opacity: 0, duration: 0.15 });
  }

  dispose(): void {
    gsap.killTweensOf(this.bubble);
    this.tags.forEach((t) => t.el.remove());
    this.tags = [];
    this.bpos.remove();
  }
}
