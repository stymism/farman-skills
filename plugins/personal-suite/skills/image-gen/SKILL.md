---
name: image-gen
description: ローカルのStable Diffusion XL(SDXL)で画像を生成するスキル。API課金なし・完全オフラインで動く。「画像を作って」「イラスト生成して」「AIで画像を」「SDXLで」「バナー用の絵がほしい」「サムネ画像作って」「写真風の画像を」などの発言で必ず起動すること。資料・スライド・記事に挿絵や素材が必要そうな場面でも、明示されなくても提案してよい。**解像度を1024から下げると出力がランダムに崩壊する**という重大な罠があるため、自己流でコマンドを組まずこの手順に従う。
---

# image-gen

ローカルPCの SDXL (Stable Diffusion XL base 1.0) で画像を生成する。ONNX Runtime + CPU実行。**完全無料・オフライン・商用利用可**。

- 環境の場所: `C:\claude code\sdxl-local`
- 構築日: 2026-07-31

## 最初に確認すること

このスキルは**Windowsローカル環境専用**。Cowork(クラウド)では動かない。

```bash
ls "C:\claude code\sdxl-local\generate.py"
```

存在しなければ未構築。その場合はこのスキルの「未構築のPCでのセットアップ」に従うか、
ユーザーに「このPCにはSDXL環境が無い」と伝えて指示を仰ぐ。**勝手に13GBのダウンロードを始めない。**

## 実行のしかた

```bash
cd "C:\claude code\sdxl-local"
./venv/Scripts/python.exe generate.py "英語のプロンプト" --out 出力パス.png
```

### オプション

| オプション | 既定値 | 備考 |
|---|---|---|
| `--steps` | 25 | 20未満にしない(下記の崩壊リスク) |
| `--width` / `--height` | 1024 | **下げない**(下記) |
| `--negative` | (なし) | 除外したい要素 |
| `--seed` | ランダム | 同じ値で完全に同じ絵(ハッシュ一致で確認済み) |
| `--out` | output.png | 出力先 |

### 実行時の作法

1. **生成前に必ず「約18分かかる」と伝える。** 黙って走らせない。複数枚なら枚数×18分。
2. **バックグラウンド実行する** (`run_in_background: true`)。18分フォアグラウンドで待たない。
3. プロンプトは**英語**で書く。日本語だと品質が落ちる。ユーザーが日本語で指示したら英語に翻訳して渡し、使ったプロンプトを報告する。
4. 生成後は必ず**画像を Read して確認する**。崩壊(下記)していたら作り直す。
5. ユーザーには `SendUserFile` で `display: "render"` を付けて見せる。

## ⚠️ 解像度を1024から下げないこと(最重要)

**SDXLは1024x1024で訓練されたモデル。** 512など大きく下の解像度を指定すると
モデルにとって想定外の入力になり、**画像が縞・格子状のノイズに崩壊する**。

しかも**毎回ではなくランダムに起きる**。たまたま成功すると「動いた」と誤認し、
後で再現しない不具合として跳ね返ってくる。

実測(同一プロンプト "red apple on a wooden table"):

| 設定 | 結果 |
|---|---|
| 512x512 / 4〜12ステップ | ほぼ崩壊 |
| 512x512 / 10ステップ | 3回中2回 崩壊 |
| 512x512 / 20ステップ | 成功(ただし運) |
| **1024x1024 / 25ステップ** | **2回とも高品質** |

- **小さい画像が欲しい場合も、1024で生成してから縮小する。** 直接小さく生成しない。
- 横長・縦長が欲しい場合は、面積を1024x1024相当に保つ(例: 1216x832、832x1216)。
  片辺を512まで落とさない。

### この症状を誤診しないこと

縞ノイズが出たとき、以下を疑うのは**すべて濡れ衣**。実験で否定済み(2026-07-31):

- ❌ 実行先(DirectML GPU / CPU) — CPUでも同様に発生する
- ❌ ONNX変換の有無 — 素の PyTorch + diffusers でも発生する
- ❌ ORT のスレッド数 — シングルスレッドでも発生する
- ❌ seed の有無や値 — latents の統計値は全条件で同一だった

**解像度とステップ数を見ること。** 切り分けに数時間溶かした実績があるので繰り返さない。

## 性能

