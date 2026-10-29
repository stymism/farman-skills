---
description: 議事録（Plaud録音またはJSONメモ）からHTMLサマリーを生成し、index.htmlを更新して議事録サイトに載せる（宿題の Asana 登録は毎日の会議の取り込みが行う）、Cloudflare Pagesへ自動デプロイする
allowed-tools: [Bash, PowerShell, Read, Write, Edit, mcp__plaud__list_files, mcp__plaud__get_note, mcp__plaud__get_file, mcp__plugin_plaud-suite_plaud__list_files, mcp__plugin_plaud-suite_plaud__get_note, mcp__plugin_plaud-suite_plaud__get_file, mcp__490d06cb-7b8b-43fa-ae1d-eb967d5a51fa__list_files, mcp__490d06cb-7b8b-43fa-ae1d-eb967d5a51fa__get_note, mcp__490d06cb-7b8b-43fa-ae1d-eb967d5a51fa__get_file]
---

# /plaud-html スキル

Plaud録音またはJSONメモから議事録HTMLサマリーを生成するスキル。

## 入力ソース（2種類）

| ソース | 使用ケース | STEP 1 の扱い |
|--------|-----------|--------------|
| **Plaud録音**（通常） | Plaudでの録音・AI要約済みファイル | `plaud-folders.ps1`（4.0 の API）の一覧と、サイトのページの file_id を突き合わせて検出 |
| **JSONメモ**（直接HTML化） | ユーザーが `@ファイルパス` でJSONを添付した場合 | STEP 1〜3 をスキップし、JSONの内容を直接使用 |

### JSONメモから直接HTML化する場合のルール

- **社内/社外/講話録音の判定**：JSONの内容（参加者・場所）から判断せず、**ユーザーに確認する**か、ユーザーが「社内」「社外」等を明示している場合はそれに従う
- **ファイル名**：JSONの日付フィールド＋タイトルからローマ字スネークケースで生成（例: `260617.json` → `2026-06-17_farman-op-kaigi.html`）
- **STEP 1〜3 はスキップ**し、STEP 4（HTML生成）から開始する
- HTMLの内容・チャート・ToDoはJSONのメモ内容を元に生成する
- その他のステップ（index更新・デプロイ）は通常通り実行する（Asana 登録はしない＝STEP 6）

## セットアップ（プラグイン配布版・2026-07-07改訂）

### 📦 スキル本体の配布 — GitHubマーケットプレイス

スキル本体は **プラグイン・マーケットプレイス `stymism/farman-skills`（GitHub・public）** で配布される。旧方式（OneDriveジャンクション同期・配布ZIP/installer）は**廃止**（2026-07-07）。

| 環境 | 導入方法 |
|------|---------|
| **新しいPC / 未移行PC** | **推奨: 新PCセットアップZIP**（下記「初回セットアップ」参照。スキル導入＋鍵設置＋seedまでワンクリック）。ZIPを使わない場合はPowerShellに1行: `irm https://raw.githubusercontent.com/stymism/farman-skills/main/migrate.ps1 \| iex` → Claude Code再起動（こちらはスキル導入のみ） |
| **クラウドCowork** | Cowork → Customize → Plugins → Personal pluginsの「＋」→ Add marketplace → Add from a repository → `https://github.com/stymism/farman-skills` → 各プラグインをInstall |
| **スキルの更新** | 正本リポジトリ（`C:\claude code\skills-marketplace`）を編集→push → 各PCで `claude plugin update plaud-suite@farman-skills`（CoworkはプラグインUIから更新） |

> **ツール名の揺れについて:** プラグイン同梱のPlaud MCPはツール名が `mcp__plugin_plaud-suite_plaud__list_files` のようにプレフィックス付きになる。環境によっては旧スタンドアロン版（`mcp__plaud__list_files`）や claude.aiコネクタ版も並存する。**中身は同じPlaud MCPなので、存在するものを使えばよい。**

### 📦 PC毎に必要なもの（前提条件）

| 要素 | 引き継ぎ方法 | PC毎の作業 |
|------|-----------|----------|
| **Plaud の MCPコネクタ**（`get_note`・`get_file` 等。Asana はこのスキルでは使わない＝STEP 6） | 🟢 Claudeアカウント連携＋plaud-suiteプラグインが `@plaud-ai/mcp` を同梱 | 初回にPlaudログインのみ |
| **スキルファイル本体**（`SKILL.md`・`setup-plaud.ps1` 等） | 🟢 GitHubマーケットプレイス | 上記1行コマンドを1回 |
| **設定ファイル** `~/.plaud/plaud-config.json`（Plaud RESTトークン・Cloudflare設定・パス） | 🔴 ローカル（同期されない） | 動作中PCからコピー、または `setup-plaud.ps1`（対話生成） |
| **作業ディレクトリ**（HTML・index.html・kowa-knowledge.html） | 🟢 GitHub `stymism/farman-mtg-site`（非公開）の clone＝`~/.plaud/farman-mtg-site`（2026-10-29 から唯一の正本。OneDrive の旧作業場は `claude-data/_archive/plaud_summaries_261029`） | configの `paths.work_dir`（＝この clone） |
| **git + GitHub認証**（STEP7のデプロイ用） | 🔴 ローカル | デプロイするPCのみ `gh auth login` を1回 |

> **重要：MCPコネクタ と Plaud のトークンは別物。**
> - 議事録の中身（`get_note`）は **MCPコネクタ** が担当 → アカウントログインで自動（MCPはOAuthで自前認証。`login` ツールあり）。
> - フォルダ判定（社内/社外/講話）と長さは MCP が返さないため、`plaud-config.json` の Plaud トークンで **4.0 の API を `plaud-folders.ps1` が読む**（2026-10-29〜。旧 REST と STEP 1-0 の点検は `_archive/SKILL_旧REST_261029.md`）。
> - Asana はこのスキルでは使わない（STEP 6）。設定ファイルに Asana の節もフォルダ ID の表も要らない（4.0 ではフォルダ名で決める）。

### 🩺 状態診断（`diagnose.ps1`）

「このPCで `/plaud-html` が使える状態か」を点検する単体スクリプト（このSKILL.mdと同じフォルダにある）。プラグイン導入・設定ファイル・git・node の有無を点検し、「そのまま動く／初回setup要」を判定する。実行するときは、このスキルフォルダ内の `diagnose.ps1` をフルパスで呼び出す。

### 🔧 初回セットアップ — 新PCセットアップZIP（推奨・ワンクリック）

新PCへの導入は **`plaud-newpc-setup.zip` をひとつ渡して、新PCで `SETUP.cmd` をダブルクリックするだけ**。ZIPのスクリプトが「①スキル一式の導入（migrate.ps1相当）→②鍵ファイル設置→③作業ディレクトリのパス自動調整→④サイトデータseed（git導入済みなら）」まで全自動で行う（冪等＝何度実行しても安全）。

- **ZIPの生成（動作中のPCで）:** このスキルフォルダ内の `make-newpc-zip.ps1` を実行 → `ドキュメント\plaud-newpc-setup.zip`（約5KB）が出力される。中身は `SETUP.cmd` / `setup-newpc.ps1` / `README.txt` / **`plaud-config.json`（鍵）**。初回のみ手動生成（ユーザーが「新PC用ZIP作って」と言ったら実行）。
- **以後の作り直しは自動（全PC）:** `refresh-plaud-token.ps1` がトークンを再取得するたびに、**どのPCでも**最新トークンでZIPを自動生成・更新する（ドキュメントフォルダ）。トークンは `/plaud-html` の STEP1 で自動更新されるため、どのPCからでも常に最新ZIPを取り出せる。ZIP内の秘密は各PCの `~/.plaud/plaud-config.json` と同一のため信頼境界は変わらない（Documentsが OneDrive同期の場合は各自のOneDriveに入る点だけ留意）。
- **共有方法:** トークン・パスワード入りのため、**本人管理のプライベートな手段のみ**（OneDriveの特定ユーザー宛て共有リンク、自分宛てクラウド等）。メーリングリスト・チャットの公開チャンネル・GitHubは禁止。新PCへの設置後は共有リンクを削除してよい
- **新PC側の手順:** Claude Codeをインストール＆ログイン → ZIPを展開 → `SETUP.cmd` ダブルクリック → Claude Code再起動
- **代替（ZIPが無い/トークン手入力したい場合）:** このスキルフォルダ内の `setup-plaud.ps1` で対話生成。**AsanaはMCPコネクタ経由のためトークン不要**

**設定ファイルの保護:** トークン・パスワードを含むため**git管理は禁止**（スキルrepo・サイトrepoとも `.gitignore` で除外済み）。

**デプロイ（STEP7）もするPCは、さらに1手間:** git + GitHub CLI を導入・認証してから **`SETUP.cmd` をもう一度ダブルクリック**（サイトseedまで自動で終わる）。

```powershell
winget install --id Git.Git
winget install --id GitHub.cli
# ターミナルを開き直してから:
gh auth login   # GitHub.com → HTTPS → Login with a web browser
```

> **2026-10-29〜 作業場はリポの clone（`~/.plaud/farman-mtg-site`）なので seed は不要＝STEP 7 が無ければ clone する。**

### 📁 設定ファイルの場所

各PC毎に独立: `$env:USERPROFILE\.plaud\plaud-config.json`（例: `C:\Users\<user>\.plaud\plaud-config.json`）。トークン期限切れ時は同フォルダ内 `refresh-plaud-token.ps1` で自動更新できる（STEP 1 が期限切れを検知した場合に実行する）。

**作業ディレクトリ:** 2026-10-29 から GitHub `stymism/farman-mtg-site` の clone（`~/.plaud/farman-mtg-site`）が唯一の正本。OneDrive には置かない（PC の間は git で合わせる）。規則の正本 `plaud_規則.json` と承認の一覧は OneDrive の `右腕AI\00_Resources\`。

### ⚠️ 既知の制約

> 旧 REST（`/file/simple/web` の `filetag_id_list`・`/file/detail`・フォルダ ID の表・STEP 1-0 の MCP の点検）は 4.0 で使えないので `_archive/SKILL_旧REST_261029.md` に移した（2026-10-29）。

### ✅ Plaud 4.0 のフォルダ判定（2026-10-29〜・これが正）

Plaud は 2026-10 に 4.0 へ移行した。**旧 API は `status -1800907`「Account migrated to 4.0」で 0 件になり使えない**（古い Web 画面 web.plaud.ai〈plaud-web3〉も「すべてのファイル(0)」。新しい画面はデスクトップアプリ 1.4.x と新 Web〈beta.plaud.ai〉の「ライブラリ」）。
**フォルダは 4.0 の API で読む: 同じフォルダの `plaud-folders.ps1` を流す**（トークンは画面にも出力にも出さない）:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<このスキルのフォルダ>\plaud-folders.ps1" -Out "$env:TEMP\plaud-folders.json"
# 最後の行: PLAUD_FOLDERS: OK files=N | 未振り分け n / 社外 n / 社内 n / 面接 n / 講話録音 n ...
```
- 中身: ユーザーのトークン（`plaud-config.json` の api_token。失効なら `refresh-plaud-token.ps1`）→ `GET /team-app/workspaces/list` → `POST /user-app/auth/workspace/token/{workspace_id}`（ワークスペースのトークン）→ `GET /file-app/v4/folders/children?node_id=root`（と `&cursor=`）をたどる。ライブラリ直下のフォルダ名がそのまま分類（社内・社外・講話録音・面接・学生発表 …）。システムの「Recordings」（画面の「録音」）は **未振り分け**。
- 出力 1 件: `file_id`（コネクタの `list_files` の `id` と同じ）・`name`・`folder`・`start_ms`・**`duration_ms`**（長さ）・`node_id`・`version_ms`（ゴミ箱の道具が使う）。
- **`plaud-folders.ps1` が失敗したら（status が 0 以外・トークンが取れない）、HTML 化・push をせずに止めて報告に 1 行**。題名・参加者・中身から社内/社外を推測しない。

### 規則の正本 `plaud_規則.json`（2026-10-29〜）

命名（naming）・誤字（typos）・社名の表記（aliases）・社員の表記（people）・振り分け（folders）・短い録音の境目（short_recording）・送付版で伏せる語（redact）は、**`%OneDrive%\右腕AI\00_Resources\plaud_規則.json` が唯一の正本**（claude.ai の予定のタスクからは `$HOME/mnt/右腕AI/00_Resources/plaud_規則.json`）。このスキルや設定に写しを作らない。`audit.js` は typos の gate=true を止める（STEP 5.7）。

