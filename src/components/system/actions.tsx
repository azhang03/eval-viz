// Actions on the System page. Each one changes the floor state and the card stack together,
// so the rail always shows where the user is.
import { STAGES, type Part, type Stage } from "../../../content/stages";
import { clearCards, pushCard, type Card } from "../../state/rail";
import { system } from "../../state/system";
import { Html } from "../Html";

const fileName = (path: string) => path.split("/").pop() ?? path;
const short = (path: string) => path.replace("eval/src/cmeval/", "");
const fnName = (id: string) => id.split(".").pop() ?? id;

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
              {ids.map((id) => (
                <span key={id} className="chip" title="Function cards come in V1-02 B3">
                  {fnName(id)} <span className="f">{fileName(file)}</span>
                </span>
              ))}
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
  system.set({ opened: id, step: null });
  clearCards();
  pushCard(stageCard(stage));
}

export function closeStage(): void {
  system.set({ opened: null, step: null });
  clearCards();
}

export function selectStep(k: number, push = true): void {
  const { opened } = system.get();
  const stage = STAGES.find((s) => s.id === opened);
  const part = stage?.parts?.[k];
  if (!stage || !part) return;
  system.set({ opened: stage.id, step: k });
  if (push) pushCard(stepCard(stage, part, k));
}

export function clearStep(): void {
  system.set((s) => ({ ...s, step: null }));
}
