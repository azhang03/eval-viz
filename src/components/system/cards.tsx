// File and function cards for the rail, and the links that open them. Each link walks the
// explorer to the code first, then opens the card, so the explorer and the rail agree.
import { useEffect, useRef, useState } from "react";
import { EXPLANATIONS } from "../../../content/explanations";
import { manifest } from "../../data/current";
import type { DefId, Definition, Method } from "../../data/types";
import { nodeAt, segsOf } from "../../lib/explorer";
import { walkTo } from "../../state/explorer";
import { pushCard, type Card } from "../../state/rail";
import { Html } from "../Html";

/** Marks on a file card: the functions a step uses, and the step's other files. */
export type FileMarks = { ids: DefId[]; badge: string; also?: [string, DefId[]][] };

export const fileName = (path: string) => path.split("/").pop() ?? path;
const lastPart = (id: DefId) => id.split(".").pop() ?? id;
const isPrivate = (name: string) => name.startsWith("_") && !name.startsWith("__");

/** Walk the explorer to a repo path (a file). */
export function walkToFile(path: string): Promise<void> {
  const segs = segsOf(path);
  return walkTo(segs.slice(0, -1), segs.at(-1) ?? null);
}

export async function openFile(path: string, marks?: FileMarks): Promise<void> {
  await walkToFile(path);
  pushCard(fileCard(path, marks));
}

/** Walk to a definition's file, then open its function card. */
export async function goFn(id: DefId, opts: { replaceTop?: boolean } = {}): Promise<void> {
  const where = manifest().where[id];
  if (!where) return;
  await walkToFile(where);
  pushCard(fnCard(id), opts);
}

// ---------- chips ----------

export function FnChip({ id }: { id: DefId }) {
  const where = manifest().where[id];
  return (
    <span className={`chip${isPrivate(lastPart(id)) ? " dim" : ""}`} onClick={() => void goFn(id)}>
      {lastPart(id)} {where && <span className="f">{fileName(where)}</span>}
    </span>
  );
}

export function FileChip({ path, marks, label }: { path: string; marks?: FileMarks; label?: string }) {
  return (
    <span className="chip" onClick={() => void openFile(path, marks)}>
      {label ?? fileName(path)} &rsaquo;
    </span>
  );
}

// ---------- file card ----------

function DefRow({ item, meth, marks }: { item: Definition | Method; meth?: boolean; marks?: FileMarks }) {
  const on = marks?.ids.includes(item.id) ?? false;
  const priv = isPrivate(item.name);
  const isClass = "kind" in item && item.kind === "class";
  const label = "kind" in item && item.kind === "class" ? `${item.name}${item.bases.length ? `(${item.bases.join(", ")})` : ""}` : item.sig;
  return (
    <div className={`def${meth ? " meth" : ""}${on ? " hl" : ""}${priv ? " priv" : ""}`} data-step={on ? marks?.badge : undefined} onClick={() => void goFn(item.id)}>
      <span className="kw">{isClass ? "class" : "def"}</span> {label}
      <span className="ln">L{item.line}</span>
      {item.doc && !priv && <span className="ds">{item.doc}</span>}
    </div>
  );
}

function FileBody({ path, marks }: { path: string; marks?: FileMarks }) {
  const m = manifest();
  const info = m.files[path];
  const node = nodeAt(m.tree, segsOf(path));
  const [showPrivate, setShowPrivate] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // scroll to the first marked definition when the card opens
  useEffect(() => {
    const first = box.current?.querySelector<HTMLElement>(".def.hl");
    const body = box.current?.closest(".body");
    if (first && body) setTimeout(() => body.scrollTo({ top: first.offsetTop - 60, behavior: "smooth" }), 450);
  }, []);

  if (node?.boilerplate) return <div className="bp-note"><b>Boilerplate.</b> {node.boilerplate} The explainer skips it.</div>;
  if (!info) return <div className="bp-note">Not Python source. The codebase page explains data and config files.</div>;

  const ids = marks?.ids ?? [];
  const pub: Definition[] = [], priv: Definition[] = [];
  for (const it of info.items) (isPrivate(it.name) && !ids.includes(it.id) ? priv : pub).push(it);
  const rows = (list: Definition[]) =>
    list.map((it) => (
      <div key={it.id}>
        <DefRow item={it} marks={marks} />
        {it.kind === "class" && it.methods.filter((me) => !isPrivate(me.name) || ids.includes(me.id)).map((me) => <DefRow key={me.id} item={me} meth marks={marks} />)}
      </div>
    ));
  return (
    <div ref={box}>
      <div className="fn-meta">{info.lines} lines . definitions only, no code bodies</div>
      {marks?.also && marks.also.length > 0 && (
        <div className="also">
          This step also uses
          {marks.also.map(([f, fids]) => <FileChip key={f} path={f} marks={{ ids: fids, badge: marks.badge, also: [[path, ids], ...(marks.also ?? []).filter(([o]) => o !== f)] }} />)}
        </div>
      )}
      {rows(pub)}
      {priv.length > 0 && (
        <>
          <div className="privtoggle" onClick={() => setShowPrivate((v) => !v)}>
            {showPrivate ? "-" : "+"} {priv.length} private helpers
          </div>
          {showPrivate && rows(priv)}
        </>
      )}
    </div>
  );
}