### MCPが `Not authenticated` を返すとき（2026-07-28 追記）

Plaud MCPの認証は**RESTトークン（`plaud-config.json`）とは完全に別系統のOAuth**。設定ファイルを直しても復旧しないし、`refresh-plaud-token.ps1` も無関係。`list_files`/`get_note`/`get_current_user` が揃って `Not authenticated. Please login first.` を返したらこれ。

1. **`mcp__plaud__login` を呼ぶ**（ブラウザが開きユーザーがログイン）→ `get_current_user` で `y-ino@farman.jp` が返れば復旧
   - ⚠️ **`login` は OAuth コールバック用に localhost:8199 を使う**（2026-08-10 判明）。検証用ローカル静的サーバーを **8199 で立てていると `port 8199 is in use` でログインできない**。**検証用サーバーには 8199 を使わない**（例: 8123）。既に8199で立てている場合は `preview_stop` してから `login` する
2. 切り分け: 他のMCPが応答するならMCP基盤自体は正常で、Plaudの認証だけの問題
3. ログインできないときは、その回は HTML 化をしないで報告に 1 行（旧 REST の `/file/detail` の代わりの道は 4.0 で使えない）

### ⚠️ `get_file` はトランスクリプト全文を返す（呼ぶな・2026-07-28 追記）
`get_file` のレスポンスは**20万文字規模**になり、トークン上限を超える。**長さ・名前・日付のために `get_file` を呼ばない。** → `plaud-folders.json` の `duration_ms`・`name`・`start_ms` を使う（コネクタの `list_files` の `duration` でもよい）。

### get_note の 500 エラー対応（リトライロジック）
録音後にPlaud側でAI要約を非同期生成するため、アップロード直後は `get_note` が 500 を返すことがある。

**リトライ手順：**
1. `get_note` が 500 を返した場合、即座に最大**3回**まで再試行する
2. 3回とも 500 の場合は「AI要約生成中のためスキップ」として記録し、次回 `/plaud-html` 実行時に再処理対象として検出する
3. スキップしたファイルは完了報告に「⏳ 要約生成中のためスキップ（次回再処理）」として記載する

---

## 🛠 ハマりどころ・検証法（2026-07-08 追記／同じ遠回りをしないための記録）

### PowerShellの文字コード（最重要・日本語が壊れる原因の大半）
- **HTMLファイル(index.html・各サマリー)をPowerShellの文字列置換で編集しない。** `Get-Content -Raw`（`-Encoding UTF8` 無し）はUTF-8ファイルをANSIで誤読して文字化けする→そのまま書き戻すと**ファイル全体を破壊**する。HTMLの読み・検索・編集は必ず **Read / Grep / Edit ツール**（UTF-8対応）で行う。
- **PowerShellコマンドにインラインで日本語を書かない**（`$x='社内'` 等がパースエラー/文字化け）。日本語を含む処理は **.ps1ファイルに書いてから実行**する。
- **Writeツールが作る.ps1にはBOMが無い**→PowerShell 5.1がANSI誤読する。日本語を含む.ps1は実行前に**UTF-8 BOMを付与**：`$b=[IO.File]::ReadAllBytes($f); if($b[0]-ne0xEF){[IO.File]::WriteAllBytes($f,([byte[]](0xEF,0xBB,0xBF))+$b)}`
- Plaud APIの日本語(filename)は `Invoke-RestMethod` だと壊れる→`Invoke-WebRequest -UseBasicParsing` + `[Text.Encoding]::UTF8.GetString($wr.RawContentStream.ToArray()) | ConvertFrom-Json`（STEP1参照）。

### 見た目（色・視認性）の検証法
- **Claude Desktopのプレビューパネルは独自のwebviewキャッシュを持ち、ブラウザのキャッシュクリアやreloadでも更新されないことがある。** 「見た目が変わってない」と言われても、ファイルは直っている場合がある。プレビュー表示を絶対視しない。
- **実レンダリングは自前の静的サーバーで数値検証する**: `.claude/launch.json` に `python -m http.server <port> --directory <work_dir>` を定義→preview_start→preview_eval で `getComputedStyle(el).color` 等を**計測**して確認する。公開サイトはPages Functionsで認証(ログイン)がかかるが、静的サーバーなら生HTMLが見える。**ポートに 8199 を使わないこと**（`mcp__plaud__login` のOAuthコールバックが8199を使うため、後からMCPログインが必要になったときに衝突する。2026-08-10 に実際に発生。8123 等を使う）。
- CSSの見た目修正は**共通ファイル(enhance.css)の1ルール**に集約する。**ページごとのインライン小細工（`style=... !important` 等）は付けない**（enhance.cssが正・全ページに効く）。
- **共通CSS(style.css/enhance.css)を変えたら、参照する全HTMLの `?v=N` を上げてキャッシュバストする**（Desktop/ブラウザがCSSをキャッシュし「直ってない」の主因になる）。UTF-8安全な一括置換: `Get-ChildItem *.html | %{ $t=[IO.File]::ReadAllText($_.FullName,[Text.Encoding]::UTF8); [IO.File]::WriteAllText($_.FullName, ($t -replace 'enhance\.css\?v=\d+','enhance.css?v=N'), (New-Object Text.UTF8Encoding($false))) }`。**テンプレは現在 `enhance.css?v=8`**（2026-08-10 修正。本文テンプレの記述が実態の v=8 に対し v=2 のまま取り残されていた。`audit.js` は全ページの最頻値を正とするため、テンプレどおり v=2 で新規生成すると監査に引っかかる。**新規生成前に既存ページの最頻値を確認すること**: `Get-ChildItem *.html | %{ [regex]::Matches([IO.File]::ReadAllText($_.FullName,[Text.Encoding]::UTF8),'enhance\.css\?v=\d+') } | %{ $_.Value } | Group-Object | Sort Count -Desc | Select -First 1`）

### ⚠️ ブラウザペイン非表示だと「計測」が全部ウソになる（2026-07-28 追記・最重要）

preview_start でサーバーを立ててもブラウザペインが画面に表示されていないと、そのタブは `document.visibilityState === 'hidden'` かつ**ビューポートが 0×0**（`innerWidth`/`clientWidth` が `0`）になる。この状態では次が全て成立しない：

| 現象 | 何が起きるか |
|------|------------|
| **IntersectionObserver が発火しない** | enhance.js の節バー・目次の「今いる節」が動かない。「壊れている」と誤診する（2026-10-29 からページは「ふわっと出る」飾りやカウントアップを持たないので、見えない字にはならない） |
| **CSS transition が進まない** | `style.width='88%'` を入れても `getBoundingClientRect().width` はpadding分（例:12px）のまま。**計算値ではなく実測値を見ると必ず失敗する** |
| **横スクロール判定が常に真** | `document.documentElement.scrollWidth > window.innerWidth` は `X > 0` になるので**必ず true**。全要素が「はみ出し」と出る（実例:403要素の偽陽性） |
| **screenshot が撮れない** | `Screenshot timed out: the Browser pane is not displayed` |

**⚠️ 判定条件は2つあり、別物（2026-07-28 実測で訂正）:** `innerWidth` だけ見るのは**不十分**。ペインを表示すると `innerWidth` は 1280 等になるが、`visibilityState` は `hidden` のままのことがあり、その状態では**スクロールしても `scrollY` が 0 のまま＝IntersectionObserverが発火しない**。

| 判定式 | これが真なら使えるもの |
|---|---|
| `window.innerWidth > 0` | **レイアウト計測**（`getBoundingClientRect` の幅・横スクロール判定） |
| `document.visibilityState === 'visible'` | **IntersectionObserver・CSS transition・screenshot** |

**対処：**
1. まず `({innerWidth: window.innerWidth, visibility: document.visibilityState})` を撃つ。`innerWidth === 0` ならレイアウト計測を捨て、`visibility !== 'visible'` ならアニメーション検証を捨てる（**両方を別々に判断する**）
2. 非表示のままでも、**DOM構造・属性・スクリプト実行結果は正しく取れる**。要素数・`data-*`・`style.width` の代入結果・`textContent`・コンソールエラーで検証する
3. アニメーションを確かめたいときは、IntersectionObserverのコールバック本体と同じ処理を `javascript_tool` で**手動実行**し、`style.width` や `textContent` が期待値になるかを見る（`getBoundingClientRect` ではなく代入値を見る）
4. **既存の完成済みページ（例: `2026-07-14_philanthropy-mtg.html`）で同じ計測をして比べる。** 同じ結果なら環境要因、違えば生成物のバグ — この切り分けが一番速い

### ローカル静的サーバーはHTMLをキャッシュする（2026-07-28 追記）
- `python -m http.server` は `Last-Modified`/`ETag` を返すため、**HTMLを再生成しても同じURLへ再ナビゲートすると旧版が返る**。「修正したのに直っていない」の主因。
- **再生成後の再検証は必ずクエリでキャッシュバストする**: `http://localhost:8199/foo.html?cb=2`（数字を毎回変える）。CSSの `?v=N` と違い、こちらは**検証時だけの一時的な回避**でファイルには入れない。

### モバイル(SP)UI（2026-07-08対応・style.css / index.html）
- **フィルターバー**: カテゴリは横スクロールchip、3ナビリンク（ナレッジベース/インデックス/決定事項）は**ハンバーガー(☰)→ドロップダウン**（`.hamburger-btn`/`.nav-links.open`・`toggleNav()`）。768px以下で発動。検索は全幅。以前は縦バー化で全画面占有していた
- **詳細ページのFAB**: `@media(max-width:680px)` で `.fab-stack` を左→**右下**、`.to-top` を左下へ分離（本文への被り解消）。検証はローカルサーバー+preview_evalの getBoundingClientRect で実施

