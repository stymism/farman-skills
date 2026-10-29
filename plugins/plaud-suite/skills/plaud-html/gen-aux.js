#!/usr/bin/env node
/* ============================================================
   gen-aux.js — 議事録サイトの「一覧（index）と横断ページ」を全部作る（2026-10-29 作り直し・U2/U3）
   会議ページ（2026-MM-DD_*.html）を読むだけ。会議ページは書き換えない。
   読み方は 旧の作り（.decision-box・.action-item label・<meta name="entities">・h1・日付）と
   新しい作り（先頭の結論カード・宿題行 id="todo-<n>"・data-asana・data-done）の両方で動く。

   出力（work_dir の中）:
     index.html              4 つのタブ（今週・宿題・取引先・一覧）。一覧カードは要約 60 字＋「決定 n・宿題 n」
     style.css               index と横断ページの共通 CSS（システムフォント・字は 12px 以上・飾り無し）
     search-index.json       全文検索用。index は検索欄を使ったときだけ読む
     data/decisions.json     決定の全部（会議ごと）
     data/partners.json      取引先ごとの年表の元（社名は正表記にそろえる）
     data/entities.json      人・会社・言葉 → 会議 の索引（entity-index.html が検索のときだけ読む）
     data/todos.json         宿題（人ごと）。**Asana 担当が作った物（source:"asana"）があれば書かない**
     data/keywords.json      旧 index カードの data-text（検索用の語）を 1 回だけ移した物（以後はこれを読む）
     partners/<slug>.html    1 社 1 ページの年表（日付→会議→決定・宿題・次回）
     decisions.html          決定の一覧（軽い描画ページ。中身は data/decisions.json）
     entity-index.html       取引先と言葉の索引（軽い描画ページ。中身は data/entities.json）

   表記ゆれの辞書: plaud_規則.json の aliases（無ければ下の仮の表）。場所は
     環境変数 PLAUD_RULES → plaud-config.json の paths.rules_file → ~/OneDrive/右腕AI/00_Resources/plaud_規則.json
   使い方: node gen-aux.js [workDir]
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/* ---- 作業ディレクトリと設定 ---- */
function readCfg() {
  try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.plaud', 'plaud-config.json'), 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) { return {}; }
}
const CFG = readCfg();
const WORK = process.argv[2] || ((CFG.paths && CFG.paths.work_dir) || '').replace(/^~/, os.homedir()) || process.cwd();
const DATA = path.join(WORK, 'data');
const PDIR = path.join(WORK, 'partners');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(PDIR, { recursive: true });

/* ---- 社員（宿題のタブの順。社員名は取引先に入れない） ---- */
let STAFF = ['井上', '瀬戸山', '井出', '田中', '関根', '豊田', '青柳', '跡部'];
const STAFF_TABS = ['井上', '瀬戸山', '井出', '田中', '関根', '豊田', '青柳'];

/* ---- 表記ゆれ（仮の表・261029_plaud-html改善案_v0.2 §2）。plaud_規則.json があればそちらを足す（そちらが勝つ） ---- */
const ALIAS = new Map(Object.entries({
  '北斗市': '北杜市', '北斗': '北杜', '坂の途中': '坂ノ途中', '千歳研究所': 'ちとせ研究所', '千歳': 'ちとせ研究所', 'ちとせ': 'ちとせ研究所',
  '水納': '粋農', '脳中': '農林中金', 'アルソワ': 'アルソア', '井手': '井出', '畑山農場': '鳩山農場', '市山マート': 'いちやまマート',
  'デンバ': 'DENBA', 'トップコン': 'トプコン', 'TOPCON': 'トプコン', 'Topcon': 'トプコン', 'ファーマブル': 'Farmable', 'farmable': 'Farmable',
  'INE': 'i-ne', 'I-ne': 'i-ne', 'グレースロード': 'グレイスロード', 'カオシェ': 'カウシェ', 'ソラタン': '宙炭', 'ジョン・ディア': 'ジョンディア',
  'ホワイトロッペン': 'ホワイト六片', 'ロッペン': 'ホワイト六片', 'リゾトラ': 'リゾートトラスト', 'NORAS': 'ノラーズ', 'ノラーズパートナー': 'ノラーズ',
  '山梨県立大': '山梨県立大学', '住商': '住友商事', 'リロ': 'リロクラブ', '長瀬': '長瀬産業', '長瀬ビータ': '長瀬産業', '長瀬ケムテックス': '長瀬産業',
  'アイカフェファーム': 'アイカフェ', 'マイナビ': 'マイナビ農業', 'CHCナビ': 'CHC', 'フィランソロピー': 'フィランソロピー協会', 'ヤマト': 'ヤマト運輸',
  '東京会館': '東京會舘', 'パル': 'パルシステム', '梨北': '梨北ソリューション', 'ニッケンリース': '日建リース', 'アメニス': '日比谷アメニス',
  '八ヶ岳農業実践大学校': '農業実践大学校', 'トーイング': 'TOWING', '農水省': '農林水産省', '目黒区教育委員会': '目黒区',
}));

/* ---- 取引先（正表記・URL の名前・題名だけで見る別名）。plaud_規則.json の partners があれば足す ---- */
let PARTNERS = [
  ['坂ノ途中', 'sakanotochu'], ['粋農', 'suino'], ['Farmable', 'farmable'], ['i-ne', 'i-ne'], ['ちとせ研究所', 'chitose-kenkyusho'],
  ['三菱地所', 'mitsubishi-jisho'], ['東京會舘', 'tokyo-kaikan'], ['健康家族', 'kenko-kazoku'], ['パルシステム', 'palsystem'], ['双日', 'sojitz'],
  ['リロクラブ', 'relo-club'], ['長瀬産業', 'nagase-sangyo'], ['イズミフーズ', 'izumi-foods'], ['ボンディッシュ', 'bondish'], ['いちやまマート', 'ichiyama-mart'],
  ['グレイスロード', 'grace-road'], ['DENBA', 'denba'], ['県信連', 'kenshinren'], ['天女山', 'tennyosan'], ['宙炭', 'soratan'],
  ['リゾートトラスト', 'resorttrust'], ['ゴールドウィン', 'goldwin'], ['アムウェイ', 'amway'], ['大志', 'taishi'], ['フィランソロピー協会', 'philanthropy'],
  ['アルソア', 'arsoa'], ['EFポリマー', 'ef-polymer'], ['ワールドデリカ', 'world-delica'], ['マイナビ農業', 'mynavi-nogyo'], ['JTB', 'jtb'],
  ['有吉ゼミ', 'ariyoshi-zemi'], ['たんぺい', 'tanpei'], ['鈴木税理士', 'suzuki-zeirishi'], ['梨北ソリューション', 'rihoku-solution'], ['末木農場', 'sueki-nojo', ['末木']],
  ['ユニバ', 'uniba'], ['FARMO', 'farmo'], ['レザーズインク', 'leathers-ink'], ['バブリゾート', 'bab-resort'], ['目黒区', 'meguro-ku'],
  ['ティップネス', 'tipness'], ['フードバレー', 'food-valley'], ['農林中金', 'norinchukin'], ['ノーサイ', 'nosai'], ['山守り隊', 'yamamoritai'],
  ['アイカフェ', 'icafe'], ['こゆ財団', 'koyu-zaidan'], ['ヒューリック', 'hulic'], ['VISON', 'vison'], ['日比谷アメニス', 'hibiya-amenis'],
  ['サラダコスモ', 'salad-cosmo'], ['イオン', 'aeon'], ['ヤマト運輸', 'yamato'], ['トプコン', 'topcon'], ['CHC', 'chc'],
  ['ヤンマー', 'yanmar'], ['ジョンディア', 'john-deere'], ['カウシェ', 'kauche'], ['大和ハウス', 'daiwa-house'], ['関東農政局', 'kanto-noseikyoku'],
  ['山梨県立大学', 'yamanashi-kenritsu-daigaku'], ['農業実践大学校', 'nogyo-jissen-daigakko'], ['ノラーズ', 'noras'], ['アグリマインド', 'agrimind'], ['日建リース', 'nikken-lease'],
  ['住友商事', 'sumitomo-shoji'], ['田中青果', 'tanaka-seika'], ['TOWING', 'towing'], ['農林水産省', 'maff'], ['ベーテル', 'bethel'],
  ['北杜市', 'hokuto-shi'],
].map(([name, slug, titleOnly]) => ({ name, slug, titleOnly: titleOnly || [] }));

