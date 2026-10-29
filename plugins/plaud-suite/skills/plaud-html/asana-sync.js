#!/usr/bin/env node
/*
 * asana-sync.js — 議事録サイトの宿題と Asana をつなぐ（全体改善案 v1.0 §4 AS2・AS5）
 *
 * 宿題の正本は Asana。サイトは映すだけ（本人 10-29「はい」）。
 * このスクリプトは Asana に直接つながない（トークンを持たない・作らない）。
 * Claude が Asana コネクタの get_tasks で各人のプロジェクトを全部読み、その結果を JSON にして渡す。
 *
 * 使い方:
 *   node asana-sync.js --site <サイトのリポ> --asana <asana.json|tasks.tsv> [--log <会議取り込み_log.md>]
 *        [--out <todos.json>] [--notes-plan <notes_plan.json>] [--apply-pages] [--pages-dir <dir>]
 *        [--today YYYY-MM-DD] [--dry-run]
 *
 *   --site        ~/.plaud/farman-mtg-site（2026-*.html を読む。--apply-pages のときだけ書く）
 *   --asana       Claude が get_tasks で読んだ結果（形は下の「入力の形」）
 *   --log         00_Resources/会議取り込み_log.md（`Asana 登録: <gid>` と `登録せず: 題名 — 理由` を読む）
 *   --out         既定 <site>/data/todos.json（一覧の「宿題」タブが読む。書くのはこのスクリプトだけ）
 *   --notes-plan  Asana の notes の 2 行目に足す行の計画（Claude が update_tasks で書く。スクリプトは書かない）
 *   --apply-pages ページの宿題行に data-asana="<gid>" と data-done="1" を付ける（何度流しても同じ結果）
 *   --pages-dir   --apply-pages で書くページの置き場（既定は --site。試すときは写しの置き場を指す）
 *   --dry-run     何も書かず、数だけ出す
 *
 * 入力の形（--asana の .json）:
 *   {"read_at":"2026-10-29T18:00:00+09:00",
 *    "projects":{"井上":"1214760900570651", ...},
 *    "tasks":[{"gid":"…","project":"井上","completed":false,"due_on":"2026-11-05"|null,
 *              "name":"…","notes":"…（全文。少なくとも 1 行目）"}]}
 *   同じ gid が 2 つのプロジェクトにあれば 2 行（project だけ違う）で入れてよい。
 *   .tsv は「gid<TAB>project<TAB>completed(0/1)<TAB>due_on<TAB>出典<TAB>name」（# の行は飛ばす）。
 *
 * 宿題行の番号 n: ページの宿題行（今は <li class="action-item">、新テンプレは id="todo-<n>"）の順番＝1 から。
 * 結び方（確かな物だけ）: 出典（notes 1 行目の「出典：YYYY-MM-DD <会議名>」、または【右腕AI】の
 *   「出典: <録音の題名> <録音日> Plaud <file_id>」→ ページの meta plaud-file-id）でページを 1 本に決め、
 *   宿題の文（「：担当：期限」と【右腕AI】・空白・記号を外す）と Asana の題名が同じ、または片方がもう片方を含み長さが 8 割以上。
 *   それ以外は結ばず、unsure に理由つきで出す。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PEOPLE = ['井上', '瀬戸山', '井出', '田中', '関根', '豊田', '青柳'];
const ALIASES = { '章': '瀬戸山', 'しょう': '瀬戸山', '翔': '瀬戸山', '瀬戸': '瀬戸山' };
const DEFAULT_PROJECTS = { // 秘書 Resources/手順_会議の宿題のAsana登録.md の表（10-29 get_projects で確かめた）
  '関根': '1214760871469747', '井出': '1214760871469759', '田中': '1214760871469775', '豊田': '1214760871469796',
  '青柳': '1214760871469806', '瀬戸山': '1214760871469812', '井上': '1214760900570651', '複数人': '1214855321951743',
};
const SITE_URL = 'https://farman-gijiroku.pages.dev';

// ---------- 引数 ----------
function parseArgs(argv) {
  const a = { applyPages: false, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--site') a.site = v();
    else if (k === '--asana') a.asana = v();
    else if (k === '--log') a.log = v();
    else if (k === '--out') a.out = v();
    else if (k === '--notes-plan') a.notesPlan = v();
    else if (k === '--apply-pages') a.applyPages = true;
    else if (k === '--pages-dir') a.pagesDir = v();
    else if (k === '--today') a.today = v();
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '-h' || k === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
    else { console.error('知らない引数: ' + k); process.exit(2); }
  }
  if (!a.site || !a.asana) { console.error('--site と --asana は必ず要る（-h で使い方）'); process.exit(2); }
  a.out = a.out || path.join(a.site, 'data', 'todos.json');
  a.pagesDir = a.pagesDir || a.site;
  return a;
}

// ---------- 正規化 ----------
function norm(s) {
  return String(s || '')
    .replace(/【右腕AI】/g, '')
    .normalize('NFKC')
    .replace(/[\s　]/g, '')
    .replace(/[、。，．,.・:：;；!！?？「」『』（）()\[\]【】〈〉<>"'“”‘’\-－―ー〜~／/]/g, '')
    .toLowerCase();
}
function stripHtml(s) {
  return String(s).replace(/<button[\s\S]*?<\/button>/gi, '').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function personOf(token) {
  const t = String(token).normalize('NFKC').replace(/(さん|君|くん|氏|様|代表|社長)$/g, '').trim();
  if (PEOPLE.includes(t)) return t;
  if (ALIASES[t]) return ALIASES[t];
  return null;
}
function splitNames(s) {
  return String(s).split(/[、,，・\/／&＆と\s]+/).map((x) => x.trim()).filter(Boolean);
}

// 宿題の文 → {title, assignees, others, due}
function parseItem(text, pageDate) {
  let t = text.trim();
  let assignees = []; let others = []; let due = null; let slot = false;
  const takeNames = (s) => { for (const n of splitNames(s)) { const p = personOf(n); if (p) { if (!assignees.includes(p)) assignees.push(p); } else others.push(n); } slot = true; };
  // 形2（先に見る）: …（担当: 井出・瀬戸山）／…（担当：瀬戸山、期限：6/11）
  const m2 = t.match(/[（(]担当[:：]\s*([^）)、,]+?)(?:[、,]\s*期限[:：]\s*([^）)]+))?[）)]\s*$/);
  if (m2) { takeNames(m2[1]); if (m2[2] && !due) due = toDate(m2[2], pageDate); t = t.slice(0, m2.index).trim(); }
  // 形1: 何を：担当：期限 / 何を：担当
  const parts = t.split('：');
  if (!slot && parts.length >= 2) {
    let last = parts[parts.length - 1].trim();
    const dueRe = /^(\d{1,2})\/(\d{1,2})）?$|^-$/;
    if (parts.length >= 3 && dueRe.test(last)) {
      due = toDate(last, pageDate);
      parts.pop();
      last = parts[parts.length - 1].trim();
    }
    if (parts.length >= 2 && splitNames(last).some((n) => personOf(n)) || (parts.length >= 2 && last.length <= 20 && /^[^\s、。]{1,6}([、,・][^\s、。]{1,6})*$/.test(last))) {
      takeNames(last); parts.pop();
      t = parts.join('：');
    }
  }
  // 形3: 田中君、しょう君、関根さん: …
  const m3 = t.match(/^([^:：]{1,30})[:：]\s*(.+)$/);
  if (!slot && m3 && splitNames(m3[1]).every((n) => personOf(n) || /(さん|君|くん|氏)$/.test(n))) { takeNames(m3[1]); t = m3[2].trim(); }
  if (/^【監査員】/.test(t)) { others.push('監査員'); slot = true; }
  return { title: t, assignees, others, due, hasSlot: slot };
}
function toDate(md, pageDate) {
  const m = String(md).match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  let y = Number(pageDate.slice(0, 4));
  const pm = Number(pageDate.slice(5, 7));
  const mm = Number(m[1]);
  if (mm < pm - 6) y += 1; // 12 月の会議で「1/15」なら翌年
  return `${y}-${String(mm).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

// ---------- ページを読む ----------
function readPages(siteDir) {
  const files = fs.readdirSync(siteDir).filter((f) => /^\d{4}-\d{2}-\d{2}_.+\.html$/.test(f)).sort();
  return files.map((f) => {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf8');
    const date = f.slice(0, 10);
    const tm = html.match(/<title>([^<]*)<\/title>/);
    const meeting = tm ? tm[1].split(/\s*[—–]\s*Farman/)[0].trim() : f;
    const fm = html.match(/<meta\s+name="plaud-file-id"\s+content="([^"]+)"/);
    // 10-29 夜: ページの種類（社内／社外／講話）。社外・講話で担当の書いていない宿題は「担当の記載なし」（赤の担当未定にしない）
    const km = html.match(/class="[^"]*\bbadge-header-(internal|external|kowa)\b/);
    const type = km ? km[1] : 'external';
    return { file: f, date, meeting, type, fileId: fm ? fm[1] : null, items: extractItems(html, date) };
  });
}
// 宿題行: id="todo-<n>" があればそれ（新テンプレ）、無ければ <li class="action-item"> の順番
function findItemTags(html) {
  const byId = [...html.matchAll(/<(\w+)\b[^>]*\bid="todo-(\d+)"[^>]*>/g)];
  if (byId.length) return byId.map((m) => ({ index: m.index, tag: m[0], name: m[1], n: Number(m[2]) }));
  const re = /<li\b[^>]*\bclass="[^"]*\baction-item\b[^"]*"[^>]*>/g;
  let n = 0;
  return [...html.matchAll(re)].map((m) => ({ index: m.index, tag: m[0], name: 'li', n: ++n }));
}
function extractItems(html, date) {
  return findItemTags(html).map((t) => {
    const start = t.index + t.tag.length;
    const end = html.indexOf(`</${t.name}>`, start);
    const inner = html.slice(start, end < 0 ? start : end);
    // 10-29 夜: 新しい作りの行は「担当・何を・期限」が別の span。行の文字を全部つなぐと「担当未定9月20日頃に…期限なし」になっていた
    //   → 題名は td-what だけ、担当は td-who（社員の表記に合う物だけ）、期限は td-due から読む
    const what = inner.match(/<span class="td-what">([\s\S]*?)<\/span>\s*<span class="td-due/);
    if (what) {
      const whoM = inner.match(/<span class="(td-who[^"]*)">([\s\S]*?)<\/span>/);
      const dueM = inner.match(/<span class="td-due[^"]*">([\s\S]*?)<\/span>/);
      const title = stripHtml(what[1]);
      const assignees = []; const others = [];
      const none = !whoM || /\btd-none\b/.test(whoM[1]);
      if (!none) for (const n of splitNames(stripHtml(whoM[2]))) { const q = personOf(n); if (q) { if (!assignees.includes(q)) assignees.push(q); } else others.push(n); }
      const due = dueM ? toDate(stripHtml(dueM[1]), date) : null;
      return { n: t.n, anchor: `todo-${t.n}`, text: title, title, assignees, others, due, hasSlot: !none, key: norm(title) };
    }
    const lab = inner.match(/<label\b[^>]*>([\s\S]*?)<\/label>/);
    const text = stripHtml(lab ? lab[1] : inner);
    const p = parseItem(text, date);
    return { n: t.n, anchor: `todo-${t.n}`, text, ...p, key: norm(p.title) };
  });
}

// ---------- Asana の入力 ----------
function readAsana(file) {
  const raw = fs.readFileSync(file, 'utf8');
  let doc;
  if (/\.tsv$/i.test(file)) {
    const tasks = raw.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
      const [gid, project, c, due, src, name] = l.split('\t');
      return { gid, project, completed: c === '1', due_on: due || null, name, notes: '出典：' + src };
    });
    doc = { read_at: fs.statSync(file).mtime.toISOString(), projects: DEFAULT_PROJECTS, tasks };
  } else doc = JSON.parse(raw);
  doc.projects = Object.assign({}, DEFAULT_PROJECTS, doc.projects || {});
  // gid ごとにまとめる（同じ gid が複数のプロジェクトにある）
  const byGid = new Map();
  for (const t of doc.tasks) {
    const g = byGid.get(t.gid) || { gid: t.gid, name: t.name, completed: !!t.completed, due_on: t.due_on || null, notes: t.notes || '', projects: [] };
    if (!g.projects.includes(t.project)) g.projects.push(t.project);
    g.completed = g.completed || !!t.completed;
    byGid.set(t.gid, g);
  }
  for (const g of byGid.values()) {
    const line1 = (g.notes.split(/\r?\n/)[0] || '').trim();
    g.line1 = line1;
    g.hasLink = /(^|\n)議事録:\s*https?:\/\//.test(g.notes);
    let m;
    if ((m = line1.match(/^出典[：:]\s*(\d{4}-\d{2}-\d{2})\s+(.+?)(?:（担当[：:][^）]*）)?\s*$/))) {
      g.src = { kind: 'plaud-html', date: m[1], meeting: m[2].trim() };
    } else if ((m = line1.match(/出典[:：]\s*(.+?)\s+(\d{4}-\d{2}-\d{2})\s+Plaud\s+(\S+)/))) {
      g.src = { kind: 'right-arm', title: m[1].trim(), date: m[2], fileId: m[3] };
    } else g.src = null;
    g.isMeeting = !!g.src || /^【右腕AI】/.test(g.name);
  }
  return { doc, byGid };
}

// ---------- 会議取り込み_log ----------
function readLog(file) {
  const out = { registered: [], notRegistered: [] };
  if (!file || !fs.existsSync(file)) return out;
  let cur = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const rec = line.match(/^\s*-\s*(\d{1,2}-\d{2})「([^」]+)」\s*((?:o?f_)[0-9a-f]+)/);
    if (rec) { cur = { md: rec[1], title: rec[2], fileId: rec[3] }; continue; }
    if (/^- \d{4}-\d{2}-\d{2}/.test(line)) { const y = line.match(/^- (\d{4})/)[1]; cur = null; out._year = y; continue; }
    let m;
    if ((m = line.match(/Asana 登録:\s*(\d{10,})\s+(.+?)(?:[（(]期限\s*(\d{4}-\d{2}-\d{2})[）)])?\s*$/))) {
      out.registered.push({ gid: m[1], title: m[2].trim(), due: m[3] || null, rec: cur });
    } else if ((m = line.match(/登録せず:\s*(.+?)\s+[—\-–]\s+(.+)$/))) {
      out.notRegistered.push({ title: m[1].trim(), reason: m[2].trim(), rec: cur, year: out._year || null });
    } else if (/^\s+-\s*答え\s/.test(line) && out.notRegistered.length) {
      out.notRegistered[out.notRegistered.length - 1].answered = line.trim(); // 本人が答えた物は「担当なし」に出さない（手順 D）
    }
  }
  return out;
}

// ---------- 結ぶ ----------
function similar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return l.includes(s) && s.length / l.length >= 0.8;
}
function dice(a, b) {
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = bg(a); const B = bg(b); let inter = 0; let na = 0; let nb = 0;
  for (const v of A.values()) na += v; for (const v of B.values()) nb += v;
  for (const [k, v] of A) inter += Math.min(v, B.get(k) || 0);
  return na + nb ? (2 * inter) / (na + nb) : 0;
}
function link(pages, asana, log) {
  const pageByFile = new Map(pages.map((p) => [p.file, p]));
  const logByGid = new Map(log.registered.map((r) => [r.gid, r]));
  const links = []; const unsure = [];
  for (const g of asana.byGid.values()) {
    if (!g.isMeeting) continue;
    let cands = [];
    const lr = logByGid.get(g.gid);
    const fileId = (g.src && g.src.fileId) || (lr && lr.rec && lr.rec.fileId);
    if (fileId) cands = pages.filter((p) => p.fileId === fileId);
    if (!cands.length && g.src && g.src.date) {
      const sameDay = pages.filter((p) => p.date === g.src.date);
      const want = norm((g.src.meeting || g.src.title || '').replace(/^\d{2}-\d{2}\s*/, ''));
      cands = sameDay.filter((p) => norm(p.meeting.replace(/^\d{2}-\d{2}\s*/, '')) === want);
      if (!cands.length) cands = sameDay; // 題名が変わっていても、同じ日のページの中で文が一致すれば結ぶ
    }
    if (!cands.length) { unsure.push({ gid: g.gid, name: g.name, reason: 'ページが見つからない（出典の日付・会議名・file_id に当たるページが無い）', src: g.src }); continue; }
    const key = norm(g.name);
    const hits = [];
    for (const p of cands) for (const it of p.items) if (similar(key, it.key)) hits.push({ p, it, exact: key === it.key });
    let pick = hits.filter((h) => h.exact);
    if (pick.length !== 1) pick = pick.length ? pick : hits;
    let how = pick.length === 1 ? (pick[0].exact ? '同じ文' : '片方が含む') : null;
    if (!pick.length) {
      // 言い回しが少し違う物（「評価」/「を評価する」、會舘/会館）: 2 文字ずつの一致度 0.75 以上で、2 番目と 0.15 以上の差がある 1 行だけ
      const sc = [];
      for (const p of cands) for (const it of p.items) sc.push({ p, it, d: dice(key, it.key) });
      sc.sort((x, y) => y.d - x.d);
      if (sc.length && sc[0].d >= 0.75 && (sc.length === 1 || sc[0].d - sc[1].d >= 0.15)) { pick = [sc[0]]; how = `似た文(${sc[0].d.toFixed(2)})`; }
    }
    if (pick.length !== 1) {
      unsure.push({ gid: g.gid, name: g.name, reason: pick.length ? `ページの宿題に同じ文が ${pick.length} 行ある` : 'ページの宿題の文と一致しない', src: g.src, pages: cands.map((p) => p.file) });
      continue;
    }
    const { p, it } = pick[0];
    // 担当の食い違い（人のプロジェクトにあるのに、ページの担当にその人がいない）は確かでないとして結ばない
    const persons = g.projects.filter((x) => x !== '複数人');
    if (it.assignees.length && persons.length && !persons.some((x) => it.assignees.includes(x))) {
      unsure.push({ gid: g.gid, name: g.name, reason: `担当が違う（Asana: ${persons.join('・')} / ページ: ${it.assignees.join('・')}）`, page: p.file, anchor: it.anchor });
      continue;
    }
    links.push({ gid: g.gid, page: p.file, anchor: it.anchor, n: it.n, projects: g.projects, completed: g.completed, how, page_text: it.text });
  }
  return { links, unsure, pageByFile };
}