### チャート内エンティティの色（対応済み）
- enhance.js は `<meta name="entities">` の語を本文中で自動 `<span class="ent">` 化する（親が flex の直下は除外するが、`<p>`直下は対象）。暗い背景の `.chart-container` 内では既定色 `--accent-strong`(#92400e) が埋もれる。→ **enhance.css の `.chart-container .ent{ color:var(--accent-300) }`**（bold と同色）で解決済み。ページ側の追加ルールは不要。

### ⚠️ enhance.js は `id="detailContent"` が無いと**丸ごと何もしない**（2026-07-29 追記・要注意）

`enhance.js` は冒頭が `var content = document.getElementById('detailContent'); if (!content) return;`。**class の `.detail-content` では起動しない。id が要る。**

2026-07-29時点で、5月〜6/1初期に生成した**15ページが `class="detail-content"` だけで id を持っておらず**、次が全部無効になっていた（`fixid.js` 相当の一括付与で復旧済み）：

> エンティティ強調(`.ent`)・ミニバー(`.mini-bar`)・見出しの🔗アンカー・トップに戻る・目次・宿題の済の印（当時は FAB・既読バッジも。2026-10-29 に外した）

**誤診しやすい：** enhance.js は **200 OK で読み込まれ、コンソールにエラーも出さず**、ただ静かに return する。「CSSが効いていない」「キャッシュだろう」と誤診しやすい。

**切り分け（`javascript_tool` で1発）:**
```javascript
({ hasClass: !!document.querySelector('.detail-content'),
   hasId:    !!document.getElementById('detailContent'),   // ← これが false なら原因確定
   enhanceRan: !!document.querySelector('.mini-bar') })
```
`hasClass:true / hasId:false` なら、その `<div class="detail-content …">` に `id="detailContent"` を足すだけで直る。**新規生成時はテンプレどおり `<div class="detail-content" id="detailContent">` にすること**（テンプレには入っているが、旧ページからコピーすると落ちる）。

### ⚠️ テーマ判定は `class="badge-header-*"` 属性で行う（クラス名の素の出現で判定するな・2026-07-29 追記）

ページのテーマ（社内=グリーン / 社外=アンバー / 講話=インジゴ）を判定するとき、**`/badge-header-internal/` のようなクラス名の素の出現でマッチさせてはいけない。** 各ページの `<style>` には **3種のバッジCSSが全部定義されている**ため、社外ページでも `badge-header-internal` の文字列がヒットして**必ず誤判定する**（2026-07-29に実際に発生。社外ページ8件を「社内」と誤検出）。

```javascript
// ❌ 誤爆する            // ✅ 本文で実際に使われている属性だけを見る
/badge-header-internal/    /class="badge-header-internal"/
```
ブラウザ側で判定するなら `document.querySelector('[class^="badge-header"]').className` が確実。

### チャートに後から `chart-insight` を足すときは差し色をテーマに合わせる（2026-07-29 追記）

`.chart-insight` の `border-left` を `var(--amber-400,#fbbf24)` で固定すると、**社内(緑)・講話(インジゴ)ページで浮く**。ページのテーマを上記の方法で判定し、`var(--green-400,#6ee7b7)` / `var(--indigo-400,#818cf8)` / `var(--amber-400,#fbbf24)` を出し分ける。旧ページは `.chart-insight` の CSS 自体が無いことがあるので、その場合は**最初の `</style>` の直前に追記**する（旧ページは整形済みCSS＝`.chart-title {` のように空白入りのため、`^\.chart-title\{` のような行頭一致での挿入は失敗する）。

### 旧ページの一括補完は「抽出 → パッチJSON → 適用スクリプト」で回す（2026-07-29 追記）

`audit.js --all` は旧テンプレのページを大量に拾う（2026-07-29 の実績: **94件 / 45ページ**）。これを1ページずつ Edit で直すのは非現実的で、抜けも出る。次の3段で回すと確実かつ冪等：

1. **抽出**: 各ページから「タイトル・セクション見出し・チャートのタイトルと中身・`chart-insight`の有無・`<meta name="entities">`」だけをJSONに吐く（index のカードは 10-29 から `data-text` を持たない。検索の語は `data/keywords.json`）。**本文全部は読まない**（コンテキストが尽きる）。
2. **パッチJSON**: `{ "file.html": { "entities": "...", "insights": ["…", null], "decisions": ["…"] } }` の形で内容を書く。`null` は「そのチャートは触らない」。
3. **適用**: JSONを読んで注入するスクリプト。**必ず後ろの要素から挿入する**（前から入れると以降のインデックスがずれる）。既に存在する要素はスキップして冪等にする。

適用後は `gen-aux.js` → `audit.js --all` → **ローカルサーバーで実描画チェック**（セクションと decision-box が `H2,DEC,H2,DEC…` の順に並ぶか、`<div>`/`</div>` が対応しているか）。スクリプト挿入は構造を壊しうるので、監査0件だけで終わらせない。

### ⚠️ 一括変更は「1件で試して結果を見てから」全件に流す（2026-07-29 追記）

2026-07-29、テーマ判定を `/badge-header-internal/` というクラス名の素の出現で書いてしまい、**26件に適用してから8件が誤判定と判明**した（旧ページは `<style>` に3種とも定義されているため）。1件で試していれば即座に気づけた。

**手順を固定する:**
1. スクリプトは**まず dry-run**（書き込まない）で対象と件数を出す
2. **1ファイルだけ**に適用し、`javascript_tool` かファイル差分で**期待どおりか確認する**
3. 問題なければ全件に流す
4. 流した後に `audit.js` → 実描画チェック

「件数が多いから一気にやる」は逆で、**件数が多いときほど1件で試す**（誤りも同じ件数だけ量産されるため）。

### デプロイ検証
- git push 後、2 分ほど待って公開 URL（https://farman-gijiroku.pages.dev/）が 200 で返るかを見る（Access か合言葉の画面まで）。2026-10-29 から Cloudflare の API トークンは使わない（公開は Git 連携だけ・トークンは削除＝秘密を減らす）

---

## 実行ステップ

### STEP 0: 事前チェック（別PC対応・プリフライト）★必ず最初に実行

スキル発動時、まず以下のプリフライトを実行して**4つの前提条件**を点検する。不足があればユーザーを案内し、必須項目が欠けていれば停止する。

```powershell
$ok = $true
$cfgHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
# このスキル(plaud-html)フォルダを解決（プラグイン配置 / 旧素置き どちらでも）
$skillDir = @("$cfgHome\plugins\marketplaces\farman-skills\plugins\plaud-suite\skills\plaud-html","$cfgHome\skills\plaud-html") | Where-Object { Test-Path (Join-Path $_ 'SKILL.md') } | Select-Object -First 1
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"

# [1] スキルファイル本体 → このスキルが動いている時点で存在は確認済み
Write-Host "[1] スキルファイル: ✓ 存在（このスキルが実行できています）" -ForegroundColor Green

# [2] 設定ファイル（Plaud RESTトークン / Cloudflareトークン）
if (-not (Test-Path $configPath)) {
  Write-Host "[2] 設定ファイル: ✗ 未作成" -ForegroundColor Red
  Write-Host "    → 初回セットアップが必要です。次を実行してください:" -ForegroundColor Yellow
  Write-Host "      & `"$skillDir\setup-plaud.ps1`"" -ForegroundColor Yellow
  $ok = $false
} else {
  $config = Get-Content $configPath -Raw | ConvertFrom-Json
  $tokenOk = -not [string]::IsNullOrWhiteSpace($config.plaud.api_token)
  Write-Host ("[2] 設定ファイル: ✓ あり（Plaud token: {0}）" -f $(if($tokenOk){'✓'}else{'✗ 未設定'})) -ForegroundColor $(if($tokenOk){'Green'}else{'Yellow'})
  if (-not $tokenOk) {
    Write-Host "    → setup-plaud.ps1 を再実行してトークンを設定してください" -ForegroundColor Yellow
    $ok = $false
  }
}

# [3] git（STEP7のデプロイ＝サイトrepoへのpushに必要）
if (Get-Command git -ErrorAction SilentlyContinue) {
  Write-Host "[3] git: ✓ インストール済み" -ForegroundColor Green
} else {
  Write-Host "[3] git: ⚠ 未インストール（STEP7のデプロイに必要）" -ForegroundColor Yellow
  Write-Host "    → git-scm.com から導入し、gh auth login でGitHub認証（初回のみ）" -ForegroundColor Yellow
}

# [4] 作業ディレクトリ（サイトのリポの clone）と規則の正本（2026-10-29〜）
if (Test-Path $configPath) {
  $workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
  if (Test-Path "$workDir\.git") { Write-Host "[4] 作業ディレクトリ: ✓ サイトのリポの clone（$workDir）" -ForegroundColor Green }
  else { Write-Host "[4] 作業ディレクトリ: ⚠ clone が無い（$workDir）→ STEP 7 が clone する" -ForegroundColor Yellow }
}
$rulesPath = Join-Path $env:OneDrive '右腕AI\00_Resources\plaud_規則.json'
if (Test-Path $rulesPath) { Write-Host "[5] 規則の正本: ✓ $rulesPath" -ForegroundColor Green }
else { Write-Host "[5] 規則の正本: ✗ 無い（$rulesPath）→ 誤字の関門が動かないので載せない（STEP 5.7 で止まる）" -ForegroundColor Red; $ok = $false }

if (-not $ok) {
  Write-Host "`n⛔ 必須項目（設定ファイル/トークン）が不足しています。上記を解消してから再実行してください。" -ForegroundColor Red
  exit 1
}
Write-Host "`n✅ プリフライト完了。処理を続行します。" -ForegroundColor Green
```

**判定ルール（このスキルが守ること）:**
- **[2] 設定ファイル or Plaudトークンが無い → 即停止**し、`setup-plaud.ps1` の実行をユーザーに案内する
- **[3] git無し → 警告のみで続行**（デプロイ(STEP7)まで不要。STEP7到達時に未導入なら改めて案内し、デプロイはスキップ）
- **[4] clone が無い → 警告のみ**（STEP 7 が clone する）
- **[5] 規則の正本（OneDrive の plaud_規則.json）が無い → 停止**（OneDrive の同期を待つか、場所を確かめる）
- **[1] スキルファイル**は、スキルが起動できている時点で当該PCに存在する（自己チェック不要）。もし別PCにスキル自体が無ければ `/plaud-html` 自体が呼べないため、その場合はセットアップ節の1行コマンド（`migrate.ps1`）を案内する

### STEP 1: 載せる録音を決める（file_id で照合・2026-10-29〜）

**前提: 決めるのは毎日の会議の取り込み（会議取り込み_log の「名前の案・分類・確からしさ・HTML」）と Plaud のフォルダ（本人の操作）。このスキルは推測で決めない。**

1. `plaud-folders.ps1` で一覧を取る（上の「Plaud 4.0 のフォルダ判定」。トークンが切れていれば中で `refresh-plaud-token.ps1` が取り直す）。
2. **載せる候補**＝次のどれか。それ以外は HTML にしない（A-2。`audit.js` も止める）:
   - folder が `社内`・`社外`・`講話録音`・`学生発表`（本人が振り分けた物）
   - folder が `未振り分け` で、`00_Resources\plaud_掲載の承認.json` にある物、または会議取り込み_log の確からしさが **高・中** で本人が否と言っていない物（夜の自走は 1 晩 8 本まで・古い順）
3. **載せない型**（plaud_規則.json の `folders.載せない型`）: 名前が「 - Highlights」「 - 会議議事録」で終わる・file_id が `of_n_note:` で始まる（同じ会議の写し）・面接/面談/入社前・Welcome。folder が `面接`・`ようこそ` も載せない。
4. **短い録音**（`short_recording`）: `duration_ms` が 600 秒（10 分）未満は、本人が「載せる」と答えた物だけ HTML にする。180 秒未満で要約が無い物はゴミ箱の候補（`plaud-trash.ps1` が一覧を出す。移すのは本人の OK の後）。
5. **すでに載っているかは file_id で見る**（A-6。題名・日付では照合しない＝同じ日に 2 本ある日・本人が後で題名を変えた録音で間違えるため）:
```powershell
$site = "$env:USERPROFILE\.plaud\farman-mtg-site"
$onSite = @{}; foreach ($f in Get-ChildItem $site -Filter '2026-*.html') { $m = [regex]::Match([IO.File]::ReadAllText($f.FullName,[Text.Encoding]::UTF8), '<meta\s+name="plaud-file-id"\s+content="([^"]+)"'); if ($m.Success) { $onSite[$m.Groups[1].Value] = $f.Name } }
$rec = [IO.File]::ReadAllText("$env:TEMP\plaud-folders.json",[Text.Encoding]::UTF8) | ConvertFrom-Json
$rec | Where-Object { -not $onSite[$_.file_id] } | Select-Object file_id, folder, name   # ← まだ載っていない録音
```
   載っていない録音の数と、いちばん古い物の日数は `node plaud-pending.js <サイトのフォルダ>` が 1 行で出す（朝の報告の止まりの検知 A-5 と同じ数え方）。

**題名とファイル名**
- 題名: 本人が Plaud で名前を付けた物（頭が `MM-DD ` で plaud_規則.json の naming の型に合う物）はその名前を**一字一句そのまま**。Plaud の自動の名前（`会議：…・…` の列挙）のときは、会議取り込み_log の「名前の案」を使う。どちらも typos の gate の語（北斗市→北杜市 など）は正に直す。
- ファイル名: `2026-MM-DD_<ローマ字>.html`。日付は名前の頭の `MM-DD`（無ければ `start_ms`）。漢字の読みは 1 字ずつ確かめる（禁止例: `中村高校` → `chuo-koko`。正: `nakamura-koko`）。珍しい漢字（碑・髙・﨑 など）は落とさない。読みが分からなければ HTML にする前に本人に聞く。
- 会議・イベントの種別名（体験受入・研修・冒頭説明 など）は Plaud の原文・本人の名前から取る。推測で書き換えない。

### STEP 2: 社内 / 社外を決める（Plaud のフォルダ名で・推測しない）

| plaud-folders の folder | 分類 | テンプレート |
|---|---|---|
| `社内` | 🏢 社内 | 議事録テンプレート（グリーン） |
| `社外` | 🤝 社外 | 議事録テンプレート（アンバー） |
| `講話録音`・`学生発表` | 🎤 講話録音 | 講話ナレッジテンプレート（インジゴ） |
| `面接` | HTML 化しない（報告も不要） | — |
| `未振り分け` | STEP 1 の 2 に当たる物だけ、会議取り込み_log の「分類」（承認の一覧なら「分類」）で。log の分類とフォルダが食い違えばフォルダを正にし報告に 1 行 | — |

### STEP 3: 議事録の内容を取得する

- 載せる録音それぞれについて `get_note` で AI 要約（action_items・summary・key_topics）を取る。長さ・名前・日付は `plaud-folders.json` から（`get_file` は呼ばない）。
- ページの `<meta name="plaud-file-id" content="<file_id>">` に、この録音の file_id を必ず入れる（STEP 4 のテンプレート。無いと STEP 5.7 で止まる）。
- `get_note` が 500 を返したら最大 3 回まで再試行し、だめならスキップして報告に「⏳ 要約生成中のためスキップ（次回再処理）」（上の「get_note の 500 エラー対応」）。
- MCP が `Not authenticated` なら上の手順で `login`。

### STEP 4: HTMLファイルを生成する（2026-10-29〜 新しい作り: 共通 CSS 1 本・結論カード・飾り無し）

**本人の答え（10-29）: 「飾りを落として、軽さ・崩れなさ・印刷を優先」「宿題の正本は Asana、サイトは映すだけ」。** 見た目は全部 `site.css`（サイトのリポ直下・全ページ共通）が持つ。ページに `<style>` を書くのは「そのページだけの図の形」がある時だけ（数行。`<style id="page-css">`）。旧 102 本も 10-29 にこの作りへ一括変換した（本文の字は変えず・要約段落とヘッダーの議題行だけ外した）。

**色（テーマ）は `<body>` のクラスとバッジで決まる（CSS は site.css にある。ページに色の変数を書かない）:**
- 🏢 社内 → `<body class="th-in">` ＋ `<span class="badge-header-internal">🏢 社内</span>`（緑）
- 🤝 社外 → `<body class="th-ex">` ＋ `<span class="badge-header-external">🤝 社外</span>`（琥珀）
- 🎤 講話録音 → `<body class="th-kowa">` ＋ `<span class="badge-header-kowa">🎤 講話録音</span>`（藍）→ 下記「講話ナレッジテンプレート」
- 図の中の色は `var(--c-300)`（暗い箱の上の明るい差し色）・`var(--c-700)`（白地の上の濃い色）・`var(--green-*)` `var(--amber-*)` `var(--indigo-*)` `var(--gray-*)` が使える（全部 site.css の `:root`）

---

#### ▼ 必ず守る形（1 つでも抜けたら NG・STEP 5.7 の audit と下の自己点検で見る）

- [ ] `<head>` は テンプレのとおり: `site.css?v=2` → `enhance.css?v=10` の順で読む。**Google Fonts（`@import`・`<link>`）は読まない**（1 ページ 1.25MB の通信の 85% だった）。字は `site.css` の `system-ui, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`。ページで `font-family` を書かない
- [ ] `<meta name="plaud-file-id">`（録音の印）と `<meta name="entities">`、`<meta name="description">`（一覧のカードの要約。要約の段落を本文に書かない代わり。10-29 に既存 102 本へも前の一覧のカードの要約を入れた）を入れる
- [ ] ヘッダーは **1 行の帯**（高さ 120px 目安）: 戻る＋パンくず／バッジ＋題名／日付・録音の長さ・読了時間・場所・参加者。**議題の行は書かない**（目次・見出しと重複）。「FARMAN Inc.」の札も書かない
- [ ] 本文 `<div class="detail-content" id="detailContent">` の**先頭に結論カード `<section class="concl-card" id="summary-card">`**（決まったこと 3〜5 行・宿題・次回）。**要約の段落（200 字）は書かない**（カードが代わり）
- [ ] 各節の終わりに `.decision-box`（`<strong>結論:</strong> …`）。結論カードの「決まったこと」はこの箱の**最初の 1 文をそのまま**並べる（言い換えない）
- [ ] **宿題の型は `何を：担当：期限`**（全角の「：」。期限が無ければ `：-`。担当は社員の表記・さん無し。複数は「、」）。結論カードの行（`li.todo-row#todo-<n>`）とページ下の `.action-item[data-todo="<n>"]` の両方に同じ番号 n を付ける（Asana からのリンク先 `#todo-<n>`）。担当が書けない宿題はカードで `担当未定`（赤）
- [ ] 宿題のチェックボックスは**見るだけ**（`disabled`）。端末に覚えさせない（localStorage 禁止）。済は Asana の済から夜の自走が `data-done="1"` を書く → site.css が ✓ と取り消し線で出す
- [ ] **数字・棒・円は最初から最後の値で書く**（`style="width:72%"`・数字の字・`stroke-dashoffset` の値）。**ページに `<script>` を書かない**（下の edit-mode.js・enhance.js の 2 行だけ）。IntersectionObserver・数え上げ・`data-width` で伸ばす仕掛けは禁止（印刷・PDF で 0 や空になる元だった）
- [ ] **字は 12px 以上**（`font-size:11px` 以下を書かない。SVG の `<text>` も `font-size="12"` 以上で、図が縮んでも 12px 以上に見える大きさ）
- [ ] **飾りは書かない**: 浮かぶ粒（hero-particle）・ノイズ（::after の feTurbulence）・ふわっと出る（.reveal）・脈打つ輪（pulse-ring）・紙吹雪・光る影（`box-shadow:0 0 8px`）・字のグラデーション・上の進み具合の線（#scroll-progress）
- [ ] 暗い図の箱（`.chart-container`）の中の字は白系のまま（`color` を書かない。濃い字 `var(--gray-700)` などを箱の中で使わない＝暗い背景で読めなくなる）

