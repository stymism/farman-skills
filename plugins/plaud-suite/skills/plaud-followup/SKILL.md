---
name: plaud-followup
version: 1.0.0
description: "Turn a Plaud recording into a follow-up email, thank-you note, action-item list, SOAP note, or meeting brief. Use when the user says 'draft follow-up', 'what were the action items', 'send thank-you email', 'turn this into a SOAP note', 'write the recap', or names an artifact to generate from a recording."
metadata:
  requires:
    bins: []
---

# plaud-followup

**Read [`plaud-shared`](../plaud-shared/SKILL.md) first.**

## When to use

- User wants a **generated document** grounded in one recording.
- Target format is explicit (email, SOAP note, brief, action-item list) or implicit ("write the follow-up").
- If the user wants to *send* the output to Notion / Slack / a webhook, chain into `plaud-export` after drafting.

## Steps

1. **Identify the recording.** If the user didn't name one, hand off to `plaud-find` or `plaud-browse`.
2. **Fetch source content.**
   - `get_note` first — usually enough for summaries and action items.
   - `get_transcript` only if the artifact needs verbatim quotes (e.g., legal memo) or speaker attribution (e.g., SOAP).
3. **Generate the artifact** in the requested format. Ground every claim in the source; do not invent attendees, dates, decisions, or numbers.
4. **Present to the user** in the chat, then ask if they want to refine or export.

## Artifact templates

### Follow-up email
- To: attendees (from notes if listed).
- Subject: "Follow-up — {recording name}, {date}".
- Opening line: thanks + one-line meeting summary.
- Body: 3–5 bullets of key points.
- Action items: numbered list with owner and due date if mentioned.
- Closing: "Let me know if I missed anything."

### Thank-you email
- Short. One paragraph. One concrete thing you learned or appreciated from the call.

### Action-item list
- Plain markdown: `- [ ] {owner}: {item} (due {date})`.
- Mark owner as `?` if unclear from notes — do not guess.

### SOAP note (clinical)
- **Subjective** — patient's words (from transcript).
- **Objective** — observations (from transcript, not inferred).
- **Assessment** — summary's diagnosis if present.
- **Plan** — action items and next appointment.

### Meeting brief
- Attendees, date, duration, decisions, risks, next steps.

## Anti-patterns

- Never invent email recipients. If attendees weren't captured, ask the user.
- Never invent due dates. Mark as `due: TBD` if not stated.
- Do not send the email — this skill drafts. Handoff to `plaud-export` for delivery.

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-followup\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-followup: <要点>" && git push origin main`（**確認不要**。このリポへの変更はユーザー承認済み・2026-07-28）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
