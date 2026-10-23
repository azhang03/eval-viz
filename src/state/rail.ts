// The card stack in the right rail (viz decision 7). Each stage, step, file, function, or
// "look closer" you open puts a card on top. Older cards stay below it as tabs. Going back to
// a card removes the cards above it and runs the card's `restore`, so the floor and the
// explorer return to that point.
import type { ReactNode } from "react";
import { createStore } from "./store";

export type CardType = "stage" | "step" | "file" | "fn" | "closer";

export type Card = {
  /** Unique for the thing the card shows, for example "step:collect:3". Opening it again goes back to it. */
  key: string;
  type: CardType;
  /** Name on the tab and in the breadcrumbs. */
  short: string;
  kind: string;
  title: string;
  sig?: string;
  body: () => ReactNode;
  /** Puts the floor and the explorer back to this card's point. */
  restore?: () => void;
  /** For file and function cards: the repo path of the file. The explorer marks it while the card is in front. */
  path?: string;
};

export type RailState = { cards: Card[] };

export const rail = createStore<RailState>({ cards: [] });

/** Open a card. If it is already open, go back to it (without restore: the caller already did that work). */
export function pushCard(card: Card, opts: { replaceTop?: boolean } = {}): void {
  rail.set(({ cards }) => {
    const top = cards[cards.length - 1];
    if (top?.key === card.key) return { cards };
    const at = cards.findIndex((c) => c.key === card.key);
    if (at >= 0) return { cards: cards.slice(0, at + 1) };
    // a walk through functions shows one function card at a time
    const base = opts.replaceTop && top?.type === "fn" && card.type === "fn" ? cards.slice(0, -1) : cards;
    return { cards: [...base, card] };
  });
}

/** Go back to the card at `index`: the cards above it close. index -1 closes all cards. */
export function popTo(index: number, restore = true): void {
  const { cards } = rail.get();
  if (index >= cards.length - 1 && index >= 0) return;
  rail.set({ cards: cards.slice(0, index + 1) });
  if (restore) cards[index]?.restore?.();
}

/** Remove one card, wherever it is in the stack, without restoring anything. */
export function removeCard(key: string): void {
  rail.set(({ cards }) => ({ cards: cards.filter((c) => c.key !== key) }));
}

export function clearCards(): void {
  rail.set({ cards: [] });
}

/** The top card's back button: go to the card below, or close the last card. */
export function back(onLast?: () => void): void {
  const { cards } = rail.get();
  if (cards.length > 1) popTo(cards.length - 2);
  else if (onLast) onLast();
  else clearCards();
}
