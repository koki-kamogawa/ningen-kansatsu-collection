import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';

/* =========================================================
   人間観察コレクション
   観察した人がアバターになり、空に浮かぶ島で性格どおりに暮らす。
   AIは使わない。性格は5つの数値で、行動はその数値の重みで決まる。
   ========================================================= */

// ---------- 定数・データ ----------
const DAY = 240;                     // 1日 = 等速で240秒
const SAVE_KEY = 'hkc.world.v1';          // 旧版（島1つ）の保存先。読み込み時に新形式へ移す
const ROOT_KEY = 'hkc.root.v2';
const MAX_ISLANDS = 3, MAX_RESIDENTS = 12;
const ISLAND_NAMES = ['はじまりの島', 'ふたつめの島', 'みっつめの島'];
const TK = ['soc', 'act', 'tidy', 'cur', 'kind'];
const TRAITS = {
  soc:  { name: '人づきあい', lo: 'ひとり好き', hi: '話し好き' },
  act:  { name: '元気',       lo: 'のんびり',   hi: 'せかせか' },
  tidy: { name: '几帳面',     lo: 'おおらか',   hi: 'きっちり' },
  cur:  { name: '好奇心',     lo: 'いつもの道', hi: '寄り道好き' },
  kind: { name: 'やさしさ',   lo: 'マイペース', hi: '世話焼き' },
};
const SEEN = [
  ['ずっと誰かと話していた', { soc: .25 }],
  ['ひとりで静かにしていた', { soc: -.2 }],
  ['よく笑っていた', { soc: .1, kind: .1 }],
  ['早足で歩いていた', { act: .2 }],
  ['ゆっくり動いていた', { act: -.18 }],
  ['荷物を持ってあげていた', { kind: .25 }],
  ['店員さんに丁寧だった', { kind: .15, tidy: .05 }],
  ['身なりがきっちりしていた', { tidy: .2 }],
  ['持ち物がごちゃっとしていた', { tidy: -.2 }],
  ['キョロキョロ周りを見ていた', { cur: .2 }],
  ['本や画面に集中していた', { cur: .1, soc: -.1 }],
  ['何かを書いたり作ったりしていた', { tidy: .1, cur: .1 }],
  ['声が大きかった', { soc: .1, act: .1 }],
  ['しきりに時計を見ていた', { tidy: .15, act: .05 }],
  ['イヤホンで自分の世界にいた', { soc: -.15 }],
  ['動物や植物に目を止めていた', { kind: .1, cur: .1 }],
];
const GUESS = [
  ['休みの日は出かける', { act: .1, cur: .1 }],
  ['休みの日は家でのんびり', { act: -.12 }],
  ['まとめ役をしていそう', { soc: .1, tidy: .1 }],
  ['頼まれると断れない', { kind: .15 }],
  ['計画を立てるのが好き', { tidy: .15 }],
  ['思いつきで動く', { tidy: -.1, cur: .15 }],
  ['友だちが多い', { soc: .15 }],
  ['料理が得意', { kind: .05, tidy: .05 }],
  ['夜ふかしさん', { cur: .05 }],
  ['早起きさん', { tidy: .05 }],
];
const PLACES = ['駅・電車', 'カフェ', '職場', '学校', '街なか', 'お店', '公園', 'その他'];
const LOOK = {
  clothes: ['#C8432B', '#E39B3B', '#E8CF6A', '#6F9E5B', '#3F7F8C', '#3E5C8A', '#2B2B2B', '#EDE9E1', '#8B6B4A', '#C97C9A', '#8C949C', '#7A5C99'],
  hair: ['#2A2523', '#5A3E2B', '#9A6B3F', '#D8B46A', '#D9D6D0', '#9C4A2E'],
  skin: ['#F2D5BC', '#E6BC98', '#C99670', '#8D5E3F'],
  styles: [['short', '短い'], ['long', '長い'], ['bun', 'おだんご'], ['cap', '帽子'], ['bald', 'ぼうず']],
  sizes: [['s', '小柄'], ['m', 'ふつう'], ['l', '大柄']],
};
const TYPES = {
  house:   { name: '家',       wood: 6, stone: 2, work: 40 },
  field:   { name: '畑',       wood: 2, stone: 0, work: 18 },
  bench:   { name: 'ベンチ',   wood: 3, stone: 0, work: 8 },
  well:    { name: '井戸',     wood: 2, stone: 4, work: 24 },
  tower:   { name: '見晴らし台', wood: 5, stone: 3, work: 40 },
  path:    { name: '石の小道', wood: 0, stone: 4, work: 10 },
  lamp:    { name: '街灯',     wood: 1, stone: 2, work: 8 },
  flowers: { name: '花壇',     wood: 1, stone: 1, work: 7 },
  stall:   { name: '屋台',     wood: 5, stone: 1, work: 28 },
};
// その人のいちばん強い性格が「島に欲しいもの」を決める
const WISH = { soc: ['bench', 'stall'], act: ['field', 'tower'], tidy: ['path', 'lamp'], cur: ['tower', 'flowers'], kind: ['well', 'flowers'] };
const LEVELS = [
  { need: 0, name: '野原', R: 9 }, { need: 4, name: '集落', R: 10.5 }, { need: 10, name: '小さな村', R: 12 },
  { need: 18, name: '村', R: 13.5 }, { need: 28, name: '町', R: 15 }, { need: 40, name: '島の都', R: 16.5 },
];
const FINDS = [
  '島の裏側に、手の届きそうな雲を見つけた', '朝露で靴をぬらした', '同じ形の石を二つ見つけて、並べて置いた', '風に飛ばされた葉っぱを追いかけた',
  'ずっと同じ場所に咲いている花の名前を考えた', '島のはしで、自分の影がいちばん長くなる時間を見つけた', '木の根元に小さな穴を見つけて、のぞくのをやめた',
  '夕焼けの色を、ほかの誰かに伝えたくなった', '雲の切れ間から、下の世界を少しだけ見た', '焚き火の煙がどこまで昇るか見ていた',
  '雨上がりのにおいを、深く吸いこんだ', '虫の行列に、道をゆずった', 'まだ誰も歩いていない草の上を歩いた', '小石を島の外に投げて、音が返ってこないことを知った',
  '見たことのない色のきのこを見つけて、さわらなかった', '島の真ん中から、ちょうど全部の家が見える場所を見つけた', '朝いちばんの鳥の声を数えた',
  '寝ころんで、雲が島を追いこしていくのを見ていた', '木の幹に、前からあった傷を見つけた',
  '四つ葉のクローバーを見つけた', '島のはしで雲が流れるのを長いあいだ見ていた', 'きれいな丸い石を拾った',
  '知らない鳥の羽根を拾った', 'どんぐりをポケットいっぱいに集めた', '島のはしに座って足をぶらぶらさせた',
  '変な形の雲に名前をつけた', '風のにおいが変わったことに気づいた', '木の枝で地面に絵をかいた', '島の裏側をのぞきこんで、すぐやめた',
];
const TAG_LINES = {
  'イヤホンで自分の世界にいた': ['島ではじめて鼻歌をうたった', '誰にも聞こえない曲に合わせて、少しだけ歩く速さを変えた'],
  '本や画面に集中していた': ['木かげで本を一冊読み終えた', '話しかけられたのに、三秒遅れて顔を上げた'],
  'しきりに時計を見ていた': ['時計を見て、島には約束がないことを思い出した', '日が沈む時間を、毎日すこしずつメモしている'],
  'キョロキョロ周りを見ていた': ['島じゅうの木の数を数えようとして、途中であきらめた', '誰も気づいていない小道を見つけた'],
  '荷物を持ってあげていた': ['頼まれてもいないのに、資材置き場を片づけた', 'みんなの分の木の実まで運んでいた'],
  '動物や植物に目を止めていた': ['頭に小鳥をのせたまま、しばらく動かなかった', '雑草だと思われていた花に水をやっていた'],
  'よく笑っていた': ['自分で言った冗談に、いちばん笑っていた', '雲の形がおかしくて、ひとりで笑っていた'],
  '何かを書いたり作ったりしていた': ['木の皮に島の地図を描きはじめた', '拾った枝で小さな椅子を作った'],
  '声が大きかった': ['島の反対側まで届く声で「おはよう」と言った', '焚き火のそばで、ひとりで歌っていた'],
  '身なりがきっちりしていた': ['寝る前に、服のほこりを払っていた', '資材置き場の丸太を、太さ順に並べ直した'],
  '持ち物がごちゃっとしていた': ['かばんの底から、ずっと探していた石を見つけた', '持ち物をまた一つ、どこかに置いてきた'],
  'ひとりで静かにしていた': ['島のはしで、長いあいだ風の音を聞いていた', 'みんなが寝たあと、焚き火の番をしていた'],
  '早足で歩いていた': ['島を一周して、まだ息が切れていなかった', '誰よりも先に資材置き場に着いた'],
  'ずっと誰かと話していた': ['今日だけで島の全員と話した', '話の途中で、何の話をしていたか忘れた'],
  '店員さんに丁寧だった': ['木の実を分けてもらったお礼を、二回言った', '誰に会っても、まず「どうも」と言っていた'],
  'ゆっくり動いていた': ['ベンチから立ち上がるまでに、雲が一つ流れていった', '急いでいる人に、道をゆずっていた'],
};
const STOCK = { x: 1.35, z: -1.0 };
// ① 役まわりは全部で16。図鑑に枠を並べ、空いている枠は「どんな人を探せばいいか」を出す
const TYPES16 = [
  ['大工', 'よく動いて、きっちりした人'], ['にぎやか係', 'よく動いて、話し好きな人'], ['冒険家', 'よく動いて、寄り道が好きな人'], ['働き者', 'よく動いて、世話焼きな人'],
  ['まとめ役', '話し好きで、きっちりした人'], ['うわさ好き', '話し好きで、寄り道が好きな人'], ['世話役', '話し好きで、世話焼きな人'], ['研究家', 'きっちりしていて、寄り道が好きな人'],
  ['庭師', 'きっちりしていて、世話焼きな人'], ['旅のひと', '寄り道が好きで、世話焼きな人'], ['語り部', 'とにかく話し好きな人'], ['がんばり屋', 'とにかくよく動く人'],
  ['職人', 'とにかくきっちりした人'], ['探検家', 'とにかく寄り道が好きな人'], ['お人よし', 'とにかく世話焼きな人'], ['おだやかな人', 'どの性格にも偏らない人'],
];
// ② 名場面。一度起きた場面は、その瞬間の写真つきでアルバムに残る
const SCENES = [
  ['first_talk', 'はじめまして', '2人いれば、いつか起きる'], ['friends', '仲良しになった', '何度も話すうちに'], ['bestie', '親友', '仲良しのその先'],
  ['opposites', '正反対の親友', '性格が正反対の2人が、それでも'], ['argue', '言い合い', '性格の合わない2人'], ['awkward', '気まずい', '言い合いが続くと'],
  ['make_up', '仲直り', '気まずい2人の、その後'], ['three_talk', '井戸端会議', '話し好きが3人そろうと'], ['bench_two', 'ベンチでふたり', 'のんびり屋が2人いて、ベンチがあると'],
  ['explore_pair', 'ふたりで探検', '寄り道好きが2人いると'], ['care', 'おすそわけ', '世話焼きな人と、お腹をすかせた人'], ['night_owl', '夜ふかし', '夜ふかしさんの夜'],
  ['early', 'いちばん早起き', '朝の島で'], ['sleep_outside', '野宿', '家がまだない夜'], ['bird', '頭に小鳥', '動物や植物に目を止める人'],
  ['music', '鼻歌', 'イヤホンで自分の世界にいた人'], ['find', '小さな発見', '寄り道好きは、よく何かを見つける'], ['plant', '木を植えた', '世話焼きな人がいる島'],
  ['harvest', 'はじめての収穫', '畑ができたら'], ['first_house', 'はじめての家', '資材がたまると'], ['path', '石の小道', 'きっちりした人の思いつき'],
  ['well', '井戸', '世話焼きな人の思いつき'], ['stall', '屋台', '話し好きな人の思いつき'], ['tower', '見晴らし台', '寄り道好きな人の思いつき'],
  ['level1', '集落になった', '建物が4つになると'], ['level3', '村になった', '建物が18になると'], ['level5', '島の都', '建物が40になると'],
  ['full_house', 'にぎやかな島', '1つの島に8人'], ['move_in', '引っ越し', 'ほかの島から人を呼ぶ'], ['reunion', '再会', '仲良しを、別の島で会わせる'],
];
let shotQueue = [];
function sceneHit(key, at, text) {
  if (ROOT.album[key]) return;
  ROOT.album[key] = { date: new Date().toLocaleDateString('ja-JP'), island: S.name, day: S.day, text: fmt(text), img: null };
  if (quiet) return;
  shotQueue.push({ key, x: at.x, z: at.z, t: .7 });
  const def = SCENES.find(x => x[0] === key);
  setTimeout(() => toast(`名場面「${def[1]}」がアルバムに入りました（${Object.keys(ROOT.album).length}/${SCENES.length}）`), 900);
}

// ---------- 小道具 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const R = (a = .7, b = 1.3) => rand(a, b);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - t, 3);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = s => `「${s}」`;
const nm = p => `\u0001${p.id}\u0002`;

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
}
const fbm = (x, y, s) => vnoise(x, y, s) * .6 + vnoise(x * 2.1, y * 2.1, s + 7) * .3 + vnoise(x * 4.3, y * 4.3, s + 13) * .1;

// ---------- 世界の状態 ----------
// ROOT = 持ち物ぜんぶ（島3つ・待機中の人・名場面）。S = いま見ている島
let ROOT = loadRoot() || { v: 2, uid: 1, nextNo: 1, islands: [], active: 0, bench: [], album: {}, speed: 1 };
if (!ROOT.islands.length) { const w = newWorld(ISLAND_NAMES[0]); ROOT.islands.push(w); ROOT.active = w.id; }
let S = ROOT.islands.find(i => i.id === ROOT.active) || ROOT.islands[0];
const view = { R: S.R };
let quiet = false;                     // 留守中の早送り中は演出を出さない

function newWorld(name) {
  return {
    id: ROOT.uid++, name, v: 1, seed: Math.floor(Math.random() * 1e6), day: 1, time: .3, R: 9, level: 0, nextNo: 1, uid: 1,
    stock: { wood: 4, stone: 2, food: 12 }, people: [], structures: [], trees: [], rocks: [], bushes: [],
    log: [], lastSeen: Date.now(), speed: 1, pending: null,
  };
}
const isHex = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const safeImg = u => typeof u === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u);
// 外から読み込んだデータは、色・文字・数値の形を確かめてから使う（悪意あるファイル対策）
function sanitizePerson(p) {
  const L = p.look || {};
  p.look = { clothes: isHex(L.clothes) ? L.clothes : LOOK.clothes[0], hair: isHex(L.hair) ? L.hair : LOOK.hair[0], skin: isHex(L.skin) ? L.skin : LOOK.skin[0],
    style: LOOK.styles.some(x => x[0] === L.style) ? L.style : 'short', size: ['s', 'm', 'l'].includes(L.size) ? L.size : 'm', glasses: !!L.glasses };
  for (const k of ['name', 'short', 'place', 'memo']) p[k] = String(p[k] ?? '').slice(0, 200);
  p.seen = (Array.isArray(p.seen) ? p.seen : []).filter(t => SEEN.some(x => x[0] === t));
  p.guess = (Array.isArray(p.guess) ? p.guess : []).filter(t => GUESS.some(x => x[0] === t));
  p.traits = Object.fromEntries(TK.map(k => [k, clamp(+(p.traits || {})[k] || .5, .05, .95)]));
  p.id = +p.id || 0; p.no = +p.no || 0; p.x = +p.x || 0; p.z = +p.z || 0;
  return p;
}
function sanitizeRoot(r) {
  if (!r || r.v !== 2 || !Array.isArray(r.islands) || r.islands.length > MAX_ISLANDS) return null;
  for (const i of r.islands) { i.name = String(i.name ?? '島').slice(0, 12); i.people = (Array.isArray(i.people) ? i.people : []).slice(0, MAX_RESIDENTS).map(sanitizePerson); for (const st of i.structures || []) if (!TYPES[st.type]) st.type = 'bench'; }
  r.bench = (Array.isArray(r.bench) ? r.bench : []).map(sanitizePerson);
  const al = {}; for (const [k, e] of Object.entries(r.album || {})) if (SCENES.some(x => x[0] === k) && e) al[k] = { date: String(e.date ?? '').slice(0, 20), island: String(e.island ?? '').slice(0, 12), day: +e.day || 0, text: String(e.text ?? '').slice(0, 200), img: safeImg(e.img) ? e.img : null };
  r.album = al;
  return r;
}
function wrapOld(o) { return { v: 2, uid: o.uid, nextNo: o.nextNo, islands: [Object.assign(o, { id: o.uid + 1000, name: ISLAND_NAMES[0] })], active: o.uid + 1000, bench: [], album: {}, speed: o.speed ?? 1 }; }
function loadRoot() {
  try { const r = JSON.parse(localStorage.getItem(ROOT_KEY)); if (r && r.v === 2) return r; } catch { }
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if (o && o.v === 1) return wrapOld(o); } catch { }
  return null;
}
function save() { S.lastSeen = Date.now(); try { localStorage.setItem(ROOT_KEY, JSON.stringify(ROOT)); } catch { } }
// 図鑑に載っている全員（どの島にいるか、待機中か）
function allCards() { return [...ROOT.islands.flatMap(i => i.people.map(p => ({ p, island: i }))), ...ROOT.bench.map(p => ({ p, island: null }))]; }
const anyById = id => allCards().find(c => c.p.id === id)?.p;

const walkR = () => S.R * .8;
const byId = id => S.people.find(p => p.id === id);
const sById = id => S.structures.find(s => s.id === id);
const nid = () => ROOT.uid++;

// ---------- 地形 ----------
function edgeR(th, r = view.R) { const c = Math.cos(th), n = Math.sin(th); return r * (.86 + .2 * vnoise(c * 1.3 + 5, n * 1.3 + 5, S.seed + 3) + .08 * vnoise(c * 3.2 + 9, n * 3.2 + 9, S.seed + 8)); }
function groundH(x, z) {
  const r = Math.hypot(x, z), er = edgeR(Math.atan2(z, x));
  let h = .12 + Math.pow(fbm(x * .16 + 31.7, z * .16 + 11.3, S.seed), 1.6) * 1.4;
  h = lerp(.14, h, smooth(1.2, 3.6, r));
  h *= 1 - smooth(er - 2.6, er, r);
  return Math.max(h, .02);
}

function populate(r0, r1) {
  const area = Math.PI * (r1 * r1 - r0 * r0);
  const nT = Math.round(area * .075), nR = Math.round(area * .022), nB = Math.round(area * .03);
  const put = (arr, n, mk) => { for (let i = 0; i < n; i++) { const p = spot(Math.max(r0, 2.4), r1, .9); if (p) arr.push(mk(p)); } };
  put(S.trees, nT, p => ({ id: nid(), x: p.x, z: p.z, k: Math.random() < .5 ? 0 : 1, s: r0 > 0 ? rand(.1, .5) : rand(.75, 1), c: Math.floor(rand(0, 4)) }));
  put(S.rocks, nR, p => ({ id: nid(), x: p.x, z: p.z, amt: 4, re: 0 }));
  put(S.bushes, nB, p => ({ id: nid(), x: p.x, z: p.z, berries: true, re: 0 }));
}

