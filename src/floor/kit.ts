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

/** A rounded box that casts and receives shadows. */
export function rbox(w: number, h: number, d: number, color: number, r = 0.06, extra: THREE.MeshStandardMaterialParameters = {}): StdMesh {
  const radius = Math.min(r, w / 2, h / 2, d / 2);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), mat(color, extra));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
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
