// Page 1, layout C (viz decision 6): floor top left, explorer bottom left, rail on the right.
// A click in the floor or the explorer grows that half a little. Clicks only, never hover,
// so the line between them never moves under the mouse.
import { useRef } from "react";
import { gsap } from "gsap";
import { Rail } from "../components/rail/Rail";
import { Breadcrumbs } from "../components/system/Breadcrumbs";
import { FloorStandIn } from "../components/system/FloorStandIn";
import { ExplorerStandIn } from "../components/system/ExplorerStandIn";
import { closeStage } from "../components/system/actions";
import "./SystemPage.css";

const SPLIT = { base: 58, floor: 62, explorer: 46 }; // floor share in percent

export function SystemPage() {
  const grid = useRef<HTMLDivElement>(null);
  const split = useRef({ t: SPLIT.base });

  const focus = (t: number) => {
    if (Math.abs(split.current.t - t) < 0.5) return;
    gsap.to(split.current, {
      t, duration: 0.6, ease: "power3.inOut", overwrite: "auto",
      onUpdate: () => {
        const t = split.current.t;
        if (grid.current) grid.current.style.gridTemplateRows = `minmax(0, ${t}fr) minmax(0, ${100 - t}fr)`;
      },
    });
  };

  return (
    <div className="system" ref={grid}>
      <section className="floor" data-area="floor" onPointerDown={() => focus(SPLIT.floor)}>
        <Breadcrumbs />
        <FloorStandIn />
      </section>
      <div className="explorer-cell" onPointerDown={() => focus(SPLIT.explorer)}>
        <ExplorerStandIn />
      </div>
      <Rail onLast={closeStage} />
    </div>
  );
}
