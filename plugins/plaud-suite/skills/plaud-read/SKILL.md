---
name: plaud-read
version: 1.0.0
description: "Read the transcript, AI summary, notes, or download audio for a specific Plaud recording. Use when the user says 'show the transcript', 'summarize this', 'what was said', 'get audio', 'the notes from', or names a specific recording to dig into. Also covers extracting structured fields from a recording."
metadata:
  requires:
    bins: []
---

# plaud-read

**Read [`plaud-shared`](../plaud-shared/SKILL.md) first.**

## When to use

- User names a specific recording (by name or ID) and wants to read its content.
- User asks for "transcript", "summary", "action items", "audio", "who said what", or a structured extraction ("action items, decisions, attendees").
- If the user did **not** specify a recording, hand off to `plaud-find` (by topic) or `plaud-browse` (by recency) first.

## Tool selection matrix

| User wants | Tool | Notes |
|---|---|---|
| AI summary, TL;DR, action items | `get_note` | Returns Markdown; usually enough — try this before `get_transcript` |
| Verbatim quotes, full dialogue | `get_transcript` | Timestamped; larger |
| Audio download link | `get_file` then use `presigned_url` | Link expires in 24h |
| Full metadata + availability flags | `get_file` | Check `source_list` / `note_list` populated before claiming content exists |

## Structured extraction workflow

If the user provides a schema (e.g., `{"action_items": [], "decisions": [], "attendees": []}`):

1. Call `get_note` first — the AI summary usually already contains these fields.
2. Only call `get_transcript` if the summary is missing a required field.
3. Return JSON matching the user's schema. Mark any missing field with `null` and note why.

Common schemas:
- Sales: `{ "pain_points": [], "follow_ups": [], "deal_stage": "" }`
- Clinical: `{ "diagnoses": [], "medications": [], "next_appointment": "" }`
- Project: `{ "action_items": [], "decisions": [], "attendees": [] }`

## Output

- Transcripts: preserve `[MM:SS - MM:SS] Speaker: content`. Do not reformat timestamps.
- Summaries: render Markdown directly in the reply.
- Audio: print the URL and mention "expires in 24h".

## Anti-patterns

- Do not call `get_transcript` speculatively — it's the largest payload.
- Do not paraphrase the AI summary unless the user asked; quote it verbatim.

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-read\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-read: <要点>" && git push origin main`（**push前にユーザーへ確認**）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
