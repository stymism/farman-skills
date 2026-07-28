# distribution-check

ファイル・資料・会話を外部に配布/共有する前に、出してはいけない情報が混ざっていないかを3段階（🔴秘密情報 / 🟡個人情報 / 🟢ノイズになる固有設定）で検査するスキル。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `personal-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\personal-suite\skills\distribution-check\`
- **取り込み**: `claude plugin update personal-suite@farman-skills`

## 起動するとき

「配布前チェックして」「これ共有して大丈夫?」「個人情報入ってない?」など。資料を送ろうとする気配があれば、明示的に言われなくても提案してよい。

## SKILL.md の構成

- やること
- 3段階のレベル
- 手順
- ルール

## 注意・制約

- **検出するだけで、勝手に消さない**（承認なしに実行しない）。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
