#Requires -Version 5.1
<#
.SYNOPSIS
  plaud-html スキルが「このPCで使える状態か」を診断する（別PC確認用）
.NOTES
  スキル本体が無くても動くよう、外部依存なしの単体スクリプト。
#>

$claudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$skill = "$claudeHome\skills\plaud-html"
$cfg   = "$env:USERPROFILE\.plaud\plaud-config.json"
$boot  = "$env:OneDrive\claude-skills\setup.cmd"

Write-Host ""
Write-Host "==== Plaud-HTML 別PC診断 ====" -ForegroundColor Cyan
Write-Host ("PC: {0} / User: {1}" -f $env:COMPUTERNAME, $env:USERNAME)
Write-Host ""

# [1] スキル本体
if (Test-Path $skill) {
  $j  = [bool]((Get-Item $skill -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)
  $md = Test-Path (Join-Path $skill 'SKILL.md')
  Write-Host ("[1] スキル本体: ✓ 存在（{0}） / SKILL.md: {1}" -f `
    $(if($j){'ジャンクション'}else{'実フォルダ'}), `
    $(if($md){'✓ あり'}else{'✗ 無い → 認識されない'})) -ForegroundColor $(if($md){'Green'}else{'Red'})
  $dup = Get-ChildItem "$claudeHome\skills" -Directory -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -like 'plaud-html._backup_*' }
  if ($dup) { Write-Host ("    ⚠ バックアップ残存（重複スキル化）: {0}" -f ($dup.Name -join ', ')) -ForegroundColor Yellow }
} else {
  Write-Host "[1] スキル本体: ✗ 無い → /plaud-html コマンド自体が出ません" -ForegroundColor Red
}

# [2] 設定ファイル
Write-Host ("[2] 設定ファイル: {0}" -f `
  $(if(Test-Path $cfg){'✓ あり → そのまま動く'}else{'✗ 無い → 初回setupが必要（STEP0が案内）'})) `
  -ForegroundColor $(if(Test-Path $cfg){'Green'}else{'Yellow'})

# [3] wrangler（デプロイ用）
Write-Host ("[3] wrangler: {0}" -f `
  $(if(Get-Command wrangler -ErrorAction SilentlyContinue){'✓ あり'}else{'✗ 無い（npm i -g wrangler / デプロイ時のみ必要）'}))

# [3.5] node（STEP5.6 横断ページ生成 gen-aux.js 用）
Write-Host ("[3.5] node: {0}" -f `
  $(if(Get-Command node -ErrorAction SilentlyContinue){'✓ あり'}else{'✗ 無い（横断ページ生成に必要。Node.jsを導入）'}))

# [4] OneDrive ワンクリックsetup
Write-Host ("[4] 自動setup（setup.cmd）: {0}" -f `
  $(if(Test-Path $boot){'✓ 使える（ダブルクリックで全自動）'}else{'… OneDrive同期待ちかも'}))

# === 総合判定 ===
Write-Host ""
Write-Host "=== 判定 ===" -ForegroundColor Cyan
if (Test-Path (Join-Path $skill 'SKILL.md')) {
  Write-Host "→ Claude Code を再起動すれば /plaud-html は認識されます。" -ForegroundColor Green
  if (-not (Test-Path $cfg)) {
    Write-Host "→ ただし設定が無いので、初回だけ setup.cmd ダブルクリック（推奨）" -ForegroundColor Yellow
    Write-Host "   または setup-plaud.ps1 を実行してください。" -ForegroundColor Yellow
  } else {
    Write-Host "→ 設定もあるので、再起動後すぐ最後まで動きます。" -ForegroundColor Green
  }
} else {
  Write-Host "→ スキル本体が正しい場所にありません。setup.cmd か手動コピーから始めてください。" -ForegroundColor Red
}
Write-Host ""
