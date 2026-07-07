#Requires -Version 5.1
<#
.SYNOPSIS
  Plaud HTMLスキル用の初期セットアップスクリプト
  別PC対応版 - 環境毎の設定ファイルを生成します

.DESCRIPTION
  このスクリプトは以下の処理を実行します：
  1. ユーザーのホームディレクトリに plaud-config.json を生成
  2. 必要な環境変数を確認
  3. Plaud API、Asana API、Cloudflareの認証情報を設定
  4. 作業ディレクトリが存在するか確認

.PARAMETER ConfigPath
  設定ファイルの配置先（デフォルト: $env:USERPROFILE\.plaud\plaud-config.json）

.EXAMPLE
  .\setup-plaud.ps1
  # または
  .\setup-plaud.ps1 -ConfigPath "$env:USERPROFILE\.plaud\plaud-config.json"

.NOTES
  初回実行時のみ対話的に設定値を入力します。
  以降の実行ではこの設定ファイルから自動読み込みされます。
#>

param(
  [string]$ConfigPath = "$env:USERPROFILE\.plaud\plaud-config.json"
)

function Write-Header {
  param([string]$Message)
  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
  Write-Host "  $Message" -ForegroundColor Cyan
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
  Write-Host ""
}

function Test-PathReadable {
  param([string]$Path)
  $expandedPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
  return (Test-Path $expandedPath)
}

function Expand-PathShorthand {
  param([string]$Path)
  $Path = $Path -replace '~', $env:USERPROFILE
  return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
}

# ============================================
# 1. 設定ファイルの確認
# ============================================

Write-Header "Plaud HTMLスキル - 初期セットアップ"

# ============================================
# 0. 前提条件のチェック
# ============================================

Write-Host "📋 前提条件を確認します..." -ForegroundColor Cyan
Write-Host ""

# (a) Claudeアカウント（MCPコネクタ）の案内
Write-Host "  [1] Plaud / Asana の MCPコネクタ" -ForegroundColor White
Write-Host "      → 同じ Claude アカウントでログインしていれば自動で利用可能です。" -ForegroundColor Gray
Write-Host "      → このスクリプトでは設定しません（アカウント側で管理）。" -ForegroundColor Gray
Write-Host ""

# (b) スキルファイル本体の案内
Write-Host "  [2] スキルファイル本体" -ForegroundColor White
Write-Host "      → このスクリプトが置かれている $($PSScriptRoot) は" -ForegroundColor Gray
Write-Host "        各PCに存在している必要があります（プラグイン/スキル同期 or 手動コピー）。" -ForegroundColor Gray
Write-Host ""

# (c) git（デプロイ＝サイトrepoへのpush用）のチェック
Write-Host "  [3] git（Cloudflare Pages Git連携デプロイ用）" -ForegroundColor White
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
  Write-Host "      ✓ git が見つかりました: $($gitCmd.Source)" -ForegroundColor Green
} else {
  Write-Host "      ✗ git が見つかりません。" -ForegroundColor Yellow
  Write-Host "        デプロイを使う場合は git-scm.com から導入し、gh auth login で認証" -ForegroundColor Yellow
}
Write-Host ""

