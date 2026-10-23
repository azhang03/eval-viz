// A very small store: state, a way to change it, and React subscription. No library needed.
import { useSyncExternalStore } from "react";

export type Store<S> = {
  get: () => S;
  set: (next: S | ((prev: S) => S)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      state = typeof next === "function" ? (next as (prev: S) => S)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<S, T>(store: Store<S>, pick: (s: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => pick(store.get()));
}
