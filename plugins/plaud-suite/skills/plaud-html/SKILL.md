---
description: 議事録（Plaud録音またはJSONメモ）からHTMLサマリーを生成し、index.htmlを更新、ToDoをAsanaに追加、Cloudflare Pagesへ自動デプロイする
allowed-tools: [Bash, PowerShell, Read, Write, Edit, mcp__plaud__list_files, mcp__plaud__get_note, mcp__plaud__get_file, mcp__plugin_plaud-suite_plaud__list_files, mcp__plugin_plaud-suite_plaud__get_note, mcp__plugin_plaud-suite_plaud__get_file, mcp__490d06cb-7b8b-43fa-ae1d-eb967d5a51fa__list_files, mcp__490d06cb-7b8b-43fa-ae1d-eb967d5a51fa__get_note, mcp__490d06cb-7b8b-43fa-ae1d-eb967d5a51fa__get_file, mcp__608b9063-b2d8-4f66-9aab-51a572c20af1__create_tasks, mcp__608b9063-b2d8-4f66-9aab-51a572c20af1__search_objects]
---

# /plaud-html スキル

Plaud録音またはJSONメモから議事録HTMLサマリーを生成するスキル。

## 入力ソース（2種類）

| ソース | 使用ケース | STEP 1 の扱い |
|--------|-----------|--------------|
| **Plaud録音**（通常） | Plaudでの録音・AI要約済みファイル | Plaud REST API で未HTML化ファイルを検出 |
| **JSONメモ**（直接HTML化） | ユーザーが `@ファイルパス` でJSONを添付した場合 | STEP 1〜3 をスキップし、JSONの内容を直接使用 |

### JSONメモから直接HTML化する場合のルール

- **社内/社外/講話録音の判定**：JSONの内容（参加者・場所）から判断せず、**ユーザーに確認する**か、ユーザーが「社内」「社外」等を明示している場合はそれに従う
- **ファイル名**：JSONの日付フィールド＋タイトルからローマ字スネークケースで生成（例: `260617.json` → `2026-06-17_farman-op-kaigi.html`）
- **STEP 1〜3 はスキップ**し、STEP 4（HTML生成）から開始する
- HTMLの内容・チャート・ToDoはJSONのメモ内容を元に生成する
- その他のステップ（index更新・Asana・デプロイ）は通常通り実行する

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
| **Plaud / Asana の MCPコネクタ**（`get_note`・`get_file`・`create_tasks` 等） | 🟢 Claudeアカウント連携＋plaud-suiteプラグインが `@plaud-ai/mcp` を同梱 | 初回にPlaudログインのみ |
| **スキルファイル本体**（`SKILL.md`・`setup-plaud.ps1` 等） | 🟢 GitHubマーケットプレイス | 上記1行コマンドを1回 |
| **設定ファイル** `~/.plaud/plaud-config.json`（Plaud RESTトークン・Cloudflare設定・パス） | 🔴 ローカル（同期されない） | 動作中PCからコピー、または `setup-plaud.ps1`（対話生成） |
| **作業ディレクトリ**（HTML・index.html・kowa-knowledge.html） | 🟢 そのPCのOneDrive同期 | configの `paths.work_dir` で指定 |
| **git + GitHub認証**（STEP7のデプロイ用） | 🔴 ローカル | デプロイするPCのみ `gh auth login` を1回 |

> **重要：MCPコネクタ と Plaud REST APIトークンは別物。**
> - 議事録の中身（`get_note`/`get_file`）と Asana登録（`create_tasks`）は **MCPコネクタ** が担当 → アカウントログインで自動（MCPはOAuthで自前認証。`login` ツールあり）。
> - STEP1のフォルダ判定（社内/社外/講話）だけは MCP がフォルダ情報を返さないため、**web.plaud.ai の Bearer トークンで REST API を直接叩く**。これがローカル設定ファイルに必要なトークン。
> - **このトークン依存は暫定。** 毎回 STEP 1-0 で「公式MCPがフォルダ情報に対応したか」をチェックし、対応が確認でき次第 REST API＋トークンを廃止する（下記「既知の制約」参照）。
> - **Asana の PATトークンは不要**（MCPコネクタ経由のため）。設定ファイルにはGID対応表のみ保持する。

### 🩺 状態診断（`diagnose.ps1`）

「このPCで `/plaud-html` が使える状態か」を点検する単体スクリプト（このSKILL.mdと同じフォルダにある）。プラグイン導入・設定ファイル・git・node の有無を点検し、「そのまま動く／初回setup要」を判定する。実行するときは、このスキルフォルダ内の `diagnose.ps1` をフルパスで呼び出す。

### 🔧 初回セットアップ — 新PCセットアップZIP（推奨・ワンクリック）

新PCへの導入は **`plaud-newpc-setup.zip` をひとつ渡して、新PCで `SETUP.cmd` をダブルクリックするだけ**。ZIPのスクリプトが「①スキル一式の導入（migrate.ps1相当）→②鍵ファイル設置→③作業ディレクトリのパス自動調整→④サイトデータseed（git導入済みなら）」まで全自動で行う（冪等＝何度実行しても安全）。

- **ZIPの生成（動作中のPCで）:** このスキルフォルダ内の `make-newpc-zip.ps1` を実行 → `ドキュメント\plaud-newpc-setup.zip`（約5KB）が出力される。中身は `SETUP.cmd` / `setup-newpc.ps1` / `README.txt` / **`plaud-config.json`（鍵）**。初回のみ手動生成（ユーザーが「新PC用ZIP作って」と言ったら実行）。
- **以後の作り直しは自動:** `refresh-plaud-token.ps1` がトークンを再取得するたびに、**ZIPが既に存在する配布元PCでのみ**最新トークンで自動的に作り直す（消費専用PCには秘密入りZIPを新規生成しない）。トークンは `/plaud-html` の STEP1 で自動更新されるため、ZIPも自動で最新に保たれる。
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

> **seedが必要な理由:** 新PCの作業ディレクトリは空であり、空のままSTEP7を実行すると公開サイトを空内容で上書きする事故につながる（STEP7に自動ガードあり＝空に近いwork_dirからのデプロイは中止される）。SETUP.cmd 再実行で `stymism/farman-mtg-site` からサイト一式が作業ディレクトリに複製される。

### 📁 設定ファイルの場所

各PC毎に独立: `$env:USERPROFILE\.plaud\plaud-config.json`（例: `C:\Users\<user>\.plaud\plaud-config.json`）。トークン期限切れ時は同フォルダ内 `refresh-plaud-token.ps1` で自動更新できる（STEP 1 が期限切れを検知した場合に実行する）。

**OneDrive同期:** 作業ディレクトリ（HTML出力先、index.html）は **OneDrive同期フォルダ** に指定することを強く推奨します。これにより、複数PCからのHTML化・デプロイが一貫性を保ちます。

### ⚠️ 既知の制約

### Plaud MCP のフォルダフィルタリング非対応（毎回チェック → 対応され次第RESTを廃止）

**2026-07-06 実測時点の状況：**
- `list_files` のスキーマに `folder_id` パラメータは**存在しない**（入力は `query`/`date_from`/`date_to`/`page`/`page_size` のみ）
- `list_files`・`get_file` のレスポンスにもフォルダ情報（`filetag_id_list` 等）は**含まれない**（各件 `id`/`name`/`created_at`/`serial_number`/`start_at`/`duration` ＋ get_fileは `presigned_url`/`source_list`/`note_list`）
- MCPの認証はOAuth（`login` ツール）で自前処理されるため、**トークンが必要なのはフォルダ判定のRESTだけ**

**→ 現状はフォルダ判定のみ Plaud REST API で `filetag_id_list` を参照する（下記 STEP 1 参照）。ただし毎回 STEP 1-0 のチェックを先に行うこと：**

**STEP 1-0（毎回実行）: 公式MCPのフォルダ対応チェック**
1. `mcp__plaud__list_files`（プラグイン環境では `mcp__plugin_plaud-suite_plaud__list_files`。存在する方を使う）を1ページ（page_size=10）呼び、レスポンスの各アイテムに `filetag_id_list`・`filetag`・`folder` 等のフォルダ情報フィールドが**含まれるか**を確認する（あわせて `list_files` スキーマに `folder_id` パラメータが追加されていないかも見る）
2. **含まれる場合（対応済み）**: フォルダ判定はMCPレスポンスの値で行い、REST API呼び出しとトークン自動リフレッシュを**スキップ**する。そのうえで、本SKILL.mdからREST依存部分（トークンリフレッシュ・REST判定）を更新・削除し、README.md に変更履歴を追記して、「Plaudトークンが不要になった」ことをユーザーに報告する（`plaud-config.json` の `plaud.api_token`/`email`/`password` は不要になる。Cloudflare設定は引き続き必要）
3. **含まれない場合（未対応）**: 従来どおりトークン自動チェック→REST APIでのフォルダ判定に進む。完了報告に記載は不要（チェック自体は静かに行う）

### get_note の 500 エラー対応（リトライロジック）
録音後にPlaud側でAI要約を非同期生成するため、アップロード直後は `get_note` が 500 を返すことがある。

**リトライ手順：**
1. `get_note` が 500 を返した場合、即座に最大**3回**まで再試行する
2. 3回とも 500 の場合は「AI要約生成中のためスキップ」として記録し、次回 `/plaud-html` 実行時に再処理対象として検出する
3. スキップしたファイルは完了報告に「⏳ 要約生成中のためスキップ（次回再処理）」として記載する

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

# [4] 作業ディレクトリ & OneDrive同期
if (Test-Path $configPath) {
  $workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
  $exists = Test-Path $workDir
  $isOneDrive = ($workDir -match 'OneDrive') -or ($null -ne $env:OneDrive -and $workDir.StartsWith($env:OneDrive))
  if ($exists -and $isOneDrive) {
    Write-Host "[4] 作業ディレクトリ: ✓ 存在・OneDrive配下（別PCに同期されます）" -ForegroundColor Green
  } elseif ($exists) {
    Write-Host "[4] 作業ディレクトリ: ⚠ 存在するがOneDrive配下でない → 別PCに同期されない恐れ" -ForegroundColor Yellow
  } else {
    Write-Host "[4] 作業ディレクトリ: ⚠ 未作成（$workDir）" -ForegroundColor Yellow
    Write-Host "    → STEP1で自動作成しますが、OneDrive配下のパスを推奨します" -ForegroundColor Yellow
  }
}

