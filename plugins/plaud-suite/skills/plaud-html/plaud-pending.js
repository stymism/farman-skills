#!/usr/bin/env node
'use strict';
/**
 * 止まりの検知（A-5・2026-10-29）: Plaud の録音のうち、議事録サイトに載っていない物を数える（読むだけ・Claude の目で数えない）
 *
 *   node plaud-pending.js <サイトのフォルダ> [--json]
 *
 * 入力:
 *   - Plaud の一覧: 環境変数 PLAUD_FOLDERS（既定 %TEMP%\plaud-folders.json。先に plaud-folders.ps1 を流す）
 *   - サイトの印: 各ページの <meta name="plaud-file-id" content="...">。印のまだ無いページは、
 *     環境変数 PLAUD_FILEID_MAP の対応表（{"<ページ>.html":{"file_id":"..."}}）があればそれで補う
 *   - 規則: PLAUD_RULES（既定 OneDrive の 右腕AI\00_Resources\plaud_規則.json）の folders・short_recording
 * 数えない物: 載せないフォルダ（面接・ようこそ・インポート）・載せない型（- Highlights・- 会議議事録・of_n_note:・面接/面談）・
 *   short_recording.auto_trash_sec 未満の短い録音（ゴミ箱の候補で、載せる物ではない）
 * 出力（1 行目が朝の報告にそのまま入る）:
 *   会議の取り込み: 載っていない録音 n 件（フォルダ済み a・未振り分け b）・いちばん古い物 m 日前（M/D 名前）
 *   m が 7 以上なら行頭に ■（赤）。n=0 なら「載っていない録音 0 件」
 * 終わりの値: 0（数えられた）/ 2（一覧が読めない＝「数えられず」と報告に書く）
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const SITE = process.argv[2];
const AS_JSON = process.argv.includes('--json');
const tryJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (e) { return null; } };
const oneDrive = process.env.OneDrive || path.join(os.homedir(), 'OneDrive');
const foldersPath = process.env.PLAUD_FOLDERS || path.join(os.tmpdir(), 'plaud-folders.json');
const rules = tryJson(process.env.PLAUD_RULES || path.join(oneDrive, '右腕AI', '00_Resources', 'plaud_規則.json')) || {};
const folders = tryJson(foldersPath);
if (!SITE || !fs.existsSync(SITE) || !Array.isArray(folders)) {
  console.log(`会議の取り込み: 数えられず（${!Array.isArray(folders) ? 'Plaud の一覧が読めない: ' + foldersPath + '。plaud-folders.ps1 を先に流す' : 'サイトのフォルダが無い: ' + SITE}）`);
  process.exit(2);
}

// サイトに載っている録音（ページの印＋対応表）
const onSite = new Set();
for (const f of fs.readdirSync(SITE).filter(f => /^\d{4}-\d{2}-\d{2}_.*\.html$/.test(f))) {
  const m = fs.readFileSync(path.join(SITE, f), 'utf8').match(/<meta\s+name="plaud-file-id"\s+content="([^"]+)"/);
  if (m) onSite.add(m[1]);
}
const map = process.env.PLAUD_FILEID_MAP ? tryJson(process.env.PLAUD_FILEID_MAP) : null;
if (map) for (const v of Object.values(map)) if (v && v.file_id) onSite.add(v.file_id);

const NO_FOLDER = new Set((rules.folders || {})['載せないフォルダ'] || ['面接', 'ようこそ', 'インポート']);
const shortSec = ((rules.short_recording || {}).auto_trash_sec) || 180;
const skipType = x => / - (Highlights|会議議事録)$/.test(x.name || '') || /^of_n_note:/.test(x.file_id) || /面接|面談|入社前/.test(x.name || '') || /^Welcome to Plaud/.test(x.name || '');
const today = new Date(); today.setHours(0, 0, 0, 0);
const recDate = x => {
  const m = (x.name || '').match(/^(\d{2})-(\d{2})/);
  const s = new Date(Number(x.start_ms) || 0);
  if (!m) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  let d = new Date(s.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  if (d - s > 180 * 864e5) d = new Date(s.getFullYear() - 1, Number(m[1]) - 1, Number(m[2]));   // 年またぎ（12 月の録音を 1 月に上げた）
  return d;
};

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;   // 日本の日付（toISOString は UTC で 1 日ずれる）
const pending = folders
  .filter(x => !NO_FOLDER.has(x.folder) && !skipType(x))
  .filter(x => !(x.duration_ms && x.duration_ms < shortSec * 1000))
  .filter(x => !onSite.has(x.file_id))
  .map(x => ({ file_id: x.file_id, name: x.name, folder: x.folder, date: recDate(x) }))
  .sort((a, b) => a.date - b.date);

const filed = pending.filter(x => x.folder !== '未振り分け').length;
const loose = pending.length - filed;
let line;
if (!pending.length) line = '会議の取り込み: 載っていない録音 0 件';
else {
  const o = pending[0], days = Math.round((today - o.date) / 864e5);
  line = `${days >= 7 ? '■ ' : ''}会議の取り込み: 載っていない録音 ${pending.length} 件（フォルダ済み ${filed}・未振り分け ${loose}）・いちばん古い物 ${days} 日前（${o.date.getMonth() + 1}/${o.date.getDate()} ${o.name}）`;
}
if (AS_JSON) console.log(JSON.stringify({ line, count: pending.length, filed, unfiled: loose, items: pending.map(x => ({ ...x, date: ymd(x.date) })) }, null, 1));
else {
  console.log(line);
  for (const x of pending.slice(0, 50)) console.log(`  ${ymd(x.date)} ${x.folder} ${x.file_id} ${x.name}`);
}
process.exit(0);
