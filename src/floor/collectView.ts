// COLLECT as an assembly line with two ways in (viz decision 10 and the B6 Y-join). The front
// belt starts at the SWE-bench dock. The back belt holds the five fresh-task stations; it runs
// from right to left, and a short belt brings its crate forward, between the dock and the time
// machine. From there both crates use the same four stations, because both routes call the same
// labeler and task code. This folded line fits the floor slab at full size. All fresh values are real (data/fixtures/fresh.json). The text of each phase goes to
// the rail, next to its step (viz decision 27), not to a caption bar on the floor.
import * as THREE from "three";
import { gsap } from "gsap";
import type { Route, Stage } from "../../content/stages";
import { fixtureFresh as F } from "../data/load";
import { esc } from "../lib/esc";
import { COLOR, disposeTree, mat, rbox, rollerRow, spinRollers } from "./kit";
import { Caption, mini } from "./lines";
import type { Tag } from "./overlay";
import { stepTag, type View, type ViewCtx } from "./views";

const EX = F.examples.crate;
const num = (v: number) => v.toLocaleString("en-US");
const seconds = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 1000);

// Station places, by step index: 0 dock, 1 to 5 fresh (back belt), 6 to 9 both routes.
const BZ = -4.8; // the back belt
const JX = -5.6; // the short belt between the dock and the time machine
const PX = [-8.4, 8.0, 4.8, 1.6, -1.6, -4.8, -3.2, 0, 3.2, 6.4];
const PZ = [0, BZ, BZ, BZ, BZ, BZ, 0, 0, 0, 0];
const TY = 0.61; // crate height on a belt
const FRESH = [1, 2, 3, 4, 5], BOTH = [6, 7, 8, 9];
// The floor slab is 23 by 8, centered at the origin: move the line forward so both belts sit on it.
const SCALE = 1, SHIFT = new THREE.Vector3(0, 0, 2.9);

/** What the fresh crate shows when it reaches each station: the real values of the example task. */
function freshFacts() {
  const pr = EX.pr, real = EX.real;
  const later = EX.issue.versions.find((v) => v.at > pr.createdAt);
  const before = real.bodyAt.body.split("\n");
  // lines of the later body that the body at the fix PR's opening did not have (visible text only)
  const added = (later?.body ?? "").split("\n").filter((l) => l.trim() && !l.trim().startsWith("<!--") && !before.includes(l));
  const match = real.matches.find((m) => m.closing);
  const fn = EX.gold.functions[0];
  const chosen = F.candidates.find((c) => c.repo === EX.repo);
  const windowOf = F.windows.findIndex(([a, b]) => pr.mergedAt.slice(0, 10) >= a && pr.mergedAt.slice(0, 10) <= b);
  return { pr, real, later, added, match, fn, chosen, windowOf };
}

