// Actions on the System page. Each one changes the floor state and the card stack together,
// so the rail always shows where the user is.
import { useEffect, useRef } from "react";
import { STAGES, stepLabel, type Part, type Route, type Stage } from "../../../content/stages";
import { clearCards, pushCard, type Card } from "../../state/rail";
import { system } from "../../state/system";
import { live } from "../../state/live";
import { useStore } from "../../state/store";
import { Html } from "../Html";
import { FileChip, FnChip, fileName, goFn, walkToFile } from "./cards";
import { pause } from "../../lib/util";
import { openCloser } from "../../closers/host";

const short = (path: string) => path.replace("eval/src/cmeval/", "");

const ROUTE_TITLE: Record<Route | "both", string> = { swebench: "From SWE-bench", fresh: "Fresh from GitHub", both: "Both routes" };

/** The steps under one heading, or one group for each route (COLLECT). Steps keep their numbers. */
function stepGroups(stage: Stage): { title: string; items: [Part, number][] }[] {
  const parts = stage.parts ?? [];
  if (!parts.some((p) => p.route)) return [{ title: "Steps", items: parts.map((p, k) => [p, k]) }];
  const groups: { title: string; items: [Part, number][] }[] = [];
  parts.forEach((p, k) => {
    const title = ROUTE_TITLE[p.route ?? "both"];
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push([p, k]);
    else groups.push({ title, items: [[p, k]] });
  });
  return groups;
}

const userScrolled = new WeakMap<HTMLElement, number>();

/**
 * Scroll the card that holds the lit step, and only that card, so the step is in view. Not while
 * the user reads: after a wheel or touch scroll in the card, it waits 8 seconds.
 */
function keepInView(li: HTMLElement): void {
  let box = li.parentElement;
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  if (!box) return;
  if (!userScrolled.has(box)) {
    const mark = () => userScrolled.set(box!, Date.now());
    box.addEventListener("wheel", mark, { passive: true });
    box.addEventListener("touchmove", mark, { passive: true });
    userScrolled.set(box, 0);
  }
  if (Date.now() - (userScrolled.get(box) ?? 0) < 8000) return;
  const r = li.getBoundingClientRect(), b = box.getBoundingClientRect();
  if (r.top < b.top || r.bottom > b.bottom) box.scrollTo({ top: box.scrollTop + (r.top - b.top) - 12, behavior: "smooth" });
}

