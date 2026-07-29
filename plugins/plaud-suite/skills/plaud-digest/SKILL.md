---
name: plaud-digest
version: 1.0.0
description: "Summarize multiple Plaud recordings into a digest. Use when the user says 'weekly report', 'digest of this month', 'what meetings did I have this week', 'recap of last quarter', or asks to roll up multiple recordings into one overview."
metadata:
  requires:
    bins: []
---

# plaud-digest

**Read [`plaud-shared`](../plaud-shared/SKILL.md) first.**

## When to use

- User asks for a roll-up across multiple recordings.
- Time window is explicit ("this week") or implicit ("recap of recent meetings").
- Scope is "what happened", not "find one specific meeting" (that's `plaud-find`).

## Steps

1. **Resolve the window.** Use the date interpretation table in `plaud-find` for relative phrases.
2. **List the corpus.** `list_files` with `date_from` / `date_to`. Cap at 50 recordings — if the window returns more, ask the user to narrow it.
3. **Fetch notes in batch.** For each recording, call `get_note`. Do **not** call `get_transcript` unless a specific recording merits a deeper pull.
4. **Synthesize.** Produce a structured digest:
   - **Headline** — one-line theme of the window.
   - **By recording** — one bullet per recording: `• name (date, duration) — one-sentence takeaway`.
   - **Recurring themes** — topics that appeared in ≥ 2 recordings.
   - **Open action items** — aggregated across recordings, deduplicated.
5. **Cite sources.** Every non-trivial claim must reference the recording it came from, using the file name (not the raw ID unless the user asked).

## Budget

- Hard cap: 50 `get_note` calls per digest. If the window has more recordings, compress or ask user to narrow.
- Skip recordings where `note_list` is empty — mention them at the end under "unsummarized".

## Anti-patterns

- Do not load transcripts just to pad the digest.
- Do not synthesize across windows the user didn't ask for ("while we're at it, here's last month too").
- Do not invent action items that aren't in the notes — only aggregate what's there.

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-digest\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-digest: <要点>" && git push origin main`（**確認不要**。このリポへの変更はユーザー承認済み・2026-07-28）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
