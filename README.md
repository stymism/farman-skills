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

## メンテナンス
ローカルのスキル本体は `~/.claude-code/skills/` にある。スキルを更新したら、このリポジトリの `plugins/<group>/skills/<skill>/` に反映してコミット・pushすると両環境へ配布される。
