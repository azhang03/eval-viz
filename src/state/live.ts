// What an opened line is doing now: the step that plays and its text with real values. The COLLECT
// line shows this in the rail instead of a caption bar on the floor (viz decision 27).
import { createStore } from "./store";

export type LiveState = { step: number | null; html: string };

export const live = createStore<LiveState>({ step: null, html: "" });