---

#### ▼ チャートの種類（必ず最適なものを 1〜2 種類・値は最初から書く）

MTG の内容に合う図を 1〜2 種類選び、独自の内容で書く（プレースホルダー禁止）。**枠は `<div class="chart-container" id="…"><div class="chart-title">📊 題</div> … <div class="chart-insight">…</div></div>`**。共通の部品（KPI・横棒・縦の棒・時系列）は site.css が持つので**クラスを付けるだけ**。

**① 棒（anim-bar）— 数値を順に比べる**
```html
<div class="anim-bar-wrap">
  <div class="anim-bar-label"><span>ラベル</span><span>85%</span></div>
  <div class="anim-bar-track"><div class="anim-bar-fill" style="width:85%"></div></div>
</div>
```
色を変えるときは `anim-bar-fill amber-fill` / `red-fill`。

**② 横棒（hbar）— 人・品目ごとの量を並べる。説明の字は棒の外（`.hbar-val`）に書く**（棒の中に書くと短い棒で字が切れる。10-29 坂ノ途中で実際に「850円/kg（緑の」で切れていた）
```html
<div class="hbar-row">
  <div class="hbar-name">玉ねぎスライス</div>
  <div class="hbar-track"><div class="hbar-fill col-amber" style="width:72%"></div></div>
  <div class="hbar-val">950円/kg（ケース12kg）</div>
</div>
```
色: `col-amber` `col-green` `col-blue` `col-red` `col-purple` `col-pink` `col-indigo` `col-teal`。スマホ（幅 560 以下）では名前→棒→説明の縦積みになる（site.css）。

**③ ドーナツ — 進捗率・割合を 1 つの数で**（円周 364。`stroke-dashoffset = 364 × (1 − 割合)` を計算して書く）
```html
<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
  <div style="position:relative;width:140px;height:140px;flex-shrink:0;">
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="16"/>
      <circle cx="70" cy="70" r="58" fill="none" stroke="var(--c-300)" stroke-width="16" stroke-linecap="round" stroke-dasharray="364" stroke-dashoffset="102" transform="rotate(-90 70 70)"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <span style="font-size:28px;font-weight:800;">72%</span><span style="font-size:12px;">達成率</span>
    </div>
  </div>
  <div><!-- 凡例・説明 --></div>
</div>
```

**④ 月別カレンダー表 — 季節性・繁閑**（横に長いので `overflow-x:auto` の中に `min-width:600px`。札の字も 12px）
```html
<div style="overflow-x:auto;">
  <div style="display:grid;grid-template-columns:90px repeat(12,1fr);gap:3px;min-width:600px;">
    <div style="font-size:12px;font-weight:700;padding:6px;">項目</div>
    <div style="font-size:12px;text-align:center;padding:6px;">1</div><!-- …12 -->
    <div style="font-size:12px;font-weight:600;padding:8px 6px;">作物名</div>
    <div></div><div style="background:rgba(255,255,255,.35);border-radius:4px;padding:4px;font-size:12px;text-align:center;">播種</div>
  </div>
</div>
```

**⑤ レーダー（SVG）— 多軸評価**（多角形の `points` は計算して書く: 中心 (150,150)・半径 100・角度 = 360°×i/軸数 − 90°。軸の名前は `font-size="13"` 以上＝図が 300px より小さく縮んでも 12px 以上）
```html
<svg viewBox="0 0 300 300" style="max-width:300px;width:100%;margin:0 auto;display:block;overflow:visible">
  <!-- 背景の多角形 3 段・軸の線 -->
  <polygon points="150,65 232,103 …" fill="rgba(252,211,77,.35)" stroke="var(--c-300)"/>
  <text x="150" y="38" text-anchor="middle" fill="#fff" font-size="13">品質</text>
</svg>
```

**⑥ 2×2 マトリクス — 施策の分類**（外側に `class="matrix-grid"` を付ける＝スマホ〈幅 640 以下〉で 1 列に積む）
```html
<div class="matrix-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
  <div style="background:rgba(255,255,255,.14);border-radius:8px;padding:12px;"><div style="font-size:12px;font-weight:700;color:var(--c-300);">⭐ 優先実行（効果大・手間小）</div><div style="font-size:13px;">・施策A</div></div>
  <!-- 要検討・後回し・見直し -->
</div>
```
軸の名前は縦書き（`writing-mode:vertical-rl`）にしない（スマホで 1 字ずつ折れる）。象限の見出しに軸を書く。

**⑦ 時系列（tl-flow）— 予定・工程**（site.css。子の順は `tl-dot → tl-time → tl-title → tl-desc → tl-status` 固定。崩すと見出しと本文が入れ替わる・07-28 に発生）
```html
<div class="tl-flow">
  <div class="tl-item"><div class="tl-dot tl-active"></div><div class="tl-time">9月13日</div><div class="tl-title">団体貸切</div><div class="tl-desc">説明</div><div class="tl-status tl-prog">🔄 直前準備</div></div>
</div>
```
状態: `tl-done`（済）・`tl-prog`（進行中）・`tl-todo`（予定）。**フェーズを横に 3 列並べる工程表は作らない**（幅 390 で 1 字ずつ縦に折れた・05-15 ユニバ）。段の並びは tl-flow か ⑫ を使う。

**⑧ KPI カード — 複数の数値の一覧**（site.css）
```html
<div class="kpi-grid">
  <div class="kpi-card"><div><span class="kpi-num">500</span><span class="kpi-unit">万円</span></div><div class="kpi-label">新規導入したドローン</div></div>
</div>
```

**⑨ 流れ図（SVG）— 意思決定・因果・仕組み**（**`<div class="svg-scroll">` で包み、svg に `style="min-width:600px"`**＝スマホでは縮めず横にずらして見る。10-29 三菱地所の因果図が幅 390 で字 5px 相当に縮んでいた。字は `font-size="12"` 以上・`font-family` は書かない）
```html
<div class="svg-scroll">
  <svg viewBox="0 0 640 280" style="min-width:600px">
    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 Z" fill="rgba(255,255,255,.8)"/></marker></defs>
    <rect x="20" y="110" width="130" height="54" rx="10" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.5)"/>
    <text x="85" y="134" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">入力</text>
    <text x="85" y="153" text-anchor="middle" fill="rgba(255,255,255,.85)" font-size="12">データ収集</text>
    <line x1="150" y1="137" x2="200" y2="137" stroke="rgba(255,255,255,.7)" stroke-width="1.5" marker-end="url(#arrow)"/>
  </svg>
</div>
```

**⑩ 積み上げ棒 — 構成の変化**（高さは px で書く。140px が 100%）
```html
<div style="display:flex;align-items:flex-end;gap:16px;height:180px;">
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;">
    <div style="width:100%;display:flex;flex-direction:column;gap:2px;height:140px;justify-content:flex-end;">
      <div style="height:35px;background:#6366f1;border-radius:4px 4px 0 0;" title="テクノロジー 25%"></div>
      <div style="height:63px;background:#f59e0b;" title="慣行 45%"></div>
    </div>
    <div style="font-size:12px;margin-top:6px;">2024</div>
  </div>
</div>
```

**⑪ バブル（ポジショニング）**: 位置は `left/bottom` の % で書く。バブルの中の字・軸の字は 12px 以上。