const RAD = { house: .85, field: 1.05, tower: .65, stall: .7, well: .55, bench: .5, lamp: .3, flowers: .5, path: 0 };
function blocked(x, z, clear) {
  if (Math.hypot(x, z) < 2.1) return true;
  if (Math.hypot(x - STOCK.x, z - STOCK.z) < .9) return true;
  for (const s of S.structures) if (s.type !== 'path' && Math.hypot(x - s.x, z - s.z) < clear + RAD[s.type]) return true;
  for (const a of [S.trees, S.rocks, S.bushes]) for (const o of a) if (Math.hypot(x - o.x, z - o.z) < Math.min(clear, .8) + .1) return true;
  return false;
}
function spot(rmin, rmax, clear, near) {
  for (let i = 0; i < 80; i++) {
    let x, z;
    if (near) { const a = rand(0, 6.283), r = rand(near.r0 ?? .8, near.r1 ?? 2); x = near.x + Math.cos(a) * r; z = near.z + Math.sin(a) * r; }
    else { const a = rand(0, 6.283), r = Math.sqrt(rand(rmin * rmin, rmax * rmax)); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    const rr = Math.hypot(x, z);
    if (rr > walkR() || rr < rmin) continue;
    if (!blocked(x, z, clear)) return { x, z };
  }
  return null;
}
function clampWalk(o) { const r = Math.hypot(o.x, o.z), m = walkR(); if (r > m) { o.x *= m / r; o.z *= m / r; } }

// ---------- 性格の読み取り ----------
function traitsFrom(seen, guess) {
  const t = { soc: .5, act: .5, tidy: .5, cur: .5, kind: .5 };
  const apply = (list, chosen) => list.forEach(([label, d]) => { if (chosen.includes(label)) for (const k in d) t[k] += d[k]; });
  apply(SEEN, seen); apply(GUESS, guess);
  for (const k of TK) t[k] = clamp(+t[k].toFixed(2), .05, .95);
  return t;
}
const ROLE = {
  'act+tidy': '大工', 'act+soc': 'にぎやか係', 'act+cur': '冒険家', 'act+kind': '働き者', 'soc+tidy': 'まとめ役',
  'cur+soc': 'うわさ好き', 'kind+soc': '世話役', 'cur+tidy': '研究家', 'kind+tidy': '庭師', 'cur+kind': '旅のひと',
};
function ranked(t) { return TK.map(k => [k, t[k]]).sort((a, b) => b[1] - a[1]); }
function roleOf(t) {
  const r = ranked(t);
  if (r[0][1] < .58) return 'おだやかな人';
  if (r[1][1] < .58) return { soc: '語り部', act: 'がんばり屋', tidy: '職人', cur: '探検家', kind: 'お人よし' }[r[0][0]];
  return ROLE[[r[0][0], r[1][0]].sort().join('+')] || 'おだやかな人';
}
const HI_TE = { soc: '話し好きで', act: 'よく動いて', tidy: 'きっちりしていて', cur: '寄り道が好きで', kind: '世話焼きで' };
const HI_END = { soc: '話し好きな人', act: 'よく動く人', tidy: 'きっちりした人', cur: '寄り道が好きな人', kind: '世話焼きな人' };
const LO_NOTE = { soc: 'ひとりの時間も大事にする。', act: '動きはのんびり。', tidy: '細かいことは気にしない。', cur: 'いつもの道が落ち着く。', kind: '自分のペースは崩さない。' };
function personaText(t) {
  const r = ranked(t);
  if (r[0][1] < .58) return 'どれにも偏らない、おだやかな人。島ではその日の気分で動く。';
  let s = r[1][1] < .58 ? `とにかく${HI_END[r[0][0]]}。` : `${HI_TE[r[0][0]]}、${HI_END[r[1][0]]}。`;
  if (r[4][1] < .32) s += LO_NOTE[r[4][0]];
  return s;
}

// ---------- 人の生活 ----------
function sleepy(p) {
  const t = S.time, [a, b] = p.chrono > 0 ? [.88, .27] : p.chrono < 0 ? [.74, .17] : [.8, .22];
  return t >= a || t < b;
}
const asleep = p => p.act && (p.act.k === 'sleep' && p.act.ph === 'work' || p.act.k === 'nap');
const homeOf = p => S.structures.find(s => s.type === 'house' && s.owner === p.id && s.done);
function doorOf(h) { return { x: h.x + Math.sin(h.rot) * .62, z: h.z + Math.cos(h.rot) * .62 }; }

function createPerson(f) {
  const a = rand(0, 6.283);
  const p = {
    id: nid(), no: ROOT.nextNo++, name: f.name, short: f.short || '', place: f.place, look: { ...f.look }, seen: [...f.seen], guess: [...f.guess], memo: f.memo,
    traits: { ...f.traits }, born: S.day, x: Math.cos(a) * 1.5, z: Math.sin(a) * 1.5, dir: a, needs: { hunger: .2, energy: .9, lonely: .3 },
    rel: {}, act: null, carry: null, stats: { built: 0, talked: 0, carried: 0, found: 0 },
    chrono: f.guess.includes('夜ふかしさん') ? 1 : f.guess.includes('早起きさん') ? -1 : 0,
  };
  if (S.people.length >= MAX_RESIDENTS) { ROOT.bench.push(p); p.benched = true; return p; }
  S.people.push(p);
  addLog(`${nm(p)}が島にやってきた`, p.id, 'born');
  if (S.people.length >= 8) sceneHit('full_house', { x: 0, z: 0 }, `${S.name}に8人が暮らすようになった`);
  return p;
}
function updatePersonFrom(p, f) {
  Object.assign(p, { name: f.name, short: f.short || '', place: f.place, look: { ...f.look }, seen: [...f.seen], guess: [...f.guess], memo: f.memo, traits: { ...f.traits } });
  p.chrono = f.guess.includes('夜ふかしさん') ? 1 : f.guess.includes('早起きさん') ? -1 : 0;
}
// 島から島へ（to=null なら待機中へ）。関係はその人が覚えている
function movePerson(p, from, to) {
  if (from) {
    from.people = from.people.filter(o => o !== p);
    for (const o of from.people) if (o.act && o.act.pid === p.id) o.act = null;
    for (const arr of [from.trees, from.rocks, from.bushes, from.structures]) for (const o of arr) if (o.claim === p.id) o.claim = 0;
    (from.gone ||= {})[p.id] = shortName(p);
    from.log.push({ d: from.day, t: +from.time.toFixed(3), text: to ? `${nm(p)}が${q(to.name)}へ引っ越していった` : `${nm(p)}が島を出て、しばらく休むことにした`, pid: null, k: 'bye' });
  } else ROOT.bench = ROOT.bench.filter(o => o !== p);
  Object.assign(p, { act: null, carry: null, inside: false, moving: false });
  if (!to) { ROOT.bench.push(p); return; }
  const a = rand(0, 6.283); p.x = Math.cos(a) * 1.5; p.z = Math.sin(a) * 1.5; p.needs = { hunger: .2, energy: .9, lonely: .3 };
  p.reunite = Object.keys(p.rel).filter(id => p.rel[id] >= 1).map(Number);
  to.people.push(p);
  if (to === S) {
    addLog(from ? `${nm(p)}が${q(from.name)}から引っ越してきた` : `${nm(p)}がこの島で暮らしはじめた`, p.id, 'born');
    if (from) sceneHit('move_in', p, `${nm(p)}が${q(from.name)}から${q(S.name)}へ引っ越してきた`);
    if (S.people.length >= 8) sceneHit('full_house', { x: 0, z: 0 }, `${S.name}に8人が暮らすようになった`);
    fx.spawn(p);
  }
}
function removePerson(p) {
  (S.gone ||= {})[p.id] = shortName(p);
  endAct(p);
  S.people = S.people.filter(o => o !== p);
  for (const o of S.people) { delete o.rel[p.id]; if (o.act && o.act.pid === p.id) endAct(o); }
  addLog(`${nm(p)}が島を旅立った`, null, 'bye');
}

function fmt(text) {
  return String(text).replace(/\u0001(\d+)\u0002/g, (_, id) => { const p = byId(+id) || anyById(+id); return p ? shortName(p) : (S.gone && S.gone[id]) || 'だれか'; });
}
function addLog(text, pid, k) {
  S.log.push({ d: S.day, t: +S.time.toFixed(3), text, pid, k });
  if (S.log.length > 500) S.log.splice(0, S.log.length - 500);
  ui.logDirty = true;
}

function resNeed() {
  const n = Math.max(1, S.people.length);
  return {
    wood: clamp(1 - S.stock.wood / 14, .05, 1),
    stone: clamp(1 - S.stock.stone / 8, .05, 1),
    food: clamp(1 - S.stock.food / (n * 4 + 4), .05, 1),
  };
}
function nearest(arr, p) { let b = null, bd = 1e9; for (const o of arr) { const d = dist(o, p); if (d < bd) { bd = d; b = o; } } return b; }
function pickPartner(p) {
  const c = S.people.filter(o => o !== p && !asleep(o) && !(o.act && o.act.k === 'chat'));
  if (!c.length) return null;
  let best = null, bw = -1;
  for (const o of c) {
    const w = (1 + (p.rel[o.id] || 0) * .5 + o.traits.soc * .5) / (1 + dist(p, o) * .08) * R(.6, 1.4);
    if (w > bw) { bw = w; best = o; }
  }
  return best;
}
function activeSite(p) {
  const sites = S.structures.filter(s => !s.done);
  if (!sites.length) return null;
  return sites.find(s => s.owner === p.id) || nearest(sites, p);
}
const treeCap = () => Math.round(Math.PI * walkR() * walkR() * .1);

function setAct(p, k, o = {}) { p.act = { k, ph: 'go', t: 0, ...o }; }
function endAct(p) {
  const a = p.act;
  if (a) {
    for (const arr of [S.trees, S.rocks, S.bushes, S.structures]) for (const o of arr) if (o.claim === p.id) o.claim = 0;
  }
  p.act = null;
}

function decide(p) {
  const t = p.traits, n = p.needs, night = sleepy(p), C = [];
  const add = (k, w, o) => { if (w > 0) C.push({ k, w, o }); };
  if (night) add('sleep', 3 + (1 - n.energy));
  if (!night && n.energy < .12) add('nap', 2.2);
  if (n.hunger > .5) add('eat', .8 + n.hunger * 2.2);
  if (!night) {
    const need = resNeed(), site = activeSite(p);
    if (site) {
      const friendSite = (p.rel[site.owner] || 0) > .8 ? t.kind * .6 : 0;
      add('build', (.45 + t.tidy * .45 + t.act * .45 + (site.owner === p.id ? .7 : 0) + friendSite) * R(), { sid: site.id });
    }
    add('wood', (.3 + t.act * .6) * need.wood * R());
    add('stone', (.25 + t.act * .4 + t.tidy * .25) * need.stone * R());
    add('food', (.3 + t.kind * .3 + t.tidy * .15) * need.food * R());
    const ripe = S.structures.find(s => s.type === 'field' && s.done && s.ripe >= 1 && !s.claim);
    if (ripe) add('harvest', (.3 + t.tidy * .4 + t.act * .2) * (.2 + need.food) * R(), { sid: ripe.id });
    const partner = pickPartner(p);
    if (partner) add('talk', n.lonely * (.35 + t.soc * 1.3) * R(), { pid: partner.id });
    add('explore', (.08 + t.cur * .75) * R(.5, 1.5));
    add('wander', .22 * R(.5, 1.5));
    const benches = S.structures.filter(s => s.type === 'bench' && s.done);
    if (benches.length) add('sit', (.15 + (1 - t.act) * .45) * R(.5, 1.5), { sid: pick(benches).id });
    const hungry = S.people.find(o => o !== p && o.needs.hunger > .75 && !asleep(o));
    if (hungry && S.stock.food > 0) add('care', t.kind * 1.4 * R(), { pid: hungry.id });
    if (S.trees.length < treeCap()) add('plant', (t.kind * .25 + t.cur * .1) * R());
  }
  C.sort((a, b) => b.w - a.w);
  const c = C[0] || { k: 'wander' };
  setAct(p, c.k, c.o || {});
  if (!prep(p)) { setAct(p, 'wander'); prep(p); }
}

function near(a, o, off, p) {
  const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz) || 1;
  a.tx = o.x + dx / d * off; a.tz = o.z + dz / d * off;
}
function prep(p) {
  const a = p.act;
  switch (a.k) {
    case 'sleep': {
      const h = homeOf(p);
      if (h) { const d = doorOf(h); a.tx = d.x; a.tz = d.z; a.home = h.id; }
      else { const g = rand(0, 6.283); a.tx = Math.cos(g) * 1.35; a.tz = Math.sin(g) * 1.35; }
      return true;
    }
    case 'nap': a.ph = 'work'; a.t = 9; return true;
    case 'eat': {
      if (S.stock.food > 0) { const g = rand(0, 6.283); a.tx = Math.cos(g) * 1.05; a.tz = Math.sin(g) * 1.05; a.src = 'stock'; return true; }
      const b = nearest(S.bushes.filter(b => b.berries && !b.claim), p); if (!b) return false;
      b.claim = p.id; a.bid = b.id; a.src = 'bush'; near(a, b, .38, p); return true;
    }
    case 'wood': {
      const tr = nearest(S.trees.filter(t => t.s >= .95 && !t.claim), p); if (!tr) return false;
      tr.claim = p.id; a.oid = tr.id; near(a, tr, .42, p); return true;
    }
    case 'stone': {
      const rk = nearest(S.rocks.filter(r => r.amt > 0 && !r.claim), p); if (!rk) return false;
      rk.claim = p.id; a.oid = rk.id; near(a, rk, .45, p); return true;
    }
    case 'food': {
      const b = nearest(S.bushes.filter(b => b.berries && !b.claim), p); if (!b) return false;
      b.claim = p.id; a.oid = b.id; near(a, b, .38, p); return true;
    }
    case 'harvest': {
      const f = sById(a.sid); if (!f || f.claim) return false;
      f.claim = p.id; a.tx = f.x + rand(-.5, .5); a.tz = f.z + rand(-.3, .3); return true;
    }
    case 'build': {
      const s = sById(a.sid); if (!s) return false;
      const c = s.type === 'path' ? pathMid(s) : s; const g = rand(0, 6.283), r = RAD[s.type] + .25;
      a.tx = c.x + Math.cos(g) * r; a.tz = c.z + Math.sin(g) * r; return true;
    }
    case 'talk': return !!byId(a.pid);
    case 'explore': {
      const g = rand(0, 6.283), r = walkR() * rand(.6, 1);
      a.tx = Math.cos(g) * r; a.tz = Math.sin(g) * r; return true;
    }
    case 'wander': { a.tx = p.x + rand(-2.5, 2.5); a.tz = p.z + rand(-2.5, 2.5); const o = { x: a.tx, z: a.tz }; clampWalk(o); a.tx = o.x; a.tz = o.z; return true; }
    case 'sit': {
      const b = sById(a.sid); if (!b) return false;
      const off = rand(-.32, .32); a.tx = b.x + Math.sin(b.rot) * .06 + Math.cos(b.rot) * off; a.tz = b.z + Math.cos(b.rot) * .06 - Math.sin(b.rot) * off; return true;
    }
    case 'care': a.step = 'fetch'; a.tx = STOCK.x + rand(-.3, .3); a.tz = STOCK.z + .5; return true;
    case 'plant': {
      const h = homeOf(p), sp = spot(2.4, walkR(), .9, { x: h ? h.x : p.x, z: h ? h.z : p.z, r0: 1, r1: 3 }); if (!sp) return false;
      a.tx = sp.x; a.tz = sp.z; return true;
    }
  }
  return true;
}

function moveTo(p, tx, tz, dt, stop = 0) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  const sp = (.5 + p.traits.act * .75) * (p.carry ? .85 : 1) * (p.needs.hunger > .95 ? .7 : 1), st = sp * dt;
  if (d <= stop + st || d < .02) { if (stop === 0) { p.x = tx; p.z = tz; } p.moving = false; return true; }
  p.x += dx / d * st; p.z += dz / d * st; p.dir = Math.atan2(dx, dz); p.moving = true;
  return false;
}
function face(p, o) { p.dir = Math.atan2(o.x - p.x, o.z - p.z); }

const INTERRUPTIBLE = ['wander', 'explore', 'sit', 'plant'];
function canChat(o, p) {
  if (!o.act) return true;
  if (o.act.k === 'talk' && o.act.pid === p.id) return true;
  if (INTERRUPTIBLE.includes(o.act.k)) return true;
  return o.act.ph === 'go' && ['wood', 'stone', 'food'].includes(o.act.k) && o.traits.soc > .45;
}

function runAct(p, dt) {
  const a = p.act;
  p.moving = false;
  if (a.k === 'talk') return runTalk(p, a, dt);
  if (a.k === 'chat') {
    const o = byId(a.pid); if (o) face(p, o);
    a.t -= dt; if (a.t <= 0) endAct(p);
    return;
  }
  if (a.k === 'care' && a.step === 'deliver') {
    const o = byId(a.pid); if (!o || asleep(o)) { if (p.carry) { S.stock.food++; p.carry = null; } return endAct(p); }
    if (moveTo(p, o.x, o.z, dt, .55)) {
      o.needs.hunger = Math.max(0, o.needs.hunger - .6); p.carry = null;
      bumpRel(p, o, .25); bubble(p, '🍎'); bubble(o, '😊');
      addLog(`${nm(p)}が${nm(o)}に木の実を分けた`, p.id); sceneHit('care', p, `${nm(p)}が${nm(o)}に木の実を分けた`);
      endAct(p);
    }
    return;
  }
  if (a.ph === 'go') { if (moveTo(p, a.tx, a.tz, dt)) arrive(p, a); return; }
  if (a.ph === 'work') { a.t -= dt; work(p, a, dt); if (p.act === a && a.t <= 0) done(p, a); return; }
  if (a.ph === 'ret') {
    if (moveTo(p, a.tx, a.tz, dt)) {
      const k = p.carry; p.carry = null;
      S.stock[k] += k === 'food' && p.traits.tidy > .7 ? 3 : 2; p.stats.carried++;
      endAct(p);
    }
  }
}

function arrive(p, a) {
  a.ph = 'work';
  switch (a.k) {
    case 'sleep': a.t = 1e9; if (a.home) p.inside = true; break;
    case 'eat': a.t = 2.4; break;
    case 'wood': { const o = S.trees.find(t => t.id === a.oid); if (!o || o.s < .95) return endAct(p); face(p, o); a.t = 4.2 - p.traits.act * 1.2; break; }
    case 'stone': { const o = S.rocks.find(r => r.id === a.oid); if (!o || o.amt <= 0) return endAct(p); face(p, o); a.t = 4.8 - p.traits.act * 1.2; break; }
    case 'food': { const o = S.bushes.find(b => b.id === a.oid); if (!o || !o.berries) return endAct(p); face(p, o); a.t = 2.6; break; }
    case 'harvest': a.t = 4; break;
    case 'build': { const s = sById(a.sid); if (!s || s.done) return endAct(p); face(p, s.type === 'path' ? pathMid(s) : s); a.t = 9 + p.traits.tidy * 5; (s.helpers ||= []).includes(p.id) || s.helpers.push(p.id); break; }
    case 'explore': { a.t = rand(3, 5); bubble(p, pick(['👀', '☁️', '🌿'])); const o = p.traits.cur > .62 && S.people.find(o => o !== p && o.traits.cur > .62 && o.act && o.act.k === 'explore' && dist(o, p) < 4); if (o) sceneHit('explore_pair', p, `${nm(p)}と${nm(o)}が一緒に島のはしを探検した`); break; }
    case 'wander': a.t = rand(1.5, 4); break;
    case 'sit': { a.t = rand(9, 16); const b = sById(a.sid); if (b) p.dir = b.rot; break; }
    case 'plant': a.t = 3; break;
    case 'care':
      if (S.stock.food <= 0) return endAct(p);
      S.stock.food--; p.carry = 'food'; a.step = 'deliver'; a.ph = 'go'; break;
  }
}

