#!/usr/bin/env node
'use strict';
/**
 * plaud-html 生成物の自己監査
 *
 *   node audit.js <work_dir> [対象.html ...] [--all]
 *
 * 設計方針:
 *  - アセットのバージョン（enhance.css?v=N 等）はハードコードせず、全ページの
 *    「最頻値」を正とし、そこから外れたページだけを異常として報告する（将来v上げで壊れない）
 *  - コードフェンス等の誤検出を避け、DOM的な構造の整合だけを見る
 *
 * 【2026-07-29 改訂】常に全ページを検査し、結果を2段に分けて出す。
 *   ・今回対象（引数指定 or --all）→ **ゲート**。1件でもあれば exit 1（デプロイ禁止）
 *   ・それ以外の既存ページ         → **参考表示**。exit code には影響しない
 *   狙い: 積み残しを「見えているが止めない」状態にして、後から大量に湧くのを防ぐ。
 *   （2026-07-29 に --all 初実行で94件/45ページが一度に出た反省）
 *
 *   さらに category 'NAME'（固有名の表記ゆれ疑い）は**常に参考扱い**で、ゲートにしない。
 *   ヒューリスティックで誤検出しうるため（2026-07-28 に偽陽性27件を出した反省）。
 *
 * 【2026-10-29 改訂】ページの作りが新しくなったので、点検を新しい作りに合わせた（3 節）。
 *   ・見る物: site.css を読む・先頭の結論カード（講話で結論も宿題も無い物は除く）・宿題の行の id="todo-n"／data-todo・
 *     Google Fonts 無し・ページ内 <script> の中身無し・飾り（hero-particle・scroll-progress・reveal・noanim.js）無し
 *   ・止める: 📥 ダウンロードの単体 HTML（STANDALONE）・誤字（TYPO）・どの録音か分からない／載せない録音（PUB）・二重掲載・
 *     Highlights の写し（of_n_note:）・人の事情（PRIV）
 *   ・file_id が分からない既存の 28 本だけは NO_FILEID_OK（理由つき）で PUB を外す。新しく作るページは必ず meta が要る
 */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const ARGS = process.argv.slice(3);
const ALL_STRICT = ARGS.includes('--all');
const TARGETS = ARGS.filter(a => !a.startsWith('--'));
if (!DIR || !fs.existsSync(DIR)) {
  console.error('使い方: node audit.js <work_dir> [対象.html ...] [--all]');
  console.error('  対象を指定 : そのページをゲート判定（生成直後はこれを使う）。他は参考表示');
  console.error('  対象を省略 : 全件を検査し、すべて参考表示（exit 0。棚卸しの確認用）');
  console.error('  --all      : 全件をゲート判定（積み残しを本気で潰すとき）');
  process.exit(2);
}

const AUX = new Set(['index.html', 'decisions.html', 'entity-index.html', 'kowa-knowledge.html']);
/** 問題は「どのファイルの話か」を持たせて、後でゲート／参考に振り分ける */
const problems = [];   // { cat, msg, file }  file=null はサイト全体の問題（常にゲート）
const P = (cat, msg, file = null) => problems.push({ cat, msg, file });

const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const exists = f => fs.existsSync(path.join(DIR, f));

/**
 * ⚠️ 誤検出を防ぐためのヘルパー（2026-07-28: 空白の有無で17件の偽陽性を出した反省）
 *  - hasClass : class="a b c" の複数クラスに耐える
 *  - countClass : 同上でカウント
 *  - ruleHas  : 特定のCSSルールの中に、空白ゆらぎを無視してプロパティがあるか見る
 */
