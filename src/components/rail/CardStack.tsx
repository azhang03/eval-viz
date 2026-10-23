// The card stack (viz decision 7). The newest card is in front. Older cards show their tab
// above it; hover a tab to lift it, click it to go back. Cards slide in from the bottom and
// slide out to the bottom, in reverse order.
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { back, popTo, rail, type Card } from "../../state/rail";
import { useStore } from "../../state/store";

const TAB = 30; // tab height
const MAX_TABS = 7; // older cards beyond this fold behind the oldest visible tab
const TYPE: Record<Card["type"], string> = { stage: "stage", step: "step", file: "file", fn: "def", closer: "look" };

const topFor = (i: number, n: number) => 2 + Math.max(0, i - Math.max(0, n - 1 - MAX_TABS)) * TAB; // 2px keeps the outline visible

export function CardStack({ onLast }: { onLast: () => void }) {
  const cards = useStore(rail, (s) => s.cards);
  // cards that left the stack slide out first; each has its own id, so a card that comes back
  // while its old copy still slides out is a new element, never the old one
  const [leaving, setLeaving] = useState<{ card: Card; id: number }[]>([]);
  const leaveId = useRef(0);
  const leaveEls = useRef(new Map<number, HTMLElement>());
  const prev = useRef<Card[]>([]);
  const els = useRef(new Map<string, HTMLElement>());
  const placed = useRef(new Set<string>());
  const box = useRef<HTMLDivElement>(null);

  // cards that left the stack stay on screen until their slide-out ends
  useLayoutEffect(() => {
    const gone = prev.current.filter((c) => !cards.some((x) => x.key === c.key));
    prev.current = cards;
    setLeaving((l) => {
      // a card that is back in the stack stops leaving
      const kept = l.filter((x) => !cards.some((c) => c.key === x.card.key));
      const added = gone.reverse().map((card) => ({ card, id: ++leaveId.current }));
      return kept.length === l.length && !added.length ? l : [...kept, ...added];
    });
  }, [cards]);

  useLayoutEffect(() => {
    const h = box.current?.clientHeight ?? 800;
    const n = cards.length;
    cards.forEach((c, i) => {
      const el = els.current.get(c.key);
      if (!el) return;
      if (!placed.current.has(c.key)) {
        gsap.set(el, { top: h });
        placed.current.add(c.key);
      }
      gsap.to(el, { top: topFor(i, n), duration: 0.42, ease: "power3.out", overwrite: "auto" });
    });
    leaving.forEach(({ card, id }, k) => {
      const el = leaveEls.current.get(id);
      if (!el || el.dataset.leaving) return;
      el.dataset.leaving = "1";
      placed.current.delete(card.key);
      gsap.to(el, {
        top: h + 20, duration: 0.35, delay: k * 0.05, ease: "power3.in", overwrite: "auto",
        onComplete: () => setLeaving((l) => l.filter((x) => x.id !== id)),
      });
    });
  }, [cards, leaving]);

  const ref = (key: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };
  const leaveRef = (id: number) => (el: HTMLElement | null) => {
    if (el) leaveEls.current.set(id, el);
    else leaveEls.current.delete(id);
  };
  const lift = (i: number, by: number) => {
    const c = cards[i];
    const el = c && els.current.get(c.key);
    if (el && i < cards.length - 1) gsap.to(el, { top: topFor(i, cards.length) - by, duration: 0.2, ease: "power2.out" });
  };

  const render = (c: Card, i: number, leaveAs?: number) => {
    const isLeaving = leaveAs !== undefined;
    const top = !isLeaving && i === cards.length - 1;
    return (
      <aside
        key={isLeaving ? `leaving:${leaveAs}` : c.key}
        ref={isLeaving ? leaveRef(leaveAs) : ref(c.key)}
        className={`card${top ? " top" : ""}`}
        style={{ zIndex: isLeaving ? 60 : 10 + i }}
        onMouseEnter={() => !isLeaving && lift(i, 6)}
        onMouseLeave={() => !isLeaving && lift(i, 0)}
        onClick={() => !top && !isLeaving && popTo(i)}
      >
        <div className="tabstrip">
          <span className="ty">{TYPE[c.type]}</span>
          <span>{c.short}</span>
        </div>
        <div className="head">
          <div className="kind">{c.kind}</div>
          <h3>{c.title}</h3>
          {c.sig && <div className="sig">{c.sig}</div>}
          {top && (
            <button className="btn x" title={cards.length > 1 ? "Back" : "Close"} onClick={(e) => { e.stopPropagation(); back(onLast); }}>
              {cards.length > 1 ? "←" : "×"}
            </button>
          )}
        </div>
        <div className="body" onClickCapture={(e) => { if (!top) e.stopPropagation(); }}>{c.body()}</div>
      </aside>
    );
  };

  return (
    <div className="stack" ref={box}>
      {cards.map((c, i) => render(c, i))}
      {leaving.map(({ card, id }) => render(card, -1, id))}
    </div>
  );
}