function work(p, a, dt) {
  if (a.k === 'sleep') {
    p.needs.energy = Math.min(1, p.needs.energy + dt * .009);
    if (!sleepy(p) && p.needs.energy > .5) {
      p.inside = false;
      if (!quiet && Math.random() < .25 && S.firstRiser !== S.day) { S.firstRiser = S.day; addLog(`${nm(p)}が今朝いちばんに起きた`, p.id); sceneHit('early', p, `${nm(p)}が今朝いちばんに起きた`); }
      endAct(p);
    } else if (!a.home) { if (Math.random() < dt * .25) bubble(p, '💤'); if (S.time > .85 || S.time < .1) sceneHit('sleep_outside', p, `${nm(p)}が焚き火のそばで野宿した`); }
    return;
  }
  if (a.k === 'nap') { p.needs.energy = Math.min(1, p.needs.energy + dt * .02); return; }
  if (a.k === 'build') {
    const s = sById(a.sid); if (!s || s.done) return endAct(p);
    s.work += (.6 + p.traits.act * .5 + p.traits.tidy * .3) * dt;
    s.progress = Math.min(1, s.work / TYPES[s.type].work);
    if (s.progress >= 1) completeSite(s);
    if (Math.random() < dt * .3) bubble(p, '🔨');
  }
  if (a.k === 'sit' && S.people.some(o => o !== p && o.act && o.act.k === 'sit' && o.act.ph === 'work' && o.act.sid === a.sid)) { const o = S.people.find(o => o !== p && o.act && o.act.k === 'sit' && o.act.sid === a.sid); sceneHit('bench_two', p, `${nm(p)}と${nm(o)}が同じベンチに座っていた`); }
  if (a.k === 'sit') p.needs.lonely = Math.max(0, p.needs.lonely - dt * .002 * (S.people.some(o => o !== p && o.act && o.act.k === 'sit' && o.act.sid === a.sid) ? 6 : 1));
}

function done(p, a) {
  switch (a.k) {
    case 'eat':
      if (a.src === 'stock') { if (S.stock.food <= 0) break; S.stock.food--; }
      else { const b = S.bushes.find(b => b.id === a.bid); if (!b || !b.berries) break; b.berries = false; b.re = 0; }
      p.needs.hunger = Math.max(0, p.needs.hunger - .75); bubble(p, pick(['🍎', '😋']));
      break;
    case 'wood': {
      const o = S.trees.find(t => t.id === a.oid); if (!o) break;
      o.s = .05; o.claim = 0; p.carry = 'wood'; fx.chop(o);
      p.act = { k: 'wood', ph: 'ret', tx: STOCK.x + rand(-.4, .4), tz: STOCK.z + rand(.35, .6) };
      return;
    }
    case 'stone': {
      const o = S.rocks.find(r => r.id === a.oid); if (!o) break;
      o.amt--; o.claim = 0; p.carry = 'stone';
      p.act = { k: 'stone', ph: 'ret', tx: STOCK.x + rand(-.4, .4), tz: STOCK.z + rand(.35, .6) };
      return;
    }
    case 'food': {
      const o = S.bushes.find(b => b.id === a.oid); if (!o || !o.berries) break;
      o.berries = false; o.re = 0; o.claim = 0; p.carry = 'food';
      p.act = { k: 'food', ph: 'ret', tx: STOCK.x + rand(-.4, .4), tz: STOCK.z + rand(.35, .6) };
      return;
    }
    case 'harvest': {
      const f = sById(a.sid); if (f) { f.ripe = 0; f.claim = 0; S.stock.food += 5; p.stats.carried++; bubble(p, '🌾'); sceneHit('harvest', p, `${nm(p)}が畑ではじめて収穫した`); }
      break;
    }
    case 'explore':
      if (Math.random() < .2 + p.traits.cur * .15) {
        p.stats.found++; bubble(p, pick(['🍀', '🪶', '🌰', '❗']));
        const line = tagLine(p) || pick(FINDS); addLog(`${nm(p)}が${line}`, p.id); sceneHit('find', p, `${nm(p)}が${line}`); if (tagLine.last === 'イヤホンで自分の世界にいた') sceneHit('music', p, `${nm(p)}が${line}`);
      }
      break;
    case 'plant': {
      if (!blocked(p.x, p.z, .7)) {
        S.trees.push({ id: nid(), x: p.x, z: p.z, k: Math.random() < .5 ? 0 : 1, s: .1, c: Math.floor(rand(0, 4)) });
        bubble(p, '🌱');
        if (Math.random() < .5) addLog(`${nm(p)}が木の苗を植えた`, p.id); sceneHit('plant', p, `${nm(p)}が木の苗を植えた`);
      }
      break;
    }
  }
  if (a.k === 'sit' && Math.random() < .12) { const l = tagLine(p); if (l) { addLog(`${nm(p)}が${l}`, p.id); if (tagLine.last === 'イヤホンで自分の世界にいた') sceneHit('music', p, `${nm(p)}が${l}`); } }
  endAct(p);
}
function tagLine(p) { tagLine.last = null; const ls = p.seen.filter(t => TAG_LINES[t]); if (!ls.length || Math.random() >= .55) return null; const t = pick(ls); tagLine.last = t; return pick(TAG_LINES[t]); }

function runTalk(p, a, dt) {
  const o = byId(a.pid);
  if (!o || asleep(o) || (o.act && o.act.k === 'chat' && o.act.pid !== p.id)) return endAct(p);
  if (a.ph === 'go') {
    a.gt = (a.gt || 0) + dt;
    if (a.gt > 25) return endAct(p);
    if (moveTo(p, o.x, o.z, dt, .62)) {
      if (canChat(o, p)) {
        const dur = rand(5, 9) * (.7 + (p.traits.soc + o.traits.soc) * .4);
        endAct(o); o.act = { k: 'chat', ph: 'work', t: dur + .5, pid: p.id };
        a.ph = 'work'; a.t = dur; a.bt = 0; face(p, o); face(o, p);
        a.argue = Math.random() < argueChance(p, o);
      } else { a.wait = (a.wait || 0) + dt; if (a.wait > 5) endAct(p); }
    }
    return;
  }
  face(p, o);
  a.t -= dt; a.bt -= dt;
  if (a.bt <= 0) { const near = S.people.filter(x => x.act && (x.act.k === 'chat' || (x.act.k === 'talk' && x.act.ph === 'work')) && dist(x, p) < 2.6); if (near.length >= 3) sceneHit('three_talk', p, `${near.slice(0, 3).map(nm).join('と')}が集まって話しこんでいた`);
    a.bt = rand(1.1, 1.8); a.turn = !a.turn; bubble(a.turn ? p : o, topic(p, o, a.argue)); }
  if (a.t <= 0) { resolveTalk(p, o, a.argue); endAct(p); if (o.act && o.act.k === 'chat') endAct(o); }
}
function compat(p, o) { return clamp(1 - TK.reduce((s, k) => s + Math.abs(p.traits[k] - o.traits[k]), 0) / 5 * 1.8, 0, 1); }
function argueChance(p, o) { return clamp((1 - compat(p, o)) * .45 * (1 - (p.traits.kind + o.traits.kind) / 2 * .8), 0, .5); }
function topic(p, o, argue) {
  if (argue) return pick(['💢', '😤', '🙄']);
  const pool = ['💬', '😄', '☕', '🌤️'];
  const both = k => p.traits[k] > .6 && o.traits[k] > .6;
  if (both('cur')) pool.push('🗺️', '🔭'); if (both('tidy')) pool.push('📐', '🗓️'); if (both('kind')) pool.push('🌼', '🍎');
  if (both('act')) pool.push('🔨', '💪'); if (both('soc')) pool.push('😂', '🎶');
  return pick(pool);
}
function bumpRel(p, o, d) {
  const before = p.rel[o.id] || 0;
  p.rel[o.id] = clamp(before + d, -2, 3); o.rel[p.id] = clamp((o.rel[p.id] || 0) + d, -2, 3);
  const after = p.rel[o.id];
  if (before < 1 && after >= 1) { addLog(`${nm(p)}と${nm(o)}が仲良くなった`, p.id, 'rel'); sceneHit('friends', p, `${nm(p)}と${nm(o)}が仲良くなった`); }
  if ((p.awk || {})[o.id] && after >= .3) { delete p.awk[o.id]; addLog(`${nm(p)}と${nm(o)}が仲直りした`, p.id, 'rel'); sceneHit('make_up', p, `${nm(p)}と${nm(o)}が仲直りした`); }
  if (before < 2.2 && after >= 2.2) { addLog(`${nm(p)}と${nm(o)}は、もう親友だ`, p.id, 'rel'); sceneHit('bestie', p, `${nm(p)}と${nm(o)}が親友になった`); if (compat(p, o) < .45) sceneHit('opposites', p, `性格が正反対の${nm(p)}と${nm(o)}が親友になった`); }
  if (before > -.6 && after <= -.6) { addLog(`${nm(p)}と${nm(o)}のあいだが、少し気まずい`, p.id, 'rel'); sceneHit('awkward', p, `${nm(p)}と${nm(o)}のあいだが気まずくなった`); (p.awk ||= {})[o.id] = 1; }
}
function resolveTalk(p, o, argue) {
  const first = p.rel[o.id] === undefined, c = compat(p, o);
  if (first) { addLog(`${nm(p)}と${nm(o)}がはじめて言葉を交わした`, p.id); sceneHit('first_talk', p, `${nm(p)}と${nm(o)}がはじめて言葉を交わした`); }
  if (p.reunite?.includes(o.id) || o.reunite?.includes(p.id)) { sceneHit('reunion', p, `${nm(p)}と${nm(o)}が別の島で再会した`); p.reunite = (p.reunite || []).filter(i => i !== o.id); o.reunite = (o.reunite || []).filter(i => i !== p.id); }
  if (argue && !first && Math.random() < .5) addLog(`${nm(p)}と${nm(o)}が言い合いになった`, p.id);
  if (argue) sceneHit('argue', p, `${nm(p)}と${nm(o)}が言い合いになった`);
  bumpRel(p, o, argue ? -.35 : .14 + c * .22 + (p.traits.soc + o.traits.soc) * .04);
  p.needs.lonely = Math.max(0, p.needs.lonely - .6); o.needs.lonely = Math.max(0, o.needs.lonely - .6);
  p.stats.talked++; o.stats.talked++;
}

// ---------- 建てる ----------
const count = t => S.structures.filter(s => s.type === t).length;
const afford = t => S.stock.wood >= TYPES[t].wood && S.stock.stone >= TYPES[t].stone;
const LIMIT = { bench: () => 1 + Math.floor(S.people.length / 3), stall: () => 2, well: () => 2, tower: () => 2, lamp: () => 1 + Math.floor(S.people.length / 2), flowers: () => 1 + Math.floor(S.people.length / 2), field: () => Math.ceil(S.people.length / 2) + 1, path: () => 99 };
function pathMid(s) { const a = s.pts[0], b = s.pts[s.pts.length - 1]; return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }; }

function spotFor(type, p) {
  const h = homeOf(p), w = walkR();
  switch (type) {
    case 'house': return spot(3, w * .85, 1.5);
    case 'field': return spot(2.8, w * .9, 1.6);
    case 'bench': return Math.random() < .5 || !h ? spot(2.3, 3.4, .9) : spot(2.3, w, .9, { x: h.x, z: h.z, r0: 1.4, r1: 2.2 });
    case 'well': return spot(2.4, 4.8, 1.2);
    case 'tower': return spot(w * .62, w * .92, 1.2);
    case 'stall': return spot(2.3, 3.8, 1.2);
    case 'lamp': { const anchor = pick(S.structures.filter(s => s.done && s.type !== 'path')) || { x: 0, z: 0 }; return spot(2.2, w, .5, { x: anchor.x, z: anchor.z, r0: 1, r1: 1.7 }); }
    case 'flowers': return h ? spot(2.2, w, .7, { x: h.x, z: h.z, r0: 1.1, r1: 1.8 }) : spot(2.4, w, .9);
  }
  return null;
}
function startSite(type, p, sp, extra = {}) {
  if (!sp) return false;
  const c = TYPES[type];
  S.stock.wood -= c.wood; S.stock.stone -= c.stone;
  const s = { id: nid(), type, x: sp.x, z: sp.z, rot: Math.atan2(-sp.x, -sp.z), owner: p.id, work: 0, progress: 0, done: false, day: S.day, helpers: [], ...extra };
  if (type === 'field') s.ripe = 0;
  S.structures.push(s);
  if (type !== 'house') addLog(`${nm(p)}が「${c.name}を作ろう」と言い出した`, p.id);
  return true;
}
function plan() {
  if (!S.people.length) return;
  const sites = S.structures.filter(s => !s.done).length;
  if (sites >= (S.people.length >= 6 ? 2 : 1)) return;
  // 1) 家のない人に家
  const homeless = S.people.filter(p => !S.structures.some(s => s.type === 'house' && s.owner === p.id));
  if (homeless.length) {
    const p = homeless[0];
    const vacant = S.structures.find(s => s.type === 'house' && !byId(s.owner));
    if (vacant) { vacant.owner = p.id; addLog(`${nm(p)}が空き家に住みはじめた`, p.id); return; }
    if (afford('house')) startSite('house', p, spotFor('house', p));
    return;                                        // 家が先。資材は家のためにとっておく
  }
  // 2) 食べ物が足りなければ畑
  if (count('field') < LIMIT.field() && S.stock.food < S.people.length * 3 && afford('field')) {
    const p = S.people.slice().sort((a, b) => (b.traits.act + b.traits.tidy) - (a.traits.act + a.traits.tidy))[0];
    if (startSite('field', p, spotFor('field', p))) return;
  }
  // 3) 誰かひとりの「欲しい」
  const p = pick(S.people);
  for (const [k] of ranked(p.traits).slice(0, 3)) {
    for (const type of shuffle(WISH[k])) {
      if (count(type) >= LIMIT[type]() || !afford(type)) continue;
      if (type === 'path') {
        const h = S.structures.find(s => s.type === 'house' && s.done && !S.structures.some(o => o.type === 'path' && o.from === s.id));
        if (!h) continue;
        const d = doorOf(h), r = Math.hypot(d.x, d.z), n = Math.max(2, Math.floor((r - 2) / .48)), pts = [];
        for (let i = 0; i <= n; i++) { const t = i / n, rr = lerp(r, 2.05, t) / r; pts.push({ x: d.x * rr + rand(-.08, .08), z: d.z * rr + rand(-.08, .08) }); }
        if (startSite('path', p, pts[0], { pts, from: h.id })) return;
        continue;
      }
      const sp = spotFor(type, p);
      if (sp && startSite(type, p, sp)) return;
    }
  }
}
function completeSite(s) {
  s.done = true; s.doneDay = S.day; s.claim = 0;
  const owner = byId(s.owner), helpers = (s.helpers || []).map(byId).filter(Boolean);
  helpers.forEach(h => h.stats.built++);
  const others = helpers.filter(h => h !== owner);
  const withTxt = others.length ? `（${others.slice(0, 2).map(h => nm(h)).join('と')}${others.length > 2 ? 'たち' : ''}が手伝った）` : '';
  if (s.type === 'house') addLog(`${owner ? nm(owner) : 'だれか'}の家ができた${withTxt}`, s.owner, 'build');
  else addLog(`${TYPES[s.type].name}ができた。言い出したのは${owner ? nm(owner) : 'だれか'}${withTxt}`, s.owner, 'build');
  if (s.type === 'house') sceneHit('first_house', s, `${owner ? nm(owner) : 'だれか'}の家ができた`);
  if (['path', 'well', 'stall', 'tower'].includes(s.type)) sceneHit(s.type, s, `${TYPES[s.type].name}ができた。言い出したのは${owner ? nm(owner) : 'だれか'}`);
  for (const h of helpers) if (h.act && h.act.sid === s.id) endAct(h);
  fx.pop(s);
  checkLevel();
}
function checkLevel() {
  const n = S.structures.filter(s => s.done).length;
  let lv = 0; LEVELS.forEach((L, i) => { if (n >= L.need) lv = i; });
  if (lv > S.level) {
    const oldW = walkR();
    S.level = lv; S.R = LEVELS[lv].R;
    S.pending = { r0: oldW, r1: walkR() };
    addLog(`島が広がった。ここは「${LEVELS[lv].name}」になった`, null, 'level');
    for (const k of [1, 3, 5]) if (lv >= k) sceneHit('level' + k, { x: 0, z: 0 }, `${S.name}が「${LEVELS[k].name}」になった`);
    fx.levelUp(lv);
  }
}

// ---------- 1歩すすめる ----------
let planT = 0;
function simStep(dt) {
  S.time += dt / DAY;
  if (S.time >= 1) { S.time -= 1; S.day++; }
  for (const t of S.trees) if (t.s < 1) t.s = Math.min(1, t.s + dt / 150);
  for (const b of S.bushes) if (!b.berries && (b.re += dt) > 75) { b.berries = true; b.re = 0; }
  for (const r of S.rocks) if (r.amt <= 0 && (r.re += dt) > 200) {
    const sp = spot(2.4, walkR(), .9); if (sp) { r.x = sp.x; r.z = sp.z; } r.amt = 4; r.re = 0;
  }
  for (const s of S.structures) if (s.type === 'field' && s.done && s.ripe < 1) s.ripe = Math.min(1, s.ripe + dt / 95);
  if ((planT -= dt) <= 0) { planT = 5; plan(); }
  for (const p of S.people) {
    const n = p.needs, sl = asleep(p);
    n.hunger = clamp(n.hunger + dt * .0042, 0, 1);
    if (!sl) n.energy = clamp(n.energy - dt * .0028 * (.7 + p.traits.act * .6), 0, 1);
    n.lonely = clamp(n.lonely + dt * .0035 * (.4 + p.traits.soc), 0, 1);
    if (p.chrono > 0 && !asleep(p) && S.time > .8 && S.time < .9 && S.people.filter(asleep).length >= 2) sceneHit('night_owl', p, `みんなが寝たあとも、${nm(p)}はまだ起きていた`);
    if (!p.act) decide(p);
    if (p.act) runAct(p, dt);
    clampWalk(p);
  }
}
function catchUp(sec) {
  if (sec < 5) return [];
  const from = S.log.length;
  quiet = true;
  let left = Math.min(sec, DAY * 2);
  while (left > 0) { const s = Math.min(.5, left); simStep(s); left -= s; }
  quiet = false;
  if (S.pending) { populate(S.pending.r0, S.pending.r1); S.pending = null; }
  return S.log.slice(from);
}

