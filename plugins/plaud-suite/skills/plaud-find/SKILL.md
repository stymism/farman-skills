---
name: plaud-find
version: 1.0.0
description: "Find a specific Plaud recording by name keyword, date range, or topic. Use when the user says 'find the Weekly Sync', 'the meeting from Monday', 'the call about Q2', 'recordings last week', or describes what they're looking for rather than listing."
metadata:
  requires:
    bins: []
---

# plaud-find

**Read [`plaud-shared`](../plaud-shared/SKILL.md) first.**

## Background

Plaud's `list_files` API does **not** accept `query` / `date_from` / `date_to` server-side — unknown params are silently ignored. Filtering happens client-side.

The MCP `list_files` tool accepts the same three optional params and performs the filter for you: pass the user's keyword and/or date window and let the tool paginate up to 5 pages.

## Steps

1. **Elicit criteria if vague.** If the user just said "find a recording", ask for at least one of:
   - a name keyword (even a partial match),
   - a rough date or date range,
   - a duration range (less useful, ask only if name and date fail).
2. **Call `list_files`** with the filter params you gathered:
   - `query=<keyword>` — case-insensitive substring match on `name`.
   - `date_from=YYYY-MM-DD`, `date_to=YYYY-MM-DD` — inclusive window on `created_at`.
   - Omit any that the user did not specify.
3. **If zero matches**, ask the user to broaden one axis (shorter keyword, wider date range).
4. **If many matches** (> 10), return the top 10 sorted by `created_at` desc and mention the total.
5. **Never auto-load transcripts**. Present the match list and wait for the user to pick one — that triggers `plaud-read`.

## Date interpretation rules

| User phrase | Filter |
|---|---|
| "today" | `date_from` = today, `date_to` = today |
| "yesterday" | both = yesterday |
| "this week" | Monday of this week → today |
| "last week" | Monday of last week → Sunday of last week |
| "this month" | 1st of this month → today |
| "last month" | 1st → last day of previous month |
| "from Monday" | `date_from` = the most recent Monday, no `date_to` |

Resolve relative dates against the **current date** (from conversation context), not the model's training cutoff.

## Example

User: "find the customer onboarding call from last week"

Agent:
- `list_files(query="onboarding", date_from="2026-04-13", date_to="2026-04-19")`
- Return matches: "Found 2 recordings. `abc123` Customer Onboarding — Acme (2026-04-15, 42m), `def456` Onboarding Q&A (2026-04-17, 18m). Which one?"

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-find\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-find: <要点>" && git push origin main`（**確認不要**。このリポへの変更はユーザー承認済み・2026-07-28）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
