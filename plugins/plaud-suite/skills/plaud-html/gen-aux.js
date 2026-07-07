#!/usr/bin/env node
/* ============================================================
   gen-aux.js — 議事録アーカイブの横断ページを自動生成
   既存の議事録HTML（2026-MM-DD_*.html）を解析し、以下を出力する:
     - search-index.json  全文検索インデックス（index.html が読み込む）
     - entity-index.html  人物・企業インデックス（誰がどのMTGに登場したか）
     - decisions.html     決定事項ダッシュボード（全MTGのdecision-box集約）
   使い方: node gen-aux.js [workDir]
     workDir 省略時は ~/.plaud/plaud-config.json の paths.work_dir を使う
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

/* ---- 作業ディレクトリの解決 ---- */
function resolveWorkDir() {
  if (process.argv[2]) return process.argv[2];
  try {
    const cfgPath = path.join(os.homedir(), '.plaud', 'plaud-config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return (cfg.paths.work_dir || '').replace(/^~/, os.homedir());
  } catch (e) {
    return process.cwd();
  }
}
const WORK = resolveWorkDir();

/* ---- ユーティリティ ---- */
const AUX = new Set(['index.html', 'kowa-knowledge.html', 'entity-index.html', 'decisions.html', 'network.html']);
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function meta(html, name) {
  const m = html.match(new RegExp('<meta name="' + name + '" content="([^"]*)"', 'i'));
  return m ? m[1] : '';
}
function listVal(v) { return (v || '').split(',').map(s => s.trim()).filter(Boolean); }

/* ---- 解析 ---- */
const files = fs.readdirSync(WORK)
  .filter(f => /^2026-\d\d-\d\d_.*\.html$/.test(f) && !AUX.has(f))
  .sort().reverse();

// index.html のカード data-text を取り込み（旧ページは entities メタが無いため、横断タグを全ページぶん補完）
const idxTokens = {};
try {
  const idx = fs.readFileSync(path.join(WORK, 'index.html'), 'utf8');
  const cre = /href="(2026-[^"?]+\.html)"[^>]*data-text="([^"]*)"/gi;
  let cm; while ((cm = cre.exec(idx))) {
    idxTokens[cm[1]] = cm[2].split(/\s+/).map(s => s.trim()).filter(s => s.length >= 2);
  }
} catch (e) {}

const records = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(WORK, file), 'utf8');
  const dm = file.match(/^(\d{4})-(\d{2})-(\d{2})_/);
  const date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '';
  const type = /badge-header-internal/.test(html) ? 'internal'
             : /badge-header-kowa/.test(html) || /-kowa\.html$/.test(file) ? 'kowa'
             : 'external';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = h1 ? stripTags(h1[1]) : (html.match(/<title>([^<]*?)(?:\s—|<\/title>)/) || [, file])[1];

  // エンティティ（人物・企業）。1文字は除外。講話はspeaker＋keywordsで補完
  let ents = listVal(meta(html, 'entities')).filter(s => s.length >= 2);
  if (type === 'kowa') {
    const sp = meta(html, 'kowa-speaker'); if (sp) ents.push(sp);
    ents = ents.concat(listVal(meta(html, 'kowa-keywords')).slice(0, 6));
  }
  ents = Array.from(new Set(ents.filter(s => s && s.length >= 2)));
  const themes = listVal(meta(html, 'kowa-themes'));

  // 決定事項（decision-box の「結論:」本文）＋直前のセクション見出し
  const decisions = [];
  const dre = /<div class="decision-box[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let dm2, lastIdx = 0;
  const heads = [];
  const hre = /<h2 class="section-h2[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi;
  let hm; while ((hm = hre.exec(html))) heads.push({ idx: hm.index, text: stripTags(hm[1]).replace(/^\d+\s*/, '') });
  while ((dm2 = dre.exec(html))) {
    let txt = stripTags(dm2[1]).replace(/^結論[:：]\s*/, '').trim();
    if (!txt) continue;
    let ctx = ''; for (const h of heads) { if (h.idx < dm2.index) ctx = h.text; else break; }
    decisions.push({ ctx, txt });
  }

  // 本文プレーンテキスト（検索用・先頭4000字）
  const contentM = html.match(/<div class="detail-content"[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = stripTags(contentM ? contentM[1] : html).slice(0, 4000);

  // 横断タグ = エンティティ＋テーマ＋indexカードのdata-text（全ページで使える検索/索引キー）
  const tags = Array.from(new Set([].concat(ents, themes, idxTokens[file] || []).filter(s => s && s.length >= 2)));

  records.push({ file, date, type, title, entities: ents, themes, tags, decisions, text: bodyText });
}

/* ---- 1) search-index.json ---- */
const index = records.map(r => ({
  file: r.file, date: r.date, type: r.type, title: r.title,
  entities: r.entities, themes: r.themes, tags: r.tags, text: r.text
}));
fs.writeFileSync(path.join(WORK, 'search-index.json'), JSON.stringify(index), 'utf8');

/* ---- 共通：ページの体裁 ---- */
const TYPE_LABEL = { internal: '🏢 社内', external: '🤝 社外', kowa: '🎤 講話' };
const TYPE_COLOR = { internal: '#1b4332', external: '#78350f', kowa: '#1e1b4b' };
function shell(titleText, icon, subtitle, bodyHtml, extraScript) {
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><link rel="icon" type="image/svg+xml" href="favicon.svg">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titleText)} — Farman MTG Summaries</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
:root{--amber-900:#78350f;--amber-700:#b45309;--amber-500:#f59e0b;--amber-300:#fcd34d;--amber-50:#fffbeb;
--g900:#111827;--g700:#374151;--g600:#4b5563;--g400:#9ca3af;--g200:#e5e7eb;--g100:#f3f4f6;--bg:#fdf8f0;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--g900);line-height:1.8;font-variant-numeric:tabular-nums;}
.head{background:radial-gradient(ellipse at 15% 50%,rgba(180,83,9,.5) 0%,transparent 55%),radial-gradient(ellipse at 85% 10%,rgba(245,158,11,.25) 0%,transparent 50%),#78350f;color:#fff;padding:44px 40px 38px;}
.head-in{max-width:1080px;margin:0 auto;}
.back{display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.7);font-size:13px;text-decoration:none;margin-bottom:18px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);white-space:nowrap;}
.back:hover{background:rgba(255,255,255,.16);color:#fff;}
h1.page{font-size:clamp(22px,4vw,32px);font-weight:900;display:flex;align-items:center;gap:12px;}
.sub{opacity:.78;font-size:13px;margin-top:8px;}
.wrap{max-width:1080px;margin:0 auto;padding:32px 40px 80px;}
.tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:24px;}
.sbox{flex:1;min-width:200px;border:1.5px solid var(--g200);border-radius:999px;padding:10px 18px;font-size:14px;font-family:inherit;outline:none;background:#fff;}
.sbox:focus{border-color:var(--amber-500);}
.pill{border:1.5px solid var(--g200);background:#fff;border-radius:999px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--g600);transition:all .15s;}
.pill.active,.pill:hover{background:var(--amber-500);border-color:var(--amber-500);color:#fff;}
.count{font-size:13px;color:var(--g400);margin-left:auto;}
.badge{font-size:11px;font-weight:700;padding:2px 10px;border-radius:999px;color:#fff;white-space:nowrap;}
.b-internal{background:#1b4332;}.b-external{background:#78350f;}.b-kowa{background:#1e1b4b;}
a{color:inherit;}
@media(max-width:640px){.head{padding:32px 20px 28px;}.wrap{padding:24px 20px 60px;}}
__STYLE__
</style></head>
<body>
<header class="head"><div class="head-in">
<a href="index.html" class="back"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 3L5 8l5 5"/></svg>一覧に戻る</a>
<h1 class="page">${icon} ${esc(titleText)}</h1>
<div class="sub">${subtitle}</div>
</div></header>
<main class="wrap">
${bodyHtml}
</main>
<script>${extraScript || ''}</script>
</body></html>`;
}

/* ---- 2) entity-index.html ---- */
(function () {
  const map = new Map(); // tag -> [{file,title,date,type}]
  for (const r of records) for (const e of r.tags) {
    if (!map.has(e)) map.set(e, []);
    map.get(e).push({ file: r.file, title: r.title, date: r.date, type: r.type });
  }
  const ents = Array.from(map.entries())
    .map(([name, list]) => ({ name, list: list.sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name, 'ja'));
  const multi = ents.filter(e => e.list.length >= 2).length;

  const cards = ents.map(e => {
    const links = e.list.map(m =>
      `<a class="ent-mtg" href="${m.file}"><span class="badge b-${m.type}">${TYPE_LABEL[m.type]}</span><span class="ed">${m.date.slice(5).replace('-', '/')}</span><span class="et">${esc(m.title)}</span></a>`
    ).join('');
    return `<div class="ent-card${e.list.length < 2 ? ' single' : ''}" data-name="${esc(e.name)}" data-n="${e.list.length}"><div class="ent-h"><span class="ent-n">${esc(e.name)}</span><span class="ent-c">${e.list.length}</span></div><div class="ent-list">${links}</div></div>`;
  }).join('');

  const style = `
.ent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
.ent-card{background:#fff;border:1px solid var(--g200);border-left:3px solid var(--amber-500);border-radius:12px;padding:16px 18px;}
.ent-card.single{border-left-color:var(--g200);}
.ent-h{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.ent-n{font-size:16px;font-weight:900;}
.ent-c{font-size:11px;font-weight:700;background:var(--amber-50);color:var(--amber-700);border-radius:999px;padding:2px 9px;}
.ent-list{display:flex;flex-direction:column;gap:6px;}
.ent-mtg{display:flex;align-items:center;gap:8px;text-decoration:none;font-size:12.5px;padding:5px 7px;border-radius:7px;transition:background .15s;}
.ent-mtg:hover{background:var(--g100);}
.ent-mtg .ed{color:var(--g400);font-size:11px;flex-shrink:0;}
.ent-mtg .et{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ent-card.hide{display:none;}
.tg{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--g600);cursor:pointer;user-select:none;}`;
  const body = `<div class="tools"><input class="sbox" id="q" placeholder="🔍 人物・企業・キーワードでしぼり込む" oninput="filt()"><label class="tg"><input type="checkbox" id="all" onchange="filt()"> 1件のみのタグも表示</label><span class="count" id="cnt"></span></div><div class="ent-grid" id="grid">${cards}</div><p id="empty" style="display:none;color:var(--g400);text-align:center;padding:40px;">該当なし</p>`;
  const script = `function filt(){var q=(document.getElementById('q').value||'').trim().toLowerCase();var showAll=document.getElementById('all').checked;var n=0;document.querySelectorAll('.ent-card').forEach(function(c){var qhit=!q||c.dataset.name.toLowerCase().indexOf(q)>=0;var nhit=showAll||q||+c.dataset.n>=2;var ok=qhit&&nhit;c.classList.toggle('hide',!ok);if(ok)n++;});document.getElementById('cnt').textContent=n+'件';document.getElementById('empty').style.display=n?'none':'block';}var p=new URLSearchParams(location.search).get('q');if(p){document.getElementById('q').value=p;}filt();`;
  fs.writeFileSync(path.join(WORK, 'entity-index.html'),
    shell('ナレッジインデックス', '🔗', `人物・企業・キーワードでMTGを横断。横断タグ ${multi} 件（複数MTGに登場）／全 ${ents.length} タグ × ${records.length} MTG。`, body, script).replace('__STYLE__', style), 'utf8');
})();

/* ---- 3) decisions.html ---- */
(function () {
  const withDec = records.filter(r => r.decisions.length);
  const total = withDec.reduce((s, r) => s + r.decisions.length, 0);
  const blocks = withDec.map(r => {
    const items = r.decisions.map(d =>
      `<div class="dec"><div class="dec-ctx">${d.ctx ? esc(d.ctx) : '結論'}</div><div class="dec-tx">${esc(d.txt)}</div></div>`
    ).join('');
    return `<div class="dgroup" data-type="${r.type}" data-text="${esc((r.title + ' ' + r.decisions.map(d => d.txt).join(' ')).toLowerCase())}">
<a class="dg-head" href="${r.file}"><span class="badge b-${r.type}">${TYPE_LABEL[r.type]}</span><span class="dg-date">${r.date.replace(/-/g, '/')}</span><span class="dg-title">${esc(r.title)}</span><span class="dg-n">${r.decisions.length}件</span></a>
<div class="dg-body">${items}</div></div>`;
  }).join('');

  const style = `
.dgroup{background:#fff;border:1px solid var(--g200);border-radius:14px;padding:8px 8px 14px;margin-bottom:16px;}
.dg-head{display:flex;align-items:center;gap:10px;text-decoration:none;padding:10px 12px;border-radius:10px;}
.dg-head:hover{background:var(--g100);}
.dg-date{font-size:11px;color:var(--g400);flex-shrink:0;}
.dg-title{font-weight:800;font-size:15px;}
.dg-n{margin-left:auto;font-size:11px;font-weight:700;background:var(--amber-50);color:var(--amber-700);border-radius:999px;padding:2px 9px;flex-shrink:0;}
.dg-body{display:flex;flex-direction:column;gap:8px;padding:0 12px;}
.dec{background:linear-gradient(135deg,var(--amber-50),rgba(254,243,199,.45));border:1px solid #fde68a;border-radius:10px;padding:11px 14px;}
.dec-ctx{font-size:11px;font-weight:700;color:var(--amber-700);margin-bottom:3px;}
.dec-tx{font-size:13.5px;line-height:1.7;}
.dgroup.hide{display:none;}`;
  const body = `<div class="tools">
<button class="pill active" data-f="all" onclick="ft(this,'all')">すべて</button>
<button class="pill" data-f="internal" onclick="ft(this,'internal')">🏢 社内</button>
<button class="pill" data-f="external" onclick="ft(this,'external')">🤝 社外</button>
<input class="sbox" id="q" placeholder="🔍 決定事項を検索" oninput="sr(this.value)">
<span class="count" id="cnt">${total}件の決定</span></div>
<div id="list">${blocks}</div>
<p id="empty" style="display:none;color:var(--g400);text-align:center;padding:40px;">該当なし</p>`;
  const script = `var F='all',Q='';
function up(){var n=0;document.querySelectorAll('.dgroup').forEach(function(g){var t=F==='all'||g.dataset.type===F;var s=!Q||g.dataset.text.indexOf(Q)>=0;var ok=t&&s;g.classList.toggle('hide',!ok);if(ok)n++;});document.getElementById('empty').style.display=n?'none':'block';}
function ft(b,f){F=f;document.querySelectorAll('.pill').forEach(function(x){x.classList.remove('active')});b.classList.add('active');up();}
function sr(v){Q=(v||'').trim().toLowerCase();up();}`;
  fs.writeFileSync(path.join(WORK, 'decisions.html'),
    shell('決定事項ダッシュボード', '✅', `全 ${records.length} MTG から ${total} 件の決定・結論を集約。`, body, script).replace('__STYLE__', style), 'utf8');
})();

console.log(`gen-aux: ${records.length} pages -> search-index.json / entity-index.html / decisions.html`);
