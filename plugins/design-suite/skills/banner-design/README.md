# banner-design

SNS・広告・Webヒーロー・印刷向けのバナーを設計するスキル。要件ヒアリング→アートディレクション調査→複数案の生成→画像書き出し→提示と反復、という5ステップで進める。

プラットフォーム別の推奨サイズ表と、ミニマル/グラデーション/大胆なタイポグラフィなど主要アートスタイルのリファレンスを内蔵する。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `design-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\design-suite\skills\banner-design\`
- **取り込み**: `claude plugin update design-suite@farman-skills`

## 起動するとき

「バナー作って」「OGP画像ほしい」「広告クリエイティブを作りたい」など。プラットフォーム（Facebook / X / LinkedIn / YouTube / Instagram / Google Display / Webヒーロー / 印刷）とスタイル、寸法を指定できる。

## SKILL.md の構成

- When to Activate
- Prerequisites
- Workflow
- Banner Size Quick Reference
- Art Direction Styles (Top 10)
- Design Rules
- Security

## このフォルダのファイル

`references/` / `SKILL.md`

## 注意・制約

- `ui-ux-pro-max` / `frontend-design` / ai-artist / ai-multimodal と連携して動く前提。単体では画像生成部分が動かないことがある。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
