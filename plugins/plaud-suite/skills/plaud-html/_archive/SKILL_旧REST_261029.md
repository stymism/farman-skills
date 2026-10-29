# plaud-html 旧 REST の手順（2026-10-29 に SKILL.md から移した記録）

> なぜ移したか: Plaud が 2026-10 に 4.0 へ移り、旧 API（`/file/simple/web` の `filetag_id_list`・`/file/detail/{id}`）は `status -1800907`「Account migrated to 4.0」で 0 件になった。フォルダは `plaud-folders.ps1`（`/file-app/v4/folders/children`）で読む。STEP 1-0（MCP がフォルダ情報を返すかの毎回の点検）も、4.0 の API でフォルダが読めるようになったので要らない。照合は題名・日付でなく file_id（A-6）。
> 今の手順は SKILL.md の「既知の制約」「STEP 1〜3」。ここは読むだけの記録で、手順として使わない。フォルダ ID（internal c350…・external dd2c…・kowa 5010…・mensetsu 7e78…）は 4.0 で無効。

---

## （旧）既知の制約の REST の部分（SKILL.md 88〜99・113〜117 行）

### ⚠️ 既知の制約

### Plaud MCP のフォルダフィルタリング非対応（毎回チェック → 対応され次第RESTを廃止）

**2026-08-10 再実測（2026-07-06 / 2026-07-28 から変化なし）：**
- `list_files` のスキーマに `folder_id` パラメータは**存在しない**（入力は `query`/`date_from`/`date_to`/`page`/`page_size` のみ）
- `list_files`・`get_file` のレスポンスにもフォルダ情報（`filetag_id_list` 等）は**含まれない**（各件 `id`/`name`/`created_at`/`serial_number`/`start_at`/`duration` ＋ get_fileは `presigned_url`/`source_list`/`note_list`）
- MCPの認証はOAuth（`login` ツール）で自前処理されるため、**トークンが必要なのはフォルダ判定のRESTだけ**
- `page_size` は**下限10**。`page_size=5` 等を渡すと `Input should be greater than or equal to 10` で失敗する

**→ 現状はフォルダ判定のみ Plaud REST API で `filetag_id_list` を参照する（下記 STEP 1 参照）。ただし毎回 STEP 1-0 のチェックを先に行うこと：**


**STEP 1-0（毎回実行）: 公式MCPのフォルダ対応チェック**
1. `mcp__plaud__list_files`（プラグイン環境では `mcp__plugin_plaud-suite_plaud__list_files`。存在する方を使う）を1ページ（page_size=10）呼び、レスポンスの各アイテムに `filetag_id_list`・`filetag`・`folder` 等のフォルダ情報フィールドが**含まれるか**を確認する（あわせて `list_files` スキーマに `folder_id` パラメータが追加されていないかも見る）
2. **含まれる場合（対応済み）**: フォルダ判定はMCPレスポンスの値で行い、REST API呼び出しとトークン自動リフレッシュを**スキップ**する。そのうえで、本SKILL.mdからREST依存部分（トークンリフレッシュ・REST判定）を更新・削除し、README.md に変更履歴を追記して、「Plaudトークンが不要になった」ことをユーザーに報告する（`plaud-config.json` の `plaud.api_token`/`email`/`password` は不要になる。Cloudflare設定は引き続き必要）
3. **含まれない場合（未対応）**: 従来どおりトークン自動チェック→REST APIでのフォルダ判定に進む。完了報告に記載は不要（チェック自体は静かに行う）


## （旧）MCP が Not authenticated のときの REST の代わり（SKILL.md 125〜131 行）

3. **ログインできない／ユーザー不在で進めたい場合のフォールバック（実績あり）**: 議事録本文は `get_note` を使わず REST で取れる。
   ```
   GET {api_base}/file/detail/{file_id}   （Authorization: {api_token}）
     → data.content_list[] から data_type == 'auto_sum_note' を選ぶ
     → その data_link（S3署名付きURL・有効5分）を GET すると AI要約Markdownが返る
   ```
   ⚠️ `data_link` の実体は `ai_content.md.gz` だが **`Invoke-WebRequest` が gzip を自動解凍する**ため、`GzipStream` に通すと `The magic number in GZip header is not correct` で落ちる。**先頭2バイトが `0x1F 0x8B` の時だけ解凍し、それ以外はそのままUTF-8デコードする**分岐を入れること。

## （旧）get_file の代わりに REST の一覧から長さを取る（SKILL.md 133〜135 行）

