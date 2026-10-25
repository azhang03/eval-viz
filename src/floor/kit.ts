// Small building blocks for the floor: materials, rounded boxes, dashed ghost boxes.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type StdMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

export const COLOR = {
  ink: 0x2b2622, terra: 0xd4673f, mustard: 0xe9b440, teal: 0x2f8f8a, indigo: 0x5b6fb5,
  ghost: 0x7d93a8, belt: 0x3a3d44, steel: 0x8c8f96, paper: 0xfffaf2, floor: 0xf4ecdf, tile: 0xd9ccb8,
};

export function mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
}

/**
 * A rounded box that receives shadows. It casts a shadow only if it is big enough for the shadow
 * to show (its two largest sides at least 0.3 and 0.12). Small parts (card lines, ticks, lamps)
 * would only add work to every frame's shadow pass.
 */
export function rbox(w: number, h: number, d: number, color: number, r = 0.06, extra: THREE.MeshStandardMaterialParameters = {}): StdMesh {
  const radius = Math.min(r, w / 2, h / 2, d / 2);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), mat(color, extra));
  const [, mid, big] = [w, h, d].sort((a, b) => a - b) as [number, number, number];
  m.castShadow = big >= 0.3 && mid >= 0.12;
  m.receiveShadow = true;
  return m;
}

/**
 * A row of steel rollers along x, as one instanced mesh (one draw call for the whole row).
 * spinRollers() turns each roller about its own axis, as the separate meshes did.
 */
export function rollerRow(x0: number, x1: number, z: number, y: number, len: number, radius = 0.08): THREE.InstancedMesh {
  const xs: number[] = [];
  for (let x = x0; x <= x1 + 1e-6; x += 0.5) xs.push(x);
  const row = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat(COLOR.steel, { metalness: 0.4, roughness: 0.4 }), xs.length);
  row.userData = { xs, y, z, angle: 0 };
  setRollers(row);
  return row;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function setRollers(row: THREE.InstancedMesh) {
  const { xs, y, z, angle } = row.userData as { xs: number[]; y: number; z: number; angle: number };
  _q.setFromEuler(_e.set(Math.PI / 2, angle, 0)); // lying across the belt, turned about its own axis
  xs.forEach((x, i) => row.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s)));
  row.instanceMatrix.needsUpdate = true;
}
export function spinRollers(row: THREE.InstancedMesh, dt: number): void {
  row.userData.angle += dt * 4;
  setRollers(row);
}

export function rounded(w: number, h: number, d: number, segments: number, radius: number): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, segments, radius);
}

/** A planned part: a faint box with dashed edges. */
export function ghostBox(w: number, h: number, d: number, color = COLOR.ghost): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, depthWrite: false })));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineDashedMaterial({ color, dashSize: 0.22, gapSize: 0.14 }));
  edges.computeLineDistances();
  g.add(edges);
  return g;
}

/** Free the GPU memory of everything under an object. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    mats.forEach((x) => x.dispose());
  });
}