**⑫ ステップ（段の進み）**: 丸と線を横に並べ、外側に `overflow-x:auto`。札の字は 12px 以上・`max-width:84px`。

**⑬ ゲージ（半円）**: 弧の長さ 283。`stroke-dashoffset = 283 × (1 − 割合)` を書く。中の数字は字で書く。

**⑭ ブレット（目標と実績）**: ② の横棒の `.hbar-track` の中に `<div class="hbar-target" style="left:100%" title="目標 7.8t"></div>`。

**⚡ 図の共通の決まり:**
- **必ず `chart-insight`（一番言いたい数字を 1 文で）を 1 つ添える**
- 単位・凡例・出典を書く。色は意味で（済・良＝緑／注意＝赤／中立＝テーマ色）
- 幅 390 で崩れないこと（下の自己点検で横スクロール 0・はみ出し 0・12px 未満 0）

**✅ 生成後の自己点検（必須・目で見るだけだと漏れる）**: ローカルの静的サーバーで開き、幅 390 と 1280 で次を `javascript_tool` で読む（再生成後は `?cb=N`）。
```javascript
(() => {
  const vis = el => el.checkVisibility ? el.checkVisibility() : true;
  const small = [...document.querySelectorAll('#detailContent *, .detail-header *')].filter(el => vis(el) && el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.textContent.trim().slice(0, 20));
  return {
    hscroll: document.documentElement.scrollWidth > innerWidth,           // false であること
    small,                                                                // 空であること（SVG は縮みも見る）
    card: !!document.querySelector('#detailContent > .concl-card'),       // true
    todosMatch: document.querySelectorAll('.todo-row').length === document.querySelectorAll('.action-item').length,
    noOwner: [...document.querySelectorAll('.td-who.td-none')].length,    // 0 が望ましい（担当を書く）
    chartsWithoutInsight: [...document.querySelectorAll('.chart-container')].filter(c => !c.querySelector('.chart-insight')).map(c => c.id),
    scripts: [...document.querySelectorAll('script')].map(s => s.src.split('/').pop()), // edit-mode.js・enhance.js の 2 つだけ
    fonts: [...document.querySelectorAll('link,style')].some(e => /fonts\.googleapis/.test(e.outerHTML)), // false
    relatedHrefs: [...document.querySelectorAll('.related-card')].map(a => a.getAttribute('href'))
  };
})()
```
`relatedHrefs` は実ファイルがあるかを `Test-Path` で必ず確かめる。

**チャート選択ガイド:**

| MTGの内容 | 推奨チャート |
|---------|------------|
| 数値・量の比較 | ① 棒 or ② 横棒 |
| 進捗率・達成率 | ③ ドーナツ or ⑫ ステップ |
| 季節性・カレンダー | ④ 月別カレンダー表 |
| 多軸評価・バランス | ⑤ レーダー |
| 施策の優先度分類 | ⑥ 2×2 マトリクス |
| 工程・スケジュール | ⑦ 時系列 |
| 複数KPI・数値サマリー | ⑧ KPI カード |
| プロセス・意思決定・因果 | ⑨ 流れ図 |
| 構成比の変化 | ⑩ 積み上げ棒 |
| ポジショニング・競合比較 | ⑪ バブル |
| 単一スコア | ⑬ ゲージ |
| 目標 vs 実績 | ⑭ ブレット |

---

#### ▼ HTMLテンプレート全体構造

```html
<!DOCTYPE html>
<html lang="ja"><head>
  <meta charset="UTF-8"><link rel="icon" type="image/svg+xml" href="favicon.svg">
  <meta name="plaud-file-id" content="{Plaud の file_id。plaud-folders.ps1 の出力・list_files の id}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Plaudタイトル} — Farman MTG Summaries</title>
  <meta name="entities" content="{人物・企業名をカンマ区切り。例: 井上,瀬戸山,双日,坂ノ途中}">
  <meta name="description" content="{会議の要約 1〜2 文（100 字前後）。一覧のカードの要約になる。ページには出ない}">
  <link rel="stylesheet" href="site.css?v=2">
  <link rel="stylesheet" href="enhance.css?v=10">
  <!-- そのページだけの図の形があるときだけ: <style id="page-css">.my-chart-x{…}</style>（字 12px 以上・アニメーション・font-family は書かない） -->
</head>
<body class="th-ex"><!-- 社内 th-in / 社外 th-ex / 講話 th-kowa -->
<nav class="floating-toc" id="floatingToc"><h4>目次</h4><ul class="toc-list" id="tocList"></ul></nav><!-- 中身は enhance.js が作る -->

<header class="detail-header"><div class="detail-header-inner">
  <div class="hd-top">
    <a href="index.html" class="back-link"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 3L5 8l5 5"/></svg>一覧に戻る</a>
    <nav class="breadcrumb" aria-label="パンくずリスト"><a href="index.html">ホーム</a><span class="bc-sep">›</span><a href="index.html?filter=external">社外</a><span class="bc-sep">›</span><span class="bc-current">{タイトル}</span></nav>
  </div>
  <div class="hd-title"><span class="badge-header-external">🤝 社外</span><h1>{タイトル}</h1></div>
  <div class="hd-meta">
    <span>📅 {YYYY}年{M}月{D}日 {HH:MM〜HH:MM}</span>
    <span>⏱ 録音: {duration}</span>
    <span id="readTime">📖 読了時間: 約{本文の字数÷400 を切り上げ}分</span>
    <span>場所: {場所}　｜　参加者: {相手先の人}、{社員}</span><!-- 分かる物だけ。議題は書かない -->
  </div>
</div></header>

<div class="detail-content" id="detailContent">
  <!-- ① 結論カード（先頭・必須） -->
  <section class="concl-card" id="summary-card" aria-label="結論・宿題">
    <div class="cc-block cc-dec"><h2 class="cc-h">決まったこと <span class="cc-n">{結論の数}件</span></h2>
      <ul class="cc-list">
        <li>{節 1 の結論の最初の 1 文}<a href="#sec1" aria-label="この結論の節へ">本文→</a></li>
        <!-- 5 件まで。6 件目からは下の details の中へ -->
      </ul>
      <details class="cc-more"><summary>ほか {n} 件</summary><ul class="cc-list"><li>…</li></ul></details>
    </div>
    <div class="cc-block cc-todo"><h2 class="cc-h">宿題 <span class="cc-n">{N}件（担当未定 {k}・担当の記載なし {x}）</span></h2>
      <ul class="cc-todos"><!-- 担当ごとにまとめて並べる（井上→瀬戸山→井出→田中→…→担当未定）。id の番号はページ下の宿題の順 -->
        <li class="todo-row" id="todo-1" data-todo="1"><span class="td-who">田中</span><span class="td-what">{何を}</span><span class="td-due">期限 9/18</span></li>
        <li class="todo-row" id="todo-5" data-todo="5"><span class="td-who td-none">担当未定</span><span class="td-what">{何を}</span><span class="td-due td-nodue">期限なし</span></li>
        <!-- 10-29 夜: td-who は plaud_規則.json の people（社員の表記）に合う物だけ。「田中さんとの面談も含む」「Speaker 3」「川口氏」などは td-what の後ろに（…）で戻す。
             赤の「担当未定」は社内のページ（と社外のページでファーマン側の宿題）で担当が無い物だけ。社外・講話のページで相手側の宿題・担当の書いていない宿題は灰色: -->
        <li class="todo-row" id="todo-6" data-todo="6"><span class="td-who td-none td-ext">担当の記載なし</span><span class="td-what">{何を}</span><span class="td-due td-nodue">期限なし</span></li>
      </ul>
    </div>
    <div class="cc-block cc-next"><h2 class="cc-h">次回</h2><p>{次回の日程・場所（話に出たときだけ。無ければこの塊ごと書かない）}</p></div>
  </section>

  <div class="kw-bar"><a class="kw-chip" href="index.html?q=…">…</a></div>

  <h2 class="section-h2" id="sec1">{セクション1}</h2>
  <p>本文...</p>
  <div class="decision-box"><strong>結論:</strong> …。…。</div>
  <hr class="section-sep">

  <div class="chart-container" id="myChart">
    <div class="chart-title">📊 {タイトル}</div>
    <!-- ① 〜 ⑭ から（値は最初から書く） -->
    <div class="chart-insight"><span class="ci-ico">💡</span><p><b>注目：</b>…</p></div>
  </div>

  <div class="ai-section">
    <div class="ai-title">✨ AIサジェスト — 次のアクション候補</div>
    <ul class="ai-list"><li>...</li></ul>
  </div>

  <div class="related-section"><h2 class="section-h2" id="related">関連するMTG</h2><div class="related-grid">…</div></div>

  <div class="actions-section">
    <div class="actions-title">📋 ToDo</div>
    <div class="actions-progress">
      <div class="actions-progress-label"><span>進捗</span><span id="progressCount">0 / {N} 完了</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" id="progressBar"></div></div>
    </div>
    <ul class="action-list" id="actionList">
      <li class="action-item" data-todo="1"><input type="checkbox" id="a1" disabled><label for="a1">{何を}：{担当}：{期限}</label><button class="copy-btn" onclick="copyAction(this,event)">📋 コピー</button></li>
    </ul>
  </div>
</div>

<script src="edit-mode.js?v=15"></script>
<script src="enhance.js?v=8"></script>
</body></html>
```
`#progressCount` と `#progressBar` は enhance.js が `data-done="1"` の数から書く（ページで数えない）。

---

#### ▼ 📥 ダウンロード（edit-mode.js v14・2026-10-29〜）— 1 ファイルで崩れない送付版＋伏せ字の補助

**「💾 ファイルを更新」は消した**（畳んだ旧作業場を指していた）。ページ右下は **✏️ 編集モード**（この端末だけで文を直す）と **📥 ダウンロード** の 2 つ。

📥 を押すと、ライブのページは触らず**写し（clone）**で次をして 1 ファイルにする:
- `site.css`・`enhance.css` の中身を `<style>` で**埋め込む**（外の CSS が読めなくても崩れない。1 本 70KB 前後・100KB 未満）。`#page-css` は後ろに残す
- 外す: 戻る・パンくず・kw-bar・enhance.js の差し込み UI（mini-bar・to-top・fab・目次シート・🔗）・コピーのボタン・`<script>` 全部・`<meta name="entities">`（社員名の一覧）・`meta last-edited`・favicon。社外は「関連するMTG」も外す
- 用語の説明（`.term[data-tip]`）は `title` に写す（単体でも指を置くと出る）
- **伏せ字の補助**: 写しの本文から「個人の健康（体調・診断・入院・病・怪我…を含む文。作物の病気〈ベト病・病害など〉は外す）」「社内のお金（原価・人件費・給与・利益率…と金額が同じ文）」「社内メモ（社内メモ・内部・ここだけ・オフレコ を含む段落・箱）」を拾い、黄色で示した一覧で **伏せる／そのまま** を選ばせ、選んだ所を `［伏せ］` に置き換えてから保存する（候補が無ければそのまま保存）。**語の一覧は edit-mode.js の頭の `REDACT`** にまとめてある（後で `plaud_規則.json` の `redact` 節から読む形にする）。夜の自動の送付版は作らない（本人 10-29「こちらの操作でダウンロード出来たら問題ない」）
- 確かめ用に `window.__plaudBuildStandalone(isExternal, redactAll)` が画面を出さずに同じ HTML を返す

edit-mode.js・enhance.js・site.css・enhance.css を変えたら、全ページの `?v=N` を上げる（今は edit-mode **v=14**・enhance.js **v=7**・site.css **v=1**・enhance.css **v=10**）。

#### ▼ 共通の層（site.css / enhance.css / enhance.js）

- **site.css**: 見た目の全部（ヘッダーの帯・結論カード・本文・図の部品・宿題・テーマ色・スマホの縦積み・12px の下限）
- **enhance.css**: 読む道具の見た目と**印刷/PDF**（`@media print`: 白地・飾り無し・結論カードの「ほか n 件」も開いて印刷・SVG は紙の幅に）
- **enhance.js**: PC の右の目次を作る・**宿題のコピー（`copyAction`）**・**宿題の済（`data-done`）を結論カードと下の一覧の両方に映して進捗の数を書く**・`#todo-<n>` で開いたら畳みを開く・極細の節バーとページ内検索・見出しの🔗・トップに戻る・用語の説明・人と会社の強調（`.ent`）・ダーク表示・Markdown コピー・印刷ボタン。**既読の印（localStorage）は 10-29 にやめた**

