// Floor breadcrumbs: Pipeline, then the stage and step cards in the stack. Click one to go back.
import { Fragment } from "react";
import { popTo, rail } from "../../state/rail";
import { system } from "../../state/system";
import { useStore } from "../../state/store";
import { closeStage } from "./actions";

type Crumb = { t: string; go: (() => void) | null; cur: boolean };

export function Breadcrumbs() {
  const cards = useStore(rail, (s) => s.cards);
  const opened = useStore(system, (s) => s.opened);
  // a crumb is current only if its card is in front; with a file card in front, the step crumb still goes back
  const top = cards.length - 1;
  let list: Crumb[] = [
    { t: "Pipeline", go: opened ? closeStage : null, cur: !opened },
    ...cards.flatMap((c, i) => (c.type === "stage" || c.type === "step" ? [{ t: c.short, go: () => popTo(i), cur: i === top }] : [])),
  ];
  if (list.length > 4) list = [list[0]!, { t: "...", go: null, cur: false }, ...list.slice(-2)];
  return (
    <nav className="crumbs">
      {list.map((c, i) => {
        const cur = c.cur;
        return (
          <Fragment key={`${i}:${c.t}`}>
            {i > 0 && <span className="sep">&rsaquo;</span>}
            <button className={`c${cur ? " cur" : ""}`} disabled={cur || !c.go} onClick={() => c.go?.()}>
              {c.t}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
