# eval-viz

An interactive website that explains the evaluation suite of codemem (`cmeval`). Codemem is a local code search tool for coding agents. Our course project measures if it finds code better than grep.

The site has two pages:

- **System.** A 3D model of the eval pipeline (collect, run, score, report) above a file explorer. Click a stage to see its steps and the code that does each step. Some steps have a "look closer" view that animates a design decision.
- **Codebase.** The eval code as a graph, with a timeline of how it grew batch by batch.

The site is private. We publish it only when the whole team agrees.

## Run it

You need Node 20.19 or later.

```
npm ci
npm run dev
```

`npm ci` installs the exact versions in `package-lock.json`, and npm 10 is enough for it. To add or update a package, use npm 11 or later (`npx npm@11 install <package>`). npm 10.8 fails on Vite's optional peer dependencies.

Other commands:

- `npm run build`: type check and build the static site into `dist/`.
- `npm run typecheck`: type check only.
- `npm run preview`: serve the built site.

## Where the data comes from

The site reads the codemem repo (`../codemem`) only through git (`git ls-tree`, `git show`). It never reads uncommitted files and never writes to codemem. Scripts turn each commit into a manifest (files, functions, signatures, docstrings, call links). The manifests are committed here, so a build does not need the codemem repo.

Summaries and pseudocode are written by hand in a separate file, keyed by function name. A new manifest never deletes them.

## Layout

```
index.html, src/        the app (React, TypeScript, GSAP, three.js)
src/styles/theme.css    colors and fonts
scripts/                manifest and fixture scripts (to come)
data/                   generated manifests and fixtures (to come)
content/                hand-written explanations and stage steps (to come)
```
