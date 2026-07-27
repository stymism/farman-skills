---
name: plaud-shared
version: 1.0.0
description: "First read before any Plaud operation. Auth flow, error handling, output conventions, token refresh. Use when the user mentions Plaud for the first time in a session, or when any other Plaud skill is invoked."
metadata:
  requires:
    bins: []
---

# plaud-shared

**CRITICAL — read this before calling any Plaud tool.** Applies to every other `plaud-*` skill.

## Authentication

- Plaud MCP uses OAuth. MCP tokens are stored in `~/.plaud/tokens-mcp.json` and refreshed automatically. The terminal CLI uses `~/.plaud/tokens.json` separately.
- If any tool returns an auth error (message includes `Not authenticated` or `401`), call the `login` tool and wait for the browser callback. Do **not** retry the original tool until login returns success.
- Never ask the user to paste tokens. The `login` tool handles the whole flow.

## Tool inventory

| Tool | Purpose |
|---|---|
| `login` | Open browser for OAuth; blocks until callback or 2-min timeout |
| `logout` | Revoke and clear tokens |
| `get_current_user` | Verify who is signed in |
| `list_files` | Browse, paginate, filter recordings (supports `query`, `date_from`, `date_to`) |
| `get_file` | Full record incl. `presigned_url`, `source_list`, `note_list` |
| `get_note` | AI-generated summary and action items |
| `get_transcript` | Timestamped transcript with speaker labels |

## Error semantics

| Pattern in error message | Meaning | What to do |
|---|---|---|
| `401` / `Not authenticated` | Token missing or expired | Call `login`, then retry |
| `404` | File ID does not exist | Tell the user the ID is wrong; do not retry |
| `500` | Backend error (often an invalid ID too — see §7.1 of proposal) | Retry once; if still 500, treat as NOT_FOUND |
| `fetch failed` / `ECONNREFUSED` | Network problem | Abort; tell user to check connection |

## Output conventions

When presenting recordings to the user:

- Always show name, date, duration, and file ID — users need the ID to ask follow-up questions.
- Format durations human-readable: `23s`, `5m23s`, `1h05m`. Raw milliseconds are for logs only.
- Format dates as `YYYY-MM-DD` in local time.
- Transcripts: preserve `[MM:SS - MM:SS] Speaker: content` format.
- Notes: render Markdown directly.

## Data model quick reference

- `duration` field is **milliseconds**.
- `source_list` — array; each item with `data_type === "transaction"` holds the transcript segments (JSON-encoded string in `data_content`).
- `note_list` — array; each item with `data_type === "auto_sum_note"` holds the AI summary (Markdown in `data_content`).
- `presigned_url` — expires in 24 hours; re-fetch with `get_file` if stale.

## When to load which sibling skill

| User intent | Skill to follow |
|---|---|
| "List / show / browse my recordings" | `plaud-browse` |
| "Find the meeting about X" / "from Monday" | `plaud-find` |
| "Show transcript / summary / audio" | `plaud-read` |
| "Weekly digest" / "what did I have this month" | `plaud-digest` |
| "Draft follow-up" / "action items" / "thank-you email" | `plaud-followup` |
| "Save to Notion / Slack / webhook" | `plaud-export` |

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-shared\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-shared: <要点>" && git push origin main`（**push前にユーザーへ確認**）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