// ---------- todos.json ----------
function asanaUrl(projects, projGid, gid) { return `https://app.asana.com/0/${projGid}/${gid}`; }
function buildTodos(pages, asana, linked, log, readAt) {
  const people = Object.fromEntries(PEOPLE.map((p) => [p, []]));
  const unassigned = [];
  const multi = []; // Asana の「複数人」プロジェクトにある宿題（人のプロジェクトに無い物）。ページの担当の人の欄にも出す
  const projGid = asana.doc.projects;
  const byItem = new Map(); // page#anchor -> [link]
  for (const l of linked.links) { const k = l.page + '#' + l.anchor; (byItem.get(k) || byItem.set(k, []).get(k)).push(l); }
  const pageMap = linked.pageByFile;
  const used = new Set();
  const entry = (g, person, project) => {
    const l = linked.links.find((x) => x.gid === g.gid);
    const p = l ? pageMap.get(l.page) : null;
    const it = l && p ? p.items.find((i) => i.anchor === l.anchor) : null;
    return {
      title: g.name.replace(/^【右腕AI】/, ''), due: g.due_on, done: !!g.completed, gid: g.gid,
      asana_url: asanaUrl(projGid, projGid[project], g.gid),
      page: l ? l.page : null, anchor: l ? l.anchor : null,
      meeting: p ? p.meeting : (g.src && (g.src.meeting || g.src.title)) || null,
      date: p ? p.date : (g.src && g.src.date) || null,
      with: it ? it.assignees.filter((x) => x !== person) : [],
    };
  };
  // 1) Asana にある会議の宿題（人のプロジェクトごと）
  for (const g of asana.byGid.values()) {
    if (!g.isMeeting) continue;
    for (const proj of g.projects) {
      if (PEOPLE.includes(proj)) { people[proj].push(entry(g, proj, proj)); used.add(g.gid); }
    }
  }
  // 2) 「複数人」だけにある物: ページの担当の各人へ（その人の分が人のプロジェクトに無いときだけ）。結べなければ unassigned
  for (const g of asana.byGid.values()) {
    if (!g.isMeeting || g.projects.some((x) => PEOPLE.includes(x))) continue;
    const l = linked.links.find((x) => x.gid === g.gid);
    const it = l ? pageMap.get(l.page).items.find((i) => i.anchor === l.anchor) : null;
    const who = it ? it.assignees : [];
    // 10-29 夜: 「複数人」の宿題は担当未定に入れない。必ず multi（宿題タブの「複数人」）に入れ、ページの担当の人の欄にも出す
    //   （その人の分が人のプロジェクトに無いときだけ。重ねて出さない）。ページと結べず担当が読めない物も multi（assignees 空・理由つき）
    for (const person of who) {
      const k = l.page + '#' + l.anchor;
      const own = (byItem.get(k) || []).some((x) => x.projects.includes(person));
      if (!own) people[person].push(entry(g, person, '複数人'));
    }
    multi.push(Object.assign({}, entry(g, null, '複数人'), { assignees: who }, who.length ? {} : { reason: '複数人のプロジェクトにあり、ページと結べず担当が読めない' }));
    used.add(g.gid);
  }
  // 3) ページにしか無い宿題（gid null）
  for (const p of pages) for (const it of p.items) {
    const k = p.file + '#' + it.anchor;
    const ls = byItem.get(k) || [];
    const base = { title: it.title, due: it.due, done: false, gid: null, asana_url: null, page: p.file, anchor: it.anchor, meeting: p.meeting, date: p.date };
    if (!it.assignees.length) {
      const ext = p.type !== 'internal' && !/ファーマン(社)?側|^ファーマン|当社|自社/.test(it.title);
      if (!ls.length) unassigned.push(Object.assign({}, base, { reason: it.others.length ? `社内の 7 人以外（${it.others.join('・')}）` : (ext ? '社外のページ・担当の記載なし' : '担当が書いていない') }, ext ? { external: true } : {}));
      continue;
    }
    for (const person of it.assignees) {
      const has = ls.some((x) => x.projects.includes(person)) ||
        ls.some((x) => x.projects.includes('複数人') && !x.projects.some((y) => PEOPLE.includes(y)));
      if (!has) people[person].push({ ...base, with: it.assignees.filter((x) => x !== person) });
    }
  }
  // 4) 会議の取り込みが登録しなかった宿題（log の「登録せず」）
  for (const r of log.notRegistered) {
    if (r.answered) continue;
    unassigned.push({ title: r.title, due: null, done: false, gid: null, asana_url: null, page: null, anchor: null,
      meeting: r.rec ? r.rec.title : null, date: r.rec && r.year ? `${r.year}-${r.rec.md}` : null, reason: r.reason, source: 'log' });
  }
  const sortFn = (a, b) => (a.done - b.done) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(b.date || '').localeCompare(String(a.date || ''));
  for (const k of PEOPLE) people[k].sort(sortFn);
  unassigned.sort(sortFn); multi.sort(sortFn);
  const total = Object.values(people).reduce((n, a) => n + a.length, 0) + unassigned.length + multi.length;
  return { generated: jstNow(), source: 'asana', asana_read_at: readAt, total, people, unassigned, multi };
}
function jstNow() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return d.toISOString().replace(/\.\d+Z$/, '+09:00');
}

