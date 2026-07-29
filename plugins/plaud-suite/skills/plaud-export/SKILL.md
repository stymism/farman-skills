---
name: plaud-export
version: 1.0.0
description: "Push Plaud content or a generated artifact to Notion, Slack, HubSpot, Linear, Gmail, or a custom webhook. Use when the user says 'save to Notion', 'post to Slack', 'send to webhook', 'file this in HubSpot', or asks to deliver recording content to an external system."
metadata:
  requires:
    bins: []
---

# plaud-export

**Read [`plaud-shared`](../plaud-shared/SKILL.md) first.**

## When to use

- User has a ready artifact (from `plaud-followup`) or recording content and wants to **deliver** it somewhere.
- Destination is an external system (not the chat).

## Out of scope

- Generating the artifact — that's `plaud-followup`.
- Reading recording content — that's `plaud-read`.

This skill is the final leg: take content that already exists and send it.

## Steps

1. **Confirm the payload.**
   - Recording summary (raw `get_note` content)?
   - Generated artifact (email, SOAP, brief — already drafted)?
   - Raw transcript excerpt?
2. **Confirm the destination + identifiers.** Ask for the exact target. Plaud does not store destination credentials.
3. **Deliver using the MCP tool or integration available in the user's environment.** Plaud MCP itself does not expose a `push` tool — this skill assumes another MCP (Notion MCP, Slack MCP, a webhook tool, Gmail send) is available in the session.
4. **Report the delivery URL** (Notion page URL, Slack message permalink, webhook HTTP status) back to the user.

## Destination identifier cheat-sheet

| Destination | Required identifier | Typical ask |
|---|---|---|
| Notion | page ID or database ID | "Which Notion page should this go under?" |
| Slack | channel name or ID | "Which channel? (e.g., `#sales` or `C0123`)" |
| HubSpot / Salesforce | CRM object ID (deal / contact / company) | "Which deal/contact should this attach to?" |
| Linear | team or project ID | "Which Linear team or project?" |
| Gmail | recipient email(s) | "Who should this email go to?" |
| Webhook | full URL | "Paste the webhook URL" |

## Anti-patterns

- Never persist destination credentials in the conversation or in files. Assume the MCP host provides them.
- Never send to a default destination ("I'll put it in `#general`") — always confirm.
- Never alter the artifact content during delivery. If Slack needs mrkdwn, convert format without changing meaning.

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-export\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-export: <要点>" && git push origin main`（**確認不要**。このリポへの変更はユーザー承認済み・2026-07-28）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
