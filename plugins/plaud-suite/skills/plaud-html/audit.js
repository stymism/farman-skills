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
// 2.5 固有名の語彙（NAMEチェック用）
//   全ページの meta entities ＋ indexカードの data-text（空白区切り＝トークン化済み）を集める。
//   本文を正規表現で切ると語の断片を拾うため、比較相手は必ずこの語彙に限定する。
// ─────────────────────────────────────────────────────────────
const VOCAB = new Set();
for (const f of details) {
  const m = read(f).match(/<meta name="entities" content="([^"]*)"/);
  if (m) m[1].split(',').map(s => s.trim()).filter(s => s.length > 2).forEach(s => VOCAB.add(s));
}
if (index)
  for (const m of index.matchAll(/data-text="([^"]*)"/g))
    m[1].split(/\s+/).filter(s => s.length > 2).forEach(s => VOCAB.add(s));

// ─────────────────────────────────────────────────────────────
// 3. 各詳細ページ
// ─────────────────────────────────────────────────────────────
for (const f of details) {
  const t = read(f);
  const isStrict = true;   // 2026-07-29: 全ページを検査する。ゲートか参考かは出力時に振り分ける

  // 関連MTGリンクは全件チェック（リンク切れは既存ページでも起きうる）
  for (const m of t.matchAll(/class="related-card" href="([^"]+)"/g))
    if (!exists(m[1])) P('LINK', `${f}: 関連MTGのリンク先が無い -> ${m[1]}`, f);

  // アセットのバージョン外れも全件チェック
  for (const [asset, re] of Object.entries(assetRe)) {
    const m = t.match(re);
    if (!m) { if (isStrict) P('ASSET', `${f}: ${asset} を読み込んでいない`, f); continue; }
    if (expected[asset] && m[1] !== expected[asset])
      P('ASSET', `${f}: ${asset}?v=${m[1]} が他ページ(v=${expected[asset]})と不一致`, f);
  }

  // ---- ここから下はページ内容の厳密チェック（全ページに対して行う） ----
  const charts   = countClass(t, 'chart-container');
  const insights = countClass(t, 'chart-insight');
  if (charts === 0) P('CHART', `${f}: チャートが1つも無い`, f);
  if (charts !== insights)
    P('CHART', `${f}: chart-container=${charts} に対し chart-insight=${insights}（全チャートに1つ必要）`, f);

  const particles = countClass(t, 'hero-particle');
  if (particles !== 5) P('HTML', `${f}: hero-particle が${particles}個（5個必要）`, f);

  // ⚠️ 空白ゆらぎに注意（`white-space: nowrap` と `white-space:nowrap` の両方が実在する）
  const nowrap = ruleHas(t, '.back-link', 'white-space', 'nowrap');
  if (nowrap === null) P('HTML', `${f}: .back-link のCSSルールが無い`, f);
  else if (!nowrap) P('HTML', `${f}: .back-link に white-space:nowrap が無い（「一覧に戻る」が折り返す）`, f);

  if (!/<meta name="entities"/.test(t)) P('HTML', `${f}: meta entities が無い`, f);
  if (!t.includes('id="scroll-progress"')) P('HTML', `${f}: scroll-progress が無い`, f);
  if (!t.includes('id="tocList"')) P('HTML', `${f}: floating-toc が無い`, f);
  // 講話録音(kowa)は設計上 ToDo/Asana/決定事項/AIサジェストを持たない → 該当チェックを免除する
  const isKowa = /badge-header-kowa/.test(t) || /<meta name="kowa-themes"/.test(t);
  if (!isKowa) {
    if (!hasClass(t, 'decision-box')) P('HTML', `${f}: decision-box が1つも無い`, f);
    if (!hasClass(t, 'ai-list')) P('HTML', `${f}: AIサジェストが無い`, f);
  } else {
    if (!/<meta name="kowa-themes"/.test(t)) P('HTML', `${f}: 講話ページだが kowa-themes メタが無い`, f);
  }

  // meta entities に1文字の固有名を入れない
  const ents = (t.match(/<meta name="entities" content="([^"]*)"/) || [, ''])[1];
  const entList = ents.split(',').map(s => s.trim()).filter(Boolean);
  const shorts = entList.filter(s => s.length === 1);
  if (shorts.length) P('HTML', `${f}: meta entities に1文字の語 -> ${shorts.join(',')}（誤マッチの原因）`, f);

  // ── 2026-07-29 追加 ①: enhance.js の起点 id
  // enhance.js は getElementById('detailContent') が無いと即returnし、強調・ミニバー・
  // ダークモード等が「エラーも出さずに」全部死ぬ。旧15ページで実際に起きた。
  if (!/id="detailContent"/.test(t))
    P('HTML', `${f}: 本文コンテナに id="detailContent" が無い（enhance.js が丸ごと動かない）`, f);

  // ── 2026-07-29 追加 ②: chart-insight の差し色がページのテーマと一致しているか
  const theme = themeOf(t);
  const ciRule = (t.match(/\.chart-insight\s*\{[^}]*\}/) || [null])[0];
  if (ciRule) {
    const bl = (ciRule.replace(/\s+/g, '').match(/border-left:[^;}]*/) || [''])[0];
    const wrong = Object.entries(THEME_TOKENS)
      .filter(([name]) => name !== theme)
      .filter(([, toks]) => toks.some(k => bl.includes(k)))
      .map(([name]) => name);
    if (wrong.length)
      P('CHART', `${f}: chart-insight の差し色が ${wrong.join('/')} 系だがページは ${theme} テーマ -> ${bl}`, f);
  }

  // ── 2026-07-29 追加 ③: decision-box の数がセクション数に見合うか
  // （従来は「0件のとき」しか見ておらず、1個でもあれば素通りしていた）
  if (!isKowa) {
    const secs = countClass(t, 'section-h2');
    const rel  = hasClass(t, 'related-section') ? 1 : 0;   // 「関連するMTG」見出しには結論を付けない
    const need = secs - rel;
    const decs = countClass(t, 'decision-box');
    if (need > 0 && decs < need)
      P('HTML', `${f}: decision-box が${decs}個（本文セクション${need}個に対し不足）`, f);
  }

  // ── 2026-07-29 追加 ④: meta entities の語が本文に実在するか（タイポ・使い回しの検出）
  const text = bodyText(t);
  const ghost = entList.filter(e => e.length > 1 && !text.includes(e));
  if (ghost.length)
    P('HTML', `${f}: meta entities の語が本文に無い -> ${ghost.join(',')}（タイポ or 使い回し）`, f);

  // ── 2026-07-29 追加 ⑤【NAME・参考のみ】固有名の表記ゆれ疑い
  // 例: entities に「田中青果」がある一方、本文に「田中製菓」が混在（Plaud原文の聞き違い）。
  //
  // ⚠️ 日本語には語境界が無いため、本文を正規表現で切ると「有機農業者向」のような
  //    語の断片を拾って誤検出が爆発する（初版は52件中ほぼ全てが誤検出だった）。
  //    → 比較相手は VOCAB（全ページの meta entities ＋ indexカードの data-text＝空白区切りで
  //      既にトークン化済み）に限定する。これで「実在する固有名同士」だけを突き合わせる。
  // ⚠️ それでも推測なのでゲートにはせず「要目視」として出すだけ。
  for (const e of entList) {
    if (e.length < 3) continue;
    for (const v of VOCAB) {
      if (v === e || v.length !== e.length) continue;
      if (v.slice(0, 2) !== e.slice(0, 2)) continue;   // 頭2文字が同じ
      if (v.slice(2) === e.slice(2)) continue;          // 残りが違うこと
      if (text.includes(v)) P('NAME', `${f}: 「${e}」と「${v}」が混在（Plaud原文の表記ゆれの可能性・要目視）`, f);
    }
  }

  // ToDo件数の4点一致（項目数 / const total / 進捗ラベル / indexカード表記）
  if (!isKowa) {
    const todos = countClass(t, 'action-item');
    const total = Number((t.match(/const\s+total\s*=\s*(\d+)/) || [, -1])[1]);
    const label = Number((t.match(/id="progressCount">0 \/ (\d+) 完了/) || [, -1])[1]);
    if (total !== -1 && todos !== total) P('TODO', `${f}: ToDo項目(${todos}) != const total(${total})`, f);
    if (label !== -1 && todos !== label) P('TODO', `${f}: ToDo項目(${todos}) != 進捗ラベル(${label})`, f);
    if (index) {
      // ⚠️ カード1枚分（</a>まで）に限定する。無制限に検索すると次のカードのToDo数を拾う
      const block = (index.split(`href="${f}"`)[1] || '').split('</a>')[0];
      const cardTodo = Number((block.match(/✅ ToDo (\d+)件/) || [, 0])[1]);
      if (cardTodo && cardTodo !== todos)
        P('TODO', `${f}: indexカードの「ToDo ${cardTodo}件」が実際(${todos}件)と不一致`, f);
    }
  }

  // セクションIDの重複と目次の対応
  const ids = [...t.matchAll(/class="section-h2[^"]*" id="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) P('HTML', `${f}: section id が重複 -> ${[...new Set(dup)].join(',')}`, f);

  // タイムラインの要素順（dot>time>title>desc[>status]）
  for (const m of t.matchAll(/<div class="tl-item">([\s\S]*?)(?=<div class="tl-item">|<\/div>\s*(?:<div class="chart-insight)|<\/div>\s*<\/div>)/g)) {
    const seq = [...m[1].matchAll(/class="tl-(dot|time|title|desc|status)/g)].map(x => x[1]).join('>');
    if (seq && !/^dot>time>title>desc(>status)?$/.test(seq))
      P('HTML', `${f}: tl-item の要素順が不正 -> ${seq}（正: dot>time>title>desc[>status]）`, f);
  }

  // 横断ページへの反映
  const stem = f.replace(/\.html$/, '');
  for (const aux of ['entity-index.html', 'search-index.json']) {   // 全ページを集約する
    if (!exists(aux)) { P('AUX', `${aux} が無い（gen-aux.js 未実行）`, f); continue; }
    if (!read(aux).includes(stem)) P('AUX', `${aux} に ${stem} が含まれていない（gen-aux.js を再実行）`, f);
  }
  // decisions.html は decision-box を集約するページ。
  // ⚠️ decision-box を持たないページ（講話・旧テンプレ）は載らないのが正しい（偽陽性を出さない）
  if (hasClass(t, 'decision-box')) {
    if (!exists('decisions.html')) P('AUX', 'decisions.html が無い（gen-aux.js 未実行）', f);
    else if (!read('decisions.html').includes(stem))
      P('AUX', `decisions.html に ${stem} が含まれていない（gen-aux.js を再実行）`, f);
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
const fmt = p => `  [${p.cat}] ${p.msg}`;
const show = (list, cap = 40) => {
  list.slice(0, cap).forEach(p => console.log(fmt(p)));
  if (list.length > cap) console.log(`  …他${list.length - cap}件（全部見るには --all）`);
};

console.log(`検査対象: 詳細HTML ${details.length}件（ゲート ${gated.length}件 / 参考 ${details.length - gated.length}件）`);
if (Object.keys(expected).length)
  console.log('アセット基準版: ' + Object.entries(expected).map(([k, v]) => `${k}?v=${v}`).join(' / '));

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