### ⚠️ `get_file` はトランスクリプト全文を返す（呼ぶな・2026-07-28 追記）
`get_file` のレスポンスは**20万文字規模**（実測206,078文字）になり、トークン上限を超えてツール結果がファイルに退避される。**duration等のメタ情報のために `get_file` を呼んではいけない。**
→ **duration・filename・start_time は STEP 1 の REST 一覧（`/file/simple/web`）に全て含まれている**ので、そこから取る（`duration` はミリ秒）。

## （旧）STEP 1〜3（SKILL.md 323〜485 行・2026-10-29 まで）

### STEP 1: 未HTML化の議事録を特定する（Plaud REST API で社内/社外を自動判定）

**前提：Plaud Web上でのフォルダ振り分けは事前に完了しているものとする。**

**⓪' 4.0 移行後（2026-10-29〜）は、下の REST 一覧の代わりに `plaud-folders.ps1` でフォルダを読む（既知の制約「✅ Plaud 4.0 移行後のフォルダ判定」）。下の `/file/simple/web` の手順は旧 API の記録として残す（-1800907 が返る）。**

**⓪ まず STEP 1-0（既知の制約セクション参照）を実行する：** `mcp__plaud__list_files` のレスポンスにフォルダ情報（`filetag_id_list` 等）が含まれるようになったかをチェック。**対応済みならMCPでフォルダ判定し、以下のREST API＋トークン処理は全てスキップ**（あわせてSKILL.md/README.mdを更新しユーザーに報告）。未対応なら以下へ進む。

Plaud MCP の `list_files` はフォルダ情報を返さないため（2026-07-06実測）、REST API を直接呼び出して `filetag_id_list` でフォルダ判定する。

**⚠️ 別PC対応版 — 設定ファイルから動的に読み込み：**

```powershell
# 1. 設定ファイルを読み込む
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
if (-not (Test-Path $configPath)) {
  Write-Error "設定ファイルが見つかりません: $configPath"
  Write-Host "初回セットアップスクリプトを実行してください: .\setup-plaud.ps1" -ForegroundColor Yellow
  exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$token = $config.plaud.api_token
$apiBase = $config.plaud.api_base
$INTERNAL = $config.plaud.folder_ids.internal
$EXTERNAL = $config.plaud.folder_ids.external
$KOWA = $config.plaud.folder_ids.kowa
$MENSETSU = $config.plaud.folder_ids.mensetsu   # 面接=HTML化対象外（無ければ$null）

# 2. 作業ディレクトリをパス展開
$workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
if (-not (Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir -Force | Out-Null }

# 3. Plaud APIから一覧取得
#    ⚠️ 文字化け防止: Invoke-RestMethod は日本語 filename を壊す。必ず Invoke-WebRequest で
#    生バイトを取り、UTF-8で明示デコードしてから ConvertFrom-Json する。
$wr = Invoke-WebRequest -Uri "$apiBase/file/simple/web?skip=0&limit=200&is_trash=0&sort_by=start_time&is_desc=true" -Headers @{ Authorization = $token } -UseBasicParsing
$resp = ([System.Text.Encoding]::UTF8.GetString($wr.RawContentStream.ToArray())) | ConvertFrom-Json

foreach ($f in $resp.data_file_list) {
    $tags = @($f.filetag_id_list)
    if     ($tags -contains $INTERNAL) { $folder = 'internal' }
    elseif ($tags -contains $EXTERNAL) { $folder = 'external' }
    elseif ($tags -contains $KOWA)     { $folder = 'kowa' }
    elseif ($MENSETSU -and ($tags -contains $MENSETSU)) { $folder = 'mensetsu' }  # 面接=対象外
    else   { $folder = 'unclassified' }
    # ⚠️ start_time はミリ秒。HTMLファイル名の日付は filename 先頭 "MM-DD" を優先（start_timeとズレる録音あり）
    $fnDate = if ($f.filename -match '^(\d{2})-(\d{2})') { "2026-$($matches[1])-$($matches[2])" } else { ([DateTimeOffset]::FromUnixTimeMilliseconds([int64]$f.start_time)).ToLocalTime().ToString('yyyy-MM-dd') }
    Write-Output "$($f.id) $folder $fnDate $($f.filename)"
}
```

