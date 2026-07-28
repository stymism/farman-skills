# handoff

今の会話を、別のチャット/別セッションが引き継げるよう「引き継ぎ文書」にまとめて保存するスキル。経緯・決まったこと・やってほしいこと・未確定事項をテンプレートに沿って書き出す。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `personal-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\personal-suite\skills\handoff\`
- **取り込み**: `claude plugin update personal-suite@farman-skills`

## 起動するとき

「ハンドオフ作って」「引き継ぎ文書まとめて」「別のチャットに渡したい」など。話題が別領域に移りそうなときは提案してもよい。

## SKILL.md の構成

- なぜ使うのか
- このスキルがやること(全体像)
- 手順
- 引き継ぎ後の運用ルール(重要)
- 文書テンプレート

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
