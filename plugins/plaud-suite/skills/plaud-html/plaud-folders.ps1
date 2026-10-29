# Plaud 4.0（2026-10 移行）のフォルダ判定。録音ごとに「どのフォルダか」を JSON に書き出す（トークンは画面にも出力にも出さない）。
#   powershell -ExecutionPolicy Bypass -File plaud-folders.ps1 [-Out <出力 JSON>]
#   出力: [{ file_id, name, folder, start_ms }]。folder はライブラリ直下のフォルダ名（社内・社外・講話録音・面接 など）。
#         未振り分けの録音（システムの「Recordings」＝画面の「録音」）は folder="未振り分け"。
# 流れ: plaud-config.json の api_token（ユーザーのトークン）→ 失効なら refresh-plaud-token.ps1 →
#       POST /user-app/auth/workspace/token/{ws}（ワークスペースのトークン）→ GET /file-app/v4/folders/children をたどる。
# 旧 API（/file/simple/web・filetag_id_list）は 4.0 移行後 status -1800907「Account migrated to 4.0」で 0 件になる（2026-10-29）。
param([string]$Out = "$env:TEMP\plaud-folders.json")
$ErrorActionPreference = 'Stop'
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$cfg = Get-Content $configPath -Raw | ConvertFrom-Json
$base = if ($cfg.plaud.api_base) { $cfg.plaud.api_base } else { 'https://api-apne1.plaud.ai' }

function Get-UserToken {
  $t = $script:cfg.plaud.api_token -replace '^Bearer\s+',''
  return $t
}
function Get-Workspaces($ut) {
  return (Invoke-RestMethod -Uri "$base/team-app/workspaces/list" -Headers @{Authorization = "Bearer $ut"} -TimeoutSec 30).data.workspaces
}

$ut = Get-UserToken
try { $wsList = Get-Workspaces $ut } catch { $wsList = $null }
if (-not $wsList) {
  # 失効など: email/password から取り直して、もう一度
  & (Join-Path $PSScriptRoot 'refresh-plaud-token.ps1') *> $null
  $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
  $ut = Get-UserToken
  $wsList = Get-Workspaces $ut
}
# 個人ワークスペース（workspace_type 0）を先に。無ければ先頭
$ws = @($wsList | Where-Object { "$($_.workspace_type)" -eq '0' })[0]
if (-not $ws) { $ws = @($wsList)[0] }
$mint = Invoke-RestMethod -Method Post -Uri "$base/user-app/auth/workspace/token/$($ws.workspace_id)" -Headers @{Authorization = "Bearer $ut"} -ContentType 'application/json' -Body '{}' -TimeoutSec 30
$wt = $mint.data.workspace_token
if (-not $wt) { throw "ワークスペースのトークンが取れない（mint の返事に workspace_token が無い）" }
$H = @{Authorization = "Bearer $wt"}

function Get-Children([string]$nodeId) {
  $items = @(); $cur = ''
  for ($i = 0; $i -lt 50; $i++) {
    $u = "$base/file-app/v4/folders/children?node_id=$([uri]::EscapeDataString($nodeId))"
    if ($cur) { $u += "&cursor=$([uri]::EscapeDataString($cur))" }
    $r = Invoke-RestMethod -Uri $u -Headers $H -TimeoutSec 30
    if ($r.status -ne 0) { throw "folders/children が status $($r.status): $($r.msg)" }
    $items += @($r.data.items)
    $cur = $r.data.next_cursor
    if (-not $cur) { break }
  }
  return $items
}
# 録音 1 件は「名前のついた入れ物のノード」の下に file_id を持つノードが 1 つある形（2026-10-29 実測）。中まで降りて file_id を拾う
function Get-Files([string]$nodeId, [int]$depth) {
  $out = @()
  foreach ($c in (Get-Children $nodeId)) {
    if ($c.file_id) { $out += [pscustomobject]@{ file_id = $c.file_id; name = $c.name; start_ms = $c.created_at_show_ms } }
    elseif ($c.child_count -gt 0 -and $depth -lt 3) {
      $sub = Get-Files $c.node_id ($depth + 1)
      foreach ($s in $sub) { if (-not $s.name -or $s.name -eq '') { $s.name = $c.name }; if (-not $s.start_ms) { $s.start_ms = $c.created_at_show_ms } }
      $out += $sub
    }
  }
  return $out
}

$result = @()
foreach ($f in (Get-Children 'root' | Where-Object { $_.type -eq 1 })) {
  $folder = switch ([int]$f.system_folder_type) { 1 { '未振り分け' } 2 { 'インポート' } 6 { 'ようこそ' } default { $f.name } }
  foreach ($x in (Get-Files $f.node_id 0)) { $result += [pscustomobject]@{ file_id = $x.file_id; name = $x.name; folder = $folder; start_ms = $x.start_ms } }
}
$result | ConvertTo-Json -Depth 4 | Set-Content -Path $Out -Encoding utf8
$byFolder = $result | Group-Object folder | ForEach-Object { "$($_.Name) $($_.Count)" }
Write-Host ("PLAUD_FOLDERS: OK files=" + $result.Count + " | " + ($byFolder -join ' / ') + " | out=" + $Out)