// ---------- notes の計画（AS2）----------
function buildNotesPlan(asana, linked) {
  const plan = [];
  for (const l of linked.links) {
    const g = asana.byGid.get(l.gid);
    const url = `${SITE_URL}/${l.page.replace(/\.html$/, '')}.html#${l.anchor}`;
    const add = `議事録: ${url}`;
    if (g.hasLink) { plan.push({ gid: l.gid, skip: '既に議事録の行がある' }); continue; }
    const lines = g.notes.split(/\r?\n/);
    const newNotes = [lines[0], add, ...lines.slice(1)].join('\n');
    plan.push({ gid: l.gid, name: g.name, line1: lines[0], add, new_notes: newNotes });
  }
  return plan;
}

// ---------- ページに印を付ける（--apply-pages）----------
function applyPages(dir, linked, asana) {
  const byPage = new Map();
  for (const l of linked.links) (byPage.get(l.page) || byPage.set(l.page, []).get(l.page)).push(l);
  const result = [];
  for (const [file, ls] of byPage) {
    const fp = path.join(dir, file);
    if (!fs.existsSync(fp)) { result.push({ file, skipped: '置き場に無い' }); continue; }
    let html = fs.readFileSync(fp, 'utf8');
    const tags = findItemTags(html);
    const byN = new Map();
    for (const l of ls) (byN.get(l.n) || byN.set(l.n, []).get(l.n)).push(l);
    let changed = 0; const edits = [];
    for (const t of tags) {
      const group = byN.get(t.n);
      let tag = t.tag.replace(/\s+data-asana="[^"]*"/g, '').replace(/\s+data-done="[^"]*"/g, '');
      if (group) {
        // 印の gid: 「複数人」にあればそれ、無ければ人のプロジェクトの最初の物
        const main = group.find((x) => x.projects.includes('複数人')) || group[0];
        const done = group.every((x) => asana.byGid.get(x.gid).completed);
        tag = tag.replace(/\s*(\/?)>$/, ` data-asana="${main.gid}"${done ? ' data-done="1"' : ''}$1>`);
      }
      if (tag !== t.tag) edits.push({ index: t.index, from: t.tag, to: tag });
    }
    for (const e of edits.sort((a, b) => b.index - a.index)) { html = html.slice(0, e.index) + e.to + html.slice(e.index + e.from.length); changed++; }
    if (changed) fs.writeFileSync(fp, html, 'utf8');
    result.push({ file, changed, items: tags.length });
  }
  return result;
}

