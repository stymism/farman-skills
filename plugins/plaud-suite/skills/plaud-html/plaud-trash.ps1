# 短い録音のゴミ箱（N3・2026-10-29）。既定は「一覧を出すだけ」（何も動かさない）。トークンは画面にも出力にも出さない。
#   一覧だけ : powershell -ExecutionPolicy Bypass -File plaud-trash.ps1
#   ゴミ箱へ : powershell -ExecutionPolicy Bypass -File plaud-trash.ps1 -Apply -FileIds f_xxx,of_yyy   （本人が OK と言った file_id だけ）
#   戻す     : powershell -ExecutionPolicy Bypass -File plaud-trash.ps1 -Restore -FileIds f_xxx
# 境目は plaud_規則.json の short_recording（auto_trash_sec=180・ask_sec=600。本人 10-29「この境目でよい」）。
#   候補 = 長さが auto_trash_sec 未満。ask = auto_trash_sec 以上 ask_sec 未満（自動では何もしない・朝の報告で聞く）。
#   「要約が 300 字未満」の確かめはこの道具ではしない（4.0 の要約の API を使っていない）。会議の取り込みが get_note で見て、一覧の「要約」欄を埋める。
# API（2026-10-29 に新しい Web 画面 beta.plaud.ai の JS〈prod-261027〉から読んだ。まだ 1 度も呼んでいない＝最初の -Apply は 1 件だけで試す）:
#   ゴミ箱へ: DELETE /file-app/v4/nodes/trash   body {"items":[{"node_id":<録音のノード>,"origin_version":<version_ms>}],"enable_move_parent_to_trash":true}
#   戻す    : POST   /file-app/v4/nodes/restore body {"items":[{"node_id":...,"origin_version":...}]}
#   完全に消す（/file-app/v4/nodes/delete）は使わない。ゴミ箱を空にする操作はこの道具に入れない。
# 移した物は %OneDrive%\右腕AI\00_Resources\plaud_ゴミ箱の記録.json に 1 件ずつ残す（file_id・名前・長さ・元のフォルダ・node_id。戻すときに使う）。
param([switch]$Apply, [switch]$Restore, [string[]]$FileIds = @(), [string]$FoldersJson = "$env:TEMP\plaud-trash-folders.json")
$ErrorActionPreference = 'Stop'
$rulesPath = Join-Path $env:OneDrive '右腕AI\00_Resources\plaud_規則.json'
$recordPath = Join-Path $env:OneDrive '右腕AI\00_Resources\plaud_ゴミ箱の記録.json'
$rules = [IO.File]::ReadAllText($rulesPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$autoSec = [int]$rules.short_recording.auto_trash_sec
$askSec = [int]$rules.short_recording.ask_sec

# 1) 一覧を新しくする（plaud-folders.ps1 と同じ読み方。duration_ms・node_id・version_ms が入る）
& (Join-Path $PSScriptRoot 'plaud-folders.ps1') -Out $FoldersJson *> $null
$all = [IO.File]::ReadAllText($FoldersJson, [Text.Encoding]::UTF8) | ConvertFrom-Json
$recs = @($all | Where-Object { $_.duration_ms -gt 0 -and $_.folder -ne 'ようこそ' })
$cand = @($recs | Where-Object { $_.duration_ms -lt $autoSec * 1000 } | Sort-Object duration_ms)
$ask = @($recs | Where-Object { $_.duration_ms -ge $autoSec * 1000 -and $_.duration_ms -lt $askSec * 1000 } | Sort-Object duration_ms)
# サイトに載っている録音（ページの印 meta plaud-file-id。印がまだ無い間は環境変数 PLAUD_FILEID_MAP の対応表でも見る）= 要約がある＝「聞く」側に回す
$site = Join-Path $env:USERPROFILE '.plaud\farman-mtg-site'; $onSite = @{}
if (Test-Path $site) { foreach ($f in Get-ChildItem $site -Filter '2026-*.html') { $m = [regex]::Match([IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8), '<meta\s+name="plaud-file-id"\s+content="([^"]+)"'); if ($m.Success) { $onSite[$m.Groups[1].Value] = $f.Name } } }
if ($env:PLAUD_FILEID_MAP -and (Test-Path $env:PLAUD_FILEID_MAP)) { $mp = [IO.File]::ReadAllText($env:PLAUD_FILEID_MAP, [Text.Encoding]::UTF8) | ConvertFrom-Json; foreach ($p in $mp.PSObject.Properties) { if ($p.Value.file_id) { $onSite[$p.Value.file_id] = $p.Name } } }
function Show($label, $list) {
  Write-Host "$label $($list.Count) 件"
  foreach ($x in $list) { $s = [int]($x.duration_ms / 1000); $note = if ($onSite[$x.file_id]) { "  ※サイトに載っている（$($onSite[$x.file_id])）＝要約あり。おすすめ: 残すだけ" } else { '' }; Write-Host ("  {0}:{1:00}  {2}  {3}  {4}{5}" -f [int][math]::Floor($s / 60), ($s % 60), $x.folder, $x.file_id, $x.name, $note) }
}

if (-not $Apply -and -not $Restore) {
  Show "ゴミ箱の候補（$autoSec 秒未満・要約の長さは会議の取り込みが確かめる）:" $cand
  Show "聞く物（$autoSec〜$askSec 秒・自動では何もしない）:" $ask
  Write-Host "PLAUD_TRASH: LIST candidates=$($cand.Count) ask=$($ask.Count)（何も動かしていない）"
  exit 0
}

if (-not $FileIds.Count) { throw "-FileIds が空。本人が OK と言った file_id を並べる（例: -FileIds f_xxx,of_yyy）" }
# 2) 認証（plaud-folders.ps1 と同じ: ユーザーのトークン → ワークスペースのトークン）
$cfg = Get-Content "$env:USERPROFILE\.plaud\plaud-config.json" -Raw | ConvertFrom-Json
$base = if ($cfg.plaud.api_base) { $cfg.plaud.api_base } else { 'https://api-apne1.plaud.ai' }
$ut = $cfg.plaud.api_token -replace '^Bearer\s+', ''
$wsList = (Invoke-RestMethod -Uri "$base/team-app/workspaces/list" -Headers @{Authorization = "Bearer $ut"} -TimeoutSec 30).data.workspaces
$ws = @($wsList | Where-Object { "$($_.workspace_type)" -eq '0' })[0]; if (-not $ws) { $ws = @($wsList)[0] }
$wt = (Invoke-RestMethod -Method Post -Uri "$base/user-app/auth/workspace/token/$($ws.workspace_id)" -Headers @{Authorization = "Bearer $ut"} -ContentType 'application/json' -Body '{}' -TimeoutSec 30).data.workspace_token
if (-not $wt) { throw "ワークスペースのトークンが取れない" }
$H = @{Authorization = "Bearer $wt"}
$record = @(); if (Test-Path $recordPath) { $record = @([IO.File]::ReadAllText($recordPath, [Text.Encoding]::UTF8) | ConvertFrom-Json) }

if ($Apply) {
  $pick = @($cand | Where-Object { $FileIds -contains $_.file_id })
  $notCand = @($FileIds | Where-Object { -not ($cand.file_id -contains $_) })
  $listed = @($pick | Where-Object { $onSite[$_.file_id] })
  if ($listed.Count) { throw "サイトに載っている録音は移さない（ページが元の録音を失う）: $($listed.file_id -join ', ')" }
  if ($notCand.Count) { throw "候補（$autoSec 秒未満）に無い file_id がある: $($notCand -join ', ')。長い録音はこの道具では移さない" }
  $body = @{ items = @($pick | ForEach-Object { @{ node_id = $_.node_id; origin_version = [int64]$_.version_ms } }); enable_move_parent_to_trash = $true } | ConvertTo-Json -Depth 4 -Compress
  $r = Invoke-RestMethod -Method Delete -Uri "$base/file-app/v4/nodes/trash" -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 30
  if ($r.status -ne 0) { throw "nodes/trash が status $($r.status): $($r.msg)" }
  $failed = @($r.data.failed)
  foreach ($x in $pick) { $record += [pscustomobject]@{ when = (Get-Date -Format 'yyyy-MM-dd HH:mm'); action = 'trash'; file_id = $x.file_id; name = $x.name; duration_ms = $x.duration_ms; folder = $x.folder; node_id = $x.node_id; version_ms = $x.version_ms } }
  [IO.File]::WriteAllText($recordPath, ($record | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
  Write-Host "PLAUD_TRASH: MOVED $($pick.Count - $failed.Count) / failed $($failed.Count)（記録: $recordPath）"
  exit 0
}

if ($Restore) {
  $pick = @($record | Where-Object { $_.action -eq 'trash' -and $FileIds -contains $_.file_id })
  if (-not $pick.Count) { throw "記録にその file_id が無い（$recordPath）" }
  $body = @{ items = @($pick | ForEach-Object { @{ node_id = $_.node_id; origin_version = [int64]$_.version_ms } }) } | ConvertTo-Json -Depth 4 -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/file-app/v4/nodes/restore" -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 30
  if ($r.status -ne 0) { throw "nodes/restore が status $($r.status): $($r.msg)" }
  foreach ($x in $pick) { $record += [pscustomobject]@{ when = (Get-Date -Format 'yyyy-MM-dd HH:mm'); action = 'restore'; file_id = $x.file_id; name = $x.name; duration_ms = $x.duration_ms; folder = $x.folder; node_id = $x.node_id; version_ms = $x.version_ms } }
  [IO.File]::WriteAllText($recordPath, ($record | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
  Write-Host "PLAUD_TRASH: RESTORED $($pick.Count)（記録: $recordPath）"
}
