---
name: skill-sync
description: スキルの手順・前提・既知の制約に変更や新しい知見が生じたとき、その内容を正本リポジトリのSKILL.md・README.md・関連する他スキルのMDまで漏れなく反映し、commit→pushして全PCへ配布するスキル。「スキル更新して」「この知見を反映して」「MDを最新化して」「skill-sync」や、作業中に判明した罠・仕様変更・手順の誤りを記録したいときに起動する。スキル実行中に「SKILL.mdの記述が実態と違う」「同じ失敗を繰り返した」と気づいた場合は、明示的に言われなくても起動を提案してよい。
allowed-tools: [Bash, PowerShell, Read, Write, Edit, Grep, Glob]
---

# skill-sync

**スキルは書きっぱなしにすると必ず実態とズレる。** 実行して分かったこと（罠・仕様変更・手順の誤り）を、その場で正本に書き戻して全PCへ配布するためのスキル。

## 大原則

1. **直すのは「正本」だけ。** 正本は `C:\claude code\skills-marketplace`（GitHub: `stymism/farman-skills`）。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**同リポジトリのgitクローン（複製）**であり、そこを直しても次の `claude plugin update` で上書きされて消える。
2. **push して初めて「更新した」と言える。** ローカル編集だけで完了報告しない。
3. **1つの変更は、影響する全ファイルに波及させる。** SKILL.md を直したら README.md の変更履歴、関連スキルのMD、設定テンプレまで見る。「片方だけ直っている」状態を残さない。
4. **推測で書かない。** 実測・実行結果に基づいて書く。日付を入れて「いつ時点の事実か」を残す（API仕様は変わるため）。

## いつ起動するか

| きっかけ | 例 |
|---|---|
| 外部仕様の変化を実測した | API のレスポンス項目が増減した、パラメータの制約が判明した、認証方式が変わった |
| 同じ失敗を2回した | キャッシュで「直っていない」と誤診、文字コード破壊、計測値の誤読 |
| SKILL.mdの記述が実態と違った | 「Aを使え」と書いてあるが実際はAが使えない／別手段が必要 |
| 手順を増やした・変えた | 検証ステップの追加、廃止した旧方式の削除 |
| ユーザーに指摘された | 「それ前も言った」「MDに書いてある通りじゃない」 |

## 手順

### STEP 1: 正本の場所と現状を確認する

```powershell
$repo = "C:\claude code\skills-marketplace"
git -C $repo status --short          # 未コミットの変更が残っていないか
git -C $repo log --oneline -3
git -C $repo pull --rebase origin main   # 他PCの変更を先に取り込む
```

> **⚠️ 先に pull する。** 複数PCで編集するため、いきなり編集すると衝突する。

### STEP 2: 反映先を洗い出す（ここを飛ばすと片手落ちになる）

変更内容ごとに、**影響するファイルを全部挙げてから**編集に入る。

| 変更の種類 | 見るべき反映先 |
|---|---|
| 手順・制約の変更 | 当該 `SKILL.md`／同フォルダ `README.md` の変更履歴 |
| **複数スキルが使う共通要素**（設定ファイル `~/.plaud/plaud-config.json`、作業ディレクトリのパス、共通CSS/JS、APIのベースURL、認証方式） | **その要素に触れる全スキルのSKILL.md** |
| プラグイン単位の前提（MCPサーバー、同梱ツール） | `plugins/<plugin>/.claude-plugin/plugin.json` の description・version |
| セットアップ手順 | `setup-*.ps1`・`*.template.json`・`newpc-README.txt`・リポジトリ直下 `README.md` |

横断の洗い出しは Grep が確実：

```
Grep pattern="plaud-config\.json|work_dir|farman-mtg-site" path="C:\claude code\skills-marketplace" glob="**/*.md" output_mode="files_with_matches"
```

### STEP 3: 編集する

- **必ず Read / Edit ツールを使う**（UTF-8対応）。PowerShellの文字列置換でMDを書き換えない — `Get-Content -Raw` は日本語を破壊する。
- 追記には**日付を入れる**：`### ⚠️ 〇〇（2026-07-28 追記）`。事実の鮮度が後で判断できるようにする。
- **古くなった記述は消すか書き換える。** 追記だけ重ねると矛盾した記述が同居する（例:「get_fileでメタ情報を取得」と「get_fileを呼ぶな」が両方載っている状態）。**新しい記述を足したら、それと矛盾する既存の記述を必ず探して直す。**
- 罠の記録は「何が起きたか」ではなく**「次にどう判断するか」**を書く。再現条件・誤診しやすい症状・切り分け方をセットで。

### STEP 4: README.md の変更履歴を更新する

各スキルフォルダの `README.md`（無ければ**新規作成**）の「変更履歴」に1行追記する。書式：

```markdown
## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | get_file がトランスクリプト全文を返すため使用を禁止。duration は STEP 1 の REST 一覧から取得するよう変更 |
```

