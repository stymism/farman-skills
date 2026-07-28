# plaud-read

特定のPlaud録音について、書き起こし・AI要約・ノートの取得や音声ダウンロードを行うスキル。構造化フィールドの抽出にも対応する。

どのツールを使うかを決める選択マトリクスを持つ。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `plaud-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-read\`
- **取り込み**: `claude plugin update plaud-suite@farman-skills`

## 起動するとき

「書き起こしを見せて」「これ要約して」「何を話してた?」「音声を取って」など、特定の録音を掘り下げるとき。

## SKILL.md の構成

- When to use
- Tool selection matrix
- Structured extraction workflow
- Output
- Anti-patterns

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
