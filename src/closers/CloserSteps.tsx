// The rail card of a "look closer" view: its steps (click one to jump there) and the real code.
import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import { Html } from "../components/Html";
import { FnChip } from "../components/system/cards";
import { closer, go, viewCode, viewSteps } from "./host";

export function CloserSteps() {
  const i = useStore(closer, (s) => s.i);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.children[i]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [i]);
  const code = viewCode();
  return (
    <>
      <ol className="steps" ref={list}>
        {viewSteps().map((s, j) => (
          <li key={j} className={j === i ? "on" : ""} onClick={() => go(j)}>
            <b>{s.t}.</b> <Html html={s.d} />
          </li>
        ))}
      </ol>
      {code.length > 0 && (
        <>
          <h4>The code</h4>
          <div className="chips">{code.map((id) => <FnChip key={id} id={id} />)}</div>
        </>
      )}
      <div className="src-note">Back, Next, Play, or the arrow keys. Close returns to the step.</div>
    </>
  );
}