export function fileCard(path: string, marks?: FileMarks): Card {
  const m = manifest();
  const info = m.files[path];
  const node = nodeAt(m.tree, segsOf(path));
  return {
    key: `file:${path}`,
    type: "file",
    short: fileName(path),
    kind: node?.boilerplate ? "boilerplate" : info ? `file . ${info.module}` : "file",
    title: fileName(path),
    sig: info?.doc || path,
    restore: () => void walkToFile(path),
    body: () => <FileBody path={path} marks={marks} />,
  };
}

// ---------- function card ----------

type Found = { kind: "function" | "class" | "method"; name: string; sig?: string; doc: string; line: number; methods?: Method[] };

function findDef(id: DefId): Found | null {
  for (const info of Object.values(manifest().files)) {
    for (const it of info.items) {
      if (it.id === id) return it.kind === "class" ? { kind: "class", name: it.name, doc: it.doc, line: it.line, methods: it.methods } : { kind: "function", name: it.name, sig: it.sig, doc: it.doc, line: it.line };
      if (it.kind === "class") for (const me of it.methods) if (me.id === id) return { kind: "method", name: me.name, sig: me.sig, doc: me.doc, line: me.line };
    }
  }
  return null;
}

function FnBody({ id }: { id: DefId }) {
  const m = manifest();
  const def = findDef(id);
  const ex = EXPLANATIONS[id];
  const where = m.where[id];
  if (!def || !where) return <p>Not in this manifest.</p>;
  const calls = (m.calls[id] ?? []).filter((c) => !/Error$/.test(c)); // raising an error is not a step of the algorithm
  const by = m.calledBy[id] ?? [];
  return (
    <>
      {ex ? (
        <>
          <Html as="p" html={ex.what} />
          <h4>How it works</h4>
          <ol>{ex.steps.map((s, i) => <Html key={i} as="li" html={s} />)}</ol>
          {ex.aside && <Html as="div" className="aside" html={ex.aside} />}
        </>
      ) : (
        <>
          <p>{def.doc || "No summary yet."}</p>
          <div className="src-note">From the docstring. No written explanation yet.</div>
        </>
      )}
      {def.methods && def.methods.length > 0 && (
        <>
          <h4>Methods</h4>
          <div className="chips">{def.methods.map((me) => <FnChip key={me.id} id={me.id} />)}</div>
        </>
      )}
      <h4>Calls</h4>
      {calls.length ? <div className="chips">{calls.map((c) => <FnChip key={c} id={c} />)}</div> : <div className="src-note">Nothing in cmeval.</div>}
      <h4>Called by</h4>
      {by.length ? <div className="chips">{by.map((c) => <FnChip key={c} id={c} />)}</div> : <div className="src-note">Nothing in cmeval yet.</div>}
      <h4>Where</h4>
      <div className="chips">
        <FileChip path={where} marks={{ ids: [id], badge: "this" }} label={`${fileName(where)} . line ${def.line}`} />
      </div>
    </>
  );
}

export function fnCard(id: DefId): Card {
  const def = findDef(id);
  const owner = id.replace(/^cmeval\./, "").split(".").slice(0, -1).join(".");
  const where = manifest().where[id];
  return {
    key: `fn:${id}`,
    type: "fn",
    short: def?.name ?? lastPart(id),
    kind: `${def?.kind ?? "function"} . ${owner}`,
    title: def?.name ?? lastPart(id),
    sig: def?.sig,
    restore: () => { if (where) void walkToFile(where); },
    body: () => <FnBody id={id} />,
  };
}