$configDir = Split-Path -Parent $ConfigPath
if (-not (Test-Path $configDir)) {
  Write-Host "📁 設定ディレクトリを作成します: $configDir" -ForegroundColor Yellow
  New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

if (Test-Path $ConfigPath) {
  Write-Host "✅ 設定ファイルが存在します: $ConfigPath" -ForegroundColor Green
  Write-Host ""
  Write-Host "既存の設定ファイルを使用しますか？ [Y/n]" -ForegroundColor Cyan
  $use_existing = Read-Host "(デフォルト: Y)"
  if ($use_existing -ne 'n' -and $use_existing -ne 'N') {
    Write-Host "✅ 既存の設定を使用します" -ForegroundColor Green
    exit 0
  }
}

Write-Host "📝 新しい設定ファイルを作成します" -ForegroundColor Yellow

# ============================================
# 2. Plaud API設定の入力
# ============================================

Write-Header "Plaud ログイン設定（自動トークン取得）"

Write-Host "Plaudの【ログインメール】と【パスワード】を入力してください。" -ForegroundColor Cyan
Write-Host "これを保存しておくと、トークン失効時に自動で再取得します（手動コピー不要）。" -ForegroundColor Gray
Write-Host "※ パスワードは設定ファイルに平文保存されます（利便性とのトレードオフ）。" -ForegroundColor DarkYellow
Write-Host ""

$plaud_email = Read-Host "Plaud ログインメール"
if ([string]::IsNullOrWhiteSpace($plaud_email)) {
  Write-Host "❌ メールが空です。セットアップを中止します。" -ForegroundColor Red
  exit 1
}
$plaud_password_secure = Read-Host "Plaud ログインパスワード" -AsSecureString
$plaud_password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($plaud_password_secure))
if ([string]::IsNullOrWhiteSpace($plaud_password)) {
  Write-Host "❌ パスワードが空です。セットアップを中止します。" -ForegroundColor Red
  exit 1
}

# トークンは email+password から自動取得するため空でOK（初回はSTEP1の自動再取得が走る）
$plaud_token = ""
Write-Host "✅ ログイン情報を保存します（初回のトークンは /plaud-html 実行時に自動取得）" -ForegroundColor Green

$plaud_api_base = "https://api-apne1.plaud.ai"
Write-Host "✅ Plaud API Base: $plaud_api_base" -ForegroundColor Green

# ============================================
# 3. Asana設定（トークン入力は不要）
# ============================================

Write-Header "Asana設定"

Write-Host "ℹ️  Asanaは Claude の MCPコネクタ経由で連携します。" -ForegroundColor Cyan
Write-Host "    同じ Claude アカウントでログインしていれば、Asanaコネクタは" -ForegroundColor Gray
Write-Host "    自動的に利用可能です。APIトークンの入力は不要です。" -ForegroundColor Gray
Write-Host "    （担当者名→プロジェクトGIDの対応表は設定ファイルに自動で書き込まれます）" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Asana設定: MCPコネクタを使用（トークン不要）" -ForegroundColor Green

# ============================================
# 4. Cloudflare設定の入力
# ============================================

Write-Header "Cloudflare Pages設定"

Write-Host "Cloudflare API Tokenを入力してください。" -ForegroundColor Cyan
Write-Host "取得方法: https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Gray
Write-Host ""

$cloudflare_token = Read-Host "Cloudflare API Token"
if ([string]::IsNullOrWhiteSpace($cloudflare_token)) {
  Write-Host "⚠️  Cloudflareトークンがスキップされました（後で設定可能）" -ForegroundColor Yellow
  $cloudflare_token = ""
}

# ============================================
# 5. 作業ディレクトリの確認
# ============================================

Write-Header "作業ディレクトリ設定"

$default_work_dir = "~/OneDrive/ドキュメント/plaud_summaries"
Write-Host "作業ディレクトリを指定してください。" -ForegroundColor Cyan
Write-Host "（デフォルト: $default_work_dir）" -ForegroundColor Gray
Write-Host ""

$work_dir_input = Read-Host "作業ディレクトリ"
if ([string]::IsNullOrWhiteSpace($work_dir_input)) {
  $work_dir = $default_work_dir
} else {
  $work_dir = $work_dir_input
}

$work_dir_expanded = Expand-PathShorthand $work_dir
if (-not (Test-Path $work_dir_expanded)) {
  Write-Host "⚠️  作業ディレクトリが存在しません: $work_dir_expanded" -ForegroundColor Yellow
  Write-Host "スキル実行時に自動作成されます。" -ForegroundColor Yellow
} else {
  Write-Host "✅ 作業ディレクトリ確認: $work_dir_expanded" -ForegroundColor Green
}

# ============================================
# 6. メール設定の確認
# ============================================

Write-Header "メール設定"

