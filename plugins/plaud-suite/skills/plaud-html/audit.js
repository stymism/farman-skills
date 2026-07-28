#!/usr/bin/env node
'use strict';
/**
 * plaud-html 生成物の自己監査
 *
 *   node audit.js <work_dir> [対象.html ...]
 *
 * 対象を省略すると全詳細ページを検査する（構造チェックのみ全件、厳密チェックは対象指定時）。
 * 問題があれば exit code 1 を返すので、デプロイ前のゲートに使える。
 *
 * 設計方針:
 *  - アセットのバージョン（enhance.css?v=N 等）はハードコードせず、全ページの
 *    「最頻値」を正とし、そこから外れたページだけを異常として報告する（将来v上げで壊れない）
 *  - コードフェンス等の誤検出を避け、DOM的な構造の整合だけを見る
 */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const ARGS = process.argv.slice(3);
const ALL_STRICT = ARGS.includes('--all');
const TARGETS = ARGS.filter(a => !a.startsWith('--'));
if (!DIR || !fs.existsSync(DIR)) {
  console.error('使い方: node audit.js <work_dir> [対象.html ...] [--all]');
  console.error('  対象を指定 : そのページを厳密検査（生成直後はこれを使う）');
  console.error('  対象を省略 : 全件の構造・リンク・アセットのみ検査');
  console.error('  --all      : 全件を厳密検査（棚卸し用。旧テンプレのページは大量に出る）');
  process.exit(2);
}

const AUX = new Set(['index.html', 'decisions.html', 'entity-index.html', 'kowa-knowledge.html']);
const problems = [];
const P = (cat, msg) => problems.push(`[${cat}] ${msg}`);

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
const strict = TARGETS.length ? TARGETS.map(t => path.basename(t)) : (ALL_STRICT ? details : []);