/* =========================================================
   3D
   ========================================================= */
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const sky = new THREE.Color('#EFE9DF');
const FR = 10;
const camera = new THREE.OrthographicCamera(-FR, FR, FR, -FR, .1, 300);
const portraitMode = () => innerWidth / innerHeight < 1;
{ const pol = portraitMode() ? .8 : .95, r = 40; camera.position.set(Math.sin(pol) * r * Math.SQRT1_2, Math.cos(pol) * r, Math.sin(pol) * r * Math.SQRT1_2); }
// 島全体ではなく「建物と住人がいる範囲」に寄る
function inhabitedR() { let m = 0; for (const st of S.structures) m = Math.max(m, Math.hypot(st.x, st.z)); return Math.max(4.5, m + 1.8); }
const fitZoom = () => !S.people.length ? (portraitMode() ? Math.min(1.2, 11.2 / S.R) : Math.min(.95, 8.9 / S.R))
  : portraitMode() ? clamp(9.5 / inhabitedR(), 1.6, 2.4) : clamp(11 / inhabitedR(), .95, 1.8);
camera.zoom = fitZoom();
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.minPolarAngle = .72; controls.maxPolarAngle = 1.12;
controls.minZoom = .55; controls.maxZoom = 4;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.autoRotate = true; controls.autoRotateSpeed = .35;
let lastTouch = 0;
controls.addEventListener('start', () => { controls.autoRotate = false; lastTouch = performance.now(); });
controls.addEventListener('end', () => { lastTouch = performance.now(); });

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.0);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(hemi, sun, sun.target);
function fitShadow() { const c = sun.shadow.camera, e = view.R + 2; c.left = -e; c.right = e; c.top = e; c.bottom = -e; c.near = 1; c.far = 90; c.updateProjectionMatrix(); }
fitShadow();

const GEO = {}, MAT = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const mat = (hex, o = {}) => { const k = hex + JSON.stringify(o); return MAT[k] || (MAT[k] = new THREE.MeshLambertMaterial({ color: hex, flatShading: true, ...o })); };
function mesh(g, m, cast = true, recv = false) { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = recv; return x; }
const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (a, b, h, n = 8) => geo(`c${a},${b},${h},${n}`, () => new THREE.CylinderGeometry(a, b, h, n));
const cone = (r, h, n = 7) => geo(`k${r},${h},${n}`, () => new THREE.ConeGeometry(r, h, n));
const ico = (r, d = 0) => geo(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const sph = (r, a = 12, b = 10) => geo(`s${r},${a},${b}`, () => new THREE.SphereGeometry(r, a, b));

const GREENS_RIM = ['#7FA65A', '#6F9A4E', '#8DB063'];
// ---- 島 ----
const islandTop = mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), false, true);
const islandBottom = mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), true, false);
scene.add(islandTop, islandBottom);
const _c = new THREE.Color(), _c2 = new THREE.Color();
function faceColors(g, fn) {
  const ng = g.toNonIndexed(), pos = ng.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    fn(cx, cy, cz, i);
    for (let j = 0; j < 3; j++) { col[(i + j) * 3] = _c.r; col[(i + j) * 3 + 1] = _c.g; col[(i + j) * 3 + 2] = _c.b; }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.computeVertexNormals();
  return ng;
}
function buildIsland() {
  const Rv = view.R, M = 84, N = Math.max(9, Math.round(Rv * 1.35));
  // 上面
  const pos = [0, groundH(0, 0), 0], idx = [];
  for (let i = 1; i <= N; i++) for (let j = 0; j < M; j++) {
    const th = j / M * Math.PI * 2, er = edgeR(th), r = er * i / N, x = Math.cos(th) * r, z = Math.sin(th) * r;
    pos.push(x, i === N ? .02 : groundH(x, z), z);
  }
  const vi = (i, j) => i === 0 ? 0 : 1 + (i - 1) * M + (j % M);
  for (let j = 0; j < M; j++) idx.push(0, vi(1, j + 1), vi(1, j));
  for (let i = 1; i < N; i++) for (let j = 0; j < M; j++) { idx.push(vi(i, j), vi(i, j + 1), vi(i + 1, j)); idx.push(vi(i, j + 1), vi(i + 1, j + 1), vi(i + 1, j)); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  // 上面は頂点ごとに色をつけてなめらかに（三角形の継ぎ目を見せない）
  const low = new THREE.Color('#B2C677'), high = new THREE.Color('#6A9852'), rim = new THREE.Color('#79994F'), plazaC = new THREE.Color('#C2C88E');
  const cols = new Float32Array(pos.length);
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], r = Math.hypot(x, z), ri = v === 0 ? 0 : r / edgeR(Math.atan2(z, x)) * N;
    _c.copy(low).lerp(high, clamp(y / 1.05, 0, 1));
    if (ri > N - 1.4) _c.lerp(rim, smooth(N - 1.4, N, ri));
    if (ri < 2.4) _c.lerp(plazaC, (1 - smooth(1.2, 2.4, ri)) * .7);
    _c.offsetHSL(0, 0, (vnoise(x * .9, z * .9, S.seed + 30) - .5) * .05);
    cols[v * 3] = _c.r; cols[v * 3 + 1] = _c.g; cols[v * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  islandTop.geometry.dispose(); islandTop.geometry = g;
  placeRim();
  // 裏側（土と岩の塊）
  const rings = [[1, .02], [1.015, -.3], [.9, -1.2], [.74, -2.6], [.54, -4.2], [.33, -6.0], [.14, -7.4]], sc = Rv / 9, bp = [], bi = [];
  rings.forEach(([f, y], k) => {
    for (let j = 0; j < M; j++) {
      const th = j / M * Math.PI * 2, er = edgeR(th), jr = k === 0 ? 1 : 1 + (vnoise(j * .35, k * 3, S.seed + 21) - .5) * .16;
      bp.push(Math.cos(th) * er * f * jr, k === 0 ? y : y * sc + (vnoise(j * .5, k, S.seed + 4) - .5) * (k < 2 ? .25 : 1.2), Math.sin(th) * er * f * jr);
    }
  });
  bp.push(0, -8.4 * sc, 0);
  const tip = rings.length * M;
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < M; j++) {
    const a = k * M + j, b = k * M + (j + 1) % M, c = (k + 1) * M + j, d = (k + 1) * M + (j + 1) % M;
    bi.push(a, c, b, b, c, d);
  }
  for (let j = 0; j < M; j++) bi.push((rings.length - 1) * M + j, tip, (rings.length - 1) * M + (j + 1) % M);
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.setIndex(bi);
  const grassLip = new THREE.Color('#6F9A50'), soil = new THREE.Color('#7C5C3E'), rockA = new THREE.Color('#9D9389'), rockB = new THREE.Color('#82786F'), haze = new THREE.Color('#B9BDC0');
  const bot = faceColors(g, (x, y, z) => {
    if (y > -.25) _c.copy(grassLip);
    else if (y > -1.3 * sc) _c.copy(soil);
    else _c.copy(rockA).lerp(rockB, hash(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3))).lerp(haze, smooth(-2 * sc, -8 * sc, y) * .55);
    _c.offsetHSL(0, 0, (hash(Math.round(x * 5), Math.round(y * 5), 3) - .5) * .05);
  });
  islandBottom.geometry.dispose(); islandBottom.geometry = bot;
}

// ---- 島の縁の草・垂れた根・浮き岩 ----
const tufts = [], roots = [], floaters = [];
for (let i = 0; i < 40; i++) { const m = mesh(cone(.13, .34, 4), mat(GREENS_RIM[i % 3]), false); scene.add(m); tufts.push(m); }
for (let i = 0; i < 7; i++) { const m = mesh(cone(.06, 1.6, 4), mat('#6B5139'), false); m.rotation.x = Math.PI; scene.add(m); roots.push(m); }
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group(), r = mesh(geo('frock', () => new THREE.DodecahedronGeometry(.5, 0)), mat('#93897F'), false); r.scale.set(1, 1.4, 1); r.position.y = -.4;
  const t = mesh(cyl(.5, .45, .14, 7), mat('#7FA65A'), false); t.position.y = .3; g.add(r, t); g.userData.ph = i * 1.7; scene.add(g); floaters.push(g);
}
function placeRim() {
  tufts.forEach((m, i) => { const th = i / tufts.length * Math.PI * 2 + hash(i, 3, S.seed) * .12, er = edgeR(th); m.position.set(Math.cos(th) * er * .995, .05, Math.sin(th) * er * .995); m.rotation.set(Math.sin(th) * .5, 0, -Math.cos(th) * .5); m.scale.setScalar(.7 + hash(i, 7, S.seed) * .7); });
  roots.forEach((m, i) => { const th = i / roots.length * Math.PI * 2 + .4, er = edgeR(th) * .82; m.position.set(Math.cos(th) * er, -1.6 * view.R / 9 - .7, Math.sin(th) * er); m.scale.y = .6 + hash(i, 9, S.seed) * .9; });
}

// ---- 雲と鳥 ----
const clouds = [], CLOUD = new THREE.MeshBasicMaterial({ color: '#FBFAF7' }), WHITE = new THREE.Color('#FFFFFF');
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group(), n = 3 + Math.floor(rand(0, 3));
  for (let k = 0; k < n; k++) { const m = mesh(ico(rand(.7, 1.3), 2), CLOUD, false); m.position.set(k * rand(.8, 1.1) - n * .45, rand(-.2, .3), rand(-.4, .4)); m.scale.y = .62; g.add(m); }
  const below = i % 5 < 3; g.userData = { a: i / 14 * Math.PI * 2 + rand(-.3, .3), r: below ? rand(8, 16) : rand(17, 23), y: below ? rand(-10, -7) : rand(-1.5, 1.2), s: rand(.006, .014) }; g.scale.setScalar(below ? rand(.9, 1.3) : 1);
  scene.add(g); clouds.push(g);
}
const birds = new THREE.Group();
const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.35, 0, -.12, -.05, 0, .14], 3)); wingG.computeVertexNormals();
for (let i = 0; i < 3; i++) {
  const b = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#F4F1EA', side: THREE.DoubleSide });
  const l = new THREE.Mesh(wingG, m), r = new THREE.Mesh(wingG, m); r.scale.x = -1;
  b.add(l, r); b.position.set(-i * .6, i % 2 * .25, -i * .7); b.userData = { l, r, o: i };
  birds.add(b);
}
// 鳥は斜め上からだと破片に見えるので出さない（visual-critic 2回目）

// ---- 広場（焚き火と資材置き場） ----
const plaza = new THREE.Group(); plaza.position.y = .12; scene.add(plaza);   // 広場の地面の高さ（約0.14）に合わせる
for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, m = mesh(ico(.11), mat('#A39C93')); m.position.set(Math.cos(a) * .42, .06, Math.sin(a) * .42); m.scale.y = .7; plaza.add(m); }
// 六角の敷石
for (const [n, r] of [[10, .95], [16, 1.55]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r, m = mesh(cyl(.25, .27, .07, 6), mat(i % 3 ? '#D7CFC2' : '#CBC2B4'), false, true); m.position.set(Math.cos(a) * r, groundH(Math.cos(a) * r, Math.sin(a) * r) - .09, Math.sin(a) * r); m.rotation.y = a; plaza.add(m); }
// 組んだ薪
for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, m = mesh(cyl(.035, .045, .5, 5), mat('#6B4B33'), false); m.position.set(Math.cos(a) * .1, .2, Math.sin(a) * .1); m.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); plaza.add(m); }
const sparks = [];
for (let i = 0; i < 6; i++) { const m = mesh(box(.035, .035, .035), new THREE.MeshBasicMaterial({ color: '#FFC56E' }), false); m.userData.t = i / 6 * 1.2; plaza.add(m); sparks.push(m); }
for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + .5, m = mesh(cyl(.09, .09, .62, 7), mat('#8B6440')); m.rotation.z = Math.PI / 2; m.rotation.y = -a; m.position.set(Math.cos(a) * 1.25, .09, Math.sin(a) * 1.25); plaza.add(m); }
const fireMat = new THREE.MeshBasicMaterial({ color: '#F2A33A' }), fireMat2 = new THREE.MeshBasicMaterial({ color: '#FFE39A' });
const flame = mesh(cone(.16, .5, 6), fireMat, false), flame2 = mesh(cone(.09, .34, 6), fireMat2, false);
flame.position.y = .36; flame2.position.y = .32; plaza.add(flame, flame2);
const fireLight = new THREE.PointLight('#FFB46B', 0, 7, 1.6); fireLight.position.y = .7; plaza.add(fireLight);
const pile = new THREE.Group(); pile.position.set(STOCK.x, 0, STOCK.z); plaza.add(pile);
const woodBits = [], stoneBits = [], foodBits = [];
for (let i = 0; i < 12; i++) { const m = mesh(cyl(.07, .07, .5, 6), mat('#9A6E45')); m.rotation.z = Math.PI / 2; m.position.set(-.22, .07 + Math.floor(i / 4) * .13, (i % 4) * .15 - .22 + (Math.floor(i / 4) % 2) * .07); pile.add(m); woodBits.push(m); }
for (let i = 0; i < 10; i++) { const m = mesh(ico(.1), mat('#A8A096')); m.position.set(.24 + (i % 3) * .14 - .1, .07 + Math.floor(i / 3) * .1, (i % 4) * .1 - .15); pile.add(m); stoneBits.push(m); }
const basket = mesh(cyl(.2, .15, .16, 10), mat('#B98C55')); basket.position.set(.05, .08, .42); pile.add(basket);
for (let i = 0; i < 10; i++) { const m = mesh(sph(.045, 6, 5), mat('#C8432B'), false); const a = i * 2.4; m.position.set(.05 + Math.cos(a) * .1 * (i % 3) / 2, .18 + Math.floor(i / 5) * .04, .42 + Math.sin(a) * .1 * (i % 3) / 2); pile.add(m); foodBits.push(m); }

// ---- 木・岩・茂み ----
const GREENS = ['#6F9A4E', '#5E8C4A', '#88A85A', '#7DA35F'];
function makeTree(t) {
  const g = new THREE.Group(), c = mat(GREENS[t.c || 0]);
  const trunk = mesh(cyl(.06, .12, .42, 6), mat('#8B6440')); trunk.position.y = .21; g.add(trunk);
  const crown = new THREE.Group(); g.add(crown);
  if (t.k === 0) { const a = mesh(cone(.42, .72, 7), c); a.position.y = .66; const b = mesh(cone(.3, .56, 7), c); b.position.y = 1.0; crown.add(a, b); }
  else { const a = mesh(ico(.36, 1), c); a.position.y = .74; const b = mesh(ico(.28, 1), c); b.position.set(.2, .96, .08); const d = mesh(ico(.26, 1), mat(GREENS[(t.c + 1) % 4])); d.position.set(-.18, .9, -.1); crown.add(a, b, d); }
  g.userData = { trunk, crown, ph: rand(0, 6.28) };
  g.rotation.y = rand(0, 6.28);
  return g;
}
function makeRock() { const g = new THREE.Group(), m = mesh(geo('rock', () => new THREE.DodecahedronGeometry(.3, 0)), mat('#A39C93')); m.scale.set(1, .7, .9); m.position.y = .14; m.rotation.set(rand(0, 3), rand(0, 3), 0); g.add(m); return g; }
function makeBush() {
  const g = new THREE.Group(), b = mesh(ico(.26), mat('#5F8F4E')); b.position.y = .2; b.scale.y = .85; g.add(b);
  const berries = new THREE.Group();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, m = mesh(sph(.045, 6, 5), mat('#C8432B'), false); m.position.set(Math.cos(a) * .22, .2 + (i % 2) * .1, Math.sin(a) * .22); berries.add(m); }
  g.add(berries); g.userData.berries = berries;
  return g;
}

// ---- 建物 ----
function makeStructure(s) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const owner = byId(s.owner), oc = owner ? owner.look.clothes : '#B85A3E';
  const wood = mat('#9C7350'), stone = mat('#B9B0A4');
  const add = (m, x, y, z) => { m.position.set(x, y, z); body.add(m); return m; };
  switch (s.type) {
    case 'house': {
      const tidy = owner ? owner.traits.tidy : .5, logHouse = tidy < .42;
      add(mesh(box(.92, .62, .8), mat(logHouse ? '#C49A6C' : '#EFE8DC')), 0, .31, 0);
      const roof = add(mesh(cone(.8, .52, 4), mat(oc === '#EDE9E1' ? '#B9B0A4' : oc)), 0, .88, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = .9;
      add(mesh(box(.19, .34, .03), mat('#6B4B33')), -.15, .17, .41);
      const win = new THREE.MeshLambertMaterial({ color: '#4A505C', emissive: '#FFC56E', emissiveIntensity: 0 });
      add(mesh(box(.2, .17, .03), win, false), .2, .36, .41);
      add(mesh(box(.12, .28, .12), mat('#8C8379')), .26, 1.0, -.15);
      add(mesh(box(.17, .04, .17), mat('#5E5750')), .26, 1.15, -.15);
      add(mesh(box(.98, .04, .86), mat('#5E5047')), 0, .63, 0);
      add(mesh(box(.26, .23, .02), mat('#F4F0E8'), false), .2, .36, .405);
      add(mesh(box(.27, .04, .14), mat('#B9B0A4'), false, true), -.15, .02, .5);
      add(mesh(box(.94, .06, .82), mat('#8C8379'), false, true), 0, .03, 0);
      g.userData.win = win;
      break;
    }
    case 'field': {
      add(mesh(box(1.5, .07, 1.05), mat('#8A6646'), false, true), 0, .035, 0);
      const crops = new THREE.Group(); body.add(crops);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const m = mesh(cone(.09, .26, 5), mat('#7FB04F')); m.position.set(-.54 + i * .36, .18, -.32 + j * .32); crops.add(m); }
      g.userData.crops = crops;
      break;
    }
    case 'bench': {
      const bg = new THREE.Group(); bg.scale.setScalar(1.4); body.add(bg);
      const pt = (m, x, y, z) => { m.position.set(x, y, z); bg.add(m); };
      pt(mesh(box(.82, .06, .26), wood), 0, .24, 0); pt(mesh(box(.82, .2, .05), wood), 0, .38, -.12);
      pt(mesh(box(.06, .22, .22), wood), -.34, .11, 0); pt(mesh(box(.06, .22, .22), wood), .34, .11, 0);
      break;
    }
    case 'well': {
      add(mesh(cyl(.33, .35, .34, 10), stone), 0, .17, 0);
      add(mesh(cyl(.26, .26, .02, 10), mat('#7FA9C4'), false), 0, .3, 0);
      add(mesh(box(.05, .66, .05), wood), -.3, .5, 0); add(mesh(box(.05, .66, .05), wood), .3, .5, 0);
      const r = add(mesh(cone(.5, .3, 4), mat(oc)), 0, .95, 0); r.rotation.y = Math.PI / 4;
      break;
    }
    case 'tower': {
      for (const [x, z] of [[-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]]) add(mesh(cyl(.035, .045, 1.5, 5), wood), x, .75, z);
      add(mesh(box(.82, .08, .82), wood), 0, 1.5, 0);
      add(mesh(box(.82, .16, .04), wood), 0, 1.62, .39); add(mesh(box(.82, .16, .04), wood), 0, 1.62, -.39);
      const r = add(mesh(cone(.66, .42, 4), mat(oc)), 0, 2.02, 0); r.rotation.y = Math.PI / 4;
      add(mesh(cyl(.02, .02, .5, 4), mat('#3B3B3B')), 0, 2.4, 0);
      const flag = add(mesh(box(.22, .13, .01), mat('#C8432B', { side: THREE.DoubleSide }), false), .12, 2.56, 0); g.userData.flag = flag;
      break;
    }
    case 'path': {
      const stones = [];
      for (const pt of s.pts) { const m = mesh(cyl(.17, .19, .05, 6), mat('#CFC6B8'), false, true); m.position.set(pt.x - s.x, 0, pt.z - s.z); m.rotation.y = rand(0, 1); body.add(m); stones.push(m); }
      g.userData.stones = stones;
      break;
    }
    case 'lamp': {
      add(mesh(cyl(.035, .045, 1.05, 6), mat('#3B3836')), 0, .52, 0);
      add(mesh(box(.17, .19, .17), LAMP, false), 0, 1.12, 0);
      add(mesh(cone(.14, .1, 4), mat('#3B3836')), 0, 1.26, 0).rotation.y = Math.PI / 4;
      break;
    }
    case 'flowers': {
      add(mesh(box(.72, .13, .4), wood), 0, .065, 0);
      const cols = ['#E8A0A8', '#F2D16B', '#F7F3EA', '#C8432B', '#B7A0D6'];
      for (let i = 0; i < 8; i++) { const m = mesh(ico(.06), mat(cols[i % cols.length]), false); m.position.set(-.27 + (i % 4) * .18, .2 + (i % 3) * .02, i < 4 ? -.08 : .08); body.add(m); }
      break;
    }
    case 'stall': {
      add(mesh(box(.9, .42, .42), wood), 0, .21, 0);
      for (const [x, z] of [[-.42, -.18], [.42, -.18], [-.42, .2], [.42, .2]]) add(mesh(cyl(.025, .025, .95, 4), wood), x, .48, z);
      for (let i = 0; i < 5; i++) { const m = add(mesh(box(.19, .05, .6), mat(i % 2 ? '#F4F0E8' : oc)), -.38 + i * .19, .98, .02); m.rotation.x = -.18; }
      for (let i = 0; i < 5; i++) add(mesh(sph(.05, 6, 5), mat(pick(['#C8432B', '#E39B3B', '#7FB04F']))), -.3 + i * .15, .47, .04);
      break;
    }
  }
  if (s.type === 'lamp') g.add(pool(1.5));
  if (s.type === 'house') { const pl = new THREE.Mesh(poolGeo, POOL_DOOR); pl.rotation.x = -Math.PI / 2; pl.scale.setScalar(.9); pl.position.set(-.1, .04, .75); body.add(pl); }
  if (s.type !== 'path') {
    // 建てている途中の足場（柱と梁）
    const scaf = new THREE.Group(), r = Math.max(.32, RAD[s.type] * .62), pm = mat('#B08A5E');
    for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const m = mesh(cyl(.03, .03, .8, 4), pm, false); m.position.set(x, .4, z); scaf.add(m); }
    for (const [x, z, ry] of [[0, -r, 0], [0, r, 0], [-r, 0, Math.PI / 2], [r, 0, Math.PI / 2]]) { const m = mesh(box(r * 2, .04, .04), pm, false); m.position.set(x, .8, z); m.rotation.y = ry; scaf.add(m); }
    for (const [x, z] of [[-r * .6, r + .25], [r * .5, -r - .25]]) { const m = mesh(box(.32, .1, .12), mat('#9A6E45'), false); m.position.set(x, .05, z); scaf.add(m); }
    g.add(scaf); g.userData.scaf = scaf;
  }
  g.traverse(o => { if (o.isMesh) o.userData.sid = s.id; });
  g.rotation.y = s.type === 'path' ? 0 : s.rot;
  return g;
}
const LAMP = new THREE.MeshLambertMaterial({ color: '#F4E7C8', emissive: '#FFC56E', emissiveIntensity: 0 });

