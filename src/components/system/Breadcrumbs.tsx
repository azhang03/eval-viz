// Floor breadcrumbs: Pipeline, then the stage and step cards in the stack. Click one to go back.
import { Fragment } from "react";
import { popTo, rail } from "../../state/rail";
import { system } from "../../state/system";
import { useStore } from "../../state/store";
import { closeStage } from "./actions";

type Crumb = { t: string; go: (() => void) | null };

export function Breadcrumbs() {
  const cards = useStore(rail, (s) => s.cards);
  const opened = useStore(system, (s) => s.opened);
  let list: Crumb[] = [
    { t: "Pipeline", go: opened ? closeStage : null },
    ...cards.flatMap((c, i) => (c.type === "stage" || c.type === "step" ? [{ t: c.short, go: () => popTo(i) }] : [])),
  ];
  if (list.length > 4) list = [list[0]!, { t: "...", go: null }, ...list.slice(-2)];
  return (
    <nav className="crumbs">
      {list.map((c, i) => {
        const cur = i === list.length - 1;
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
