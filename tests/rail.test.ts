import { beforeEach, describe, expect, it, vi } from "vitest";
import { back, clearCards, popTo, pushCard, rail, type Card } from "../src/state/rail";

const card = (key: string, type: Card["type"] = "step", restore?: () => void): Card => ({ key, type, short: key, kind: type, title: key, body: () => null, restore });
const keys = () => rail.get().cards.map((c) => c.key);

describe("card stack", () => {
  beforeEach(() => clearCards());

  it("pushes cards on top", () => {
    pushCard(card("a", "stage"));
    pushCard(card("b"));
    expect(keys()).toEqual(["a", "b"]);
  });

  it("opening the top card again does nothing", () => {
    pushCard(card("a"));
    pushCard(card("a"));
    expect(keys()).toEqual(["a"]);
  });

  it("opening a lower card goes back to it, without restore", () => {
    const restore = vi.fn();
    pushCard(card("a", "stage", restore));
    pushCard(card("b"));
    pushCard(card("c"));
    pushCard(card("a", "stage", restore));
    expect(keys()).toEqual(["a"]);
    expect(restore).not.toHaveBeenCalled();
  });

  it("popTo closes the cards above and restores the target", () => {
    const restore = vi.fn();
    pushCard(card("a", "stage"));
    pushCard(card("b", "step", restore));
    pushCard(card("c", "fn"));
    popTo(1);
    expect(keys()).toEqual(["a", "b"]);
    expect(restore).toHaveBeenCalledOnce();
  });

  it("replaceTop swaps a function card for the next one", () => {
    pushCard(card("s", "step"));
    pushCard(card("f1", "fn"));
    pushCard(card("f2", "fn"), { replaceTop: true });
    expect(keys()).toEqual(["s", "f2"]);
    pushCard(card("f3", "file"), { replaceTop: true });
    expect(keys()).toEqual(["s", "f2", "f3"]);
  });

  it("back goes down one card, and on the last card calls onLast", () => {
    const onLast = vi.fn();
    pushCard(card("a", "stage"));
    pushCard(card("b"));
    back(onLast);
    expect(keys()).toEqual(["a"]);
    back(onLast);
    expect(onLast).toHaveBeenCalledOnce();
    expect(keys()).toEqual(["a"]);
    back();
    expect(keys()).toEqual([]);
  });
});