// ---- アバター ----
const SIZE = { s: 1.35, m: 1.55, l: 1.75 };   // 島の上で読める大きさ（建物よりやや大きめのちびキャラ）
function makeAvatar(p) {
  const L = p.look, has = t => p.seen.includes(t), g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const cm = mat(L.clothes), sm = mat(L.skin);
  const body = mesh(cyl(.14, .2, .36, 10), cm, false); body.position.y = .18; inner.add(body);
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * .175, .31, 0); a.rotation.z = sx * .12;
    const m = mesh(cyl(.042, .046, .2, 6), cm, false); m.position.y = -.1; a.add(m);
    const hand = mesh(sph(.042, 6, 5), sm, false); hand.position.y = -.21; a.add(hand);
    inner.add(a); arms.push(a);
  }
  const headG = new THREE.Group(); inner.add(headG);
  const head = mesh(sph(.155, 16, 12), sm, false); head.position.y = .5; headG.add(head);
  const eyeM = mat('#1F1C19'), eyes = [];
  for (const x of [-.055, .055]) { const e = mesh(sph(.019, 6, 5), eyeM, false); e.position.set(x, .51, .145); headG.add(e); eyes.push(e); }
  const hm = mat(L.hair);
  const cap = geo('hcap', () => new THREE.SphereGeometry(.163, 16, 10, 0, Math.PI * 2, 0, Math.PI * .52));
  if (L.style !== 'bald' && L.style !== 'cap') { const h = mesh(cap, hm, false); h.position.y = .51; h.rotation.x = -.32; headG.add(h); }
  if (L.style === 'long') { const b = mesh(box(.3, .3, .1), hm, false); b.position.set(0, .42, -.1); headG.add(b); }
  if (L.style === 'bun') { const b = mesh(sph(.075, 10, 8), hm, false); b.position.set(0, .7, -.07); headG.add(b); }
  if (L.style === 'cap') {
    const c = mesh(cyl(.162, .165, .1, 16), hm, false); c.position.y = .62; headG.add(c);
    const top = mesh(sph(.162, 16, 8), hm, false); top.position.y = .665; top.scale.y = .45; headG.add(top);
    const brim = mesh(cyl(.13, .13, .018, 14), hm, false); brim.position.set(0, .58, .12); brim.scale.z = .9; headG.add(brim);
  }
  if (L.glasses) { const rg = geo('lens', () => new THREE.TorusGeometry(.046, .009, 6, 14)); for (const x of [-.058, .058]) { const r = mesh(rg, eyeM, false); r.position.set(x, .512, .15); headG.add(r); } const br = mesh(box(.03, .01, .01), eyeM, false); br.position.set(0, .515, .155); headG.add(br); }
  // 見たことが、そのまま持ち物や癖になる
  if (has('イヤホンで自分の世界にいた')) for (const sx of [-1, 1]) { const e = mesh(sph(.046, 8, 6), mat('#FAF8F3'), false); e.position.set(sx * .155, .5, .02); headG.add(e); const cord = mesh(cyl(.007, .007, .26, 4), mat('#FAF8F3'), false); cord.position.set(sx * .13, .36, .06); cord.rotation.z = sx * .25; inner.add(cord); }
  if (has('何かを書いたり作ったりしていた')) { const pen = mesh(cyl(.018, .018, .17, 6), mat('#E8B33A'), false); pen.position.set(.16, .58, -.03); pen.rotation.set(0, 0, -.9); headG.add(pen); const tip = mesh(cone(.018, .04, 6), mat('#2B2B2B'), false); tip.position.set(.16 + Math.sin(.9) * .1, .58 - Math.cos(.9) * .1, -.03); tip.rotation.z = -.9 + Math.PI; headG.add(tip); }
  if (has('身なりがきっちりしていた')) { const tie = mesh(box(.05, .16, .02), mat('#2B2B2B'), false); tie.position.set(0, .24, .178); tie.rotation.x = -.2; inner.add(tie); }
  if (has('持ち物がごちゃっとしていた')) {
    const bp = mesh(box(.22, .24, .12), mat('#8B6B4A'), false); bp.position.set(0, .24, -.19); inner.add(bp);
    const st = mesh(cyl(.012, .012, .24, 4), mat('#C49A6C'), false); st.position.set(.06, .42, -.2); st.rotation.z = .45; inner.add(st);
    const pa = mesh(box(.09, .11, .015), mat('#F4F0E8'), false); pa.position.set(-.05, .4, -.215); pa.rotation.z = -.3; inner.add(pa);
  }
  if (has('荷物を持ってあげていた')) { const tote = mesh(box(.2, .24, .07), mat('#D9CBB0'), false); tote.position.set(0, -.34, .02); arms[1].add(tote); const hd = mesh(geo('handle', () => new THREE.TorusGeometry(.06, .01, 4, 10, Math.PI)), mat('#B8A788'), false); hd.position.set(0, -.22, .02); arms[1].add(hd); }
  if (has('本や画面に集中していた')) { const bk = mesh(box(.18, .22, .035), mat('#3E5C8A'), false); bk.position.set(0, -.27, .07); bk.rotation.x = -.6; arms[0].add(bk); const pg = mesh(box(.16, .2, .01), mat('#F4F0E8'), false); pg.position.set(0, -.265, .095); pg.rotation.x = -.6; arms[0].add(pg); }
  if (has('しきりに時計を見ていた')) { const w = mesh(cyl(.066, .066, .03, 10), mat('#2B2B2B'), false); w.position.set(0, -.17, .02); w.rotation.x = Math.PI / 2; arms[0].add(w); const face = mesh(cyl(.05, .05, .01, 10), mat('#F4F0E8'), false); face.position.set(0, -.17, .04); face.rotation.x = Math.PI / 2; arms[0].add(face); }
  let bird = null;
  if (has('動物や植物に目を止めていた')) {
    bird = new THREE.Group();
    const bb = mesh(sph(.055, 8, 6), mat('#8C949C'), false), beak = mesh(cone(.02, .06, 4), mat('#E39B3B'), false);
    beak.rotation.x = Math.PI / 2; beak.position.z = .07; bird.add(bb, beak); bird.position.set(.03, .7, 0); bird.visible = false; headG.add(bird);
  }
  const carry = mesh(box(.17, .12, .17), mat('#9A6E45'), false); carry.position.y = .82; carry.visible = false; inner.add(carry);
  const blob = new THREE.Mesh(geo('blob', () => new THREE.CircleGeometry(.3, 20)), BLOB); blob.rotation.x = -Math.PI / 2; blob.position.y = .02; g.add(blob);
  const hit = new THREE.Mesh(sph(.42, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .35; hit.userData.pid = p.id; g.add(hit);
  g.scale.setScalar(SIZE[L.size] || 1);
  g.userData = {
    inner, arms, headG, eyes, bird, carry, hit, ph: rand(0, 60),
    fast: has('早足で歩いていた'), laugh: has('よく笑っていた'), look: has('キョロキョロ周りを見ていた'), music: has('イヤホンで自分の世界にいた'), watch: has('しきりに時計を見ていた'), book: has('本や画面に集中していた'),
  };
  return g;
}
const shotRT = new THREE.WebGLRenderTarget(256, 256);
shotRT.texture.colorSpace = THREE.SRGBColorSpace;
const shotScene = new THREE.Scene(), shotCam = new THREE.PerspectiveCamera(26, 1, .1, 20), shots = new Map();
shotScene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.15));
{ const l = new THREE.DirectionalLight(0xffffff, 1.5); l.position.set(2, 4, 3); shotScene.add(l); }
function avatarShot(p) {
  if (shots.has(p.id)) return shots.get(p.id);
  const a = makeAvatar(p); a.scale.setScalar(1); a.rotation.y = -.45;
  shotScene.add(a); shotCam.position.set(0, .66, 1.55); shotCam.lookAt(0, .4, 0);
  renderer.setRenderTarget(shotRT); renderer.setClearColor(0xEAE3D7, 1); renderer.clear(); renderer.render(shotScene, shotCam);
  const px = new Uint8Array(256 * 256 * 4); renderer.readRenderTargetPixels(shotRT, 0, 0, 256, 256, px);
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); shotScene.remove(a);
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), img = x.createImageData(256, 256);
  for (let r = 0; r < 256; r++) img.data.set(px.subarray((255 - r) * 1024, (256 - r) * 1024), r * 1024);   // 上下を反転
  x.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png'); shots.set(p.id, url); return url;
}
const sceneCam = new THREE.OrthographicCamera(-3.2, 3.2, 2, -2, .1, 300), sceneRT = new THREE.WebGLRenderTarget(480, 300);
sceneRT.texture.colorSpace = THREE.SRGBColorSpace;
function captureScene(key, x, z) {
  const e = ROOT.album[key]; if (!e) return;
  const dir = camera.position.clone().sub(controls.target).normalize(), tgt = new THREE.Vector3(x, groundH(x, z) + .3, z);
  sceneCam.position.copy(tgt).addScaledVector(dir, 40); sceneCam.lookAt(tgt); sceneCam.updateProjectionMatrix();
  const rv = ring.visible; ring.visible = false;
  renderer.setRenderTarget(sceneRT); renderer.setClearColor(sky, 1); renderer.clear(); renderer.render(scene, sceneCam);
  const W = 480, H = 300, px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(sceneRT, 0, 0, W, H, px);
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); ring.visible = rv;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let r = 0; r < H; r++) img.data.set(px.subarray((H - 1 - r) * W * 4, (H - r) * W * 4), r * W * 4);
  g.putImageData(img, 0, 0);
  e.img = c.toDataURL('image/jpeg', .82); save();
}
const face3d = (p, size) => `<img src="${avatarShot(p)}" width="${size}" height="${size}" alt="" style="border-radius:50%;display:block">`;
function radialTex(inner) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BLOB = new THREE.MeshBasicMaterial({ map: radialTex('rgba(40,30,20,1)'), transparent: true, opacity: .28, depthWrite: false });
const POOL = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,197,110,1)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const POOL_DOOR = POOL.clone();
const poolGeo = new THREE.CircleGeometry(1, 24);
function pool(r) { const m = new THREE.Mesh(poolGeo, POOL); m.rotation.x = -Math.PI / 2; m.scale.setScalar(r); m.position.y = .04; return m; }
const CARRY = { wood: '#9A6E45', stone: '#A8A096', food: '#C8432B' };

// ---- 選択の輪 ----
const ring = mesh(new THREE.RingGeometry(.34, .42, 40), new THREE.MeshBasicMaterial({ color: '#C8432B', transparent: true, opacity: .9, depthWrite: false }), false);
ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

// ---- 同期 ----
const objs = { trees: new Map(), rocks: new Map(), bushes: new Map(), structures: new Map(), people: new Map() };
function syncList(list, map, make, update) {
  const seen = new Set();
  for (const o of list) {
    seen.add(o.id);
    let m = map.get(o.id);
    if (!m) { m = make(o); scene.add(m); map.set(o.id, m); m.userData.born = performance.now(); }
    update(o, m);
  }
  for (const [id, m] of map) if (!seen.has(id)) { scene.remove(m); map.delete(id); }
}
function rebuildPerson(p) { shots.delete(p.id); const m = objs.people.get(p.id); if (m) { scene.remove(m); objs.people.delete(p.id); } }
function rebuildStructuresOf(p) { for (const s of S.structures) if (s.owner === p.id) { const m = objs.structures.get(s.id); if (m) { scene.remove(m); objs.structures.delete(s.id); } } }

const fxList = [];
const fx = {
  pop(s) { if (!quiet) fxList.push({ type: 'pop', sid: s.id, t: 0 }); },
  chop() { },
  levelUp(lv) { if (!quiet) ui.levelUp(lv); },
  spawn(p) { fxList.push({ type: 'spawn', pid: p.id, t: 0 }); },
};
const dust = [];
function puff(x, y, z, n = 10, col = '#E9E1D2') {
  for (let i = 0; i < n; i++) {
    const m = mesh(box(.07, .07, .07), mat(col), false); m.position.set(x, y, z);
    m.userData.v = new THREE.Vector3(rand(-1, 1), rand(.8, 2), rand(-1, 1)); m.userData.life = 1;
    scene.add(m); dust.push(m);
  }
}
const seedMesh = mesh(sph(.12, 12, 10), new THREE.MeshBasicMaterial({ color: '#FFF4D6' }), false);
const seedGlow = mesh(sph(.3, 12, 10), new THREE.MeshBasicMaterial({ color: '#FFE2A8', transparent: true, opacity: .35, depthWrite: false }), false);
seedMesh.add(seedGlow); seedMesh.visible = false; scene.add(seedMesh);

