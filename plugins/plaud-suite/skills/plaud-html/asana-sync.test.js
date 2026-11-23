#!/usr/bin/env node
// asana-sync.js の「番号で結ぶ口」のテスト（会議取り込み_log の `→ todo-N`）。実物には触らない。
// 使い方: node asana-sync.test.js （最後の行 ASANA_SYNC_TEST: OK / NG n）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { norm, readLog, link } = require('./asana-sync.js');

const FILE = 'f_abc123';
const item = (n, text, assignees = []) => ({ n, anchor: `todo-${n}`, text, title: text, assignees, others: [], due: null, hasSlot: !!assignees.length, key: norm(text) });
const pages = [{
  file: '2026-11-11_test.html', date: '2026-11-11', meeting: '商談', type: 'internal', fileId: FILE,
  items: [item(1, '請求書を送る', ['瀬戸山']), item(2, '見積を作る', ['瀬戸山']), item(3, '商談の内容を代表に共有する', ['瀬戸山']), item(4, '紹介に合う取引先を選び、紹介する', ['瀬戸山'])],
}];
const TITLE = '【右腕AI】A社に紹介できる取引先を選んで連絡する';
const GID = '1000000000000001';

function run(marker, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asana-sync-test-'));
  const logFile = path.join(dir, 'log.md');
  const id = opts.fileId || FILE;
  fs.writeFileSync(logFile, `- 2026-11-11\n  - 11-11「商談」 ${id}\n    - Asana 登録: ${GID} ${TITLE}(期限 2026-11-27。同上)${marker}\n`, 'utf8');
  const log = readLog(logFile);
  fs.rmSync(dir, { recursive: true, force: true });
  const g = { gid: GID, name: TITLE, completed: false, due_on: '2026-11-27', notes: '', projects: [opts.project || '瀬戸山'], isMeeting: true, src: null, hasLink: false };
  return { log, r: link(pages, { byGid: new Map([[g.gid, g]]) }, log) };
}

let ng = 0;
function check(name, ok) { console.log(`${ok ? 'OK' : 'NG'} ${name}`); if (!ok) ng++; }

let x = run('');
check('番号なしは今までどおり結ばない（一致度が低い）', x.r.links.length === 0 && x.r.unsure.length === 1);

x = run(' → todo-4');
check('log の番号を読む', x.log.registered[0] && x.log.registered[0].todoN === 4);
check('番号を題名に混ぜない', x.log.registered[0] && !/todo-/.test(x.log.registered[0].title));
check('正しい番号で結ぶ', x.r.links.length === 1 && x.r.links[0].anchor === 'todo-4' && /番号/.test(x.r.links[0].how));

x = run(' → todo-1');
check('わざと違う番号は止まる（別の行の方が近い）', x.r.links.length === 0 && /番号/.test((x.r.unsure[0] || {}).reason || ''));

x = run(' → todo-9');
check('無い番号は止まる', x.r.links.length === 0 && /todo-9/.test((x.r.unsure[0] || {}).reason || ''));

x = run(' → todo-4', { fileId: 'f_fff999' });
check('録音の印のページが無ければ止まる', x.r.links.length === 0 && x.r.unsure.length === 1);

x = run(' → todo-4', { project: '井出' });
check('担当が違えば番号があっても止まる', x.r.links.length === 0 && /担当が違う/.test((x.r.unsure[0] || {}).reason || ''));

// 読み取りの欠け（11-17 夜: 1 件が入力に無く、同じ題の別の gid にすり替わったのに終了コード 0 だった）
const mod = require('./asana-sync.js');
const prev = { people: { 担当A: [{ gid: 'a' }, { gid: null }] }, unassigned: [], multi: [{ gid: 'b' }] };
const miss = (tasks, gone) => (mod.missingFromRead ? mod.missingFromRead(prev, tasks, gone) : null);
check('前回あった宿題が読み取りに無ければ出す', JSON.stringify(miss([{ gid: 'b' }], [])) === '["a"]');
check('全部あれば何も出さない', JSON.stringify(miss([{ gid: 'a' }, { gid: 'b' }], [])) === '[]');
check('--gone で確かめた物は出さない', JSON.stringify(miss([{ gid: 'b' }], ['a'])) === '[]');
check('前回の todos.json が無ければ止めない', !!mod.missingFromRead && mod.missingFromRead(null, [], []).length === 0);

// 入力の順番で todos.json の並びが変わらない
const row = (gid) => ({ done: false, due: null, date: '2026-08-14', gid, page: 'p.html', anchor: 'todo-1', title: 't' });
const sorted = (ids) => (mod.todoSort ? ids.map(row).sort(mod.todoSort).map((r) => r.gid).join() : null);
check('同じ期限・同じ日の行は gid の順に固定', sorted(['3', '1', '2']) === '1,2,3' && sorted(['2', '3', '1']) === '1,2,3');

console.log(ng ? `ASANA_SYNC_TEST: NG ${ng}` : 'ASANA_SYNC_TEST: OK');
process.exitCode = ng ? 1 : 0;