**コンテンツ側で必ず入れる（知能化）：**

1. **`<meta name="entities">`** … 人物・企業名をカンマ区切り。本文中の該当名が自動で強調（`.ent`）される。**1文字の固有名（「原」「林」等の1字姓）は入れない**（「原料」「林業」等の無関係な語に誤マッチして色が付く。enhance.js側でも2文字未満は強調対象外にしているが、メタにも入れないこと）。**また、entities に書いた語は本文に必ず登場させること**（2026-08-10 追記。全体MTGの entities に、他ページから引き写した参加者名「井上・関根・瀬戸山」を入れたが、その回のPlaud要約には出てこないため本文に書けず、`audit.js` の「meta entities の語が本文に無い」で検出された。**参加者欄・entities を前回ページからコピーしない。** Plaud要約に名前が無い回は、参加者を推測で補わず entities からも外す）。
2. **キーワードチップ**（結論カードの直後）：
```html
<div class="kw-bar">
  <a class="kw-chip" href="index.html?q=カーボンクレジット">カーボンクレジット</a>
  <a class="kw-chip" href="index.html?q=北杜市">北杜市</a>
</div>
```
3. **専門用語ツールチップ**：初見で分かりにくい語を `.term` で囲み `data-tip` に短い解説（ホバー/タップで表示）：
```html
<span class="term" data-tip="バイオ炭：生物資源を低酸素で炭化したもの。土壌改良＋炭素固定に使え、カーボンクレジット化が検討される。">バイオ炭</span>
```
4. **関連MTGリンク**（ToDoの直前）：STEP1で取得した**既存HTML一覧**を見て、**同じ人物・企業・テーマを共有する過去ページを2〜4件**選びリンクする（上のテンプレの `.related-section`）。`.related-card` の中は `rc-date`・`rc-title`・`rc-why`（🔗 共通の理由）。

**コンテンツ生成指針：**
- **タイトルはPlaudのファイル名をそのまま使う**（変換・省略・空白の追加・削除は一切しない）
- セクションはPlaudのkey_topicsをベースに、内容の論理的なまとまりで分ける（3〜15セクション程度）
- 各セクションに `結論:` のdecision-boxを必ず追加。**最初の 1 文で「何が決まったか」を言い切る**（結論カードに最初の 1 文が並ぶ）
- section-h3 はセクション内にサブトピックがある場合に使う
- ToDoはaction_itemsから生成（なければsummaryから抽出）。**型は `何を：担当：期限`**
- **チャートは必ず1〜2種類追加する**（上記14種の中からMTG内容に最も合うものを選ぶ）
- **AIサジェストは必ず追加する**（4〜5件）
- 録音が短い（数分）回は、録音より膨らませない（節 2〜3・図は 1 つまで）

---

#### ▼ 🎤 講話録音 — 講話ナレッジテンプレート（議事録テンプレートとは別設計）

**講話録音ファイルは議事録テンプレートを使わず、以下の専用テンプレートで生成する。** 土台（head・ヘッダーの帯・site.css・飾り無し・字 12px 以上・script 2 行）は上の議事録テンプレと同じ。`<body class="th-kowa">`。

設計の違い：
- ToDo → **なし**（講話はアクション管理でなくナレッジ蓄積が目的）。結論カードも作らない（`.insight-box` の「テーマの核心」を 1 つ目の節に置く）
- セクション構成 → 固定4セクション（下記）
- テーマタグ → 必須（kowa-knowledge.html の横断検索に使用。ヘッダーの帯の下に `<div class="theme-tags"><span class="theme-tag">農業観</span>…</div>`）
- 関連講話リンク → 自動生成（既存の他講話HTMLと照合）

**固定セクション構成：**

1. **📌 講話の概要** — 誰が・何について・いつ話したかの3行サマリー＋ `<div class="insight-box"><strong>テーマの核心:</strong> …</div>`
2. **💡 キーフレーズ・名言** — 印象的な言葉を引用ボックスで表示（3〜6件）
3. **🧠 学びのポイント** — 箇条書き（5〜10件）＋ データビジュアライズ（上記チャートから選択）
4. **🔮 今後への示唆** — この講話から導かれる次の一手（3〜5件）

**テーマタグ（必須）：**
```html
<meta name="kowa-themes" content="テーマ1,テーマ2,テーマ3">
<meta name="kowa-speaker" content="話者名（不明な場合は空）">
<meta name="kowa-keywords" content="キーワード1,キーワード2,...">
<meta name="kowa-date" content="YYYY-MM-DD">
<meta name="kowa-title" content="講話タイトル">
```

テーマ候補（MTGの内容から最も合うものを2〜4つ選ぶ）：
`経営哲学` `農業観` `人材育成` `マーケット` `地域連携` `テクノロジー` `サステナビリティ` `食と健康` `組織文化` `リーダーシップ`

**引用ボックスのHTML**（site.css の `.kowa-quote`＝暗い箱・白い字。中の形は `#page-css` に数行）：
```html
<div class="kowa-quote">
  <div class="kowa-quote-mark">"</div>
  <p class="kowa-quote-text">引用テキスト</p>
  <div class="kowa-quote-source">— 話者名（任意）</div>
</div>
```

**ヘッダーバッジ：** `badge-header-kowa`（`🎤 講話録音`）

**ファイル命名規則：** `{YYYY-MM-DD}_{ローマ字スネークケース}-kowa.html`

---

### STEP 5: index.html は gen-aux.js が全部作る（手でカードを足さない・2026-10-29〜）

index.html は STEP 5.6 の `gen-aux.js` が会議ページ（`2026-*.html`）から毎回まるごと作り直す。**手でカードを足したり数字を直したりしない**（直しても次の実行で消える）。会議ページを置いたら STEP 5.6 を流すだけ。

index の作り（U2・全体改善案 v1.0 §2-2）:

| タブ | 中身 | 元 |
|---|---|---|
| 今週（既定） | 今日から 7 日（少なければ 14 日）の会議の「決まったこと」を 1 行ずつ。2 週間会議が無ければ「最後の会議までの 2 週分」と書いて出す | 会議ページの決定（index に埋め込む） |
| 宿題 | 人ごとのタブ（井上・瀬戸山・井出・田中・関根・豊田・青柳＋ほかの人＋担当未定）。期限順・済/未・期限切れは赤 | `data/todos.json`（タブを開いた時だけ読む） |
| 取引先 | 社名の一覧 → `partners/<slug>.html` の年表 | `data/partners.json` の元と同じ集計 |
| 一覧 | 会議カード（題・社内/社外/講話・要約 60 字・「決定 n・宿題 n」・録音時間）。種類・月・検索でしぼる | 会議ページ |

- 全文検索は、一覧の検索欄に字を入れた時だけ `search-index.json` を読む（開くたびには読まない）。カードに `data-text` は持たない。
- 前の URL はそのまま動く: `index.html?q=語`（ページのキーワードのリンク）→ 一覧で検索、`index.html?filter=internal`（パンくず）→ 一覧で種類しぼり、`#week` `#todo` `#partner` `#list` でタブ。
- 見た目: Google Fonts は使わずシステムフォント、飾り（粒・ノイズ・出現の動き・光沢）無し、字は 12px 以上。CSS は gen-aux.js が `style.css` に書く（`style.css` を手で直さない）。
- audit.js が見る所は残している: `class="mtg-card"`＋`data-type`、`<strong data-count>` 4 つ（全件・社内・社外・講話録音の順）、`id="count">N件表示中`。
- 既定のタブを変えるときは gen-aux.js の `DEFAULT_TAB` だけ（U5 の判断: 10-29 は「今週」のまま）。

講話録音のページも同じ（index には gen-aux.js が「講話」のカードで載せる）。

### STEP 5.5: kowa-knowledge.html を更新する（講話録音が追加された場合のみ）

`kowa-knowledge.html` は gen-aux.js が作らない（手で保つ）。講話録音が 1 件以上増えたら更新する。フォントは Google Fonts を使わずシステムフォント、字は 12px 以上（10-29 に直した）。

**実装の決まり（壊さない）:**
- テーマのボタン: `onclick="filterTheme(null,'テーマ名')"`（第 1 引数は null 固定）
- キーワードのチップ: `onclick="toggleKwChip(this,'キーワード')"`（押すと active、もう一度で外す・押した後 `kowaGrid` へスクロール）
- 「✕ クリア」（id="clearBtn"）: しぼり込み中だけ出し、`clearFilters()` を呼ぶ
- 講話カード（`#kowaGrid` の中）: `data-themes` / `data-keywords` / `data-speaker` / `data-date` が必須
- JS の関数は `filterTheme(_, theme)`・`toggleKwChip(chip, q)`・`searchKowa(q)`・`clearFilters()` の 4 つ

構成: 見出し → 件数とテーマ数 → テーマのボタン＋検索＋クリア → 講話カード（日付順）→ キーワード → テーマ別の索引。

### STEP 5.6: gen-aux.js で index と横断ページを作り直す（毎回・会議ページを足した・直した後は必須）

```powershell
$cfg = Get-Content "$env:USERPROFILE\.plaud\plaud-config.json" -Raw | ConvertFrom-Json
$cfgHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$skillDir = @("$cfgHome\plugins\marketplaces\farman-skills\plugins\plaud-suite\skills\plaud-html","$cfgHome\skills\plaud-html") | Where-Object { Test-Path (Join-Path $_ 'gen-aux.js') } | Select-Object -First 1
node "$skillDir\gen-aux.js" (($cfg.paths.work_dir) -replace '~', $env:USERPROFILE)
```

会議ページは**読むだけ**（書き換えない）。読み方は旧の作り（`.decision-box`・`.action-item` の label・`<meta name="entities">`・h1・ファイル名の日付・`class="badge-header-*"`）と新しい作り（先頭の結論カードの「決まったこと」・宿題行 `id="todo-<n>"`・`data-asana`・`data-done="1"`・「次回」の見出し）の両方で動く。同じ文が結論カードと本文の両方にあっても 1 つに数える。

| 出力 | 中身 |
|---|---|
| `index.html` | STEP 5 の 4 タブ |
| `style.css` | index・年表・決定・索引の共通 CSS（gen-aux.js の中の CSS を書き出す。`?v=` は中身のハッシュ） |
| `search-index.json` | 全文検索（題・言葉・本文 6,000 字）。index は検索の時だけ読む |
| `partners/<slug>.html` | 1 社 1 ページの年表: 日付 → 会議 → その会議の決定・宿題・次回 → 会議ページへのリンク。●＝題に社名がある会議（全部出す）、○＝ほかの会議で話に出た（社名がある決定・宿題だけ）。表から外れた社のページは消す |
| `decisions.html` | 決定の一覧（軽い描画ページ）。最初は `data/decisions-recent.json`（新しい 15 会議）、検索・もっと見るで `data/decisions.json` |
| `entity-index.html` | 取引先の一覧＋「人・会社・言葉で探す」（入れた時だけ `data/entities.json` を読む）。`?q=` も効く |
| `data/decisions.json`・`data/decisions-recent.json` | 決定（会議ごと・見出しつき） |
| `data/partners.json` | 年表の元 |
| `data/entities.json` | 言葉 → 会議 |
| `data/todos.json` | 宿題（下の形）。**`"source":"asana"` の物（Asana 担当が夜に作る）があれば書かない**。無い・`"source":"pages"` の時だけ、ページの宿題行から仮の物を作る |
| `data/keywords.json` | 旧 index カードの `data-text`（検索用の語）を 1 回だけ移した物。以後はこれを検索の語に足す（消さない） |

**社名の正表記**: `plaud_規則.json` の `aliases`（`{list:[{正, ゆれ:[…]}]}`）・`typos` の誤字・`people` の社員とゆれを読む。場所は 環境変数 `PLAUD_RULES` → `plaud-config.json` の `paths.rules_file` → `~/OneDrive/右腕AI/00_Resources/plaud_規則.json`。無ければ gen-aux.js の中の仮の表。取引先の一覧（正表記と URL の名前）は gen-aux.js の `PARTNERS`（`plaud_規則.json` に `partners` があれば足す）。社員名は取引先に入れない。**新しい取引先が出たら `PARTNERS` に 1 行足す**（URL の名前はローマ字・一度決めたら変えない）。