export function collectView(stage: Stage, ctx: ViewCtx): View {
  const parts = stage.parts ?? [];
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  root.position.copy(SHIFT);
  ctx.scene.add(root);
  const fx = freshFacts();

  // ---------- belts ----------
  const belts: THREE.Object3D[] = [];
  const rolls: THREE.InstancedMesh[] = [];
  const front = rbox(17.4, 0.35, 1.3, COLOR.belt, 0.08); front.position.set(-1.0, 0.18, 0);
  const back = rbox(15.6, 0.35, 1.3, COLOR.belt, 0.08); back.position.set(JX - 0.65 + 7.8, 0.18, BZ);
  const link = rbox(1.0, 0.35, -BZ - 0.65, COLOR.belt, 0.08); link.position.set(JX, 0.18, BZ / 2 - 0.33);
  belts.push(front, back, link);
  root.add(front, back, link);
  rolls.push(rollerRow(-9.4, 7.41, 0, 0.38, 1.34, 0.09), rollerRow(JX - 0.4, 9.5, BZ, 0.38, 1.34, 0.09));
  rolls.forEach((r) => root.add(r));
  const ringMat = new THREE.MeshBasicMaterial({ color: COLOR.mustard, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 56), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.015, -0.5);
  root.add(ring);

  const stations = parts.map((_, k) => {
    const g = new THREE.Group();
    g.position.set(PX[k] ?? 0, 0, PZ[k] ?? 0);
    root.add(g);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 3.0), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 1.4, -0.6);
    g.add(hit);
    return g;
  });
  const st = (k: number) => stations[k] ?? new THREE.Group();

  // ---------- 0. dock: one stack of row crates for each repo ----------
  const REPO = [COLOR.teal, COLOR.indigo, COLOR.terra];
  const tops: THREE.Object3D[] = [];
  {
    const g = st(0);
    const pallet = rbox(2.3, 0.16, 1.3, 0xb98a55, 0.03);
    pallet.position.set(0, 0.08, -1.55);
    g.add(pallet);
    REPO.forEach((c, r) => {
      for (let j = 0; j < 3; j++) {
        const b = rbox(0.5, 0.48, 0.5, c, 0.05);
        b.position.set(-0.72 + r * 0.72, 0.16 + 0.25 + j * 0.5, -1.55);
        g.add(b);
        if (j === 2) tops.push(b);
      }
    });
  }

  // ---------- 1. choose repos: a board with one tile for each candidate repo ----------
  const tiles: { m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; chosen: boolean; repo: string }[] = [];
  {
    const g = st(1);
    [-1.0, 1.0].forEach((x) => { const p = rbox(0.12, 2.2, 0.12, 0xb98a55, 0.03); p.position.set(x, 1.1, -1.6); g.add(p); });
    const board = rbox(2.2, 1.5, 0.08, 0xe2c79a, 0.03);
    board.position.set(0, 1.45, -1.6);
    g.add(board);
    F.candidates.forEach((c, i) => {
      const m = rbox(0.42, 0.26, 0.05, COLOR.paper, 0.02) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      m.position.set(-0.78 + (i % 4) * 0.52, 1.95 - Math.floor(i / 4) * 0.34, -1.54);
      g.add(m);
      tiles.push({ m, chosen: F.chosen.includes(c.repo), repo: c.repo });
    });
  }

  // ---------- 2. search: a calendar wall of 7-day windows, and the response cache ----------
  const days: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  const drawer = new THREE.Group();
  const cacheLamp = mat(0x55524c);
  {
    const g = st(2);
    const wall = rbox(1.75, 1.2, 0.1, 0x6c6f78, 0.04);
    wall.position.set(-0.4, 1.3, -1.6);
    g.add(wall);
    F.windows.forEach((_, i) => {
      const m = rbox(0.17, 0.2, 0.05, COLOR.paper, 0.02) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      m.position.set(-1.1 + (i % 6) * 0.28, 1.65 - Math.floor(i / 6) * 0.3, -1.53);
      g.add(m);
      days.push(m);
    });
    const cab = rbox(0.62, 1.2, 0.62, COLOR.steel, 0.05, { metalness: 0.2 });
    cab.position.set(0.95, 0.6, -1.5);
    g.add(cab);
    drawer.position.set(0.95, 0.85, -1.18);
    g.add(drawer);
    const front = rbox(0.54, 0.3, 0.06, 0xa9adb6, 0.03);
    drawer.add(front);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), cacheLamp);
    lamp.position.set(0.95, 1.32, -1.5);
    g.add(lamp);
  }

  // ---------- 3. find the issue: two lenses (GitHub's list, SWE-bench's regex) and three lamps ----------
  const lensMats = [mat(0x55524c), mat(0x55524c)];
  const linkLamps = [mat(0x55524c), mat(0x55524c), mat(0x55524c)]; // list, regex, both
  {
    const g = st(3);
    [-0.55, 0.55].forEach((x, j) => {
      const post = rbox(0.1, 1.6, 0.1, COLOR.ink, 0.02);
      post.position.set(x, 0.8, -0.85);
      g.add(post);
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 10, 32), lensMats[j]);
      ringM.position.set(x, 1.75, -0.85);
      g.add(ringM);
    });
    const panel = rbox(1.5, 0.5, 0.12, COLOR.ink, 0.04);
    panel.position.set(0, 0.55, -1.6);
    g.add(panel);
    linkLamps.forEach((m, j) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), m);
      l.position.set(-0.45 + j * 0.45, 0.55, -1.52);
      g.add(l);
    });
  }

  // ---------- 4. issue as it was: a rack with the stored versions of the issue text, and the leak lamp ----------
  // One sheet for each version that GitHub stored, oldest on the left. The version from just
  // before the fix PR was opened is the one the query uses.
  const versionSheets: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  const vs = EX.issue.versions;
  const usedVersion = Math.max(0, vs.map((v) => v.at <= EX.pr.createdAt).lastIndexOf(true));
  const VX = (i: number) => -0.75 + i * (1.2 / Math.max(1, vs.length - 1)), VY = 1.45, VZ = -1.45;
  const leakLamp = mat(0x55524c);
  {
    const g = st(4);
    const bar = rbox(1.9, 0.08, 0.08, COLOR.ink, 0.02);
    bar.position.set(-0.15, VY + 0.28, VZ - 0.06);
    g.add(bar);
    [-1.05, 0.75].forEach((x) => { const post = rbox(0.1, VY + 0.3, 0.1, COLOR.ink, 0.02); post.position.set(x, (VY + 0.3) / 2, VZ - 0.06); g.add(post); });
    vs.forEach((_, i) => {
      const m = rbox(0.46, 0.5, 0.03, COLOR.paper, 0.015) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      m.position.set(VX(i), VY, VZ);
      g.add(m);
      versionSheets.push(m);
    });
    const box = rbox(0.5, 0.5, 0.5, COLOR.ink, 0.05);
    box.position.set(1.05, 0.25, -1.3);
    g.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), leakLamp);
    lamp.position.set(1.05, 0.62, -1.3);
    g.add(lamp);
  }

  // ---------- 5. base and patch: a commit post (merge commit on top, its parent below) and the apply lamp ----------
  const commits: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  const applyLamp = mat(0x55524c);
  {
    const g = st(5);
    const post = rbox(0.08, 1.9, 0.08, COLOR.steel, 0.02);
    post.position.set(-0.45, 0.95, -1.4);
    g.add(post);
    [1.9, 1.35, 0.8].forEach((y, j) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), mat(j === 0 ? COLOR.terra : COLOR.paper));
      m.position.set(-0.45, y, -1.4);
      m.castShadow = true;
      g.add(m);
      commits.push(m);
    });
    const box = rbox(0.6, 0.7, 0.6, 0x6c5a49, 0.05);
    box.position.set(0.6, 0.35, -1.35);
    g.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), applyLamp);
    lamp.position.set(0.6, 0.82, -1.35);
    g.add(lamp);
  }

  // ---------- 6. vault: a dial that turns back to the base commit, and a door ----------
  const pivot = new THREE.Group(), hand = new THREE.Group();
  {
    const g = st(6);
    const body = rbox(1.8, 1.9, 1.1, 0x6c6f78, 0.12);
    body.position.set(0, 0.95, -1.4);
    g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 12, 40), mat(COLOR.ink));
    rim.position.set(0, 1.0, -0.84);
    g.add(rim);
    pivot.position.set(-0.6, 1.0, -0.8);
    g.add(pivot);
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 40), mat(0xa9adb6, { metalness: 0.3, roughness: 0.5 }));
    door.rotation.x = Math.PI / 2;
    door.position.set(0.6, 0, 0);
    door.castShadow = true;
    pivot.add(door);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), mat(0xfff1cf));
    face.position.set(0.6, 0, 0.065);
    pivot.add(face);
    hand.position.set(0.6, 0, 0.075);
    pivot.add(hand);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.02), mat(COLOR.terra));
    needle.position.y = 0.1;
    hand.add(needle);
    for (let a = 0; a < 12; a++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.01), mat(COLOR.ink));
      const ang = (a / 12) * Math.PI * 2;
      t.position.set(0.6 + Math.sin(ang) * 0.25, Math.cos(ang) * 0.25, 0.07);
      t.rotation.z = -ang;
      pivot.add(t);
    }
  }
  // ---------- 7. scanner arch: a light that sweeps the sheet ----------
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x2fd6c0, transparent: true, opacity: 0, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.1, 1.3), scanMat);
  {
    const g = st(7);
    [-0.95, 0.95].forEach((z) => { const p = rbox(0.24, 2.0, 0.24, COLOR.terra); p.position.set(0, 1.0, z); g.add(p); });
    const beam = rbox(0.4, 0.32, 2.3, COLOR.terra);
    beam.position.y = 2.1;
    g.add(beam);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 1.6), new THREE.MeshStandardMaterial({ color: 0x9ff5e6, emissive: 0x2fd6c0, emissiveIntensity: 1.2 }));
    lamp.position.y = 1.93;
    g.add(lamp);
    scan.position.y = 1.35;
    g.add(scan);
  }
  // ---------- 8. stamping press ----------
  const head = new THREE.Group();
  {
    const g = st(8);
    [-0.95, 0.95].forEach((z) => { const c = rbox(0.24, 2.7, 0.24, COLOR.ink); c.position.set(0, 1.35, z); g.add(c); });
    const top = rbox(0.5, 0.36, 2.3, COLOR.ink);
    top.position.y = 2.7;
    g.add(top);
    head.position.y = 2.05;
    g.add(head);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 14), mat(COLOR.steel, { metalness: 0.5, roughness: 0.3 }));
    rod.position.y = 0.6;
    head.add(rod);
    head.add(rbox(0.95, 0.24, 0.95, COLOR.steel, 0.05, { metalness: 0.3 }));
    const face = rbox(0.85, 0.06, 0.85, COLOR.mustard, 0.02);
    face.position.y = -0.14;
    head.add(face);
  }
  // ---------- 9. packing: the answer-key shelf ----------
  const slots: THREE.Mesh[] = [];
  const packed: Record<Route, number> = { swebench: 0, fresh: 0 };
  {
    const g = st(9);
    [-1.05, 1.05].forEach((x) => { const p = rbox(0.12, 2.3, 0.75, 0xb98a55, 0.03); p.position.set(x, 1.15, -1.55); g.add(p); });
    [0.45, 1.15, 1.85].forEach((y) => { const b = rbox(2.2, 0.08, 0.78, 0xc99c62, 0.02); b.position.set(0, y, -1.55); g.add(b); });
    const backboard = rbox(2.2, 2.3, 0.05, 0xe2c79a, 0.02);
    backboard.position.set(0, 1.15, -1.92);
    g.add(backboard);
    [0.45, 1.15, 1.85].forEach((y) => {
      for (let c = 0; c < 5; c++) {
        const m = rbox(0.3, 0.3, 0.3, COLOR.mustard, 0.04);
        m.position.set(-0.76 + c * 0.38, y + 0.19, -1.55);
        m.visible = false;
        g.add(m);
        slots.push(m);
      }
    });
  }

  // ---------- the task crate and what it carries ----------
  const task = new THREE.Group();
  root.add(task);
  const crate = rbox(0.7, 0.5, 0.7, COLOR.teal, 0.06);
  task.add(crate);
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.62), mat(COLOR.paper));
  sheet.position.y = 0.26;
  task.add(sheet);
  const STRIPE_Z = [-0.18, 0.02, 0.14];
  const stripes = STRIPE_Z.map((z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.05), mat(COLOR.terra, { emissive: COLOR.terra, emissiveIntensity: 0.3 }));
    m.position.set(0, 0.015, z);
    sheet.add(m);
    return m;
  });
  const cls = new THREE.Group();
  cls.position.y = 0.5;
  task.add(cls);
  const clsGeo = new THREE.BoxGeometry(0.62, 0.4, 0.58);
  const clsBoxMat = new THREE.MeshStandardMaterial({ color: COLOR.terra, transparent: true, opacity: 0.22, depthWrite: false });
  const clsEdgeMat = new THREE.LineBasicMaterial({ color: COLOR.terra });
  cls.add(new THREE.Mesh(clsGeo, clsBoxMat), new THREE.LineSegments(new THREE.EdgesGeometry(clsGeo), clsEdgeMat));
  const fnA = rbox(0.24, 0.22, 0.22, COLOR.paper, 0.04);
  fnA.position.set(0.13, -0.05, -0.08);
  cls.add(fnA);
  const fnB = rbox(0.2, 0.18, 0.2, COLOR.paper, 0.04);
  fnB.position.set(-0.16, -0.07, 0.1);
  cls.add(fnB);
  const check = new THREE.Group();
  check.position.set(0, 0.95, 0.2);
  task.add(check);
  {
    const cm = mat(0x2f8f5a, { emissive: 0x2f8f5a, emissiveIntensity: 0.4 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), cm);
    a.position.set(-0.08, -0.03, 0);
    a.rotation.z = 0.8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.08), cm);
    b.position.set(0.07, 0.05, 0);
    b.rotation.z = -0.6;
    check.add(a, b);
  }
  // the fresh crate also carries the PR and issue card: the issue line that G4 takes away (a later edit),
  // the link tag from step 3, and the patch strip from step 5
  const card = new THREE.Group();
  card.position.set(0, 0.55, -0.3);
  task.add(card);
  card.add(rbox(0.5, 0.42, 0.04, COLOR.paper, 0.015));
  const cardLines = [0.1, 0.0, -0.1].map((y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.01), mat(0x9a8f80)); m.position.set(0, y, 0.025); card.add(m); return m; });
  const lateLine = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.012), mat(COLOR.terra, { emissive: COLOR.terra, emissiveIntensity: 0.4 }));
  lateLine.position.set(0, -0.18, 0.026);
  card.add(lateLine);
  const linkTag = rbox(0.12, 0.12, 0.06, COLOR.teal, 0.02);
  linkTag.position.set(0.22, 0.2, 0.03);
  card.add(linkTag);
  const patch = rbox(0.5, 0.05, 0.3, COLOR.terra, 0.015);
  patch.position.set(0, -0.3, 0.15);
  card.add(patch);
  const sparks = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd35a, transparent: true, opacity: 0 }));
    root.add(m);
    return m;
  });
  const GOLD = COLOR.mustard, WHITE = COLOR.paper, TERRA = COLOR.terra, OFF = 0x55524c, GREEN = 0x3dbf6a;
  const lampOn = (m: THREE.MeshStandardMaterial, c = GREEN) => { m.color.setHex(c); m.emissive.setHex(c); m.emissiveIntensity = 0.7; };
  const lampOff = (m: THREE.MeshStandardMaterial) => { m.color.setHex(OFF); m.emissive.setHex(0); };

  // ---------- readouts and the caption ----------
  const tags: Tag[] = [];
  const crateTag = mini(ctx.overlay, tags, "", task, 1.25);
  // the text of each phase goes to the rail with its step; building is the step whose part is built now
  let building = 0;
  let liveStep: number | null = null;
  // the fresh-v1 funnel count goes under the text in the rail, so the floor stays clear
  let lastHtml = "", funnelHtml = "";
  const send = () => ctx.live(liveStep, lastHtml + funnelHtml);
  const C = new Caption((html) => { lastHtml = html; send(); }, "");
  const funnelLine = (html: string) => { funnelHtml = html ? `<div class="funnel">${html}</div>` : ""; send(); };
  const funnelAt = (key: string, what: string) => funnelLine(`fresh-v1 funnel: <b>${num(F.total[key] ?? 0)}</b> of ${num(F.total.merged ?? 0)} merged PRs left (${what})`);
  const hold = C.hold.bind(C);
  const say = (t: gsap.core.Timeline, html: string, at?: gsap.Position) => {
    const k = building;
    hold(t);
    t.add(() => { liveStep = k; }, at);
    return C.say(t, html, at);
  };


  let route: Route = "fresh";
  let trip = 0;
  let counter: HTMLElement | null = null;
  const at = (k: number) => new THREE.Vector3(PX[k] ?? 0, TY, PZ[k] ?? 0);

  /** The state of the crate when it arrives at station k on the current route. */
  function prepare(k: number) {
    const j = k >= 6 ? k - 5 : k === 0 ? 0 : -1; // the station's place on the old line (1 vault to 4 packing)
    task.visible = true;
    task.scale.setScalar(1);
    task.position.copy(at(k));
    crate.material.color.setHex(route === "fresh" ? COLOR.indigo : crate.material.color.getHex());
    sheet.visible = j >= 2;
    stripes.forEach((m, i) => { m.visible = j >= 3; m.position.z = STRIPE_Z[i] ?? 0; });
    cls.visible = j >= 4;
    cls.scale.setScalar(1);
    cls.position.y = 0.5;
    fnA.material.color.setHex(j >= 4 ? GOLD : WHITE);
    fnA.material.emissive.setHex(j >= 4 ? 0x7a5400 : 0x000000);
    clsEdgeMat.color.setHex(j >= 4 ? GOLD : TERRA);
    clsBoxMat.color.setHex(j >= 4 ? GOLD : TERRA);
    check.visible = false;
    // the card: on the fresh route from the search on; small once the crate is on the front belt
    const f = route === "fresh";
    card.visible = f && k >= 3;
    card.scale.setScalar(k >= 6 ? 0.6 : 1);
    card.position.set(k >= 6 ? 0.22 : 0, k >= 6 ? 0.45 : 0.55, -0.3);
    cardLines.forEach((m) => (m.visible = true));
    lateLine.visible = f && k <= 4 && k >= 3;
    linkTag.visible = f && k >= 4;
    patch.visible = f && k >= 6;
    tops.forEach((t) => (t.visible = true));
    pivot.rotation.y = 0;
    hand.rotation.z = 0;
    versionSheets.forEach((m) => { m.material.color.setHex(COLOR.paper); m.rotation.x = 0; });
    scanMat.opacity = 0;
    head.position.y = 2.05;
    sheet.position.set(0, 0.26, 0);
    drawer.position.z = -1.18;
    [cacheLamp, leakLamp, applyLamp, ...lensMats, ...linkLamps].forEach(lampOff);
    commits.forEach((m, i) => m.material.color.setHex(i === 0 ? COLOR.terra : COLOR.paper));
    tiles.forEach((t) => { t.m.material.color.setHex(t.chosen && k > 1 ? COLOR.mustard : COLOR.paper); });
    days.forEach((d, i) => d.material.color.setHex(k > 2 && i <= fx.windowOf ? (i === fx.windowOf ? COLOR.mustard : COLOR.teal) : COLOR.paper));
    if (!f || k === 1) funnelHtml = ""; // a new trip starts the count again
    crateTag.el.innerHTML = f ? esc(EX.id) + (k >= 6 ? `<br>base ${EX.baseCommit.slice(0, 7)}` : "") : "a SWE-bench row";
  }

  // ---------- each station's part, with its caption ----------
  const ACT: ((t: gsap.core.Timeline) => void)[] = [
    (t) => { // dock: take the next repo's stack (round-robin, as in balanced_order)
      const r = trip % 3, top = tops[r];
      say(t, `<b>S1. SWE-bench import.</b> One row of SWE-bench Verified: an issue, its repo, the commit before the fix, and the fix. Rows come from each repo in turn.`);
      t.add(() => { crate.material.color.setHex(REPO[r] ?? COLOR.teal); if (top) top.visible = false; task.position.set(PX[0]! - 0.72 + r * 0.72, 1.42, -1.55); task.scale.setScalar(0.72); })
        .to(task.position, { y: 2.0, duration: 0.35, ease: "power2.out" })
        .to(task.position, { x: PX[0]!, z: 0, duration: 0.55, ease: "power1.inOut" })
        .to(task.scale, { x: 1, y: 1, z: 1, duration: 0.4 }, "<")
        .to(task.position, { y: TY, duration: 0.45, ease: "bounce.out" })
        .add(() => { if (top) top.visible = true; }, "+=0.2");
    },
    (t) => { // choose repos: the chosen tiles light up; the example's repo gives the crate
      const chosen = tiles.filter((x) => x.chosen);
      say(t, `<b>G1. Choose repos.</b> <code>repo-stats</code> measured ${F.candidates.length} candidate repos. People chose ${chosen.length} Python repos for ${esc(F.config.replace(".toml", ""))}. This crate is a task from ${esc(EX.repo)}.`);
      t.add(() => { task.visible = false; });
      const t0 = t.duration();
      chosen.forEach((x, i) => t.add(() => x.m.material.color.setHex(COLOR.mustard), t0 + 0.3 + i * 0.18));
      const mine = tiles.find((x) => x.repo === EX.repo);
      if (mine) t.to(mine.m.scale, { x: 1.3, y: 1.3, duration: 0.25, yoyo: true, repeat: 1 }, ">0.2");
      t.add(() => { task.visible = true; task.position.set(PX[1]!, 2.0, BZ - 1.0); task.scale.setScalar(0.6); })
        .to(task.position, { z: BZ, duration: 0.45, ease: "power1.inOut" })
        .to(task.scale, { x: 1, y: 1, z: 1, duration: 0.45 }, "<")
        .to(task.position, { y: TY, duration: 0.45, ease: "bounce.out" })
        .add(() => funnelLine(`${esc(EX.repo)}: <b>${num(fx.chosen?.possible ?? 0)}</b> possible tasks (repo-stats estimate)`));
    },
    (t) => { // search: the windows light one by one; the PR card comes out; the cache keeps the answer
      say(t, `<b>G2. Search merged PRs.</b> GitHub's search, in ${F.windows.length} windows of 7 days from ${esc(F.since)} to ${esc(F.until)}, because one search gives at most ${num(F.searchCap)} results. PR #${fx.pr.number} was merged on ${esc(fx.pr.mergedAt.slice(0, 10))}.`);
      const t0 = t.duration();
      days.forEach((d, i) => t.add(() => d.material.color.setHex(i === fx.windowOf ? COLOR.mustard : COLOR.teal), t0 + 0.3 + i * 0.12));
      t.add(() => { card.visible = true; card.scale.setScalar(0.01); lateLine.visible = true; })
        .to(card.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: "back.out(2)" }, ">0.2")
        .add(() => funnelAt("not_bot", "merged after the cutoff, not by a bot"));
      say(t, `<b>Each GitHub answer is saved on disk</b> (the cabinet). A second run reads it from there and needs no network.`);
      t.to(drawer.position, { z: -0.85, duration: 0.3, ease: "power2.out" })
        .add(() => lampOn(cacheLamp, COLOR.mustard))
        .to(drawer.position, { z: -1.18, duration: 0.3, ease: "power2.in" }, "+=0.4");
    },
    (t) => { // find the issue: each lens checks the PR; the lamps show which way found the link
      const how = fx.real.findLinks[String(EX.issue.number)] ?? "none";
      const rule = fx.match ? ` ("${esc(fx.real.prText.slice(fx.match.start, fx.match.end))}")` : "";
      say(t, `<b>G3. Find the issue.</b> GitHub's list of closed issues, and SWE-bench's rule${rule}. Here both find issue #${EX.issue.number}. A PR must link exactly one issue.`);
      t.add(() => { if (fx.real.listLinks.includes(EX.issue.number)) lampOn(lensMats[0]!, COLOR.teal); }, "+=0.3")
        .add(() => { if (fx.real.regexLinks.includes(EX.issue.number)) lampOn(lensMats[1]!, COLOR.teal); }, "+=0.5")
        .add(() => { const j = ({ list: 0, regex: 1, both: 2 } as Record<string, number>)[how]; if (j !== undefined) lampOn(linkLamps[j]!); }, "+=0.4")
        .add(() => { linkTag.visible = true; })
        .fromTo(linkTag.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: "back.out(3)" })
        .add(() => funnelAt("one_link", "one linked issue"));
    },
    (t) => { // issue as it was: the card goes to the rack of stored versions; the later version drops away
      const s = fx.later ? seconds(fx.pr.createdAt, fx.later.at) : 0;
      const added = fx.added.length ? ` (<code>${esc(fx.added.join(" "))}</code>)` : "";
      const home = card.position.clone();
      const up = new THREE.Vector3(VX(usedVersion), VY - TY, VZ + 0.35); // the card's place in front of the rack, in crate space
      say(t, `<b>G4. The issue text, as it was when the fix PR was opened.</b> From GitHub's edit history: ${vs.length} stored versions. The body was edited ${s} s after that moment${added}, so the query uses the version before it.`);
      t.to(card.position, { x: up.x, y: up.y, z: up.z, duration: 0.7, ease: "power2.inOut" }, "+=0.2");
      vs.forEach((v, i) => t.add(() => versionSheets[i]!.material.color.setHex(v.at > EX.pr.createdAt ? COLOR.terra : COLOR.teal), `+=${i === 0 ? 0.2 : 0.35}`));
      vs.forEach((v, i) => { if (v.at > EX.pr.createdAt) t.to(versionSheets[i]!.rotation, { x: -1.2, duration: 0.4, ease: "power2.in" }, "+=0.3"); });
      t.add(() => versionSheets[usedVersion]?.material.color.setHex(COLOR.mustard), "+=0.2")
        .to(lateLine.scale, { x: 0.01, duration: 0.4, ease: "power2.in" })
        .add(() => { lateLine.visible = false; lateLine.scale.x = 1; })
        .to(card.position, { x: home.x, y: home.y, z: home.z, duration: 0.6, ease: "power2.inOut" }, "+=0.2");
      say(t, `<b>Leak check.</b> The query must not name the fix PR (#${fx.pr.number}) or a fix commit. ${fx.real.leak ? `<span class="bad">${esc(fx.real.leak)}</span>` : `<span class="ok">passed</span>`}.`);
      t.add(() => { if (!fx.real.leak) lampOn(leakLamp); }, "+=0.2")
        .add(() => funnelAt("no_leak", "candidates: issue checks and leak check passed"));
    },
    (t) => { // base and patch: the parent of the merge commit lights; the patch strip; the apply lamp
      const BASE: Record<string, string> = { squash: "the parent of the squash commit", merge: "the first parent of the merge commit", rebase: "the commit before the rebased PR commits" };
      say(t, `<b>G5. Base and patch.</b> A ${esc(EX.mergeType)} merge: the base is ${BASE[EX.mergeType] ?? "found from the merge type"} (<code>${EX.baseCommit.slice(0, 7)}</code>). git makes the patch from the base to the merge commit.`);
      t.to(commits[1]!.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 0.25, yoyo: true, repeat: 1 }, "+=0.2")
        .add(() => commits[1]!.material.color.setHex(COLOR.mustard))
        .add(() => { patch.visible = true; })
        .fromTo(patch.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: "back.out(2)" });
      say(t, `<b>Checks.</b> The patch touches exactly the PR's ${fx.pr.changedFiles} files, applies at the base, and changes ${EX.tags.n_code_files} code file and ${EX.tags.code_lines_changed} lines (the limits: ${F.settings.max_code_files} code files, ${F.settings.max_code_lines} lines).`);
      t.add(() => lampOn(applyLamp), "+=0.2")
        .add(() => funnelAt("size_ok", "base, file list, apply, and size checks passed"))
        // the short belt to the front: the card settles small on the crate
        .to(task.position, { x: JX, duration: 0.4, ease: "power1.inOut" }, "+=0.3")
        .to(task.position, { z: 0, duration: 1.0, ease: "power1.inOut" })
        .to(card.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 0.4 }, "<")
        .to(card.position, { x: 0.22, y: 0.45, duration: 0.4 }, "<")
        .add(() => { crateTag.el.innerHTML = `${esc(EX.id)}<br>base ${EX.baseCommit.slice(0, 7)}`; });
    },
    (t) => { // vault: the dial turns back in time, the door opens, the base file comes out
      say(t, route === "fresh"
        ? `<b>1. Time machine.</b> Both routes from here. The code, from git: each changed file as it was at the base commit <code>${EX.baseCommit.slice(0, 7)}</code>, just before the fix.`
        : `<b>1. Time machine.</b> The code, from git: each changed file as it was at the task's base commit, just before the fix.`);
      t.to(hand.rotation, { z: Math.PI * 4, duration: 1.0, ease: "power2.inOut" })
        .to(pivot.rotation, { y: -1.45, duration: 0.45, ease: "back.out(1.6)" })
        .add(() => { sheet.visible = true; sheet.position.set(0, 0.4, -0.75); })
        .to(sheet.position, { y: 0.75, duration: 0.25, ease: "power2.out" })
        .to(sheet.position, { z: 0, duration: 0.35 })
        .to(sheet.position, { y: 0.26, duration: 0.3, ease: "bounce.out" })
        .to(pivot.rotation, { y: 0, duration: 0.4, ease: "power2.in" });
    },
    (t) => { // scanner: a sweep, then the changed lines light up; one hunk slides to its real place
      const s0 = stripes[0]!, s1 = stripes[1]!, s2 = stripes[2]!;
      say(t, `<b>2. Diff reader.</b> It splits the fix into hunks and finds where each hunk really fits in the old file.`);
      const p = t.duration();
      t.to(scanMat, { opacity: 0.45, duration: 0.15 })
        .fromTo(scan.position, { x: -0.55 }, { x: 0.55, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: 1 })
        .add(() => { s1.visible = true; s2.visible = true; }, p + 0.6)
        .add(() => { s0.visible = true; s0.position.z = 0.26; }, p + 0.9)
        .to(s0.position, { z: -0.18, duration: 0.5, ease: "back.out(1.4)" }, p + 1.25)
        .to(scanMat, { opacity: 0, duration: 0.2 });
    },
    (t) => { // press: class and function boxes rise; the press stamps the innermost one gold
      const fn = fx.fn;
      say(t, route === "fresh" && fn
        ? `<b>3. Labeler.</b> The function around each changed line becomes gold: <code>${esc(fn.symbol)}</code> in <code>${esc(fn.path)}</code>.`
        : `<b>3. Labeler.</b> The function around each changed line, and the class around that, become gold.`);
      t.add(() => { cls.visible = true; })
        .fromTo(cls.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: "back.out(2)" })
        .fromTo(cls.position, { y: 0.3 }, { y: 0.5, duration: 0.45 }, "<")
        .to(head.position, { y: 1.33, duration: 0.22, ease: "power3.in" }, "+=0.25")
        .add(() => {
          fnA.material.color.setHex(GOLD);
          fnA.material.emissive.setHex(0x7a5400);
          clsEdgeMat.color.setHex(GOLD);
          clsBoxMat.color.setHex(GOLD);
          sparks.forEach((sp, j) => {
            const a = (j / sparks.length) * Math.PI * 2;
            sp.position.set(PX[8]!, TY + 0.7, 0);
            sp.material.opacity = 1;
            gsap.to(sp.position, { x: PX[8]! + Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, y: TY + 0.9, duration: 0.5, ease: "power2.out" });
            gsap.to(sp.material, { opacity: 0, duration: 0.5, ease: "power1.in" });
          });
        })
        .to(task.scale, { y: 0.9, duration: 0.08, yoyo: true, repeat: 1 })
        .to(head.position, { y: 2.05, duration: 0.5, ease: "power2.out" }, "+=0.05");
      if (route === "fresh") t.add(() => funnelAt("labeled", "labeled: the tasks of fresh-v1"));
    },
    (t) => { // packing: validate (check mark), then the task goes on the shelf
      const f = route === "fresh";
      const slot = slots[(packed.swebench + packed.fresh) % slots.length]!;
      say(t, f
        ? `<b>4. Build and save.</b> The task is checked and gets its split from a hash of its ID (${EX.split}). It goes into <code>tasks/fresh-v1.jsonl</code>: ${num(F.stats.tasks)} tasks, ${num(F.stats.tasks_per_split.dev ?? 0)} dev and ${num(F.stats.tasks_per_split.test ?? 0)} test.`
        : `<b>4. Build and save.</b> The task is checked and goes into <code>tasks/swebv-dev50.jsonl</code>. SWE-bench tasks are all dev.`);
      t.add(() => { check.visible = true; })
        .fromTo(check.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: "back.out(3)" })
        .to(cls.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3 }, "+=0.3")
        .add(() => { check.visible = false; })
        .to(task.position, { y: 2.3, duration: 0.35, ease: "power2.out" })
        .to(task.position, { x: PX[9]! + slot.position.x, z: slot.position.z, duration: 0.5 })
        .to(task.scale, { x: 0.43, y: 0.43, z: 0.43, duration: 0.5 }, "<")
        .to(task.position, { y: slot.position.y, duration: 0.3, ease: "bounce.out" })
        .add(() => {
          if ((packed.swebench + packed.fresh) % slots.length === 0) slots.forEach((m) => (m.visible = false));
          slot.visible = true;
          slot.material = crate.material.clone();
          task.visible = false;
          packed[route]++;
          if (counter) counter.innerHTML = `${Math.min(packed.swebench, 50)} of 50 SWE-bench<br>${Math.min(packed.fresh, F.stats.tasks)} of ${num(F.stats.tasks)} fresh`;
        });
    },
  ];

  /** One station's part as a timeline. */
  function station(k: number): gsap.core.Timeline {
    const t = gsap.timeline();
    building = k;
    ACT[k]!(t);
    return hold(t);
  }

  const travel = (dx: number) => Math.max(0.9, Math.abs(dx) * 0.28);

  /** A whole trip of one crate: its own route, then the four stations of both routes. */
  function wholeTrip(r: Route): gsap.core.Timeline {
    route = r; // before the captions are built: they read the route
    const t = gsap.timeline();
    t.add(() => { route = r; prepare(r === "fresh" ? 1 : 0); });
    const first = r === "fresh" ? FRESH : [0];
    first.forEach((k, i) => {
      if (i > 0) t.to(task.position, { x: PX[k]!, duration: travel(PX[k]! - PX[first[i - 1]!]!), ease: "power1.inOut" }, "+=0.2");
      building = k;
      ACT[k]!(t);
    });
    BOTH.forEach((k) => {
      hold(t);
      const from = k === BOTH[0] ? (r === "fresh" ? JX : PX[0]!) : PX[k - 1]!;
      t.to(task.position, { x: PX[k]!, z: 0, duration: travel(PX[k]! - from), ease: "power1.inOut" }, "+=0.2");
      building = k;
      ACT[k]!(t);
    });
    return hold(t);
  }

  // run modes: the full loop (the two routes take turns), or one station on repeat
  let token = 0;
  let cur: gsap.core.Timeline | null = null;
  let wait: gsap.core.Tween | null = null;
  const halt = () => { token++; cur?.kill(); wait?.kill(); };
  function play(k: number | null) {
    halt();
    const my = token;
    const next = () => {
      if (my !== token) return;
      const t = gsap.timeline({ onComplete: () => { if (my === token) wait = gsap.delayedCall(k === null ? 0.3 : 0.9, next); } });
      if (k === null) {
        const r: Route = trip % 2 === 0 ? "fresh" : "swebench";
        trip++;
        t.add(wholeTrip(r));
      } else {
        t.add(() => prepare(k)).add(station(k));
      }
      cur = t;
    };
    next();
  }

  // build-up when the stage opens: belts, then the stations one at a time
  [front, back, ...rolls].forEach((b) => (b.scale.x = 0.01));
  link.scale.z = 0.01;
  task.visible = false;
  card.visible = false;
  ctx.tl.to([front.scale, back.scale, ...rolls.map((r) => r.scale)], { x: 1, duration: 0.6, ease: "power3.out" }, 0.45)
    .to(link.scale, { z: 1, duration: 0.5, ease: "power3.out" }, 0.8);
  stations.forEach((g, k) => { g.scale.setScalar(0.01); ctx.tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "back.out(1.8)" }, 0.6 + k * 0.08); });
  // front labels stand on the floor in front of the belt; back labels float above their stations,
  // because the floor in front of the back belt is behind the front stations
  const stepTags = stations.map((g, k) => PZ[k] === BZ
    ? stepTag(ctx, parts[k]!, k, g, { baseY: 0, dy: 2.75, dz: -1.4 })
    : stepTag(ctx, parts[k]!, k, g, { baseY: 0, dy: 0, dz: 0.85, cls: "below", extra: k === 9 ? `<small class="ctr">0 of 50 SWE-bench<br>0 of ${num(F.stats.tasks)} fresh</small>` : "" }));
  counter = stepTags[9]?.el.querySelector(".ctr") ?? null;

  return {
    steps: stations,
    cam: { zoom: 1.05, tx: 0.3, ty: 0.9, tz: 0.6 },
    start() { route = "fresh"; prepare(1); play(null); },
    select(k) {
      ring.position.set(PX[k] ?? 0, 0.015, (PZ[k] ?? 0) - 0.5);
      gsap.fromTo(ring.scale, { x: 0.8, y: 0.8 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(2)" });
      gsap.to(ringMat, { opacity: 0.9, duration: 0.25 });
      halt();
      if (k === 0) route = "swebench";
      else if (k <= 5) route = "fresh";
      // the crate keeps its route on a shared station
      play(k);
    },
    clear() { gsap.to(ringMat, { opacity: 0, duration: 0.25 }); play(null); },
    stop: halt,
    close(tl) {
      ctx.live(null, "");
      [...tags, ...stepTags].forEach((t) => ctx.overlay.removeTag(t));
      tl.to(root.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, ease: "back.in(1.5)" }, 0);
    },
    dispose() {
      halt();
      ctx.live(null, "");
      root.traverse((o) => gsap.killTweensOf([o.position, o.scale, o.rotation]));
      ctx.scene.remove(root);
      disposeTree(root);
    },
    tick(dt) { rolls.forEach((r) => spinRollers(r, dt)); },
  };
}