if (-not $ok) {
  Write-Host "`n⛔ 必須項目（設定ファイル/トークン）が不足しています。上記を解消してから再実行してください。" -ForegroundColor Red
  exit 1
}
Write-Host "`n✅ プリフライト完了。処理を続行します。" -ForegroundColor Green
```

**判定ルール（このスキルが守ること）:**
- **[2] 設定ファイル or Plaudトークンが無い → 即停止**し、`setup-plaud.ps1` の実行をユーザーに案内する
- **[3] git無し → 警告のみで続行**（デプロイ(STEP7)まで不要。STEP7到達時に未導入なら改めて案内し、デプロイはスキップ）
- **[4] 作業ディレクトリがOneDrive外/未作成 → 警告**してユーザーに「別PCに同期されないリスク」を明示する。黙って進めない
- **[1] スキルファイル**は、スキルが起動できている時点で当該PCに存在する（自己チェック不要）。もし別PCにスキル自体が無ければ `/plaud-html` 自体が呼べないため、その場合はセットアップ節の1行コマンド（`migrate.ps1`）を案内する

### STEP 1: 未HTML化の議事録を特定する（Plaud REST API で社内/社外を自動判定）

**前提：Plaud Web上でのフォルダ振り分けは事前に完了しているものとする。**

**⓪ まず STEP 1-0（既知の制約セクション参照）を実行する：** `mcp__plaud__list_files` のレスポンスにフォルダ情報（`filetag_id_list` 等）が含まれるようになったかをチェック。**対応済みならMCPでフォルダ判定し、以下のREST API＋トークン処理は全てスキップ**（あわせてSKILL.md/README.mdを更新しユーザーに報告）。未対応なら以下へ進む。

Plaud MCP の `list_files` はフォルダ情報を返さないため（2026-07-06実測）、REST API を直接呼び出して `filetag_id_list` でフォルダ判定する。

**⚠️ 別PC対応版 — 設定ファイルから動的に読み込み：**

```powershell
# 1. 設定ファイルを読み込む
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
if (-not (Test-Path $configPath)) {
  Write-Error "設定ファイルが見つかりません: $configPath"
  Write-Host "初回セットアップスクリプトを実行してください: .\setup-plaud.ps1" -ForegroundColor Yellow
  exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$token = $config.plaud.api_token
$apiBase = $config.plaud.api_base
$INTERNAL = $config.plaud.folder_ids.internal
$EXTERNAL = $config.plaud.folder_ids.external
$KOWA = $config.plaud.folder_ids.kowa

# 2. 作業ディレクトリをパス展開
$workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
if (-not (Test-Path $workDir)) {
  Write-Host "作業ディレクトリを作成します: $workDir" -ForegroundColor Yellow
  New-Item -ItemType Directory -Path $workDir -Force | Out-Null
}

# 3. Plaud APIから未HTML化ファイルを取得
$resp = Invoke-RestMethod -Uri "$apiBase/file/simple/web?skip=0&limit=200&is_trash=0&sort_by=start_time&is_desc=true" `
    -Headers @{ Authorization = $token }

foreach ($f in $resp.data_file_list) {
    $tags = $f.filetag_id_list
    if ($tags -contains $INTERNAL)       { $folder = 'internal' }
    elseif ($tags -contains $EXTERNAL)   { $folder = 'external' }
    elseif ($tags -contains $KOWA)       { $folder = 'kowa' }
    else                                 { $folder = 'unclassified' }
    Write-Output "$($f.id) $folder $($f.filename)"
}
```

- `filetag_id_list` に社内フォルダID（`c35095465864259130869d88d1b13419`）が含まれる → **🏢 社内**
- `filetag_id_list` に社外フォルダID（`dd2c13ed...`）が含まれる → **🤝 社外**
- `filetag_id_list` に講話録音フォルダID（`5010d262...`）が含まれる → **🎤 講話録音**
- どれも含まれない → `unclassified`（未振り分け、スキップして完了報告に記載）

> **⚠️ 社内フォルダIDについて：** 社内ファイルがPlaudに追加されたタイミングで `filetag_id_list` の値を確認し、`$INTERNAL` を更新すること。

既存HTMLとの照合（PowerShell）:
```powershell
# 設定ファイルから作業ディレクトリを読み込む
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE

Get-ChildItem "$workDir\*.html" | Select-Object -ExpandProperty Name
```

**ファイル名の対応ルール:**
- Plaud名: `06-01 ファーマン全体MTG` → HTMLファイル名: `2026-06-01_farman-zentai.html`
- 日付は `start_time` から取得（YYYY-MM-DD形式）
- 名前はローマ字スネークケースに変換（ファーマン→farman、全体→zentai、井上/田中→inoue-tanaka）

**⚠️ タイトル・固有名詞の忠実転記ルール（厳守）**

HTMLのタイトル・見出し・バッジ・メタタグに記載する全ての固有名詞・イベント名は、**Plaud APIの `filename` フィールドの文字列を一字一句そのままコピーする**。推測・補完・省略・言い換えは一切禁止。

#### 禁止事項（全て過去に実際に発生したエラー）

| 禁止行為 | 悪い例 | 正しい対処 |
|---------|--------|----------|
| **漢字の読み間違え** | `中村高校` → `chuo-koko`（中央と混同） | 一字ずつ読みを確認して `nakamura-koko` |
| **珍しい漢字の省略** | `目黒区碑小学校` → `目黒区小学校`（碑を落とす） | 珍しい漢字こそ特に注意してコピーする |
| **イベント名の捏造** | Plaud名が「体験受入時の冒頭説明」なのに「体育発表会の冒頭説明」と書く | Plaudの `filename` をそのまま使う。推測は禁止 |
| **よくある名前への置換** | 実際の名称より「それっぽい名称」で補完する | 「よくある名前」で補完しない |

#### 必ず守る手順

1. Plaud API の `filename` フィールドを **そのまま文字列としてコピー** して HTML タイトルに使う
2. ローマ字変換（ファイル名生成）の際も `filename` の各字の読みを1文字ずつ確認してから変換する
3. **珍しい漢字（碑・髙・﨑・彙・鷹 等）は特に注意**。読み方が不確かな漢字が含まれる場合は変換前にユーザーに確認する
4. 会議・イベントの種別名（「体験受入」「研修」「定例MTG」「冒頭説明」等）は**Plaudの原文から取る**。内容を読んで推測して書き換えない
5. 疑わしい点が1つでもあれば、HTML生成前にユーザーに「〇〇の読み方・正式名称を確認させてください」と聞く

**⚠️ トークン期限切れ対応（自動再取得が組み込み済み）:**

Plaudトークンは約24時間で失効する（`status: -419 / workspace token expired`）。**`refresh-plaud-token.ps1` が email+password から自動でトークンを再取得**するので、STEP1の冒頭で必ず実行する。

**STEP1の最初に実行（トークン自動チェック→失効してたら自動再取得）：**
```powershell
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$cfgHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$skillDir = @("$cfgHome\plugins\marketplaces\farman-skills\plugins\plaud-suite\skills\plaud-html","$cfgHome\skills\plaud-html") | Where-Object { Test-Path (Join-Path $_ 'refresh-plaud-token.ps1') } | Select-Object -First 1
$cfg = Get-Content $configPath -Raw | ConvertFrom-Json
# JWTのexpをデコードして、失効 or 5分以内なら自動再取得
$needRefresh = $true
$tok = $cfg.plaud.api_token -replace '^Bearer\s+',''
if ($tok -and $tok.Contains('.')) {
  try {
    $pl = $tok.Split('.')[1]; $pad = $pl.PadRight($pl.Length + (4 - $pl.Length % 4) % 4, '=').Replace('-','+').Replace('_','/')
    $exp = [int64](([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($pad)) | ConvertFrom-Json).exp)
    if ((Get-Date).ToUniversalTime() -lt [DateTimeOffset]::FromUnixTimeSeconds($exp - 300).UtcDateTime) { $needRefresh = $false }
  } catch {}
}
if ($needRefresh) {
  if ($cfg.plaud.email -and $cfg.plaud.password) {
    Write-Host "トークン失効（または間近）→ 自動再取得します..." -ForegroundColor Yellow
    & "$skillDir\refresh-plaud-token.ps1"
    $cfg = Get-Content $configPath -Raw | ConvertFrom-Json   # 再読み込み
  } else {
    Write-Host "⚠ トークン失効。email/password未設定のため自動再取得不可。setup-plaud.ps1 で設定してください。" -ForegroundColor Red
  }
}
```

その後 `$cfg.plaud.api_token` を使ってAPIを叩く。**APIが `-419` を返した場合も** `refresh-plaud-token.ps1` を実行して設定を再読込し、リトライする。

> **`refresh-plaud-token.ps1` の仕組み:** `POST {api_base}/auth/access-token`（multipart: `username`/`password`/`client_id=web`/`password_encrypted=false`）でログインし、Set-Cookieの `pld_ut`（JWT）を新トークンとして取得→設定3箇所を更新。**パスワードは平文でOK（RSA暗号化不要）**。ログインは**1時間10回**制限なので失効時のみ呼ぶ。
>
> **フォールバック（email/password未設定 or ログイン失敗時）:** `web.plaud.ai` でF12→Consoleに次を貼り、ファイルをクリックして `🔑 Token: Bearer eyJ...` を取得し、手動で `$cfg.plaud.api_token` を更新する：
> ```javascript
> const o=XMLHttpRequest.prototype.setRequestHeader;XMLHttpRequest.prototype.setRequestHeader=function(n,v){if(n.toLowerCase()==='authorization')console.log('🔑 Token:',v);return o.apply(this,arguments);};
> ```
> APIベースURLは `https://api-apne1.plaud.ai`（`/api/v1` は不要）。

### STEP 2: 社内 / 社外を判定する

STEP 1 の `filetag_id_list` の結果を使う。タイトルや参加者名で推測してはならない。

| filetag_id_list の値 | 分類 | テンプレート |
|---------------------|------|------------|
| 社内フォルダID含む | 🏢 社内 | 議事録テンプレート（グリーン） |
| 社外フォルダID含む | 🤝 社外 | 議事録テンプレート（アンバー） |
| 講話録音フォルダID含む | 🎤 講話録音 | 講話ナレッジテンプレート（インジゴ） |
| どれも含まない | スキップ（未振り分け）| — |

### STEP 3: 議事録の内容を取得する

未HTML化ファイルそれぞれについて：
- `get_note` でAI要約（action_items、summary、key_topics）を取得
- `get_file` でメタ情報（duration等）を取得

**⚠️ 500エラー時のリトライ：**
- `get_note` が 500 を返した場合、即座に同じ呼び出しを最大3回まで再試行する
- 3回とも失敗した場合はスキップして完了報告に記載する（次回実行で再処理される）

### STEP 4: HTMLファイルを生成する

**必ずフル仕様のギミックを全て組み込むこと（省略・簡略化は禁止）。**

**デザインテーマ:**
- 🏢 社内 → グリーン系テーマ（ヘッダー `#1b4332`、アクセント `--green-*`）
- 🤝 社外 → アンバー系テーマ（ヘッダー `#78350f`、アクセント `--amber-*`）
- 🎤 講話録音 → **インジゴ系テーマ**（ヘッダー `#1e1b4b`、アクセント `--indigo-*`）→ 下記「講話ナレッジテンプレート」参照

---

#### ▼ 必須ビジュアル機能チェックリスト

以下を全て実装すること。1つでも抜けたらNG。

- [ ] `#scroll-progress` スクロールプログレスバー（グロー付き `box-shadow: 0 0 8px`）
- [ ] `detail-header::after` SVGノイズテクスチャ（feTurbulenceフィルター）
- [ ] ヒーローパーティクル **5個**（`.hero-particle:nth-child(1〜5)` 各異なるfloatアニメーション）
- [ ] `badge-header-external/internal::after` パルスリングアニメーション
- [ ] `floating-toc` フローティング目次（JS自動生成）
- [ ] `.section-h2` カウンター付き番号ヘッダー（`counter-increment: section-counter`）
- [ ] `.section-h3` サブヘッダー（左ボーダー付き）
- [ ] `.decision-box` 結論ボックス（各セクション末尾）
- [ ] `.chart-container` データビジュアライズ（MTG内容に応じた固有チャート、下記参照）
- [ ] IntersectionObserver によるチャートアニメーション起動
- [ ] `.ai-section` + `.ai-list` AIサジェストセクション（アンバー/グリーン背景）
- [ ] `.actions-section` ToDo（チェックボックス＋コピーボタン）
- [ ] `#progressBar` 進捗バー（グロー付き）
- [ ] チェックボックスchecked時の `box-shadow: 0 2px 8px rgba(...)` 
- [ ] コピーボタン checked/コピー済み時の色変化
- [ ] 全タスク完了時のコンフェッティ
- [ ] `read-time-tag` 読了時間の自動計算
- [ ] IntersectionObserver によるスクロールリビール（`.reveal`）

---

#### ▼ チャートの種類とバリエーション（必ず最適なものを選ぶ）

MTGの内容に応じて**最もふさわしいチャートを1〜2種類**選ぶ。同じ議事録に2種類組み合わせると情報密度が増す。以下の中から選択し、独自のコンテンツで具体的に実装すること（プレースホルダーは禁止）。

---

**① 棒グラフ（アニメーション縦棒）— 数値を順位付きで比較するとき**
```html
<div class="chart-container reveal" id="barChart">
  <div class="chart-title">📊 タイトル</div>
  <div class="anim-bar-wrap">
    <div class="anim-bar-label"><span>ラベル</span><span>85%</span></div>
    <div class="anim-bar-track"><div class="anim-bar-fill" data-width="85"></div></div>
  </div>
</div>
```
CSS: `.anim-bar-fill{height:24px;width:0%;border-radius:4px;background:linear-gradient(90deg,var(--amber-500),var(--amber-400));transition:width 1.2s cubic-bezier(.16,1,.3,1);box-shadow:0 0 8px rgba(245,158,11,.5);}`

---

**② 水平棒グラフ（hbar）— 人・品目ごとの量を並列比較するとき**
```html
<div class="hbar-row">
  <div class="hbar-name">ラベル</div>
  <div class="hbar-track">
    <div class="hbar-fill col-amber" data-width="72">補足テキスト</div>
  </div>
</div>
```
カラークラス: `col-amber` `col-green` `col-blue` `col-red` `col-purple` `col-pink`  
CSS: `.hbar-fill{height:32px;width:0%;border-radius:6px;display:flex;align-items:center;padding-left:12px;font-size:12px;font-weight:700;color:white;transition:width 1.2s cubic-bezier(.16,1,.3,1);}`

---

**③ ドーナツチャート — 進捗率・割合を1つの数値で示すとき**
```html
<div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap;">
  <div style="position:relative;width:140px;height:140px;flex-shrink:0;">
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="16"/>
      <circle cx="70" cy="70" r="58" fill="none" stroke="url(#dg1)" stroke-width="16"
        stroke-linecap="round" stroke-dasharray="364" stroke-dashoffset="364"
        id="donutFill" transform="rotate(-90 70 70)"/>
      <defs><linearGradient id="dg1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fcd34d"/>
      </linearGradient></defs>
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <span id="donutPct" style="font-size:28px;font-weight:900;color:white;">0%</span>
      <span style="font-size:11px;opacity:.7;">達成率</span>
    </div>
  </div>
  <div><!-- 凡例テキスト --></div>
</div>
```
JS（IntersectionObserver内）:
```javascript
const pct = 72; // 実際の数値
const fill = e.target.querySelector('#donutFill');
const label = e.target.querySelector('#donutPct');
const circumference = 364;
fill.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)';
fill.style.strokeDashoffset = circumference - (circumference * pct / 100);
let cur = 0;
const timer = setInterval(() => {
  cur = Math.min(cur + 2, pct);
  label.textContent = cur + '%';
  if (cur >= pct) clearInterval(timer);
}, 20);
```

---

**④ 月別カレンダー表 — 季節性・スケジュール・繁閑を示すとき**
```html
<div style="overflow-x:auto;">
  <div style="display:grid;grid-template-columns:90px repeat(12,1fr);gap:3px;min-width:600px;">
    <div style="font-size:11px;font-weight:700;opacity:.6;padding:6px;">項目</div>
    <!-- 月ヘッダー: 1月〜12月 -->
    <div style="font-size:11px;font-weight:700;text-align:center;opacity:.6;padding:6px;">1</div>
    <!-- ... -->
    <!-- データ行 -->
    <div style="font-size:12px;font-weight:600;padding:8px 6px;">作物名</div>
    <div style="background:rgba(245,158,11,.0);border-radius:4px;"></div><!-- 空 -->
    <div style="background:rgba(245,158,11,.5);border-radius:4px;padding:4px;font-size:10px;text-align:center;">播種</div>
    <div style="background:rgba(245,158,11,.9);border-radius:4px;padding:4px;font-size:10px;text-align:center;font-weight:700;">最盛期</div>
  </div>
</div>
```

---

**⑤ レーダーチャート（SVG）— 多軸評価・能力・バランスを示すとき**
```html
<svg id="radarChart" viewBox="0 0 300 300" style="max-width:300px;margin:0 auto;display:block;">
  <defs>
    <linearGradient id="rg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity=".8"/>
      <stop offset="100%" stop-color="#fcd34d" stop-opacity=".4"/>
    </linearGradient>
  </defs>
  <!-- 背景グリッド（正六角形、3段） -->
  <!-- グリッド用ポリゴン（半径100/67/33の3段） -->
  <!-- 軸ライン（中心→各頂点） -->
  <!-- データポリゴン（id="radarData" points="..." opacity=".8"） -->
  <!-- 軸ラベル -->
</svg>
```
JS（IntersectionObserver内）:
```javascript
// axes: [{label, value(0-100)}] 6軸まで
function radarPoints(axes, r, cx, cy) {
  return axes.map((a, i) => {
    const angle = (Math.PI * 2 / axes.length) * i - Math.PI / 2;
    const v = a.value / 100 * r;
    return [cx + v * Math.cos(angle), cy + v * Math.sin(angle)];
  }).map(p => p.join(',')).join(' ');
}
const axes = [{label:'品質',value:85},{label:'コスト',value:70},{label:'納期',value:92},{label:'安全',value:78},{label:'効率',value:65},{label:'連携',value:88}];
e.target.querySelector('#radarData').setAttribute('points', radarPoints(axes, 100, 150, 150));
```

---

**⑥ 2×2マトリクス — 重要度×実現可能性・インパクト×工数などで施策を分類するとき**
```html
<div style="display:grid;grid-template-columns:auto 1fr 1fr;grid-template-rows:auto 1fr 1fr;gap:3px;position:relative;">
  <!-- ラベル行/列 -->
  <div></div>
  <div style="text-align:center;font-size:12px;font-weight:700;padding:8px;color:rgba(255,255,255,.7);">低コスト</div>
  <div style="text-align:center;font-size:12px;font-weight:700;padding:8px;color:rgba(255,255,255,.7);">高コスト</div>
  <div style="font-size:12px;font-weight:700;padding:8px;color:rgba(255,255,255,.7);writing-mode:vertical-rl;text-orientation:mixed;">高インパクト</div>
  <!-- 第1象限: 優先実行 -->
  <div style="background:rgba(245,158,11,.25);border:1px solid rgba(245,158,11,.4);border-radius:10px;padding:16px;min-height:120px;">
    <div style="font-size:10px;font-weight:700;color:#fcd34d;margin-bottom:8px;">⭐ 優先実行</div>
    <div style="font-size:12px;line-height:1.6;">・施策A<br>・施策B</div>
  </div>
  <!-- 第2象限: 要検討 -->
  <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:16px;min-height:120px;">
    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:8px;">🔍 要検討</div>
    <div style="font-size:12px;line-height:1.6;">・施策C</div>
  </div>
  <div style="font-size:12px;font-weight:700;padding:8px;color:rgba(255,255,255,.7);writing-mode:vertical-rl;">低インパクト</div>
  <!-- 第3象限: 後回し / 第4象限: 見直し -->
  <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;min-height:120px;">
    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.4);margin-bottom:8px;">⏸ 後回し</div>
  </div>
  <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:16px;min-height:120px;">
    <div style="font-size:10px;font-weight:700;color:#fca5a5;margin-bottom:8px;">⚠️ 見直し</div>
  </div>
</div>
```

---

**⑦ タイムライン・工程表 — プロジェクトの時系列進捗・今後のスケジュールを示すとき**
```html
<div class="timeline-flow">
  <div class="tf-item reveal">
    <div class="tf-dot"></div>
    <div class="tf-body">
      <div class="tf-date">2026年6月</div>
      <div class="tf-title">フェーズ1: 調査・要件定義</div>
      <div class="tf-desc">説明テキスト。担当: 瀬戸山</div>
      <div class="tf-status tf-done">✅ 完了</div>
    </div>
  </div>
  <div class="tf-item reveal">
    <div class="tf-dot tf-active"></div>
    <div class="tf-body">
      <div class="tf-date">2026年7月</div>
      <div class="tf-title">フェーズ2: 実装</div>
      <div class="tf-desc">説明テキスト</div>
      <div class="tf-status tf-progress">🔄 進行中</div>
    </div>
  </div>
</div>
```
CSS:
```css
.timeline-flow{position:relative;padding-left:32px;}
.timeline-flow::before{content:'';position:absolute;left:10px;top:8px;bottom:8px;width:2px;background:linear-gradient(to bottom,var(--amber-500),rgba(245,158,11,.1));}
.tf-item{position:relative;margin-bottom:28px;display:flex;gap:20px;}
.tf-dot{position:absolute;left:-27px;top:4px;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.3);flex-shrink:0;}
.tf-dot.tf-active{background:var(--amber-500);border-color:var(--amber-400);box-shadow:0 0 10px rgba(245,158,11,.6);}
.tf-date{font-size:11px;opacity:.6;font-weight:600;letter-spacing:.05em;margin-bottom:4px;}
.tf-title{font-size:15px;font-weight:700;margin-bottom:6px;}
.tf-desc{font-size:13px;opacity:.75;line-height:1.6;}
.tf-status{display:inline-block;font-size:11px;font-weight:700;padding:2px 10px;border-radius:999px;margin-top:8px;}
.tf-done{background:rgba(16,185,129,.2);color:#6ee7b7;}
.tf-progress{background:rgba(245,158,11,.2);color:#fcd34d;}
```

---

**⑧ KPIカードグリッド — 複数の重要数値を一覧で見せるとき**
```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-top:16px;">
  <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:20px 16px;text-align:center;">
    <div style="font-size:32px;font-weight:900;color:var(--amber-300);line-height:1;" id="kpi1">0</div>
    <div style="font-size:11px;opacity:.6;margin-top:6px;letter-spacing:.05em;">対象農家数</div>
    <div style="font-size:12px;color:#6ee7b7;margin-top:4px;">▲ 12%</div>
  </div>
  <!-- 繰り返し。id="kpi2"、id="kpi3" ... -->
</div>
```
JS（IntersectionObserver内でカウントアップ）:
```javascript
[{id:'kpi1',to:156},{id:'kpi2',to:32},{id:'kpi3',to:89}].forEach(({id,to})=>{
  let n=0; const el=e.target.querySelector('#'+id);
  const step=Math.max(1,Math.floor(to/40));
  const t=setInterval(()=>{n=Math.min(n+step,to);el.textContent=n.toLocaleString();if(n>=to)clearInterval(t);},30);
});
```

---

**⑨ フロー図（SVGベース）— 意思決定・プロセス・システム構成を示すとき**
```html
<svg viewBox="0 0 600 280" style="width:100%;max-width:600px;margin:0 auto;display:block;">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 Z" fill="rgba(245,158,11,.8)"/>
    </marker>
  </defs>
  <!-- ボックス -->
  <rect x="20" y="110" width="120" height="50" rx="10" fill="rgba(245,158,11,.2)" stroke="rgba(245,158,11,.6)" stroke-width="1.5"/>
  <text x="80" y="132" text-anchor="middle" fill="white" font-size="12" font-family="Noto Sans JP" font-weight="700">入力</text>
  <text x="80" y="150" text-anchor="middle" fill="rgba(255,255,255,.6)" font-size="10" font-family="Noto Sans JP">データ収集</text>
  <!-- 矢印 -->
  <line x1="140" y1="135" x2="195" y2="135" stroke="rgba(245,158,11,.6)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- 菱形（判断） -->
  <polygon points="240,100 290,135 240,170 190,135" fill="rgba(99,102,241,.2)" stroke="rgba(99,102,241,.6)" stroke-width="1.5"/>
  <text x="240" y="139" text-anchor="middle" fill="white" font-size="10" font-family="Noto Sans JP" font-weight="700">判定</text>
  <!-- ... 続きのノード ... -->
</svg>
```

---

**⑩ 積み上げ棒グラフ — 構成比の変化・複数要素の内訳を示すとき**
```html
<div style="display:flex;align-items:flex-end;gap:20px;height:180px;padding-top:20px;">
  <!-- 1本の棒 = 1年/1期 -->
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
    <div style="width:100%;display:flex;flex-direction:column;gap:2px;height:140px;justify-content:flex-end;">
      <div class="stack-seg" data-height="25" style="background:#6366f1;border-radius:4px 4px 0 0;height:0;transition:height 1s cubic-bezier(.16,1,.3,1);" title="テクノロジー: 25%"></div>
      <div class="stack-seg" data-height="45" style="background:#f59e0b;height:0;transition:height 1s cubic-bezier(.16,1,.3,1) .1s;" title="慣行農業: 45%"></div>
      <div class="stack-seg" data-height="30" style="background:#10b981;border-radius:0 0 4px 4px;height:0;transition:height 1s cubic-bezier(.16,1,.3,1) .2s;" title="有機農業: 30%"></div>
    </div>
    <div style="font-size:11px;opacity:.7;margin-top:8px;">2024</div>
  </div>
  <!-- 繰り返し -->
</div>
<!-- 凡例 -->
<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;">
  <div style="display:flex;align-items:center;gap:6px;font-size:12px;"><div style="width:10px;height:10px;background:#6366f1;border-radius:2px;"></div>テクノロジー</div>
</div>
```
JS（IntersectionObserver内）:
```javascript
e.target.querySelectorAll('.stack-seg').forEach(seg => {
  seg.style.height = (parseInt(seg.dataset.height) / 100 * 140) + 'px';
});
```

---

**⑪ バブルチャート（ポジショニングマップ）— 競合比較・施策の優先度マッピングをするとき**
```html
<div style="position:relative;width:100%;aspect-ratio:4/3;background:rgba(255,255,255,.04);border-radius:12px;border:1px solid rgba(255,255,255,.1);">
  <!-- 軸ラベル -->
  <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:11px;opacity:.5;">← コスト低い　　コスト高い →</div>
  <div style="position:absolute;top:50%;left:8px;transform:translateY(-50%) rotate(-90deg);font-size:11px;opacity:.5;white-space:nowrap;">← 効果小　効果大 →</div>
  <!-- バブル: left=X軸位置%, bottom=Y軸位置%, width=重要度/規模 -->
  <div style="position:absolute;left:20%;bottom:70%;transform:translate(-50%,50%);">
    <div style="width:48px;height:48px;border-radius:50%;background:rgba(245,158,11,.6);border:2px solid rgba(245,158,11,.9);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;text-align:center;cursor:default;" title="施策A: 詳細説明">A</div>
  </div>
  <!-- グリッド線（任意） -->
  <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.08);"></div>
  <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.08);"></div>
</div>
```

---

**⑫ ステップ進捗バー（フェーズ表示）— プロジェクトのフェーズや手順を示すとき**
```html
<div style="display:flex;align-items:center;gap:0;margin:20px 0;overflow-x:auto;padding-bottom:8px;">
  <!-- ステップ -->
  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
    <div style="width:44px;height:44px;border-radius:50%;background:var(--amber-500);display:flex;align-items:center;justify-content:center;font-weight:900;color:white;font-size:16px;box-shadow:0 0 12px rgba(245,158,11,.5);">1</div>
    <div style="font-size:11px;margin-top:6px;font-weight:700;color:var(--amber-300);text-align:center;max-width:72px;">完了済み</div>
  </div>
  <!-- コネクター -->
  <div style="flex:1;height:3px;background:linear-gradient(90deg,var(--amber-500),var(--amber-300));min-width:32px;max-width:80px;"></div>
  <!-- ステップ2（進行中） -->
  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
    <div style="width:44px;height:44px;border-radius:50%;background:rgba(245,158,11,.2);border:3px solid var(--amber-400);display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--amber-300);font-size:16px;">2</div>
    <div style="font-size:11px;margin-top:6px;font-weight:600;color:rgba(255,255,255,.7);text-align:center;max-width:72px;">進行中</div>
  </div>
  <!-- コネクター（未着手） -->
  <div style="flex:1;height:3px;background:rgba(255,255,255,.1);min-width:32px;max-width:80px;"></div>
  <!-- ステップ3（未着手） -->
  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
    <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-weight:900;color:rgba(255,255,255,.3);font-size:16px;">3</div>
    <div style="font-size:11px;margin-top:6px;font-weight:500;color:rgba(255,255,255,.4);text-align:center;max-width:72px;">未着手</div>
  </div>
</div>
```

---

**⑬ ゲージ（半円メーター）— 単一の達成度・スコアを針/弧で示すとき**
```html
<div style="text-align:center;position:relative;z-index:1;">
  <svg width="220" height="125" viewBox="0 0 220 125">
    <path d="M20 115 A90 90 0 0 1 200 115" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="16" stroke-linecap="round"/>
    <path id="gaugeArc" d="M20 115 A90 90 0 0 1 200 115" fill="none" stroke="url(#gg)" stroke-width="16" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283"/>
    <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fcd34d"/></linearGradient></defs>
    <text x="110" y="100" text-anchor="middle" fill="white" font-size="34" font-weight="900" id="gaugeVal" font-family="Noto Sans JP">0</text>
    <text x="110" y="118" text-anchor="middle" fill="rgba(255,255,255,.6)" font-size="11" font-family="Noto Sans JP">達成スコア</text>
  </svg>
</div>
```
JS（barObs内）: `var pct=72;var arc=e.target.querySelector('#gaugeArc');arc.style.transition='stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)';arc.style.strokeDashoffset=283-(283*pct/100);var gv=e.target.querySelector('#gaugeVal');var n=0;var t=setInterval(function(){n=Math.min(n+2,pct);gv.textContent=n;if(n>=pct)clearInterval(t);},20);`（半円の弧長≒283）

---

**⑭ ブレットチャート（目標 vs 実績）— 1指標の「目標線・達成帯・実績」を1本で示すとき**
```html
<div class="hbar-row"><div class="hbar-name">乾燥(t)</div>
  <div class="hbar-track" style="position:relative;">
    <div class="hbar-fill col-amber" data-width="77">実績 6.0t</div>
    <div style="position:absolute;top:-3px;bottom:-3px;left:100%;width:3px;background:#fff;border-radius:2px;" title="目標 7.8t"></div>
  </div>
</div>
```
※ 目標位置に縦線マーカーを置き、`data-width`で実績バーを伸ばす。複数指標を縦に並べると「目標到達状況」が一望できる。

---

**⚡ チャート共通の体裁ルール（強化）：**
- **必ず `chart-insight`（インサイト注釈）を1つ添える**（「一番言いたい数字」を言語化。上記テンプレ参照）
- 単位・凡例・出典を明記。色は意味で割り当て（達成=緑 / 注意=赤 / 中立=アンバー）
- 数値は等幅（enhance.cssで全体に`tabular-nums`適用済み）

**チャート選択ガイド:**

| MTGの内容 | 推奨チャート |
|---------|------------|
| 数値・量の比較 | ① 棒グラフ or ② 水平棒グラフ |
| 進捗率・達成率 | ③ ドーナツ or ⑫ ステップ進捗バー |
| 季節性・カレンダー | ④ 月別カレンダー表 |
| 多軸評価・バランス | ⑤ レーダーチャート |
| 施策の優先度分類 | ⑥ 2×2マトリクス |
| 工程・スケジュール | ⑦ タイムライン |
| 複数KPI・数値サマリー | ⑧ KPIカードグリッド |
| プロセス・意思決定フロー | ⑨ フロー図 |
| 構成比の変化 | ⑩ 積み上げ棒グラフ |
| ポジショニング・競合比較 | ⑪ バブルチャート |
| フェーズ・手順 | ⑫ ステップ進捗バー |
| 単一スコア・達成度メーター | ⑬ ゲージ（半円） |
| 目標 vs 実績 | ⑭ ブレットチャート |

**組み合わせ推奨:** 1つのMTGに2種類まで使うと情報密度が上がる。例: ドーナツ（進捗全体）+ 水平棒グラフ（担当者別内訳）。

---

#### ▼ HTMLテンプレート全体構造

```html
<!DOCTYPE html>
<html lang="ja"><head>
  <meta charset="UTF-8"><link rel="icon" type="image/svg+xml" href="favicon.svg">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Plaudタイトル} — Farman MTG Summaries</title>
  <meta name="entities" content="{人物・企業名をカンマ区切り。例: 井上,瀬戸山,双日,坂ノ途中}">
  <link rel="stylesheet" href="enhance.css">
  <style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
:root{
  /* 社外: --amber-900:#78350f; --amber-500:#f59e0b; ... */
  /* 社内: --green-900:#1b4332; --green-500:#40916c; ... */
  --gray-900:#111827;--gray-700:#374151;--gray-200:#e5e7eb;--gray-100:#f3f4f6;
  --bg:#fdf8f0; /* 社内は #f0fdf4 */
  --shadow-sm:0 1px 3px rgba(0,0,0,0.08);--shadow-md:0 4px 16px rgba(0,0,0,0.10);--shadow-lg:0 8px 32px rgba(0,0,0,0.14);
}
*{box-sizing:border-box;margin:0;padding:0;}
#scroll-progress{position:fixed;top:0;left:0;width:0%;height:3px;
  background:linear-gradient(90deg,var(--amber-500),var(--amber-400),#fde68a);
  z-index:9999;transition:width .1s linear;box-shadow:0 0 8px rgba(245,158,11,.6);}
html{scroll-behavior:smooth;}
body{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--gray-900);line-height:1.8;font-size:15px;overflow-x:hidden;}

@keyframes float{0%,100%{transform:translateY(0) rotate(0)}33%{transform:translateY(-18px) rotate(5deg)}66%{transform:translateY(-8px) rotate(-3deg)}}
@keyframes float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-22px) scale(1.04)}}
@keyframes float3{0%,100%{transform:translateY(0) rotate(0)}40%{transform:translateY(-14px) rotate(-4deg)}}
@keyframes float4{0%,100%{transform:translateY(0) scale(1)}60%{transform:translateY(-10px) scale(1.06)}}
@keyframes float5{0%,100%{transform:translateY(0) rotate(0)}33%{transform:translateY(-20px) rotate(6deg)}}
@keyframes pulse-ring{0%{transform:scale(.8);opacity:1}100%{transform:scale(2.2);opacity:0}}
@keyframes confetti-fall{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
@keyframes confetti-sway{0%,100%{transform:translateX(0)}50%{transform:translateX(30px)}}
.confetti-piece{position:fixed;top:-10px;z-index:9998;pointer-events:none;
  animation:confetti-fall linear forwards,confetti-sway ease-in-out infinite alternate;}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;}}

.hero-particle{position:absolute;border-radius:50%;opacity:.15;pointer-events:none;}
.hero-particle:nth-child(1){width:120px;height:120px;background:radial-gradient(circle,rgba(245,158,11,.8),transparent);top:12%;left:5%;animation:float 7s ease-in-out infinite;}
.hero-particle:nth-child(2){width:80px;height:80px;background:radial-gradient(circle,rgba(252,211,77,.9),transparent);bottom:18%;right:6%;animation:float2 9s ease-in-out infinite;opacity:.2;}
.hero-particle:nth-child(3){width:200px;height:200px;background:radial-gradient(circle,rgba(120,53,15,.4),transparent);bottom:-20%;right:0%;animation:float3 11s ease-in-out infinite;opacity:.12;}
.hero-particle:nth-child(4){width:55px;height:55px;background:radial-gradient(circle,rgba(253,230,138,.9),transparent);top:42%;left:55%;animation:float4 5s ease-in-out infinite 2s;opacity:.18;}
.hero-particle:nth-child(5){width:40px;height:40px;background:radial-gradient(circle,rgba(245,158,11,1),transparent);top:72%;left:24%;animation:float5 6s ease-in-out infinite 1s;opacity:.25;}

.detail-header{background:radial-gradient(ellipse at 15% 50%,rgba(180,83,9,.5) 0%,transparent 55%),radial-gradient(ellipse at 85% 10%,rgba(245,158,11,.25) 0%,transparent 50%),#78350f;color:white;position:relative;overflow:hidden;padding:52px 48px 44px;}
.detail-header::after{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");opacity:.3;pointer-events:none;}

.badge-header-external{display:inline-flex;align-items:center;gap:5px;background:rgba(245,158,11,.2);border:1px solid rgba(245,158,11,.4);color:#fde68a;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;position:relative;}
.badge-header-external::after{content:'';position:absolute;inset:-3px;border-radius:999px;border:2px solid rgba(245,158,11,.5);animation:pulse-ring 2.5s ease-out infinite;}
.badge-header-internal{display:inline-flex;align-items:center;gap:5px;background:rgba(64,145,108,.2);border:1px solid rgba(64,145,108,.4);color:#86efac;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;position:relative;}
.badge-header-internal::after{content:'';position:absolute;inset:-3px;border-radius:999px;border:2px solid rgba(64,145,108,.5);animation:pulse-ring 2.5s ease-out infinite;}

.back-link{display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.65);font-size:13px;text-decoration:none;margin-bottom:24px;transition:all .2s;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);white-space:nowrap;}
.back-link:hover{color:white;text-decoration:none;background:rgba(255,255,255,.14);transform:translateX(-3px);}

.floating-toc{position:fixed;right:24px;top:50%;transform:translateY(-50%);width:200px;background:rgba(255,255,255,.95);border-radius:14px;padding:16px;box-shadow:var(--shadow-lg);backdrop-filter:blur(12px);z-index:400;}
.floating-toc h4{font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gray-400);text-transform:uppercase;margin-bottom:10px;}
.toc-list{list-style:none;}
.toc-item a{display:block;font-size:12px;color:var(--gray-600);padding:4px 8px;border-radius:6px;transition:all .15s;text-decoration:none;line-height:1.4;}
.toc-item a:hover{background:var(--gray-100);color:var(--gray-900);}
.toc-item.active a{background:var(--amber-50,#fffbeb);color:var(--amber-700,#b45309);font-weight:700;}
@media(max-width:1280px){.floating-toc{display:none;}}

.detail-content{max-width:860px;margin:0 auto;padding:48px 40px 80px;counter-reset:section-counter;}
.section-h2{font-size:22px;font-weight:900;color:var(--gray-900);margin:52px 0 20px;padding-bottom:12px;border-bottom:2px solid var(--gray-200);display:flex;align-items:center;gap:14px;counter-increment:section-counter;}
.section-h2::before{content:counter(section-counter,decimal-leading-zero);font-size:13px;font-weight:700;color:white;background:var(--amber-500);border-radius:6px;padding:2px 10px;letter-spacing:.02em;flex-shrink:0;}
.section-h3{font-size:16px;font-weight:700;color:var(--amber-800,#92400e);margin-top:28px;padding-left:14px;border-left:3px solid var(--amber-300,#fcd34d);}
.decision-box{background:linear-gradient(135deg,var(--amber-50,#fffbeb),rgba(254,243,199,.5));border:1.5px solid var(--amber-200,#fde68a);border-radius:12px;padding:16px 20px;margin-top:20px;font-size:14px;}

.chart-container{background:linear-gradient(135deg,#78350f,#92400e);border-radius:16px;padding:28px;color:white;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(120,53,15,.35);margin:32px 0;}
.chart-container::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 80% 0%,rgba(252,211,77,.1) 0%,transparent 60%);}
.chart-title{font-size:15px;font-weight:700;margin-bottom:20px;position:relative;z-index:1;display:flex;align-items:center;gap:8px;}
.anim-bar-wrap{margin-bottom:14px;position:relative;z-index:1;}
.anim-bar-label{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;opacity:.85;}
.anim-bar-track{background:rgba(255,255,255,.15);border-radius:4px;height:24px;overflow:hidden;}
.anim-bar-fill{height:100%;width:0%;border-radius:4px;background:linear-gradient(90deg,var(--amber-500,#f59e0b),var(--amber-400,#fbbf24));transition:width 1.2s cubic-bezier(.16,1,.3,1);box-shadow:0 0 8px rgba(245,158,11,.5);}

.hbar-section{margin:32px 0;}
.hbar-row{display:flex;align-items:center;gap:14px;margin-bottom:12px;}
.hbar-name{font-size:13px;font-weight:600;min-width:80px;text-align:right;flex-shrink:0;}
.hbar-track{flex:1;background:var(--gray-100);border-radius:6px;overflow:hidden;height:32px;}
.hbar-fill{height:100%;width:0%;border-radius:6px;display:flex;align-items:center;padding-left:12px;font-size:12px;font-weight:700;color:white;transition:width 1.2s cubic-bezier(.16,1,.3,1);}
.col-amber{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
.col-green{background:linear-gradient(90deg,#10b981,#34d399);}
.col-blue{background:linear-gradient(90deg,#3b82f6,#60a5fa);}
.col-red{background:linear-gradient(90deg,#ef4444,#f87171);}
.col-purple{background:linear-gradient(90deg,#8b5cf6,#a78bfa);}
.col-pink{background:linear-gradient(90deg,#ec4899,#f472b6);}
.col-indigo{background:linear-gradient(90deg,#6366f1,#818cf8);}
.col-teal{background:linear-gradient(90deg,#14b8a6,#2dd4bf);}

.ai-section{background:linear-gradient(135deg,#fffbeb,rgba(254,243,199,.4));border:1.5px solid var(--amber-300,#fcd34d);border-radius:14px;padding:24px 28px;margin:32px 0;counter-reset:ai-counter;}
.ai-title{font-size:15px;font-weight:700;color:var(--amber-800,#92400e);margin-bottom:16px;}
.ai-list{list-style:none;display:flex;flex-direction:column;gap:10px;}
.ai-list li{display:flex;align-items:flex-start;gap:12px;font-size:14px;line-height:1.7;counter-increment:ai-counter;}
.ai-list li::before{content:counter(ai-counter);display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--amber-500);color:white;font-size:11px;font-weight:700;flex-shrink:0;margin-top:3px;}

.actions-section{background:white;border:1.5px solid var(--gray-200);border-radius:16px;padding:28px;margin:32px 0;box-shadow:var(--shadow-sm);}
.actions-title{font-size:16px;font-weight:700;margin-bottom:16px;}
.actions-progress{margin-bottom:20px;}
.actions-progress-label{display:flex;justify-content:space-between;font-size:13px;color:var(--gray-600);margin-bottom:8px;}
.progress-bar-wrap{background:var(--gray-100);border-radius:999px;height:8px;overflow:hidden;}
.progress-bar-fill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,var(--amber-500),#fbbf24);transition:width .4s ease;box-shadow:0 0 8px rgba(245,158,11,.5);}
.action-list{list-style:none;display:flex;flex-direction:column;gap:0;}
.action-item{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);}
.action-item:last-child{border-bottom:none;}
.action-item input[type="checkbox"]{display:none;}
.action-item label{display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:14px;line-height:1.6;flex:1;}
.action-item label::before{content:'';width:18px;height:18px;border:2px solid var(--gray-300);border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all .2s;background:white;}
.action-item input:checked+label{color:var(--gray-400);text-decoration:line-through;}
.action-item input:checked+label::before{content:'✓';background:var(--amber-500);border-color:var(--amber-500);color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;transform:scale(1.1);box-shadow:0 2px 8px rgba(245,158,11,.4);}
.copy-btn{margin-left:auto;background:white;border:1.5px solid var(--gray-200);color:var(--gray-500);border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer;transition:all .2s;font-family:'Noto Sans JP',sans-serif;flex-shrink:0;}
.copy-btn:hover,.copy-btn.copied{background:var(--amber-500);border-color:var(--amber-500);color:white;}
  </style>
</head>
<body>
<div id="scroll-progress"></div>
<nav class="floating-toc" id="floatingToc"><h4>目次</h4><ul class="toc-list" id="tocList"></ul></nav>

<header class="detail-header">
  <div class="hero-particle"></div><div class="hero-particle"></div><div class="hero-particle"></div>
  <div class="hero-particle"></div><div class="hero-particle"></div>
  <div class="detail-header-inner">
    <a href="index.html" class="back-link">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 3L5 8l5 5"/></svg>一覧に戻る
    </a>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <span style="font-size:11px;opacity:.45;letter-spacing:.15em;text-transform:uppercase;">FARMAN Inc.</span>
      <span class="badge-header-external">🤝 社外</span>
    </div>
    <h1 style="font-size:clamp(22px,4vw,34px);font-weight:900;line-height:1.25;margin-bottom:16px;">{タイトル}</h1>
    <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;opacity:.75;">
      <span>📅 {YYYY}年{M}月{D}日</span>
      <span>⏱ 録音: {duration}</span>
      <span id="readTime">📖 読了時間: 計算中</span>
    </div>
  </div>
</header>

<div class="detail-content" id="detailContent">
  <h2 class="section-h2 reveal" id="sec1">{セクション1}</h2>
  <p class="reveal">本文...</p>
  <div class="decision-box reveal"><strong>結論:</strong> ...</div>
  <hr style="border:none;border-top:1px solid var(--gray-200);margin:40px 0;">

  <!-- チャート（内容に応じた種類を選択） -->
  <div class="chart-container reveal" id="myChart">
    <div class="chart-title">📊 {タイトル}</div>
    <!-- ① 〜 ⑭ の中から最適なものを実装 -->
  </div>

  <div class="ai-section reveal">
    <div class="ai-title">✨ AIサジェスト — 次のアクション候補</div>
    <ul class="ai-list"><li>...</li></ul>
  </div>

  <div class="actions-section reveal">
    <div class="actions-title">📋 ToDo</div>
    <div class="actions-progress">
      <div class="actions-progress-label"><span>進捗</span><span id="progressCount">0 / {N} 完了</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" id="progressBar"></div></div>
    </div>
    <ul class="action-list" id="actionList">
      <li class="action-item">
        <input type="checkbox" id="a1">
        <label for="a1">{ToDoテキスト}</label>
        <button class="copy-btn" onclick="copyAction(this,event)">📋 コピー</button>
      </li>
    </ul>
  </div>
</div>

<script>
window.addEventListener('scroll',()=>{const e=document.getElementById('scroll-progress'),d=document.documentElement.scrollHeight-window.innerHeight;e.style.width=(d>0?window.scrollY/d*100:0)+'%';},{passive:true});
(function(){const c=document.getElementById('detailContent'),w=c?c.textContent.replace(/\s+/g,'').length:0,el=document.getElementById('readTime');if(el)el.textContent='📖 読了時間: 約'+Math.max(1,Math.ceil(w/400))+'分';})();
const ro=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.style.opacity='1';e.target.style.transform='translateY(0)';ro.unobserve(e.target);}}),{threshold:.08});
document.querySelectorAll('.reveal').forEach(el=>{el.style.opacity='0';el.style.transform='translateY(24px)';el.style.transition='opacity .6s ease,transform .6s ease';ro.observe(el);});
const barObs=new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting)return;
  e.target.querySelectorAll('.anim-bar-fill[data-width]').forEach(b=>{b.style.width=b.getAttribute('data-width')+'%';});
  e.target.querySelectorAll('.hbar-fill[data-width]').forEach(b=>{b.style.width=b.getAttribute('data-width')+'%';});
  e.target.querySelectorAll('.stack-seg[data-height]').forEach(b=>{b.style.height=(parseInt(b.dataset.height)/100*140)+'px';});
  barObs.unobserve(e.target);
}),{threshold:.2});
document.querySelectorAll('.chart-container').forEach(c=>barObs.observe(c));
(function(){const hs=document.querySelectorAll('.section-h2'),tl=document.getElementById('tocList');if(!tl)return;hs.forEach(h=>{const li=document.createElement('li');li.className='toc-item';const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent.replace(/^\d+/,'').trim();a.addEventListener('click',ev=>{ev.preventDefault();h.scrollIntoView({behavior:'smooth',block:'start'});});li.appendChild(a);tl.appendChild(li);});const ti=tl.querySelectorAll('.toc-item');hs.forEach(h=>new IntersectionObserver(es=>es.forEach(e=>{const idx=Array.from(hs).findIndex(x=>x.id===e.target.id);if(e.isIntersecting&&idx>=0){ti.forEach(l=>l.classList.remove('active'));if(ti[idx])ti[idx].classList.add('active');}}),{threshold:.3,rootMargin:'-60px 0px -40% 0px'}).observe(h));})();
function copyAction(btn,e){e.preventDefault();e.stopPropagation();const t=btn.closest('.action-item').querySelector('label').textContent.trim();navigator.clipboard.writeText(t).then(()=>{btn.textContent='✓ コピー済み';btn.classList.add('copied');setTimeout(()=>{btn.textContent='📋 コピー';btn.classList.remove('copied');},1800);});}
const total={N};
function updateProgress(){const c=document.querySelectorAll('#actionList input:checked').length;document.getElementById('progressBar').style.width=Math.round(c/total*100)+'%';document.getElementById('progressCount').textContent=c+' / '+total+' 完了';if(c===total)setTimeout(confetti,200);}
document.querySelectorAll('#actionList input').forEach(cb=>cb.addEventListener('change',updateProgress));
function confetti(){const cs=['#f59e0b','#fbbf24','#fcd34d','#78350f','#fff','#fef3c7'];for(let i=0;i<60;i++){const p=document.createElement('div');p.className='confetti-piece';const s=6+Math.random()*10;p.style.cssText=`left:${Math.random()*100}vw;width:${s}px;height:${s}px;background:${cs[Math.floor(Math.random()*cs.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.5+Math.random()*2.5}s,${.8+Math.random()}s;animation-delay:${Math.random()*.5}s;`;document.body.appendChild(p);p.addEventListener('animationend',()=>p.remove());}}
</script>
<script src="edit-mode.js?v=10"></script>
<script src="enhance.js?v=4"></script>
</body></html>
```

#### ▼ 強化レイヤー（enhance.css / enhance.js）— 全ページ共通、デザインは変えず機能を上乗せ

`enhance.css` と `enhance.js` を**必ず読み込む**（上記テンプレに記載済み）。これだけで以下が自動で付く（色はテーマから自動判定）：
- **読了プログレス**（目次の各項目にドット）・**スクロール追従の極細セクションバー**（現在地＋ページ内検索）
- **見出しホバーで#リンクコピー**・**トップに戻る**ボタン・**日本語の文節改行/等幅数字**・**印刷最適化**
- **長セクションの折りたたみ**（`<div class="collapsible">…</div>` で囲むと自動で「続きを読む」化。本文が長いセクションに使う）

**コンテンツ側で必ず入れる（知能化）：**

1. **`<meta name="entities">`** … 人物・企業名をカンマ区切り。本文中の該当名が自動で強調（`.ent`）される。**1文字の固有名（「原」「林」等の1字姓）は入れない**（「原料」「林業」等の無関係な語に誤マッチして色が付く。enhance.js側でも2文字未満は強調対象外にしているが、メタにも入れないこと）。
2. **キーワードチップ**（ヒーロー直後／本文冒頭に）：
```html
<div class="kw-bar">
  <a class="kw-chip" href="index.html?q=カーボンクレジット">カーボンクレジット</a>
  <a class="kw-chip" href="index.html?q=バイオ炭">バイオ炭</a>
  <a class="kw-chip" href="index.html?q=北杜市">北杜市</a>
</div>
```
3. **専門用語ツールチップ**：初見で分かりにくい語を `.term` で囲み `data-tip` に短い解説（ホバー/タップで表示）：
```html
<span class="term" data-tip="バイオ炭：生物資源を低酸素で炭化したもの。土壌改良＋炭素固定に使え、カーボンクレジット化が検討される。">バイオ炭</span>
```
4. **関連MTGリンク**（ToDoの直前など末尾に）：STEP1で取得した**既存HTML一覧**を見て、**同じ人物・企業・テーマを共有する過去ページを2〜4件**選びリンクする（横断ナレッジ化）。`data-text`やタイトルの重なりで判断：
```html
<div class="related-section">
  <h2 class="section-h2 reveal" id="related">関連するMTG</h2>
  <div class="related-grid">
    <a class="related-card" href="2026-06-19_sakanotochu-mtg.html">
      <div class="rc-date">2026年6月19日</div>
      <div class="rc-title">06-19 坂ノ途中 MTG</div>
      <div class="rc-why">🔗 坂ノ途中・バイオ炭が共通</div>
    </a>
  </div>
</div>
```

**チャートには `chart-insight`（インサイト注釈）を1つ添える**（「一番言いたい数字」を言語化）：
```html
<div class="chart-insight">
  <span class="ci-ico">💡</span>
  <p><b>注目：</b>創出コストは市場上限の<b>約4.6倍</b>。普及には規模拡大・助成・複合収益が前提。</p>
</div>
```

**コンテンツ生成指針：**
- **タイトルはPlaudのファイル名をそのまま使う**（変換・省略・空白の追加・削除は一切しない）
- セクションはPlaudのkey_topicsをベースに、内容の論理的なまとまりで分ける（3〜15セクション程度）
- 各セクションに `結論:` のdecision-boxを必ず追加
- section-h3 はセクション内にサブトピックがある場合に使う
- ToDoはaction_itemsから生成（なければsummaryから抽出）
- **チャートは必ず1〜2種類追加する**（上記14種の中からMTG内容に最も合うものを選ぶ）
- **AIサジェストは必ず追加する**（4〜5件）

---

#### ▼ 🎤 講話録音 — 講話ナレッジテンプレート（議事録テンプレートとは別設計）

**講話録音ファイルは議事録テンプレートを使わず、以下の専用テンプレートで生成する。**

設計の違い：
- ToDo / Asana連携 → **なし**（講話はアクション管理でなくナレッジ蓄積が目的）
- セクション構成 → 固定4セクション（下記）
- テーマタグ → 必須（kowa-knowledge.html の横断検索に使用）
- 関連講話リンク → 自動生成（既存の他講話HTMLと照合）

**テーマ色：インジゴ**
```css
--indigo-950: #1e1b4b
--indigo-900: #312e81
--indigo-500: #6366f1
--indigo-400: #818cf8
--indigo-300: #a5b4fc
--indigo-100: #e0e7ff
--indigo-50:  #eef2ff
--bg: #f5f3ff
```

**固定セクション構成：**

1. **📌 講話の概要** — 誰が・何について・いつ話したかの3行サマリー
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

**引用ボックスのHTML：**
```html
<div class="kowa-quote reveal">
  <div class="kowa-quote-mark">"</div>
  <p class="kowa-quote-text">引用テキスト</p>
  <div class="kowa-quote-source">— 話者名（任意）</div>
</div>
```

**ヘッダーバッジ：** `badge-header-kowa`（`🎤 講話録音`）

**ファイル命名規則：** `{YYYY-MM-DD}_{ローマ字スネークケース}-kowa.html`

---

### STEP 5: index.html にカードを追加する

設定ファイルで指定された `paths.work_dir` の `index.html` に、既存カードリストの**先頭**（最新が上）を追加。

```powershell
# 設定ファイルから作業ディレクトリを読み込む
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
$indexFile = Join-Path $workDir $config.paths.index_file
```

以下の操作を `$indexFile` に対して実行：

**カードのHTML形式：**
```html
<a href="{filename}.html" class="mtg-card card-animate" data-type="{internal|external}" data-text="{キーワードスペース区切り}">
  <div class="card-glare"></div>
  <div class="card-header">
    <span class="card-date">{YYYY}年{M}月{D}日</span>
    <span class="badge badge-external">🤝 社外</span>
  </div>
  <div class="card-title">{タイトル}</div>
  <div class="card-summary">{1〜2行の要約}</div>
  <div class="card-footer">
    <span class="card-duration">⏱ {録音時間}</span>
    <span class="card-actions-badge has-actions">✅ ToDo {N}件</span>
  </div>
</a>
```

講話録音の場合は以下のカード形式を使う：
```html
<a href="{filename}-kowa.html" class="mtg-card card-animate" data-type="kowa" data-text="{テーマタグ スペース区切り}">
  <div class="card-glare"></div>
  <div class="card-header">
    <span class="card-date">{YYYY}年{M}月{D}日</span>
    <span class="badge badge-kowa">🎤 講話録音</span>
  </div>
  <div class="card-title">{タイトル}</div>
  <div class="card-summary">{1〜2行の要約}</div>
  <div class="card-footer">
    <span class="card-duration">⏱ {録音時間}</span>
    <span class="card-actions-badge">🏷 {テーマ1} / {テーマ2}</span>
  </div>
</a>
```

カード追加後、実際のカード数をカウントして `data-count` と `filter-count` を更新する（PowerShell）：

```powershell
# 設定ファイルから作業ディレクトリを読み込む
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
$indexFile = Join-Path $workDir $config.paths.index_file

$content = Get-Content $indexFile -Raw
($content | Select-String 'class="mtg-card' -AllMatches).Matches.Count
($content | Select-String 'data-type="internal"' -AllMatches).Matches.Count
($content | Select-String 'data-type="external"' -AllMatches).Matches.Count
($content | Select-String 'data-type="kowa"' -AllMatches).Matches.Count
```

取得した数値で以下を更新：
- `<strong data-count="X">` × 4箇所（全件・社内・社外・講話録音）
- `<span class="filter-count" id="count">X件表示中</span>`

**index.html フィルターバーの「📚 講話ナレッジベース」リンク：** フィルターバーの「🎤 講話録音」ボタンの右隣に配置済み。新規ページ追加時に壊れていないか確認する。

### STEP 5.5: kowa-knowledge.html を更新する（講話録音が追加された場合のみ）

今回の処理に講話録音ファイルが1件以上含まれる場合、`kowa-knowledge.html` を再生成する。

```powershell
# 設定ファイルから作業ディレクトリを読み込む
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
$kowaFile = Join-Path $workDir $config.paths.kowa_knowledge_file
# $kowaFile に対して更新処理を実行
```

**kowa-knowledge.html 実装仕様（重要）：**

- フィルターバーのテーマボタン: `onclick="filterTheme(null,'テーマ名')"` で統一（`filterTheme` 第1引数はnull固定）
- キーワードチップ: `onclick="toggleKwChip(this,'キーワード')"` を使う（`searchKowa` ではない）
  - クリックでハイライト（active状態）、再クリックで解除（トグル動作）
  - クリック後に `kowaGrid` へ自動スクロール
- 「✕ クリア」ボタン（id="clearBtn"）: フィルター適用中のみ表示、`clearFilters()` を呼び出す
- テーマインデックスカードのonclick: `filterTheme(null,'農業観')` 形式

**kowa-knowledge.html の構成：**

```
[ヘッダー] 🎤 講話ナレッジベース — FARMAN Inc.
[統計バー] 全{N}件 / テーマ数{M}種

[フィルターバー] テーマ別ボタン（すべて / テーマ1 / ...）+ 検索ボックス + ✕クリアボタン + N件表示中

[タイムライン + カードグリッド] id="kowaGrid" — 日付順に講話カード
  各カード: data-themes / data-keywords / data-speaker / data-date 属性必須

[キーワードクラウド] toggleKwChipで操作、activeクラスでハイライト

[テーマ別インデックス] filterTheme(null, テーマ名)で操作
```

**JS関数の定義（必ずこの4つを実装）：**
```javascript
function filterTheme(_, theme){ /* テーマフィルター + kowaGridへスクロール */ }
function toggleKwChip(chip, q){ /* キーワードチップのトグル + kowaGridへスクロール */ }
function searchKowa(q){ /* テキスト検索（input oninput用）*/ }
function clearFilters(){ /* 全フィルターリセット */ }
```

### STEP 5.6: 横断ページを自動再生成する（毎回・新規HTMLがあれば必須）

新規HTML化・index更新が発生したら、**index更新の後**に `gen-aux.js` を実行して横断ページを再生成する。これは既存の全議事録HTMLを解析して以下を自動生成する（手書き不要・常に最新）：

| 出力 | 内容 |
|------|------|
| `search-index.json` | 全文検索インデックス（index.html の検索が本文・タグまで対象にする） |
| `entity-index.html` | 🔗 ナレッジインデックス（人物・企業・キーワードでMTGを横断。`<meta name="entities">`＋indexカードの`data-text`を集約） |
| `decisions.html` | ✅ 決定事項ダッシュボード（全MTGの `decision-box` を集約） |

```powershell
$cfgHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$skillDir = @("$cfgHome\plugins\marketplaces\farman-skills\plugins\plaud-suite\skills\plaud-html","$cfgHome\skills\plaud-html") | Where-Object { Test-Path (Join-Path $_ 'gen-aux.js') } | Select-Object -First 1
node "$skillDir\gen-aux.js" (($cfg.paths.work_dir) -replace '~', $env:USERPROFILE)
```

> **依存：** index.html のカード `data-text` を読むため、**STEP 5（index更新）の後に実行**すること。新規HTMLが0件の回はスキップ可。
> **index.html 側の前提：** フィルターバーに `entity-index.html`／`decisions.html` へのリンク、末尾に `search-index.json` を読み込む全文検索＆`plaud-read-*` 既読バッジのスクリプトが入っている（導入済み）。

### STEP 6: ToDoをAsanaに追加する（社内・社外 のみ）

> **⚠️ 講話録音（kowa）はAsana連携しない。** STEP 6は社内・社外ファイルのみ対象。

**社内・社外問わず**、ToDoテキストが以下のフォーマットに一致するもののみAsanaに登録する。

#### 連携対象フォーマット（必須）

```
タスク詳細：担当者1、担当者2：期限（任意）
```

| パターン | 例 |
|---------|-----|
| 担当者のみ | `農機のマーケット調査：井出、瀬戸山` |
| 担当者＋期限 | `農機のマーケット調査：瀬戸山：6/12` |
| 担当者1名のみ | `農機のマーケット調査：瀬戸山` |

> **⚠️ 「：」が含まれないToDoはAsana連携しない**（スキップしても完了報告への記載も不要）。

#### 担当者名とプロジェクトGIDの対応表

| 担当者名 | プロジェクトGID |
|---------|----------------|
| 井出 | `1214760871469759` |
| 田中 | `1214760871469775` |
| 瀬戸山 | `1214760871469812` |
| 井上 | `1214760900570651` |
| 関根 | `1214760871469747` |
| 豊田 | `1214760871469796` |
| 青柳 | `1214760871469806` |
| 複数人 | `1214855321951743` |

#### タスク登録ルール

- **assignee**: 全タスク共通で `1214760378378159`（瀬戸山 章）
- **タスク名**: 最初の「：」より前の部分のみ
- **notes**: `出典：{YYYY-MM-DD} {MTGタイトル}`
- **due_on**: 期限がある場合は `YYYY-MM-DD` 形式（年は2026年）

#### 登録先プロジェクトの決定

| 担当者数 | 登録先 |
|---------|--------|
| **1名** | その担当者のプロジェクトのみ |
| **2名以上** | 各担当者のプロジェクト ＋ 「複数人」プロジェクト |

### STEP 7: Cloudflare Pages へデプロイする（Git連携 — pushで自動公開）

デプロイは**サイトrepo `stymism/farman-mtg-site`（非公開）への git push**で行う。Cloudflare Pages がGit連携で自動ビルド・公開する。旧方式（`wrangler pages deploy` 直接アップロード）は**廃止** — Git連携プロジェクトはwranglerからの直接アップロードを受け付けない。

```powershell
# 設定ファイルから作業ディレクトリを読み込む
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$src = $config.paths.work_dir -replace '~', $env:USERPROFILE
$repoDir = "$env:USERPROFILE\.plaud\farman-mtg-site"
$repoUrl = "https://github.com/stymism/farman-mtg-site.git"

# git 未導入なら、ここでデプロイをスキップして案内（HTML生成自体は完了済み）
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "⚠ git が未インストールのため、デプロイをスキップします。" -ForegroundColor Yellow
  Write-Host "   → git導入・gh auth login 後、このSTEP7を再実行してください。" -ForegroundColor Yellow
  Write-Host "   （HTML生成・index更新・Asana登録は完了しています）" -ForegroundColor Yellow
  return
}

# サイトrepoのローカルクローン（無ければ作成）→ 最新化
if (-not (Test-Path "$repoDir\.git")) { git clone $repoUrl $repoDir }
git -C $repoDir pull --rebase origin main

# ガード: work_dirがrepoよりHTML大幅減なら中止（空work_dirで公開サイトを消す事故防止）
$srcHtml  = @(Get-ChildItem $src -Filter *.html -File -ErrorAction SilentlyContinue).Count
$repoHtml = @(Get-ChildItem $repoDir -Filter *.html -File).Count
if ($srcHtml -lt ($repoHtml - 5)) {
  Write-Host "⛔ 中止: work_dirのHTML($srcHtml)がサイトrepo($repoHtml)より大幅に少ない。" -ForegroundColor Red
  Write-Host "   新PCなら先に作業ディレクトリをサイトrepoからseedすること（セットアップ節参照）。" -ForegroundColor Yellow
  return
}

# work_dir → repo にミラー（ルート直下ファイル＋functions。repo管理ファイルは /XD /XF で保護）
robocopy $src $repoDir /MIR /LEV:1 /XD .git .wrangler functions node_modules /XF .gitignore SITE-REPO-README.md /NFL /NDL /NJH /NJS /NP
if (Test-Path "$src\functions") { robocopy "$src\functions" "$repoDir\functions" /MIR /NFL /NDL /NJH /NJS /NP }

# 変更があれば commit → push（= Cloudflare Pages の自動デプロイが発火）
if (git -C $repoDir status --porcelain) {
  git -C $repoDir add -A
  git -C $repoDir commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  git -C $repoDir push origin main
  Write-Host "✅ push完了 → Cloudflare Pages が自動デプロイします（公開まで1〜2分）" -ForegroundColor Green
  Write-Host "   https://farman-mtg.pages.dev" -ForegroundColor Cyan
} else {
  Write-Host "変更なし（デプロイ不要）" -ForegroundColor Yellow
}
```

デプロイ完了後、URL `https://farman-mtg.pages.dev` を表示する（Pagesビルド完了まで1〜2分）。

> **認証エラーになるPCでは**、一度だけ `gh auth login`（GitHub CLI）を実行してから再実行する。robocopyの終了コード1〜3は正常（コピー実行済み）なのでエラー扱いしない。

### （旧STEP 8: 配布ZIP更新 — 廃止）

配布ZIPの再生成は**廃止**（2026-07-07）。スキル配布はGitHubマーケットプレイス（`claude plugin update`）、サイト内容の共有はサイトrepo（STEP 7 のgit push）が担うため、ZIP運搬は不要になった。

---

## 完了報告

以下を報告する：
1. 追加したHTMLファイル名（一覧）
2. 社内/社外/講話録音 の分類結果
3. 追加したビジュアライズの種類（チャートタイプ番号と内容）
4. 講話録音の場合: 付与したテーマタグ一覧、kowa-knowledge.html 更新有無
5. AsanaタスクのURL（何件追加したか）※社内・社外のみ
6. 横断ページの再生成（STEP 5.6。`gen-aux.js` 実行 → entity-index / decisions / search-index.json）
7. デプロイ結果（STEP 7。push の commit と URL。「push→自動公開・1〜2分」の旨）

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
- Plaud APIで未HTML化ファイルを検出
- HTML生成、index.html更新、Asana連携、Cloudflareデプロイ

---

## 注意事項

### スキル実行時の注意
- 新規HTMLがない場合（全て既にHTML化済み）は「追加なし」と報告して終了
- Plaudのget_noteで3回リトライ後もデータが取れない場合はスキップして報告
- index.htmlの`data-count`は必ず更新する
- **HTMLのギミック省略は禁止**。参照ファイルとしてすでに作成済みの高品質ファイル（`2026-06-14_uematsu-mtg.html` 等）をRead toolで読み込んで参考にしてよい
- **`.back-link` には必ず `white-space:nowrap;` を含めること**（省略すると「一覧に戻る」テキストが折り返す）
- **チャートは上記14種から選ぶ。プレースホルダーや空のチャートは禁止。必ず実際のMTG内容を反映した具体的な数値・ラベルを入れること**
- **エンティティ強調・キーワードチップ・関連MTGは「本文（`<p>`・decision-box）」内で使う**。`enhance.js` はフレックス系UI（`.ai-list`/`.action-list`/カード等）内ではエンティティ強調をスキップする（テキスト分割でレイアウトが崩れるため）。`enhance.js` を更新したらHTML側の `enhance.js?v=N` を必ずインクリメントする（キャッシュ対策。現行 `v=4`）。enhance.js は読書ナビ・知能化に加え、**既読マーク（`plaud-read-*`）・ダークモード・モバイル目次シート・Markdown/PDF出力・チャートのホバー強調**（FABクラスター）も提供する

### 別PC対応での注意
- **初回セットアップが必須**: スキル初回実行前に `.\setup-plaud.ps1` を実行してください
- **設定ファイルは環境依存**: 各PCで独立した `$env:USERPROFILE\.plaud\plaud-config.json` が生成されます
- **OneDrive同期推奨**: 作業ディレクトリ（HTML出力先）をOneDrive同期フォルダに指定することで、複数PC間の一貫性が保たれます
- **APIトークン管理**: 設定ファイルはバージョン管理から除外してください（`.gitignore` に追加）
- **トークン更新**: APIトークンが期限切れの場合は、上記「トークン期限切れエラー時」を参照して更新してください
