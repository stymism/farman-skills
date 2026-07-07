#Requires -Version 5.1
<#
.SYNOPSIS
  Plaud REST APIトークンを email+password から自動再取得し、設定ファイル3箇所を更新する。
.DESCRIPTION
  仕組み（web.plaud.ai のログイン通信を再現）：
    POST {api_base}/auth/access-token  (multipart/form-data)
      username=<email> / password=<平文> / client_id=web / password_encrypted=false
    → 成功時 Set-Cookie の `pld_ut`（JWT）が新トークン。"Bearer <jwt>" を保存。
  更新先：~/.plaud/plaud-config.json（存在すれば <OneDrive>\claude-skills\plaud-config.json も）
.NOTES
  - email/password は config の plaud.email / plaud.password を使用（setup-plaud.ps1 で設定）。
  - ログインは Plaud 側で 1時間あたり10回の制限あり。失効時のみ呼ぶこと。
  - 戻り値：成功で exit 0、失敗で exit 1。
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$cfgPath = "$env:USERPROFILE\.plaud\plaud-config.json"
if (-not (Test-Path $cfgPath)) { Write-Host "❌ 設定ファイルなし: $cfgPath" -ForegroundColor Red; exit 1 }
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$email = $cfg.plaud.email
$pw    = $cfg.plaud.password
$base  = $cfg.plaud.api_base
if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($pw)) {
  Write-Host "❌ plaud.email / plaud.password が未設定です。setup-plaud.ps1 で設定してください。" -ForegroundColor Red
  Write-Host "   （自動トークン取得にはログイン情報の保存が必要です）" -ForegroundColor Yellow
  exit 1
}

# --- ログイン（multipart, 平文パスワード, password_encrypted=false）---
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
$handler.UseCookies = $true
$handler.CookieContainer = New-Object System.Net.CookieContainer
$client = New-Object System.Net.Http.HttpClient($handler)
$client.DefaultRequestHeaders.Add('app-platform','web')
$client.DefaultRequestHeaders.Add('app-language','ja')
$client.DefaultRequestHeaders.Add('edit-from','web')

$form = New-Object System.Net.Http.MultipartFormDataContent
$form.Add((New-Object System.Net.Http.StringContent($email)),'username')
$form.Add((New-Object System.Net.Http.StringContent($pw)),'password')
$form.Add((New-Object System.Net.Http.StringContent('web')),'client_id')
$form.Add((New-Object System.Net.Http.StringContent('false')),'password_encrypted')

try {
  $resp = $client.PostAsync("$base/auth/access-token", $form).Result
  $rj = $resp.Content.ReadAsStringAsync().Result | ConvertFrom-Json
} catch {
  Write-Host "❌ ログインリクエスト失敗: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
if ($rj.status -ne 0) {
  Write-Host ("❌ ログイン失敗: status={0} msg={1}" -f $rj.status, $rj.msg) -ForegroundColor Red
  Write-Host "   （パスワード誤り or 1時間あたりのログイン回数上限の可能性。少し待って再試行）" -ForegroundColor Yellow
  exit 1
}
$jwt = ($handler.CookieContainer.GetCookies([uri]"$base/") | Where-Object { $_.Name -eq 'pld_ut' }).Value
if ([string]::IsNullOrWhiteSpace($jwt)) {
  Write-Host "❌ pld_ut クッキー（トークン）が取得できませんでした。" -ForegroundColor Red
  exit 1
}
$newToken = "Bearer $jwt"

# --- 設定3箇所を更新 ---
$updated = @()
foreach ($cf in @("$env:USERPROFILE\.plaud\plaud-config.json", "$env:OneDrive\claude-skills\plaud-config.json")) {
  if (Test-Path $cf) {
    $c = Get-Content $cf -Raw | ConvertFrom-Json
    $c.plaud.api_token = $newToken
    $c | ConvertTo-Json -Depth 10 | Set-Content $cf -Encoding UTF8
    $updated += (Split-Path $cf -Leaf) + '@' + (Split-Path (Split-Path $cf) -Leaf)
  }
}
# （配布ZIP更新は廃止 — 2026-07-07。スキル配布はGitHubマーケットプレイスに移行）

# --- 有効期限を表示 ---
$payload = $jwt.Split('.')[1]
$padLen = (4 - $payload.Length % 4) % 4
$padded = $payload.PadRight($payload.Length + $padLen, '=').Replace('-','+').Replace('_','/')
$exp = [DateTimeOffset]::FromUnixTimeSeconds([int64](([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($padded)) | ConvertFrom-Json).exp)).ToLocalTime()
Write-Host ("✅ トークン自動再取得・更新完了（{0}箇所: {1}）" -f $updated.Count, ($updated -join ', ')) -ForegroundColor Green
Write-Host ("   有効期限: {0}（あと約{1}時間）" -f $exp, [math]::Round(($exp-(Get-Date)).TotalHours,1)) -ForegroundColor Green
