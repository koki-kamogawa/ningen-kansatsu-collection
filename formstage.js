import * as THREE from './lib/three.module.js';
import { buildAvatar, applyPose, CLAY } from './avatar.js';

/* =========================================================
   登録画面のキャラ台。小さな浮島の上に、登録中の人が立つ。
   左右にドラッグすると島ごと回る。
   ========================================================= */
const hsh = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const BALL = new THREE.SphereGeometry(1, 14, 10), TUBE = new THREE.CylinderGeometry(1, 1, 1, 14), BRICK = new THREE.BoxGeometry(1, 1, 1);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const M = (x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), V(sx, sy, sz));
class Kit {
  constructor() { this.q = []; }
  add(g, c, m) { this.q.push([g, new THREE.Color(c), m]); }
  mesh(cast = true, recv = true) {
    let vn = 0, ix = 0; for (const [g] of this.q) { vn += g.attributes.position.count; ix += g.index.count; }
    const pos = new Float32Array(vn * 3), nor = new Float32Array(vn * 3), col = new Float32Array(vn * 3), idx = new Uint32Array(ix); let v = 0, i = 0;
    const a = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const [g, c, m] of this.q) {
      nm.getNormalMatrix(m); const P = g.attributes.position, N = g.attributes.normal;
      for (let k = 0; k < P.count; k++) { a.fromBufferAttribute(P, k).applyMatrix4(m); pos.set([a.x, a.y, a.z], (v + k) * 3); a.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); nor.set([a.x, a.y, a.z], (v + k) * 3); col.set([c.r, c.g, c.b], (v + k) * 3); }
      for (let k = 0; k < g.index.count; k++) idx[i++] = g.index.getX(k) + v;
      v += P.count;
    }
    const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(pos, 3)); b.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); b.setAttribute('color', new THREE.BufferAttribute(col, 3)); b.setIndex(new THREE.BufferAttribute(idx, 1));
    const out = new THREE.Mesh(b, CLAY); out.castShadow = cast; out.receiveShadow = recv; return out;
  }
}
const ROCKG = new THREE.SphereGeometry(1, 5, 3);
const GRASS = ['#86AC40', '#769C38', '#94B84C'], ROCK = ['#A9A398', '#8F897E', '#B8B2A6'], LEAF = ['#F2A32E', '#EE7F2B', '#F6C23C', '#E0612B'];
// 草の台地、土、岩の底でできた浮島
function makeIsle(R, seed = 1, detail = 1) {
  const k = new Kit(), n = Math.round(58 * detail);
  k.add(TUBE, GRASS[0], M(0, -.03, 0, R, .06, R));
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283 + hsh(i, seed) * .2, r = R * (.97 + hsh(i, seed + 1) * .05), s = R * (.06 + hsh(i, seed + 2) * .05);
    k.add(BALL, GRASS[i % 3], M(Math.cos(a) * r, -.045 - hsh(i, seed + 3) * .03, Math.sin(a) * r, s, s * .85, s));
  }
  for (let i = 0; i < n * 1.3; i++) {
    const a = hsh(i, seed + 4) * 6.283, d = hsh(i, seed + 5), r = R * (.3 + d * .68), s = R * (.1 + (1 - d) * .1) * (.8 + hsh(i, seed + 6) * .5), y = -.08 - (1 - d) * R * .46 * (.7 + hsh(i, seed + 7) * .4);
    k.add(ROCKG, ROCK[i % 3], M(Math.cos(a) * r, y, Math.sin(a) * r, s * 1.15, s * .8, s * 1.15, hsh(i, seed + 8) * 3, hsh(i, seed + 9) * 3, hsh(i, seed + 10) * 3));
  }
  k.add(BALL, '#9B7A55', M(0, -.1, 0, R * .98, R * .08, R * .98));
  return k;
}
function addTree(k, x, z, h = .54, seed = 3) {
  k.add(TUBE, '#7A5238', M(x, h * .3, z, .034, h * .62, .034));
  k.add(TUBE, '#7A5238', M(x + .05, h * .5, z, .016, h * .32, .016, 0, 0, -.62));
  k.add(TUBE, '#7A5238', M(x - .05, h * .46, z + .01, .016, h * .3, .016, 0, 0, .7));
  const G = new THREE.SphereGeometry(1, 6, 4), TOPL = ['#F9D04E', '#F7C23C', '#F4AE2E'], LOWL = ['#F09A2C', '#EC7A2A', '#E2622A'];
  const lobes = [[0, .84, 0, .2], [-.2, .7, .04, .17], [.2, .72, -.02, .17], [.04, .62, .1, .14], [-.08, .98, .02, .13], [.12, .96, 0, .11], [-.27, .58, -.02, .1]];
  lobes.forEach(([lx, ly, lz, lr], li) => { for (let i = 0; i < 36; i++) {
    const a = hsh(i, seed + li * 9) * 6.283, b = hsh(i, seed + li * 9 + 1) * 3.14, r = h * lr * (.75 + hsh(i, seed + li * 9 + 2) * .3), s = h * (.05 + hsh(i, seed + li * 9 + 3) * .035), yy = h * ly + Math.cos(b) * r, top = yy / h > .74;
    k.add(G, (top ? TOPL : LOWL)[i % 3], M(x + h * lx + Math.cos(a) * Math.sin(b) * r, yy, z + h * lz + Math.sin(a) * Math.sin(b) * r, s, s * .72, s, i * 1.3, i * 2.1, i * .7));
  } });
}
function addBench(k, x, z, ry) {
  const wood = '#A9743F', dark = '#7A5238', c = Math.cos(ry), s = Math.sin(ry), P = (a, y, b) => [x + a * c + b * s, y, z - a * s + b * c];
  for (const b of [-.02, .025]) k.add(BRICK, wood, M(...P(0, .1, b), .3, .014, .04, 0, ry, 0));
  for (const y of [.15, .19]) k.add(BRICK, wood, M(...P(0, y, -.05), .3, .03, .012, 0, ry, 0));
  for (const a of [-.12, .12]) { k.add(BRICK, dark, M(...P(a, .05, 0), .022, .1, .09, 0, ry, 0)); k.add(BRICK, dark, M(...P(a, .15, -.055), .02, .11, .012, 0, ry, 0)); }
}
function miniIsle(seed, R, house) {
  const g = new THREE.Group(), k = makeIsle(R, seed, .55);
  if (house) {
    k.add(BRICK, '#F2ECDD', M(0, R * .3, 0, R * .62, R * .55, R * .55));
    k.add(new THREE.ConeGeometry(1, 1, 4), '#D8703A', M(0, R * .76, 0, R * .6, R * .42, R * .6, 0, .785));
  } else for (let i = 0; i < 3; i++) k.add(BALL, LEAF[i], M(-R * .3 + i * R * .3, R * .32 + (i % 2) * R * .12, 0, R * .3));
  g.add(k.mesh(false, false)); return g;
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(15, 1, .1, 50);
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#F3E6D2', 2.3)); scene.fog = new THREE.Fog('#E6F3FA', 8, 11); { const fl = new THREE.DirectionalLight('#FFF6EA', .55); fl.position.set(.4, .6, 4); scene.add(fl); }
  const key = new THREE.DirectionalLight('#FFF1DC', 1.25); key.position.set(1.6, 3.2, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1.1, right: 1.1, top: 1.5, bottom: -1, near: .5, far: 9 }); key.shadow.radius = 5; key.shadow.bias = -.0006; key.shadow.normalBias = .02; scene.add(key);
  const rim = new THREE.DirectionalLight('#CFE8FF', .7); rim.position.set(-2.4, 1.4, -2); scene.add(rim);

  const turn = new THREE.Group(); scene.add(turn);
  const k = makeIsle(.46, 7);
  addTree(k, -.19, -.22, .56); addBench(k, -.22, 0, -.25);
  for (let i = 0; i < 46; i++) {
    const a = hsh(i, 20) * 6.283, r = .08 + hsh(i, 21) * .3;
    k.add(BALL, LEAF[i % 4], M(Math.cos(a) * r, .004, Math.sin(a) * r, .018, .004, .026, 0, a, 0));
  }
  for (const [x, z, s] of [[.22, -.2, .036], [-.33, .03, .05], [-.3, .13, .03]]) k.add(BALL, ROCK[1], M(x, s * .4, z, s, s * .72, s));
  turn.add(k.mesh());

  const far = [[.46, .6, -1.6, .09, true, 4], [-.5, .56, -1.6, .06, false, 5], [.42, .18, -1.6, .075, true, 6]].map(([x, y, z, R, h, s]) => { const m = miniIsle(s, R, h); m.position.set(x, y, z); scene.add(m); return { m, y }; });

  let nodT = 9, person = null, pose = 'stand', holdBook = false, hopT = 9, W = 1, H = 1, running = false, raf = 0, last = 0, spin = 0, vel = 0, drag = null, blink = 2, blinkT = 0;
  const holder = new THREE.Group(); holder.position.set(.02, 0, .1); turn.add(holder);

  function show() { if (!person) return; const u = person.userData; u.book.visible = holdBook; u.pen.visible = pose === 'write'; if (pose === 'write' || pose === 'read') { u.book.rotation.set(1.05, 0, 0); u.book.position.set(0, -.02, .05); } else { u.book.rotation.set(1.53, Math.PI, 0); u.book.position.set(0, -.05, .03); } }
  function setPerson(look, traits, seen) {
    const old = person;
    person = buildAvatar({ look, traits, seen }); person.traverse(o => { if (o.isMesh) o.castShadow = true; });
    if (old) { const a = old.userData, b = person.userData; for (const i of [0, 1]) { b.arms[i].rotation.copy(a.arms[i].rotation); b.fores[i].rotation.copy(a.fores[i].rotation); } b.headG.rotation.copy(a.headG.rotation); holder.remove(old); old.traverse(o => { if (o.isMesh && o.geometry.attributes.color && o.geometry !== undefined) o.geometry.dispose(); }); }
    else applyPose(person.userData, pose, 1);
    holder.add(person); show();
  }
  function frame(now) {
    if (!running) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; const T = now / 1000;
    if (!drag) { vel *= .93; spin += vel * dt; const back = spin % 6.283; if (Math.abs(vel) < .05) spin += (Math.round(spin / 6.283) * 6.283 - spin) * .03; }
    turn.rotation.y = .44 + spin; turn.position.y = Math.sin(T * .9) * .012;
    far.forEach((f, i) => f.m.position.y = f.y + Math.sin(T * .7 + i * 2) * .02);
    if (person) {
      const u = person.userData; applyPose(u, pose, .14);
      nodT += dt; if (nodT < .2) u.headG.rotation.x += Math.sin(nodT / .2 * Math.PI) * .1;   // 文字を打つと小さくうなずく
      hopT += dt; const h = hopT < .42 ? Math.sin(hopT / .42 * Math.PI) : 0;
      u.inner.position.y = h * .035; u.inner.scale.set(1 + h * .03, 1 - h * .02 + Math.sin(T * 2) * .006, 1 + h * .03);
      blink -= dt; if (blink < 0) { blinkT = .11; blink = 2.2 + Math.random() * 2.6; } blinkT -= dt; u.eyes.scale.y = blinkT > 0 ? .1 : 1;
    }
    renderer.render(scene, cam);
  }
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); cam.aspect = W / H;
    // 主役を左側に置き、右の文字とぶつからない位置にする
    const span = H / 136; cam.position.set(0, 1.1, 7.4); cam.lookAt(0, .3, 0); cam.fov = 2 * Math.atan(span / 2 / 7.5) * 180 / Math.PI;
    cam.setViewOffset(W, H, W * .3, -H * .068, W, H); cam.updateProjectionMatrix();
  }
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: spin, t: performance.now() }; vel = 0; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const n = performance.now(), d = (e.clientX - drag.x) * .012, ns = drag.s + d; vel = (ns - spin) / Math.max(.008, (n - drag.t) / 1000) * .35; drag.t = n; spin = ns; });
  const end = () => { drag = null; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  // 見出しや送り先に使う、小さな浮島の絵
  function isleShot() {
    const sc = new THREE.Scene(), c = new THREE.PerspectiveCamera(16, 1.3, .1, 30), rt = new THREE.WebGLRenderTarget(312, 240);
    rt.texture.colorSpace = THREE.SRGBColorSpace; sc.add(new THREE.HemisphereLight('#FFFFFF', '#D6DDC8', 1.5)); const l = new THREE.DirectionalLight('#FFF1DC', 2); l.position.set(1.6, 3, 3); sc.add(l);
    const kk = makeIsle(.5, 7); addTree(kk, -.2, -.1, .56); kk.add(BRICK, '#F2ECDD', M(.2, .13, .06, .24, .24, .22)); kk.add(new THREE.ConeGeometry(1, 1, 4), '#D8703A', M(.2, .34, .06, .24, .2, .24, 0, .785));
    kk.add(BRICK, '#7A5238', M(.2, .06, .175, .06, .11, .01)); sc.add(kk.mesh(false, false));
    c.position.set(0, .7, 3.7); c.lookAt(0, .13, 0);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, c);
    const px = new Uint8Array(312 * 240 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 312, 240, px); renderer.setRenderTarget(null); rt.dispose();
    const cv = document.createElement('canvas'); cv.width = 312; cv.height = 240; const x = cv.getContext('2d'), img = x.createImageData(312, 240);
    for (let r = 0; r < 240; r++) img.data.set(px.subarray((239 - r) * 1248, (240 - r) * 1248), r * 1248);
    x.putImageData(img, 0, 0); return cv.toDataURL('image/png');
  }
  return {
    isleShot, setPerson, nod() { nodT = 0; }, setPose(p, book = false) { pose = p; holdBook = book; show(); }, hop() { hopT = 0; }, resize,
    start() { if (running) return; running = true; last = performance.now(); resize(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    spinTo(v) { spin = v; vel = 0; },
  };
}
