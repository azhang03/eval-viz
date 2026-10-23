import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/theme.css";
import { App } from "./App";
import { latestManifest } from "./data/load";
import { setManifest } from "./data/current";

setManifest(await latestManifest());

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
