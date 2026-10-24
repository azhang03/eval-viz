# eval-viz

An interactive website that explains the evaluation suite of codemem (`cmeval`). Codemem is a local code search tool for coding agents. Our course project measures if it finds code better than grep.

The site has two pages:

- **System.** A 3D model of the eval pipeline (collect, run, score, report) above a file explorer. Click a stage to see its steps and the code that does each step. Some steps have a "look closer" view that animates a design decision.
- **Codebase.** The eval code as a graph, with a timeline of how it grew batch by batch.

The site is live at **https://azhang03.github.io/eval-viz/**.

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
- `npm run gen`: write the manifests and fixtures again (see below).
- `npm run check`: get answers from the real cmeval code, then run the tests.
- `npm test`: run the tests only.

## Where the data comes from

The site reads the codemem repo (`../codemem`) only through git (`git ls-tree`, `git show`). It never reads uncommitted files and never writes to codemem. Scripts turn each commit into a manifest (files, functions, signatures, docstrings, call links). The manifests are committed here, so a build does not need the codemem repo.

Summaries and pseudocode are written by hand in a separate file, keyed by function name. A new manifest never deletes them.

## Layout

```
.github/workflows/         the deploy to GitHub Pages
index.html, src/          the app (React, TypeScript, GSAP, three.js)
src/styles/theme.css      colors and font names
src/styles/fonts.css      self-hosted fonts (Fontsource, SIL Open Font License 1.1)
src/data/                 types and loaders for the generated data
scripts/gen_manifest.py   one manifest for each batch commit -> data/manifest/<commit>.json
scripts/gen_fixtures.py   real task data for the views -> data/fixtures/
data/timeline.json        phases, features, and batches, with their commits (kept by hand)
src/lib/                  rules the views animate (SHA-256, split rule, hunk search)
content/explanations.ts   hand-written summaries and pseudocode, keyed by definition ID
content/stages.ts         the pipeline: stages, steps, and the code of each step
scripts/check.py          answers from the real cmeval code -> data/checks/expected.json
tests/                    checks that the site stays true to the code
```

## Update the data

`npm run gen` writes a manifest for each commit in `data/timeline.json` and writes the fixtures. It expects the codemem repo at `../codemem`. The fixture script also needs the scikit-learn clone that `cmeval import` makes in `~/.cmeval/repos`. The output is the same each time, so a run with no codemem change gives no git diff. Commit the files in `data/` after a run.

## Checks

The tests make sure that the site stays true to the code:

- The TypeScript copies of the split rule and the hunk search give the same answers as the real Python functions. `scripts/check.py` loads those functions from codemem with git and records their answers in `data/checks/expected.json`.
- Every function that `content/` names exists in the newest manifest, in the file that the content says.
- A coverage report lists the public functions that have no written explanation yet. These show their docstring on the site. The report does not fail the tests.

## Deploy

Each push to `main` deploys the site to GitHub Pages (`.github/workflows/deploy.yml`). The workflow runs `npm ci`, `npm test`, and `npm run build`, then publishes `dist/`. The build reads only the committed files in `data/`, so CI does not need the codemem repo. `npm run check` needs `../codemem`, so run it locally before you push. CI runs the tests on the answers that are committed in `data/checks/`.

The site uses relative asset paths and hash routes (`#/codebase`), so it works from the `/eval-viz/` sub-path with no server setup.
