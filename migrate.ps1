# migrate.ps1 - one-liner migration to farman-skills plugins
#
#   irm https://raw.githubusercontent.com/stymism/farman-skills/main/migrate.ps1 | iex
#
# What it does (idempotent, safe to re-run):
#   1. finds Claude Code CLI
#   2. removes the old junction/copy of plaud-html from the skills folder
#   3. registers the farman-skills marketplace (adds or updates)
#   4. installs plaud-suite / farman-tools / design-suite
#   5. checks that ~/.plaud/plaud-config.json exists (needed by plaud-html)
# No secrets inside. Works on any PC with internet - no OneDrive dependency.

$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "=== farman-skills : migrate to plugins ===" -ForegroundColor Cyan
Write-Host ""

# --- [1/5] locate claude CLI -------------------------------------------------
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if ($claudeCmd) {
    $claude = $claudeCmd.Source
} elseif (Test-Path "$env:USERPROFILE\.local\bin\claude.exe") {
    $claude = "$env:USERPROFILE\.local\bin\claude.exe"
} else {
    Write-Host "[NG] Claude Code CLI not found on this PC." -ForegroundColor Red
    Write-Host "     Install Claude Code first, then run this one-liner again." -ForegroundColor Yellow
    return
}
Write-Host "[1/5] claude CLI: $claude" -ForegroundColor Green

# --- [2/5] remove old junction/copy of plaud-html ----------------------------
$homes = @()
if ($env:CLAUDE_CONFIG_DIR) { $homes += $env:CLAUDE_CONFIG_DIR }
$homes += "$env:USERPROFILE\.claude-code"
$homes += "$env:USERPROFILE\.claude"
$removed = $false
foreach ($h in $homes) {
    $p = Join-Path $h "skills\plaud-html"
    if (Test-Path $p) {
        $item = Get-Item $p -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            cmd /c rmdir "$p"
            Write-Host "[2/5] removed junction: $p" -ForegroundColor Green
        } else {
            $bak = "$p.pre-plugin-backup"
            if (Test-Path $bak) { Remove-Item $bak -Recurse -Force }
            Rename-Item $p $bak
            Write-Host "[2/5] old skill folder kept as backup: $bak" -ForegroundColor Yellow
        }
        $removed = $true
    }
}
if (-not $removed) { Write-Host "[2/5] no old plaud-html found (already clean)" -ForegroundColor Green }

# --- [3/5] register marketplace ----------------------------------------------
$mpList = & $claude plugin marketplace list 2>&1 | Out-String
if ($mpList -match 'farman-skills') {
    Write-Host "[3/5] marketplace already registered - updating..." -ForegroundColor Green
    & $claude plugin marketplace update farman-skills 2>&1 | Select-Object -Last 1
} else {
    Write-Host "[3/5] adding marketplace stymism/farman-skills ..." -ForegroundColor Cyan
    & $claude plugin marketplace add stymism/farman-skills 2>&1 | Select-Object -Last 1
}

# --- [4/5] install plugins -----------------------------------------------------
$plList = & $claude plugin list 2>&1 | Out-String
foreach ($p in @('plaud-suite','farman-tools','design-suite')) {
    if ($plList -match [regex]::Escape("$p@farman-skills")) {
        Write-Host "[4/5] $p : already installed" -ForegroundColor Green
    } else {
        Write-Host "[4/5] installing $p ..." -ForegroundColor Cyan
        & $claude plugin install "$p@farman-skills" 2>&1 | Select-Object -Last 1
    }
}

# --- [5/5] plaud config check ---------------------------------------------------
$cfgLocal = "$env:USERPROFILE\.plaud\plaud-config.json"
if (Test-Path $cfgLocal) {
    Write-Host "[5/5] plaud config: OK ($cfgLocal)" -ForegroundColor Green
} else {
    Write-Host "[5/5] plaud config: NOT found." -ForegroundColor Yellow
    Write-Host "      plaud-html needs ~/.plaud/plaud-config.json (tokens/paths)." -ForegroundColor Yellow
    Write-Host "      Copy it from a working PC, or run the plaud-html setup flow later." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DONE. Restart Claude Code on this PC to load the plugins. ===" -ForegroundColor Cyan
Write-Host "    (skills appear as plaud-suite:plaud-html etc.)"
Write-Host ""
