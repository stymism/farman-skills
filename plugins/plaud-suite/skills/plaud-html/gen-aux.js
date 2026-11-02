#!/usr/bin/env node
/* ============================================================
   gen-aux.js — 議事録サイトの「一覧（index）と横断ページ」を全部作る（2026-10-29 作り直し・U2/U3）
   会議ページ（2026-MM-DD_*.html）を読むだけ。会議ページは書き換えない。
   読み方は 旧の作り（.decision-box・.action-item label・<meta name="entities">・h1・日付）と
   新しい作り（先頭の結論カード・宿題行 id="todo-<n>"・data-asana・data-done）の両方で動く。

   出力（work_dir の中）:
     index.html              4 つのタブ（ホーム・宿題・取引先・会議一覧）。表紙に検索欄と数字のカード（11-02）。一覧カードは要約 60 字＋「決定 n・宿題 n」
     style.css               index と横断ページの共通 CSS（Noto Sans JP・字は 12px 以上・動く飾り無し・11-01 にグラデーションと影を戻した）
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
  const heads = []; { const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi; let m; while ((m = re.exec(body))) heads.push({ i: m.index, t: stripTags(m[1]).replace(/^\d+[\s.．:：、)）]+/, '') }); }
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
    todos.push({ title: String(p.title).replace(/[：:]\s*[^：:]{1,15}?\s*[：:]\s*(?:-|—|－|なし|期限なし|\d{1,2}[\/月]\d{1,2}日?)\s*$/, '').trim(), assignees: p.assignees, due: p.due, done, gid, asana_url: au ? decode(au) : null, anchor });
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
  return { slug: p.slug, name: p.name, aliases: p.names.filter(n => n !== p.name), count: ms.length, main_count: ms.filter(m => m.main).length, last: (ms.filter(m => m.main).pop() || ms[ms.length - 1] || {}).date || '', meetings: ms };
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
/* decisions-recent.json は 11-02 にやめた（決定の一覧は最初から全部を月ごとに出す） */
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
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap");
:root{--ink:#1f2937;--sub:#374151;--mute:#5b6472;--line:#e3e5e8;--bg:#eef5f0;--card:#fff;
--in:#1b4332;--inbg:#e6f2ea;--ex:#7c2d12;--exbg:#fbeee2;--ko:#312e81;--kobg:#ebebfa;--red:#b42318;--redbg:#fdecea;--link:#1d4ed8;--hl:#fff3c4;
--sh1:0 1px 3px rgba(16,40,28,.08);--sh2:0 6px 20px rgba(16,40,28,.10);}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:"Noto Sans JP",system-ui,-apple-system,"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic",Meiryo,sans-serif;letter-spacing:.02em;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.7;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
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
.mtg-card[hidden],.mg[hidden]{display:none}
/* 点検の直し（11-02） */
.seg button:disabled{opacity:.4;cursor:default}
.seg.scroll{-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent);padding-right:24px}
.tl .dn{display:inline-block;font-size:11px;font-weight:700;background:#e5e7eb;color:#374151;border-radius:999px;padding:0 7px;margin-right:6px}
.tl .ment-n{font-size:13px;color:var(--sub);margin:2px 0 0}
@media(max-width:640px){
  .lf-row:first-child{flex-wrap:wrap}.lf .sbox{flex-basis:100%}
  #p-home:not([hidden]){display:flex;flex-direction:column}#p-home .hm-2{order:-1;margin-bottom:16px}
  #p-home .rc:nth-child(n+4){display:none}
  .dl li{grid-template-columns:auto 1fr;gap:2px 8px}.dl li>:nth-child(3){grid-column:1/-1}
}

/* 表紙: ホーム以外では低く（11-02） */
body[data-tab]:not([data-tab="home"]) .top.hero .hs,body[data-tab]:not([data-tab="home"]) .top.hero .stats,body[data-tab]:not([data-tab="home"]) .top.hero .sh,body[data-tab]:not([data-tab="home"]) .top.hero .lead{display:none}
body[data-tab]:not([data-tab="home"]) .top.hero .top-in{padding:16px 16px 14px;display:block}
body[data-tab]:not([data-tab="home"]) .top.hero h1{font-size:26px;margin:2px 0 0}
.totop{position:fixed;right:16px;bottom:16px;z-index:20;background:var(--in);color:#fff;text-decoration:none;font-size:13px;font-weight:700;border-radius:999px;padding:8px 14px;box-shadow:var(--sh2);opacity:.9}
.totop:hover{opacity:1}
/* 取引先（11-02） */
.ph{font-size:16px;font-weight:900;color:var(--in);margin:18px 2px 8px;display:flex;gap:8px;align-items:baseline}.ph span{font-size:12px;color:var(--mute);font-weight:700}
.pl a{gap:10px}.pl .nm{font-size:15px}.pl .ct{font-size:13px;color:var(--sub);text-align:left;flex:none}.pl .ct b{color:var(--in);font-size:15px}
.pl a{display:grid !important;grid-template-columns:1fr auto;grid-template-rows:auto auto}.pl .nm{grid-column:1}.pl .ct{grid-column:1;grid-row:2}.pl .ar{grid-column:2;grid-row:1 / span 2;align-self:center;color:var(--in);font-weight:900}
.pl-sub a{box-shadow:none;border:1px dashed var(--line) !important;background:transparent}
/* 年表（11-02） */
.tl .box h4 span{font-weight:400;margin-left:6px}
.tl details summary{cursor:pointer;font-size:13px;font-weight:700;color:var(--in);margin:4px 0}
.tl .tds summary{font-size:13px;color:var(--sub)}
.tl .who{display:inline-block;font-size:12px;font-weight:700;background:var(--inbg);color:var(--in);border-radius:999px;padding:0 8px;margin-right:6px}
.tl .due{font-size:12px;color:var(--mute);white-space:nowrap}
.tl .ttl a{color:var(--ink);text-decoration:none;font-size:16px;font-weight:900}.tl .ttl a:hover{color:var(--in);text-decoration:underline}
.dg li .ctx{font-weight:700;color:var(--sub)}
/* 宿題（11-02） */
.seg button.red{color:var(--red)}.seg button.red[aria-pressed="true"]{background:var(--red);border-color:var(--red);color:#fff}
.seg button .n{font-weight:400;font-size:12px;margin-left:3px}
.tdh{font-size:19px;font-weight:900;margin:4px 2px 10px;display:flex;gap:10px;align-items:baseline}.tdh span{font-size:13px;color:var(--mute);font-weight:700}
.tg{margin-bottom:16px}.tg h3,.tg summary{font-size:15px;font-weight:900;color:var(--in);margin:0 2px 6px;display:flex;gap:8px;align-items:baseline;cursor:default}
.tg summary{cursor:pointer;list-style:none}.tg summary::before{content:"＋";font-weight:700}.tg[open] summary::before{content:"－"}
.tg h3 span,.tg summary span{font-size:12px;color:var(--mute);font-weight:700}
.tg-late h3{color:var(--red)}.tg-late .td{border-left:4px solid var(--red)}
.td .tt{font-size:15px;font-weight:700;line-height:1.55}
.td .tm{gap:4px 12px;font-size:13px;margin-top:4px;align-items:center}
.tdue{font-weight:700;color:var(--in)}.tdue.late{color:var(--red)}
.tmeet{color:var(--sub);text-decoration:none}.tmeet:hover{text-decoration:underline}
.tas{border:1px solid var(--line);border-radius:999px;padding:1px 10px;text-decoration:none;font-size:12px;font-weight:700;color:var(--in)}.tas:hover{background:var(--inbg)}
/* 会議一覧（11-02） */
.lf{background:#fff;border-radius:14px;box-shadow:var(--sh1);padding:12px 16px;margin-bottom:18px;display:flex;flex-direction:column;gap:8px}
.lf-row{display:flex;align-items:center;gap:10px;min-width:0}
.lf .sbox{flex:1;border-radius:999px;font-size:15px;padding:10px 16px}
@media(max-width:640px){.lf .sbox{flex:1 1 100%}}
.lf .filter-count{font-size:14px;color:var(--sub);white-space:nowrap}.lf .filter-count b{color:var(--in);font-size:16px}
.lf-l{font-size:12px;font-weight:700;color:var(--mute);min-width:2.6em;white-space:nowrap;flex-shrink:0;align-self:flex-start;padding-top:6px}
.seg{display:flex;gap:6px;flex-wrap:wrap;min-width:0}
.seg.scroll{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}
.seg button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700;color:var(--sub);cursor:pointer;white-space:nowrap}
.seg button i{font-style:normal;font-weight:400;color:var(--mute);font-size:12px}
.seg button[aria-pressed="true"]{background:var(--in);border-color:var(--in);color:#fff}.seg button[aria-pressed="true"] i{color:#cfe8d9}
.mg{margin-bottom:22px}
.mg-h{position:sticky;top:58px;z-index:3;display:flex;align-items:baseline;gap:10px;font-size:17px;font-weight:900;color:var(--in);background:var(--bg);padding:6px 2px;margin-bottom:8px}
.mg-n{font-size:12px;font-weight:700;color:var(--mute)}
.mtg-card{display:flex !important;gap:14px;border-left:4px solid var(--in) !important}
.mtg-card[hidden]{display:none !important}
.mtg-card.t-external{border-left-color:#c2410c !important}.mtg-card.t-kowa{border-left-color:#4338ca !important}
.c-day{flex-shrink:0;width:52px;text-align:center;line-height:1.1;padding-top:2px}
.c-day b{display:block;font-size:26px;font-weight:900;color:var(--ink)}
.c-day span{font-size:11px;color:var(--mute);font-weight:700}
.c-body{flex:1;min-width:0}
.mtg-card .c-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.c-who{font-size:12px;font-weight:700;color:var(--sub)}
.mtg-card .c-t{font-size:16px;line-height:1.45;margin:3px 0 4px}
.mtg-card .c-s{font-size:13.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mtg-card .c-m{display:flex;gap:12px;font-size:12px;margin-top:6px}
.mtg-card .c-m .k b{font-size:14px;color:var(--in)}
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
/* 2026-11-01 見た目を戻す（本人「シンプルになりすぎ。ダサい」「スタイリッシュ性は勝手に消さないで」）
   前の作りの濃い緑のグラデーション・淡い円・太い字・影のあるカード・丸いタブを、動く飾りなしで戻す */
.top{position:relative;overflow:hidden;background:radial-gradient(circle at 8% 20%,rgba(255,255,255,.07) 0 90px,transparent 91px),radial-gradient(circle at 90% 75%,rgba(255,255,255,.06) 0 80px,transparent 81px),radial-gradient(circle at 55% 35%,rgba(255,255,255,.05) 0 28px,transparent 29px),linear-gradient(135deg,#2d6a4f 0%,#1b4332 55%,#12301f 100%)}
.top-in{padding:18px 16px 20px}
.top h1{font-size:22px;font-weight:900;letter-spacing:.02em}
.back{border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:2px 10px;background:rgba(255,255,255,.07)}
.top.hero .top-in{display:grid;grid-template-columns:1fr minmax(0,460px);gap:8px 32px;align-items:end;padding:30px 16px 28px}
.top.hero .eyebrow{font-size:12px;font-weight:700;letter-spacing:.25em;opacity:.8}
.top.hero h1{font-size:clamp(30px,5vw,42px);line-height:1.15;margin:6px 0 4px;letter-spacing:.03em}
.top.hero .eyebrow,.top.hero h1,.top.hero .lead{grid-column:1}
.top.hero .hs,.top.hero .stats{grid-column:2}
.top.hero .hs{grid-row:1 / span 2;align-self:end}
.hs input{width:100%;border:0;border-radius:999px;padding:12px 20px;font-size:15px;color:var(--ink);background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.18);outline:none}
.hs input:focus{box-shadow:0 0 0 3px rgba(149,213,178,.7),0 6px 24px rgba(0,0,0,.18)}
.top.hero .lead{font-size:14px;opacity:.85}
.top.hero .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px;opacity:1}
.top.hero .stats button{display:flex;flex-direction:column;align-items:flex-start;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:#fff;font-size:12px;font-weight:700;line-height:1.3;cursor:pointer;transition:background .15s}
.top.hero .stats button:hover{background:rgba(255,255,255,.2)}
.top.hero .stats strong{font-size:22px;font-weight:900;line-height:1.15;margin:0}
/* ホーム */
.hm-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:6px 0 10px}
.hm-h h2{font-size:18px;font-weight:900;letter-spacing:.02em}
.hm-h small{font-size:12px;font-weight:400;color:var(--mute);margin-left:6px}.hm-h.sm{margin-top:18px}.hm-h.sm h2{font-size:15px}
.lk{border:0;background:none;color:var(--in);font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap}
.lk:hover{text-decoration:underline}
.rcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:26px}
.rc{display:flex;flex-direction:column;background:#fff;border-radius:14px;padding:14px 18px 12px;text-decoration:none;color:var(--ink);box-shadow:var(--sh1);transition:transform .15s,box-shadow .15s}
.rc:hover{transform:translateY(-2px);box-shadow:var(--sh2)}
.rc-d{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mute)}
.rc-d b{font-size:15px;color:var(--in);font-weight:900}
.rc-t{font-size:16px;font-weight:900;line-height:1.45;margin:4px 0 6px}
.rc ul{list-style:none;flex:1}
.rc li{font-size:14px;color:var(--sub);line-height:1.6;padding:2px 0 2px 12px;position:relative;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.rc li::before{content:"";position:absolute;left:1px;top:.7em;width:5px;height:5px;border-radius:50%;background:#52b788}
.rc-s{font-size:13px;color:var(--sub);flex:1;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.rc-m{display:flex;justify-content:space-between;font-size:12px;color:var(--mute);border-top:1px solid var(--line);margin-top:10px;padding-top:8px}
.rc-m span{color:var(--in);font-weight:700}
.hm-2{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;align-items:start}
.pane{background:#fff;border-radius:14px;padding:14px 18px;box-shadow:var(--sh1)}
.dl{list-style:none;margin-bottom:6px}
.dh{font-size:14px;font-weight:900;color:var(--in);margin:8px 0 2px;display:flex;gap:8px;align-items:baseline}
.dh.late{color:var(--red);margin-top:14px}.dh span{font-size:12px;font-weight:700;color:var(--mute)}
.dm{font-size:13px;color:var(--sub);margin-top:8px}
.pane .empty{text-align:left;padding:6px 0;font-size:13px}
.top.hero .sh{grid-column:2;font-size:12px;opacity:.8;margin-top:2px}
.dl li{display:grid;grid-template-columns:5.2em 5em 1fr;gap:8px;align-items:baseline;font-size:14px;padding:7px 0;border-top:1px solid var(--line)}
.dl li:first-child{border-top:0}
.dl a{color:var(--ink);text-decoration:none}.dl a:hover{color:var(--in);text-decoration:underline}
.du{font-size:12px;font-weight:700;color:var(--in);white-space:nowrap}.du.late{color:var(--red)}
.dw{font-size:12px;color:var(--sub);font-weight:700;overflow-wrap:anywhere}
.tps{display:flex;flex-wrap:wrap;gap:8px}
.tp{display:inline-flex;align-items:center;gap:6px;background:var(--inbg);color:var(--in);border-radius:999px;padding:5px 12px;font-size:14px;font-weight:700;text-decoration:none}
.tp span{font-size:11px;background:#fff;border-radius:999px;padding:0 7px;line-height:18px}
.tp:hover{background:#d3eadb}
.qk{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.qk a{display:block;border:1px solid var(--line);border-radius:12px;padding:10px 12px;text-decoration:none;color:var(--ink)}
.qk a:hover{border-color:#9fb8a8}
.qk b{display:block;font-size:15px}.qk span{display:block;font-size:13px;color:var(--sub);line-height:1.5;margin-top:2px}
.tab{white-space:nowrap}
@media(max-width:600px){.top.hero .top-in{padding:18px 16px 16px}.top.hero .eyebrow,.top.hero .lead{display:none}.top.hero h1{font-size:28px;margin:0 0 4px}.hs input{padding:10px 16px;font-size:14px}.top.hero .stats{gap:6px}.top.hero .stats button{padding:6px 8px}.top.hero .stats strong{font-size:18px}.tabs-in{gap:4px;padding:8px 10px}.tab{font-size:13px;padding:6px 2px}.tab .n{display:none}}
@media(max-width:860px){.top.hero .top-in{grid-template-columns:1fr}.top.hero .hs,.top.hero .stats,.top.hero .sh{grid-column:1;grid-row:auto}.hm-2{grid-template-columns:1fr}.qk{grid-template-columns:1fr}}
.tabs{background:rgba(255,255,255,.96);border-bottom:0;box-shadow:var(--sh1)}
.tabs-in{gap:8px;padding:10px 16px}
.tab{border:1px solid var(--line);border-radius:999px;padding:7px 4px;background:#fff}
.tab[aria-selected="true"]{background:var(--in);border-color:var(--in);color:#fff}
.tab:not([aria-selected="true"]):hover{border-color:#9fb8a8;color:var(--in)}
.wrap{padding-top:20px}
.wk,.td,.pl a,.mtg-card,.dg,.sum,.tl .box,.more{border:0;border-radius:14px;box-shadow:var(--sh1)}
.wk{padding:14px 18px;margin-bottom:12px}
.wk h3{font-size:15px;font-weight:900}
.mtg-card,.pl a{transition:transform .15s,box-shadow .15s}
.mtg-card:hover,.pl a:hover{transform:translateY(-2px);box-shadow:var(--sh2)}
.mtg-card{padding:14px 18px}
.mtg-card .c-t{font-weight:900}
.card-grid{gap:12px}.pl{gap:10px}
.sbox,.sel{border-radius:999px;border-color:var(--line);box-shadow:var(--sh1)}
.chip{box-shadow:var(--sh1);border-color:transparent}
@media(min-width:768px){.tab{font-size:16px}.top h1{font-size:24px}.top.hero h1{font-size:42px}}
@media print{.tabs,.filters,.more,.foot,.hs,.lk{display:none}body{background:#fff}.top,.top.hero{background:#fff;color:#111;border-bottom:2px solid #111}.top a{color:#111}.top.hero .top-in{padding:0 0 8px}.top.hero .stats span{border-color:#999;background:#fff}.wk,.td,.pl a,.mtg-card,.dg,.sum,.tl .box{box-shadow:none;border:1px solid #bbb}}
`;
const CSSV = crypto.createHash('md5').update(CSS).digest('hex').slice(0, 8);
write('style.css', CSS);

const TYPE_LABEL = { internal: '社内', external: '社外', kowa: '講話' };
const badge = (t) => `<span class="badge b-${t}">${TYPE_LABEL[t] || t}</span>`;
function page({ title, h1, sub, body, script, up = '', back = true, extraHead = '', backHref = 'index.html', backText = '← 一覧へ' }) {
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="${up}favicon.svg">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${up}style.css?v=${CSSV}">${extraHead}
</head><body>
<header class="top${back ? '' : ' hero'}"><div class="top-in">${back ? `<a class="back" href="${up}${backHref}">${backText}</a>` : '<div class="eyebrow">FARMAN CO., LTD.</div>'}<h1>${h1}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div></header>
${body}
<a class="totop" href="#" aria-label="ページの上へ" onclick="scrollTo({top:0,behavior:'smooth'});return false">↑ 上へ</a>
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}
const allList = (label, rs, up = '') => `<details class="all"><summary>${label}（${rs.length}）</summary><ol>${rs.map(r => `<li><a href="${up}${r.file}">${r.date.replace(/-/g, '/')} ${esc(r.title)}</a></li>`).join('')}</ol></details>`;

/* ---- index.html ---- */
const cnt = { all: records.length, internal: records.filter(r => r.type === 'internal').length, external: records.filter(r => r.type === 'external').length, kowa: records.filter(r => r.type === 'kowa').length };
const pli = (p) => `<li data-n="${esc([p.name].concat(p.aliases).join(' '))}" data-c="${p.main_count}" data-m="${p.count}" data-l="${p.last || ''}" data-k="${esc(p.kana || p.name)}"><a href="partners/${p.slug}.html"><span class="nm">${esc(p.name)}</span><span class="ct">${p.main_count ? `会議 <b>${p.main_count}</b> 回・` : `話に出た ${p.count} 回・`}最後 ${md(p.last)}</span><span class="ar">→</span></a></li>`;
const partnerHtml = `<h3 class="ph">会議をした会社<span id="pc1">${partnerData.filter(p => p.main_count).length} 社</span></h3><ul class="pl" id="plist">${partnerData.filter(p => p.main_count).map(pli).join('')}</ul><h3 class="ph">ほかの会議で話に出ただけの会社<span id="pc2">${partnerData.filter(p => !p.main_count).length} 社</span></h3><ul class="pl pl-sub" id="plist2">${partnerData.filter(p => !p.main_count).map(pli).join('')}</ul><p class="empty" id="pnone" hidden>その名前の会社は見つかりません。短くして（例: イズミ）探してください。</p>`;
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pname = (x) => (x && (x.p && (x.p.name || x.p))) || '';
const cardOf = (r) => { const dt = new Date(r.date + 'T00:00:00Z'); const who = r.partners ? r.partners.filter(x => x.main).map(pname).filter(Boolean).slice(0, 2) : [];
  return `<a href="${r.file}" class="mtg-card t-${r.type}" data-type="${r.type}" data-month="${r.date.slice(0, 7)}"><div class="c-day"><b>${+r.date.slice(8, 10)}</b><span>${+r.date.slice(5, 7)}月・${WD[dt.getUTCDay()]}</span></div><div class="c-body"><div class="c-h">${badge(r.type)}${who.length ? `<span class="c-who">${who.map(esc).join('・')}</span>` : ''}</div><div class="c-t">${esc(r.title.replace(/^\d\d-\d\d\s*/, ''))}</div><div class="c-s">${esc(r.summary)}</div><div class="c-m">${r.type === 'kowa' ? '<span>講話</span>' : `<span class="k">決定 <b>${r.decisions.length}</b></span><span class="k">宿題 <b>${r.todos.length}</b></span>`}${r.dur ? `<span>録音 ${esc(r.dur)}</span>` : ''}</div></div></a>`; };
/* 会議一覧は月ごとにまとめる（2026-11-02 本人「会議一覧のページとか、ただずらっと並んでるだけで見にくくない？」） */
const byMonth = {};
records.forEach(r => { (byMonth[r.date.slice(0, 7)] = byMonth[r.date.slice(0, 7)] || []).push(r); });
const cardHtml = Object.keys(byMonth).sort().reverse().map(m => `<section class="mg" data-month="${m}"><h3 class="mg-h">${m.slice(0, 4)}年${+m.slice(5)}月<span class="mg-n">${byMonth[m].length} 件</span></h3><div class="card-grid">${byMonth[m].slice().sort((a, b) => b.date.localeCompare(a.date)).map(cardOf).join('\n')}</div></section>`).join('\n');
const months = Array.from(new Set(records.map(r => r.date.slice(0, 7)))).sort().reverse();
const DEFAULT_TAB = 'home';   // 2026-11-02 本人「トップページのUI/UX最悪じゃない？」→ 開いて最初は「ホーム」（最近の会議・期限の近い宿題・よく会う取引先）
/* ホーム: 最近の会議 6 本（決まったこと 3 つまで）・よく会う取引先 8 社。宿題は data/todos.json を読んで出す */
const recentHtml = records.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(r => `<a class="rc" href="${r.file}" data-date="${r.date}"><div class="rc-d"><b>${+r.date.slice(5, 7)}/${+r.date.slice(8, 10)}</b>${badge(r.type)}</div><div class="rc-t">${esc(r.title.replace(/^\d\d-\d\d\s*/, ''))}</div>${r.decisions.length ? `<ul>${r.decisions.slice(0, 3).map(d => `<li>${esc(d.txt)}</li>`).join('')}</ul>` : `<p class="rc-s">${esc(r.summary)}</p>`}<div class="rc-m">${r.type === 'kowa' ? '講話' : `決定 ${r.decisions.length}・宿題 ${r.todos.length}`}<span>開く →</span></div></a>`).join('');
const topPartnerHtml = partnerData.filter(p => p.main_count).sort((a, b) => b.main_count - a.main_count || String(b.last).localeCompare(String(a.last))).slice(0, 8).map(p => `<a class="tp" href="partners/${p.slug}.html">${esc(p.name)}<span>${p.main_count} 回</span></a>`).join('');

const indexBody = `<nav class="tabs" aria-label="入口"><div class="tabs-in" role="tablist">
<button class="tab" role="tab" id="t-home" aria-controls="p-home" aria-selected="false">ホーム</button>
<button class="tab" role="tab" id="t-todo" aria-controls="p-todo" aria-selected="false">宿題</button>
<button class="tab" role="tab" id="t-partner" aria-controls="p-partner" aria-selected="false">取引先<span class="n">${partnerData.length}</span></button>
<button class="tab" role="tab" id="t-list" aria-controls="p-list" aria-selected="false">会議一覧<span class="n">${records.length}</span></button>
</div></nav>
<main class="wrap">
<section id="p-home" role="tabpanel" aria-labelledby="t-home" hidden>
<div class="hm-h"><h2>最近の会議<small id="lastAgo"></small></h2><button type="button" class="lk" data-go="list">会議一覧へ →</button></div>
<div class="rcs">${recentHtml}</div>
<div class="hm-2">
<div class="pane"><div class="hm-h"><h2>宿題の期限</h2><button type="button" class="lk" data-go="todo">自分の名前で見る →</button></div><div id="dueBox"><p class="empty">読み込み中…</p></div></div>
<div class="pane"><div class="hm-h"><h2>よく会う取引先<small>（会議の回数の多い 8 社）</small></h2><button type="button" class="lk" data-go="partner">${partnerData.length} 社を全部見る →</button></div><div class="tps">${topPartnerHtml}</div>
<div class="hm-h sm"><h2>まとめて見る</h2></div><div class="qk"><a href="decisions.html"><b>決定の一覧</b><span>全部の会議で決まったことを新しい順に</span></a><a href="entity-index.html"><b>言葉の索引</b><span>社名・品目・人の名前から、出てくる会議を探す</span></a><a href="kowa-knowledge.html"><b>講話ナレッジ</b><span>講話・講演の録音の要点</span></a></div></div>
</div>
</section>
<section id="p-todo" role="tabpanel" aria-labelledby="t-todo" hidden>
<div class="lf"><div class="lf-row"><span class="lf-l">だれ</span><div class="seg" id="todoPeople"></div></div>
<div class="lf-row"><span class="lf-l">状態</span><div class="seg" id="segDone"><button type="button" data-v="0" aria-pressed="true">まだの物</button><button type="button" data-v="1" aria-pressed="false">済も出す</button></div></div>
<input type="checkbox" id="todoDone" hidden></div>
<h2 class="tdh" id="todoHead"></h2>
<div id="todoList"></div><button class="more" id="todoMore" hidden style="display:none">もっと見る</button>
<p class="note" id="todoNote">読み込み中…</p>
</section>
<section id="p-partner" role="tabpanel" aria-labelledby="t-partner" hidden>
<div class="lf"><div class="lf-row"><input class="sbox" id="pq" type="search" placeholder="社名でしぼる（例: イズミ）" aria-label="社名でしぼる"></div>
<div class="lf-row"><span class="lf-l">並び</span><div class="seg" id="psort"><button type="button" data-v="c" aria-pressed="true">会議の多い順</button><button type="button" data-v="l" aria-pressed="false">最近会った順</button><button type="button" data-v="k" aria-pressed="false">名前の順</button></div></div></div>
<p class="note">社名を押すと、その会社との会議の年表（新しい順）が開きます。</p>
${partnerHtml}
</section>
<section id="p-list" role="tabpanel" aria-labelledby="t-list" hidden>
<div class="lf">
<div class="lf-row"><input class="sbox" id="q" type="search" placeholder="題・本文・社名・言葉で探す（例: ニンニク、イズミフーズ）" aria-label="検索"><span class="filter-count"><b id="count">${records.length}件表示中</b></span></div>
<div class="lf-row"><span class="lf-l">種類</span><div class="seg" id="segT"><button type="button" data-v="all" aria-pressed="true">すべて <i>${cnt.all}</i></button><button type="button" data-v="internal" aria-pressed="false">社内 <i>${cnt.internal}</i></button><button type="button" data-v="external" aria-pressed="false">社外 <i>${cnt.external}</i></button><button type="button" data-v="kowa" aria-pressed="false">講話 <i>${cnt.kowa}</i></button></div></div>
<div class="lf-row"><span class="lf-l">月</span><div class="seg scroll" id="segM"><button type="button" data-v="all" aria-pressed="true">すべて</button>${months.map(m => `<button type="button" data-v="${m}" aria-pressed="false">${m.slice(2, 4)}年${+m.slice(5)}月 <i>${byMonth[m].length}</i></button>`).join('')}</div></div>
<select class="sel" id="ft" aria-label="種類" hidden><option value="all">すべて</option><option value="internal">社内</option><option value="external">社外</option><option value="kowa">講話</option></select>
<select class="sel" id="fm" aria-label="月" hidden><option value="all">すべての月</option>${months.map(m => `<option value="${m}">${+m.slice(5)}月</option>`).join('')}</select>
</div>
<p class="note" id="qNote" hidden></p>
<div id="cardGrid">
${cardHtml}
</div>
<p class="empty" id="noHit" hidden>当てはまる会議がありません。言葉を短くするか、種類・月を「すべて」に戻してください。</p>
</section>
</main>
`;

const indexScript = `(function(){
var TABS=['home','todo','partner','list'],DEF='${DEFAULT_TAB}',STAFF=${jsonEmbed(STAFF_TABS)};
function $(id){return document.getElementById(id)}
function show(t,push){if(t==='week')t='home';if(TABS.indexOf(t)<0)t=DEF;document.body.setAttribute('data-tab',t);TABS.forEach(function(x){$('p-'+x).hidden=x!==t;$('t-'+x).setAttribute('aria-selected',x===t?'true':'false')});if(push&&history.replaceState)history.replaceState(null,'',location.pathname+location.search+'#'+t);if(t==='todo'||t==='home')loadTodos();}
TABS.forEach(function(x){$('t-'+x).onclick=function(){show(x,true)}});
(function(){var f=document.querySelector('.rc');if(!f)return;var d=f.getAttribute('data-date'),n=Math.round((new Date().setHours(0,0,0,0)-new Date(d+'T00:00:00'))/864e5);$('lastAgo').textContent='（いちばん新しい会議は '+(+d.slice(5,7))+'/'+(+d.slice(8))+'・'+(n<=0?'今日':n+' 日前')+'）';})();
[].forEach.call(document.querySelectorAll('[data-go]'),function(b){b.onclick=function(){show(b.getAttribute('data-go'),true);scrollTo(0,0)}});
/* 表紙: 検索欄に打つと「全部の会議」で探す・数字のカードを押すと種類でしぼる */
$('hq').oninput=function(){$('q').value=this.value;$('ft').value='all';$('fm').value='all';show('list',true);search();};
[].forEach.call(document.querySelectorAll('.stats [data-type]'),function(b){b.onclick=function(){$('ft').value=b.getAttribute('data-type');$('fm').value='all';$('q').value='';$('hq').value='';hitSet=null;$('qNote').hidden=true;show('list',true);filt();var g=$('p-list');if(g.scrollIntoView)g.scrollIntoView({behavior:'smooth'})}});
/* 宿題: data/todos.json を 1 回だけ読む（ホームの「期限が近い宿題」と宿題のタブで使う） */
var TD=null,who=null,lim=50,P=null;function jd(o){return new Date(Date.now()+(o||0)+324e5).toISOString().slice(0,10)}
function normTD(){var M={},order=[];function put(t,ks){var k=(t.title||'')+'|'+(t.page||t.meeting||'');var x=M[k];if(!x){x=M[k]={t:t,who:[],done:true};order.push(k)}ks.forEach(function(n){if(n&&x.who.indexOf(n)<0)x.who.push(n)});if(!t.done)x.done=false;if(!x.t.asana_url&&t.asana_url)x.t=t}
Object.keys(TD.people||{}).forEach(function(k){TD.people[k].forEach(function(t){put(t,[k].concat(t.assignees||[],t['with']||[]))})});(TD.multi||[]).forEach(function(t){put(t,(t.assignees||[]).concat(t['with']||[]))});
var P2={};order.forEach(function(k){var x=M[k];x.who.forEach(function(n){var o={};for(var a in x.t)o[a]=x.t[a];o.done=x.done;o['with']=x.who.filter(function(m){return m!==n});(P2[n]=P2[n]||[]).push(o)})});TD.people=P2;TD.multi=[];}
function loadTodos(){if(!P)P=fetch('data/todos.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw r.status;return r.json()}).then(function(j){TD=j;normTD();renderPeople();renderDue()}).catch(function(e){$('todoNote').textContent='宿題の一覧（data/todos.json）を読めませんでした（'+e+'）。';$('dueBox').innerHTML='<p class="empty">宿題の一覧を読めませんでした</p>';});return P;}
function renderDue(){var today=jd(0),lim14=jd(14*864e5),from30=jd(-30*864e5),seen={},a=[],none=0,old=0;
function add(k,list){(list||[]).forEach(function(t){if(!t.done&&t.due&&t.due<from30&&k){old++;return}if(t.done||!t.due||t.due>lim14||t.due<from30)return;if(!k){none++;return}var key=(t.title||'')+'|'+t.due;if(seen[key]){if(seen[key].who.indexOf(k)<0)seen[key].who.push(k);return}var x={t:t,who:[k]};seen[key]=x;a.push(x)})}
Object.keys(TD.people||{}).forEach(function(k){add(k,TD.people[k])});(TD.multi||[]).forEach(function(t){add((t.who||t['with']||[]).join&&(t.who||t['with']).join('・')||'複数人',[t])});add('',TD.unassigned);
a.sort(function(x,y){return x.t.due<y.t.due?-1:x.t.due>y.t.due?1:0});
var soon=a.filter(function(x){return x.t.due>=today}),late=a.filter(function(x){return x.t.due<today}).reverse();
function rows(list,n){return list.slice(0,n).map(function(x){var t=x.t,lt=t.due<today,href=e(t.page)+(t.anchor?'#'+e(t.anchor):'');return '<li><span class="du'+(lt?' late':'')+'">'+(+t.due.slice(5,7))+'/'+(+t.due.slice(8))+'</span><span class="dw">'+e(x.who.join('・'))+'</span>'+(t.page?'<a href="'+href+'">'+e(t.title)+'</a>':'<span>'+e(t.title)+'</span>')+'</li>'}).join('')}
var h='<h3 class="dh">これから 2 週間<span>'+soon.length+' 件</span></h3>'+(soon.length?'<ul class="dl">'+rows(soon,5)+'</ul>':'<p class="empty">この 2 週間に期限の来る宿題はありません</p>');
h+='<h3 class="dh late">期限が過ぎた（この 30 日）<span>'+late.length+' 件</span></h3>'+(late.length?'<ul class="dl">'+rows(late,5)+'</ul>':'<p class="empty">ありません</p>');
if(soon.length>5||late.length>5||none||old)h+='<p class="dm">'+(soon.length+late.length>10?'ほかは「宿題」のタブで名前ごとに見られます。':'')+(old?'30 日より前に期限が過ぎたままの宿題がほか '+old+' 件あります。':'')+(none?'期限が近い・過ぎた宿題のうち、担当の決まっていない物が '+none+' 件（担当未定は全部で '+(TD.unassigned||[]).filter(function(t){return !t.external}).length+' 件。「宿題」のタブの「担当未定」）。':'')+'</p>';
$('dueBox').innerHTML=h;}
function open(a){return a.filter(function(t){return !t.done}).length}
function renderPeople(){var p=TD.people||{},keys=STAFF.filter(function(k){return p[k]}).concat(Object.keys(p).filter(function(k){return STAFF.indexOf(k)<0}));
var src=TD.source==='asana'?'Asana から':'会議ページから仮に作った一覧（済かどうかは分かりません。Asana の取り込みが動くと Asana の済/未に変わります）';
$('todoNote').textContent=src+'・'+(TD.generated||'').slice(0,16).replace('T',' ')+' 時点。済にするのは Asana で（次の朝にここへ映ります）。「担当未定」は社内の会議で担当の決まっていない物（よその会社の宿題は出しません）。';
var box=$('todoPeople');box.innerHTML='';function chip(k,list,red){var b=document.createElement('button');b.className=(red?'red':'');b.type='button';b.setAttribute('aria-pressed','false');b.innerHTML=k+'<span class="n">'+open(list)+'</span>';b.onclick=function(){who=k;lim=50;try{localStorage.setItem('todoWho',k)}catch(_){}[].forEach.call(box.children,function(c){c.setAttribute('aria-pressed',c===b?'true':'false')});renderList()};box.appendChild(b);return b}
var first=null;keys.forEach(function(k){var b=chip(k,p[k]);if(!first&&open(p[k]))first=b});if((TD.multi||[]).length)chip('複数人',TD.multi);var un=(TD.unassigned||[]).filter(function(t){return !t.external}),ux=(TD.unassigned||[]).filter(function(t){return t.external});chip('担当未定',un,true);var pref=new URLSearchParams(location.search).get('who');try{pref=pref||localStorage.getItem('todoWho')}catch(_){}var pb=[].filter.call(box.children,function(c){return c.firstChild&&c.firstChild.nodeValue===pref})[0];(pb||first||box.firstChild).click();}
function listOf(k){return k==='担当未定'?(TD.unassigned||[]).filter(function(t){return !t.external}):k==='複数人'?(TD.multi||[]):((TD.people||{})[k]||[])}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function renderList(){var all=$('todoDone').checked,today=jd(0),wk=jd(7*864e5);
var a=listOf(who).filter(function(t){return all||!t.done});
var G=[['late','期限が過ぎた',function(t){return !t.done&&t.due&&t.due<today}],['week','この 7 日',function(t){return !t.done&&t.due&&t.due>=today&&t.due<=wk}],['later','8 日より先',function(t){return !t.done&&t.due&&t.due>wk}],['none','期限なし',function(t){return !t.done&&!t.due}],['done','済',function(t){return t.done}]];
var open_=a.filter(function(t){return !t.done}).length;
$('todoHead').innerHTML=(who==='担当未定'||who==='複数人'?e(who)+'の宿題':e(who)+' さんの宿題')+'<span>まだ '+open_+' 件'+(all?'・済 '+(a.length-open_)+' 件':'')+'</span>';
function row(t){var late=!t.done&&t.due&&t.due<today,href=e(t.page)+(t.anchor?'#'+e(t.anchor):'');
return '<li class="'+(t.done?'done':'')+'"><div class="tt">'+e(String(t.title).replace(/[（(]\s*Speaker\s*\d+\s*[)）]/gi,''))+'</div><div class="tm">'+(t.due?'<span class="tdue'+(late?' late':'')+'">期限 '+(+t.due.slice(5,7))+'/'+(+t.due.slice(8))+'</span>':'')+(t['with']&&t['with'].length?'<span>一緒に: '+e(t['with'].join('・'))+'</span>':'')+(t.page?'<a class="tmeet" href="'+href+'">'+e(t.meeting||t.page)+' の議事録</a>':(t.meeting?'<span>'+e(t.meeting)+'</span>':''))+(t.asana_url?'<a class="tas" href="'+e(t.asana_url)+'" target="_blank" rel="noopener">Asana で開く</a>':'')+'</div></li>'}
var h='',shown=0;G.forEach(function(g){var l=a.filter(g[2]);if(!l.length)return;l.sort(function(x,y){if(x.due&&y.due)return x.due<y.due?-1:x.due>y.due?1:0;return (y.date||'')<(x.date||'')?-1:1});if(g[0]==='late')l.reverse();
var body='<ul class="td">'+l.map(row).join('')+'</ul>';
h+=(g[0]==='none'||g[0]==='done')?'<details class="tg tg-'+g[0]+'"'+(a.length===l.length?' open':'')+'><summary>'+g[1]+'<span>'+l.length+' 件</span></summary>'+body+'</details>':'<section class="tg tg-'+g[0]+'"><h3>'+g[1]+'<span>'+l.length+' 件</span></h3>'+body+'</section>';shown+=l.length});
$('todoList').innerHTML=h||'<p class="empty">ありません</p>';$('todoMore').hidden=true;}
[].forEach.call($('segDone').children,function(b){b.onclick=function(){$('todoDone').checked=b.getAttribute('data-v')==='1';[].forEach.call($('segDone').children,function(c){c.setAttribute('aria-pressed',c===b?'true':'false')});if(who)renderList()}});
$('todoMore').onclick=function(){lim+=100;renderList()};$('todoDone').onchange=function(){if(who)renderList()};
/* 取引先のしぼり込み */
$('pq').oninput=function(){var q=this.value.trim().toLowerCase(),tot=0;['plist','plist2'].forEach(function(id,i){var n=0;[].forEach.call($(id).children,function(li){li.hidden=!!q&&li.dataset.n.toLowerCase().indexOf(q)<0;if(!li.hidden)n++});$('pc'+(i+1)).textContent=n+' 社';tot+=n});$('pnone').hidden=tot>0};
[].forEach.call($('psort').children,function(b){b.onclick=function(){var v=b.getAttribute('data-v');[].forEach.call($('psort').children,function(c){c.setAttribute('aria-pressed',c===b?'true':'false')});['plist','plist2'].forEach(function(id){var ul=$(id),a=[].slice.call(ul.children);a.sort(function(x,y){if(v==='c')return (+y.dataset.c-+x.dataset.c)||(+y.dataset.m-+x.dataset.m);if(v==='l')return y.dataset.l<x.dataset.l?-1:y.dataset.l>x.dataset.l?1:0;return x.dataset.k.localeCompare(y.dataset.k,'ja')});a.forEach(function(li){ul.appendChild(li)})})}});
/* 一覧: 種類・月・検索。本文の検索は検索欄を使った時だけ search-index.json を読む */
var cards=[].slice.call(document.querySelectorAll('#cardGrid .mtg-card')),SI=null,loading=false,hitSet=null;
function filt(){var t=$('ft').value,m=$('fm').value,q=$('q').value.trim().toLowerCase(),n=0;
cards.forEach(function(c){var ok=(t==='all'||c.dataset.type===t)&&(m==='all'||c.dataset.month===m);if(ok&&q){var f=c.getAttribute('href'),tx=c.textContent.toLowerCase();ok=q.split(/\s+/).every(function(w){return tx.indexOf(w)>=0})||!!(hitSet&&hitSet[f]);}c.hidden=!ok;if(ok)n++});
var mc={},ma=0;cards.forEach(function(c){var ok=(t==='all'||c.dataset.type===t);if(ok&&q){var tx=c.textContent.toLowerCase();ok=q.split(/\s+/).every(function(w){return tx.indexOf(w)>=0})||!!(hitSet&&hitSet[c.getAttribute('href')])}if(ok){mc[c.dataset.month]=(mc[c.dataset.month]||0)+1;ma++}});[].forEach.call($('segM').children,function(b){var v=b.getAttribute('data-v'),i=b.querySelector('i');if(i)i.textContent=v==='all'?ma:(mc[v]||0);b.disabled=v!=='all'&&!mc[v]});
[].forEach.call(document.querySelectorAll('#cardGrid .mg'),function(g){var k=g.querySelectorAll('.mtg-card:not([hidden])').length;g.hidden=!k;g.querySelector('.mg-n').textContent=k+' 件'});
$('noHit').hidden=n>0;syncSeg();
$('count').textContent=n+'件表示中';}
function syncSeg(){[['segT','ft'],['segM','fm']].forEach(function(x){[].forEach.call($(x[0]).children,function(b){b.setAttribute('aria-pressed',b.getAttribute('data-v')===$(x[1]).value?'true':'false')})})}
[['segT','ft'],['segM','fm']].forEach(function(x){[].forEach.call($(x[0]).children,function(b){b.onclick=function(){$(x[1]).value=b.getAttribute('data-v');filt()}})});
function search(){var q=$('q').value.trim().toLowerCase(),qn=$('qNote');if(!q){hitSet=null;qn.hidden=true;filt();return}
if(!SI){if(!loading){loading=true;qn.hidden=false;qn.textContent='本文も検索しています…';fetch('search-index.json').then(function(r){return r.json()}).then(function(j){SI=j;search()}).catch(function(){qn.textContent='本文の検索を読めませんでした。題と要約だけで探しています。'})}filt();return}
hitSet={};SI.forEach(function(r){var s=(r.title+' '+(r.tags||[]).join(' ')+' '+r.text).toLowerCase();if(q.split(/\s+/).every(function(w){return s.indexOf(w)>=0}))hitSet[r.file]=1});qn.hidden=false;qn.textContent='題・要約・本文から探しています';filt();}
$('ft').onchange=filt;$('fm').onchange=filt;$('q').oninput=search;
/* 前の URL（?filter=・?q=）をそのまま使えるように */
var sp=new URLSearchParams(location.search),f=sp.get('filter'),q=sp.get('q'),h=location.hash.slice(1);
if(f&&/^(internal|external|kowa)$/.test(f)){$('ft').value=f;filt();h='list'}
if(q){$('q').value=q;search();h='list'}
show(h||DEF,false);
window.addEventListener('hashchange',function(){var x=location.hash.slice(1);if(x)show(x,false)});
})();`;
const statsHtml = `<div class="hs"><input id="hq" type="search" placeholder="会議・社名・言葉で探す（例: ニンニク、イズミフーズ）" aria-label="会議を探す" autocomplete="off"></div><div class="stats"><button type="button" data-type="all"><strong data-count="${cnt.all}">${cnt.all}</strong> 全部</button><button type="button" data-type="internal"><strong data-count="${cnt.internal}">${cnt.internal}</strong> 社内</button><button type="button" data-type="external"><strong data-count="${cnt.external}">${cnt.external}</strong> 社外</button><button type="button" data-type="kowa"><strong data-count="${cnt.kowa}">${cnt.kowa}</strong> 講話</button></div><div class="sh">数字を押すと、その種類の会議にしぼれます</div>`;
const indexHtml = page({ title: 'FARMAN 議事録', h1: 'FARMAN 議事録', back: false, body: indexBody, script: indexScript }).replace('<h1>FARMAN 議事録</h1>', '<h1>FARMAN 議事録</h1><div class="lead">会議で決まったこと・宿題・取引先との流れ</div>' + statsHtml);
const sizes = {};
sizes['index.html'] = write('index.html', indexHtml);

/* ---- partners/<slug>.html ---- */
const usedSlug = new Set();
for (const p of partnerData) {
  if (usedSlug.has(p.slug)) throw new Error('取引先の URL の名前が重複: ' + p.slug); usedSlug.add(p.slug);
  const lastMain = p.meetings.filter(m => m.main).slice(-1)[0];
  const openTodos = p.meetings.reduce((n, m) => n + m.todos.filter(t => !t.done).length, 0);
  const items = p.meetings.slice().reverse().map(m => {
    const dl = m.decisions.length ? `<h4>決まったこと<span>${m.decisions.length} 件</span></h4><ul>${m.decisions.slice(0, 2).map(d => `<li>${esc(d)}</li>`).join('')}</ul>${m.decisions.length > 2 ? `<details><summary>ほか ${m.decisions.length - 2} 件を見る</summary><ul>${m.decisions.slice(2).map(d => `<li>${esc(d)}</li>`).join('')}</ul></details>` : ''}` : '';
    const trow = (t) => `<li>${t.done ? '<span class="dn">済</span>' : ''}${t.assignees.length ? `<span class="who">${esc(t.assignees.join('・'))}</span>` : ''}${esc(t.title)}${t.due ? ` <span class="due">期限 ${md(t.due)}</span>` : ''}</li>`;
    const tl = m.todos.length ? `<details class="tds"><summary>宿題 ${m.todos.length} 件</summary><ul>${m.todos.map(trow).join('')}</ul></details>` : '';
    const nx = m.next && !/決まっていない|記載なし|不明/.test(m.next) ? `<h4>次回</h4><ul><li>${esc(m.next)}</li></ul>` : '';
    const box = dl || tl || nx ? `<div class="box">${dl}${tl}${nx}</div>` : (m.main ? '' : '<div class="ment-n">この会議の中で名前が話に出た（この会社の名前が入った決定・宿題はない）</div>');
    return `<li class="${m.main ? 'main' : 'ment'}"><div class="when">${m.date.replace(/-/g, '/')} ${badge(m.type)}${m.main ? '' : ' <span class="badge b-gray">話に出た</span>'}</div><div class="ttl"><a href="../${m.file}">${esc(m.title)}</a></div>${box}</li>`;
  }).join('\n');
  const sum = `<div class="sum">会議 ${p.main_count} 回${p.count > p.main_count ? `・ほかの会議で話に出た ${p.count - p.main_count} 回` : ''}。${lastMain ? `最後の会議は <a href="../${lastMain.file}">${md(lastMain.date)} ${esc(lastMain.title.replace(/^\d{1,2}[-/]\d{1,2}\s*/, ''))}</a>。` : ''}この年表の宿題 <span class="nw">${openTodos} 件</span>${p.aliases.length ? `<br><span class="note">ほかの書き方: ${esc(p.aliases.join('・'))}</span>` : ''}</div>`;
  const body = `<main class="wrap">${sum}<ol class="tl">${items}</ol><p class="note">新しい順。●＝その会社との会議／○＝ほかの会議で話に出た（その会社の名前がある決定・宿題だけ）。</p></main>`;
  write(`partners/${p.slug}.html`, page({ title: `${p.name} の年表`, h1: `${esc(p.name)} の年表`, body, up: '../', backHref: 'index.html#partner', backText: '← 取引先の一覧へ' }));
}
// 前回あって今回無い年表は消す（社名の表から外した物のリンク切れを残さない）
for (const f of fs.readdirSync(PDIR)) if (/\.html$/.test(f) && !usedSlug.has(f.replace(/\.html$/, ''))) fs.unlinkSync(path.join(PDIR, f));

/* ---- decisions.html（軽い描画・中身は data/decisions.json） ---- */
{
  const totalD = decisionsData.reduce((s, r) => s + r.items.length, 0);
  const body = `<main class="wrap">
<div class="lf"><div class="lf-row"><input class="sbox" id="q" type="search" placeholder="決まったことを探す（例: 単価、ニンニク、イズミ）" aria-label="検索"><span class="filter-count"><b id="cnt">${totalD}件の決定</b></span></div>
<div class="lf-row"><span class="lf-l">種類</span><div class="seg" id="segT"><button type="button" data-v="all" aria-pressed="true">すべて</button><button type="button" data-v="internal" aria-pressed="false">社内</button><button type="button" data-v="external" aria-pressed="false">社外</button></div></div>
<select class="sel" id="ft" hidden><option value="all">すべて</option><option value="internal">社内</option><option value="external">社外</option></select></div>
<div id="list"><p class="empty">読み込み中…</p></div><button class="more" id="more" hidden>もっと見る</button>
</main>`;
  const script = `(function(){var D=[],lim=15;function $(i){return document.getElementById(i)}
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function hl(s,q){s=e(s);if(!q)return s;var i=s.toLowerCase().indexOf(e(q).toLowerCase());return i<0?s:s.slice(0,i)+'<mark>'+s.slice(i,i+e(q).length)+'</mark>'+s.slice(i+e(q).length)}
var L={internal:'社内',external:'社外',kowa:'講話'};
function draw(){var t=$('ft').value,q=$('q').value.trim().toLowerCase(),n=0,g=[];
D.forEach(function(r){if(t!=='all'&&r.type!==t)return;var it=r.items.filter(function(d){var s=(r.title+' '+d.ctx+' '+d.txt).toLowerCase();return !q||q.split(/\s+/).every(function(w){return s.indexOf(w)>=0})});if(!it.length)return;n+=it.length;g.push([r,it])});
$('cnt').textContent=n+'件の決定（'+g.length+' 会議）';var pm='';$('list').innerHTML=g.slice(0,lim).map(function(x){var r=x[0],mh='';if(r.date.slice(0,7)!==pm){pm=r.date.slice(0,7);mh='<h3 class="mg-h">'+pm.slice(0,4)+'年'+(+pm.slice(5))+'月</h3>'}return mh+'<section class="dg"><h3><a href="'+r.file+'"><span class="d">'+r.date.replace(/-/g,'/')+'</span>'+e(r.title)+'</a> <span class="badge b-'+r.type+'">'+L[r.type]+'</span></h3><ul>'+x[1].map(function(d){return '<li>'+(d.ctx?'<span class="ctx">'+e(d.ctx)+'</span>':'')+hl(d.txt,q)+'</li>'}).join('')+'</ul></section>'}).join('')||'<p class="empty">該当なし</p>';
var m=$('more');if(!full){$('cnt').textContent='新しい '+g.length+' 会議（全部は ${decisionsData.length} 会議）';m.hidden=false;m.textContent='前の会議も出す（全部）';return}m.hidden=g.length<=lim;m.textContent='もっと見る（残り '+(g.length-lim)+' 会議）';}
var q=new URLSearchParams(location.search).get('q');if(q)$('q').value=q;
var full=false;function load(u,cb){fetch(u).then(function(r){return r.json()}).then(function(j){D=j.sort(function(a,b){return a.date<b.date?1:-1});cb&&cb();draw()}).catch(function(){$('list').innerHTML='<p class="empty">'+u+' を読めませんでした。下の会議の一覧から開いてください。</p>'})}
function all(cb){if(full){cb();draw();return}full=true;$('cnt').textContent='読み込み中…';load('data/decisions.json',cb)}
$('more').onclick=function(){all(function(){lim+=30})};$('ft').onchange=function(){all(function(){lim=15})};$('q').oninput=function(){all(function(){lim=15})};
[].forEach.call($('segT').children,function(b){b.onclick=function(){$('ft').value=b.getAttribute('data-v');[].forEach.call($('segT').children,function(c){c.setAttribute('aria-pressed',c===b?'true':'false')});all(function(){lim=30})}});
lim=30;all(function(){})})();`;
  sizes['decisions.html'] = write('decisions.html', page({ title: '決定の一覧 — FARMAN 議事録', h1: '決定の一覧', sub: `${decisionsData.length} 会議・${totalD} 件（新しい順）`, body, script }));
}

/* ---- entity-index.html（取引先と言葉の索引・中身は data/entities.json） ---- */
{
  const body = `<main class="wrap">
<div class="lf"><div class="lf-row"><input class="sbox" id="q" type="search" placeholder="人・会社・品目・言葉を入れる（例: 浅川、JAS、ドローン）" aria-label="人・会社・言葉"><span class="filter-count"><b id="cnt"></b></span></div>
<div class="lf-row"><span class="lf-l">よく出る</span><div class="seg" id="top" style="flex-wrap:wrap"></div></div></div>
<p class="note">言葉を入れるか、上のボタンを押すと、その言葉が出た会議が新しい順に並びます。取引先ごとの流れは <a href="index.html#partner">取引先</a> から。</p>
<div id="res"></div>
</main>`;
  const script = `(function(){var E=null,ld=false;function $(i){return document.getElementById(i)}
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var L={internal:'社内',external:'社外',kowa:'講話'};
function run(){var q=$('q').value.trim().toLowerCase();if(!q){$('res').innerHTML='';$('cnt').textContent='';return}
if(!E){if(!ld){ld=true;$('res').innerHTML='<p class="note">読み込み中…</p>';fetch('data/entities.json').then(function(r){return r.json()}).then(function(j){E=j;run()}).catch(function(){$('res').innerHTML='<p class="empty">data/entities.json を読めませんでした</p>'})}return}
var ks=Object.keys(E.tags).filter(function(k){return k.toLowerCase().indexOf(q)>=0}).sort(function(a,b){return E.tags[b].length-E.tags[a].length}).slice(0,40);
$('cnt').textContent=ks.length+'語';
$('res').innerHTML=ks.map(function(k){return '<section class="dg"><h3>'+e(k)+' <span class="badge b-gray">'+E.tags[k].length+'</span></h3><ul>'+E.tags[k].map(function(i){return E.files[i]}).sort(function(a,b){return a.d<b.d?1:-1}).map(function(f){return '<li><a href="'+f.f+'">'+f.d.replace(/-/g,'/')+' '+e(f.t)+'</a> <span class="badge b-'+f.ty+'">'+L[f.ty]+'</span></li>'}).join('')+'</ul></section>'}).join('')||'<p class="empty">該当なし</p>';}
$('q').oninput=run;var q=new URLSearchParams(location.search).get('q');var SELF=${JSON.stringify(STAFF.concat(['ファーマン', 'FARMAN', '瀬戸山', '井上']))};
fetch('data/entities.json').then(function(r){return r.json()}).then(function(j){E=j;ld=true;$('top').innerHTML=Object.keys(E.tags).filter(function(k){return k.length>1&&SELF.indexOf(k)<0}).sort(function(a,b){return E.tags[b].length-E.tags[a].length}).slice(0,24).map(function(k){return '<button type="button" data-k="'+e(k)+'" aria-pressed="false">'+e(k)+' <i>'+E.tags[k].length+'</i></button>'}).join('');[].forEach.call($('top').children,function(b){b.onclick=function(){$('q').value=b.getAttribute('data-k');run();scrollTo({top:$('res').offsetTop-80,behavior:'smooth'})}});if(q){$('q').value=q;run()}});})();`;
  sizes['entity-index.html'] = write('entity-index.html', page({ title: '言葉の索引 — FARMAN 議事録', h1: '言葉の索引', sub: `人・会社・品目・言葉から、出てくる会議を探す（会議 ${records.length} 本）`, body, script }));
}

/* ---- 報告 ---- */
const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log(`gen-aux: 会議 ${records.length} 本（社内 ${cnt.internal}・社外 ${cnt.external}・講話 ${cnt.kowa}）`);
console.log(`  決定 ${decisionsData.reduce((s, r) => s + r.items.length, 0)} 件・宿題 ${allTodos.length} 件・取引先 ${partnerData.length} 社`);
console.log(`  index ${kb(sizes['index.html'])}・decisions ${kb(sizes['decisions.html'])}・entity-index ${kb(sizes['entity-index.html'])}`);
console.log(`  表記ゆれ: ${rulesNote}`);
console.log(`  ${todoNote}`);
if (warn.length) console.log('  注意:\n   - ' + warn.join('\n   - '));