| 設定 | 所要時間 |
|---|---|
| 1024x1024 / 25ステップ | 約18分/枚 |
| 1024x1024 / 20ステップ | 約15分/枚 |

CPU実行なので生成中はPCが重くなる。長時間の作業と並行させない方がよい。

## GPUは使えない(このPCの場合)

AMD Radeon 860M (内蔵GPU) は DirectML 経由で**約3.5GBしかメモリを確保できず**、
SDXL(fp32で13GB、fp16でも6.7GB / UNet単体4.8GB)が乗らない。ゆえにCPU実行。

DirectMLのメモリ不足は
`UnicodeDecodeError: 'utf-8' codec can't decode byte 0x83 in position 4`
という**無関係に見えるエラー**で現れる(日本語Windows環境でのエラー処理の不具合)。
文字コードの問題ではないので、その線を追いかけない。

NVIDIA GPU搭載機に移す場合は CUDA版 PyTorch + diffusers で素直にGPUが使え、
数十秒/枚まで短縮できる。その際はこのスキルを更新すること。

## プロンプトのコツ

- 被写体 + 状況 + 光 + 画風、の順に並べると安定する
  例: `a cozy Japanese farmhouse in a green vegetable field, morning light, photorealistic`
- 画風の指定語: `photorealistic` / `oil painting` / `watercolor` / `flat vector illustration` / `3d render`
- `--negative` によく効く語: `blurry, low quality, watermark, text, distorted, extra limbs`
- 文字を画像内に入れるのは苦手。ロゴやテキスト入りバナーは design-suite 側の手段を検討する。

## 未構築のPCでのセットアップ

別PCで使いたい場合(13GBのダウンロードと約30分を要する。**必ず事前に了承を取る**):

```bash
mkdir "C:\claude code\sdxl-local" && cd "C:\claude code\sdxl-local"
python -m venv venv
./venv/Scripts/pip.exe install optimum-onnx onnxruntime torch diffusers transformers onnx
```

その後、SDXLをONNXへエクスポート(正本PCの `export_onnx.py` と同等の処理)。
`optimum` のパッケージ検出は `onnxruntime-directml` を認識しない不具合があるため、
CLI (`python -m optimum.exporters.onnx`) ではなくスクリプトから
`iu._onnxruntime_available = True` を立てて `main_export()` を直接呼ぶ。
詳細は正本PCの `C:\claude code\sdxl-local\export_onnx.py` を参照。

## ライセンス

SDXL base 1.0 は CreativeML Open RAIL++-M。**商用利用可**。
生成物をファーマンの販促物・サイト・資料に使ってよい。

---

## 🔄 このスキルを更新したら（全スキル共通ルール）

このスキルの**手順・前提・既知の制約に変更や新しい知見が生じたら、その場で正本を更新してから終わる**。「後で直す」は必ず忘れる。詳細手順は **`/skill-sync`**（personal-suite）にある。最低限、次の5つを守る：

1. **正本を直す** — `C:\claude code\skills-marketplace\plugins\personal-suite\skills\image-gen\SKILL.md`。実行時に読まれている `~/.claude-code/plugins/marketplaces/farman-skills/...` は**gitクローンの複製**であり、そこを直しても次の `claude plugin update` で消える。
2. **矛盾を残さない** — 新しい記述を足したら、それと食い違う既存の記述を探して**書き換えるか削除する**。追記だけ重ねると「AせよとAするな」が同居する。
3. **日付を入れる** — `（2026-00-00 追記）` の形で。モデルや依存ライブラリの仕様は変わるため、いつ時点の事実かが後で判断できるようにする。
4. **他スキルへ波及させる** — 共通の設定ファイル・パス・API・認証方式に触れる変更なら、それを使う**全スキルのMD**を Grep で洗い出して同時に直す。同フォルダ `README.md` の変更履歴にも1行追記する。
5. **commit → push** — `git -C "C:\claude code\skills-marketplace" add -A && git commit -m "image-gen: <要点>" && git push origin main`（**確認不要**。このリポへの変更はユーザー承認済み・2026-07-28）。完了報告に「各PCは `claude plugin update personal-suite@farman-skills` で取り込む」と明記する。

> **ローカル編集だけで「更新しました」と報告しない。** push して各PCが取り込めて初めて更新完了。