- `filetag_id_list` に社内フォルダID（`c35095465864259130869d88d1b13419`）が含まれる → **🏢 社内**
- `filetag_id_list` に社外フォルダID（`dd2c13ed...`）が含まれる → **🤝 社外**
- `filetag_id_list` に講話録音フォルダID（`5010d262...`）が含まれる → **🎤 講話録音**
- `filetag_id_list` に面接フォルダID（`$MENSETSU` = `7e78f76c...`）が含まれる → **面接 = HTML化対象外**。採用面接は個人情報のため、生成もindex追加もしない。完了報告への記載も不要
- どれも含まれない → `unclassified`（**未振り分け = 要対応**。スキップし「未分類◯件・要フォルダ分け」と完了報告に**明示**する）

> **⚠️ 社内フォルダIDについて：** 社内ファイルがPlaudに追加されたタイミングで `filetag_id_list` の値を確認し、`$INTERNAL` を更新すること。

既存HTMLとの照合（**日付プレフィックスだけの照合は禁止**）:

> ⚠️ **過去の重大バグ（2026-07-08）:** 「その日付のHTMLが1つでもあれば済」と判定すると、**同じ日に複数MTGがある日**（例: 07-03に録音3件・HTML1件）で未処理分を「済」と誤検知する。必ず**日付ごとに『録音の件数・タイトル』と『実在するHTMLファイル名』を突き合わせる**こと。

```powershell
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$workDir = $config.paths.work_dir -replace '~', $env:USERPROFILE
# 既存HTMLを日付順に列挙し、STEP1の録音一覧と「日付単位」で突き合わせる
Get-ChildItem "$workDir\*.html" | Select-Object -ExpandProperty Name | Sort-Object
```
ある日付で「録音N件 > 実在HTML M件」なら未処理が (N−M) 件。タイトル(filename)とHTMLファイル名を1件ずつ対応付け、未HTML化の録音を確定する。

**ファイル名の対応ルール:**
- Plaud名: `06-01 ファーマン全体MTG` → HTMLファイル名: `2026-06-01_farman-zentai.html`
- 日付は **filename 先頭の "MM-DD"** を使う（`start_time`はミリ秒で、録音日とファイル名日付がズレる録音がある。HTMLファイル名は**filename日付**基準）
- 名前はローマ字スネークケースに変換（ファーマン→farman、全体→zentai、井上/田中→inoue-tanaka）

**⚠️ タイトル・固有名詞の忠実転記ルール（厳守）**

HTMLのタイトル・見出し・バッジ・メタタグに記載する全ての固有名詞・イベント名は、**Plaud APIの `filename` フィールドの文字列を一字一句そのままコピーする**。推測・補完・省略・言い換えは一切禁止。

#### 禁止事項（全て過去に実際に発生したエラー）

| 禁止行為 | 悪い例 | 正しい対処 |
|---------|--------|----------|
| **漢字の読み間違え** | `中村高校` → `chuo-koko`（中央と混同） | 一字ずつ読みを確認して `nakamura-koko` |
| **珍しい漢字の省略** | `目黒区碑小学校` → `目黒区小学校`（碑を落とす） | 珍しい漢字こそ特に注意してコピーする |
| **イベント名の捏造** | Plaud名が「体験受入時の冒頭説明」なのに「体育発表会の冒頭説明」と書く | Plaudの `filename` をそのまま使う。推測は禁止 |
| **よくある名前への置換** | 実際の名称より「それっぽい名称」で補完する | 「よくある名前」で補完しない |

#### 必ず守る手順

1. Plaud API の `filename` フィールドを **そのまま文字列としてコピー** して HTML タイトルに使う
2. ローマ字変換（ファイル名生成）の際も `filename` の各字の読みを1文字ずつ確認してから変換する
3. **珍しい漢字（碑・髙・﨑・彙・鷹 等）は特に注意**。読み方が不確かな漢字が含まれる場合は変換前にユーザーに確認する
4. 会議・イベントの種別名（「体験受入」「研修」「定例MTG」「冒頭説明」等）は**Plaudの原文から取る**。内容を読んで推測して書き換えない
5. 疑わしい点が1つでもあれば、HTML生成前にユーザーに「〇〇の読み方・正式名称を確認させてください」と聞く

**⚠️ トークン期限切れ対応（自動再取得が組み込み済み）:**

Plaudトークンは約24時間で失効する（`status: -419 / workspace token expired`）。**`refresh-plaud-token.ps1` が email+password から自動でトークンを再取得**するので、STEP1の冒頭で必ず実行する。

