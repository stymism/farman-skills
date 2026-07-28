# plaud-find

名前のキーワード・日付範囲・トピックから特定のPlaud録音を探すスキル。日付表現の解釈ルールを持つ。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `plaud-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-find\`
- **取り込み**: `claude plugin update plaud-suite@farman-skills`

## 起動するとき

「Weekly Syncを探して」「月曜の会議」「Q2の話をしたやつ」「先週の録音」など、**一覧ではなく特定の1件を探している**とき。

## SKILL.md の構成

- Background
- Steps
- Date interpretation rules
- Example

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