READMEの最小構成は「概要／前提・セットアップ／使い方／このフォルダのファイル／既知の制約／変更履歴」。

### STEP 5: 壊していないか点検する

```powershell
$p = "<編集したMDのフルパス>"
$t = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
"replacement-char : " + ([regex]::Matches($t, [char]0xFFFD)).Count   # 0 であること
"mojibake         : " + ([regex]::Matches($t, 'ãƒ')).Count            # 0 であること
```

frontmatter（`---` で囲まれた `name` / `description` / `allowed-tools`）を壊していないかも確認する。**description は起動トリガーそのもの**なので、変更したらどの発話で起動するかを読み返す。

### STEP 6: commit → push

```powershell
$repo = "C:\claude code\skills-marketplace"
git -C $repo add -A
git -C $repo status --short
git -C $repo commit -m "<skill名>: <何を反映したか1行>"
git -C $repo push origin main
```

コミットメッセージは `<skill名>: <変更の要点>` で統一する。

**push は確認なしで実行する（2026-07-28 変更）。** このリポジトリ（`stymism/farman-skills`）への
変更は、ユーザーから包括的に承認済み。「pushしていいですか」と毎回聞かない — 聞くと更新が
滞り、正本と実態がズレる原因になる（これが実際に起きたためルールを変更した）。

- 対象は **farman-skills リポへの変更全般**（MDに限らずスクリプト・テンプレート等も含む）。
- ただし**秘密情報が混ざっていないかのスキャンは省略しない**。publicリポジトリのため、
  トークン・パスワード・APIキー・個人情報が入っていないかを push 前に必ず確認する。
- **これ以外のリポジトリや、外部への公開・配布を伴う操作は従来どおり確認する。**

### STEP 7: 反映方法をユーザーに伝える

push しただけでは、そのPCで動いているスキルは古いまま。

> **⚠️ 4プラグインは1つのgitクローンに同居している。** `~/.claude-code/plugins/marketplaces/farman-skills/` が丸ごとリポジトリのクローンで、その中に `plugins/plaud-suite` `plugins/design-suite` `plugins/farman-tools` `plugins/personal-suite` が入っている。**プラグインごとに更新する必要はなく、`git pull` 1回で全プラグインが同時に更新される。**

**ローカルPC（Claude が実行できる。ユーザーにコマンドを打たせない）:**
```powershell
$inst = "$env:USERPROFILE\.claude-code\plugins\marketplaces\farman-skills"
git -C $inst status --porcelain     # 空でなければ実行時コピーが直接編集されている（下記参照）
git -C $inst pull --ff-only origin main
```
※ `claude plugin update <plugin>@farman-skills` でも同じ結果になるが、上記のpullで全プラグインまとめて済む。**取り込み後は Claude Code の再起動が必要。**

**クラウドCowork:** 別インストールなので**自動では反映されない**。Claudeからは操作も状態確認もできないため、**ユーザーに依頼する**。以下の手順で更新できることを2026-07-28に確認済み：

> **Customize → Plugins → Personal plugins** を開く
> 1. **マーケットプレイス `farman-skills` 自体を更新（Refresh / Update）** ← ここを飛ばすと以降が古いまま
> 2. そのうえで各プラグイン（plaud-suite / design-suite / farman-tools / personal-suite）の **Update** を実行

- **ポイント:** ローカルの `git pull` と違い、Coworkは「マーケットプレイスの取得」と「プラグインの適用」が**2段階**。プラグイン側だけ押しても反映されない。
- **更新できたかの確認:** 新設・改名したスキルが候補に出るかを見るのが確実（例: 2026-07-28なら `/skill-sync` が出れば成功）。バージョン表示より信頼できる。
- ボタンが見当たらない場合は、**マーケットプレイスを削除して再追加**すれば確実に最新が入る。
- 導入（初回）も同じ画面: Personal plugins の「＋」→ Add marketplace → Add from a repository → `https://github.com/stymism/farman-skills` → 各プラグインを Install。

> **⚠️ 実行時コピーが直接編集されていることがある。** pull前に `git -C $inst status --porcelain` を必ず確認する。差分があれば**捨てる前に正本と突き合わせ**、正本に無い変更なら救出してから pull する（2026-07-28に実際に発生。幸い正本に同内容が入っていたため損失なし）。

## 完了報告に含めるもの

1. 更新したファイル（スキル名・ファイル名）と、それぞれ何を書いたか
2. **他スキルへの波及があったか／無かったか**（「無かった」も明示する。調べた証拠として）
3. commit ハッシュと push 先
4. 各PCでの取り込みコマンド
5. 今回あえて**書かなかったこと**があればその理由（例: 一時的な事象で再現性がないため記録しない）

## やってはいけないこと

- 実行中の複製（`~/.claude-code/plugins/...`）を直して満足する
- ローカル編集だけで「更新しました」と報告する
- 矛盾する記述を残したまま追記だけする
- 推測や「たぶんこうだろう」を、実測と区別せずに書く
- 日付のない追記（後から鮮度が判断できなくなる）
