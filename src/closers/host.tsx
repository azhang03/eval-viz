// Runs the "look closer" views: one view at a time, over the floor. The rail card lists the
// steps. The view shows only while its card is in front of the stack; going back to a lower
// card hides it, and closing the card ends it.
import { gsap } from "gsap";
import type { CloserKey } from "../../content/stages";
import { pushCard, popTo, rail } from "../state/rail";
import { createStore } from "../state/store";
import { esc } from "../lib/esc";
import type { CloserView } from "./types";
import { labelerView } from "./labeler";
import { hunksView } from "./hunks";
import { splitView } from "./split";
import { iouView } from "./iou";
import { CloserSteps } from "./CloserSteps";

const VIEWS: Record<CloserKey, () => CloserView> = { labeler: labelerView, hunks: hunksView, split: splitView, iou: iouView };

export type CloserState = { key: CloserKey | null; i: number; playing: boolean; visible: boolean };
export const closer = createStore<CloserState>({ key: null, i: 0, playing: false, visible: false });

let host: HTMLElement | null = null;
let view: CloserView | null = null;
let play: gsap.core.Tween | null = null;
let unsubscribe: (() => void) | null = null;

export function viewSteps(): CloserView["steps"] {
  return view?.steps ?? [];
}
export function viewCode(): CloserView["code"] {
  return view?.code ?? [];
}

/** The CloserOverlay component gives the host element. */
export function registerHost(el: HTMLElement | null): void {
  host = el;
  unsubscribe?.();
  unsubscribe = el ? rail.subscribe(sync) : null;
  if (!el) end();
}

function bar(title: string, n: number): string {
  const dots = Array.from({ length: n }, (_, j) => `<i data-i="${j}"></i>`).join("");
  return `<div class="bar"><span class="ttl">Look closer: ${esc(title)}</span><div class="dots">${dots}</div><span class="spacer"></span>
    <button class="btn" data-a="prev">Back</button><button class="btn primary" data-a="next">Next</button><button class="btn" data-a="play">Play</button><button class="btn" data-a="close">Close</button></div>`;
}

export function openCloser(key: CloserKey): void {
  if (!host) return;
  if (closer.get().key === key) {
    pushCard(card(key)); // goes back to the card if it is lower in the stack
    show();
    return;
  }
  end();
  const v = VIEWS[key]();
  view = v;
  host.innerHTML = v.html;
  const box = host.querySelector<HTMLElement>(".box-in");
  if (!box) return;
  box.insertAdjacentHTML("beforeend", bar(v.bar, v.steps.length));
  v.mount(box);
  box.querySelectorAll<HTMLElement>(".dots i").forEach((d) => (d.onclick = () => go(Number(d.dataset.i))));
  box.querySelector<HTMLElement>('[data-a="prev"]')!.onclick = () => go(closer.get().i - 1);
  box.querySelector<HTMLElement>('[data-a="next"]')!.onclick = () => go(closer.get().i + 1);
  box.querySelector<HTMLElement>('[data-a="play"]')!.onclick = togglePlay;
  box.querySelector<HTMLElement>('[data-a="close"]')!.onclick = closeCloser;
  closer.set({ key, i: 0, playing: false, visible: false });
  pushCard(card(key));
  show();
  go(0);
}

function card(key: CloserKey) {
  const v = view!;
  return { key: `closer:${key}`, type: "closer" as const, short: v.short, kind: "look closer", title: v.title, sig: v.sig, body: () => <CloserSteps /> };
}

export function go(i: number): void {
  if (!view || !host) return;
  const n = view.steps.length;
  const next = Math.max(0, Math.min(n - 1, i));
  closer.set((s) => ({ ...s, i: next }));
  view.show(next);
  host.querySelectorAll(".dots i").forEach((d, j) => d.classList.toggle("on", j === next));
}

function setPlayLabel(text: string) {
  const b = host?.querySelector('[data-a="play"]');
  if (b) b.textContent = text;
}

export function togglePlay(): void {
  if (!view) return;
  if (play) { stopPlay(); return; }
  if (closer.get().i >= view.steps.length - 1) go(0);
  closer.set((s) => ({ ...s, playing: true }));
  setPlayLabel("Pause");
  const next = () => {
    if (!view) return;
    if (closer.get().i >= view.steps.length - 1) { stopPlay(); return; }
    go(closer.get().i + 1);
    play = gsap.delayedCall(4.2, next);
  };
  play = gsap.delayedCall(3.2, next);
}

function stopPlay() {
  play?.kill();
  play = null;
  closer.set((s) => ({ ...s, playing: false }));
  setPlayLabel("Play");
}

/** Close: back to the card below the look-closer card. */
export function closeCloser(): void {
  const at = rail.get().cards.findIndex((c) => c.type === "closer");
  if (at >= 0) popTo(at - 1);
}

function show() {
  if (!host || closer.get().visible) return;
  host.style.display = "block";
  closer.set((s) => ({ ...s, visible: true }));
  gsap.fromTo(host, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  const box = host.querySelector(".box-in");
  if (box) gsap.fromTo(box, { scale: 0.94, y: 14 }, { scale: 1, y: 0, duration: 0.45, ease: "back.out(1.6)" });
}

function hide(then?: () => void) {
  stopPlay();
  const h = host;
  if (!h || !closer.get().visible) { then?.(); return; }
  closer.set((s) => ({ ...s, visible: false }));
  gsap.to(h, { opacity: 0, duration: 0.25, onComplete: () => { h.style.display = "none"; then?.(); } });
}

function end() {
  const v = view;
  view = null;
  const finish = () => { v?.dispose(); if (host && !view) host.innerHTML = ""; };
  if (closer.get().key) closer.set({ key: null, i: 0, playing: false, visible: closer.get().visible });
  hide(finish);
}

// the view follows the stack: shown while its card is in front, hidden below, ended when gone
function sync() {
  if (!view) return;
  const cards = rail.get().cards;
  if (!cards.some((c) => c.type === "closer")) end();
  else if (cards.at(-1)?.type === "closer") show();
  else hide();
}

addEventListener("keydown", (e) => {
  if (!view || !closer.get().visible) return;
  if ((e.target as HTMLElement | null)?.tagName === "INPUT") return; // typing in the split view
  if (e.key === "ArrowRight") go(closer.get().i + 1);
  if (e.key === "ArrowLeft") go(closer.get().i - 1);
});
