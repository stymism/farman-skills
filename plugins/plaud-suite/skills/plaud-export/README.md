# plaud-export

Plaudのコンテンツや生成した成果物を、Notion / Slack / HubSpot / Linear / Gmail / 任意のWebhook へ送るスキル。宛先識別子のチートシートを持つ。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `plaud-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-export\`
- **取り込み**: `claude plugin update plaud-suite@farman-skills`

## 起動するとき

「Notionに保存して」「Slackに投げて」「Webhookに送って」「HubSpotに記録して」など。

## SKILL.md の構成

- When to use
- Out of scope
- Steps
- Destination identifier cheat-sheet
- Anti-patterns

## 注意・制約

- 対象外（Out of scope）の章がある。送信先の仕様変更時はそこも見直すこと。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
