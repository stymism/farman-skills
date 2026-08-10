# plaud-html

Plaud録音（またはJSONメモ）から議事録HTMLサマリーを生成し、`index.html` の更新・横断ページの再生成・Asana登録・Cloudflare Pagesへのデプロイまでを一気通貫で行うスキル。

手順の詳細はすべて [`SKILL.md`](./SKILL.md) にある。**この README は概要・セットアップ・変更履歴のみ**を扱う。

- **プラグイン**: `plaud-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-html\`
- **取り込み**: `claude plugin update plaud-suite@farman-skills`

## 概要

```
Plaud録音 ──REST──> フォルダ判定（社内/社外/講話/面接）
              │
              ├─MCP get_note──> AI要約（summary / action_items / key_topics）
              │
              └─> HTML生成 ──> index.html更新 ──> gen-aux.js（横断ページ）
                                                      │
                                        Asana登録 ────┴──> git push ──> Cloudflare Pages
```

| 分類 | テーマ | テンプレート |
|---|---|---|
| 🏢 社内 | グリーン（`#1b4332`） | 議事録テンプレート |
| 🤝 社外 | アンバー（`#78350f`） | 議事録テンプレート |
| 🎤 講話録音 | インジゴ（`#1e1b4b`） | 講話ナレッジテンプレート（ToDo/Asanaなし） |
| 面接 | — | **HTML化対象外**（個人情報のためスキップ） |

公開先: https://farman-mtg.pages.dev （サイトrepo: `stymism/farman-mtg-site`・非公開）

## 前提・セットアップ

| 要素 | 引き継ぎ | PC毎の作業 |
|---|---|---|
| スキル本体 | 🟢 GitHubマーケットプレイス | `claude plugin update plaud-suite@farman-skills` |
| Plaud MCP（`get_note`） | 🟢 OAuth | 初回のみ `mcp__plaud__login` |
| 設定ファイル `~/.plaud/plaud-config.json` | 🔴 ローカル | 新PCセットアップZIP、または `setup-plaud.ps1` |
| 作業ディレクトリ（HTML出力先） | 🟢 OneDrive同期 | configの `paths.work_dir` |
| git + GitHub認証 | 🔴 ローカル | デプロイするPCのみ `gh auth login` |

新PCへの導入は `make-newpc-zip.ps1` が生成する `plaud-newpc-setup.zip` の `SETUP.cmd` ダブルクリックが最短。詳細は SKILL.md「初回セットアップ」を参照。

> **⚠️ `plaud-config.json` はトークン・パスワードを含むため git管理禁止**（`.gitignore` 済み）。共有は本人管理のプライベートな手段のみ。

## 使い方

```
/plaud-html
```

未HTML化の録音を自動検出して処理する。JSONメモを `@ファイルパス` で添付した場合は STEP 1〜3 をスキップして直接HTML化する（社内/社外の判定はユーザーに確認する）。

## このフォルダのファイル

| ファイル | 役割 |
|---|---|
| `SKILL.md` | 手順の正本。実行時に読まれる |
| `README.md` | このファイル。概要と変更履歴 |
| `gen-aux.js` | 横断ページ生成（`search-index.json` / `entity-index.html` / `decisions.html`） |
| `audit.js` | **生成物の自己監査（STEP 5.7・必須）。** 問題があれば exit 1。`node audit.js <work_dir> <対象.html…>` |
| `refresh-plaud-token.ps1` | Plaud RESTトークンの自動再取得（約24時間で失効）＋新PC用ZIPの再生成 |
| `setup-plaud.ps1` | 設定ファイルの対話生成 |
| `setup-newpc.ps1` / `setup-newpc.cmd` / `newpc-README.txt` | 新PCワンクリックセットアップ |
| `make-newpc-zip.ps1` | 新PCセットアップZIPの生成 |
| `plaud-config.template.json` | 設定ファイルのテンプレート |
| `diagnose.ps1` | このPCで実行可能かの状態診断 |
| `repair-index.ps1` | index.html の修復 |

## 既知の制約