function syncScene(dt, now) {
  const tsec = now / 1000;
  syncList(S.trees, objs.trees, makeTree, (t, m) => {
    m.position.set(t.x, groundH(t.x, t.z) - .03, t.z);
    const s = t.s, u = m.userData;
    if (s < .15) { u.crown.visible = false; u.trunk.scale.set(1, .35, 1); u.trunk.position.y = .07; m.scale.setScalar(1); }
    else { u.crown.visible = true; u.trunk.scale.set(1, 1, 1); u.trunk.position.y = .21; m.scale.setScalar(.35 + .65 * s); }
    u.crown.rotation.z = Math.sin(tsec * .9 + u.ph) * .025;
  });
  syncList(S.rocks, objs.rocks, makeRock, (r, m) => { m.visible = r.amt > 0; m.position.set(r.x, groundH(r.x, r.z), r.z); m.scale.setScalar(.6 + r.amt * .1); });
  syncList(S.bushes, objs.bushes, makeBush, (b, m) => { m.position.set(b.x, groundH(b.x, b.z) - .02, b.z); m.userData.berries.visible = b.berries; });
  const night = nightness();
  syncList(S.structures, objs.structures, makeStructure, (s, m) => {
    m.position.set(s.x, s.type === 'path' ? groundH(s.x, s.z) : groundH(s.x, s.z) - .02, s.z);
    const u = m.userData, body = m.children[0];
    if (s.type === 'path') {
      const n = u.stones.length, shown = Math.ceil(s.progress * n);
      u.stones.forEach((st, i) => { st.visible = i < shown; st.position.y = groundH(s.pts[i].x, s.pts[i].z) - m.position.y + .02; });
    } else {
      const pr = s.progress;
      if (u.scaf) { u.scaf.visible = !s.done; u.scaf.scale.y = s.done ? 1 : clamp(pr / .35, .15, 1); }
      body.visible = s.done || pr > .55;
      const k = s.done ? 1 : .1 + .9 * easeOut(clamp((pr - .55) / .45, 0, 1));
      if (!fxList.some(f => f.sid === s.id)) body.scale.set(1, k, 1);
    }
    if (u.win) {
      const home = S.people.some(p => p.inside && p.act && p.act.home === s.id);
      u.win.emissiveIntensity = lerp(u.win.emissiveIntensity, home ? night * 2.4 : night * .25, .08);
    }
    if (u.crops) { const r = s.ripe || 0; u.crops.scale.set(1, .25 + .75 * r, 1); u.crops.children.forEach(c => c.material = mat(r >= 1 ? '#D9B44A' : '#7FB04F')); }
    if (u.flag) u.flag.rotation.y = Math.sin(tsec * 3 + s.id) * .4;
  });
  LAMP.emissiveIntensity = night * 2.2; POOL.opacity = night * .55; POOL_DOOR.opacity = night * .3;

  syncList(S.people, objs.people, makeAvatar, (p, m) => {
    const u = m.userData, a = p.act, y = groundH(p.x, p.z), T = tsec + u.ph;
    m.position.set(p.x, y, p.z);
    const sitting = a && a.k === 'sit' && a.ph === 'work';
    const working = a && a.ph === 'work' && ['wood', 'stone', 'build', 'harvest', 'plant'].includes(a.k);
    const lying = (a && a.k === 'sleep' && a.ph === 'work' && !p.inside) || (a && a.k === 'nap');
    const talking = a && (a.k === 'chat' || (a.k === 'talk' && a.ph === 'work'));
    let hop = 0, sq = 0, lean = 0, armA = 0, headY = 0;
    if (p.moving) {
      // 1歩ごとに小さく跳ね、着地で少しつぶれる
      const f = (6 + p.traits.act * 5) * (u.fast ? 1.4 : 1), sn = Math.sin(T * f);
      hop = Math.abs(sn) * .09; sq = 1 - Math.min(1, Math.abs(sn) * 4); armA = sn * .7; lean = u.fast ? .14 : .05;
    } else if (working) { const w = Math.max(0, Math.sin(T * 9)); lean = w * .32; armA = -1.1 - w * .9; }
    else if (talking) { hop = Math.abs(Math.sin(T * 3)) * .02; armA = Math.sin(T * 2.2) * .35; }
    else if (!lying && !sitting) {
      headY = Math.sin(T * (u.look ? .9 : .35)) * (u.look ? .8 : .35) * smooth(.3, .9, Math.sin(T * .27) * .5 + .5);
      if (u.laugh && Math.sin(T * .5) > .93) hop = Math.abs(Math.sin(T * 12)) * .07;
      if (u.watch && Math.sin(T * .31) > .9) { armA = -1.4; headY = .5; }
      if (u.book) { armA = -1.15; headY = 0; }
    }
    m.visible = !p.inside;
    m.rotation.y = lerpAngle(m.rotation.y, p.dir, .2);
    u.inner.position.y = (sitting ? .24 : 0) + hop + (lying ? .12 : 0);
    u.inner.scale.set(1 + sq * .06, 1 - sq * .08, 1 + sq * .06);
    u.inner.rotation.x = lerp(u.inner.rotation.x, lean, .2);
    u.inner.rotation.z = lerp(u.inner.rotation.z, lying ? Math.PI / 2 * .92 : 0, .1);
    u.arms[0].rotation.x = lerp(u.arms[0].rotation.x, sitting ? -.7 : armA, .3);
    u.arms[1].rotation.x = lerp(u.arms[1].rotation.x, sitting ? -.7 : working || (u.book && !p.moving && !talking) ? armA : -armA, .3);
    u.headG.rotation.y = lerp(u.headG.rotation.y, headY, .1);
    const shut = lying || (T % 5) < .09;
    u.eyes.forEach(e => e.scale.y = shut ? .12 : 1);
    if (u.bird) { u.bird.visible = !p.moving && !lying && Math.sin(T * .13) > .7; if (u.bird.visible && m.visible) sceneHit('bird', p, `${nm(p)}の頭に小鳥がとまった`); }
    if (u.music && !p.moving && !lying && Math.random() < dt * .06) bubble(p, '🎵');
    u.carry.visible = !!p.carry; if (p.carry) u.carry.material = mat(CARRY[p.carry]);
    // 生まれる演出
    const born = fxList.find(f => f.type === 'spawn' && f.pid === p.id);
    if (born) {
      born.t += dt;
      if (born.t < 1.1) { m.visible = false; seedMesh.visible = true; const k = born.t / 1.1; seedMesh.position.set(p.x, y + 7 * (1 - k * k) + .3, p.z); }
      else { seedMesh.visible = false; if (!born.landed) { born.landed = true; puff(p.x, y + .2, p.z, 14, '#FFF1D2'); } const k = Math.min(1, (born.t - 1.1) / .5); m.scale.setScalar((SIZE[p.look.size] || 1) * (k < 1 ? easeBack(k) : 1)); if (born.t > 1.7) fxList.splice(fxList.indexOf(born), 1); }
    }
  });
  for (const f of fxList.slice()) {
    if (f.type !== 'pop') continue;
    f.t += dt; const m = objs.structures.get(f.sid);
    if (m) { const k = Math.min(1, f.t / .5); m.children[0].scale.setScalar(1 + Math.sin(k * Math.PI) * .14); if (!f.puffed) { f.puffed = true; puff(m.position.x, m.position.y + .3, m.position.z, 12); } }
    if (f.t > .5) fxList.splice(fxList.indexOf(f), 1);
  }
  for (const d of dust.slice()) {
    const u = d.userData; u.life -= dt * 1.4; u.v.y -= dt * 4;
    d.position.addScaledVector(u.v, dt); d.scale.setScalar(Math.max(.01, u.life)); d.rotation.x += dt * 4;
    if (u.life <= 0) { scene.remove(d); dust.splice(dust.indexOf(d), 1); }
  }
  // 資材置き場
  woodBits.forEach((m, i) => m.visible = i < Math.ceil(S.stock.wood / 2));
  stoneBits.forEach((m, i) => m.visible = i < Math.ceil(S.stock.stone / 2));
  foodBits.forEach((m, i) => m.visible = i < Math.ceil(S.stock.food / 3));
  // 焚き火
  const fl = 1 + Math.sin(tsec * 13) * .08 + Math.sin(tsec * 7.3) * .06;
  flame.scale.set(fl, fl * 1.05, fl); flame2.scale.setScalar(2 - fl);
  sparks.forEach((sp, i) => { const t = ((tsec + sp.userData.t) % 1.2) / 1.2; sp.position.set(Math.sin(i * 2.3 + tsec) * .12 * t, .45 + t * 1.1, Math.cos(i * 1.7) * .12 * t); sp.scale.setScalar(1 - t); });
  fireLight.intensity = .4 + night * 5 * fl;
  // 選択
  const sel = ui.selected && byId(ui.selected);
  if (sel && !sel.inside) { ring.visible = true; ring.position.set(sel.x, groundH(sel.x, sel.z) + .03, sel.z); ring.scale.setScalar(1 + Math.sin(tsec * 4) * .06); }
  else ring.visible = false;
  // 雲・鳥
  CLOUD.color.copy(sky).lerp(WHITE, .55 - nightness() * .3);
  for (const c of clouds) { const u = c.userData; u.a += u.s * dt; c.position.set(Math.cos(u.a) * (u.r + view.R - 9), u.y * view.R / 9, Math.sin(u.a) * (u.r + view.R - 9)); c.rotation.y = -u.a; }
  floaters.forEach((f, i) => { const a = i * 1.6 + .5, r = view.R * (.5 + i * .12); f.position.set(Math.cos(a) * r, -3.2 * view.R / 9 - i * .9 + Math.sin(tsec * .8 + f.userData.ph) * .15, Math.sin(a) * r); f.rotation.y = tsec * .05 + i; });
  const ba = tsec * .12;
  birds.position.set(Math.cos(ba) * view.R * .75, 4.2 + Math.sin(tsec * .5) * .3, Math.sin(ba) * view.R * .75);
  birds.rotation.y = -ba;
  birds.children.forEach(b => { const f = Math.sin(tsec * 9 + b.userData.o) * .6; b.userData.l.rotation.z = f; b.userData.r.rotation.z = -f; });
}
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

// ---- 1日の光 ----
const KEYS = [
  [0, '#1E2633', '#5F6E8E', '#20262F', .45, '#9FB2D8', .38],
  [.2, '#232C3A', '#66759A', '#232A35', .5, '#A5B7DA', .4],
  [.25, '#E7C7AE', '#F2D9C4', '#8A6E5C', .85, '#FFC9A0', .9],
  [.33, '#EEE6D9', '#FFF6E8', '#8A7A66', 1.0, '#FFF0D8', 1.35],
  [.5, '#EDE8DE', '#FFFFFF', '#8A7A66', 1.05, '#FFFFFF', 1.55],
  [.66, '#EADBC6', '#FFF1DE', '#8A7461', .95, '#FFE1BC', 1.25],
  [.73, '#E6B892', '#F5CDA8', '#7A5E4E', .8, '#FFAF78', .95],
  [.79, '#4E5B70', '#7C89A6', '#30363F', .6, '#AFBEDB', .42],
  [.86, '#1E2633', '#5F6E8E', '#20262F', .45, '#9FB2D8', .38],
  [1, '#1E2633', '#5F6E8E', '#20262F', .45, '#9FB2D8', .38],
];
function nightness() { const t = S.time; return t > .79 || t < .2 ? 1 : t < .27 ? 1 - smooth(.2, .27, t) : t > .72 ? smooth(.72, .79, t) : 0; }
const _a = new THREE.Color(), _b = new THREE.Color();
function lights() {
  const t = S.time; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
  const A = KEYS[i], B = KEYS[i + 1], k = smooth(0, 1, (t - A[0]) / (B[0] - A[0]));
  sky.copy(_a.set(A[1]).lerp(_b.set(B[1]), k));
  hemi.color.copy(_a.set(A[2]).lerp(_b.set(B[2]), k)); hemi.groundColor.copy(_a.set(A[3]).lerp(_b.set(B[3]), k));
  hemi.intensity = lerp(A[4], B[4], k);
  sun.color.copy(_a.set(A[5]).lerp(_b.set(B[5]), k)); sun.intensity = lerp(A[6], B[6], k);
  const day = t > .22 && t < .78, ang = day ? (t - .22) / .56 * Math.PI : ((t + (t < .22 ? 1 : 0)) - .78) / .44 * Math.PI;
  sun.position.set(Math.cos(ang) * 22, Math.sin(ang) * 20 + 7, 9);

}

// ---- 画面サイズ ----
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  let hw, hh; if (a < 1) { hw = FR; hh = FR / a; } else { hh = FR * .92; hw = hh * a; }
  camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
  if (viewOff) camera.setViewOffset(w, h, 0, viewOff, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---- タップで選ぶ ----
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (moved > 9 || dt > 450) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...objs.people.values()].filter(m => m.visible).map(m => m.userData.hit), false);
  if (hits.length) { ui.select(hits[0].object.userData.pid); return; }
  const sh = ray.intersectObjects([...objs.structures.values()], true);
  if (sh.length) { const s = sById(sh[0].object.userData.sid); if (s) { ui.structInfo(s); return; } }
  if (ui.selected) ui.closeSheet();
});

/* =========================================================
   画面（UI）
   ========================================================= */
