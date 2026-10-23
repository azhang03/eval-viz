// Actions on the System page. Each one changes the floor state and the card stack together,
// so the rail always shows where the user is.
import { STAGES, type Part, type Stage } from "../../../content/stages";
import { clearCards, pushCard, type Card } from "../../state/rail";
import { system } from "../../state/system";
import { Html } from "../Html";
import { FileChip, FnChip, goFn, walkToFile } from "./cards";

const fileName = (path: string) => path.split("/").pop() ?? path;
const short = (path: string) => path.replace("eval/src/cmeval/", "");

function stageCard(stage: Stage): Card {
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
        <h4>Steps</h4>
        <ol className="steps">
          {(stage.parts ?? []).map((p, k) => (
            <li key={p.n} onClick={() => selectStep(k)}>
              <b>{p.n}</b>
              {p.ghost ? " (planned)" : ""}. <Html html={p.d} />
            </li>
          ))}
        </ol>
        <div className="src-note">Click a step here or on the floor.</div>
      </>
    ),
  };
}

function stepCard(stage: Stage, part: Part, k: number): Card {
  const files = (part.use ?? []).map(([f]) => f);
  return {
    key: `step:${stage.id}:${k}`,
    type: "step",
    short: `${k + 1}. ${part.n}`,
    kind: part.ghost ? "step . planned" : `step ${k + 1} . ${stage.name}`,
    title: part.n,
    sig: files.map(short).join(" + "),
    restore: () => selectStep(k, false),
    body: () => (
      <>
        <Html as="p" html={part.d} />
        {(part.use ?? []).map(([file, ids]) => (
          <div key={file}>
            <h4>{fileName(file)}</h4>
            <div className="chips">
              {ids.map((id) => <FnChip key={id} id={id} />)}
              <FileChip path={file} label={`open ${fileName(file)}`} marks={{ ids, badge: `step ${k + 1}`, also: (part.use ?? []).filter(([f]) => f !== file) }} />
            </div>
          </div>
        ))}
        {part.closer && (
          <>
            <h4>Design decision</h4>
            <div className="chips">
              <span className="chip look" title="Look-closer views come in V1-02 B4">look closer: how it decides &rsaquo;</span>
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

const pause = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
let playRun = 0;

/** Walk the whole import call path: each COLLECT step, each of its files, each function card. */
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
