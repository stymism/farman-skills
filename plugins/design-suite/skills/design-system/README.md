# design-system

デザイントークンの設計とコンポーネント仕様を扱うスキル。primitive→semantic→component の3層トークン構造、CSS変数、スペーシング/タイポグラフィのスケールを定義する。

BM25によるスライド検索、意思決定CSV、Chart.js連携を含むスライド生成系も内包する。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `design-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\design-suite\skills\design-system\`
- **取り込み**: `claude plugin update design-suite@farman-skills`

## 起動するとき

「デザイントークン設計して」「CSS変数を体系化したい」「コンポーネント仕様を書いて」「ブランド準拠のスライドを作って」など。

## SKILL.md の構成

- When to Use
- Token Architecture
- Quick Start
- References
- Component Spec Pattern
- Scripts
- Templates
- Integration
- Slide System
- Best Practices

## このフォルダのファイル

`data/` / `references/` / `scripts/` / `SKILL.md` / `templates/`

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
