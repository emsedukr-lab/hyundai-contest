// Shared three.js helpers for the application figures: quiet light scene, crisp text labels, screens, routes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

export const C = {
  ink: '#1C2430', muted: '#5B6574', line: '#D9DDE3', bg: '#F5F6F8', white: '#FFFFFF',
  navy: '#16324F', graphite: '#3A3F47', blue: '#2F6FDE', teal: '#12A37F', amber: '#E08A00', rose: '#D2495F',
  land: '#ECEDEF', sea: '#DCE7F3', must: '#E5484D',
};
export const DAY = [C.blue, C.teal, C.amber, C.rose];

export function setup({ w, h, bg = C.white, fov = 32, cam = [0, 6, 8], target = [0, 0, 0], ortho = 0 }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('frame').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const camera = ortho
    ? new THREE.OrthographicCamera((-ortho * w) / h, (ortho * w) / h, ortho, -ortho, 0.1, 200)
    : new THREE.PerspectiveCamera(fov, w / h, 0.1, 200);
  camera.position.set(...cam);
  camera.lookAt(...target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bec8, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-4, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.5, far: 40 });
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const render = () => renderer.render(scene, camera);
  return { renderer, scene, camera, render };
}

/** A shadow-catching floor: only the soft shadow shows on the page background. */
export function shadowFloor(scene, y = 0, size = 40, opacity = 0.12) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...opts });
}

export function rbox(w, h, d, r, color, opts) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Text drawn on a canvas, as a sprite that always faces the camera. `h` is its height in scene units. */
export function label(text, { h = 0.28, color = C.ink, bg = C.white, border = C.line, weight = 600, size = 64, pad = 0.55, radius = 0.5, sub = null, subColor = C.muted, accent = null } = {}) {
  const lines = [{ t: text, s: size, w: weight, c: color }, ...(sub ? [{ t: sub, s: Math.round(size * 0.72), w: 500, c: subColor }] : [])];
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const font = (l) => `${l.w} ${l.s}px "Apple SD Gothic Neo", "Pretendard", sans-serif`;
  let tw = 0;
  for (const l of lines) { ctx.font = font(l); tw = Math.max(tw, ctx.measureText(l.t).width); }
  const lh = lines.reduce((a, l) => a + l.s * 1.28, 0);
  const px = size * pad, py = size * pad * 0.62;
  const dot = accent ? size * 0.42 : 0;
  cv.width = Math.ceil(tw + px * 2 + (dot ? dot + size * 0.3 : 0));
  cv.height = Math.ceil(lh + py * 2);
  const r = Math.min(cv.height / 2, size * radius);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.strokeStyle = border || bg;
    ctx.lineWidth = border ? 3 : 0;
    ctx.beginPath();
    ctx.roundRect(2, 2, cv.width - 4, cv.height - 4, r);
    ctx.fill();
    if (border) ctx.stroke();
  }
  let y = py;
  lines.forEach((l, i) => {
    ctx.font = font(l);
    ctx.fillStyle = l.c;
    ctx.textBaseline = 'top';
    const x = px + (dot && i === 0 ? dot + size * 0.3 : dot ? dot + size * 0.3 : 0);
    if (dot && i === 0) { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(px + dot / 2, y + l.s * 0.58, dot / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = l.c; }
    ctx.fillText(l.t, x, y + l.s * 0.08);
    y += l.s * 1.28;
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set((h * cv.width) / cv.height, h, 1);
  sp.renderOrder = 10;
  return sp;
}

export function loadTex(url) {
  return new Promise((res) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }));
}

/** A screen: a dark device body with the screenshot set in it. */
export async function device(url, w, h, { bezel = 0.06, depth = 0.08, color = '#23262B', radius = 0.08 } = {}) {
  const g = new THREE.Group();
  const body = rbox(w + bezel * 2, h + bezel * 2, depth, radius, color, { roughness: 0.4 });
  g.add(body);
  const tex = await loadTex(url);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scr.position.z = depth / 2 + 0.002;
  g.add(scr);
  return g;
}