for (const t of strict) if (!exists(t)) P('ARG', `指定されたファイルが存在しない: ${t}`);

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
// 2. アセットのバージョン整合（最頻値を正とする）
// ─────────────────────────────────────────────────────────────
const assetRe = { 'enhance.css': /enhance\.css\?v=(\d+)/, 'enhance.js': /enhance\.js\?v=(\d+)/, 'edit-mode.js': /edit-mode\.js\?v=(\d+)/ };
const expected = {};
for (const [asset, re] of Object.entries(assetRe)) {
  const tally = {};
  for (const f of details) {
    const m = read(f).match(re);
    if (m) tally[m[1]] = (tally[m[1]] || 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  if (top) expected[asset] = top[0];
  if (!exists(asset)) P('ASSET', `${asset} が work_dir に無い（全ページが参照している）`);
}

// ─────────────────────────────────────────────────────────────
// 3. 各詳細ページ
// ─────────────────────────────────────────────────────────────
for (const f of details) {
  const t = read(f);
  const isStrict = strict.includes(f);

  // 関連MTGリンクは全件チェック（リンク切れは既存ページでも起きうる）
  for (const m of t.matchAll(/class="related-card" href="([^"]+)"/g))
    if (!exists(m[1])) P('LINK', `${f}: 関連MTGのリンク先が無い -> ${m[1]}`);

  // アセットのバージョン外れも全件チェック
  for (const [asset, re] of Object.entries(assetRe)) {
    const m = t.match(re);
    if (!m) { if (isStrict) P('ASSET', `${f}: ${asset} を読み込んでいない`); continue; }
    if (expected[asset] && m[1] !== expected[asset])
      P('ASSET', `${f}: ${asset}?v=${m[1]} が他ページ(v=${expected[asset]})と不一致`);
  }

  if (!isStrict) continue;

  // ---- 以下は今回生成した（=指定された）ページのみ厳密に見る ----
  const charts   = countClass(t, 'chart-container');
  const insights = countClass(t, 'chart-insight');
  if (charts === 0) P('CHART', `${f}: チャートが1つも無い`);
  if (charts !== insights)
    P('CHART', `${f}: chart-container=${charts} に対し chart-insight=${insights}（全チャートに1つ必要）`);

  const particles = countClass(t, 'hero-particle');
  if (particles !== 5) P('HTML', `${f}: hero-particle が${particles}個（5個必要）`);

  // ⚠️ 空白ゆらぎに注意（`white-space: nowrap` と `white-space:nowrap` の両方が実在する）
  const nowrap = ruleHas(t, '.back-link', 'white-space', 'nowrap');
  if (nowrap === null) P('HTML', `${f}: .back-link のCSSルールが無い`);
  else if (!nowrap) P('HTML', `${f}: .back-link に white-space:nowrap が無い（「一覧に戻る」が折り返す）`);

  if (!/<meta name="entities"/.test(t)) P('HTML', `${f}: meta entities が無い`);
  if (!t.includes('id="scroll-progress"')) P('HTML', `${f}: scroll-progress が無い`);
  if (!t.includes('id="tocList"')) P('HTML', `${f}: floating-toc が無い`);
  // 講話録音(kowa)は設計上 ToDo/Asana/決定事項/AIサジェストを持たない → 該当チェックを免除する
  const isKowa = /badge-header-kowa/.test(t) || /<meta name="kowa-themes"/.test(t);
  if (!isKowa) {
    if (!hasClass(t, 'decision-box')) P('HTML', `${f}: decision-box が1つも無い`);
    if (!hasClass(t, 'ai-list')) P('HTML', `${f}: AIサジェストが無い`);
  } else {
    if (!/<meta name="kowa-themes"/.test(t)) P('HTML', `${f}: 講話ページだが kowa-themes メタが無い`);
  }

  // meta entities に1文字の固有名を入れない
  const ents = (t.match(/<meta name="entities" content="([^"]*)"/) || [, ''])[1];
  const shorts = ents.split(',').map(s => s.trim()).filter(s => s.length === 1);
  if (shorts.length) P('HTML', `${f}: meta entities に1文字の語 -> ${shorts.join(',')}（誤マッチの原因）`);

  // ToDo件数の4点一致（項目数 / const total / 進捗ラベル / indexカード表記）
  if (!isKowa) {
    const todos = countClass(t, 'action-item');
    const total = Number((t.match(/const\s+total\s*=\s*(\d+)/) || [, -1])[1]);
    const label = Number((t.match(/id="progressCount">0 \/ (\d+) 完了/) || [, -1])[1]);
    if (total !== -1 && todos !== total) P('TODO', `${f}: ToDo項目(${todos}) != const total(${total})`);
    if (label !== -1 && todos !== label) P('TODO', `${f}: ToDo項目(${todos}) != 進捗ラベル(${label})`);
    if (index) {
      // ⚠️ カード1枚分（</a>まで）に限定する。無制限に検索すると次のカードのToDo数を拾う
      const block = (index.split(`href="${f}"`)[1] || '').split('</a>')[0];
      const cardTodo = Number((block.match(/✅ ToDo (\d+)件/) || [, 0])[1]);
      if (cardTodo && cardTodo !== todos)
        P('TODO', `${f}: indexカードの「ToDo ${cardTodo}件」が実際(${todos}件)と不一致`);
    }
  }

  // セクションIDの重複と目次の対応
  const ids = [...t.matchAll(/class="section-h2[^"]*" id="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) P('HTML', `${f}: section id が重複 -> ${[...new Set(dup)].join(',')}`);

  // タイムラインの要素順（dot>time>title>desc[>status]）
  for (const m of t.matchAll(/<div class="tl-item">([\s\S]*?)(?=<div class="tl-item">|<\/div>\s*(?:<div class="chart-insight)|<\/div>\s*<\/div>)/g)) {
    const seq = [...m[1].matchAll(/class="tl-(dot|time|title|desc|status)/g)].map(x => x[1]).join('>');
    if (seq && !/^dot>time>title>desc(>status)?$/.test(seq))
      P('HTML', `${f}: tl-item の要素順が不正 -> ${seq}（正: dot>time>title>desc[>status]）`);
  }

  // 横断ページへの反映
  const stem = f.replace(/\.html$/, '');
  for (const aux of ['entity-index.html', 'search-index.json']) {   // 全ページを集約する
    if (!exists(aux)) { P('AUX', `${aux} が無い（gen-aux.js 未実行）`); continue; }
    if (!read(aux).includes(stem)) P('AUX', `${aux} に ${stem} が含まれていない（gen-aux.js を再実行）`);
  }
  // decisions.html は decision-box を集約するページ。
  // ⚠️ decision-box を持たないページ（講話・旧テンプレ）は載らないのが正しい（偽陽性を出さない）
  if (hasClass(t, 'decision-box')) {
    if (!exists('decisions.html')) P('AUX', 'decisions.html が無い（gen-aux.js 未実行）');
    else if (!read('decisions.html').includes(stem))
      P('AUX', `decisions.html に ${stem} が含まれていない（gen-aux.js を再実行）`);
  }
}

// ─────────────────────────────────────────────────────────────
console.log(`検査対象: 詳細HTML ${details.length}件（うち厳密 ${strict.length}件）`);
if (Object.keys(expected).length)
  console.log('アセット基準版: ' + Object.entries(expected).map(([k, v]) => `${k}?v=${v}`).join(' / '));
console.log(`\n=== 検出された問題: ${problems.length}件 ===`);
if (problems.length) { problems.forEach(p => console.log('  ' + p)); process.exit(1); }
console.log('  なし ✅');
