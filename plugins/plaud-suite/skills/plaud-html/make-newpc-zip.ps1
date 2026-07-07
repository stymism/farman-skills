#Requires -Version 5.1
# Build plaud-newpc-setup.zip on a working PC.
# ZIP = SETUP.cmd + setup-newpc.ps1 + README.txt + plaud-config.json (secrets!)
# Output: user's Documents folder. Share only via private, access-controlled means.

$ErrorActionPreference = 'Stop'

$cfg = "$env:USERPROFILE\.plaud\plaud-config.json"
if (-not (Test-Path $cfg)) {
  Write-Host "[NG] $cfg not found. Run this on a working PC." -ForegroundColor Red
  exit 1
}

$docs = [Environment]::GetFolderPath('MyDocuments')
$out = Join-Path $docs "plaud-newpc-setup.zip"
$stage = Join-Path $env:TEMP "plaud-newpc-zip"

if (Test-Path $stage) { [System.IO.Directory]::Delete($stage, $true) }
New-Item -ItemType Directory $stage | Out-Null

Copy-Item (Join-Path $PSScriptRoot "setup-newpc.cmd") (Join-Path $stage "SETUP.cmd")
Copy-Item (Join-Path $PSScriptRoot "setup-newpc.ps1") (Join-Path $stage "setup-newpc.ps1")
Copy-Item (Join-Path $PSScriptRoot "newpc-README.txt") (Join-Path $stage "README.txt")
Copy-Item $cfg (Join-Path $stage "plaud-config.json")

if (Test-Path $out) { [System.IO.File]::Delete($out) }
Compress-Archive -Path "$stage\*" -DestinationPath $out
[System.IO.Directory]::Delete($stage, $true)

$kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "OK: $out ($kb KB)" -ForegroundColor Green
Write-Host "NOTE: contains secrets (tokens/password). Share privately only." -ForegroundColor Yellow
