#Requires -Version 5.1
<#
.SYNOPSIS
  index.html の一覧カウント（全件/社内/社外/講話録音 と「N件表示中」）を
  実在カードから数え直して修復する。
.DESCRIPTION
  - カードを data-type で実数カウント
  - 4つの <strong data-count> をラベル基準で更新（属性値＋表示テキストの両方）
    → カウントアップJSが壊れていても数字が表示されるようにする
  - filter-count（N件表示中）も更新
  作業ディレクトリは ~/.plaud/plaud-config.json の paths.work_dir から解決。
#>

$ErrorActionPreference = 'Stop'

# 作業ディレクトリ解決
$cfgPath = "$env:USERPROFILE\.plaud\plaud-config.json"
if (-not (Test-Path $cfgPath)) { Write-Host "❌ 設定ファイルなし: $cfgPath" -ForegroundColor Red; exit 1 }
$work = (Get-Content $cfgPath -Raw | ConvertFrom-Json).paths.work_dir -replace '~', $env:USERPROFILE
$f = Join-Path $work "index.html"
if (-not (Test-Path $f)) { Write-Host "❌ index.htmlが見つからない: $f" -ForegroundColor Red; exit 1 }

# UTF-8(BOMなし)で読込
$html = [System.IO.File]::ReadAllText($f, [System.Text.UTF8Encoding]::new($false))

# カード実数カウント
$total    = ([regex]::Matches($html, 'class="mtg-card')).Count
$internal = ([regex]::Matches($html, 'data-type="internal"')).Count
$external = ([regex]::Matches($html, 'data-type="external"')).Count
$kowa     = ([regex]::Matches($html, 'data-type="kowa"')).Count

Write-Host ("実在カード: 全{0} / 社内{1} / 社外{2} / 講話{3}（内訳合計={4}）" -f `
  $total, $internal, $external, $kowa, ($internal + $external + $kowa)) -ForegroundColor Cyan

# 各 <strong data-count> をラベル基準で更新（属性値＋表示テキスト両方）
$pairs = @(@('全件',$total), @('社内',$internal), @('社外',$external), @('講話録音',$kowa))
$failed = @()
foreach ($p in $pairs) {
  $label = $p[0]; $n = [string]$p[1]
  $pat = '(<strong data-count=")\d+(">)\d*(</strong>\s*' + [regex]::Escape($label) + ')'
  if ([regex]::IsMatch($html, $pat)) {
    $html = [regex]::Replace($html, $pat, ('${1}' + $n + '${2}' + $n + '${3}'))
  } else { $failed += $label }
}

# filter-count（N件表示中）
$fcPat = '(<span class="filter-count" id="count">)\d+(件表示中</span>)'
if ([regex]::IsMatch($html, $fcPat)) {
  $html = [regex]::Replace($html, $fcPat, ('${1}' + [string]$total + '${2}'))
} else { $failed += 'filter-count(N件表示中)' }

# 保存（UTF-8 BOMなし）
[System.IO.File]::WriteAllText($f, $html, [System.Text.UTF8Encoding]::new($false))

if ($failed.Count -gt 0) {
  Write-Host ("⚠ 次の要素が見つからず未修復（HTML構造が壊れている可能性）: {0}" -f ($failed -join ', ')) -ForegroundColor Yellow
  Write-Host "  → その箇所はマスターPCの index.html から該当行をコピーして復元してください。" -ForegroundColor Yellow
} else {
  Write-Host "✅ カウント修復完了（全件/社内/社外/講話録音 + N件表示中）" -ForegroundColor Green
}
Write-Host ("対象: {0}" -f $f) -ForegroundColor Gray
Write-Host "※ ブラウザは Ctrl+F5（強制再読込）で確認してください。" -ForegroundColor Gray
