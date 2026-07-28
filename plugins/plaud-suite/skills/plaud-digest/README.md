# plaud-digest

複数のPlaud録音を1つのダイジェストにまとめるスキル。週次・月次・四半期のロールアップに使う。処理量の上限（Budget）を持つ。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `plaud-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-digest\`
- **取り込み**: `claude plugin update plaud-suite@farman-skills`

## 起動するとき

「週報作って」「今月のダイジェスト」「今週どんな会議があった?」「先四半期の振り返り」など。

## SKILL.md の構成

- When to use
- Steps
- Budget
- Anti-patterns

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
