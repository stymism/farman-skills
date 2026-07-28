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
| 2026-07-28 | README.md を新規作成（SKILL.md が参照していたが未作成だったため） |
| 2026-07-28 | ブラウザペイン非表示時の計測が無効になる罠（`visibilityState:hidden`・viewport 0×0 でIntersectionObserver不発火・横スクロール判定が常に真）を追記 |
| 2026-07-28 | 上記の判定条件を訂正。`innerWidth > 0`（レイアウト計測の可否）と `visibilityState === 'visible'`（IntersectionObserver/transition/screenshotの可否）は**別条件**で、前者だけでは不十分と実測で判明 |
| 2026-07-28 | チャートのインサイト欠落を全生成物で機械監査し、07-10 ファーマン全体MTG・07-13 小宮山さんMTG の2件を修正（いずれもタイムラインチャート） |
| 2026-07-28 | ローカル静的サーバーのHTMLキャッシュ対策（再検証は `?cb=N`）を追記 |
| 2026-07-28 | MCP `Not authenticated` 時の `login` / REST `/file/detail/{id}` フォールバック手順を追記（gzip自動解凍の分岐を含む） |
| 2026-07-28 | `get_file` の使用を禁止（20万文字のトランスクリプトが返るため）。STEP 3 の矛盾記述も修正 |
| 2026-07-28 | チャート生成後の自己点検スニペットと `.tl-item` の要素順ルールを追加 |
| 2026-07-28 | STEP 1-0 の実測日を更新、`page_size` 下限10の制約を追記 |
| 2026-07-14 | SKILL.md 最終更新（README作成前のため詳細な履歴なし。以降はこの表に追記する） |
