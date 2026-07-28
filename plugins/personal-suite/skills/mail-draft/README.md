# mail-draft

Gmailの受信トレイから過去N日分（既定7日）の**人間からの未返信メール**を抽出し、自分の文体（`email-style.md`）に沿った返信下書きをGmailの下書きとして保存するスキル。

手順の詳細は [`SKILL.md`](./SKILL.md) にある。**この README は概要・起動条件・変更履歴のみ**を扱う。

- **プラグイン**: `personal-suite`
- **正本**: `C:\claude code\skills-marketplace\plugins\personal-suite\skills\mail-draft\`
- **取り込み**: `claude plugin update personal-suite@farman-skills`

## 起動するとき

「朝のメール」「今週のメール返信下書き」「未返信メールに返事して」など。スケジュールタスクから毎朝自動実行することも想定している。

## SKILL.md の構成

- 0. 起動条件と前提
- Step 1: 文体ルールを読み込む
- Step 2: 抽出対象スレッドを取得
- Step 3: 要返信メールを選別する
- Step 4: 各スレッドの本文を取得
- Step 5: 文体に沿って下書きを書く
- Step 6: Gmailに下書き保存
- Step 7: 報告
- 「人間からの要返信メールが0件」のとき
- エッジケース
- スケジュールタスクとして毎朝動かす場合
- 失敗時の伝え方

## 注意・制約

- 下書き保存まで。**送信はしない**。
- 文体は `email-style.md` を読み込んで従う（Step 1）。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-28 | README.md を新規作成 |
| 2026-07-28 | SKILL.md 末尾に全スキル共通の更新反映ルール（`/skill-sync` 連携）を追加 |
