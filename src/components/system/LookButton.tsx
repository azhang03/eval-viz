// The mustard "Look closer" button on the floor, for a selected step with a design decision.
import { STAGES } from "../../../content/stages";
import { closer, openCloser } from "../../closers/host";
import { system } from "../../state/system";
import { useStore } from "../../state/store";

export function LookButton() {
  const part = useStore(system, (s) => STAGES.find((st) => st.id === s.opened)?.parts?.[s.step ?? -1]);
  const visible = useStore(closer, (s) => s.visible);
  if (!part?.closer || visible) return null;
  const key = part.closer;
  return (
    <button className="btn lookbtn" onClick={() => openCloser(key)}>
      Look closer: {part.n} &rsaquo;
    </button>
  );
}