function portrait(L, size = 64) {
  const c = L.clothes, h = L.hair, sk = L.skin, st = L.style;
  const w = { s: .9, m: 1, l: 1.1 }[L.size] || 1;
  let back = '', front = '';
  const bodyD = `M${32 - 18 * w} 64 C${32 - 18 * w} ${48} ${32 - 11 * w} 41 32 41 C${32 + 11 * w} 41 ${32 + 18 * w} 48 ${32 + 18 * w} 64 Z`;
  const fringe = `<path d="M18.3 29 C16.8 9.6 47.2 9.6 45.7 29 C44 22.5 39 19.6 33.5 19.8 C28 19.4 21.6 22.4 18.3 29 Z" fill="${h}"/>`;
  if (st === 'short') front = fringe;
  if (st === 'long') { back = `<path d="M18 26 C18 13 46 13 46 26 L47.5 45 C40 48 24 48 16.5 45 Z" fill="${h}"/>`; front = fringe; }
  if (st === 'bun') front = fringe + `<circle cx="32" cy="12.2" r="5.6" fill="${h}"/>`;
  if (st === 'cap') front = `<path d="M18.8 23.5 C19.2 10.5 44.8 10.5 45.2 23.5 Z" fill="${h}"/><rect x="15.5" y="21.6" width="33" height="3.6" rx="1.8" fill="${h}"/>`;
  const eyes = `<circle cx="27.4" cy="29" r="1.55" fill="#1F1C19"/><circle cx="36.6" cy="29" r="1.55" fill="#1F1C19"/>`;
  const gl = L.glasses ? `<g fill="none" stroke="#1F1C19" stroke-width="1.25"><circle cx="27.4" cy="29" r="3.7"/><circle cx="36.6" cy="29" r="3.7"/><path d="M31.1 29h1.8"/></g>` : '';
  const cheek = `<circle cx="23.6" cy="33" r="2.1" fill="#E5907E" opacity=".38"/><circle cx="40.4" cy="33" r="2.1" fill="#E5907E" opacity=".38"/>`;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${back}<path d="${bodyD}" fill="${c}"/><circle cx="32" cy="27.5" r="13.2" fill="${sk}"/>${front}${eyes}${gl}${cheek}</svg>`;
}
function radar(t, size = 128) {
  const cx = size / 2, cy = size / 2 + 3, r = size * .33, pts = (f) => TK.map((k, i) => { const a = -Math.PI / 2 + i / 5 * Math.PI * 2, v = f(k); return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v]; });
  const poly = f => pts(f).map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  const labels = TK.map((k, i) => { const a = -Math.PI / 2 + i / 5 * Math.PI * 2, x = cx + Math.cos(a) * (r + 17), y = cy + Math.sin(a) * (r + 13) + 3.5; return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#5F5951">${TRAITS[k].name}</text>`; }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" style="flex:none;overflow:visible">
    ${[1, .66, .33].map(s => `<polygon points="${poly(() => s)}" fill="none" stroke="rgba(31,28,25,.12)"/>`).join('')}
    <polygon points="${poly(k => .08 + t[k] * .92)}" fill="rgba(200,67,43,.16)" stroke="#C8432B" stroke-width="1.5" stroke-linejoin="round"/>
    ${labels}</svg>`;
}
function autoShort(name) {
  const m = name.match(/([^\sをにでがのは、]{1,5})(?:を|に)[^をに]*人$/);
  if (m) return m[1] + 'の人';
  return name.length <= 6 ? name : name.slice(0, 5) + '…';
}
const SIL = `<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><path d="M14 64 C14 48 21 41 32 41 C43 41 50 48 50 64 Z" fill="currentColor"/><circle cx="32" cy="27.5" r="13" fill="currentColor"/></svg>`;
const shortName = p => p.short || autoShort(p.name);
function timeName(t) { return t < .2 ? '夜ふけ' : t < .33 ? '朝' : t < .6 ? '昼' : t < .75 ? '夕方' : '夜'; }
function actText(p) { return fmt(actRaw(p)); }
function actRaw(p) {
  const a = p.act; if (!a) return 'ぼんやりしている';
  const o = a.pid && byId(a.pid), s = a.sid && sById(a.sid), go = a.ph === 'go';
  switch (a.k) {
    case 'sleep': return go ? (a.home ? '家に帰るところ' : '焚き火のそばで寝る場所を探している') : (a.home ? '家で眠っている' : '焚き火のそばで眠っている');
    case 'nap': return 'その場でうたた寝している';
    case 'eat': return go ? 'ごはんを食べに向かっている' : 'ごはんを食べている';
    case 'wood': return a.ph === 'ret' ? '切った木を運んでいる' : go ? '木を切りに向かっている' : '木を切っている';
    case 'stone': return a.ph === 'ret' ? '石を運んでいる' : go ? '石を掘りに向かっている' : '石を掘っている';
    case 'food': return a.ph === 'ret' ? '木の実を運んでいる' : go ? '木の実を採りに向かっている' : '木の実を採っている';
    case 'harvest': return go ? '畑の収穫に向かっている' : '畑で収穫している';
    case 'build': return s ? (go ? `${TYPES[s.type].name}づくりに向かっている` : `${TYPES[s.type].name}を建てている`) : '建てている';
    case 'talk': return o ? (go ? `${nm(o)}に話しかけに行く` : `${nm(o)}と話している`) : '話し相手を探している';
    case 'chat': return o ? `${nm(o)}と話している` : 'おしゃべりしている';
    case 'explore': return go ? '島のはしを探検しに行く' : 'あたりを見回している';
    case 'wander': return 'ぶらぶらしている';
    case 'sit': return go ? 'ベンチに向かっている' : 'ベンチでひと休みしている';
    case 'plant': return go ? '苗を植える場所を探している' : '木の苗を植えている';
    case 'care': return o ? (a.step === 'deliver' ? `${nm(o)}に食べ物を届けに行く` : `${nm(o)}のために食べ物を取りに行く`) : '誰かの世話を焼いている';
  }
  return 'ぼんやりしている';
}

const ui = {
  tab: 'island', selected: null, follow: false, logDirty: true, speedIdx: 1,
  select(pid) {
    const p = byId(pid); if (!p) return;
    this.selected = pid; this.follow = true; this.setTab('island');
    $('#sheet').classList.add('on'); this.renderSheet(true);
    controls.autoRotate = false; lastTouch = performance.now();
    focusOn(p.x, p.z); zoomTo = Math.max(camera.zoom, 2.2);
  },
  closeSheet() { if (this.selected) { zoomTo = fitZoom(); focusOn(0, 0); } this.selected = null; this.follow = false; $('#sheet').classList.remove('on'); },
  renderSheet(full) {
    const p = byId(this.selected); if (!p) return this.closeSheet();
    if (!full) { const n = $('#nowText'); if (n) n.textContent = actText(p); $$('[data-need]').forEach(e => e.style.width = (p.needs[e.dataset.need] * 100).toFixed(0) + '%'); return; }
    const friends = Object.entries(p.rel).map(([id, v]) => [byId(+id), v]).filter(([o]) => o).sort((a, b) => b[1] - a[1]);
    const good = friends.filter(f => f[1] >= .6).slice(0, 4), bad = friends.filter(f => f[1] <= -.6).slice(0, 2);
    const fchip = ([o, v]) => `<button class="chip friend" data-sel="${o.id}">${portrait(o.look, 20)}${esc(shortName(o))}${v >= 2.2 ? ' · 親友' : ''}</button>`;
    const h = homeOf(p);
    $('#sheetBody').innerHTML = `
      <div class="who"><div class="pt">${face3d(p, 66)}</div><div style="min-width:0">
        <div class="no">観察 No.${String(p.no).padStart(3, '0')}</div><h3>${esc(p.name)}</h3>
        <p>${esc(roleOf(p.traits))} · ${esc(p.place || '場所の記録なし')}で観察 · ${p.born}日目に誕生</p></div></div>
      <div class="now"><span class="dot"></span><span id="nowText">${esc(actText(p))}</span></div>
      <div class="needs"><span>空腹<em><b data-need="hunger" style="width:${p.needs.hunger * 100}%"></b></em></span><span>疲れ<em><b data-need="energy" style="width:${(1 - p.needs.energy) * 100}%"></b></em></span><span>さみしさ<em><b data-need="lonely" style="width:${p.needs.lonely * 100}%"></b></em></span></div>
      <div class="sec"><h4>この人らしさ</h4><div class="persona">${radar(p.traits, 120)}<p>${esc(personaText(p.traits))}${h ? '<br><small style="font-family:var(--sans);font-size:11px;color:var(--ink2)">' + (p.traits.tidy < .42 ? '丸太小屋' : '白壁の家') + 'に住んでいる</small>' : ''}</p></div></div>
      ${good.length || bad.length ? `<div class="sec"><h4>人間関係</h4><div class="chips">${good.map(fchip).join('')}${bad.map(([o]) => `<button class="chip friend guess" data-sel="${o.id}">${portrait(o.look, 20)}${esc(shortName(o))} · 気まずい</button>`).join('')}</div></div>` : ''}
      <div class="sec"><h4>あなたが見たこと</h4><div class="chips">${p.seen.length ? p.seen.map(s => `<span class="chip">${esc(s)}</span>`).join('') : '<span class="chip guess">記録なし</span>'}</div></div>
      ${p.guess.length ? `<div class="sec"><h4>あなたの予想</h4><div class="chips">${p.guess.map(s => `<span class="chip guess">きっと${esc(s)}</span>`).join('')}</div></div>` : ''}
      ${p.memo ? `<div class="sec"><h4>メモ</h4><p class="memo">${esc(p.memo)}</p></div>` : ''}
      <div class="sec"><h4>島でしたこと</h4><div class="stats"><div><b>${p.stats.built}</b><small>建てた</small></div><div><b>${p.stats.talked}</b><small>話した</small></div><div><b>${p.stats.carried}</b><small>運んだ</small></div><div><b>${p.stats.found}</b><small>見つけた</small></div></div></div>
      <div class="acts"><button class="btn ${this.follow ? 'on' : ''}" data-act="follow">${this.follow ? '追いかけるのをやめる' : '追いかける'}</button><button class="btn" data-act="edit">観察を書き足す</button></div>
      <div class="acts" style="margin-top:8px"><button class="btn" data-act="bench">島から出して待機にする</button>${ROOT.islands.length > 1 ? `<button class="btn" data-act="move">ほかの島へ引っ越す</button>` : ''}</div>
      <div class="acts" style="margin-top:8px"><button class="btn ghost" data-act="farewell" style="margin:0 auto">図鑑から消す</button></div>`;
  },
  setTab(t) {
    if (t === 'menu') return this.menu();
    this.tab = t;
    $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('#zukan').classList.toggle('on', t === 'zukan'); $('#diary').classList.toggle('on', t === 'diary');
    if (t !== 'island') this.closeSheet();
    if (t === 'zukan') this.renderZukan();
    if (t === 'diary') this.renderDiary();
    this.updateWelcome();
  },
  updateWelcome() {
    const w = $('#welcome'), hasCards = allCards().length > 0;
    w.classList.toggle('off', S.people.length > 0 || this.tab !== 'island' || formOpen);
    w.querySelector('h1').textContent = `${S.name}には、まだ誰もいません。`;
    w.querySelector('[data-act=sample]').textContent = hasCards ? '図鑑から住人を選ぶ' : '見本の3人で島を動かしてみる';
    w.querySelector('[data-act=sample]').dataset.mode = hasCards ? 'pick' : 'sample';
  },
  zview: 'people',
  renderZukan() {
    const cards = allCards().sort((a, b) => a.p.no - b.p.no), got = Object.keys(ROOT.album).length;
    $('#zukanCount').innerHTML = `<span class="seg"><button data-zv="people" class="${this.zview === 'people' ? 'on' : ''}">人とタイプ</button><button data-zv="album" class="${this.zview === 'album' ? 'on' : ''}">名場面 ${got}/${SCENES.length}</button></span>`;
    if (this.zview === 'album') return this.renderAlbum();
    const byRole = {}; for (const c of cards) (byRole[roleOf(c.p.traits)] ||= []).push(c.p);
    const filled = TYPES16.filter(([n]) => byRole[n]).length;
    const slots = TYPES16.map(([n, hint]) => { const ps = byRole[n];
      return ps ? `<button class="slot on" data-card="${ps[0].id}">${face3d(ps[0], 52)}<b>${n}</b>${ps.length > 1 ? `<i>${ps.length}</i>` : ''}</button>`
        : `<button class="slot" data-hint="${esc(n)}|${esc(hint)}"><span class="sil">${SIL}</span><b>？？？</b></button>`; }).join('');
    const where = c => c.island ? (c.island === S ? 'この島' : c.island.name) : '待機中';
    $('#zukanBody').innerHTML = `
      <div class="typehead"><h4>タイプ</h4><span><b>${filled}</b> / 16</span></div>
      <div class="slots">${slots}</div>
      <div class="typehead" style="margin-top:22px"><h4>観察した人</h4><span><b>${cards.length}</b>人</span></div>
      ${cards.length ? `<div class="grid">${cards.map(c => { const p = c.p; return `
      <button class="card ${c.island === S ? '' : 'away'}" data-card="${p.id}"><div class="no">No.${String(p.no).padStart(3, '0')}</div><span class="role">${esc(roleOf(p.traits))}</span>
      <div class="pt">${face3d(p, 84)}</div><div class="nm">${esc(p.name)}</div>
      <p class="cmemo">${esc(p.memo || (p.seen[0] ? p.seen[0] : '観察メモなし'))}</p>
      <div class="meta"><span class="where ${c.island === S ? 'here' : ''}">${esc(where(c))}</span>${c.island === S ? '<br>' + esc(actText(p)) : ''}</div></button>`; }).join('')}</div>`
      : `<div class="empty-note"><b>まだ1人もいません</b>街で見かけた人を、ひとり登録してみてください。<br>ここに観察カードが並んでいきます。</div>`}`;
  },
  renderAlbum() {
    $('#zukanBody').innerHTML = `<p class="qsub" style="margin:0 0 14px">島で一度だけの瞬間が、写真になって残ります。<br>空いている枠には、起こし方のヒントがあります。</p>
      <div class="album">${SCENES.map(([k, title, hint], i) => { const e = ROOT.album[k];
        return e ? `<div class="shot"><div class="ph">${safeImg(e.img) ? `<img src="${esc(e.img)}" alt="">` : `<span>留守のあいだの出来事</span>`}</div><div class="cap"><small>No.${String(i + 1).padStart(2, '0')}</small><b>${esc(title)}</b><p>${esc(e.text)}</p><time>${esc(e.island)} · ${+e.day || 0}日目 · ${esc(e.date)}</time></div></div>`
          : `<div class="shot locked"><div class="ph"><span>？</span></div><div class="cap"><small>No.${String(i + 1).padStart(2, '0')}</small><b>？？？</b><p>ヒント：${esc(hint)}</p></div></div>`; }).join('')}</div>`;
  },
  renderDiary() {
    this.logDirty = false;
    $('#diaryCount').textContent = `${S.day}日目`;
    if (!S.log.length) { $('#diaryBody').innerHTML = `<div class="empty-note"><b>まだ何も起きていません</b>島で起きたできごとが、ここに日記として残ります。</div>`; return; }
    const days = {}; for (const e of S.log) (days[e.d] ||= []).push(e);
    $('#diaryBody').innerHTML = Object.keys(days).sort((a, b) => b - a).slice(0, 40).map(d => `
      <div class="day"><h3>${d}日目</h3>${days[d].slice().reverse().map(e => { const p = e.pid && byId(e.pid);
      return `<div class="entry ${e.k === 'level' ? 'level' : ''}"><time>${timeName(e.t)}</time><i style="background:${p ? p.look.clothes : e.k === 'level' ? '#C8432B' : 'transparent'}"></i><span>${esc(fmt(e.text))}</span></div>`; }).join('')}</div>`).join('');
  },
  structInfo(s) {
    const o = byId(s.owner), t = TYPES[s.type];
    if (!s.done) return toast(`${t.name}を建てているところ（${Math.round(s.progress * 100)}%）`);
    toast(s.type === 'house' ? `${o ? nm(o) + 'の家' : '空き家'} · ${s.doneDay}日目に完成` : `${t.name} · 言い出したのは${o ? nm(o) : '今はいない人'} · ${s.doneDay}日目`);
  },
  levelUp(lv) { stampShow(LEVELS[lv].name, '島が広がった', '島の格'); },
  menu() {
    modal(`<h3>その他</h3>
      <button class="menu-item" data-m="export"><div>島を書き出す<small>この島をファイルに保存します。機種変更のときに使えます</small></div></button>
      <button class="menu-item" data-m="import"><div>島を読み込む<small>書き出したファイルから島を戻します</small></div></button>
      <button class="menu-item" data-m="about"><div>観察のマナー<small>実在の人を記録するときに気をつけること</small></div></button>
      <button class="menu-item danger" data-m="reset"><div>島をはじめからにする<small>住人も建物もすべて消えます</small></div></button>
      <div class="acts"><button class="btn" data-m="close">閉じる</button></div>`);
  },
};

function focusOn(x, z) { camTarget = new THREE.Vector3(x, groundH(x, z), z); }
let camTarget = null, zoomTo = null, viewOff = 0;

// ---------- トースト・判子・モーダル ----------
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = fmt(msg); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
function stampShow(big, small, top) {
  const s = $('#stamp'); $('#stampNo').textContent = big; $('#stampName').textContent = small; s.querySelector('small').textContent = top;
  s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
  navigator.vibrate?.(18);
}
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.add('on'); }
function closeModal() { $('#modal').classList.remove('on'); }
function confirmBox(title, text, okLabel, onOk) {
  modal(`<h3>${title}</h3><p>${text}</p><div class="acts"><button class="btn" data-m="close">やめる</button><button class="btn red" id="okBtn">${okLabel}</button></div>`);
  $('#okBtn').onclick = () => { closeModal(); onOk(); };
}
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal') return closeModal();
  const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
  if (m === 'close') closeModal();
  if (m === 'export') {
    const blob = new Blob([JSON.stringify(ROOT)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `人間観察コレクション_${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    closeModal(); toast('島をファイルに書き出しました');
  }
  if (m === 'import') { closeModal(); $('#importFile').click(); }
  if (m === 'about') modal(`<h3>観察のマナー</h3><p>このアプリの記録は、あなたの端末の中だけに保存され、どこにも送られません。</p>
    <p>それでも実在の人を記録するときは、次の3つを守ってください。</p><div class="away"><ul><li>本名、顔写真、勤め先など、その人だとわかることは書かない</li><li>あだ名は「赤いマフラーの人」のように、見たままにする</li><li>じっと見つめたり、あとをつけたりしない</li></ul></div><p>観察は、相手に気づかれない「ちょっとした想像」くらいがちょうどいいです。</p>
    <div class="acts"><button class="btn" data-m="close">わかった</button></div>`);
  if (m === 'reset') confirmBox('すべてはじめからにしますか？', '3つの島、図鑑、名場面がすべて消えます。元には戻せません。残したい場合は、先に「島を書き出す」をしてください。', 'はじめからにする', () => { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(ROOT_KEY); resetting = true; location.reload(); });
});
let resetting = false;
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const r = sanitizeRoot(d.v === 2 ? d : d.v === 1 && Array.isArray(d.people) ? wrapOld(d) : null); if (!r) throw 0;
    confirmBox('このデータを読み込みますか？', `島${r.islands.length}つ・図鑑${r.islands.reduce((n, i) => n + i.people.length, 0) + r.bench.length}人のデータです。今のデータは上書きされます。`, '読み込む', () => { r.islands.forEach(i => i.lastSeen = Date.now()); localStorage.setItem(ROOT_KEY, JSON.stringify(r)); resetting = true; location.reload(); });
  } catch { toast('このファイルは読み込めませんでした'); }
  e.target.value = '';
});

// ---------- 観察フォーム ----------
let F = null, formOpen = false;
const STEPS = ['どんな人？', '見たこと', 'あなたの予想', 'この人らしさ'];
function openForm(editId) {
  const p = editId && byId(editId);
  F = p ? { editId, step: 0, name: p.name, short: p.short || '', place: p.place, look: { ...p.look }, seen: [...p.seen], guess: [...p.guess], memo: p.memo || '', traits: { ...p.traits }, touched: true }
    : { step: 0, name: '', short: '', place: '', look: { clothes: pick(LOOK.clothes), hair: LOOK.hair[0], skin: pick(LOOK.skin), style: 'short', size: 'm', glasses: false }, seen: [], guess: [], memo: '', traits: null, touched: false };
  formOpen = true; ui.updateWelcome();
  $('#form').classList.add('on'); renderForm();
}
function closeForm() { formOpen = false; $('#form').classList.remove('on'); ui.updateWelcome(); document.activeElement?.blur?.(); }
function renderForm() {
  const f = F, b = $('#formBody');
  $('#formStepLabel').textContent = `${f.step + 1} / 4 · ${STEPS[f.step]}`;
  $$('#formProg i').forEach((i, k) => i.classList.toggle('on', k <= f.step));
  $('#formBack').textContent = '戻る'; $('#formBack').style.visibility = f.step ? '' : 'hidden';
  $('#formNext').textContent = f.step === 3 ? (f.editId ? 'この内容で書き直す' : '島に送り出す') : '次へ';
  $('#formNext').className = 'btn ' + (f.step === 3 ? 'red' : 'primary');
  const opts = (list, sel, attr, cls = '') => list.map(v => `<button class="opt ${cls} ${sel.includes(v) ? 'on' : ''}" data-${attr}="${esc(v)}">${esc(v)}</button>`).join('');
  if (f.step === 0) {
    const L = f.look;
    b.innerHTML = `<p class="q">どんな人でしたか？</p><p class="qsub">見たままでかまいません。本名はいりません。</p>
      <div class="preview"><div class="pt" id="pv">${portrait(L, 104)}</div></div>
      <div class="field"><label>あだ名</label><input class="tinput" id="fName" maxlength="28" placeholder="例：駅のホームで文庫本を読んでいた人" value="${esc(f.name)}" autocomplete="off"></div>
      <div class="field"><label>島での呼び名（なくても大丈夫）</label><input class="tinput" id="fShort" maxlength="7" placeholder="例：手帳の人" value="${esc(f.short)}" autocomplete="off"><p class="note">島で頭の下に出る、短い名前です。</p></div>
      <div class="field"><label>見かけた場所</label><div class="opts">${opts(PLACES, [f.place], 'place')}</div></div>
      <div class="field"><label>服の色</label><div class="sw">${LOOK.clothes.map(c => `<button data-look="clothes" data-v="${c}" class="${L.clothes === c ? 'on' : ''}" style="background:${c}" aria-label="服の色"></button>`).join('')}</div></div>
      <div class="field"><label>髪</label><div class="opts">${LOOK.styles.map(([k, n]) => `<button class="opt ${L.style === k ? 'on' : ''}" data-look="style" data-v="${k}">${n}</button>`).join('')}</div>
        <div class="sw" style="margin-top:12px">${LOOK.hair.map(c => `<button data-look="hair" data-v="${c}" class="${L.hair === c ? 'on' : ''}" style="background:${c}" aria-label="髪の色"></button>`).join('')}</div></div>
      <div class="field"><label>肌</label><div class="sw">${LOOK.skin.map(c => `<button data-look="skin" data-v="${c}" class="${L.skin === c ? 'on' : ''}" style="background:${c}" aria-label="肌の色"></button>`).join('')}</div></div>
      <div class="field"><label>背格好</label><div class="opts">${LOOK.sizes.map(([k, n]) => `<button class="opt ${L.size === k ? 'on' : ''}" data-look="size" data-v="${k}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>身につけていたもの</label><div class="opts"><button class="opt ${L.glasses ? 'on' : ''}" data-look="glasses" data-v="1">メガネ</button></div></div>`;
    $('#fName').addEventListener('input', e => { f.name = e.target.value; e.target.classList.remove('err'); });
    $('#fShort').addEventListener('input', e => { f.short = e.target.value; });
  }
  if (f.step === 1) {
    b.innerHTML = `<p class="q">その人は、何をしていましたか？</p><p class="qsub">見たことを選んでください。いくつでも。<br>選んだことが、その人の性格のもとになります。</p>
      <div class="opts">${opts(SEEN.map(s => s[0]), f.seen, 'seen')}</div>`;
  }
  if (f.step === 2) {
    b.innerHTML = `<p class="q">きっと、こんな人。</p><p class="qsub">ここからはあなたの想像です。当たっているかは誰にもわかりません。</p>
      <div class="opts">${opts(GUESS.map(s => s[0]), f.guess, 'guess', 'guessopt')}</div>
      <div class="field" style="margin-top:22px"><label>ひとことメモ</label><textarea class="tinput" id="fMemo" maxlength="140" placeholder="例：電話の相手にだけ敬語じゃなかった。たぶん家族。">${esc(f.memo)}</textarea></div>`;
    $('#fMemo').addEventListener('input', e => f.memo = e.target.value);
  }
  if (f.step === 3) {
    if (!f.touched) f.traits = traitsFrom(f.seen, f.guess);
    b.innerHTML = `<p class="q">この人らしさ</p><p class="qsub">あなたの観察から読み取った性格です。違うと思ったら、動かしてください。</p>
      <div class="readout">${portrait(f.look, 64)}<p id="fPersona">${esc(personaText(f.traits))}<small id="fRole">島での役まわり：${esc(roleOf(f.traits))}</small></p></div>
      ${TK.map(k => `<div class="slider"><div class="top"><b>${TRAITS[k].name}</b><span id="sv-${k}">${valWord(k, f.traits[k])}</span></div>
        <input type="range" min="5" max="95" value="${Math.round(f.traits[k] * 100)}" data-trait="${k}" style="--v:${(f.traits[k] * 100 - 5) / .9}%">
        <div class="ends"><span>${TRAITS[k].lo}</span><span>${TRAITS[k].hi}</span></div></div>`).join('')}
      <p class="note">島での動き方は、この5つの数字だけで決まります。たとえば話し好きな人は、用がなくても誰かに話しかけに行きます。</p>`;
  }
  b.scrollTop = 0;
}
function valWord(k, v) { return v > .72 ? `かなり${TRAITS[k].hi}` : v > .56 ? `やや${TRAITS[k].hi}` : v < .28 ? `かなり${TRAITS[k].lo}` : v < .44 ? `やや${TRAITS[k].lo}` : 'ふつう'; }
$('#formBody').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || !F) return;
  const f = F, d = t.dataset;
  if (d.place) { f.place = f.place === d.place ? '' : d.place; renderFormKeep(); }
  if (d.look) { if (d.look === 'glasses') f.look.glasses = !f.look.glasses; else f.look[d.look] = d.v; renderFormKeep(); }
  if (d.seen) { toggle(f.seen, d.seen); t.classList.toggle('on'); f.touched = false; }
  if (d.guess) { toggle(f.guess, d.guess); t.classList.toggle('on'); f.touched = false; }
});
function renderFormKeep() { const y = $('#formBody').scrollTop; renderForm(); $('#formBody').scrollTop = y; }
const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };
$('#formBody').addEventListener('input', e => {
  const k = e.target.dataset.trait; if (!k) return;
  F.traits[k] = +e.target.value / 100; F.touched = true;
  e.target.style.setProperty('--v', `${(+e.target.value - 5) / .9}%`);
  $(`#sv-${k}`).textContent = valWord(k, F.traits[k]);
  $('#fPersona').firstChild.textContent = personaText(F.traits);
  $('#fRole').textContent = `島での役まわり：${roleOf(F.traits)}`;
});
$('#formClose').onclick = closeForm;
$('#formBack').onclick = () => { if (!F.step) return closeForm(); F.step--; renderForm(); };
$('#formNext').onclick = () => {
  const f = F;
  if (f.step === 0 && !f.name.trim()) { const i = $('#fName'); i.classList.add('err'); i.focus(); toast('あだ名を入れてください'); return; }
  if (f.step < 3) { f.step++; renderForm(); return; }
  f.name = f.name.trim();
  if (f.editId) {
    const p = byId(f.editId); updatePersonFrom(p, f); rebuildPerson(p); rebuildStructuresOf(p);
    addLog(`${nm(p)}の観察記録が書き足された`, p.id);
    closeForm(); ui.select(p.id); toast('観察を書き足しました'); save(); return;
  }
  const p = createPerson(f);
  if (p.benched) { delete p.benched; closeForm(); save(); ui.setTab('zukan'); toast(`${S.name}は満員なので、待機として図鑑に入りました`); return; }
  closeForm(); ui.setTab('island');
  focusOn(p.x, p.z); controls.autoRotate = false; lastTouch = performance.now(); zoomTo = fitZoom();
  fx.spawn(p);
  setTimeout(() => stampShow(`No.${String(p.no).padStart(3, '0')}`, shortName(p), '観察'), 1850);
  save();
};