- **Plaud MCP はフォルダ情報を返さない**（2026-07-28 再実測時点）。社内/社外/講話/面接の判定のみ REST API（`filetag_id_list`）に依存する。この制約が解消されれば `plaud-config.json` の Plaudトークンは不要になるため、SKILL.md の STEP 1-0 で毎回チェックする。
- **`get_file` は呼ばない。** トランスクリプト全文（20万文字規模）が返りトークン上限を超える。duration等は STEP 1 の REST 一覧から取る。
- **Plaud RESTトークンは約24時間で失効**。STEP 1 冒頭で自動再取得する。
- **`get_note` はアップロード直後に500を返すことがある**（AI要約の非同期生成中）。3回リトライして駄目なら次回に回す。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-08-10 | SKILL.md のHTMLテンプレが `enhance.css?v=2` のまま取り残されていたのを **`v=8`（実態の最頻値）に修正**。`audit.js` は全ページの最頻値を正とするため、テンプレどおりに新規生成すると監査に引っかかっていた。あわせて「新規生成前に既存ページの最頻値を確認する」コマンドを追記 |
| 2026-08-10 | **entities に書いた語は本文に必ず登場させる**ルールを追記。参加者欄・entities を前回ページからコピーすると、その回のPlaud要約に無い人名が混ざり `audit.js` の「meta entities の語が本文に無い」で落ちる（実際に全体MTGで発生） |
| 2026-07-29 | **`audit.js` を2段出力に改訂**。常に全ページを検査し「ゲート（今回対象・exit 1）」と「参考（既存の積み残し・ブロックしない）」に分ける。積み残しを初日から可視化して、後から大量に湧くのを防ぐ |
| 2026-07-29 | `audit.js` に検査を4つ追加 — ①`id="detailContent"` の存在 ②`chart-insight` の差し色がテーマと一致 ③decision-box 数がセクション数に見合うか（従来は0件のときしか検出しなかった）④`meta entities` の語が本文に実在するか |
| 2026-07-29 | `audit.js` に NAME（固有名の表記ゆれ疑い）を追加。**常に参考扱いでブロックしない**。比較相手を VOCAB（全ページの entities ＋ index の data-text）に限定し、誤検出を52件→5件に圧縮。実際に「東京会館／東京會舘」の揺れを検出し3ページを正式名に統一 |
| 2026-07-29 | 上記の新チェックで出た積み残しを全て解消（entities の幽霊語10ページ、decision-box 不足8ページ・21個追加）。`--all` でゲート0件 |
| 2026-07-29 | 一括変更は「dry-run → 1件で試す → 全件」の順に固定するルールを追記（テーマ判定の誤爆を26件に流してしまった反省） |
| 2026-07-29 | **`enhance.js` が `id="detailContent"` を起点にする**ため、`class="detail-content"` だけの旧15ページで強調・ミニバー・ダークモード等が丸ごと無効だった件を追記（200 OK・コンソールエラー無しで静かにreturnするため誤診しやすい）。切り分けスニペットと、必須チェックリストへの項目追加もあわせて実施 |
| 2026-07-29 | **テーマ判定は `class="badge-header-*"` 属性で行う**ことを明記。旧ページは `<style>` に3種のバッジCSSを全部定義しているため、クラス名の素の出現でマッチすると社外ページを社内と誤判定する（実際に8件誤検出） |
| 2026-07-29 | 後付けする `chart-insight` の差し色をテーマ別に出し分ける方針、および旧ページ用CSSは「最初の `</style>` 直前に追記」する理由（旧ページは整形済みCSSで行頭一致が効かない）を追記 |
| 2026-07-29 | 旧ページの一括補完手順（抽出 → パッチJSON → 適用スクリプトの3段・後ろから挿入・冪等）を追記。`audit.js --all` の94件/45ページを0件にした実績にもとづく |
| 2026-07-28 | README.md を新規作成（SKILL.md が参照していたが未作成だったため） |
| 2026-07-28 | ブラウザペイン非表示時の計測が無効になる罠（`visibilityState:hidden`・viewport 0×0 でIntersectionObserver不発火・横スクロール判定が常に真）を追記 |
| 2026-07-28 | 上記の判定条件を訂正。`innerWidth > 0`（レイアウト計測の可否）と `visibilityState === 'visible'`（IntersectionObserver/transition/screenshotの可否）は**別条件**で、前者だけでは不十分と実測で判明 |
| 2026-07-28 | チャートのインサイト欠落を全生成物で機械監査し、07-10 ファーマン全体MTG・07-13 小宮山さんMTG の2件を修正（いずれもタイムラインチャート） |
| 2026-07-28 | **`audit.js` を新規同梱し、STEP 5.7「自己監査」として必須化**。0件でなければ STEP 7 のデプロイに進まないゲートを設定。アセットのバージョンは最頻値方式で自動判定、講話ページは自動免除 |
| 2026-07-28 | `audit.js` の偽陽性を3種修正（CSSの空白ゆらぎ／`decisions.html` 未掲載の一律エラー／クラス属性の完全一致）。初版125件の報告のうち**27件が偽陽性**だったため、「検出を信じて既存ページを書き換える前に実ファイルで裏取りする」旨をSKILL.mdに明記 |
| 2026-07-28 | 既存ページの実在ドリフト2件を修正（05-08 粋農MTG の hero-particle 3→5個、07-03 劉さんMTG の entities から1文字語「劉」を除去） |
| 2026-07-28 | ローカル静的サーバーのHTMLキャッシュ対策（再検証は `?cb=N`）を追記 |
| 2026-07-28 | MCP `Not authenticated` 時の `login` / REST `/file/detail/{id}` フォールバック手順を追記（gzip自動解凍の分岐を含む） |
| 2026-07-28 | `get_file` の使用を禁止（20万文字のトランスクリプトが返るため）。STEP 3 の矛盾記述も修正 |
| 2026-07-28 | チャート生成後の自己点検スニペットと `.tl-item` の要素順ルールを追加 |
| 2026-07-28 | STEP 1-0 の実測日を更新、`page_size` 下限10の制約を追記 |
| 2026-07-14 | SKILL.md 最終更新（README作成前のため詳細な履歴なし。以降はこの表に追記する） |