const hasClass   = (t, c) => new RegExp(`class="[^"]*\\b${c}\\b[^"]*"`).test(t);
const countClass = (t, c) => (t.match(new RegExp(`class="[^"]*\\b${c}\\b[^"]*"`, 'g')) || []).length;
const ruleHas = (t, selector, prop, value) => {
  const m = t.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*\\}`));
  if (!m) return null;                                   // ルール自体が無い
  const norm = m[0].replace(/\s+/g, '');                  // 空白を全部落として比較する
  return norm.includes(`${prop}:${value}`);
};

const allHtml = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
const details = allHtml.filter(f => !AUX.has(f));
/** ゲート対象（ここが0件でないとデプロイしない）。それ以外のページも検査はするが参考表示に回す */
const gated = ALL_STRICT ? details : TARGETS.map(t => path.basename(t));

for (const t of gated) if (!exists(t)) P('ARG', `指定されたファイルが存在しない: ${t}`);

/** ページのテーマ。⚠️ <style>には3種のバッジCSSが全部定義されているので class属性で判定する */
const themeOf = t => /class="badge-header-internal"/.test(t) ? 'green'
                   : /class="badge-header-kowa"/.test(t)     ? 'indigo' : 'amber';
/** テーマごとの「その色である」目印（CSS変数名と代表的なhex） */
const THEME_TOKENS = {
  amber:  ['--amber-', '#fbbf24', '#f59e0b'],
  green:  ['--green-', '#6ee7b7', '#34d399', '#52b788'],
  indigo: ['--indigo-', '#818cf8', '#a5b4fc'],
};
/** タグ・script・styleを落とした本文テキスト（entities の実在確認に使う） */
const bodyText = t => t
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

// ─────────────────────────────────────────────────────────────
// 1. index.html の整合
// ─────────────────────────────────────────────────────────────
let index = '';
if (!exists('index.html')) P('INDEX', 'index.html が無い');
else {
  index = read('index.html');
  const cards = (index.match(/class="mtg-card/g) || []).length;
  const ints  = (index.match(/data-type="internal"/g) || []).length;
  const exts  = (index.match(/data-type="external"/g) || []).length;
  const kowas = (index.match(/data-type="kowa"/g) || []).length;

  if (cards !== ints + exts + kowas)
    P('INDEX', `カード数(${cards}) != 内訳合計(社内${ints}+社外${exts}+講話${kowas})`);

  const counts = [...index.matchAll(/data-count="(\d+)"/g)].map(m => Number(m[1]));
  if (counts.length !== 4) P('INDEX', `data-count が4箇所でない(${counts.length}箇所)`);
  else {
    const [tot, i, e, k] = counts;
    if (tot !== cards) P('INDEX', `data-count 全件(${tot}) != 実カード数(${cards})`);
    if (i !== ints)    P('INDEX', `data-count 社内(${i}) != 実(${ints})`);
    if (e !== exts)    P('INDEX', `data-count 社外(${e}) != 実(${exts})`);
    if (k !== kowas)   P('INDEX', `data-count 講話(${k}) != 実(${kowas})`);
  }

  const fc = (index.match(/id="count">(\d+)件表示中/) || [, null])[1];
  if (fc === null) P('INDEX', 'filter-count(件表示中)が見つからない');
  else if (Number(fc) !== cards) P('INDEX', `filter-count(${fc}) != 実カード数(${cards})`);

  const hrefs = [...index.matchAll(/<a href="([^"]+\.html)" class="mtg-card/g)].map(m => m[1]);
  for (const h of hrefs) if (!exists(h)) P('INDEX', `カードのリンク先が存在しない: ${h}`);
  for (const f of details) if (!hrefs.includes(f)) P('INDEX', `indexに載っていない孤立HTML: ${f}`);
}

// ─────────────────────────────────────────────────────────────
// 2. 共通の見た目・動きのファイルと版の整合（最頻値を正とする）
//   site.css＝全ページの共通の見た目（2026-10-29〜）。enhance.css/enhance.js/edit-mode.js は今まで通り。
// ─────────────────────────────────────────────────────────────
const assetRe = { 'site.css': /site\.css\?v=(\w+)/, 'enhance.css': /enhance\.css\?v=(\d+)/, 'enhance.js': /enhance\.js\?v=(\d+)/, 'edit-mode.js': /edit-mode\.js\?v=(\d+)/ };
const expected = {};
for (const [asset, re] of Object.entries(assetRe)) {
  const tally = {};
  for (const f of details) {
    const m = read(f).match(re);
    if (m) tally[m[1]] = (tally[m[1]] || 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  if (top) expected[asset] = top[0];
  if (!exists(asset)) P("ASSET", `${asset} が work_dir に無い（全ページが参照している）`);
}
// site.css の中身: 「一覧に戻る」が折り返さない・Google Fonts を読まない（共通の見た目はここ 1 本）
if (exists("site.css")) {
  const css = read("site.css");
  const nowrap = ruleHas(css, ".back-link", "white-space", "nowrap");
  if (nowrap === null) P("ASSET", "site.css に .back-link のルールが無い");
  else if (!nowrap) P("ASSET", "site.css の .back-link に white-space:nowrap が無い（「一覧に戻る」が折り返す）");
  if (/fonts\.(googleapis|gstatic)\.com/.test(css)) P("ASSET", "site.css が Google Fonts を読んでいる（既定の日本語の字にする）");
}
/** 横断ページ・data/*.json は大きいので 1 回だけ読む */
const _cache = {};
const readCached = f => (_cache[f] ??= read(f));

// ─────────────────────────────────────────────────────────────
// 2.5 固有名の語彙（NAMEチェック用）
//   全ページの meta entities を集める（空白・読点区切り＝トークン化済み）。
//   本文を正規表現で切ると語の断片を拾うため、比較相手は必ずこの語彙に限定する。
// ─────────────────────────────────────────────────────────────
const VOCAB = new Set();
for (const f of details) {
  const m = read(f).match(/<meta name="entities" content="([^"]*)"/);
  if (m) m[1].split(",").map(s => s.trim()).filter(s => s.length > 2).forEach(s => VOCAB.add(s));
}

// ─────────────────────────────────────────────────────────────
// 3. 各詳細ページ（2026-10-29 の新しい作り）
//   新しい作り = 共通の site.css を <link> で読む・先頭に結論カード（.concl-card）・宿題の行に id="todo-n"・
//   下の一覧（.action-item）に data-todo="n"・飾り（hero-particle・scroll-progress・reveal・noanim.js）無し・
//   Google Fonts 無し・ページ内 <script> の中身無し（動きは enhance.js・edit-mode.js だけ）。
//   ページに残してよい <style> は「そのページだけの図の形」だけ（共通の見た目は site.css）。
// ─────────────────────────────────────────────────────────────
// ⚠️ class 属性で見る（📥 の単体 HTML は CSS に .badge-header-kowa の定義を埋め込んでいるので、文字だけで見ると講話と取り違える）
const isKowaPage = t => /class="[^"]*\bbadge-header-kowa\b/.test(t) || /<meta name="kowa-themes"/.test(t);
for (const f of details) {
  const t = read(f);
  const isKowa = isKowaPage(t);

  // ── 3-0. 📥 ダウンロードの単体 HTML をサイトに入れない（2026-10-29）
  //   📥 は site.css・enhance.css を <style> に埋め込み、スクリプトと meta entities を外した「送付用の写し」。
  //   これをリポに置くと、共通の見た目の直しが届かず・強調も編集も動かず・横断の索引からも漏れる。
  //   本人が直した所は、本人の言葉で受けてリポの元ページを直す（SKILL.md STEP 6.9）。
  const noSiteCss = !/<link[^>]+href="site\.css(\?[^"]*)?"/.test(t);
  const noScript  = !/<script\s[^>]*src=/.test(t);
  const noEnt     = !/<meta name="entities"/.test(t);
  const styleLen  = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].reduce((s, m) => s + m[1].length, 0);
  if ((noSiteCss && noScript) || (noScript && noEnt) || styleLen > 20000)
    P('STANDALONE', `📥 ダウンロードの単体 HTML の形（site.css の読み込み${noSiteCss ? '無し' : '有り'}・スクリプト${noScript ? '無し' : '有り'}・meta entities ${noEnt ? '無し' : '有り'}・<style> ${Math.round(styleLen / 1024)}KB）＝サイトに入れない。直した所は元ページに書き戻す（SKILL.md STEP 6.9）`, f);

  // 関連MTGリンクは全件チェック（リンク切れは既存ページでも起きうる）
  for (const m of t.matchAll(/class="related-card" href="([^"]+)"/g))
    if (!exists(m[1])) P('LINK', `${f}: 関連MTGのリンク先が無い -> ${m[1]}`, f);

  // ── 3-1. 共通の見た目・動き（site.css と enhance/edit-mode）を読み、版が他のページとそろっている
  for (const [asset, re] of Object.entries(assetRe)) {
    const m = t.match(re);
    if (!m) { P('ASSET', `${f}: ${asset} を読み込んでいない`, f); continue; }
    if (expected[asset] && m[1] !== expected[asset])
      P('ASSET', `${f}: ${asset}?v=${m[1]} が他ページ(v=${expected[asset]})と不一致`, f);
  }

  // ── 3-2. 古い作りが残っていない（飾り・ページ内スクリプト・Google Fonts）
  const OLD = [
    [/class="[^"]*\bhero-particle\b/, '浮かぶ粒（hero-particle）'],
    [/id="scroll-progress"/, '読み進みの帯（scroll-progress）'],
    [/class="[^"]*\breveal\b/, 'ふわっと出る（reveal）'],
    [/noanim\.js/, 'noanim.js（消したファイル）'],
    [/fonts\.(googleapis|gstatic)\.com/, 'Google Fonts'],
    [/cdn\.jsdelivr\.net\/npm\/chart\.js|chart\.umd/i, 'Chart.js（図は site.css の帯で描く）'],
  ];
  for (const [re, what] of OLD) if (re.test(t)) P('OLD', `${f}: 古い作りが残っている -> ${what}`, f);
  for (const m of t.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
    if (m[1].trim()) P('OLD', `${f}: ページ内の <script> に中身がある（${m[1].trim().slice(0, 30)}…）＝動きは enhance.js・edit-mode.js だけにする`, f);
  if (/const\s+total\s*=/.test(t)) P('OLD', `${f}: 古い宿題の数え方（const total）が残っている`, f);

  // ── 3-3. 骨組み
  if (noEnt) P('HTML', `${f}: meta entities が無い`, f);
  if (!/id="detailContent"/.test(t))
    P('HTML', `${f}: 本文コンテナに id="detailContent" が無い（enhance.js が丸ごと動かない）`, f);
  if (!t.includes('id="tocList"')) P('HTML', `${f}: 目次（floating-toc #tocList）が無い`, f);
  if (!hasClass(t, 'back-link')) P('HTML', `${f}: 「一覧に戻る」（.back-link）が無い`, f);
  if (isKowa && !/<meta name="kowa-themes"/.test(t)) P('HTML', `${f}: 講話ページだが kowa-themes メタが無い`, f);

  // ── 3-4. 結論カード（先頭の「決まったこと・宿題」）。講話で結論も宿題も無いページだけ要らない
  const decs  = countClass(t, 'decision-box');
  const todos = countClass(t, 'action-item');
  const rows  = countClass(t, 'todo-row');
  const hasCC = /class="concl-card"/.test(t);
  if (!hasCC && !(isKowa && decs === 0 && todos === 0))
    P('CONCL', `${f}: 先頭の結論カード（.concl-card）が無い（決定 ${decs}・宿題 ${todos}）`, f);
  if (hasCC) {
    const cc = (t.match(/<section class="concl-card"[\s\S]*?<\/section>/) || [''])[0];
    const firstSec = t.indexOf('class="section-h2');
    if (firstSec > -1 && t.indexOf('class="concl-card"') > firstSec)
      P('CONCL', `${f}: 結論カードが本文の見出しより後にある（先頭に置く）`, f);
    const nDec = Number((cc.match(/決まったこと\s*<span class="cc-n">(\d+)件/) || [, -1])[1]);
    const nTodo = Number((cc.match(/宿題\s*<span class="cc-n">(\d+)件/) || [, -1])[1]);
    if (nDec !== -1 && nDec !== decs) P('CONCL', `${f}: 結論カードの「決まったこと ${nDec}件」が本文の決定（decision-box ${decs}個）と不一致`, f);
    if (nTodo !== -1 && nTodo !== todos) P('CONCL', `${f}: 結論カードの「宿題 ${nTodo}件」が下の一覧（action-item ${todos}個）と不一致`, f);
  }

  // ── 3-5. 宿題の行: 結論カードの行（.todo-row）に id="todo-n" と data-todo="n"、下の一覧（.action-item）に data-todo="n"。
  //   宿題タブのリンク（ページ#todo-n）と Asana の印（data-asana・data-done）がこの番号で行を探す
  if (todos !== rows) P('TODO', `${f}: 結論カードの宿題の行(${rows}) != 下の一覧(${todos})`, f);
  const rowNs = [];
  for (const m of t.matchAll(/<li class="todo-row[^"]*"([^>]*)>/g)) {
    const id = (m[1].match(/\bid="todo-(\d+)"/) || [])[1], dt = (m[1].match(/\bdata-todo="(\d+)"/) || [])[1];
    if (!id) P('TODO', `${f}: 宿題の行に id="todo-n" が無い（宿題タブのリンクが行を開けない）`, f);
    else if (id !== dt) P('TODO', `${f}: 宿題の行の id="todo-${id}" と data-todo="${dt}" が食い違う`, f);
    if (id) rowNs.push(id);
  }
  const itemNs = [...t.matchAll(/<li class="action-item[^"]*"[^>]*\bdata-todo="(\d+)"/g)].map(m => m[1]);
  if (todos && itemNs.length !== todos) P('TODO', `${f}: 下の一覧の行 ${todos} 個のうち data-todo があるのは ${itemNs.length} 個`, f);
  const dupN = rowNs.filter((v, i) => rowNs.indexOf(v) !== i);
  if (dupN.length) P('TODO', `${f}: 宿題の行の番号が重複 -> todo-${[...new Set(dupN)].join(',todo-')}`, f);
  const missN = itemNs.filter(n => !rowNs.includes(n));
  if (rowNs.length && missN.length) P('TODO', `${f}: 下の一覧の data-todo ${missN.join(',')} が結論カードの行に無い`, f);
  if (index) {
    // ⚠️ カード1枚分（</a>まで）に限定する。無制限に検索すると次のカードの数を拾う
    const block = (index.split(`href="${f}"`)[1] || '').split('</a>')[0];
    const card = block.match(/決定 (\d+)・宿題 (\d+)/);
    if (card && Number(card[2]) !== todos) P('TODO', `${f}: indexカードの「宿題 ${card[2]}」が実際(${todos}件)と不一致`, f);
    if (card && Number(card[1]) !== decs) P('INDEX', `${f}: indexカードの「決定 ${card[1]}」が実際(${decs}件)と不一致`, f);
  }

  // ── 3-6. 内容（旧来から引き継ぐ点検）
  const charts   = countClass(t, 'chart-container');
  const insights = countClass(t, 'chart-insight');
  if (charts === 0) P('CHART', `${f}: 図が1つも無い`, f);
  if (charts !== insights)
    P('CHART', `${f}: chart-container=${charts} に対し chart-insight=${insights}（全部の図に1つ必要）`, f);

  if (!isKowa) {
    if (decs === 0) P('HTML', `${f}: decision-box が1つも無い`, f);
    if (!hasClass(t, 'ai-list')) P('HTML', `${f}: AIサジェストが無い`, f);
    // decision-box の数がセクション数に見合うか（「関連するMTG」見出しには結論を付けない）
    const secs = countClass(t, 'section-h2');
    const rel  = hasClass(t, 'related-section') ? 1 : 0;
    const need = secs - rel;
    if (need > 0 && decs < need)
      P('HTML', `${f}: decision-box が${decs}個（本文セクション${need}個に対し不足）`, f);
  }

  // meta entities に1文字の固有名を入れない／entities の語が本文に実在する（タイポ・使い回しの検出）
  const ents = (t.match(/<meta name="entities" content="([^"]*)"/) || [, ''])[1];
  const entList = ents.split(',').map(s => s.trim()).filter(Boolean);
  const shorts = entList.filter(s => s.length === 1);
  if (shorts.length) P('HTML', `${f}: meta entities に1文字の語 -> ${shorts.join(',')}（誤マッチの原因）`, f);
  // 10-29: 要約の段落は結論カードに替えて本文から外し、<meta name="description">（一覧カードの要約の元）に移した。
  //   要約にだけ出る固有名もあるので、description も「本文」に含めて見る
  const text = bodyText(t) + ' ' + ((t.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1]);
  const ghost = entList.filter(e => e.length > 1 && !text.includes(e));
  if (ghost.length)
    P('HTML', `${f}: meta entities の語が本文に無い -> ${ghost.join(',')}（タイポ or 使い回し）`, f);

  // 【NAME・参考のみ】固有名の表記ゆれ疑い（例: 田中青果 と 田中製菓）。比較相手は VOCAB（全ページの entities）に限る
  for (const e of entList) {
    if (e.length < 3) continue;
    for (const v of VOCAB) {
      if (v === e || v.length !== e.length) continue;
      if (v.slice(0, 2) !== e.slice(0, 2)) continue;
      if (v.slice(2) === e.slice(2)) continue;
      if (text.includes(v)) P('NAME', `${f}: 「${e}」と「${v}」が混在（Plaud原文の表記ゆれの可能性・要目視）`, f);
    }
  }

  // セクションIDの重複
  const ids = [...t.matchAll(/class="section-h2[^"]*" id="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) P('HTML', `${f}: section id が重複 -> ${[...new Set(dup)].join(',')}`, f);
  // 結論カードの「本文→」が指す節が実在する
  for (const m of t.matchAll(/<a href="#([^"]+)" aria-label="この結論の節へ"/g))
    if (!new RegExp(`id="${m[1]}"`).test(t)) P('LINK', `${f}: 結論カードの「本文→」の行き先 #${m[1]} が無い`, f);

  // タイムラインの要素順（dot>time>title>desc[>status]）
  for (const m of t.matchAll(/<div class="tl-item">([\s\S]*?)(?=<div class="tl-item">|<\/div>\s*(?:<div class="chart-insight)|<\/div>\s*<\/div>)/g)) {
    const seq = [...m[1].matchAll(/class="tl-(dot|time|title|desc|status)/g)].map(x => x[1]).join('>');
    if (seq && !/^dot>time>title>desc(>status)?$/.test(seq))
      P('HTML', `${f}: tl-item の要素順が不正 -> ${seq}（正: dot>time>title>desc[>status]）`, f);
  }

  // ── 3-7. 横断ページ・一覧のデータへの反映（gen-aux.js の出力）
  const stem = f.replace(/\.html$/, '');
  for (const aux of ['entity-index.html', 'search-index.json', 'data/entities.json']) {
    if (!exists(aux)) { P('AUX', `${aux} が無い（gen-aux.js 未実行）`, f); continue; }
    if (!readCached(aux).includes(stem)) P('AUX', `${aux} に ${stem} が含まれていない（gen-aux.js を再実行）`, f);
  }
  // decisions は decision-box を集約する。decision-box を持たないページ（講話）は載らないのが正しい
  if (decs) for (const aux of ['decisions.html', 'data/decisions.json']) {
    if (!exists(aux)) P('AUX', `${aux} が無い（gen-aux.js 未実行）`, f);
    else if (!readCached(aux).includes(stem)) P('AUX', `${aux} に ${stem} が含まれていない（gen-aux.js を再実行）`, f);
  }
}


// ─────────────────────────────────────────────────────────────
// A-2（2026-10-29 全体改善案 v1.0）: どの録音か分からないページ・振り分けていない録音のページは載せない
//   ページの <meta name="plaud-file-id" content="..."> の録音が、Plaud のフォルダ（plaud-folders.ps1 の出力 JSON）で
//   社内・社外・講話録音・学生発表 にあるか、本人が載せてよいと答えた一覧（plaud_掲載の承認.json）にあること。
//   どちらも無い／meta が無いページは GATE（今回対象のページだけ。既存の 102 本は参考）。題名で推測しない。
//   場所は環境変数で変えられる: PLAUD_FOLDERS（既定 %TEMP%\plaud-folders.json）・PLAUD_APPROVED（既定 OneDrive の 右腕AI\00_Resources\plaud_掲載の承認.json）
// ─────────────────────────────────────────────────────────────
{
  const os = require('os');
  const tryJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return null; } };
  const foldersPath = process.env.PLAUD_FOLDERS || path.join(os.tmpdir(), 'plaud-folders.json');
  const approvedPath = process.env.PLAUD_APPROVED || path.join(process.env.OneDrive || path.join(os.homedir(), 'OneDrive'), '右腕AI', '00_Resources', 'plaud_掲載の承認.json');
  const folders = tryJson(foldersPath) || [];
  const approvedDoc = tryJson(approvedPath) || {};
  const approved = new Set((approvedDoc['件'] || []).map(x => x.file_id));
  // 10-29 夜: 載せないと決めた録音（06-24 採用の会議＝面接・個人の給与）。夜の自走が載せ直したら、どのページでも止める
  const noPub = ((approvedDoc['載せない'] || {})['件']) || [];
  const noPubIds = new Map(noPub.filter(x => x.file_id).map(x => [x.file_id, x]));
  const noPubFiles = new Map(noPub.filter(x => x['ページ']).map(x => [x['ページ'], x]));
  const okFolder = new Map((Array.isArray(folders) ? folders : [folders]).map(x => [x.file_id, x.folder]));
  const PUBLISH = new Set(['社内', '社外', '講話録音', '学生発表']);
  // 10-29: file_id が分からない既存の 28 本（録音の印を入れる前に作ったページ）。新しく作るページは必ず meta が要る。
  //   ここに名前を足してよいのは「Plaud に録音がもう無い」と確かめた既存ページだけ（新しいページを足して関門を外さない）。
  //   A = Plaud の一覧（4.0・117 件）に同じ日付・題名の録音が無い（Plaud 側で消したか、4.0 の前に作ったページ）
  //   B = 同じ日の録音は題名の合う別のページの物。このページの録音は Plaud の一覧に無い（JSON メモから作ったか、Plaud で消した）
  //   突き合わせの記録: 2026-10-29 規則担当の fileid_map.json（高 74・無し 28。高の 74 本には meta を入れた）
  const A = "A", B = "B";
  const NO_FILEID_OK = {
  "2026-05-08_farman-zentai.html": A,
  "2026-05-08_suino.html": A,
  "2026-05-15_farman-zentai.html": A,
  "2026-05-15_philanthropy.html": A,
  "2026-05-15_uniba.html": A,
  "2026-05-16_inoue-iide.html": A,
  "2026-05-16_sueki.html": A,
  "2026-05-22_farman-zentai.html": A,
  "2026-05-23_suzuki-zeirishi.html": A,
  "2026-05-26_inoue-iide.html": A,
  "2026-05-26_kensinren.html": A,
  "2026-05-27_farman-zaimu.html": A,
  "2026-05-27_risho-solution.html": A,
  "2026-05-28_farmable-teireimtg.html": A,
  "2026-06-01_farman-zenntai.html": A,
  "2026-06-01_inoue-tanaka-setoyama.html": A,
  "2026-06-03_inoue-iide-asagawa.html": A,
  "2026-06-03_inoue-iide-setoyama.html": A,
  "2026-06-03_jisha-hp-mtg.html": A,
  "2026-06-05_takahashi-rijichou-mtg.html": A,
  "2026-06-09_suino-kyogyo-inoue-setoyama.html": B,
  "2026-06-09_suino-mtg.html": B,
  "2026-06-12_farman-zentai.html": A,
  "2026-06-14_awakihara-mtg.html": A,
  "2026-06-14_leathersinku-mtg.html": A,
  "2026-06-14_uematsu-mtg.html": A,
  "2026-06-15_bab-resort-mtg.html": A,
  "2026-06-17_farman-op-kaigi.html": B,
  };
  const byId = new Map();   // A-6: 同じ録音のページが 2 本ある（二重掲載）を file_id で見る。題名・日付では照合しない
  for (const f of details) {
    const t = read(f);
    const m = t.match(/<meta\s+name="plaud-file-id"\s+content="([^"]+)"/);
    const np = noPubFiles.get(f) || (m && noPubIds.get(m[1]));
    if (np) P('PUB', `${f}: 載せないと決めた録音（${np["会議名"] || np.file_id}・${np["理由"] || ""}）＝リポから外す（plaud_掲載の承認.json の「載せない」）`);
    if (!m) {
      if (NO_FILEID_OK[f]) continue;   // 既存の 28 本（理由は上の一覧）。数は出力の最後に 1 行で出す
      P('PUB', 'どの録音か分からない（<meta name="plaud-file-id"> が無い）。STEP 4 のテンプレートで入れる', f); continue;
    }
    if (NO_FILEID_OK[f]) P('PUB', `file_id 無しの許しの一覧（NO_FILEID_OK）にあるのに meta が入った＝一覧から ${f} を消す`, f);
    const id = m[1], fo = okFolder.get(id);
    byId.set(id, [...(byId.get(id) || []), f]);
    if (/^of_n_note:/.test(id))
      P('PUB', `録音 ${id} は「- Highlights／- 会議議事録」の写し（of_n_note:）＝元の録音のページだけ載せる（plaud_規則.json の folders.載せない型）`, f);
    if (!(fo && PUBLISH.has(fo)) && !approved.has(id))
      P('PUB', `録音 ${id} は Plaud で${fo ? '「' + fo + '」' : '見つからない'}・承認の一覧にも無い＝載せない（未振り分けは本人が振り分けるか朝の報告で答えるまで待つ）`, f);
  }
  globalThis.__noFileIdOk = Object.keys(NO_FILEID_OK).filter(f => details.includes(f) && !/plaud-file-id/.test(read(f))).length;
  for (const [id, fs] of byId) if (fs.length > 1)
    for (const f of fs) P('PUB', `同じ録音 ${id} のページが ${fs.length} 本ある（${fs.join('・')}）＝二重掲載。1 本にする`, f);
}

// ─────────────────────────────────────────────────────────────
// A-7（2026-10-29 全体改善案 v1.0）: 誤字の関門。plaud_規則.json の typos で gate=true の語が本文・題名・meta に残っていたら止める
//   （ゆれ・推測・要目視＝gate=false は止めない）。新しいページ（今回対象）だけ GATE、既存のページは参考の件数に出る。
//   場所は環境変数 PLAUD_RULES で変えられる（既定 OneDrive の 右腕AI\00_Resources\plaud_規則.json）。読めなければ今回対象があるときだけ止める
// ─────────────────────────────────────────────────────────────
{
  const os = require('os');
  const rulesPath = process.env.PLAUD_RULES || path.join(process.env.OneDrive || path.join(os.homedir(), 'OneDrive'), '右腕AI', '00_Resources', 'plaud_規則.json');
  let rules = null;
  try { rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8').replace(/^﻿/, '')); } catch (e) { rules = null; }
  const list = ((rules || {}).typos || {}).list || [];
  if (!rules) { if (gated.length) P('TYPO', `誤字の規則が読めない（${rulesPath}）＝誤字を確かめられないので載せない`); }
  else {
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const gates = list.filter(x => x.gate === true).map(x => ({ x, re: new RegExp(x.pattern || esc(x['誤']), 'g') }));
    const GEN = ['index.html', 'decisions.html', 'entity-index.html', 'kowa-knowledge.html', 'search-index.json',
      'data/decisions.json', 'data/decisions-recent.json', 'data/entities.json', 'data/keywords.json', 'data/todos.json'].filter(g => fs.existsSync(path.join(DIR, g)));
    for (const g of GEN) {
      const s = read(g);
      for (const { x, re } of gates) { const n = (s.match(re) || []).length; if (n) P('TYPO', `生成物 ${g} に誤字「${x["誤"]}」が ${n} 回（正: ${x["正"]}）＝gen-aux.js / asana-sync.js を流し直す（出力に typos を当てる）`); }
    }
    for (const f of details) {
      const t = read(f);
      const meta = [...t.matchAll(/<meta name="(?:entities|description)" content="([^"]*)"/g)].map(m => m[1]).join(' ')
                 + ' ' + ((t.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]);
      const text = bodyText(t) + ' ' + meta;
      for (const { x, re } of gates) {
        const n = (text.match(re) || []).length;
        if (n) P('TYPO', `誤字「${x['誤']}」が ${n} 回（正: ${x['正']}）＝直してから載せる（plaud_規則.json の typos）`, f);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// A-3（2026-10-29）: 健康・個人の事情・個人の給与など、社内のサイトにも載せない言葉（本文の文字だけを見る）
// ─────────────────────────────────────────────────────────────
{
  const NG = [
    // 10-29: 既存 102 本で試し、作物の「病気」・仕事の「時給」の相場・体験の注意「体調不良は申告」などの誤りが 10 本出たので、人の事情を指す言い方に絞った
    [/診断を受け|と診断され|通院中|入院中|休職|休養中|手術を受け|心身の不調|メンタル不調で/, '人の健康の話'],
    [/(さん|くん|氏)の(給与|月給|年収|給料)/, '個人の給与'],
    [/(面接|面談)[：:]/, '面接・面談の記録'],
    // 10-29 夜（点検の NG 1・13）: 06-24 の採用の会議（内定・再面談・希望年収・時給と年収）と、06-12 の「渡辺さんの現場確保（時給1,200円）」がすり抜けた
    [/(さん|くん|君|氏)[^。\n]{0,30}(時給|日給|月給|年収|給与|給料|賞与|手取り)[^。\n]{0,6}[\d０-９]/, '個人の給与（人の名前と同じ文の時給・年収）'],
    [/内定|希望年収|希望給与|再面談|入社前面談|最終面接|[一二三]次面接|面接(を|の)(実施|日程|結果|設定)|採用面接/, '面接・内定の記録'],
    [/(新卒)?採用候補(として|に|者[^。\n]{0,20}(面談|面接|入社))|候補者[^。\n]{0,20}(面談|面接|入社を打診|前倒し入社)/, '採用の候補の人の記録'],
    [/入社(の)?条件|入社時期を(打診|調整)|前倒し入社/, '入社の条件'],
  ];
  for (const f of details) {
    const raw = read(f);
    const body = raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
      + ' ' + [...raw.matchAll(/<meta name="(?:description|entities)" content="([^"]*)"/g)].map(m => m[1]).join(' ');
    for (const [re, why] of NG) { const m = body.match(re); if (m) P('PRIV', `${why}が本文にある（「${m[0].slice(0, 20)}」）＝載せる前に削るか本人に確かめる`, f); }
  }
}

// ─────────────────────────────────────────────────────────────
// 出力（2段）: ゲート＝今回対象＋サイト全体の問題 / 参考＝既存ページの積み残し
// NAME（表記ゆれ疑い）はヒューリスティックのため常に参考扱いにする
// ─────────────────────────────────────────────────────────────
const isGate = p => p.cat !== 'NAME' && (p.file === null || gated.includes(p.file));
const gate   = problems.filter(p => isGate(p) && p.cat !== 'NAME');
const legacy = problems.filter(p => !isGate(p) && p.cat !== 'NAME');
const names  = problems.filter(p => p.cat === 'NAME');
const fmt = p => `  [${p.cat}] ${p.file && !p.msg.includes(p.file) ? p.file + ': ' : ''}${p.msg}`;   // 10-29: ページ名の無い文（PUB・PRIV・TYPO）にもページ名を付ける
const show = (list, cap = 40) => {
  list.slice(0, cap).forEach(p => console.log(fmt(p)));
  if (list.length > cap) console.log(`  …他${list.length - cap}件（全部見るには --all）`);
};

console.log(`検査対象: 詳細HTML ${details.length}件（ゲート ${gated.length}件 / 参考 ${details.length - gated.length}件）`);
if (Object.keys(expected).length)
  console.log('アセット基準版: ' + Object.entries(expected).map(([k, v]) => `${k}?v=${v}`).join(' / '));
if (globalThis.__noFileIdOk) console.log(`録音の印（plaud-file-id）が無いのを許した既存ページ: ${globalThis.__noFileIdOk}本（audit.js の NO_FILEID_OK・理由つき）`);

console.log(`\n=== ゲート（今回対象）: ${gate.length}件 ===`);
if (gate.length) show(gate, 200); else console.log('  なし ✅');

console.log(`\n--- 参考: 既存ページの積み残し ${legacy.length}件（デプロイはブロックしない） ---`);
if (legacy.length) {
  const byCat = {};
  legacy.forEach(p => { byCat[p.cat] = (byCat[p.cat] || 0) + 1; });
  console.log('  内訳: ' + Object.entries(byCat).map(([k, v]) => `${k}=${v}`).join(' / ')
            + ` （${new Set(legacy.map(p => p.file)).size}ページ）`);
  show(legacy);
} else console.log('  なし ✅');

if (names.length) {
  console.log(`\n--- 要目視: 固有名の表記ゆれ疑い ${names.length}件（誤検出しうる・ブロックしない） ---`);
  show(names, 20);
}

process.exit(gate.length ? 1 : 0);