export function tube(points, radius, color, { closed = false, tension = 0.4, opts = {} } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', tension);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(40, points.length * 24), radius, 12, closed), mat(color, { roughness: 0.45, ...opts }));
  m.castShadow = true;
  return m;
}

export function pin(color, { h = 0.22, r = 0.055 } = {}) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, h, 12), mat('#ffffff'));
  stem.position.y = h / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color, { roughness: 0.35 }));
  head.position.y = h + r * 0.6;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.18, 8, 24), mat('#ffffff'));
  ring.position.y = h + r * 0.6;
  ring.rotation.x = Math.PI / 2;
  for (const m of [stem, head]) m.castShadow = true;
  g.add(stem, head, ring);
  return g;
}

/** A simple car: body, cabin, four wheels. Length along +x. */
export function car(color = '#F7F7F8', { s = 1 } = {}) {
  const g = new THREE.Group();
  const body = rbox(1.0 * s, 0.26 * s, 0.48 * s, 0.1 * s, color, { roughness: 0.35, metalness: 0.1 });
  body.position.y = 0.2 * s;
  const cabin = rbox(0.56 * s, 0.22 * s, 0.42 * s, 0.09 * s, '#2B3038', { roughness: 0.2, metalness: 0.2 });
  cabin.position.set(-0.04 * s, 0.4 * s, 0);
  g.add(body, cabin);
  for (const [x, z] of [[0.3, 0.22], [-0.3, 0.22], [0.3, -0.22], [-0.3, -0.22]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.07 * s, 20), mat('#1E2126'));
    w.rotation.x = Math.PI / 2;
    w.position.set(x * s, 0.1 * s, z * s);
    w.castShadow = true;
    g.add(w);
  }
  return g;
}

/** A dashed arc between two points, lifted by `lift` at its middle. */
export function arc(a, b, lift, color, { dash = 0.12, gap = 0.08, width = 0.022 } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const M = A.clone().add(B).multiplyScalar(0.5); M.y += lift;
  const curve = new THREE.QuadraticBezierCurve3(A, M, B);
  const g = new THREE.Group();
  const len = curve.getLength();
  const n = Math.floor(len / (dash + gap));
  for (let i = 0; i < n; i++) {
    const t0 = (i * (dash + gap)) / len, t1 = (i * (dash + gap) + dash) / len;
    const seg = new THREE.TubeGeometry(new THREE.LineCurve3(curve.getPoint(t0), curve.getPoint(Math.min(1, t1))), 1, width, 8);
    g.add(new THREE.Mesh(seg, mat(color, { roughness: 0.4 })));
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(width * 3.2, width * 8, 16), mat(color));
  const p = curve.getPoint(1), q = curve.getPoint(0.97);
  tip.position.copy(p);
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(q).normalize());
  g.add(tip);
  return g;
}

export const done = (render) => { render(); requestAnimationFrame(() => { render(); window.__ready = true; }); };

/* ---------- 강릉 sample geography ---------- */
export const GEO = {
  cheolttuk: [37.892, 128.826], youngjin: [37.873, 128.842], bohemian: [37.8452, 128.8738], skybay: [37.804, 128.908],
  lake: [37.7955, 128.8975], donghwa: [37.791, 128.9145], mandong: [37.7547, 128.8986], umji: [37.768, 128.91], shilla: [37.7963, 128.9196],
  gyodong: [37.759, 128.897], terarosa: [37.715, 128.893], topsten: [37.648, 129.057], badabuchae: [37.6658, 129.048], anmok: [37.772, 128.947],
};
export const COAST = [[37.97, 128.79], [37.93, 128.81], [37.90, 128.832], [37.875, 128.852], [37.85, 128.876], [37.825, 128.893], [37.808, 128.912], [37.79, 128.93], [37.772, 128.952], [37.75, 128.968], [37.72, 128.988], [37.69, 129.012], [37.665, 129.052], [37.64, 129.07], [37.60, 129.09]];
/** lat/lon → scene x/z (1 unit ≈ `k` km), centred on 37.78 N, 128.93 E. */
export const proj = ([lat, lon], k = 10) => [((lon - 128.93) * 88) / k, (-(lat - 37.78) * 111) / k];
