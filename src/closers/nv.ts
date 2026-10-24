// The frame of the B5 look-closer views (RUN, SCORE, REPORT): a stage pane, and a side pane that
// opens with the current step in plain words. The host adds the bar. Every number comes from the
// generated data (data/fixtures/b5.json, data/results/dev50-final.json); the views show values and
// reimplement no rule (viz decision 15).
import { gsap } from "gsap";
import type { CloserStep } from "./types";

export function nvShell(cls: string, stageHtml: string, sideHtml: string): string {
  return `<div class="box-in nv ${cls}"><div class="panes"><div class="stagebox">${stageHtml}</div><div class="side"><div class="now"><b></b><p></p></div>${sideHtml}</div></div></div>`;
}

/** Writes the current step into the side pane. */
export function nvNow(root: HTMLElement, step: CloserStep): void {
  const now = root.querySelector<HTMLElement>(".now");
  if (!now) return;
  now.querySelector("b")!.innerHTML = step.t;
  now.querySelector("p")!.innerHTML = step.d;
  gsap.fromTo(now, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 });
}

/** Shows one layer of the stage pane (GSAP only; layers have no CSS transition). */
export function nvLayer(root: HTMLElement, name: string): void {
  root.querySelectorAll<HTMLElement>(".lyr").forEach((l) => gsap.to(l, { autoAlpha: l.dataset.l === name ? 1 : 0, duration: 0.3 }));
}

export const nvShort = (p: string) => p.split("/").pop() ?? p;
export const nvNum = (v: number) => v.toLocaleString("en-US");
export const nv3 = (v: number | null | undefined) => (v === null || v === undefined ? "-" : (Math.round(v * 1000) / 1000).toString());
/** A path in a test folder or a test file. */
export const isTestPath = (p: string) => /(^|\/)tests?\//.test(p) || /(^|\/)test_[^/]*\.py$/.test(p);
/** A file that is not code: an image, a style sheet, or docs. */
export const isNotCode = (p: string) => /\.(svg|css|png|jpe?g|gif|rst|md|txt|html?)$/.test(p);
