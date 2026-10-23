import { useEffect, useState } from "react";
import { Header, type Tab } from "./components/Header";
import { SystemPage } from "./pages/SystemPage";
import { CodebasePage } from "./pages/CodebasePage";
import "./App.css";

// The page is in the URL hash (#/system, #/codebase), so a link or a reload opens the same page.
function tabFromHash(): Tab {
  return window.location.hash === "#/codebase" ? "codebase" : "system";
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const select = (next: Tab) => {
    window.location.hash = `#/${next}`;
  };

  return (
    <div className="app">
      <Header tab={tab} onSelect={select} />
      <main className="app-main">{tab === "system" ? <SystemPage /> : <CodebasePage />}</main>
    </div>
  );
}
