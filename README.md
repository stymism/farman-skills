# farman-skills marketplace

y-ino / Farman の個人スキルを **ローカルClaude CodeとクラウドCoworkの両方**で使うためのプラグイン・マーケットプレイスです。同じGitHubリポジトリを両環境で登録すれば、同一のスキル群が使えます。

## 収録プラグイン

| プラグイン | 内容 | 実行時の依存 |
|---|---|---|
| **plaud-suite** | Plaud録音の閲覧/要約/検索/書き起こし/フォローアップ/外部連携/HTMLサマリー(8スキル) | Plaud MCP同梱。初回に `mcp__plaud__login` で対話ログイン |
| **farman-tools** | farman.jp WordPress「お知らせ」一括投稿／FARMAN見積システム(GAS Web App)の改修・保守／有機JAS「栽培履歴」の作成(3スキル) | お知らせ投稿はfarman.jpへログイン済みのブラウザ接続。見積システムはGASエディタへの反映はユーザー手動。栽培履歴は設定ファイルと Python(openpyxl)。Coworkはファイルをアップロードして使う |
| **design-suite** | ブランド/デザインシステム/UI-UX/バナー/アイコン/スライド/フロントエンド(8スキル) | ロゴ・アイコン生成のみ環境変数 `GEMINI_API_KEY`(任意) |
| **personal-suite** | 俯瞰レビュー/配布前チェック/外部スキル監査/スキル更新の反映・配布/カレンダー同期/メール下書き/ブレインダンプ整理/セッション引き継ぎ/ローカルSDXL画像生成(9スキル) | cal-sync・mail-draftはGmail/Googleカレンダーのコネクタ連携が必要。skill-sync・image-genはローカル環境が必要（Cowork不可） |

合計28スキル。各スキルフォルダに `SKILL.md`（手順の正本）と `README.md`（概要・変更履歴）を置く。

### 実行環境による可否

同じリポジトリを両環境に配布するが、**Windowsローカル前提のスキルはCoworkでは動かない**。

| スキル | Cowork | 理由 |
|---|---|---|
| `plaud-html` | ❌ | PowerShell・`C:\`パス・`~/.plaud/plaud-config.json`・OneDrive作業ディレクトリ・ローカルgit認証に依存 |
| `skill-sync` | ❌ | 正本リポジトリ（`C:\claude code\skills-marketplace`）へのローカルアクセスが必要 |
| `image-gen` | ❌ | ローカルのSDXL環境（`C:\claude code\sdxl-local`・13GB）とCPU実行に依存 |
| その他25スキル | ⭕ | MCP・コネクタ・思考手順が主体。ロゴ/アイコン生成のみ `GEMINI_API_KEY` が必要 |

## 使い方

### ローカル Claude Code
```
/plugin marketplace add <このリポジトリのGitHub URL>
/plugin install plaud-suite@farman-skills
/plugin install farman-tools@farman-skills
/plugin install design-suite@farman-skills
/plugin install personal-suite@farman-skills
```

### クラウド Cowork
同じく `/plugin marketplace add <GitHub URL>` を実行し、必要なプラグインを install する。
非公開リポジトリの場合はCowork側にGitHubの読み取り権限が必要。

## セキュリティ方針
- **秘密情報は一切コミットしない。** 認証は各実行環境で対話ログイン(plaud)、ブラウザセッション(farman)、環境変数(design/GEMINI_API_KEY)で解決する。
- `.gitignore` で `.env` / `*.credentials.json` / `plaud-config.json` / `.wrangler` 等を除外済み。
- **スプレッドシートID・氏名・地番・住所は一切コミットしない。** `farman-cultivation-record` はこれらを
  `~/.farman/cultivation-record.json`（リポジトリ外）に置く設計。社内メンバーへは設定ファイルを個別に手渡す。

## メンテナンス（編集はここが正本）
スキルの正本は**このリポジトリ**（`plugins/<group>/skills/<skill>/`）。編集→commit→push後、各環境で更新する:
- ローカルPC: `claude plugin update <plugin>@farman-skills`（マーケットプレイス更新は `claude plugin marketplace update farman-skills`）
- Cowork: プラグインUIから更新
- 未導入PCの導入は1行: `irm https://raw.githubusercontent.com/stymism/farman-skills/main/migrate.ps1 | iex`

※ `~/.claude-code/skills/` の素置きコピーは全廃済み（2026-07-07）。そこにファイルを置かないこと。

## 関連リポジトリ
- `stymism/farman-mtg-site`（**非公開**）: farman-mtg.pages.dev のデプロイ用。plaud-html の STEP7 が push → Cloudflare Pages が自動公開
