﻿#Requires -Version 5.1
<#
.SYNOPSIS
  index.html と横断ページを gen-aux.js で作り直す（2026-10-29〜）。
.DESCRIPTION
  index.html は gen-aux.js が会議ページ（2026-*.html）からまるごと作る形になったので、
  数（全件・社内・社外・講話録音・N件表示中）が合わないときは作り直せば直る。
  前の版（数だけを書き換える物）は使わない。
  作業ディレクトリは ~/.plaud/plaud-config.json の paths.work_dir から決める。
#>

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$cfgPath = "$env:USERPROFILE\.plaud\plaud-config.json"
if (-not (Test-Path $cfgPath)) { Write-Host "設定ファイルが無い: $cfgPath" -ForegroundColor Red; exit 1 }
$work = (Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json).paths.work_dir -replace '~', $env:USERPROFILE
if (-not (Test-Path $work)) { Write-Host "作業ディレクトリが無い: $work" -ForegroundColor Red; exit 1 }

$gen = Join-Path $PSScriptRoot 'gen-aux.js'
if (-not (Test-Path $gen)) { Write-Host "gen-aux.js が無い: $gen" -ForegroundColor Red; exit 1 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "node が無い（Node.js を入れてください）" -ForegroundColor Red; exit 1 }

& node $gen $work
if ($LASTEXITCODE -ne 0) { Write-Host "gen-aux.js が失敗した（上の表示を見る）" -ForegroundColor Red; exit 1 }
Write-Host "作り直した: $work\index.html ほか（ブラウザは Ctrl+F5 で読み直す）" -ForegroundColor Green
