# farman-cultivation-record

有機JAS認証の提出書類「栽培履歴」を、作業日誌と圃場台帳から圃場ごとに作成するスキル。

## 何をするか

- 作業日誌（xlsx）から圃場ごとの作業レコードを抽出
- 圃場台帳から対象圃場・面積を取得（取り消し線＝作成済みは除外）
- 地名ごとのブックに、1圃場=1シートで栽培履歴を出力
- 耕作履歴が無い圃場も「休耕・不作付」シートを作る

## 使い方

1. ユーザーに作業日誌を **xlsxでダウンロード** してもらう（スプレッドシート直読みは不可）
2. `scripts/config.example.json` を `~/.farman/cultivation-record.json` へコピーして環境に合わせる
3. `python scripts/extract.py --config ~/.farman/cultivation-record.json -o records.json`
4. 「未解釈が残った圃場セル」が0件になるまで設定を調整
5. `python scripts/build.py --config ~/.farman/cultivation-record.json -r records.json`

## セットアップ（社内メンバー向け）

設定ファイルには**スプレッドシートID・氏名・地番**を書くため、リポジトリには含めていない。
初回は管理者から `cultivation-record.json` を受け取り `~/.farman/` に置くこと。
このファイルを他所へ貼ったりコミットしたりしない。

必要なもの: Python 3 と `openpyxl`。目視確認にLibreOffice（任意）。

## 実行環境

Windowsローカル前提（ローカルのxlsxとOneDriveの出力先を扱う）。Cowork不可。

## 変更履歴

- 2026-08-07 初版。2025年度の54圃場ぶんの作成作業から起こした。
  日誌の列ずれ・フィルタによる行欠落・文字列型の数量・複数圃場の一括記載への対処を含む。
