import * as THREE from './lib/three.module.js';

/* =========================================================
   キャラクター
   頭身の低いフィギュア風の人形を、丸い部品の組み合わせで作る。
   部品は色つきのまま1つの形にまとめ、描画の回数を減らす。
   顔は選べない。性格の5つの数値から決まる。
   足もとが y=0、ふつうの背格好で高さ約1.0。正面は +z。
   ========================================================= */

export const CLAY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 });

const UNIT = {};
const unit = (k, f) => UNIT[k] || (UNIT[k] = f());
const ball = () => unit('ball', () => new THREE.SphereGeometry(1, 18, 12));
const lowBall = () => unit('lowball', () => new THREE.SphereGeometry(1, 11, 8));
const pill = (r, l) => unit(`pill${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
const tube = (a, b, h, n = 18) => unit(`tube${a},${b},${h}`, () => new THREE.CylinderGeometry(a, b, h, n));
const ring = (r, t) => unit(`ring${r},${t}`, () => new THREE.TorusGeometry(r, t, 8, 26));
const shell = (cut) => unit(`shell${cut}`, () => new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * cut));
const brick = () => unit('brick', () => new THREE.BoxGeometry(1, 1, 1));

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const TR = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));

// 色つきの部品を集めて、1つの形にする
class Part {
  constructor() { this.items = []; }
  add(g, color, m) { this.items.push([g, new THREE.Color(color), m]); return this; }
  build() {
    let vn = 0, ix = 0;
    for (const [g] of this.items) { vn += g.attributes.position.count; ix += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(vn * 3), nor = new Float32Array(vn * 3), col = new Float32Array(vn * 3), idx = new Uint32Array(ix);
    let v = 0, i = 0; const a = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const [g, c, m] of this.items) {
      nm.getNormalMatrix(m);
      const P = g.attributes.position, N = g.attributes.normal, n = P.count;
      for (let k = 0; k < n; k++) {
        a.fromBufferAttribute(P, k).applyMatrix4(m); pos.set([a.x, a.y, a.z], (v + k) * 3);
        a.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); nor.set([a.x, a.y, a.z], (v + k) * 3);
        col.set([c.r, c.g, c.b], (v + k) * 3);
      }
      if (g.index) for (let k = 0; k < g.index.count; k++) idx[i++] = g.index.getX(k) + v;
      else for (let k = 0; k < n; k++) idx[i++] = k + v;
      v += n;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  mesh() { const m = new THREE.Mesh(this.build(), CLAY); m.castShadow = true; return m; }
}
// 明るくする時は白を混ぜず、色みを保ったまま持ち上げる（黒髪が灰色にならないように）
const shade = (hex, k) => { const c = new THREE.Color(hex); if (k < 0) return c.lerp(new THREE.Color('#10222E'), -k); const hsl = c.getHSL({}); return c.setHSL(hsl.h, hsl.s, Math.min(.92, hsl.l * (1 + k * 2.2) + k * .06)); };
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ズボンは上着の色に合う色を選ぶ
function pantsOf(c) {
  const l = new THREE.Color(c).getHSL({}).l;
  return l < .34 ? '#C9B08A' : l > .72 ? '#47566A' : new THREE.Color(c).getHSL({}).s > .4 ? '#3F4C5E' : '#C9B08A';
}

/* ---------- 顔 ---------- */
// 5つの性格が、それぞれ別の部分を動かす
//  好奇心=目の大きさ  元気=まぶた  やさしさ=目尻と眉の角度とほお  几帳面=眉の太さと整い方  人づきあい=口
export function faceParams(tr = {}) {
  const t = { soc: .5, act: .5, tidy: .5, cur: .5, kind: .5, ...tr };
  return {
    eyeW: .86 + t.cur * .34,
    eyeH: (.84 + t.cur * .42) * (1 - smooth(.5, .1, t.act) * .5),
    lid: smooth(.5, .1, t.act),
    eyeTilt: (t.kind - .5) * -.75,
    gaze: t.cur > .72 ? (t.cur - .72) * .05 : 0,
    browLift: .012 + t.cur * .012 + t.act * .012,
    browTilt: (t.kind - .5) * -.9,
    browThick: 2 - t.tidy * 1.5,
    browUneven: smooth(.42, .1, t.tidy),
    mouthW: .022 + t.soc * .036,
    smile: .006 + (t.soc * .55 + t.kind * .45) * .026,
    open: smooth(.68, .86, t.soc),
    blush: smooth(.42, .85, t.kind),
  };
}
const HEAD = { y: .735, r: .228, sx: 1.04, sy: .95, sz: .96 };
// 頭の表面の z（顔の部品を肌の上に置くため）
function faceZ(x, y) {
  const dx = x / (HEAD.r * HEAD.sx), dy = (y - HEAD.y) / (HEAD.r * HEAD.sy), v = 1 - dx * dx - dy * dy;
  return HEAD.r * HEAD.sz * Math.sqrt(Math.max(.02, v));
}
function addFace(head, eyes, skin, hair, f) {
  const lowHair = shade(hair, -.1), EY = .712;
  // まゆ毛
  for (const sx of [-1, 1]) {
    const bx = sx * .098, by = EY + .084 + f.browLift + (sx > 0 ? f.browUneven * .011 : -f.browUneven * .006), rot = sx * (f.browTilt + (sx > 0 ? f.browUneven * .4 : -f.browUneven * .12));
    head.add(pill(.0098, .07), lowHair, TR(bx, by, faceZ(bx, by) + .002, -.3, sx * .3, Math.PI / 2 + rot, f.browThick, 1, .6));
  }
  // 目
  const eyeM = new Part();
  for (const sx of [-1, 1]) {
    const ex = sx * .097, ez = faceZ(ex, EY), rz = sx * f.eyeTilt, ry = sx * .4;
    eyeM.add(ball(), '#2A2320', TR(ex, 0, ez - .004, 0, ry, rz, .032 * f.eyeW, .04 * f.eyeH, .012));
    eyeM.add(lowBall(), '#FFFFFF', TR(ex - .009 + f.gaze, .013 * f.eyeH, ez + .007, 0, 0, 0, .0095 * f.eyeW, .0115 * f.eyeH, .004));
    eyeM.add(lowBall(), '#FFFFFF', TR(ex + .009 + f.gaze, -.011 * f.eyeH, ez + .006, 0, 0, 0, .004, .004, .002));
    if (f.lid > .05) head.add(pill(.0052, .066 * f.eyeW), '#1B2A33', TR(ex, EY + .046 * f.eyeH - .004, ez + .007, 0, ry, Math.PI / 2 + rz));   // 眠そうなまぶた
  }
  // 鼻
  head.add(lowBall(), shade(skin, -.06), TR(0, .668, faceZ(0, .668) + .002, 0, 0, 0, .016, .012, .012));
  // ほお
  if (f.blush > .02) for (const sx of [-1, 1]) {
    const cx = sx * .145, cy = .656;
    head.add(lowBall(), mix(skin, '#F08A7A', .22 + f.blush * .34), TR(cx, cy, faceZ(cx, cy) - .002, 0, sx * .6, 0, .03, .019, .007));
  }
  // 口
  const my = .63, w = f.mouthW * .9;
  if (f.open > .5) {
    const s = new THREE.Shape(); s.moveTo(-w, 0); s.quadraticCurveTo(0, .006, w, 0); s.quadraticCurveTo(w * .8, -w * 1.15, 0, -w * 1.2); s.quadraticCurveTo(-w * .8, -w * 1.15, -w, 0);
    const g = new THREE.ShapeGeometry(s, 10);
    head.add(g, '#8C3A36', TR(0, my + .006, faceZ(0, my) + .005));
    const tt = new THREE.Shape(); tt.absellipse(0, -w * .95, w * .55, w * .3, 0, Math.PI * 2, false, 0);
    head.add(new THREE.ShapeGeometry(tt, 10), '#E08A80', TR(0, my + .006, faceZ(0, my) + .0056));
  } else {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10 * 2 - 1, x = u * w; pts.push(new THREE.Vector3(x, my + f.smile * (u * u), faceZ(x, my) + .004)); }
    head.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .0044, 6), '#B8664E', TR());
  }
  return eyeM;
}

/* ---------- 髪 ---------- */
function addHair(head, L, skin) {
  const h = L.hair, hi = shade(h, .045), lo = shade(h, -.1), c = HEAD, R0 = c.r;
  const puff = (x, y, z, sx, sy, sz, col = h, rz = 0, rx = 0) => head.add(lowBall(), col, TR(x, c.y + y, z, rx, 0, rz, sx, sy, sz));
  // 頭の上半分を覆う土台。少し後ろへ傾けて額を出す
  const base = (cut = .5, tilt = -.66, grow = 1.03) => head.add(shell(cut), h, TR(0, c.y + .004, -.004, tilt, 0, 0, R0 * c.sx * grow, R0 * c.sy * grow, R0 * c.sz * grow));
  // 前髪と頭頂の、ふわっとした束
  const waves = () => {
    const tufts = [[-.05, .196, .128, .178, .05, .08, h, .3], [-.178, .118, .088, .092, .04, .074, hi, .78], [.135, .176, .108, .1, .042, .074, lo, -.46], [.212, .082, .05, .04, .096, .07, lo, -.2],
      [-.226, .03, .03, .046, .104, .08, h, .16], [-.03, .256, .02, .17, .05, .118, hi, .12], [.106, .236, -.02, .13, .05, .108, h, -.28], [0, .25, -.09, .14, .05, .12, lo, 0], [-.165, .17, -.07, .105, .09, .115, lo, .42], [.165, .16, -.07, .1, .085, .11, lo, -.42]];
    for (const [x, y, z, a, b, d, col, r] of tufts) puff(x, y, z, a, b, d, col, r);
  };
  if (L.style === 'bald') { head.add(shell(.5), mix(skin, h, .55), TR(0, c.y + .006, -.006, -.56, 0, 0, R0 * c.sx * 1.01, R0 * c.sy * 1.01, R0 * c.sz * 1.01)); return; }
  if (L.style === 'cap') {
    const cc = '#CDAF82', cd = shade(cc, -.14), r = R0 * 1.08;
    for (const sx of [-1, 1]) { puff(sx * .224, -.012, -.01, .03, .08, .07, h); puff(sx * .13, .058, .17, .05, .024, .03, h, sx * -.3); }
    puff(0, .03, -.19, .19, .15, .05, lo);
    head.add(shell(.5), cc, TR(0, c.y + .1, -.016, -.12, 0, 0, r * 1.0, r * .86, r * .98));
    head.add(tube(r * .985, r * 1.0, .03), cd, TR(0, c.y + .092, -.012, -.12, 0, 0, 1, 1, .98));
    head.add(ball(), cd, TR(0, c.y + .1 + r * .86, -.04, 0, 0, 0, .016, .011, .016));
    head.add(ball(), cc, TR(0, c.y + .1, .214, .16, 0, 0, .168, .016, .102));
    return;
  }
  base();
  waves();
  if (L.style === 'short') {
    for (const sx of [-1, 1]) puff(sx * .22, .005, -.05, .03, .084, .09, sx > 0 ? lo : h);
    puff(0, .02, -.17, .19, .17, .075, lo);
  }
  if (L.style === 'long') {   // あごまでのふんわりしたボブ
    puff(0, -.03, -.16, .225, .215, .1, lo);
    for (const sx of [-1, 1]) {
      puff(sx * .218, .03, -.01, .062, .13, .11, h, sx * -.05);
      puff(sx * .226, -.1, -.02, .07, .115, .112, sx > 0 ? lo : h, sx * .1);
      puff(sx * .17, -.19, -.05, .074, .05, .09, lo, sx * .5);
    }
  }
  if (L.style === 'bun') {
    for (const sx of [-1, 1]) puff(sx * .22, .01, -.05, .028, .074, .084, h);
    puff(0, .01, -.175, .185, .155, .07, lo);
    puff(0, .305, -.07, .088, .08, .086, hi);
    puff(.035, .325, -.04, .04, .03, .04, h);
    head.add(ring(.052, .012), '#C9A97A', TR(0, c.y + .248, -.05, Math.PI / 2 - .25, 0, 0));
  }
}
function addGlasses(head) {
  const c = '#16242C', y = .712;
  for (const sx of [-1, 1]) {
    const x = sx * .098;
    head.add(ring(.072, .0072), c, TR(x, y, faceZ(x, y) + .018, 0, sx * .36, 0));
    head.add(pill(.0056, .062), c, TR(sx * .198, y + .012, .142, Math.PI / 2, sx * -.84, 0));
    head.add(pill(.0056, .12), c, TR(sx * .238, y + .012, .05, Math.PI / 2, sx * -.05, 0));
  }
  head.add(pill(.0058, .05), c, TR(0, y + .024, faceZ(0, y) + .024, 0, 0, Math.PI / 2));
}

/* ---------- 体 ---------- */
const BUILD = {
  s: { w: .92, leg: 1, h: .94 },
  m: { w: 1, leg: 1.22, h: 1 },
  l: { w: 1.08, leg: 1.44, h: 1.08 },
};
export const HEIGHT_OF = size => (BUILD[size] || BUILD.m).h;

export function buildAvatar({ look: L, traits, seen = [] }) {
  const has = t => seen.includes(t), B = BUILD[L.size] || BUILD.m, w = B.w;
  const coat = L.clothes, coatLo = shade(coat, -.14), coatHi = shade(coat, .08), pants = pantsOf(coat), skin = L.skin, tee = new THREE.Color(coat).getHSL({}).l > .8 ? '#6E8797' : '#F2ECDD';
  const legL = .26 * B.leg, hip = legL + .04;       // 腰の高さ
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);

  // 脚
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * .074 * w, hip, 0); leg.rotation.y = sx * .17;
    const p = new Part();
    p.add(pill(.068, legL - .13), pants, TR(0, -legL * .46, 0));
    p.add(tube(.073, .076, .034), shade(pants, .05), TR(0, -legL + .058, 0));
    p.add(ball(), '#6B4530', TR(0, -legL + .012, .03, 0, 0, 0, .072, .05, .108));
    p.add(tube(.064, .067, .012), '#4A3324', TR(0, -legL - .03, .034, 0, 0, 0, 1, 1, 1.5));
    leg.add(p.mesh()); inner.add(leg); legs.push(leg);
  }

  // 胴
  const body = new Part(), y0 = hip, top = hip + .25;
  const by = (y0 + top) / 2;
  body.add(pill(.128 * w, .1), coat, TR(0, by + .012, 0, 0, 0, 0, 1.06, 1, .78));
  body.add(tube(.136 * w, .146 * w, .09), coat, TR(0, y0 + .012, 0, 0, 0, 0, 1, 1, .76));
  body.add(tube(.146 * w, .148 * w, .012), coatLo, TR(0, y0 - .03, 0, 0, 0, 0, 1, 1, .77));
  body.add(pill(.056, .125), tee, TR(0, by + .012, .094 * w, -.03, 0, 0, 1.18 * w, 1, .5));
  body.add(ball(), tee, TR(0, top - .01, .07, 0, 0, 0, .06 * w, .036, .036));
    for (const sx of [-1, 1]) {
    body.add(brick(), coat, TR(sx * .074 * w, by + .012, .1 * w + .012, -.03, 0, 0, .038 * w, .2, .012));                // 前立て
    body.add(ball(), coatHi, TR(sx * .062 * w, top - .012, .1, -.3, sx * .3, sx * -.72, .058, .03, .014));     // 襟
    body.add(brick(), coatLo, TR(sx * .094 * w, by + .05, .098 * w + .006, 0, sx * .24, 0, .05, .042, .007));           // ポケット
    body.add(brick(), coatHi, TR(sx * .094 * w, by + .074, .098 * w + .009, 0, sx * .24, 0, .054, .01, .009));
  }
  for (const y of [by + .05, by - .01, by - .07]) body.add(lowBall(), '#C9A97A', TR(.058 * w, y, .1 * w + .02, 0, 0, 0, .0082, .0082, .004));
  body.add(tube(.046, .052, .05), skin, TR(0, top + .016, 0));
  if (has('身なりがきっちりしていた')) {
    body.add(brick(), '#F2ECDD', TR(.094 * w, by + .086, .098 * w + .007, 0, .24, .2, .034, .018, .006));
  }
  if (has('持ち物がごちゃっとしていた')) {
    body.add(ball(), '#8A6A48', TR(0, by, -.135, 0, 0, 0, .112, .135, .07));
    body.add(ball(), '#A07E58', TR(0, by - .05, -.19, 0, 0, 0, .07, .05, .03));
    body.add(pill(.008, .13), '#C9A97A', TR(.05, by + .155, -.14, 0, 0, .35));
    body.add(brick(), '#F2ECDD', TR(-.04, by + .14, -.14, 0, 0, -.25, .075, .1, .012));
  }
  const torso = body.mesh(); inner.add(torso);

  // 腕。肩とひじの2か所で曲がる
  const arms = [], fores = [], hands = [], armL = .118;
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * .152 * w, top - .03, 0); arm.rotation.z = sx * .1;
    const up = new Part().add(pill(.05, armL - .04), coat, TR(0, -armL / 2, 0));
    arm.add(up.mesh());
    const fore = new THREE.Group(); fore.position.y = -armL; arm.add(fore);
    const f = new Part();
    f.add(pill(.046, armL - .05), coat, TR(0, -armL / 2 + .004, 0));
    f.add(tube(.05, .052, .024), coatLo, TR(0, -armL + .018, 0));
    f.add(ball(), skin, TR(0, -armL - .016, 0, 0, 0, 0, .04, .044, .042));
    fore.add(f.mesh());
    const hand = new THREE.Group(); hand.position.y = -armL - .02; fore.add(hand);
    inner.add(arm); arms.push(arm); fores.push(fore); hands.push(hand);
  }
  // 手に持つもの
  if (has('荷物を持ってあげていた')) {
    const t = new Part();
    t.add(brick(), '#D8C4A0', TR(0, -.15, 0, 0, 0, 0, .15, .17, .055));
    t.add(ring(.05, .006), '#B39B72', TR(0, -.07, 0));
    hands[1].add(t.mesh());
  }
  let watchHand = null;
  if (has('しきりに時計を見ていた')) {
    const t = new Part();
    t.add(tube(.052, .052, .018), '#27343C', TR(0, .022, 0));
    t.add(tube(.026, .026, .01), '#F2ECDD', TR(0, .022, .05, Math.PI / 2, 0, 0));
    hands[0].add(t.mesh()); watchHand = t;
  }
  // 手帳とペン。場面に応じて見せる
  const book = new THREE.Group();
  { const b = new Part();
    b.add(brick(), '#7A4A2E', TR(0, 0, 0, 0, 0, 0, .13, .17, .03));
    b.add(brick(), '#F5EFE0', TR(.003, 0, .017, 0, 0, 0, .116, .156, .006));
    for (let i = 0; i < 4; i++) b.add(brick(), '#C8BFA8', TR(.003, .05 - i * .03, .0205, 0, 0, 0, .085, .005, .001));
    book.add(b.mesh()); book.position.set(0, -.04, .05); book.visible = false; hands[1].add(book); }
  const pen = new THREE.Group();
  { const p = new Part();
    p.add(tube(.0075, .0075, .11), '#E8B33A', TR(0, 0, 0));
    p.add(unit('tip', () => new THREE.ConeGeometry(.0075, .02, 10)), '#27343C', TR(0, -.065, 0, Math.PI, 0, 0));
    pen.add(p.mesh()); pen.position.set(0, -.01, .03); pen.rotation.x = -.7; pen.visible = false; hands[0].add(pen); }

  // 頭
  const headG = new THREE.Group(), hc = new THREE.Group(); headG.position.y = top + .03; hc.position.y = -(HEAD.y - HEAD.r * HEAD.sy); headG.add(hc); inner.add(headG);
  const head = new Part(), f = faceParams(traits);
  head.add(ball(), skin, TR(0, HEAD.y, 0, 0, 0, 0, HEAD.r * HEAD.sx, HEAD.r * HEAD.sy, HEAD.r * HEAD.sz));
    for (const sx of [-1, 1]) { head.add(lowBall(), skin, TR(sx * .238, HEAD.y - .012, -.004, 0, 0, 0, .026, .04, .03)); head.add(lowBall(), shade(skin, -.07), TR(sx * .244, HEAD.y - .012, .006, 0, 0, 0, .012, .022, .014)); }
  const eyeM = addFace(head, null, skin, L.hair, f);
  addHair(head, L, skin);
  if (L.glasses) addGlasses(head);
  if (has('イヤホンで自分の世界にいた')) for (const sx of [-1, 1]) { head.add(lowBall(), '#F7F7F2', TR(sx * .25, HEAD.y - .012, .012, 0, 0, 0, .019)); head.add(pill(.0034, .13), '#F7F7F2', TR(sx * .24, HEAD.y - .11, .014)); }
  if (has('何かを書いたり作ったりしていた')) head.add(tube(.008, .008, .12), '#E8B33A', TR(.232, HEAD.y + .082, -.02, 0, .1, -1));
  const headMesh = head.mesh(); hc.add(headMesh);
  const eyes = new THREE.Mesh(eyeM.build(), CLAY); eyes.position.y = .722; hc.add(eyes);
  let bird = null;
  if (has('動物や植物に目を止めていた')) {
    const b = new Part();
    b.add(ball(), '#9AA4AC', TR(0, 0, 0, 0, 0, 0, .05, .045, .06));
    b.add(lowBall(), '#B9C2C8', TR(0, .036, .036, 0, 0, 0, .03));
    b.add(unit('beak', () => new THREE.ConeGeometry(.012, .03, 8)), '#E8A33D', TR(0, .034, .074, Math.PI / 2, 0, 0));
    bird = b.mesh(); bird.position.set(.05, HEAD.y + .29, 0); bird.visible = false; hc.add(bird);
  }
  const carry = new THREE.Mesh(unit('carry', () => new THREE.BoxGeometry(.17, .12, .17)), new THREE.MeshStandardMaterial({ color: '#9A6E45', roughness: .7 }));
  carry.position.y = top + .54; carry.visible = false; inner.add(carry);

  g.userData = { inner, torso, arms, fores, hands, legs, headG, eyes, bird, carry, book, pen, hip, top, watchHand };
  return g;
}

/* ---------- ポーズ ---------- */
// 値は [右肩の前後, 右肩の開き, 右ひじ, 左肩の前後, 左肩の開き, 左ひじ, 頭の左右, 頭の上下, 頭のかしげ]
export const POSES = {
  stand: [.12, .26, -.72, .12, -.26, -.72, 0, 0, 0],
  pocket: [.14, .42, -.16, .14, -.42, -.16, .06, 0, -.02, .98, .98],
  write: [-.5, -.42, -1.32, -.46, .36, -1.2, .02, .2, 0],
  read: [-.7, -.3, -1.25, -.74, .32, -1.3, 0, .2, 0],
  think: [-1, -.36, -2.05, -.28, .08, -1.25, .1, -.1, .1, .96, 0],
  watch: [-.64, -.2, -1.6, -.05, -.14, -.3, -.34, .16, 0],
  cheer: [-.2, .78, -.6, -.2, -.78, -.6, 0, -.1, 0],
  look: [-.05, .2, -.3, -.05, -.2, -.3, .5, -.06, 0],
};
export function applyPose(u, pose, k = 1) {
  const P = POSES[pose] || POSES.stand, lerp = (o, v) => o + (v - o) * k;
  u.arms[0].rotation.x = lerp(u.arms[0].rotation.x, P[0]); u.arms[0].rotation.z = lerp(u.arms[0].rotation.z, -P[1]);
  u.fores[0].rotation.x = lerp(u.fores[0].rotation.x, P[2]); u.fores[0].rotation.z = lerp(u.fores[0].rotation.z, P[9] || 0); u.fores[1].rotation.z = lerp(u.fores[1].rotation.z, -(P[10] || 0));
  u.arms[1].rotation.x = lerp(u.arms[1].rotation.x, P[3]); u.arms[1].rotation.z = lerp(u.arms[1].rotation.z, -P[4]);
  u.fores[1].rotation.x = lerp(u.fores[1].rotation.x, P[5]);
  u.headG.rotation.y = lerp(u.headG.rotation.y, P[6]); u.headG.rotation.x = lerp(u.headG.rotation.x, P[7]); u.headG.rotation.z = lerp(u.headG.rotation.z, P[8]);
}
