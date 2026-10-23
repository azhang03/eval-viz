import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { system } from "../state/system";
import { useStore } from "../state/store";
import { playImportPath } from "./system/actions";
import "./Header.css";

export type Tab = "system" | "codebase";

const TABS: { id: Tab; label: string }[] = [
  { id: "system", label: "System" },
  { id: "codebase", label: "Codebase" },
];

type Props = { tab: Tab; onSelect: (tab: Tab) => void };

export function Header({ tab, onSelect }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const playing = useStore(system, (s) => s.playing);

  // The light pill slides under the active tab. The first placement does not animate.
  useLayoutEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
    const pill = pillRef.current;
    if (!active || !pill) return;
    const to = { x: active.offsetLeft, width: active.offsetWidth };
    if (placed.current) gsap.to(pill, { ...to, duration: 0.35, ease: "back.out(1.6)" });
    else gsap.set(pill, to);
    placed.current = true;
  }, [tab]);

  return (
    <header className="header">
      <div className="brand">
        cmeval<small>eval foundation</small>
      </div>
      <div className="tabs" ref={tabsRef} role="tablist">
        <span className="pill" ref={pillRef} aria-hidden="true" />
        {TABS.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "on" : ""}
            onClick={() => onSelect(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn primary" disabled={tab !== "system"} onClick={() => void playImportPath()}>
        {playing ? "Stop" : "Play the import path"}
      </button>
    </header>
  );
}
