# image-gen

ローカルの Stable Diffusion XL で画像を生成するスキル。ONNX Runtime + CPU実行で、**API課金なし・完全オフライン・商用利用可**。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `personal-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\personal-suite\skills\image-gen\`
- **取り込み**: `claude plugin update personal-suite@farman-skills`
- **実行環境**: Windowsローカル専用（**Cowork不可**）。`C:\claude code\sdxl-local` に環境が必要

## 起動するとき

「画像を作って」「イラスト生成して」「AIで画像を」「SDXLで」「サムネ画像作って」など。資料やスライドに挿絵が要りそうな場面では提案してもよい。

## 重要な前提

- **1枚あたり約18分**かかる（CPU実行）。生成前に必ずユーザーに伝え、バックグラウンドで走らせる。
- **解像度を1024から下げると出力がランダムに崩壊する**。SKILL.md の該当節を必ず読むこと。小さい画像は1024で作って縮小する。
- このPCの内蔵GPU（AMD Radeon 860M）はメモリ不足でSDXLを載せられないため、GPUは使わない。

## SKILL.md の構成

- 最初に確認すること
- 実行のしかた（オプション・実行時の作法）
- ⚠️ 解像度を1024から下げないこと（最重要）
- 性能 / GPUは使えない
- プロンプトのコツ
- 未構築のPCでのセットアップ
- ライセンス

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-31 | 新規作成。SDXLローカル環境（`C:\claude code\sdxl-local`）の構築に伴い、解像度崩壊の罠と誤診しやすい症状を含めて文書化 |
