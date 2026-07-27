---
name: slides
description: Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies.
argument-hint: "[topic] [slide-count]"
metadata:
  author: claudekit
  version: "1.0.0"
---

# Slides

Strategic HTML presentation design with data visualization.

## When to Use

- Marketing presentations and pitch decks
- Data-driven slides with Chart.js
- Strategic slide design with layout patterns
- Copywriting-optimized presentation content

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `create` | Create strategic presentation slides | `references/create.md` |

## References (Knowledge Base)

| Topic | File |
|-------|------|
| Layout Patterns | `references/layout-patterns.md` |
| HTML Template | `references/html-template.md` |
| Copywriting Formulas | `references/copywriting-formulas.md` |
| Slide Strategies | `references/slide-strategies.md` |

## Routing

1. Parse subcommand from `$ARGUMENTS` (first word)
2. Load corresponding `references/{subcommand}.md`
3. Execute with remaining arguments

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\design-suite\skills\slides\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。API仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する（無ければ作成）。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "slides: <要点>" && git push origin main`（**push前にユーザーへ確認**）。完了報告に「各PCは `claude plugin update design-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