// 10-29 夜: 誤字（plaud_規則.json の typos で gate=true の物）を todos.json の文字（題名・会議名・理由）にも当てる。
//   Asana の題名は Plaud の聞き違い（北斗市役所 など）をそのまま持つことがあるため。Asana の方は直さない（映すだけ）
function loadTypos() {
  const os = require('os');
  const p = process.env.PLAUD_RULES || path.join(process.env.OneDrive || path.join(os.homedir(), 'OneDrive'), '右腕AI', '00_Resources', 'plaud_規則.json');
  try {
    const R = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
    const esc = (s) => s.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
    return (((R.typos || {}).list) || []).filter((x) => x.gate === true && x['正'] && !/[？?（(]/.test(x['正']))
      .map((x) => ({ re: new RegExp(x.pattern || esc(x['誤']), 'g'), to: x['正'] }));
  } catch (e) { return []; }
}
function fixTypos(t) {
  const T = loadTypos();
  if (!T.length) return t;
  const fx = (s) => (typeof s === 'string' ? T.reduce((a, x) => a.replace(x.re, x.to), s) : s);
  const row = (x) => Object.assign({}, x, { title: fx(x.title), meeting: fx(x.meeting) }, x.reason ? { reason: fx(x.reason) } : {});
  for (const k of Object.keys(t.people)) t.people[k] = t.people[k].map(row);
  t.unassigned = t.unassigned.map(row); t.multi = t.multi.map(row);
  return t;
}

// 載せないと決めた録音（plaud_掲載の承認.json の「載せない」.件）。場所は PLAUD_APPROVED（audit.js と同じ）
function loadNoPublish() {
  const os = require('os');
  const p = process.env.PLAUD_APPROVED || path.join(process.env.OneDrive || path.join(os.homedir(), 'OneDrive'), '右腕AI', '00_Resources', 'plaud_掲載の承認.json');
  let L = [];
  try { L = ((JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''))['載せない'] || {})['件']) || []; } catch (e) { L = []; }
  return { ids: new Set(L.map((x) => x.file_id).filter(Boolean)), meetings: L.map((x) => ({ date: x['録音日'], key: norm(String(x['会議名'] || '').replace(/^\d{2}-\d{2}\s*/, '')) })) };
}
function isNoPublish(src, np) {
  if (!src) return false;
  if (src.fileId && np.ids.has(src.fileId)) return true;
  const k = norm(String(src.meeting || src.title || '').replace(/^\d{2}-\d{2}\s*/, ''));
  return np.meetings.some((m) => m.date === src.date && m.key && m.key === k);
}

