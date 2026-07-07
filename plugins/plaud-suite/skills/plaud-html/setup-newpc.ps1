#Requires -Version 5.1
# plaud 新PCワンクリックセットアップ（ZIP同梱版・冪等 = 何度実行しても安全）
# ZIP内容: SETUP.cmd / setup-newpc.ps1 / plaud-config.json(鍵) / README.txt
# スキル本体はGitHubマーケットプレイスから、サイトデータはサイトrepoから自動取得する。

$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "=== plaud 新PCセットアップ ===" -ForegroundColor Cyan
Write-Host ""

# --- [1/4] Claude Code 確認 + スキル一式（マーケットプレイス経由） ---
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCmd -and -not (Test-Path "$env:USERPROFILE\.local\bin\claude.exe")) {
  Write-Host "[NG] Claude Code が見つかりません。" -ForegroundColor Red
  Write-Host "     先に Claude Code をインストールし、いつものアカウントでログインしてから再実行してください。" -ForegroundColor Yellow
  exit 1
}
Write-Host "[1/4] スキル導入（GitHubマーケットプレイス farman-skills）..." -ForegroundColor Cyan
irm https://raw.githubusercontent.com/stymism/farman-skills/main/migrate.ps1 | iex

# --- [2/4] 設定ファイル（鍵）の設置 ---
$cfgDst = "$env:USERPROFILE\.plaud\plaud-config.json"
$cfgSrc = Join-Path $PSScriptRoot "plaud-config.json"
if (Test-Path $cfgDst) {
  Write-Host "[2/4] 設定ファイル: 既にあり → そのまま使用" -ForegroundColor Green
} elseif (Test-Path $cfgSrc) {
  New-Item -ItemType Directory -Force "$env:USERPROFILE\.plaud" | Out-Null
  Copy-Item $cfgSrc $cfgDst
  Write-Host "[2/4] 設定ファイル: ZIPから設置 → $cfgDst" -ForegroundColor Green
} else {
  Write-Host "[2/4] 設定ファイル: ZIP内に plaud-config.json が見つかりません（README参照）" -ForegroundColor Yellow
}

# --- [3/4] 作業ディレクトリ（このPC用にパス自動調整） ---
$wd = $null
if (Test-Path $cfgDst) {
  $cfg = Get-Content $cfgDst -Raw | ConvertFrom-Json
  $wd = $cfg.paths.work_dir -replace '~', $env:USERPROFILE
  if (-not (Test-Path $wd)) {
    $newWd = if ($env:OneDrive) { Join-Path $env:OneDrive "plaud_summaries" } else { Join-Path $env:USERPROFILE "Documents\plaud_summaries" }
    $cfg.paths.work_dir = $newWd
    $cfg | ConvertTo-Json -Depth 10 | Set-Content $cfgDst -Encoding UTF8
    New-Item -ItemType Directory -Force $newWd | Out-Null
    Write-Host "[3/4] 作業ディレクトリ: このPC用に変更 → $newWd" -ForegroundColor Green
    $wd = $newWd
  } else {
    Write-Host "[3/4] 作業ディレクトリ: OK → $wd" -ForegroundColor Green
  }
}

# --- [4/4] サイト内容のseed（サイトrepoから。git+認証がある場合のみ自動） ---
if ($wd) {
  $hasHtml = @(Get-ChildItem $wd -Filter *.html -File -ErrorAction SilentlyContinue).Count
  if ($hasHtml -gt 0) {
    Write-Host "[4/4] サイトseed: 既にデータあり（HTML $hasHtml 件）→ スキップ" -ForegroundColor Green
  } elseif (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "[4/4] サイトseed: サイトrepoから取得中..." -ForegroundColor Cyan
    $stage = "$env:USERPROFILE\.plaud\farman-mtg-site"
    $cloneOk = $true
    if (-not (Test-Path "$stage\.git")) {
      git clone https://github.com/stymism/farman-mtg-site.git $stage 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { $cloneOk = $false }
    } else {
      git -C $stage pull --rebase origin main 2>&1 | Out-Null
    }
    if ($cloneOk -and (Test-Path "$stage\.git")) {
      robocopy $stage $wd /E /XD .git /XF .gitignore SITE-REPO-README.md /NFL /NDL /NJH /NJS /NP | Out-Null
      Write-Host "[4/4] サイトseed: 完了（$((@(Get-ChildItem $wd -Filter *.html -File)).Count) HTML）" -ForegroundColor Green
    } else {
      Write-Host "[4/4] サイトseed: repoに接続できず（非公開repoのため認証が必要）" -ForegroundColor Yellow
      Write-Host "      → gh auth login 実行後、この SETUP.cmd をもう一度ダブルクリック" -ForegroundColor Yellow
    }
  } else {
    Write-Host "[4/4] サイトseed: git未導入のためスキップ" -ForegroundColor Yellow
    Write-Host "      HTML化だけのPCなら不要。公開（デプロイ）もするPCは README.txt の追加手順へ" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== 完了。Claude Code を再起動してください ===" -ForegroundColor Cyan
Write-Host "    再起動後、/plaud-html などのスキルが使えます。"
Write-Host ""