/* ---- plaud_規則.json を読む（形はいくつか受け付ける） ---- */
function rulesPath() {
  const c = [process.env.PLAUD_RULES, CFG.paths && CFG.paths.rules_file && CFG.paths.rules_file.replace(/^~/, os.homedir()),
    path.join(os.homedir(), 'OneDrive', '右腕AI', '00_Resources', 'plaud_規則.json')].filter(Boolean);
  return c.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || null;
}
const RULES_FILE = rulesPath();
let rulesNote = '仮の表（gen-aux.js の中）';
if (RULES_FILE) {
  try {
    const R = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8').replace(/^\uFEFF/, ''));
    let n = 0;
    const add = (from, to) => { if (from && to && from !== to) { ALIAS.set(String(from).trim(), String(to).trim()); n++; } };
    // aliases: {list:[{正, ゆれ:[…]}]}（10-29 の形）／[{正, 誤|ゆれ}]／{誤: 正}／{正: [誤…]} のどれでもよい
    const fromList = (L) => { for (const a of L) {
      if (!a || typeof a !== 'object') continue;
      const to = a['正'] || a.to || a.canonical || a.right || a.correct;
      const fr = a['ゆれ'] || a['誤'] || a.from || a.alias || a.wrong || a.variants || a.aliases;
      (Array.isArray(fr) ? fr : String(fr || '').split(/[／/]/)).forEach(f => add(f, to));
    } };
    const A = R.aliases;
    if (Array.isArray(A)) fromList(A);
    else if (A && typeof A === 'object') for (const [k, v] of Object.entries(A)) {
      if (k === 'list' && Array.isArray(v)) fromList(v);
      else if (k === '説明' || k === 'メモ') continue;
      else if (Array.isArray(v)) v.forEach(f => add(f, k));             // 正 → [誤…]
      else if (typeof v === 'string') add(k, v);                        // 誤 → 正
      else if (v && typeof v === 'object') add(k, v['正'] || v.to || v.canonical);
    }
    // typos の「誤字」も正表記に寄せる（会社名・人名の語がそのまま一致した時だけ使う）
    const T = R.typos && (Array.isArray(R.typos) ? R.typos : R.typos.list);
    if (Array.isArray(T)) for (const t of T) if (t && t['誤'] && t['正'] && t['種類'] === '誤字' && !/[()（）]/.test(t['正'])) add(t['誤'], t['正']);
    const P = R.partners;
    if (Array.isArray(P)) for (const p of P) {
      const name = typeof p === 'string' ? p : (p.name || p['正'] || p.canonical);
      if (!name) continue;
      const slug = (p && p.slug) || null;
      const ex = PARTNERS.find(x => x.name === name);
      if (ex) { if (slug) ex.slug = slug; }
      else if (slug) PARTNERS.push({ name, slug, titleOnly: [] });
      ((p && (p.aliases || p['別名'])) || []).forEach(a => add(a, name));
    }
    let ppl = R.people || R.staff || R['社員'];
    if (ppl && !Array.isArray(ppl)) ppl = ppl['社員'] || ppl.list || ppl.staff;
    if (Array.isArray(ppl)) {
      const names = [];
      for (const x of ppl) {
        const nm = typeof x === 'string' ? x : (x && (x['表記'] || x.name || x['名前']));
        if (!nm) continue; names.push(String(nm).replace(/\s.*$/, ''));
        ((x && x['ゆれ']) || []).filter(y => !/推測|要確認/.test(y)).forEach(y => add(String(y).replace(/[（(].*$/, ''), nm));
      }
      if (names.length) STAFF = Array.from(new Set(STAFF.concat(names)));
    }
    rulesNote = `${RULES_FILE}（aliases ${n} 件を足した）`;
  } catch (e) { rulesNote = `${RULES_FILE} を読めなかった（${e.message}）→ 仮の表`; }
}
const canon = (s) => { s = String(s || '').trim(); for (let i = 0; i < 4 && ALIAS.has(s) && ALIAS.get(s) !== s; i++) s = ALIAS.get(s); return s; };
// 取引先の正表記も辞書に合わせる（例: plaud_規則.json が「ノラーズ（NORAS）」を正にしたら、表の「ノラーズ」をそれに）
for (const p of PARTNERS) p.name = canon(p.name);
{ const seen = new Set(); PARTNERS = PARTNERS.filter(p => !seen.has(p.name) && seen.add(p.name)); }
// 取引先ごとの全部の呼び名（正表記＋辞書で正表記に寄る語＋題名だけの別名）
for (const p of PARTNERS) p.names = Array.from(new Set([p.name].concat([...ALIAS.keys()].filter(k => canon(k) === p.name), p.titleOnly)));

/* ---- ユーティリティ ---- */
const AUX = new Set(['index.html', 'kowa-knowledge.html', 'entity-index.html', 'decisions.html', 'network.html']);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonEmbed = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
function stripTags(html) {
  return decode(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<button[\s\S]*?<\/button>/gi, ' ')
    .replace(/<\/?(?:span|strong|b|em|a|mark|i|small|sup|sub|code|u|abbr)(?=[\s>\/])[^>]*>/gi, '')   // 文の中の飾りタグは空白にしない
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
const meta = (html, name) => { const m = html.match(new RegExp('<meta\\s+name="' + name + '"\\s+content="([^"]*)"', 'i')); return m ? decode(m[1]) : ''; };
const listVal = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"', 'i')); return m ? decode(m[1]) : null; };
const ttl = (r) => /^\d\d-\d\d/.test(r.title) ? r.title : `${md(r.date)} ${r.title}`;
const md = (d) => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '';
const norm = (s) => String(s).replace(/\s+/g, '').replace(/^[・\-－—\s]+/, '');
function cut(s, n) { s = String(s || '').trim(); if (s.length <= n) return s; const i = s.lastIndexOf('。', n); return i >= n * 0.6 ? s.slice(0, i + 1) : s.slice(0, n - 1) + '…'; }
// 10-29 夜: 誤字（plaud_規則.json の typos で gate=true・正が 1 つに決まっている物）を、書き出す物すべてに当てる
//   （data/keywords.json・kowa-knowledge.html の言葉タグに「北斗市」が残っていた。会議ページは書き換えない＝audit.js の TYPO が止める）
const TYPO_FIX = (() => {
  if (!RULES_FILE) return [];
  try {
    const Rj = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8').replace(/^﻿/, ''));
    const L = (Rj.typos && (Array.isArray(Rj.typos) ? Rj.typos : Rj.typos.list)) || [];
    const escR = (s) => s.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
    return L.filter(x => x && x.gate === true && x['誤'] && x['正'] && !/[？?（(]/.test(x['正'])).map(x => ({ re: new RegExp(x.pattern || escR(x['誤']), 'g'), to: x['正'] }));
  } catch (e) { return []; }
})();
const fixTypos = (s) => TYPO_FIX.reduce((a, x) => a.replace(x.re, x.to), String(s));
// 取引先の年表（partners/・data/partners.json）は「ほかの書き方」に誤字の形（千歳研究所・市山マートなど）をわざと載せて検索に使うので当てない
function write(rel, content) { if (!/^(?:partners[\\/]|data[\\/]partners\.json$)/.test(rel)) content = fixTypos(content); const p = path.join(WORK, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content, 'utf8'); return Buffer.byteLength(content); }

/* 要素の中身を取り出す（入れ子の同じタグを数えて閉じを探す） */
function blocksByClass(html, cls) {
  const out = []; const re = new RegExp('<(div|li|section|article|p|aside)\\b[^>]*\\bclass="(?:[^"]*\\s)?' + cls + '(?:\\s[^"]*)?"[^>]*>', 'gi'); let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase(); let depth = 1; const tre = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi'); tre.lastIndex = re.lastIndex; let t;
    while (depth && (t = tre.exec(html))) depth += t[1] ? -1 : 1;
    const end = t ? t.index : html.length;
    out.push({ open: m[0], inner: html.slice(re.lastIndex, end), index: m.index });
  }
  return out;
}

/* ---- 期限の読み取り（9/18・9月18日・2026-09-18）。年は会議の年、会議より 2 か月以上前なら翌年 ---- */
function parseDue(s, mtgDate) {
  s = String(s || '').trim(); let y = +mtgDate.slice(0, 4), mo, d, m;
  if ((m = s.match(/(20\d\d)[-/.年](\d{1,2})[-/.月](\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[/／](\d{1,2})/)) || (m = s.match(/^(\d{1,2})月(\d{1,2})日/))) { mo = +m[1]; d = +m[2]; }
  else return null;
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  let iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (!m[0].match(/20\d\d/) && (new Date(mtgDate) - new Date(iso)) / 864e5 > 60) iso = `${y + 1}` + iso.slice(4);
  return iso;
}
const NAME_RE = new RegExp('^(' + STAFF.join('|') + ')$');
function parseNames(seg) {
  const toks = String(seg || '').split(/[、,，・\/／&＆\s]+/).map(t => canon(t.replace(/(さん|くん|君|氏|様)$/, '').replace(/^@/, ''))).filter(Boolean);
  if (!toks.length || toks.some(t => t.length > 6)) return null;
  const staff = toks.filter(t => STAFF.includes(t));
  return staff.length ? Array.from(new Set(staff)) : null;
}
function parseTodo(raw, mtgDate) {
  let title = raw.replace(/\s+/g, ' ').trim(), assignees = [], due = null;
  const parts = title.split(/[：:]/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    const d = parseDue(last, mtgDate), dash = /^[-－ー―]?$/.test(last);
    if ((d || dash) && parts.length >= 3 && parseNames(parts[parts.length - 2])) {
      assignees = parseNames(parts[parts.length - 2]); due = d; title = parts.slice(0, -2).join('：').trim();
    } else if (parseNames(last)) { assignees = parseNames(last); title = parts.slice(0, -1).join('：').trim(); }
  }
  const S = STAFF.join('|');
  if (!assignees.length) {
    // 「担当: 井上」「@井上」・頭の「井上が／井上さんは／井上氏が」・終わりの「（井出・井上）」「（井出くん主導）」
    const m = title.match(new RegExp('(?:担当|@)[:：\\s]*(' + S + ')')) || title.match(new RegExp('^(' + S + ')(?:さん|くん|君|氏)?(?:が|は)'));
    if (m) assignees = [m[1]];
    else { const p = title.match(/[（(]([^（）()]{1,30})[）)]\s*[。.]?$/); const n = p && parseNames(p[1].replace(/(主導|担当|中心|が実施|で実施|へ依頼確定)$/, '')); if (n) assignees = n; }
  }
  if (!due) {
    // 「期限: 2026-07-20」「7月31日までに」「（2026-06-08までに）」
    const D = '(20\\d\\d-\\d\\d-\\d\\d|\\d{1,2}\\/\\d{1,2}|\\d{1,2}月\\d{1,2}日)';
    const m = title.match(new RegExp('期限[:：]?\\s*' + D)) || title.match(new RegExp(D + '(?:[（(][^）)]{1,4}[）)])?(?:の[^、。]{0,6})?まで'));
    if (m) due = parseDue(m[1], mtgDate);
  }
  return { title, assignees, due };
}

/* ---- 1 本の会議ページを読む ---- */
const files = fs.readdirSync(WORK).filter(f => /^20\d\d-\d\d-\d\d_.*\.html$/.test(f) && !AUX.has(f)).sort().reverse();
const oldIndex = (() => { try { return fs.readFileSync(path.join(WORK, 'index.html'), 'utf8'); } catch (e) { return ''; } })();
// 旧 index の data-text（検索用の語）は data/keywords.json に 1 回だけ移す（以後はこちらが正）
let KEYWORDS = {};
try { KEYWORDS = JSON.parse(fs.readFileSync(path.join(DATA, 'keywords.json'), 'utf8')); } catch (e) {}
{
  const cre = /href="(20\d\d-[^"?]+\.html)"[^>]*data-text="([^"]*)"/gi; let cm, moved = 0;
  while ((cm = cre.exec(oldIndex))) if (!KEYWORDS[cm[1]]) { KEYWORDS[cm[1]] = decode(cm[2]).split(/\s+/).filter(s => s.length >= 2); moved++; }
  // 10-29 夜: リポに無いページ（外したページ）の語は消す。誤字も直して毎回書き直す（中身が同じなら同じ物）
  const have = new Set(fs.readdirSync(WORK).filter(f => /^20\d\d-\d\d-\d\d_.*\.html$/.test(f)));
  for (const k of Object.keys(KEYWORDS)) if (!have.has(k)) { delete KEYWORDS[k]; moved++; }
  write('data/keywords.json', JSON.stringify(KEYWORDS));
  KEYWORDS = JSON.parse(fixTypos(JSON.stringify(KEYWORDS)));
}
const oldType = {}; { const re = /href="(20\d\d-[^"?]+\.html)" class="mtg-card[^"]*" data-type="(\w+)"/g; let m; while ((m = re.exec(oldIndex))) oldType[m[1]] = m[2]; }

const warn = [];
const records = files.map((file) => {
  const html = fs.readFileSync(path.join(WORK, file), 'utf8');
  const date = file.slice(0, 10);
  const tm = html.match(/class="[^"]*\bbadge-header-(internal|external|kowa)\b/) || html.match(/<meta\s+name="(?:mtg-type|type)"\s+content="(internal|external|kowa)"/);
  const type = tm ? tm[1] : /-kowa\.html$/.test(file) ? 'kowa' : (oldType[file] || 'external');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 ? stripTags(h1[1]) : stripTags((html.match(/<title>([^<]*?)(?:\s—|<\/title>)/) || [, file])[1]);
  const dur = ((html.match(/録音[:：]\s*([^<]{1,24})</) || [])[1] || '').trim();

  // 本文（ヘッダーの後）
  const ci = html.search(/<(?:div|main|article|section)\b[^>]*(?:id="detailContent"|class="detail-content)/);
  const body = ci >= 0 ? html.slice(ci) : html;

  // 要約: meta description → 本文の最初の段落（20 字以上）
  let summary = meta(html, 'description');
  if (!summary) { const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi; let m; while ((m = re.exec(body))) { const t = stripTags(m[1]); if (t.length >= 20) { summary = t; break; } } }

  // 見出し（決定の「どの話か」）
  const heads = []; { const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi; let m; while ((m = re.exec(body))) heads.push({ i: m.index, t: stripTags(m[1]).replace(/^\d+\s*/, '') }); }
  const ctxAt = (i) => { let c = ''; for (const h of heads) { if (h.i < i) c = h.t; else break; } return c; };

  // 決定: .decision-box（旧・新とも）。無ければ結論カードの「決まったこと」の li。同じ文は 1 つに
  const decisions = []; const seenD = new Set();
  const pushD = (txt, ctx) => { txt = txt.replace(/^(結論|決定|決まったこと)[:：]\s*/, '').trim(); const k = norm(txt); if (!txt || seenD.has(k)) return; seenD.add(k); decisions.push({ ctx, txt }); };
  for (const b of blocksByClass(body, 'decision-box')) pushD(stripTags(b.inner), ctxAt(b.index));
  if (!decisions.length) {
    const m = body.match(/決まったこと[\s\S]*?<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/);
    if (m) { const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi; let x; while ((x = re.exec(m[2]))) pushD(stripTags(x[1]), '結論カード'); }
  }

  // 宿題: .action-item（旧）＋ id="todo-<n>" の行（新）。同じ文は 1 つに
  const todos = []; const seenT = new Set();
  const pushT = (open, inner) => {
    const lab = (inner.match(/<label\b[^>]*>([\s\S]*?)<\/label>/i) || [, inner])[1].replace(/<a\b[^>]*app\.asana\.com[^>]*>[\s\S]*?<\/a>/gi, '');
    const raw = stripTags(lab); const k = norm(raw); if (!raw || seenT.has(k)) return; seenT.add(k);
    const p = parseTodo(raw, date);
    const id = attr(open, 'id'); const anchor = id && /^todo-/.test(id) ? id : ((inner.match(/\sid="(todo-\d+)"/) || [])[1] || null);
    const gid = attr(open, 'data-asana') || (inner.match(/data-asana="(\d+)"/) || [])[1] || null;
    const au = (inner.match(/href="(https:\/\/app\.asana\.com\/[^"]+)"/) || [])[1] || (gid ? null : null);
    const done = attr(open, 'data-done') === '1' || /\bdone\b/.test(attr(open, 'class') || '') || /<input[^>]*\bchecked\b/.test(inner);
    todos.push({ title: p.title, assignees: p.assignees, due: p.due, done, gid, asana_url: au ? decode(au) : null, anchor });
  };
  // 10-29: 新しい作りは同じ宿題が 2 か所にある（先頭の結論カードの行 id="todo-n" data-todo="n" と、下の一覧の .action-item data-todo="n"）。
  //   番号 n が同じ物は 1 件にまとめ、行の id（宿題タブのリンク先 #todo-n）と Asana の印（data-asana・data-done）を下の一覧の宿題に移す
  const byN = new Map();
  for (const b of blocksByClass(body, 'action-item')) { const k = todos.length; pushT(b.open, b.inner); const n = attr(b.open, 'data-todo'); if (n && todos.length > k) byN.set(n, todos[k]); }
  { const re = /<(li|div|tr)\b([^>]*\sid="todo-\d+"[^>]*)>([\s\S]*?)<\/\1>/gi; let m; while ((m = re.exec(body))) {
      if (/action-item/.test(m[2])) continue;
      const open = '<x' + m[2] + '>'; const n = attr(open, 'data-todo') || (attr(open, 'id') || '').replace(/^todo-/, '');
      const same = n && byN.get(n);
      if (same) {
        same.anchor = attr(open, 'id');
        const gid = attr(open, 'data-asana'); if (gid) same.gid = gid;
        if (attr(open, 'data-done') === '1') same.done = true;
        continue;
      }
      pushT(open, m[3]);
    } }

  // 次回（「次回」と日付のある最初の文）
  const plain = stripTags(body);
  // 新しい作り: 「次回」「次にやる」の見出しの直後の文。旧: 「次回」と日付が近くにある 1 文
  let next = '';
  { const h = body.match(/<(h[2-4]|strong|dt)\b[^>]*>\s*(?:次回|次にやる)[^<]{0,12}<\/\1>([\s\S]{0,600}?)(?=<h[2-4]\b|<\/section>|$)/);
    if (h && stripTags(h[2])) next = cut(stripTags(h[2]), 80);
    else {
      const lines = body.replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, '').split(/<(?:\/?(?:li|p|div|h[1-6]|tr|td|dd|dt)\b[^>]*|br\s*\/?)>/i).map(stripTags).filter(Boolean);
      const DT = /\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}/;
      const l = lines.find(x => /次回(?:の)?(?:会議|MTG|ミーティング|定例|打ち?合わせ|訪問)?(?:は|日程|[（(])/.test(x) && DT.test(x)) || lines.find(x => /次回/.test(x) && DT.test(x));
      if (l) { const ss = l.replace(/^(結論|決定)[:：]\s*/, '').split(/(?<=。)/); next = cut((ss.find(x => /次回/.test(x) && DT.test(x)) || ss.find(x => /次回/.test(x)) || l).trim(), 80); }
    } }

  // 人・会社・言葉（1 文字は捨てる・辞書で正表記に）
  let ents = listVal(meta(html, 'entities'));
  if (type === 'kowa') { const sp = meta(html, 'kowa-speaker'); if (sp) ents.push(sp); ents = ents.concat(listVal(meta(html, 'kowa-keywords')).slice(0, 6)); }
  ents = Array.from(new Set(ents.map(canon).filter(s => s.length >= 2)));
  const themes = listVal(meta(html, 'kowa-themes'));
  const tags = Array.from(new Set([].concat(ents, themes, (KEYWORDS[file] || []).map(canon)).filter(s => s && s.length >= 2)));

  if (!h1) warn.push(`${file}: h1 が無い（<title> で代用）`);
  if (type !== 'kowa' && !decisions.length) warn.push(`${file}: 決定が 0`);
  return { file, date, type, title, dur, summary: cut(summary, 60), decisions, todos, next, ents, tags, text: plain.slice(0, 6000) };
});

/* ---- 取引先の年表 ---- */
const lc = (s) => s.toLowerCase();
for (const r of records) {
  r.partners = [];
  for (const p of PARTNERS) {
    const main = p.names.some(n => lc(r.title).includes(lc(n)));
    const ment = main || r.ents.includes(p.name) || r.ents.some(e => p.names.includes(e));
    if (ment) r.partners.push({ p, main });
  }
}
const hit = (s, p) => p.names.some(n => lc(s).includes(lc(n)));
const partnerData = PARTNERS.map(p => {
  const ms = records.filter(r => r.partners.some(x => x.p === p)).slice().sort((a, b) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file)).map(r => {
    const main = r.partners.find(x => x.p === p).main;
    const decs = main ? r.decisions.map(d => d.txt) : r.decisions.filter(d => hit(d.txt, p)).map(d => d.txt);
    const tds = (main ? r.todos : r.todos.filter(t => hit(t.title, p))).map(t => ({ title: t.title, assignees: t.assignees, due: t.due, done: t.done, anchor: t.anchor }));
    return { file: r.file, date: r.date, type: r.type, title: r.title, main, decisions: decs, todos: tds, next: main ? r.next : '' };
  });
  return { slug: p.slug, name: p.name, aliases: p.names.filter(n => n !== p.name), count: ms.length, main_count: ms.filter(m => m.main).length, last: ms.length ? ms[ms.length - 1].date : '', meetings: ms };
}).filter(p => p.count > 0).sort((a, b) => b.main_count - a.main_count || b.count - a.count || b.last.localeCompare(a.last));

/* ---- 宿題（todos.json）: Asana 担当の物があれば書かない ---- */
const allTodos = [];
for (const r of records) r.todos.forEach((t, i) => allTodos.push({ type: r.type, title: t.title, due: t.due, done: t.done, gid: t.gid, asana_url: t.asana_url, page: r.file, anchor: t.anchor, meeting: r.title, date: r.date, assignees: t.assignees }));
let todoNote;
{
  const tp = path.join(DATA, 'todos.json'); let cur = null;
  try { cur = JSON.parse(fs.readFileSync(tp, 'utf8')); } catch (e) {}
  if (cur && cur.source === 'asana') todoNote = `data/todos.json は Asana の物（${cur.generated || '日時なし'}）→ 書かない`;
  else {
    const people = {}; for (const n of STAFF_TABS) people[n] = [];
    const unassigned = [];
    for (const t of allTodos) {
      const { assignees, ...item } = t;
      if (!assignees.length) unassigned.push(t.type && t.type !== 'internal' ? Object.assign({}, item, { external: true }) : item);
      else for (const a of assignees) (people[a] = people[a] || []).push(assignees.length > 1 ? Object.assign({}, item, { with: assignees.filter(x => x !== a) }) : item);
    }
    const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
    const jst = new Date(now.getTime() + 9 * 3600e3);
    const gen = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:00+09:00`;
    write('data/todos.json', JSON.stringify({ generated: gen, source: 'pages', total: allTodos.length, people, unassigned }));
    todoNote = `data/todos.json をページから作った（${allTodos.length} 件・担当つき ${allTodos.filter(t => t.assignees.length).length}）`;
  }
}

/* ---- JSON ---- */
const decisionsData = records.filter(r => r.decisions.length).map(r => ({ file: r.file, date: r.date, type: r.type, title: r.title, items: r.decisions }));
write('data/decisions.json', JSON.stringify(decisionsData));
// decisions.html の最初の画面用（新しい 15 会議だけ・軽い）。検索・もっと見るで全部を読む
write('data/decisions-recent.json', JSON.stringify(decisionsData.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)));
write('data/partners.json', JSON.stringify(partnerData));
{
  const fl = records.map(r => ({ f: r.file, d: r.date, t: r.title, ty: r.type }));
  const ix = new Map(records.map((r, i) => [r.file, i]));
  const tags = {};
  for (const r of records) for (const t of r.tags) (tags[t] = tags[t] || []).push(ix.get(r.file));
  write('data/entities.json', JSON.stringify({ files: fl, tags }));
}
write('search-index.json', JSON.stringify(records.map(r => ({ file: r.file, date: r.date, type: r.type, title: r.title, tags: r.tags, text: r.text }))));

/* ---- 共通 CSS（飾り無し・システムフォント・字は 12px 以上） ---- */
const CSS = `/* style.css — gen-aux.js が作る（手で直さない。直すなら gen-aux.js の CSS を） */
:root{--ink:#1f2937;--sub:#374151;--mute:#5b6472;--line:#e3e5e8;--bg:#f6f6f3;--card:#fff;
--in:#1b4332;--inbg:#e6f2ea;--ex:#7c2d12;--exbg:#fbeee2;--ko:#312e81;--kobg:#ebebfa;--red:#b42318;--redbg:#fdecea;--link:#1d4ed8;--hl:#fff3c4;}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:system-ui,-apple-system,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic UI","Yu Gothic",Meiryo,sans-serif;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.7;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
a{color:var(--link)}
button,input,select{font:inherit;color:inherit}
.top{background:var(--in);color:#fff}
.top-in{max-width:1080px;margin:0 auto;padding:10px 16px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px}
.top h1{font-size:18px;font-weight:700;line-height:1.4}
.top a{color:#fff}
.back{font-size:14px;text-decoration:none;opacity:.9;margin-right:4px}
.stats{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;opacity:.92}
.stats strong{font-size:13px;margin-right:1px}
.top .sub{font-size:13px;opacity:.9;width:100%}
.tabs{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line)}
.tabs-in{max-width:1080px;margin:0 auto;display:flex}
.tab{flex:1;border:0;background:none;padding:10px 2px 8px;font-size:15px;font-weight:700;color:var(--mute);border-bottom:3px solid transparent;cursor:pointer}
.tab[aria-selected="true"]{color:var(--in);border-bottom-color:var(--in)}
.tab .n{font-size:12px;font-weight:400;margin-left:2px}
.wrap{max-width:1080px;margin:0 auto;padding:12px 16px 64px}
.note{font-size:13px;color:var(--mute);margin:2px 0 10px}
.badge{display:inline-block;font-size:12px;font-weight:700;padding:0 8px;border-radius:999px;line-height:20px;white-space:nowrap;vertical-align:1px}
.b-internal{background:var(--inbg);color:var(--in)}.b-external{background:var(--exbg);color:var(--ex)}.b-kowa{background:var(--kobg);color:var(--ko)}
.b-red{background:var(--redbg);color:var(--red)}.b-gray{background:#eef0f2;color:var(--sub)}
/* 今週 */
.wk{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:10px}
.wk h3{font-size:14px;font-weight:700;line-height:1.5;margin-bottom:4px}
.wk h3 a{color:var(--ink);text-decoration:none}
.wk h3 .d{color:var(--mute);font-weight:400;margin-right:6px}
.wk ul{list-style:none}
.wk li{font-size:14px;padding:5px 0 5px 14px;border-top:1px dashed var(--line);position:relative}
.wk li::before{content:"";position:absolute;left:2px;top:14px;width:6px;height:6px;border-radius:50%;background:var(--in)}
.wk li:first-child{border-top:0}
.wk .ctx{font-size:12px;color:var(--mute);margin-right:6px}
/* 宿題 */
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 12px;font-size:14px;cursor:pointer;white-space:nowrap}
.chip[aria-pressed="true"]{background:var(--in);border-color:var(--in);color:#fff}
.chip.red{color:var(--red);border-color:#f3c1bb}.chip.red[aria-pressed="true"]{background:var(--red);border-color:var(--red);color:#fff}
.chip .n{font-size:12px;margin-left:3px}
.nw{white-space:nowrap}
.td{list-style:none;background:var(--card);border:1px solid var(--line);border-radius:10px}
.td li{padding:9px 12px;border-top:1px solid var(--line);font-size:14px}
.td li:first-child{border-top:0}
.td .tt{font-weight:600}
.td .tm{font-size:12px;color:var(--mute);margin-top:2px;display:flex;flex-wrap:wrap;gap:2px 10px}
.td .late{color:var(--red);font-weight:700}
.td li.done .tt{text-decoration:line-through;color:var(--mute)}
.more{display:block;width:100%;margin:10px 0;padding:9px;border:1px solid var(--line);border-radius:10px;background:#fff;cursor:pointer;font-size:14px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.row label{font-size:13px;color:var(--sub);display:flex;align-items:center;gap:4px}
/* 取引先 */
.pl{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
.pl a{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:9px 12px;text-decoration:none;color:var(--ink)}
.pl .nm{font-weight:700;flex:1}
.pl .ct{font-size:12px;color:var(--mute);text-align:right;line-height:1.4}
/* 一覧 */
.filters{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}
.sbox{flex:1 1 220px;min-width:0;border:1px solid #c9ced4;border-radius:8px;padding:8px 12px;font-size:15px;background:#fff}
.sel{border:1px solid #c9ced4;border-radius:8px;padding:7px 8px;font-size:14px;background:#fff}
.filter-count{font-size:13px;color:var(--mute)}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
.mtg-card{display:block;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:9px 12px;text-decoration:none;color:var(--ink)}
.mtg-card:hover,.pl a:hover,.wk h3 a:hover{border-color:#9aa3ad}
.mtg-card .c-h{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--mute)}
.mtg-card .c-t{font-weight:700;font-size:15px;line-height:1.5;margin:2px 0}
.mtg-card .c-s{font-size:13px;color:var(--sub);line-height:1.6}
.mtg-card .c-m{font-size:12px;color:var(--mute);margin-top:3px}
.mtg-card[hidden]{display:none}
.foot{max-width:1080px;margin:0 auto;padding:0 16px 40px;font-size:14px;display:flex;flex-wrap:wrap;gap:6px 16px}
/* 年表 */
.tl{list-style:none;border-left:3px solid var(--line);margin-left:6px}
.tl>li{position:relative;padding:0 0 14px 16px}
.tl>li::before{content:"";position:absolute;left:-8px;top:8px;width:13px;height:13px;border-radius:50%;background:#fff;border:3px solid var(--in)}
.tl>li.ment::before{border-color:#b7bec6;width:11px;height:11px;left:-7px}
.tl .when{font-size:13px;color:var(--mute)}
.tl .ttl{font-weight:700;font-size:15px}
.tl .box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-top:4px}
.tl h4{font-size:12px;color:var(--mute);font-weight:700;margin-top:6px}
.tl h4:first-child{margin-top:0}
.tl ul{list-style:none}
.tl .box li{font-size:14px;padding:3px 0 3px 12px;position:relative}
.tl .box li::before{content:"・";position:absolute;left:-2px}
.tl .ment .ttl{font-weight:600;font-size:14px}
.sum{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:14px}
/* 決定・索引 */
.dg{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-bottom:10px}
.dg h3{font-size:14px;line-height:1.5}
.dg h3 a{color:var(--ink);text-decoration:none}
.dg h3 .d{color:var(--mute);font-weight:400;margin-right:6px}
.dg li{list-style:none;font-size:14px;padding:5px 0;border-top:1px dashed var(--line)}
.dg li .ctx{display:block;font-size:12px;color:var(--mute)}
mark{background:var(--hl);color:inherit}
details.all{margin-top:24px;font-size:14px}
details.all summary{cursor:pointer;color:var(--sub)}
details.all ol{padding-left:20px;margin-top:6px}
details.all li{padding:2px 0}
.empty{color:var(--mute);text-align:center;padding:30px 0}
@media(min-width:768px){.tab{font-size:16px}.top h1{font-size:20px}}
@media print{.tabs,.filters,.more,.foot{display:none}body{background:#fff}.top{background:#fff;color:#111;border-bottom:2px solid #111}.top a{color:#111}}
`;
const CSSV = crypto.createHash('md5').update(CSS).digest('hex').slice(0, 8);
write('style.css', CSS);

const TYPE_LABEL = { internal: '社内', external: '社外', kowa: '講話' };
const badge = (t) => `<span class="badge b-${t}">${TYPE_LABEL[t] || t}</span>`;
function page({ title, h1, sub, body, script, up = '', back = true, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="${up}favicon.svg">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${up}style.css?v=${CSSV}">${extraHead}
</head><body>
<header class="top"><div class="top-in">${back ? `<a class="back" href="${up}index.html">‹ 一覧</a>` : ''}<h1>${h1}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div></header>
${body}
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}
const allList = (label, rs, up = '') => `<details class="all"><summary>${label}（${rs.length}）</summary><ol>${rs.map(r => `<li><a href="${up}${r.file}">${r.date.replace(/-/g, '/')} ${esc(r.title)}</a></li>`).join('')}</ol></details>`;

/* ---- index.html ---- */
const cnt = { all: records.length, internal: records.filter(r => r.type === 'internal').length, external: records.filter(r => r.type === 'external').length, kowa: records.filter(r => r.type === 'kowa').length };
const newest = records.reduce((m, r) => r.date > m ? r.date : m, '');
const weekFrom = new Date(new Date(newest + 'T00:00:00Z').getTime() - 13 * 864e5).toISOString().slice(0, 10);
const weekRecs = records.filter(r => r.date >= weekFrom && r.decisions.length).sort((a, b) => b.date.localeCompare(a.date));
const weekHtml = weekRecs.map(r => `<section class="wk" data-date="${r.date}"><h3><a href="${r.file}">${esc(ttl(r))}</a> ${badge(r.type)}</h3><ul>${r.decisions.map(d => `<li>${d.ctx ? `<span class="ctx">${esc(d.ctx)}</span>` : ''}${esc(d.txt)}</li>`).join('')}</ul></section>`).join('\n');
const partnerHtml = partnerData.map(p => `<li data-n="${esc([p.name].concat(p.aliases).join(' '))}"><a href="partners/${p.slug}.html"><span class="nm">${esc(p.name)}</span><span class="ct">会議 ${p.main_count ? `${p.main_count} 回` : '—'}${p.count > p.main_count ? `・話に出た ${p.count - p.main_count}` : ''}<br>最後 ${md(p.last)}</span></a></li>`).join('');
const cardHtml = records.map(r => `<a href="${r.file}" class="mtg-card" data-type="${r.type}" data-month="${r.date.slice(0, 7)}"><div class="c-t">${esc(ttl(r))} ${badge(r.type)}</div><div class="c-s">${esc(r.summary)}</div><div class="c-m">${r.type === 'kowa' ? '講話' : `決定 ${r.decisions.length}・宿題 ${r.todos.length}`}${r.dur ? ` ・ 録音 ${esc(r.dur)}` : ''}</div></a>`).join('\n');
const months = Array.from(new Set(records.map(r => r.date.slice(0, 7)))).sort().reverse();
const DEFAULT_TAB = 'week';   // U5 の判断で変えるときはここだけ（week / todo / partner / list）

const indexBody = `<nav class="tabs" aria-label="入口"><div class="tabs-in" role="tablist">
<button class="tab" role="tab" id="t-week" aria-controls="p-week" aria-selected="false">今週</button>
<button class="tab" role="tab" id="t-todo" aria-controls="p-todo" aria-selected="false">宿題</button>
<button class="tab" role="tab" id="t-partner" aria-controls="p-partner" aria-selected="false">取引先<span class="n">${partnerData.length}</span></button>
<button class="tab" role="tab" id="t-list" aria-controls="p-list" aria-selected="false">一覧<span class="n">${records.length}</span></button>
</div></nav>
<main class="wrap">
<section id="p-week" role="tabpanel" aria-labelledby="t-week" hidden>
<p class="note" id="weekNote">直近の会議で決まったこと</p>
<div id="weekList">${weekHtml || '<p class="empty">決まったことの記録がありません</p>'}</div>
<p class="note">前の会議の決定は <a href="decisions.html">決定の一覧</a> に全部あります。</p>
</section>
<section id="p-todo" role="tabpanel" aria-labelledby="t-todo" hidden>
<p class="note" id="todoNote">読み込み中…</p>
<div class="chips" id="todoPeople"></div>
<div class="row"><label><input type="checkbox" id="todoDone"> 済も出す</label></div>
<ul class="td" id="todoList"></ul><button class="more" id="todoMore" hidden>もっと見る</button>
</section>
<section id="p-partner" role="tabpanel" aria-labelledby="t-partner" hidden>
<p class="note">社名を押すと、その会社との会議が日付の順に並んだ年表が開きます（社名は正しい表記にそろえています）。</p>
<div class="filters"><input class="sbox" id="pq" type="search" placeholder="社名でしぼる" aria-label="社名でしぼる"></div>
<ul class="pl" id="plist">${partnerHtml}</ul>
</section>
<section id="p-list" role="tabpanel" aria-labelledby="t-list" hidden>
<div class="filters">
<select class="sel" id="ft" aria-label="種類"><option value="all">すべて</option><option value="internal">社内</option><option value="external">社外</option><option value="kowa">講話</option></select>
<select class="sel" id="fm" aria-label="月"><option value="all">すべての月</option>${months.map(m => `<option value="${m}">${+m.slice(5)}月</option>`).join('')}</select>
<input class="sbox" id="q" type="search" placeholder="題・本文・言葉で検索" aria-label="検索">
<span class="filter-count" id="count">${records.length}件表示中</span>
</div>
<p class="note" id="qNote" hidden></p>
<div class="card-grid" id="cardGrid">
${cardHtml}
</div>
</section>
</main>
<footer class="foot"><a href="decisions.html">決定の一覧</a><a href="entity-index.html">取引先と言葉の索引</a><a href="kowa-knowledge.html">講話ナレッジ</a></footer>`;

const indexScript = `(function(){
var TABS=['week','todo','partner','list'],DEF='${DEFAULT_TAB}',STAFF=${jsonEmbed(STAFF_TABS)};
function $(id){return document.getElementById(id)}
function show(t,push){if(TABS.indexOf(t)<0)t=DEF;TABS.forEach(function(x){$('p-'+x).hidden=x!==t;$('t-'+x).setAttribute('aria-selected',x===t?'true':'false')});if(push&&history.replaceState)history.replaceState(null,'',location.pathname+location.search+'#'+t);if(t==='todo')loadTodos();}
TABS.forEach(function(x){$('t-'+x).onclick=function(){show(x,true)}});
/* 今週: 今日から 7 日→少なければ 14 日→無ければ最後の 2 週 */
(function(){var secs=[].slice.call(document.querySelectorAll('#weekList .wk'));if(!secs.length)return;var now=new Date();now.setHours(0,0,0,0);
function age(s){return Math.round((now-new Date(s.dataset.date+'T00:00:00'))/864e5)}
function count(d){return secs.filter(function(s){return age(s)<d}).reduce(function(n,s){return n+s.querySelectorAll('li').length},0)}
var d=count(7)>=3?7:(count(14)>0?14:0),n=$('weekNote');
if(d){secs.forEach(function(s){s.hidden=age(s)>=d});n.textContent=(d===7?'この 7 日':'この 2 週間')+'の会議で決まったこと（新しい順）';}
else{var last=secs[0].dataset.date;n.textContent='この 2 週間は会議の記録がありません。最後の会議（'+(+last.slice(5,7))+'/'+(+last.slice(8))+'・'+age(secs[0])+' 日前）までの 2 週分で決まったことです。';}})();
/* 宿題: data/todos.json を開いた時だけ読む */
var TD=null,who=null,lim=50;
function loadTodos(){if(TD)return;TD={};fetch('data/todos.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw r.status;return r.json()}).then(function(j){TD=j;renderPeople()}).catch(function(e){$('todoNote').textContent='宿題の一覧（data/todos.json）を読めませんでした（'+e+'）。';});}
function open(a){return a.filter(function(t){return !t.done}).length}
function renderPeople(){var p=TD.people||{},keys=STAFF.filter(function(k){return p[k]}).concat(Object.keys(p).filter(function(k){return STAFF.indexOf(k)<0}));
var src=TD.source==='asana'?'Asana から':'会議ページから仮に作った一覧（済かどうかは分かりません。Asana の取り込みが動くと Asana の済/未に変わります）';
$('todoNote').textContent=src+'・'+(TD.generated||'').slice(0,16).replace('T',' ')+' 時点';
var box=$('todoPeople');box.innerHTML='';function chip(k,list,red){var b=document.createElement('button');b.className='chip'+(red?' red':'');b.type='button';b.setAttribute('aria-pressed','false');b.innerHTML=k+'<span class="n">'+open(list)+'</span>';b.onclick=function(){who=k;lim=50;[].forEach.call(box.children,function(c){c.setAttribute('aria-pressed',c===b?'true':'false')});renderList()};box.appendChild(b);return b}
var first=null;keys.forEach(function(k){var b=chip(k,p[k]);if(!first&&open(p[k]))first=b});if((TD.multi||[]).length)chip('複数人',TD.multi);var un=(TD.unassigned||[]).filter(function(t){return !t.external}),ux=(TD.unassigned||[]).filter(function(t){return t.external});chip('担当未定',un,true);if(ux.length)chip('担当の記載なし',ux);(first||box.firstChild).click();}
function listOf(k){return k==='担当未定'?(TD.unassigned||[]).filter(function(t){return !t.external}):k==='担当の記載なし'?(TD.unassigned||[]).filter(function(t){return t.external}):k==='複数人'?(TD.multi||[]):((TD.people||{})[k]||[])}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function renderList(){var all=$('todoDone').checked,today=new Date().toISOString().slice(0,10);
var a=listOf(who).filter(function(t){return all||!t.done}).slice().sort(function(x,y){if(x.done!==y.done)return x.done?1:-1;if(x.due&&y.due)return x.due<y.due?-1:x.due>y.due?1:0;if(x.due)return -1;if(y.due)return 1;return (y.date||'')<(x.date||'')?-1:1});
var ul=$('todoList');ul.innerHTML=a.slice(0,lim).map(function(t){var late=!t.done&&t.due&&t.due<today;var href=e(t.page)+(t.anchor?'#'+e(t.anchor):'');
return '<li class="'+(t.done?'done':'')+'"><div class="tt">'+e(t.title)+'</div><div class="tm">'+(t.due?'<span class="'+(late?'late':'')+'">期限 '+(+t.due.slice(5,7))+'/'+(+t.due.slice(8))+(late?'（過ぎた）':'')+'</span>':'<span>期限なし</span>')+(t['with']&&t['with'].length?'<span>一緒に: '+e(t['with'].join('・'))+'</span>':'')+(t.page?'<a href="'+href+'">'+e(t.meeting||t.page)+'</a>':(t.meeting?'<span>'+e(t.meeting)+'</span>':''))+(t.asana_url?'<a href="'+e(t.asana_url)+'" target="_blank" rel="noopener">Asana で開く</a>':'')+(t.done?'<span>済</span>':'')+'</div></li>'}).join('')||'<li class="empty">ありません</li>';
var m=$('todoMore');m.hidden=a.length<=lim;m.textContent='もっと見る（残り '+(a.length-lim)+' 件）';}
$('todoMore').onclick=function(){lim+=100;renderList()};$('todoDone').onchange=function(){if(who)renderList()};
/* 取引先のしぼり込み */
$('pq').oninput=function(){var q=this.value.trim().toLowerCase();[].forEach.call($('plist').children,function(li){li.hidden=q&&li.dataset.n.toLowerCase().indexOf(q)<0})};
/* 一覧: 種類・月・検索。本文の検索は検索欄を使った時だけ search-index.json を読む */
var cards=[].slice.call(document.querySelectorAll('#cardGrid .mtg-card')),SI=null,loading=false,hitSet=null;
function filt(){var t=$('ft').value,m=$('fm').value,q=$('q').value.trim().toLowerCase(),n=0;
cards.forEach(function(c){var ok=(t==='all'||c.dataset.type===t)&&(m==='all'||c.dataset.month===m);if(ok&&q){var f=c.getAttribute('href');ok=c.textContent.toLowerCase().indexOf(q)>=0||(hitSet&&hitSet[f]);}c.hidden=!ok;if(ok)n++});
$('count').textContent=n+'件表示中';}
function search(){var q=$('q').value.trim().toLowerCase(),qn=$('qNote');if(!q){hitSet=null;qn.hidden=true;filt();return}
if(!SI){if(!loading){loading=true;qn.hidden=false;qn.textContent='本文も検索しています…';fetch('search-index.json').then(function(r){return r.json()}).then(function(j){SI=j;search()}).catch(function(){qn.textContent='本文の検索を読めませんでした。題と要約だけで探しています。'})}filt();return}
hitSet={};SI.forEach(function(r){var s=(r.title+' '+(r.tags||[]).join(' ')+' '+r.text).toLowerCase();if(s.indexOf(q)>=0)hitSet[r.file]=1});qn.hidden=false;qn.textContent='題・要約・本文から探しています';filt();}
$('ft').onchange=filt;$('fm').onchange=filt;$('q').oninput=search;
/* 前の URL（?filter=・?q=）をそのまま使えるように */
var sp=new URLSearchParams(location.search),f=sp.get('filter'),q=sp.get('q'),h=location.hash.slice(1);
if(f&&/^(internal|external|kowa)$/.test(f)){$('ft').value=f;filt();h='list'}
if(q){$('q').value=q;search();h='list'}
show(h||DEF,false);
})();`;
const statsHtml = `<div class="stats"><span><strong data-count="${cnt.all}">${cnt.all}</strong> 全件</span><span><strong data-count="${cnt.internal}">${cnt.internal}</strong> 社内</span><span><strong data-count="${cnt.external}">${cnt.external}</strong> 社外</span><span><strong data-count="${cnt.kowa}">${cnt.kowa}</strong> 講話録音</span></div>`;
const indexHtml = page({ title: 'FARMAN 議事録', h1: 'FARMAN 議事録', back: false, body: indexBody, script: indexScript }).replace('<h1>FARMAN 議事録</h1>', '<h1>FARMAN 議事録</h1>' + statsHtml);
const sizes = {};
sizes['index.html'] = write('index.html', indexHtml);

/* ---- partners/<slug>.html ---- */
const usedSlug = new Set();
for (const p of partnerData) {
  if (usedSlug.has(p.slug)) throw new Error('取引先の URL の名前が重複: ' + p.slug); usedSlug.add(p.slug);
  const lastMain = p.meetings.filter(m => m.main).slice(-1)[0];
  const openTodos = p.meetings.reduce((n, m) => n + m.todos.filter(t => !t.done).length, 0);
  const items = p.meetings.map(m => {
    const dl = m.decisions.length ? `<h4>決まったこと</h4><ul>${m.decisions.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : '';
    const tl = m.todos.length ? `<h4>宿題</h4><ul>${m.todos.map(t => `<li>${esc(t.title)}${t.assignees.length ? (t.assignees.every(n => t.title.includes(n)) ? '' : `（${esc(t.assignees.join('・'))}）`) : (m.type === 'internal' ? '（担当未定）' : '（担当の記載なし）')}${t.due ? ` 期限 ${md(t.due)}` : ''}</li>`).join('')}</ul>` : '';
    const nx = m.next ? `<h4>次回</h4><ul><li>${esc(m.next)}</li></ul>` : '';
    const box = dl || tl || nx ? `<div class="box">${dl}${tl}${nx}</div>` : '';
    return `<li class="${m.main ? 'main' : 'ment'}"><div class="when">${m.date.replace(/-/g, '/')} ${badge(m.type)}${m.main ? '' : ' <span class="badge b-gray">話に出た</span>'}</div><div class="ttl"><a href="../${m.file}">${esc(m.title)}</a></div>${box}</li>`;
  }).join('\n');
  const sum = `<div class="sum">会議 ${p.main_count} 回${p.count > p.main_count ? `・ほかの会議で話に出た ${p.count - p.main_count} 回` : ''}。${lastMain ? `最後の会議は <a href="../${lastMain.file}">${md(lastMain.date)} ${esc(lastMain.title)}</a>。` : ''}この年表の宿題 <span class="nw">${openTodos} 件</span>${p.aliases.length ? `<br><span class="note">ほかの書き方: ${esc(p.aliases.join('・'))}</span>` : ''}</div>`;
  const body = `<main class="wrap">${sum}<ol class="tl">${items}</ol><p class="note">●＝その会社との会議（決まったこと・宿題は全部）／○＝ほかの会議で話に出た（その会社の名前がある決定・宿題だけ）。</p></main>`;
  write(`partners/${p.slug}.html`, page({ title: `${p.name} の年表`, h1: `${esc(p.name)} の年表`, body, up: '../' }));
}
// 前回あって今回無い年表は消す（社名の表から外した物のリンク切れを残さない）
for (const f of fs.readdirSync(PDIR)) if (/\.html$/.test(f) && !usedSlug.has(f.replace(/\.html$/, ''))) fs.unlinkSync(path.join(PDIR, f));

/* ---- decisions.html（軽い描画・中身は data/decisions.json） ---- */
{
  const totalD = decisionsData.reduce((s, r) => s + r.items.length, 0);
  const body = `<main class="wrap">
<div class="filters"><select class="sel" id="ft" aria-label="種類"><option value="all">すべて</option><option value="internal">社内</option><option value="external">社外</option></select>
<input class="sbox" id="q" type="search" placeholder="決まったことを検索" aria-label="検索"><span class="filter-count" id="cnt">${totalD}件の決定</span></div>
<div id="list"><p class="empty">読み込み中…</p></div><button class="more" id="more" hidden>もっと見る</button>
${allList('会議ごと（決定のある会議）', decisionsData)}
</main>`;
  const script = `(function(){var D=[],lim=15;function $(i){return document.getElementById(i)}
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function hl(s,q){s=e(s);if(!q)return s;var i=s.toLowerCase().indexOf(e(q).toLowerCase());return i<0?s:s.slice(0,i)+'<mark>'+s.slice(i,i+e(q).length)+'</mark>'+s.slice(i+e(q).length)}
var L={internal:'社内',external:'社外',kowa:'講話'};
function draw(){var t=$('ft').value,q=$('q').value.trim().toLowerCase(),n=0,g=[];
D.forEach(function(r){if(t!=='all'&&r.type!==t)return;var it=r.items.filter(function(d){return !q||(r.title+' '+d.ctx+' '+d.txt).toLowerCase().indexOf(q)>=0});if(!it.length)return;n+=it.length;g.push([r,it])});
$('cnt').textContent=n+'件の決定';$('list').innerHTML=g.slice(0,lim).map(function(x){var r=x[0];return '<section class="dg"><h3><a href="'+r.file+'"><span class="d">'+r.date.replace(/-/g,'/')+'</span>'+e(r.title)+'</a> <span class="badge b-'+r.type+'">'+L[r.type]+'</span></h3><ul>'+x[1].map(function(d){return '<li>'+(d.ctx?'<span class="ctx">'+e(d.ctx)+'</span>':'')+hl(d.txt,q)+'</li>'}).join('')+'</ul></section>'}).join('')||'<p class="empty">該当なし</p>';
var m=$('more');if(!full){$('cnt').textContent='新しい '+g.length+' 会議（全部は ${decisionsData.length} 会議）';m.hidden=false;m.textContent='前の会議も出す（全部）';return}m.hidden=g.length<=lim;m.textContent='もっと見る（残り '+(g.length-lim)+' 会議）';}
var q=new URLSearchParams(location.search).get('q');if(q)$('q').value=q;
var full=false;function load(u,cb){fetch(u).then(function(r){return r.json()}).then(function(j){D=j.sort(function(a,b){return a.date<b.date?1:-1});cb&&cb();draw()}).catch(function(){$('list').innerHTML='<p class="empty">'+u+' を読めませんでした。下の会議の一覧から開いてください。</p>'})}
function all(cb){if(full){cb();return}full=true;$('cnt').textContent='読み込み中…';load('data/decisions.json',cb)}
$('more').onclick=function(){all(function(){lim+=30})};$('ft').onchange=function(){all(function(){lim=15})};$('q').oninput=function(){all(function(){lim=15})};
if(q){all(function(){})}else{load('data/decisions-recent.json',function(){$('more').hidden=false})}})();`;
  sizes['decisions.html'] = write('decisions.html', page({ title: '決定の一覧 — FARMAN 議事録', h1: '決定の一覧', sub: `${decisionsData.length} 会議・${totalD} 件（新しい順）`, body, script }));
}

/* ---- entity-index.html（取引先と言葉の索引・中身は data/entities.json） ---- */
{
  const body = `<main class="wrap">
<h2 style="font-size:16px;margin-bottom:6px">取引先（年表）</h2>
<ul class="pl">${partnerData.map(p => `<li><a href="partners/${p.slug}.html"><span class="nm">${esc(p.name)}</span><span class="ct">会議 ${p.main_count || '—'}${p.count > p.main_count ? `・話に出た ${p.count - p.main_count}` : ''}</span></a></li>`).join('')}</ul>
<h2 style="font-size:16px;margin:20px 0 6px">人・会社・言葉で探す</h2>
<div class="filters"><input class="sbox" id="q" type="search" placeholder="例: 浅川・JAS・ドローン" aria-label="人・会社・言葉"><span class="filter-count" id="cnt"></span></div>
<div id="res"><p class="note">言葉を入れると、その言葉が出た会議が並びます。</p></div>
${allList('会議の一覧（全部）', records)}
</main>`;
  const script = `(function(){var E=null,ld=false;function $(i){return document.getElementById(i)}
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var L={internal:'社内',external:'社外',kowa:'講話'};
function run(){var q=$('q').value.trim().toLowerCase();if(!q){$('res').innerHTML='';$('cnt').textContent='';return}
if(!E){if(!ld){ld=true;$('res').innerHTML='<p class="note">読み込み中…</p>';fetch('data/entities.json').then(function(r){return r.json()}).then(function(j){E=j;run()}).catch(function(){$('res').innerHTML='<p class="empty">data/entities.json を読めませんでした</p>'})}return}
var ks=Object.keys(E.tags).filter(function(k){return k.toLowerCase().indexOf(q)>=0}).sort(function(a,b){return E.tags[b].length-E.tags[a].length}).slice(0,40);
$('cnt').textContent=ks.length+'語';
$('res').innerHTML=ks.map(function(k){return '<section class="dg"><h3>'+e(k)+' <span class="badge b-gray">'+E.tags[k].length+'</span></h3><ul>'+E.tags[k].map(function(i){return E.files[i]}).sort(function(a,b){return a.d<b.d?1:-1}).map(function(f){return '<li><a href="'+f.f+'">'+f.d.replace(/-/g,'/')+' '+e(f.t)+'</a> <span class="badge b-'+f.ty+'">'+L[f.ty]+'</span></li>'}).join('')+'</ul></section>'}).join('')||'<p class="empty">該当なし</p>';}
$('q').oninput=run;var q=new URLSearchParams(location.search).get('q');if(q){$('q').value=q;run()}})();`;
  sizes['entity-index.html'] = write('entity-index.html', page({ title: '取引先と言葉の索引 — FARMAN 議事録', h1: '取引先と言葉の索引', sub: `取引先 ${partnerData.length} 社・会議 ${records.length} 本`, body, script }));
}

/* ---- 報告 ---- */
const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log(`gen-aux: 会議 ${records.length} 本（社内 ${cnt.internal}・社外 ${cnt.external}・講話 ${cnt.kowa}）`);
console.log(`  決定 ${decisionsData.reduce((s, r) => s + r.items.length, 0)} 件・宿題 ${allTodos.length} 件・取引先 ${partnerData.length} 社`);
console.log(`  index ${kb(sizes['index.html'])}・decisions ${kb(sizes['decisions.html'])}・entity-index ${kb(sizes['entity-index.html'])}`);
console.log(`  表記ゆれ: ${rulesNote}`);
console.log(`  ${todoNote}`);
if (warn.length) console.log('  注意:\n   - ' + warn.join('\n   - '));