**宿題の担当と期限の読み方**: `何を：担当：期限`（担当は社員の表記・期限 `9/18`・`9月18日`・`2026-09-18`・`-`）、「担当: 井上」「@井上」、頭の「井上が／井上さんは」、終わりの「（井出・井上）」、本文の「期限: 2026-07-20」「7月31日までに」。社員でない人だけ・書いていない物は「担当未定」。2 人以上の物はそれぞれの人に入れ、`with` に一緒の人を書く（`total` は重ねない数）。

`data/todos.json` の形（Asana 担当と同じ）:
```json
{"generated":"2026-10-29T21:00:00+09:00","source":"asana|pages","total":922,
 "people":{"井上":[{"title":"…","due":"2026-11-05","done":false,"gid":null,"asana_url":null,"page":"2026-09-11_farman-zentai.html","anchor":"todo-3","meeting":"09-11 ファーマン全体MTG","date":"2026-09-11"}]},
 "unassigned":[同じ形]}
```
Asana 側の物に `"multi":[…]`（2 人以上の宿題）があれば、宿題タブに「複数人」として出す。

**流した後に見る数**（gen-aux.js が最後に出す）: 会議の本数＝一覧のカード、決定の総数＝ページの decision-box の総数、宿題の総数＝ページの action-item の総数。「注意」が出たら（h1 が無い・決定が 0）そのページを開いて確かめる。

> 古い URL は残す: `entity-index.html`・`decisions.html` は同じ名前のまま中身を軽い形にした（1.29MB・329KB → 約 21KB・13KB）。audit.js が「全ページの名前が入っているか」を見るので、両ページの下に会議の一覧（畳んだ物）を置いている。消さない。
> `repair-index.ps1` は gen-aux.js を流すだけの物になった（index は作り直せば数が合う）。

### STEP 5.7: 自己監査を実行する（必須・不合格ならデプロイ禁止）

**目視チェックは必ず漏れる。** 生成物が増えるほど「1ページだけ `chart-insight` を付け忘れる」「1項目だけ要素順が違う」が起きる（2026-07-28に実際に3件発生し、そのうち2件は目視では見逃していた）。**同梱の `audit.js` で機械的に検査する。**

```powershell
$cfg = Get-Content "$env:USERPROFILE\.plaud\plaud-config.json" -Raw | ConvertFrom-Json
$workDir = $cfg.paths.work_dir -replace '~', $env:USERPROFILE
$cfgHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$skillDir = @("$cfgHome\plugins\marketplaces\farman-skills\plugins\plaud-suite\skills\plaud-html","$cfgHome\skills\plaud-html") | Where-Object { Test-Path (Join-Path $_ 'audit.js') } | Select-Object -First 1

# 今回生成したページを列挙して厳密検査する（← 通常はこれ）
node "$skillDir\audit.js" $workDir 2026-07-27_foo-mtg.html 2026-07-17_bar.html
```

**⚠️ 2026-07-29 改訂: 常に全ページを検査し、結果を2段に分けて出す。**

| 呼び方 | ゲート（exit 1 の対象） | 使いどころ |
|---|---|---|
| `audit.js <work_dir> <対象.html…>` | **指定ページ＋サイト全体の問題** | **毎回これ。** 今回生成した全ファイルを列挙する |
| `audit.js <work_dir>` | サイト全体の問題のみ（ページ内容は全件「参考」表示） | 棚卸しの確認。exit 0 で終わる |
| `audit.js <work_dir> --all` | **全ページ** | 積み残しを本気で潰すとき |

出力は次の3段：

1. **ゲート（今回対象）** — 1件でもあれば **exit 1**。ここが0でなければ STEP 7 のデプロイに進まない
2. **参考: 既存ページの積み残し** — 検査はするがブロックしない。**積み残しを常に可視化して、後から大量に湧くのを防ぐ**のが目的（2026-07-29 に `--all` 初実行で94件/45ページが一度に出た反省）
3. **要目視: 固有名の表記ゆれ疑い（NAME）** — ヒューリスティックのため**常にブロックしない**。「東京会館／東京會舘」のような実際の揺れを拾える一方、誤検出もある

**載せてよいかの関門（2026-10-29〜・今回対象のページは止める・既存のページは参考に件数が出る）:**
- **PUB（A-2・A-6）**: `<meta name="plaud-file-id">` が無い／その録音が Plaud で 社内・社外・講話録音・学生発表 に無く `plaud_掲載の承認.json` にも無い／`of_n_note:`（Highlights・会議議事録の写し）／**同じ file_id のページが 2 本ある（二重掲載）**。照合は file_id だけで、題名・日付では見ない。**10-29 夜: `plaud_掲載の承認.json` の「載せない」にある file_id・ページ名のページは、既存・新規を問わず必ず止める**（06-24 アムウェイ補助金・樹採用MTG＝内定・再面談・希望年収・時給と年収。夜の自走が載せ直さないため）。
- **PRIV（A-3）**: 人の健康・個人の給与・面接の記録の言い方が本文・meta（description・entities）にある。10-29 夜に足した: 人の名前と同じ文の時給・日給・月給・年収・給与・賞与・手取り（「渡辺さんの現場確保（時給1,200円）」）／内定・希望年収・再面談・入社前面談・○次面接／採用候補・候補者の面談や入社の打診／入社の条件・前倒し入社。会社の単価・取引価格・就労支援の工賃・統計の年収は止めない形。**載せる会議の中に 1 文だけある時は、その所を［伏せ］にする（文の中身はほかを変えない）**
- **TYPO（A-7）**: 10-29 夜から、会議ページに加えて生成物（index・decisions・entity-index・kowa-knowledge・search-index.json・data/ の decisions・entities・keywords・todos）も見る（サイト全体の問題＝常に止める。取引先の年表は「ほかの書き方」に誤字の形をわざと載せるので見ない）。gen-aux.js と asana-sync.js は書き出す物に typos（gate=true）を当てる。`plaud_規則.json` の typos で `gate: true` の誤字（北斗市・坂の途中・千歳研究所・井手・市山マート・カオシェ・水納・脳中・アルソワ・皮脂循環）が本文・題名・meta に残っている。ゆれ・推測・要目視（`gate: false`）は止めない。規則が読めなければ、今回対象があるときは止まる。10-29 の既存 102 本では 25 件/22 本（北斗市 24 回/7 本・千歳研究所 16 回/8 本・坂の途中 19 回/7 本・井手・市山マート・カオシェ 各 1 本）＝参考に出るだけ。
- 場所は環境変数で変えられる: `PLAUD_FOLDERS`（既定 `%TEMP%\plaud-folders.json`＝STEP 1 の出力）・`PLAUD_APPROVED`・`PLAUD_RULES`（既定は OneDrive の `右腕AI\00_Resources\` の各ファイル）。

**検査内容（2026-10-29 の新しい作りに合わせた）:** index のカード数と `data-count`×4・`filter-count` の整合／カードのリンク先実在／**孤立HTML（indexに載っていないページ）**／**indexカードの「決定 n・宿題 n」がページと一致**／関連MTGリンクと結論カードの「本文→」の行き先の実在／**`site.css`・`enhance.css`・`enhance.js`・`edit-mode.js` を読み、版が他のページとそろう**（site.css の `.back-link` に `white-space:nowrap`）／**先頭の結論カード `.concl-card`**（講話で結論も宿題も無い物は除く。「決まったこと n件」＝decision-box の数・「宿題 n件」＝下の一覧の数）／**宿題の行**（結論カードの `.todo-row` に `id="todo-n"` と `data-todo="n"`、下の一覧の `.action-item` に `data-todo="n"`、番号の重複・抜け無し）／**古い作りが無い**（OLD: hero-particle・scroll-progress・`.reveal`・noanim.js・Google Fonts・Chart.js・ページ内 `<script>` の中身・`const total`）／**📥 の単体 HTML でない**（STANDALONE: site.css もスクリプトも無い・meta entities が無い・`<style>` が 20KB を超える）／チャート数と `chart-insight` 数の一致／`meta entities` の有無と**1文字語の混入**・**語が本文か `<meta name="description">` に実在するか**／section id 重複／**タイムラインの要素順**／横断ページ（entity-index・search-index.json・data/entities.json、決定があれば decisions.html・data/decisions.json）への反映／**`id="detailContent"` の存在**／**decision-box 数がセクション数に見合うか**。

- **アセットのバージョンはハードコードしていない。** 全ページの最頻値を正とし、そこから外れたページだけを報告する（`enhance.css?v=N` を上げても監査は壊れない）。
- **講話録音(kowa)は自動判定して免除される**（ToDo・decision-box・AIサジェストを持たない設計のため）。
- 監査が誤検出した場合は、ページを歪めるのではなく **`audit.js` の側を直す**（そのうえで STEP 5.7 の説明も更新する）。
- **NAME の比較相手は VOCAB（全ページの `meta entities`）に限定している**（10-29 から index のカードは `data-text` を持たない）。 日本語は語境界が無く、本文を正規表現で切ると「有機農業者向」のような断片を拾って誤検出が爆発するため（初版は52件中ほぼ全てが誤検出→語彙限定で5件に）。

> **⚠️ 監査の検出結果を鵜呑みにしない（2026-07-28の教訓）。** 初版の `audit.js` は125件を報告したが、**うち27件が偽陽性**だった。原因は次の3つで、いずれも「実ファイルを開いて確かめる」ことで判明した：
> 1. **CSSの空白ゆらぎ** — `white-space:nowrap` だけを探し、実在する `white-space: nowrap`（空白あり）を見落として17件の偽陽性。→ CSSプロパティは**ルール内を空白除去してから**比較する（`ruleHas()`）
> 2. **`decisions.html` 未掲載を一律エラー扱い** — decision-boxを持たないページ（講話・旧テンプレ）は載らないのが正しいのに10件の偽陽性。→ **decision-boxがある場合だけ**掲載を要求する
> 3. **クラス属性の完全一致** — `class="chart-insight"` のような完全一致だと、クラスが 2 つ以上ある `class="chart-insight wide"` のような物を取りこぼす。→ `hasClass()`/`countClass()` で**クラス列に耐える**判定にする
>
> **検出が出たら、直す前に必ず1件を実ファイルで裏取りする。** 監査を信じて既存ページを書き換えると、正しいものを壊す。

### STEP 6: ToDo（宿題）は Asana に登録しない（2026-10-29〜・本人「宿題の正本は Asana・登録元は 1 つ」）

**このスキルは Asana に何も登録しない。** 宿題の登録は、毎日の「会議の取り込み」（右腕AI・秘書の朝の流れ。手順は `右腕AI\秘書スペシャリスト\秘書スペシャリスト Resources\手順_会議の宿題のAsana登録.md` の A）だけが行う（登録元を 1 つにして、同じ宿題が 2〜3 件になる二重登録を止める）。議事録ページの宿題は、そのページの中の一覧として残し、Asana との相互リンクと済/未の反映は STEP 6.5 の `asana-sync.js`（全体改善案 v1.0 §4 の AS2・AS5）が行う。
- 関門（AS6）: このスキルの実行中に `create_tasks`（Asana の登録）を呼んではいけない。夜の自走の記録・完了報告に「Asana 登録: 0（会議の取り込みが担当）」と書く。
- 旧 STEP 6（「タスク：担当：期限」の形を瀬戸山の担当で登録・人ごと＋複数人に重ねて登録）は 2026-10-29 に外した。本文は git の履歴（skills-marketplace の 1.5.0 以前）にある。

### STEP 6.5: 夜の流れ — Asana の済をページに映す・載っていない録音を数える（2026-10-29〜）

夜の自走（と、このスキルを流した日）は STEP 5.6 の前に次をする。どれも**読むだけ・数えるだけ**で、Asana にもPlaud にも書かない。

1. **Asana を読む**: Claude が Asana コネクタの `get_tasks` で各人のプロジェクト（井上・瀬戸山・井出・田中・関根・豊田・青柳・複数人）を全部読み、`{"read_at":…,"projects":{…},"tasks":[{gid,project,completed,due_on,name,notes}]}` の JSON にする（形は asana-sync.js の頭の説明）。
2. **ページに印を付け、宿題タブの元を作る**:
   ```
   node asana-sync.js --site ~/.plaud/farman-mtg-site --asana <読んだ JSON> --log <右腕AI\00_Resources\会議取り込み_log.md> --apply-pages
   ```
   - 結べた宿題の行（結論カードの `id="todo-n"`）に `data-asana="<gid>"`、Asana で全部済なら `data-done="1"`。何度流しても同じ結果。画面では ✓ と取り消し線（site.css・enhance.js が下の一覧にも映す）
   - `data/todos.json`（source: asana）は**このスクリプトだけが書く**（gen-aux.js は上書きしない）
   - 結べなかった物（unsure）は理由つきで出る。題名で推し量って結ばない。まず `--dry-run` で数を見てよい
   - 10-29 夜: 宿題の文は結論カードの行の `td-what` だけ、担当は `td-who`、期限は `td-due` から読む（行の文字を全部つなぐと「担当未定…期限なし」が題名にくっついていた）
   - 「複数人」プロジェクト（1214855321951743）の宿題は担当未定に入れず `multi`（宿題タブの「複数人」）に入れ、ページの担当の人の欄にも出す（その人の分が人のプロジェクトに無いとき）
   - 社外・講話のページで担当の書いていない宿題は `external: true`（宿題タブの灰色の「担当の記載なし」）。赤の「担当未定」は社内の物だけ
   - `plaud_掲載の承認.json` の「載せない」にある会議を出典とする宿題は todos.json に出さない（summary の `excluded_no_publish`）。typos（gate=true）を題名・会議名に当てる
3. **載っていない録音を数える**: `node plaud-pending.js ~/.plaud/farman-mtg-site` の 1 行目を朝の報告に入れる（先に `plaud-folders.ps1` で `%TEMP%\plaud-folders.json` を作る）。
4. **短い録音の候補を出す**: `powershell -ExecutionPolicy Bypass -File plaud-trash.ps1`（既定は一覧だけ）。ゴミ箱へ移すのは本人が OK と言った file_id だけ（`-Apply -FileIds …`、戻すのは `-Restore`）。完全に消す操作は使わない。

このあと STEP 5.6（gen-aux.js）→ STEP 5.7（audit.js）→ STEP 7。

### STEP 6.9: 本人の直しを元ページに書き戻す（毎回・2026-10-29 改）

**📥 ダウンロードの HTML はサイトに入れない。** 「💾 ファイルを更新」は消した（edit-mode.js v14）。📥 で落とした物は、site.css・enhance.css を `<style>` に埋め込み、スクリプトと `<meta name="entities">`（と録音の印）を外した**送付用の写し**なので、リポに置くと共通の見た目の直しが届かず、強調・宿題の済の印も動かず、一覧からも漏れる（`audit.js` の STANDALONE が止める）。

本人の直しは次の形で受ける:
1. **本人の言葉で受ける**（「09-11 の 3 つ目の決定の『9月18日』は『9月20日』」のように、ページ・場所・正しい文）。会話・LINE・依頼台帳のどれでもよい。分からない所は 1 回だけ聞く。
2. **リポの元ページ**（`~/.plaud/farman-mtg-site/<日付>_<名前>.html`）を直す。本文と、同じ文がある結論カードの行（決まったこと・宿題）を両方直す。meta（entities・plaud-file-id・description）と `id="todo-n"`・`data-todo`・`data-asana`・`data-done` は触らない。
3. 直したページを STEP 5.6（`gen-aux.js`）→ STEP 5.7（`audit.js` に**今回対象として**渡す）に通す。誤字の直しなら `plaud_規則.json` の typos にも 1 行足す（同じ誤字を次から止める）。
4. 報告に「直した所（ページ・前→後）」を 1 行ずつ書く。

OneDrive の旧受け口（`ドキュメント\farman\10_システム開発\議事録サイト\直した版の受け口\`）に HTML が置かれていたら、**取り込まずに**、元ページと比べて本文の字が変わった所だけを読み、上の 2 の形で元ページに書き戻す。受け口の物は `取り込み済み\` に日時つきで移し、報告に 1 行。

### STEP 7: Cloudflare Pages へデプロイする（Git連携 — pushで自動公開）

> **⛔ 前提: STEP 5.7 の `audit.js` が exit 0（＝ゲート0件）であること。** 1件でも残っている状態でデプロイしない。公開後に直すと、サイトrepoに無駄な差分コミットが増える。
> **「参考: 既存ページの積み残し」はデプロイをブロックしないが、放置すると溜まる。** 件数が増えてきたら別途まとめて潰す（手順は「旧ページの一括補完」節）。

デプロイは**サイトrepo `stymism/farman-mtg-site`（非公開）への git push**で行う。Cloudflare Pages がGit連携で自動ビルド・公開する。旧方式（`wrangler pages deploy` 直接アップロード）は**廃止** — Git連携プロジェクトはwranglerからの直接アップロードを受け付けない。

```powershell
# 2026-10-29（土台の見直し・本人「1つにする」）: 作業場（OneDrive の plaud_summaries）は畳んだ。サイトのリポジトリが唯一の正本で、
# HTML・index は最初からここに書く（config の paths.work_dir もここを指す）。robocopy の写しは無い
$repoDir = "$env:USERPROFILE\.plaud\farman-mtg-site"
$repoUrl = "https://github.com/stymism/farman-mtg-site.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "⚠ git が未インストールのため、デプロイをスキップします（gh auth login 後に再実行）" -ForegroundColor Yellow
  return
}
# 無ければ clone（新しい PC はこれだけで作業場ができる）。あれば最新化
if (-not (Test-Path "$repoDir\.git")) { git clone $repoUrl $repoDir }
git -C $repoDir pull --rebase origin main

