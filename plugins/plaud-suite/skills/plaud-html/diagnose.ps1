#Requires -Version 5.1
<#
.SYNOPSIS
  plaud-html スキルが「このPCで使える状態か」を診断する（プラグイン配布版）
.NOTES
  スキル本体が無くても動くよう、外部依存なしの単体スクリプト。
#>

$cfg = "$env:USERPROFILE\.plaud\plaud-config.json"

Write-Host ""
Write-Host "==== Plaud-HTML 診断（プラグイン版） ====" -ForegroundColor Cyan
Write-Host ("PC: {0} / User: {1}" -f $env:COMPUTERNAME, $env:USERNAME)
Write-Host ""

# [1] プラグイン導入状況
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
$claude = if ($claudeCmd) { $claudeCmd.Source } elseif (Test-Path "$env:USERPROFILE\.local\bin\claude.exe") { "$env:USERPROFILE\.local\bin\claude.exe" } else { $null }
if ($claude) {
  $pl = & $claude plugin list 2>&1 | Out-String
  if ($pl -match 'plaud-suite@farman-skills') {
    Write-Host "[1] plaud-suite プラグイン: ✓ 導入済み" -ForegroundColor Green
  } else {
    Write-Host "[1] plaud-suite プラグイン: ✗ 未導入" -ForegroundColor Red
    Write-Host "    → PowerShellで1行実行:" -ForegroundColor Yellow
    Write-Host "      irm https://raw.githubusercontent.com/stymism/farman-skills/main/migrate.ps1 | iex" -ForegroundColor Yellow
  }
} else {
  Write-Host "[1] Claude Code CLI: ✗ 見つからない → Claude Code を先にインストール" -ForegroundColor Red
}

# [2] 設定ファイル
Write-Host ("[2] 設定ファイル: {0}" -f `
  $(if(Test-Path $cfg){'✓ あり → そのまま動く'}else{'✗ 無い → 動作中PCからコピー or setup-plaud.ps1（STEP0が案内）'})) `
  -ForegroundColor $(if(Test-Path $cfg){'Green'}else{'Yellow'})

# [3] git（STEP7 デプロイ = サイトrepoへのpush 用）
Write-Host ("[3] git: {0}" -f `
  $(if(Get-Command git -ErrorAction SilentlyContinue){'✓ あり'}else{'✗ 無い（git-scm.com から導入。デプロイ時のみ必要）'}))

# [3.5] node（STEP5.6 横断ページ生成 gen-aux.js 用）
Write-Host ("[3.5] node: {0}" -f `
  $(if(Get-Command node -ErrorAction SilentlyContinue){'✓ あり'}else{'✗ 無い（横断ページ生成に必要。Node.jsを導入）'}))

# === 総合判定 ===
Write-Host ""
Write-Host "=== 判定 ===" -ForegroundColor Cyan
if ($claude -and ($pl -match 'plaud-suite@farman-skills')) {
  if (Test-Path $cfg) {
    Write-Host "→ プラグイン・設定ともOK。/plaud-html はすぐ最後まで動きます。" -ForegroundColor Green
  } else {
    Write-Host "→ プラグインはOK。設定ファイルだけ用意すれば動きます（上記[2]参照）。" -ForegroundColor Yellow
  }
} else {
  Write-Host "→ まず上記[1]の1行コマンドでプラグインを導入し、Claude Code を再起動してください。" -ForegroundColor Red
}
Write-Host ""
