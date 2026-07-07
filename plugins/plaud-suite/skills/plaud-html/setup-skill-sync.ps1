#Requires -Version 5.1
<#
.SYNOPSIS
  plaud-html スキルフォルダを OneDrive 経由で複数PC同期する（ジャンクション方式）

.DESCRIPTION
  同じスクリプトを各PCで1回実行するだけ：
   - 初回（コピー元PC）: ローカルのスキル → OneDrive にコピーし、
     ローカル(~/.claude/skills/plaud-html)を OneDrive へのジャンクションに置換
   - 2台目以降: OneDrive 上のスキルへジャンクションを張るだけ

  以降、どのPCで SKILL.md 等を編集しても OneDrive 同期で全PCに自動反映される。

.NOTES
  管理者権限は不要（ディレクトリジャンクションを使用）。
  既存のローカルフォルダは消す前に _backup_ にリネーム退避するので安全。
#>

$ErrorActionPreference = 'Stop'

function Test-IsJunction($path) {
  if (-not (Test-Path $path)) { return $false }
  $item = Get-Item $path -Force
  return [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
}

# 1. OneDrive ルート検出
$od = $env:OneDrive
if (-not $od) { $od = $env:OneDriveCommercial }
if (-not $od) { $od = $env:OneDriveConsumer }
if (-not $od -or -not (Test-Path $od)) {
  Write-Host "❌ OneDrive フォルダが見つかりません。OneDrive にサインインしてから再実行してください。" -ForegroundColor Red
  exit 1
}

$oneDriveSkill  = Join-Path $od "claude-skills\plaud-html"
$claudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$localSkillRoot = "$claudeHome\skills"
$localSkill     = Join-Path $localSkillRoot "plaud-html"

Write-Host ""
Write-Host "OneDrive 保管先: $oneDriveSkill" -ForegroundColor Cyan
Write-Host "ローカル スキル: $localSkill" -ForegroundColor Cyan
Write-Host ""

# 2. OneDrive 側にスキルが無ければローカルから配置（＝コピー元PCの初回）
if (-not (Test-Path $oneDriveSkill)) {
  if ((Test-Path $localSkill) -and -not (Test-IsJunction $localSkill)) {
    Write-Host "📤 ローカルのスキルを OneDrive にコピーします..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path (Split-Path $oneDriveSkill) -Force | Out-Null
    Copy-Item $localSkill $oneDriveSkill -Recurse -Force
    Write-Host "   ✓ コピー完了" -ForegroundColor Green
  } else {
    Write-Host "❌ OneDrive にもローカルにもスキル本体が見つかりません。" -ForegroundColor Red
    Write-Host "   先にコピー元PC（スキルが存在するPC）でこのスクリプトを実行してください。" -ForegroundColor Yellow
    exit 1
  }
} else {
  Write-Host "✓ OneDrive 側にスキルが既にあります（2台目以降 or 設定済み）" -ForegroundColor Green
}

# 3. ローカルを OneDrive へのジャンクションに置換
if (Test-IsJunction $localSkill) {
  Write-Host "✓ ローカルは既にジャンクション済み。追加作業はありません。" -ForegroundColor Green
} else {
  if (Test-Path $localSkill) {
    $backup = "{0}._backup_{1}" -f $localSkill, (Get-Date -Format "yyyyMMdd_HHmmss")
    Write-Host "💾 既存のローカルフォルダを退避します: $backup" -ForegroundColor Yellow
    Rename-Item $localSkill $backup
  }
  New-Item -ItemType Directory -Path $localSkillRoot -Force | Out-Null
  try {
    New-Item -ItemType Junction -Path $localSkill -Target $oneDriveSkill | Out-Null
  } catch {
    # フォールバック（古い環境向け）
    cmd /c mklink /J "$localSkill" "$oneDriveSkill" | Out-Null
  }
  if (Test-IsJunction $localSkill) {
    Write-Host "🔗 ジャンクション作成完了: $localSkill → $oneDriveSkill" -ForegroundColor Green
  } else {
    Write-Host "❌ ジャンクション作成に失敗しました。" -ForegroundColor Red
    exit 1
  }
}

# 4. 設定ファイル(plaud-config.json)の自動配置 — トークン入力を不要にする
Write-Host ""
$odConfig       = Join-Path $od "claude-skills\plaud-config.json"
$localConfigDir = "$env:USERPROFILE\.plaud"
$localConfig    = Join-Path $localConfigDir "plaud-config.json"

if (Test-Path $localConfig) {
  Write-Host "✓ 設定ファイルは既にこのPCにあります" -ForegroundColor Green
  if (-not (Test-Path $odConfig)) {
    Copy-Item $localConfig $odConfig -Force
    Write-Host "  📤 共有用に OneDrive へ設定ファイルをコピーしました（他PCはトークン入力不要に）" -ForegroundColor Yellow
  }
} elseif (Test-Path $odConfig) {
  if (-not (Test-Path $localConfigDir)) { New-Item -ItemType Directory $localConfigDir -Force | Out-Null }
  Copy-Item $odConfig $localConfig -Force
  Write-Host "📥 OneDrive から設定ファイルを取り込みました（トークン入力不要）" -ForegroundColor Green
} else {
  Write-Host "⚙ 設定ファイルがどこにも無いため、初回セットアップを起動します..." -ForegroundColor Yellow
  & (Join-Path $localSkill "setup-plaud.ps1")
  # 入力後の設定を共有用にOneDriveへ
  if ((Test-Path $localConfig) -and -not (Test-Path $odConfig)) {
    Copy-Item $localConfig $odConfig -Force
    Write-Host "  📤 共有用に OneDrive へ設定ファイルをコピーしました" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "✅ セットアップ完了！このPCで /plaud-html が使えます。" -ForegroundColor Green
Write-Host "   これ以降、どのPCで SKILL.md 等を編集しても OneDrive 経由で全PCに反映されます。" -ForegroundColor Gray
Write-Host ""
Write-Host "【別PCで使うとき】" -ForegroundColor Cyan
Write-Host "   OneDrive 同期完了後、エクスプローラーで次のファイルをダブルクリックするだけ:" -ForegroundColor Gray
Write-Host ("     {0}\claude-skills\setup.cmd" -f $od) -ForegroundColor White
Write-Host "   （PowerShellでの手入力も可: & `"$oneDriveSkill\setup-skill-sync.ps1`"）" -ForegroundColor DarkGray
Write-Host ""