// ---------- 見本の3人 ----------
const SAMPLES = [
  { name: '朝のカフェで手帳を広げていた人', short: '手帳の人', place: 'カフェ', look: { clothes: '#3E5C8A', hair: '#2A2523', skin: '#E6BC98', style: 'short', size: 'm', glasses: true }, seen: ['身なりがきっちりしていた', '何かを書いたり作ったりしていた', 'しきりに時計を見ていた'], guess: ['計画を立てるのが好き', '早起きさん'], memo: 'コーヒーを2口で飲み切っていた。' },
  { name: '公園で鳩に話しかけていた人', short: '鳩の人', place: '公園', look: { clothes: '#E39B3B', hair: '#D9D6D0', skin: '#F2D5BC', style: 'cap', size: 's', glasses: false }, seen: ['よく笑っていた', '動物や植物に目を止めていた', 'ゆっくり動いていた', '本や画面に集中していた'], guess: ['休みの日は出かける', '頼まれると断れない'], memo: '鳩にも「おはよう」と言っていた。' },
  { name: '駅で道を聞かれていた背の高い人', short: '道案内の人', place: '駅・電車', look: { clothes: '#6F9E5B', hair: '#5A3E2B', skin: '#C99670', style: 'long', size: 'l', glasses: false }, seen: ['ずっと誰かと話していた', '荷物を持ってあげていた', '声が大きかった', 'イヤホンで自分の世界にいた'], guess: ['友だちが多い', '思いつきで動く'], memo: '' },
];
function addSamples() {
  SAMPLES.forEach((s, i) => setTimeout(() => {
    const p = createPerson({ ...s, traits: traitsFrom(s.seen, s.guess) });
    fx.spawn(p); if (i === 0) { focusOn(0, 0); controls.autoRotate = false; lastTouch = performance.now(); }
    if (i === 2) { zoomTo = fitZoom(); save(); toast('3人が島に降りてきました。タップすると、その人のことがわかります'); }
  }, i * 650));
  ui.updateWelcome(); $('#welcome').classList.add('off');
}

// ---------- イベント ----------
$('#tabbar').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) ui.setTab(t.dataset.tab); });
$('#addBtn').onclick = () => openForm();
$('#welcome').addEventListener('click', e => { const a = e.target.closest('[data-act]')?.dataset.act; if (a === 'add') openForm(); if (a === 'sample') { if (e.target.closest('[data-act]').dataset.mode === 'pick') { ui.zview = 'people'; ui.setTab('zukan'); toast('住まわせたい人のカードを押してください'); } else addSamples(); } });
document.addEventListener('click', e => {
  const zv = e.target.closest('[data-zv]'); if (zv) { ui.zview = zv.dataset.zv; ui.renderZukan(); $('#zukanBody').scrollTop = 0; return; }
  const hn = e.target.closest('[data-hint]'); if (hn) { const [n, h] = hn.dataset.hint.split('|'); toast(`まだ出会っていないタイプ。${h}を探してみてください`); return; }
  const cd = e.target.closest('[data-card]'); if (cd) { cardMenu(+cd.dataset.card); return; }
  const s = e.target.closest('[data-sel]'); if (s) { ui.select(+s.dataset.sel); return; }
  const a = e.target.closest('#sheet [data-act]')?.dataset.act; if (!a) return;
  const p = byId(ui.selected); if (!p) return;
  if (a === 'follow') { ui.follow = !ui.follow; ui.renderSheet(true); if (ui.follow) controls.autoRotate = false; }
  if (a === 'edit') openForm(p.id);
  if (a === 'farewell') confirmBox(`${esc(p.name)}を図鑑から消しますか？`, 'この人は島を旅立ち、図鑑からも消えます。元には戻せません。建てた家は空き家として残ります。', '消す', () => { ui.closeSheet(); removePerson(p); save(); toast('旅立っていきました'); });
  if (a === 'bench') { ui.closeSheet(); movePerson(p, S, null); save(); toast('待機にしました。図鑑からいつでも呼べます'); }
  if (a === 'move') {
    modal(`<h3>どの島へ引っ越す？</h3><div class="isls">${ROOT.islands.filter(i => i !== S).map(i => `<button class="isl" data-to="${i.id}" ${i.people.length >= MAX_RESIDENTS ? 'disabled' : ''}><div><b>${esc(i.name)}</b><small>${i.people.length >= MAX_RESIDENTS ? '満員' : `${i.people.length}人が暮らす`}</small></div></button>`).join('')}</div><div class="acts"><button class="btn" data-m="close">やめる</button></div>`);
    $$('[data-to]').forEach(b => b.onclick = () => { const to = ROOT.islands.find(i => i.id === +b.dataset.to); closeModal(); ui.closeSheet(); movePerson(p, S, to); save(); toast(`${p.short || shortName(p)}は${to.name}へ引っ越しました`); });
  }
});
$('#sheetGrab').onclick = () => ui.closeSheet();
const SPEEDS = [[0, '停止', '時間を止めました'], [1, '1×', 'ふつうの速さ（1日＝4分）'], [5, '5×', '5倍の速さ']];
function renderSpeed() { $('#speedBtn').innerHTML = SPEEDS[ui.speedIdx][1]; }
$('#speedBtn').onclick = () => { ui.speedIdx = (ui.speedIdx + 1) % 3; ROOT.speed = ui.speedIdx; renderSpeed(); toast(SPEEDS[ui.speedIdx][2]); };
$('.brand').onclick = () => islandMenu();
$('#clock').onclick = () => toast(`${S.day}日目の${timeName(S.time)}。木${S.stock.wood}・石${S.stock.stone}・食べ物${S.stock.food}`);

const _t1 = new THREE.Color(), _t2 = new THREE.Color(), DAYTOP = new THREE.Color('#DCE6EC'), NIGHTTOP = new THREE.Color('#151C28'), DAYBOT = new THREE.Color('#F1E8DB'), NIGHTBOT = new THREE.Color('#34405A');
function updateSky() {
  const n = nightness();
  _t1.copy(sky).lerp(_a.copy(DAYTOP).lerp(NIGHTTOP, n), .55); _t2.copy(sky).lerp(_b.copy(DAYBOT).lerp(NIGHTBOT, n), .45);
  document.body.style.background = `linear-gradient(180deg,#${_t1.getHexString()} 0%,#${sky.getHexString()} 52%,#${_t2.getHexString()} 100%)`;
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = '#' + _t1.getHexString();
  document.body.classList.toggle('night', n > .5);
}
function updateHud() {
  updateSky();
  $('#clockText').textContent = `${S.day}日目·${timeName(S.time)}`;
  $('#sunmoon').classList.toggle('night', nightness() > .5);
  const lv = LEVELS[S.level].name;
  $('#village').textContent = `${S.name} · ${lv} · ${S.people.length}人`;
  if (ui.selected) ui.renderSheet(false);
  if (ui.tab === 'diary' && ui.logDirty) ui.renderDiary();
}

function cardMenu(id) {
  const c = allCards().find(c => c.p.id === id); if (!c) return;
  if (c.island === S) return ui.select(id);
  const p = c.p, full = S.people.length >= MAX_RESIDENTS;
  modal(`<div class="who" style="margin-bottom:14px"><div class="pt">${face3d(p, 72)}</div><div style="min-width:0"><div class="no">観察 No.${String(p.no).padStart(3, '0')}</div><h3>${esc(p.name)}</h3>
    <p>${esc(roleOf(p.traits))} · いまは${c.island ? esc(c.island.name) + 'に住んでいる' : '待機中（どの島にもいない）'}</p></div></div>
    <p>${esc(personaText(p.traits))}</p>
    <div class="acts col">
      <button class="btn red" id="mvHere" ${full ? 'disabled' : ''}>${full ? `${esc(S.name)}は満員です（${MAX_RESIDENTS}人）` : c.island ? `${esc(S.name)}へ引っ越してもらう` : `${esc(S.name)}に住んでもらう`}</button>
      ${c.island ? `<button class="btn" id="mvBench">島から出して待機にする</button>` : ''}
      <button class="btn ghost" data-m="close">閉じる</button></div>`);
  const h = $('#mvHere'); if (h && !full) h.onclick = () => { closeModal(); movePerson(p, c.island, S); save(); ui.setTab('island'); focusOn(p.x, p.z); zoomTo = Math.max(camera.zoom, 1.8); };
  const b = $('#mvBench'); if (b) b.onclick = () => { closeModal(); movePerson(p, c.island, null); save(); ui.renderZukan(); toast('待機にしました。図鑑からいつでも呼べます'); };
}
function islandMenu() {
  const n = ROOT.islands.length;
  modal(`<h3>島をえらぶ</h3><p>島は${MAX_ISLANDS}つまで持てます。住人は図鑑から選んで住まわせられます（1人が住めるのは1つの島だけ）。</p>
    <div class="isls">${ROOT.islands.map(i => `<button class="isl ${i === S ? 'on' : ''}" data-isl="${i.id}"><div><b>${esc(i.name)}</b><small>${LEVELS[i.level].name} · ${i.people.length}人 · ${i.day}日目</small></div><span class="faces">${i.people.slice(0, 5).map(p => portrait(p.look, 26)).join('')}</span></button>`).join('')}
    ${n < MAX_ISLANDS ? `<button class="isl new" id="newIsl"><div><b>＋ 新しい島をつくる</b><small>あと${MAX_ISLANDS - n}つ持てます</small></div></button>` : ''}</div>
    <div class="acts"><button class="btn" id="renIsl">名前を変える</button>${n > 1 ? `<button class="btn" id="delIsl">この島をなくす</button>` : ''}<button class="btn primary" data-m="close">閉じる</button></div>`);
  $$('[data-isl]').forEach(b => b.onclick = () => { closeModal(); if (+b.dataset.isl !== S.id) switchIsland(+b.dataset.isl); });
  const nw = $('#newIsl'); if (nw) nw.onclick = () => { const w = newWorld(ISLAND_NAMES.find(x => !ROOT.islands.some(i => i.name === x)) || `島${n + 1}`); ROOT.islands.push(w); closeModal(); switchIsland(w.id, true); };
  $('#renIsl').onclick = () => {
    modal(`<h3>島の名前</h3><input class="tinput" id="islName" maxlength="12" value="${esc(S.name)}"><div class="acts"><button class="btn" data-m="close">やめる</button><button class="btn red" id="islOk">決める</button></div>`);
    $('#islOk').onclick = () => { const v = $('#islName').value.trim(); if (v) { S.name = v; save(); updateHud(); } closeModal(); };
  };
  const dl = $('#delIsl'); if (dl) dl.onclick = () => confirmBox(`${esc(S.name)}をなくしますか？`, `住人${S.people.length}人は待機になり、図鑑に残ります。建物と日記は消えます。名場面は残ります。`, 'なくす', () => {
    const gone = S; for (const p of gone.people.slice()) movePerson(p, gone, null);
    ROOT.islands = ROOT.islands.filter(i => i !== gone); switchIsland(ROOT.islands[0].id);
  });
}
function clearScene() {
  for (const k in objs) { for (const [, m] of objs[k]) scene.remove(m); objs[k].clear(); }
  for (const [, b] of bubs) b.e.remove(); bubs.clear();
  for (const [, e] of tags) e.remove(); tags.clear();
  fxList.length = 0; shotQueue = [];
}
function switchIsland(id, fresh) {
  save(); ui.closeSheet();
  const t = ROOT.islands.find(i => i.id === id); if (!t) return;
  clearScene(); S = t; ROOT.active = id; view.R = S.R; planT = 0;
  if (!S.trees.length) populate(0, walkR());
  const away = fresh ? [] : catchUp((Date.now() - S.lastSeen) / 1000);
  buildIsland(); fitShadow();
  camera.position.sub(controls.target); controls.target.set(0, 0, 0); camTarget = null;
  camera.zoom = fitZoom(); camera.updateProjectionMatrix();
  ui.logDirty = true; updateHud(); ui.updateWelcome(); save();
  if (ui.tab !== 'island') ui.setTab('island');
  toast(fresh ? `${S.name}ができました。図鑑から住人を選んでください` : `${S.name}に来ました`);
  if (away.length) setTimeout(() => showAway(away), 700);
}
function showAway(entries) {
  if (!entries.length) return;
  const list = entries.filter(e => e.k !== 'born').slice(-8);
  if (!list.length) return;
  modal(`<h3>留守のあいだに</h3><p>あなたが見ていないあいだも、島の時間は進んでいました。</p><div class="away"><ul>${list.map(e => `<li>${esc(fmt(e.text))}</li>`).join('')}</ul></div><div class="acts"><button class="btn primary" data-m="close">島を見る</button></div>`);
}

// ---------- ループ ----------
let last = performance.now(), hudT = 0, saveT = 0;
function frame(now) {
  const rdt = Math.min(.05, (now - last) / 1000); last = now;
  const mul = SPEEDS[ui.speedIdx][0];
  if (mul) { let g = rdt * mul; while (g > 0) { const s = Math.min(g, .25); simStep(s); g -= s; } }
  // 島が広がる
  if (Math.abs(view.R - S.R) > .005) {
    view.R += (S.R - view.R) * Math.min(1, rdt * 1.6); if (Math.abs(view.R - S.R) < .01) view.R = S.R;
    buildIsland(); fitShadow();
  } else if (S.pending) { populate(S.pending.r0, S.pending.r1); S.pending = null; }
  syncScene(rdt, now); lights();
  // カメラ
  const sel = ui.follow && byId(ui.selected);
  if (sel) focusOn(sel.x, sel.z);
  if (camTarget) {
    const d = camTarget.clone().sub(controls.target).multiplyScalar(Math.min(1, rdt * 3));
    controls.target.add(d); camera.position.add(d);
    if (!sel && d.length() < .002) camTarget = null;
  }
  const lim = view.R * .7, tr = Math.hypot(controls.target.x, controls.target.z);
  if (tr > lim) { const k = lim / tr, dx = controls.target.x * (k - 1), dz = controls.target.z * (k - 1); controls.target.x += dx; controls.target.z += dz; camera.position.x += dx; camera.position.z += dz; }
  if (!controls.autoRotate && !ui.follow && !ui.selected && now - lastTouch > 25000) controls.autoRotate = true;
  // 人物シートが開いているときは島を上へずらす（選んだ人がシートに隠れないように）
  const wantOff = ui.selected ? innerHeight * .26 : 0;
  if (Math.abs(viewOff - wantOff) > .5) { viewOff += (wantOff - viewOff) * Math.min(1, rdt * 5); camera.setViewOffset(innerWidth, innerHeight, 0, viewOff, innerWidth, innerHeight); }
  if (zoomTo) { camera.zoom += (zoomTo - camera.zoom) * Math.min(1, rdt * 3); camera.updateProjectionMatrix(); if (Math.abs(zoomTo - camera.zoom) < .01) zoomTo = null; }
  controls.update();
  renderer.render(scene, camera);
  if (shotQueue.length) { const sq = shotQueue[0]; sq.t -= rdt; if (sq.t <= 0) { shotQueue.shift(); captureScene(sq.key, sq.x, sq.z); } }
  bubblesTick(rdt);
  if ((hudT -= rdt) <= 0) { hudT = .4; updateHud(); }
  if ((saveT -= rdt) <= 0) { saveT = 6; save(); }
  requestAnimationFrame(frame);
}

// ---------- 吹き出し ----------
const bubs = new Map(), _v = new THREE.Vector3();
function bubble(p, emoji) {
  if (quiet) return;
  let b = bubs.get(p.id);
  if (!b) { const e = document.createElement('div'); e.className = 'bub'; $('#bubbles').appendChild(e); b = { e, life: 0 }; bubs.set(p.id, b); }
  b.e.textContent = emoji; b.life = 2.2; b.e.style.display = ''; b.e.classList.toggle('big', p.seen.includes('声が大きかった'));
  b.e.classList.remove('pop'); void b.e.offsetWidth; b.e.classList.add('pop');
}
const tags = new Map();
function tagsTick() {
  const op = smooth(1.2, 1.6, camera.zoom), placed = [];
  for (const p of S.people) {
    let e = tags.get(p.id);
    if (!e) { e = document.createElement('div'); e.className = 'tag'; $('#bubbles').appendChild(e); tags.set(p.id, e); }
    const m = objs.people.get(p.id);
    if (!m || p.inside || op < .02 || fxList.some(f => f.pid === p.id)) { e.style.display = 'none'; continue; }
    if (e.style.display === 'none') e.style.display = '';
    const t = shortName(p); if (e.textContent !== t) { e.textContent = t; e._w = 0; }
    e.classList.toggle('sel', ui.selected === p.id);
    _v.set(p.x, groundH(p.x, p.z), p.z).project(camera);
    if (!e._w) e._w = e.offsetWidth || 60;
    placed.push({ e, x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight + 6, w: e._w, o: ui.selected && ui.selected !== p.id ? op * .35 : op });
  }
  // 縦の位置順に並べ、重なる名札は下へ押し出す。画面の端からははみ出させない
  placed.sort((a, b) => a.y - b.y);
  for (let i = 0; i < placed.length; i++) {
    const A = placed[i];
    A.x = clamp(A.x, A.w / 2 + 6, innerWidth - A.w / 2 - 6);
    for (let j = 0; j < i; j++) { const B = placed[j]; if (Math.abs(A.x - B.x) < (A.w + B.w) / 2 + 4 && Math.abs(A.y - B.y) < 20) A.y = B.y + 20; }
    A.e.style.transform = `translate(${(A.x - A.w / 2).toFixed(1)}px,${A.y.toFixed(1)}px)`;
    A.e.style.opacity = A.o;
  }
  for (const [id, e] of tags) if (!byId(id)) { e.remove(); tags.delete(id); }
}
function bubblesTick(dt) {
  tagsTick();
  for (const [id, b] of bubs) {
    const p = byId(id), m = objs.people.get(id);
    b.life -= dt;
    if (!p || !m || b.life <= 0 || p.inside) { b.e.style.display = 'none'; if (!p) { b.e.remove(); bubs.delete(id); } continue; }
    _v.set(p.x, groundH(p.x, p.z) + .95 * m.scale.x, p.z).project(camera);
    const x = (_v.x + 1) / 2 * innerWidth, y = (1 - _v.y) / 2 * innerHeight;
    b.e.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    b.e.style.opacity = Math.min(1, b.life * 2);
  }
}

// ---------- 起動 ----------
if (!S.trees.length) populate(0, walkR());
resize(); buildIsland(); lights();
ui.speedIdx = ROOT.speed ?? 1; renderSpeed();
const away = catchUp((Date.now() - S.lastSeen) / 1000);
updateHud(); ui.updateWelcome();
requestAnimationFrame(t => { last = t; frame(t); });
setTimeout(() => showAway(away), 600);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (!resetting) save(); }
  else { const e = catchUp((Date.now() - S.lastSeen) / 1000); last = performance.now(); if ((Date.now() - S.lastSeen) / 1000 > 90) showAway(e); }
});
addEventListener('pagehide', () => { if (!resetting) save(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

// 動作確認用
if (/[?&]debug\b/.test(location.search)) window.__hkc = { get S() { return S; }, simStep, addSamples, openForm, ui, camera, controls };
