// A plain stand-in for the 3D floor, so the shell and the card stack can be used before V1-02 B2.
// It shows the same stages and steps that the floor will show.
import { STAGES } from "../../../content/stages";
import { system } from "../../state/system";
import { useStore } from "../../state/store";
import { openStage, selectStep } from "./actions";

export function FloorStandIn() {
  const { opened, step } = useStore(system, (s) => s);
  const stage = STAGES.find((s) => s.id === opened);
  return (
    <div className="standin">
      <div className="standin-note">3D floor comes in V1-02 B2. This stand-in uses the same stages and steps.</div>
      <div className="tiles">
        {!stage &&
          STAGES.map((s) => (
            <button key={s.id} className={`tile ${s.status}`} disabled={!s.parts} onClick={() => openStage(s.id)}>
              <b>{s.name}</b>
              <small>{s.feat} . {s.status}</small>
            </button>
          ))}
        {stage?.parts?.map((p, k) => (
          <button key={p.n} className={`tile step${p.ghost ? " planned" : ""}${k === step ? " sel" : ""}`} onClick={() => selectStep(k)}>
            <b>{k + 1}. {p.n}</b>
            <small>{(p.use ?? []).map(([f]) => f.split("/").pop()).join(" + ") || "planned"}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