// todos.json は 1 件 1 行（差分が読みやすく、軽い）。壊れた JSON は書かない
function formatTodos(t) {
  const list = (arr) => '[' + (arr.length ? '\n' + arr.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n ' : '') + ']';
  const head = { generated: t.generated, source: t.source, asana_read_at: t.asana_read_at, total: t.total };
  let out = JSON.stringify(head).slice(0, -1) + ',\n"people":{\n';
  out += Object.keys(t.people).map((k) => ' ' + JSON.stringify(k) + ':' + list(t.people[k])).join(',\n');
  out += '\n},\n"unassigned":' + list(t.unassigned) + ',\n"multi":' + list(t.multi) + '\n}\n';
  JSON.parse(out);
  return out;
}

// ---------- main ----------
function main() {
  const a = parseArgs(process.argv);
  const pages = readPages(a.site);
  const asana = readAsana(a.asana);
  const log = readLog(a.log);
  // 10-29 夜: 載せないと決めた録音（plaud_掲載の承認.json の「載せない」）を出典とする宿題は todos.json に出さない
  //   （06-24 採用の会議の「内定通知」「再面談」がページを外した後も宿題タブに残っていた）
  const noPub = loadNoPublish();
  const excluded = [];
  for (const [gid, g] of asana.byGid) if (isNoPublish(g.src, noPub)) { excluded.push(g.name); asana.byGid.delete(gid); }
  log.notRegistered = log.notRegistered.filter((r) => !(r.rec && noPub.ids.has(r.rec.fileId)));
  const linked = link(pages, asana, log);
  const todos = buildTodos(pages, asana, linked, log, asana.doc.read_at || null);
  const plan = buildNotesPlan(asana, linked);

  const meeting = [...asana.byGid.values()].filter((g) => g.isMeeting);
  const count = (arr) => ({ open: arr.filter((x) => !x.completed && !x.done).length, done: arr.filter((x) => x.completed || x.done).length });
  const todoGids = new Map();
  for (const list of [...Object.values(todos.people), todos.unassigned, todos.multi]) for (const t of list) if (t.gid) todoGids.set(t.gid, t.done);
  const summary = {
    pages: pages.length, items: pages.reduce((s, p) => s + p.items.length, 0),
    asana_meeting_tasks: meeting.length, asana_open_done: count(meeting),
    todos_gids: todoGids.size, todos_open_done: { open: [...todoGids.values()].filter((d) => !d).length, done: [...todoGids.values()].filter((d) => d).length },
    todos_rows: Object.fromEntries(PEOPLE.map((p) => [p, todos.people[p].length])), unassigned_rows: todos.unassigned.length,
    unassigned_internal: todos.unassigned.filter((x) => !x.external).length, unassigned_external: todos.unassigned.filter((x) => x.external).length, multi_rows: todos.multi.length,
    page_only_rows: [...Object.values(todos.people), todos.unassigned].flat().filter((t) => !t.gid).length,
    linked: linked.links.length, unsure: linked.unsure.length, excluded_no_publish: excluded.length,
    notes_to_add: plan.filter((x) => !x.skip).length, notes_already: plan.filter((x) => x.skip).length,
  };
  if (!a.dryRun) {
    fs.mkdirSync(path.dirname(a.out), { recursive: true });
    fs.writeFileSync(a.out, formatTodos(fixTypos(todos)), 'utf8');
    if (a.notesPlan) fs.writeFileSync(a.notesPlan, JSON.stringify({ links: linked.links, notes: plan, unsure: linked.unsure }, null, 1) + '\n', 'utf8');
  }
  if (a.applyPages && !a.dryRun) {
    const r = applyPages(a.pagesDir, linked, asana);
    summary.apply = { pages_changed: r.filter((x) => x.changed).map((x) => `${x.file}(${x.changed})`), pages_same: r.filter((x) => x.changed === 0).length, pages_missing: r.filter((x) => x.skipped).length };
  }
  console.log(JSON.stringify(summary, null, 1));
  if (linked.unsure.length) { console.log('結ばなかった物（確かでない）:'); for (const u of linked.unsure) console.log(`  ${u.gid} ${u.name} — ${u.reason}`); }
  if (summary.todos_gids !== summary.asana_meeting_tasks) { console.error(`照合ずれ: todos.json の gid ${summary.todos_gids} 件 ≠ Asana の会議の宿題 ${summary.asana_meeting_tasks} 件`); process.exitCode = 1; }
}
if (require.main === module) main();
module.exports = { norm, parseItem, readPages, readAsana, readLog, link, buildTodos, buildNotesPlan, applyPages };