$default_email = "y-ino@farman.jp"
Write-Host "メールアドレスを入力してください。（Asana通知用）" -ForegroundColor Cyan
Write-Host "（デフォルト: $default_email）" -ForegroundColor Gray
Write-Host ""

$email_input = Read-Host "メールアドレス"
if ([string]::IsNullOrWhiteSpace($email_input)) {
  $email = $default_email
} else {
  $email = $email_input
}

Write-Host "✅ メール: $email" -ForegroundColor Green

# ============================================
# 7. 設定ファイルの生成
# ============================================

Write-Header "設定ファイル生成"

$config = @{
  plaud = @{
    api_token = $plaud_token
    api_base = $plaud_api_base
    email = $plaud_email
    password = $plaud_password
    folder_ids = @{
      internal = "c35095465864259130869d88d1b13419"
      external = "dd2c13edefb7d164495eb6b8b2364d2d"
      kowa = "5010d2625dc09b0713ac337c49893a4d"
    }
  }
  asana = @{
    note = "AsanaはMCPコネクタ経由（PATトークン不要）。以下は担当者名→プロジェクトGIDの対応表"
    assignee_gid = "1214760378378159"
    projects = @{
      "井出" = "1214760871469759"
      "田中" = "1214760871469775"
      "瀬戸山" = "1214760871469812"
      "井上" = "1214760900570651"
      "関根" = "1214760871469747"
      "豊田" = "1214760871469796"
      "青柳" = "1214760871469806"
      "複数人" = "1214855321951743"
    }
  }
  cloudflare = @{
    account_id = "d110669e3f96b8725ea5bb1b149d61ab"
    api_token = $cloudflare_token
    project_name = "farman-mtg"
  }
  paths = @{
    work_dir = $work_dir
    html_output = "."
    index_file = "index.html"
    kowa_knowledge_file = "kowa-knowledge.html"
  }
  email = $email
  version = "1.0"
  created_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  machine = @{
    computername = $env:COMPUTERNAME
    username = $env:USERNAME
  }
}

$configJson = $config | ConvertTo-Json -Depth 10
$configJson | Set-Content -Path $ConfigPath -Encoding UTF8 -Force

Write-Host "✅ 設定ファイルが生成されました: $ConfigPath" -ForegroundColor Green
Write-Host ""
Write-Host "設定内容:" -ForegroundColor Cyan
Write-Host "  Plaud ログイン: $plaud_email （パスワード保存済み・トークンは自動取得）" -ForegroundColor Gray
Write-Host "  Asana:           MCPコネクタ経由（トークン不要）" -ForegroundColor Gray
Write-Host "  Cloudflare Token: $(if($cloudflare_token) { '✓ 設定済み' } else { '✗ 未設定' })" -ForegroundColor Gray
Write-Host "  作業ディレクトリ: $work_dir" -ForegroundColor Gray
Write-Host "  メール: $email" -ForegroundColor Gray
Write-Host ""
Write-Host "🔑 初回トークンを自動取得します..." -ForegroundColor Cyan
$refreshScript = Join-Path $PSScriptRoot "refresh-plaud-token.ps1"
if (Test-Path $refreshScript) {
  & $refreshScript
} else {
  Write-Host "   （refresh-plaud-token.ps1 が見つかりません。/plaud-html 初回実行時に取得されます）" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# 8. 確認メッセージ
# ============================================

Write-Header "セットアップ完了"

Write-Host "🎉 セットアップが完了しました！" -ForegroundColor Green
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Cyan
Write-Host "  1. /plaud-html スキルを実行します"
Write-Host "  2. スキルが自動的に設定ファイルを読み込みます"
Write-Host "  3. 別PCで実行する場合も同じ手順で setup-plaud.ps1 を実行してください"
Write-Host ""
Write-Host "設定ファイル位置: $ConfigPath" -ForegroundColor Gray
Write-Host "(このファイルは .gitignore に追加して、バージョン管理から除外してください)" -ForegroundColor Yellow
Write-Host ""