/** The steps of a stage card. The step that the opened line plays now is lit, with its live text. */
function StepList({ stage, groups, labeled }: { stage: Stage; groups: ReturnType<typeof stepGroups>; labeled: boolean }) {
  const now = useStore(live, (s) => s.step);
  const lit = useRef<HTMLLIElement | null>(null);
  useEffect(() => { if (lit.current) keepInView(lit.current); }, [now]);
  return (
    <>
      {groups.map((g) => (
        <div key={g.title}>
          <h4>{g.title}</h4>
          <ol className={labeled ? "steps labeled" : "steps"} start={g.items[0]![1] + 1}>
            {g.items.map(([p, k]) => (
              <li key={p.n} className={k === now ? "now" : undefined} ref={k === now ? lit : undefined} onClick={() => selectStep(k)}>
                {labeled && <span className="lbl">{stepLabel(stage, k)}.</span>}
                <b>{p.n}</b>
                {p.ghost ? " (planned)" : ""}. <Html html={p.d} />
                <LiveLine step={k} />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}

/** What the opened line does now at this step, with real values. Nothing while another step plays. */
function LiveLine({ step }: { step: number }) {
  const state = useStore(live, (s) => s);
  if (state.step !== step || !state.html) return null;
  return <Html as="div" className="live-now" html={state.html} />;
}

function stageCard(stage: Stage): Card {
  const groups = stepGroups(stage);
  const labeled = groups.length > 1; // routes have their own labels (S1, G1, 1)
  return {
    key: `stage:${stage.id}`,
    type: "stage",
    short: stage.name,
    kind: `stage . ${stage.feat}`,
    title: stage.name,
    sig: `writes ${stage.out}`,
    restore: clearStep,
    body: () => (
      <>
        <Html as="p" html={stage.text} />
        <StepList stage={stage} groups={groups} labeled={labeled} />
        <div className="src-note">Click a step here or on the floor.</div>
      </>
    ),
  };
}

function stepCard(stage: Stage, part: Part, k: number): Card {
  const label = stepLabel(stage, k);
  const files = (part.use ?? []).map(([f]) => f);
  return {
    key: `step:${stage.id}:${k}`,
    type: "step",
    short: `${label}. ${part.n}`,
    kind: part.ghost ? "step . planned" : `step ${label} . ${stage.name}`,
    title: part.n,
    sig: files.map(short).join(" + "),
    restore: () => selectStep(k, false),
    body: () => (
      <>
        <Html as="p" html={part.d} />
        <LiveLine step={k} />
        {(part.use ?? []).map(([file, ids]) => (
          <div key={file}>
            <h4>{fileName(file)}</h4>
            <div className="chips">
              {ids.map((id) => <FnChip key={id} id={id} />)}
              <FileChip path={file} label={`open ${fileName(file)}`} marks={{ ids, badge: `step ${label}`, also: (part.use ?? []).filter(([f]) => f !== file) }} />
            </div>
          </div>
        ))}
        {part.closer && (
          <>
            <h4>Design decision</h4>
            <div className="chips">
              <span className="chip look" onClick={() => openCloser(part.closer!)}>look closer: how it decides &rsaquo;</span>
            </div>
          </>
        )}
        <div className="src-note">{part.ghost ? "No code yet. This step appears in the explorer when its batch lands." : "Click a function for its summary, or open the whole file."}</div>
      </>
    ),
  };
}

export function openStage(id: Stage["id"]): void {
  const stage = STAGES.find((s) => s.id === id);
  if (!stage?.parts) return;
  system.set((s) => ({ ...s, opened: id, step: null }));
  clearCards();
  pushCard(stageCard(stage));
}

export function closeStage(): void {
  system.set((s) => ({ ...s, opened: null, step: null, playing: false }));
  clearCards();
}

export function selectStep(k: number, push = true): void {
  const { opened } = system.get();
  const stage = STAGES.find((s) => s.id === opened);
  const part = stage?.parts?.[k];
  if (!stage || !part) return;
  system.set((s) => ({ ...s, opened: stage.id, step: k }));
  if (push) pushCard(stepCard(stage, part, k));
  const first = part.use?.[0]?.[0];
  if (first) void walkToFile(first); // the explorer walks to the step's code
}

export function clearStep(): void {
  system.set((s) => ({ ...s, step: null }));
}

export function hoverFiles(files: string[] | null): void {
  system.set((s) => ({ ...s, hover: files }));
}

// ---------- Play the import path ----------

let playRun = 0;

/** Walk the whole import call path: each COLLECT step of the SWE-bench route, each of its files, each function card. */
export async function playImportPath(): Promise<void> {
  if (system.get().playing) {
    system.set((s) => ({ ...s, playing: false }));
    return;
  }
  const run = ++playRun;
  const alive = () => system.get().playing && run === playRun;
  system.set((s) => ({ ...s, playing: true }));
  if (system.get().opened !== "collect") {
    if (system.get().opened) closeStage();
    system.set((s) => ({ ...s, playing: true }));
    openStage("collect");
    await pause(1.8);
  }
  const parts = STAGES.find((st) => st.id === "collect")?.parts ?? [];
  for (let k = 0; k < parts.length && alive(); k++) {
    if (parts[k]?.route === "fresh") continue;
    selectStep(k);
    await pause(1.2);
    for (const [file, ids] of parts[k]?.use ?? []) {
      if (!alive()) break;
      await walkToFile(file);
      for (const id of ids) {
        if (!alive()) break;
        await goFn(id, { replaceTop: true });
        await pause(2.6);
      }
    }
  }
  if (run === playRun) system.set((s) => ({ ...s, playing: false }));
}