# ⛔ 秘密の確かめ（2026-10-29 の事故＝作業場の CLAUDE.md〈トークン平文〉が公開リポに入っていた、の再発防止）。入っていれば push しない
git -C $repoDir add -A
$leak = git -C $repoDir diff --cached --name-only | Where-Object { $_ -match '(^|/)(CLAUDE|README)\.md$|\.ps1$|\.pptx$|secret|plaud-config' }
$tokHit = @(git -C $repoDir grep --cached -nIE '(api[_ ]?token|Bearer)[^"]{0,20}[A-Za-z0-9_-]{30,}' 2>$null)
if ($leak -or $tokHit.Count) { git -C $repoDir reset -q; Write-Host "⛔ 秘密らしき物がサイトに入る: $leak / $($tokHit.Count) 件。push しない" -ForegroundColor Red; exit 1 }

# 変更があれば commit → push（= Cloudflare Pages の Git 連携が自動で公開。Cloudflare の API トークンは使わない）
if (git -C $repoDir status --porcelain) {
  git -C $repoDir commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  git -C $repoDir push origin main
  Write-Host "✅ push完了 → Cloudflare Pages が自動で公開（1〜2分）: https://farman-gijiroku.pages.dev" -ForegroundColor Green
} else {
  Write-Host "変更なし（デプロイ不要）" -ForegroundColor Yellow
}
```

デプロイ完了後、URL `https://farman-gijiroku.pages.dev` を表示する（Pagesビルド完了まで1〜2分）。

> **認証エラーになるPCでは**、一度だけ `gh auth login`（GitHub CLI）を実行してから再実行する。

### （旧STEP 8: 配布ZIP更新 — 廃止）

配布ZIPの再生成は**廃止**（2026-07-07）。スキル配布はGitHubマーケットプレイス（`claude plugin update`）、サイト内容の共有はサイトrepo（STEP 7 のgit push）が担うため、ZIP運搬は不要になった。

---

## 完了報告

以下を報告する：
1. 追加したHTMLファイル名（一覧）
2. 社内/社外/講話録音 の分類結果
3. 追加したビジュアライズの種類（チャートタイプ番号と内容）
4. 講話録音の場合: 付与したテーマタグ一覧、kowa-knowledge.html 更新有無
5. Asana 登録: 0（宿題の登録は毎日の会議の取り込みが行う）
6. 横断ページの再生成（STEP 5.6。`gen-aux.js` 実行 → entity-index / decisions / search-index.json）
7. **自己監査の結果（STEP 5.7。`audit.js` の検出件数。0件であること。途中で検出・修正した項目があれば正直に列挙する）**
7.5 載せていない録音（`node plaud-pending.js <サイト>` の 1 行目）と、直した誤字（語・回数）
8. デプロイ結果（STEP 7。push の commit と URL。「push→自動公開・1〜2分」の旨）

---

## 🚀 クイックスタート

### 初回セットアップ

```powershell
# 1. スキル導入（未導入PCのみ・PowerShellに1行貼る → Claude Code再起動）
irm https://raw.githubusercontent.com/stymism/farman-skills/main/migrate.ps1 | iex

# 2. 設定ファイル（無いPCのみ）
#    動作中PCから ~/.plaud/plaud-config.json をコピー、
#    またはスキルフォルダ内の setup-plaud.ps1 を実行（対話生成）

# 3. デプロイするPCは GitHub 認証を1回だけ
gh auth login
```

### スキルの実行

セットアップ完了後、通常通りスキルを呼び出します：

```
/plaud-html
```

スキルは自動的に以下を実行します：
- `$env:USERPROFILE\.plaud\plaud-config.json` から設定を読み込む
- `plaud-folders.ps1` の一覧とサイトの file_id を突き合わせて、まだ載っていない録音を検出（STEP 1）
- HTML生成、index.html更新、Cloudflareデプロイ（Asana 登録はしない）

---

## 注意事項

### スキル実行時の注意
- 新規HTMLがない場合（全て既にHTML化済み）は「追加なし」と報告して終了
- Plaudのget_noteで3回リトライ後もデータが取れない場合はスキップして報告
- index.html は手で直さない（`data-count` も含めて gen-aux.js が毎回作る。STEP 5・5.6）
- **飾り（浮かぶ粒・ふわっと出る・読み進みの帯・Google Fonts・ページ内スクリプト）は書かない**（2026-10-29 本人「飾りを落として、軽さ・崩れなさ・印刷を優先」）。見本は新しい作りのページ（例 `2026-09-11_farman-zentai.html`）を Read で読んでよい。古い作りのページを見本にしない
- **「一覧に戻る」（`.back-link`）の折り返し止め（`white-space:nowrap`）は site.css が持つ**（ページには書かない。audit.js が site.css を見る）
- **チャートは上記14種から選ぶ。プレースホルダーや空のチャートは禁止。必ず実際のMTG内容を反映した具体的な数値・ラベルを入れること**
- **エンティティ強調・キーワードチップ・関連MTGは「本文（`<p>`・decision-box）」内で使う**。`enhance.js` はフレックス系UI（`.ai-list`/`.action-list`/カード等）内ではエンティティ強調をスキップする（テキスト分割でレイアウトが崩れるため）。`enhance.js`・`edit-mode.js`・`site.css`・`enhance.css` を更新したらHTML側の `?v=N` を必ず上げる（キャッシュ対策。現行 `site.css?v=2` / `enhance.css?v=10` / `enhance.js?v=8` / `edit-mode.js?v=15`（10-29 夜に上げた）。audit.js は全ページの最頻値を正とする）。enhance.js が持つのは「共通の層」節のとおり（目次・宿題のコピーと済の印・節バーとページ内検索・見出しの🔗・トップに戻る・用語の説明・人と会社の強調・右下のボタン〈目次・ダーク表示・Markdown コピー・印刷〉）。**既読マーク（`plaud-read-*`）は 10-29 にやめた。** **客先送付用の 📥 ダウンロード（edit-mode.js）は、差込UI・パンくず・kw-barを除去して単体で崩れないHTMLを出力する**（10-29 夜: `meta plaud-file-id`〈内部の番号〉と `meta description`〈伏せる前の要約〉も消す）（「📥 ダウンロード」節参照）。**📥 の HTML はサイトに戻さない**（STEP 6.9）

### 別PC対応での注意
- **初回セットアップが必須**: スキル初回実行前に `.\setup-plaud.ps1` を実行してください
- **設定ファイルは環境依存**: 各PCで独立した `$env:USERPROFILE\.plaud\plaud-config.json` が生成されます
- **作業ディレクトリ**: サイトのリポの clone（`~/.plaud/farman-mtg-site`）。OneDrive には置かない
- **APIトークン管理**: 設定ファイルはバージョン管理から除外してください（`.gitignore` に追加）
- **トークン更新**: Plaud のトークンが切れたら `plaud-folders.ps1` が中で `refresh-plaud-token.ps1` を呼んで取り直す（email/password が設定に要る）

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-html\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "plaud-html: <要点>" && git push origin main`（**確認不要**。このリポへの変更はユーザー承認済み・2026-07-28）。完了報告に「各PCは `claude plugin update plaud-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
