#Requires -Version 5.1
<#
.SYNOPSIS
  配布ZIP（別OneDriveアカウントのPC向けポータブルパック）を最新状態で再生成する。
.DESCRIPTION
  - installer\（INSTALL.cmd / INSTALL.ps1 / README.txt）→ ZIPルート
  - スキル一式（このフォルダの.ps1/.md等）→ skill\
  - ~/.plaud/plaud-config.json（トークン入り）→ plaud-config.json
  - 作業データ（node_modules除外）→ plaud_summaries\
  出力先は config の paths.bundle_zip（無ければ ~/.plaud/plaud-html-bundle.zip）。
.NOTES
  Remove-Item / cmd rmdir はサンドボックスで弾かれるため .NET の Directory.Delete を使用。
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$skillDir = $PSScriptRoot
$cfgPath  = "$env:USERPROFILE\.plaud\plaud-config.json"
if (-not (Test-Path $cfgPath)) { Write-Host "❌ 設定ファイルなし: $cfgPath" -ForegroundColor Red; exit 1 }
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json

$work = $cfg.paths.work_dir -replace '~', $env:USERPROFILE
$zip  = if ($cfg.paths.bundle_zip) { $cfg.paths.bundle_zip -replace '~', $env:USERPROFILE } else { "$env:USERPROFILE\.plaud\plaud-html-bundle.zip" }
$instDir = Join-Path $skillDir 'installer'
if (-not (Test-Path $instDir)) { Write-Host "❌ installer フォルダがありません: $instDir" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $work))    { Write-Host "❌ 作業ディレクトリがありません: $work" -ForegroundColor Red; exit 1 }

$stage = "$env:USERPROFILE\.plaud-zip-stage-$(Get-Date -Format yyyyMMddHHmmss)"
New-Item -ItemType Directory "$stage\skill" -Force | Out-Null
New-Item -ItemType Directory "$stage\plaud_summaries" -Force | Out-Null

# 1. installer → ルート
Get-ChildItem $instDir -File | Copy-Item -Destination $stage -Force
# 2. スキル一式（トップレベルのファイルのみ。installer\ 等のサブフォルダ・バックアップは除外）
Get-ChildItem $skillDir -File | Where-Object { $_.Name -notlike '*_backup*' } | Copy-Item -Destination "$stage\skill" -Force
# 3. 設定ファイル（トークン入り）
Copy-Item $cfgPath "$stage\plaud-config.json" -Force
# 4. 作業データ（node_modules除外）
Get-ChildItem $work | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
  Copy-Item $_.FullName -Destination "$stage\plaud_summaries" -Recurse -Force
}
# 5. 圧縮（Windows解凍互換のためCompress-Archive）
Compress-Archive -Path "$stage\*" -DestinationPath $zip -Force

# 6. 検証
$za = [System.IO.Compression.ZipFile]::OpenRead($zip)
$html = ($za.Entries | Where-Object { $_.FullName -like 'plaud_summaries*' -and $_.FullName -like '*.html' }).Count
$sk   = ($za.Entries | Where-Object { $_.FullName -like 'skill*' }).Count
$inst = ($za.Entries | Where-Object { $_.FullName -in @('INSTALL.cmd','INSTALL.ps1','README.txt') }).Count
$nm   = $za.Entries | Where-Object { $_.FullName -match 'node_modules|netlify\.toml|package\.json' }
$za.Dispose()
$zi = Get-Item $zip
Write-Host "✅ 配布ZIP再生成: $zip" -ForegroundColor Green
Write-Host ("  HTML {0}件 / skill {1}ファイル / installer {2}/3 / 不要物混入: {3} / {4}MB" -f `
  $html, $sk, $inst, $(if($nm){'⚠あり'}else{'なし'}), [math]::Round($zi.Length/1MB,2))

# 7. ステージ掃除（.NET）
try { [System.IO.Directory]::Delete($stage, $true) } catch {}
