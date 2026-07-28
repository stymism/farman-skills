# plaud-followup

Plaud録音からフォローアップメール・お礼状・アクションアイテム一覧・SOAPノート（臨床）・ミーティングブリーフを生成するスキル。成果物ごとのテンプレートを持つ。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `plaud-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-followup\`
- **取り込み**: `claude plugin update plaud-suite@farman-skills`

## 起動するとき

「フォローアップを下書きして」「アクションアイテムは?」「お礼メール送って」「議事のリキャップ書いて」など。

## SKILL.md の構成

- When to use
- Steps
- Artifact templates
- Anti-patterns

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
