// The manifest the page shows. main.tsx loads it once before the first render, so components
// can read it without waiting.
import type { Manifest } from "./types";

let current: Manifest | null = null;

export function setManifest(m: Manifest): void {
  current = m;
}

export function manifest(): Manifest {
  if (!current) throw new Error("the manifest is not loaded yet");
  return current;
}
