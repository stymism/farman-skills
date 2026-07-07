#Requires -Version 5.1
<#
.SYNOPSIS
  Plaud-HTML スキル ポータブルインストーラ
  （OneDriveアカウントが異なるPC向け。ZIPを展開してこれを実行するだけ）
.DESCRIPTION
  - スキル本体   → ~/.claude/skills/plaud-html（CLAUDE_CONFIG_DIR設定PCではそのフォルダ配下）
  - 設定ファイル → ~/.plaud/plaud-config.json（トークン入り）
  - 作業データ   → このPCの実パスへ展開し、work_dir をそのパスに自動書き換え
#>

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Test-IsJunction($p){
  if (-not (Test-Path $p)) { return $false }
  [bool]((Get-Item $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)
}

Write-Host ""
Write-Host "==== Plaud-HTML インストール ====" -ForegroundColor Cyan
Write-Host ("PC: {0} / User: {1}" -f $env:COMPUTERNAME, $env:USERNAME)
Write-Host ""

# 1. スキル本体
$claudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$skillDst = "$claudeHome\skills\plaud-html"
New-Item -ItemType Directory (Split-Path $skillDst) -Force | Out-Null
if (Test-Path $skillDst) {
  if (Test-IsJunction $skillDst) {
    cmd /c rmdir "$skillDst" | Out-Null   # ジャンクションは参照だけ外す
  } else {
    $bak = "$env:USERPROFILE\plaud-html-old-{0}" -f (Get-Date -Format yyyyMMdd_HHmmss)
    Move-Item $skillDst $bak               # 既存コピーは skills の外へ退避（重複スキル回避）
    Write-Host ("  既存スキルを退避: {0}" -f $bak) -ForegroundColor DarkGray
  }
}
New-Item -ItemType Directory $skillDst -Force | Out-Null
Copy-Item "$root\skill\*" $skillDst -Recurse -Force
Write-Host "[1] スキル本体: ✓ 配置 ($skillDst)" -ForegroundColor Green

# 2. 設定ファイル（トークン入り）
$cfgDir = "$env:USERPROFILE\.plaud"
$cfgDst = "$cfgDir\plaud-config.json"
New-Item -ItemType Directory $cfgDir -Force | Out-Null
Copy-Item "$root\plaud-config.json" $cfgDst -Force
Write-Host "[2] 設定ファイル: ✓ 配置" -ForegroundColor Green

# 3. 作業データ → このPCの実パスへ展開し work_dir を書き換え
if ($env:OneDrive -and (Test-Path $env:OneDrive)) {
  $wsDst = "$env:OneDrive\plaud_summaries"
} else {
  $wsDst = "$env:USERPROFILE\Documents\plaud_summaries"
}
New-Item -ItemType Directory $wsDst -Force | Out-Null
Copy-Item "$root\plaud_summaries\*" $wsDst -Recurse -Force
$conf = Get-Content $cfgDst -Raw | ConvertFrom-Json
$conf.paths.work_dir = $wsDst
$conf | ConvertTo-Json -Depth 10 | Set-Content $cfgDst -Encoding UTF8
Write-Host ("[3] 作業データ: ✓ 配置 + work_dir設定 ($wsDst)") -ForegroundColor Green

# 4. wrangler
if (Get-Command wrangler -ErrorAction SilentlyContinue) {
  Write-Host "[4] wrangler: ✓ 導入済み" -ForegroundColor Green
} else {
  Write-Host "[4] wrangler: ✗ 未導入（デプロイを使うなら: npm install -g wrangler）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ インストール完了！" -ForegroundColor Green
Write-Host "   1) Claude Code を再起動してください" -ForegroundColor Gray
Write-Host "   2) /plaud-html を実行" -ForegroundColor Gray
Write-Host "   ※ Plaud / Asana は同じ Claude アカウントでログインしていれば自動で使えます。" -ForegroundColor Gray
Write-Host ""
