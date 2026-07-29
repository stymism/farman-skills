# farman-estimate-maintain

FARMAN見積システム（有機野菜の見積もりWebアプリ。Google Apps ScriptのWebアプリを自社HPにiframe埋め込み／`コード.js` + `index.html`）を改修・保守するスキル。

GAS反映・再デプロイの手順、初回ロード高速化まわりのTDZ罠、シート列変更時の `migrateLeadsSheet()`、`APP_VERSION` 更新、iframe埋め込みの注意点を含む。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `farman-tools`
- **正本**: `C:\claude code\skills-marketplace\plugins\farman-tools\skills\farman-estimate-maintain\`
- **取り込み**: `claude plugin update farman-tools@farman-skills`

## 起動するとき

「見積システムを直したい」「品目やエリアや送料を追加したい」「見積アプリのバグ」「FARMAN_Estimate」「リードシートに列を足したい」「受付番号／クール便／メール文面を変えたい」など。ファーマンの見積もり・お問い合わせフォームの改修は原則これ。

## SKILL.md の構成

- システムの全体像
- ファイルの場所と「正本」ルール
- 改修前に必ず思い出す4つのハマりどころ
- 「コードを触らずマスタだけで済む」改修
- 画面遷移（ナビゲーション）の設計
- UXの実装済みパターン（v1.5.0・崩さない）
- 体験メニューの受付条件（間口の絞り込み）
- 特定フローだけ一時的に受付停止する
- コードを変更するときの手順
- デプロイ・反映チェックリスト（ユーザーに渡す手順）
- iframe埋め込みの注意点
- 変更してはいけない／特に慎重に扱うもの

## このフォルダのファイル

`references/` / `SKILL.md`

## 注意・制約

- **「コードを触らずマスタだけで済む」改修**が別章で整理されている。まずそこを確認してからコード変更に入る。
- v1.5.0で実装済みのUXパターンは**崩さない**こと（SKILL.md「UXの実装済みパターン」参照）。
- `references/architecture.md` と `references/iframe-embed.md` に詳細を分離している。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | 体験メニューの受付条件（20名以上 or 予算5万円以上／`EXP_MIN_PEOPLE`・`EXP_MIN_BUDGET`）を追記。停止中に画面確認する手順（確認用コピーの作り方・再開検証は本番無改変のコピーで行う）を追記。architecture.md の体験リード列定義を実態（団体名・ご利用区分・うちお子様人数・予算条件）に更新し、定数表の `MIN_ORDER_AMOUNT` 重複を統合 |
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
