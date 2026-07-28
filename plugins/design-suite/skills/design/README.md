# design

デザイン系タスクの総合入口。ロゴ生成（55スタイル）・CI/CDプログラム（50成果物・CIPモックアップ）・HTMLプレゼン（Chart.js）・バナー（22スタイル）・アイコン（15スタイル・SVG）・ソーシャル画像（HTML→スクリーンショット）を横断的に扱う。

内容に応じて各サブスキルへルーティングする。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `design-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\design-suite\skills\design\`
- **取り込み**: `claude plugin update design-suite@farman-skills`

## 起動するとき

「ロゴ作って」「CI作りたい」「スライドにして」「アイコン生成して」「SNS用の画像作って」など、デザイン全般。どのサブスキルを使うか迷う場合の入口としても使える。

## SKILL.md の構成

- When to Use
- Sub-skill Routing
- Logo Design (Built-in)
- CIP Design (Built-in)
- Slides (Built-in)
- Banner Design (Built-in)
- Icon Design (Built-in)
- Social Photos (Built-in)
- Workflows
- References
- Scripts
- Prerequisites
- Setup
- Integration

## このフォルダのファイル

`data/` / `references/` / `scripts/` / `SKILL.md`

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
