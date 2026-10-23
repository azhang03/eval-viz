// What the System page shows: the open stage and the selected step.
import type { Stage } from "../../content/stages";
import { createStore } from "./store";

export type SystemState = { opened: Stage["id"] | null; step: number | null };

export const system = createStore<SystemState>({ opened: null, step: null });
