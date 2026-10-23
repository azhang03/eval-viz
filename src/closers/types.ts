// A "look closer" view: a design decision, animated step by step (viz decision 11).
import type { DefId } from "../data/types";

export type CloserStep = { t: string; d: string };

export type CloserView = {
  short: string;
  title: string;
  sig: string;
  /** Name in the bar: "Look closer: <bar>". */
  bar: string;
  steps: CloserStep[];
  /** Real definitions behind the decision; the card links them. */
  code: DefId[];
  /** The view's panes as HTML; the host adds the bar. */
  html: string;
  /** Builds the view inside its root element (the .box-in). */
  mount(root: HTMLElement): void;
  /** Shows step i. Moving forward by one step animates; other moves jump to the step's picture. */
  show(i: number): void;
  dispose(): void;
};

/** A small DOM helper for views: the first match, which the view's own HTML always has. */
export function q<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`look-closer view: no element ${sel}`);
  return el;
}

const NS = "http://www.w3.org/2000/svg";
/** Make an SVG element with attributes and add it to a parent. */
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent.appendChild(n);
  return n;
}
