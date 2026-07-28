# plaud-shared

**Plaud操作の前に最初に読む共通スキル。** 認証フロー・エラー処理・出力規約・トークンリフレッシュ・データモデルを定義し、どの兄弟スキルを読み込むべきかを案内する。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `plaud-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\plaud-suite\skills\plaud-shared\`
- **取り込み**: `claude plugin update plaud-suite@farman-skills`

## 起動するとき

セッション中に初めてPlaudの話題が出たとき、または他のPlaudスキルが起動したときに自動で読まれる前提。

## SKILL.md の構成

- Authentication
- Tool inventory
- Error semantics
- Output conventions
- Data model quick reference
- When to load which sibling skill

## 注意・制約

- 他のPlaudスキル（browse / find / read / digest / followup / export / html）の土台。ここの認証・出力規約が全体に効く。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
