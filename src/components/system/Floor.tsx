// The 3D floor. React owns the host element; src/floor/FloorScene.ts owns everything inside.
// The floor follows the page state (open stage, selected step) and reports clicks through
// the same actions the cards use.
import { useEffect, useRef } from "react";
import { STAGES } from "../../../content/stages";
import { FloorScene } from "../../floor/FloorScene";
import { system } from "../../state/system";
import { hoverFiles, openStage, selectStep } from "./actions";
import "./Floor.css";

export function Floor() {
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current || !overlay.current) return;
    const scene = new FloorScene(host.current, overlay.current, STAGES, { openStage, selectStep, hoverFiles });
    const sync = () => {
      const { opened, step } = system.get();
      scene.sync({ opened, step });
    };
    sync();
    if (import.meta.env.DEV) (window as { __floor?: FloorScene }).__floor = scene; // for browser tests
    const unsubscribe = system.subscribe(sync);
    return () => {
      unsubscribe();
      scene.dispose();
    };
  }, []);

  return (
    <div className="floor-host" ref={host}>
      <div className="floor-overlay" ref={overlay} />
    </div>
  );
}
