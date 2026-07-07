# farman-skills marketplace

y-ino / Farman の個人スキルを **ローカルClaude CodeとクラウドCoworkの両方**で使うためのプラグイン・マーケットプレイスです。同じGitHubリポジトリを両環境で登録すれば、同一のスキル群が使えます。

## 収録プラグイン

| プラグイン | 内容 | 実行時の依存 |
|---|---|---|
| **plaud-suite** | Plaud録音の閲覧/要約/検索/書き起こし/フォローアップ/外部連携/HTMLサマリー(8スキル) | Plaud MCP同梱。初回に `mcp__plaud__login` で対話ログイン |
| **farman-tools** | farman.jp WordPress「お知らせ」一括投稿(1スキル) | farman.jpへログイン済みのブラウザ接続(Chrome拡張等) |
| **design-suite** | ブランド/デザインシステム/UI-UX/バナー/アイコン/スライド/フロントエンド(8スキル) | ロゴ・アイコン生成のみ環境変数 `GEMINI_API_KEY`(任意) |

合計17スキル。

## 使い方

### ローカル Claude Code
```
/plugin marketplace add <このリポジトリのGitHub URL>
/plugin install plaud-suite@farman-skills
/plugin install farman-tools@farman-skills
/plugin install design-suite@farman-skills
```

### クラウド Cowork
同じく `/plugin marketplace add <GitHub URL>` を実行し、必要なプラグインを install する。
非公開リポジトリの場合はCowork側にGitHubの読み取り権限が必要。

## セキュリティ方針
- **秘密情報は一切コミットしない。** 認証は各実行環境で対話ログイン(plaud)、ブラウザセッション(farman)、環境変数(design/GEMINI_API_KEY)で解決する。
- `.gitignore` で `.env` / `*.credentials.json` / `plaud-config.json` / `.wrangler` 等を除外済み。

## メンテナンス（編集はここが正本）
スキルの正本は**このリポジトリ**（`plugins/<group>/skills/<skill>/`）。編集→commit→push後、各環境で更新する:
- ローカルPC: `claude plugin update <plugin>@farman-skills`（マーケットプレイス更新は `claude plugin marketplace update farman-skills`）
- Cowork: プラグインUIから更新
- 未導入PCの導入は1行: `irm https://raw.githubusercontent.com/stymism/farman-skills/main/migrate.ps1 | iex`

※ `~/.claude-code/skills/` の素置きコピーは全廃済み（2026-07-07）。そこにファイルを置かないこと。

## 関連リポジトリ
- `stymism/farman-mtg-site`（**非公開**）: farman-mtg.pages.dev のデプロイ用。plaud-html の STEP7 が push → Cloudflare Pages が自動公開