**STEP1の最初に実行（トークン自動チェック→失効してたら自動再取得）：**
```powershell
$configPath = "$env:USERPROFILE\.plaud\plaud-config.json"
$cfgHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\.claude" }
$skillDir = @("$cfgHome\plugins\marketplaces\farman-skills\plugins\plaud-suite\skills\plaud-html","$cfgHome\skills\plaud-html") | Where-Object { Test-Path (Join-Path $_ 'refresh-plaud-token.ps1') } | Select-Object -First 1
$cfg = Get-Content $configPath -Raw | ConvertFrom-Json
# JWTのexpをデコードして、失効 or 5分以内なら自動再取得
$needRefresh = $true
$tok = $cfg.plaud.api_token -replace '^Bearer\s+',''
if ($tok -and $tok.Contains('.')) {
  try {
    $pl = $tok.Split('.')[1]; $pad = $pl.PadRight($pl.Length + (4 - $pl.Length % 4) % 4, '=').Replace('-','+').Replace('_','/')
    $exp = [int64](([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($pad)) | ConvertFrom-Json).exp)
    if ((Get-Date).ToUniversalTime() -lt [DateTimeOffset]::FromUnixTimeSeconds($exp - 300).UtcDateTime) { $needRefresh = $false }
  } catch {}
}
if ($needRefresh) {
  if ($cfg.plaud.email -and $cfg.plaud.password) {
    Write-Host "トークン失効（または間近）→ 自動再取得します..." -ForegroundColor Yellow
    & "$skillDir\refresh-plaud-token.ps1"
    $cfg = Get-Content $configPath -Raw | ConvertFrom-Json   # 再読み込み
  } else {
    Write-Host "⚠ トークン失効。email/password未設定のため自動再取得不可。setup-plaud.ps1 で設定してください。" -ForegroundColor Red
  }
}
```

その後 `$cfg.plaud.api_token` を使ってAPIを叩く。**APIが `-419` を返した場合も** `refresh-plaud-token.ps1` を実行して設定を再読込し、リトライする。

> **`refresh-plaud-token.ps1` の仕組み:** `POST {api_base}/auth/access-token`（multipart: `username`/`password`/`client_id=web`/`password_encrypted=false`）でログインし、Set-Cookieの `pld_ut`（JWT）を新トークンとして取得→設定3箇所を更新。**パスワードは平文でOK（RSA暗号化不要）**。ログインは**1時間10回**制限なので失効時のみ呼ぶ。
>
> **フォールバック（email/password未設定 or ログイン失敗時）:** `web.plaud.ai` でF12→Consoleに次を貼り、ファイルをクリックして `🔑 Token: Bearer eyJ...` を取得し、手動で `$cfg.plaud.api_token` を更新する：
> ```javascript
> const o=XMLHttpRequest.prototype.setRequestHeader;XMLHttpRequest.prototype.setRequestHeader=function(n,v){if(n.toLowerCase()==='authorization')console.log('🔑 Token:',v);return o.apply(this,arguments);};
> ```
> APIベースURLは `https://api-apne1.plaud.ai`（`/api/v1` は不要）。

### STEP 2: 社内 / 社外を判定する

STEP 1 の `filetag_id_list` の結果を使う。タイトルや参加者名で推測してはならない。

| filetag_id_list の値 | 分類 | テンプレート |
|---------------------|------|------------|
| 社内フォルダID含む | 🏢 社内 | 議事録テンプレート（グリーン） |
| 社外フォルダID含む | 🤝 社外 | 議事録テンプレート（アンバー） |
| 講話録音フォルダID含む | 🎤 講話録音 | 講話ナレッジテンプレート（インジゴ） |
| 面接フォルダID含む | 面接 = **HTML化対象外**（生成・index追加せずスキップ・報告不要） | — |
| どれも含まない | スキップ（**未振り分け＝要対応**・報告に明示） | — |

### STEP 3: 議事録の内容を取得する

未HTML化ファイルそれぞれについて：
- `get_note` でAI要約（action_items、summary、key_topics）を取得
- メタ情報（duration・filename・start_time）は **STEP 1 の REST 一覧（`/file/simple/web`）から取る**。**`get_file` は呼ばない**（トランスクリプト全文＝20万文字規模が返りトークン上限を超える。上記「既知の制約」参照）
- MCPが `Not authenticated` の場合は `mcp__plaud__login`、それも不可なら REST の `/file/detail/{id}` フォールバック（上記「既知の制約」参照）

**⚠️ 500エラー時のリトライ：**
- `get_note` が 500 を返した場合、即座に同じ呼び出しを最大3回まで再試行する
- 3回とも失敗した場合はスキップして完了報告に記載する（次回実行で再処理される）

