---
name: plaud-browse
version: 1.0.0
description: "Browse, list, or paginate through Plaud recordings. Use when the user says 'what recordings do I have', 'show my recent recordings', 'list my recordings', or asks to see the most recent uploads."
metadata:
  requires:
    bins: []
---

# plaud-browse

**Read [`plaud-shared`](../plaud-shared/SKILL.md) first** for auth and output conventions.

## When to use

- User wants to see what is in their library without a specific target in mind.
- User explicitly asks for a page, or says "next page", "more results".
- User asks "what's the most recent recording" — fetch page 1 and return the top item.

## Steps

1. Call `list_files` with `page=1` and `page_size=20` (default). No `query` / `date_from` / `date_to` unless the user said something that matches `plaud-find`.
2. Present results in a compact table: **ID**, **NAME**, **DATE** (`YYYY-MM-DD`), **DURATION** (`5m23s` style).
3. If the page looks like the whole library (fewer than `page_size` returned), tell the user there is no next page.
4. If the user asks for more, increment `page` by 1 and call again.

## Anti-patterns

- Do **not** fetch every page eagerly; pagination is lazy.
- Do **not** call `get_note` or `get_transcript` during a browse — that belongs to `plaud-read` and burns tokens.
- Do **not** expose raw timestamps or durations in milliseconds.

## Example

User: "show me my recordings"

Agent:
- `list_files(page=1, page_size=20)`
- Render table, mention "page 1, say 'next page' for more"

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-browse\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-browse: <要点>" && git push origin main`（**確認不要**。このリポへの変更はユーザー承認済み・2026-07-28）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
