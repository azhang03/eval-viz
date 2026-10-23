// The explorer's folder, and the walk between folders. The walk goes one level at a time and
// animates every move, so the user always sees where the code is (viz decision 8 and the
// "never jumps" note in the brief). One walk runs at a time; a new target replaces the old one.
import { flushSync } from "react-dom";
import { gsap } from "gsap";
import { createStore } from "./store";
import { pause } from "../lib/util";

export type ExplorerState = { path: string[] };

export const explorer = createStore<ExplorerState>({ path: [] });

let grid: HTMLElement | null = null;
/** The Explorer component registers its icon grid, so the walk can animate it. */
export function registerGrid(el: HTMLElement | null): void {
  grid = el;
}

const items = () => (grid ? [...grid.querySelectorAll<HTMLElement>(".item")] : []);
const itemNamed = (name: string) => items().find((el) => el.dataset.name === name) ?? null;

async function stepUp(): Promise<void> {
  const from = explorer.get().path.at(-1);
  if (items().length) await gsap.timeline().to(items(), { x: 46, opacity: 0, duration: 0.22, stagger: 0.012, ease: "power2.in" });
  flushSync(() => explorer.set(({ path }) => ({ path: path.slice(0, -1) })));
  if (!items().length) return; // GSAP warns on an empty target list
  const t = gsap.timeline();
  t.fromTo(items(), { x: -46, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, stagger: 0.014, ease: "power2.out", clearProps: "transform,opacity" });
  const came = from ? itemNamed(from) : null;
  if (came) t.fromTo(came, { backgroundColor: "rgba(43,38,34,.16)" }, { backgroundColor: "rgba(43,38,34,0)", duration: 0.6, clearProps: "backgroundColor" }, 0.1);
  await t;
}

async function stepDown(name: string): Promise<void> {
  const el = itemNamed(name);
  if (el) {
    const others = items().filter((x) => x !== el);
    const t = gsap.timeline().to(el, { scale: 1.12, duration: 0.16, ease: "power2.out" }).to(el, { scale: 1, duration: 0.14 });
    if (others.length) t.to(others, { x: -46, opacity: 0, duration: 0.2, stagger: 0.01 }, 0.1);
    await t.to(el, { opacity: 0, scale: 1.4, duration: 0.2 }, 0.25);
  }
  flushSync(() => explorer.set(({ path }) => ({ path: [...path, name] })));
  if (items().length) await gsap.timeline().fromTo(items(), { x: 46, opacity: 0, scale: 1 }, { x: 0, opacity: 1, duration: 0.28, stagger: 0.014, ease: "power2.out", clearProps: "transform,opacity" });
}

async function bob(name: string): Promise<void> {
  const el = itemNamed(name);
  if (el) await gsap.timeline().fromTo(el, { y: 0 }, { y: -8, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.out", clearProps: "transform" });
}

let target: { path: string[]; file: string | null } = { path: [], file: null };
let running: Promise<void> | null = null;

async function run(): Promise<void> {
  let bobbed: string | null = null;
  for (;;) {
    const t = target;
    const cur = explorer.get().path;
    let common = 0;
    while (common < cur.length && common < t.path.length && cur[common] === t.path[common]) common++;
    if (cur.length > common) { await stepUp(); await pause(0.06); bobbed = null; continue; }
    if (cur.length < t.path.length) { await stepDown(t.path[cur.length]!); await pause(0.06); bobbed = null; continue; }
    if (t.file && bobbed !== t.file) { bobbed = t.file; await bob(t.file); continue; }
    if (t === target) return;
  }
}

/** Walk to a folder (segments under eval/), and point at a file in it. Resolves when the walk ends. */
export function walkTo(path: string[], file: string | null = null): Promise<void> {
  target = { path, file };
  running ??= run().finally(() => { running = null; });
  return running;
}
