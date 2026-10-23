import { STAGES } from "../../../content/stages";
import { rail } from "../../state/rail";
import { useStore } from "../../state/store";
import { CardStack } from "./CardStack";
import "./Rail.css";

// The right rail: every card the user opens, or a short guide when nothing is open.
export function Rail({ onLast }: { onLast: () => void }) {
  const empty = useStore(rail, (s) => s.cards.length === 0);
  return (
    <aside className="rail">
      {empty && (
        <div className="empty">
          <h3>How to read this page</h3>
          <ol>
            <li>Hover a machine to see what it does. Its files light up in the explorer below.</li>
            <li>Click a built machine to open it. Each step of the stage is a station.</li>
            <li>Click a step. The explorer walks to its code, and a card opens here.</li>
            <li>Click a file or a function for its own card. Cards stack like files in a cabinet. Click a tab to go back.</li>
          </ol>
          <div className="legend">
            <div><span className="solid" />Solid machine: built</div>
            {STAGES.some((st) => st.status === "partial") && <div><span className="crane" />Machine with a crane: being built</div>}
            <div><span className="dashed" />Dashed outline: planned</div>
          </div>
        </div>
      )}
      <CardStack onLast={onLast} />
    </aside>
  );
}
