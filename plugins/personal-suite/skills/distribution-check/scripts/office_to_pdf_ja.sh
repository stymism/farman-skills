#!/usr/bin/env bash
# Excel / Word / PowerPoint を、日本語の字形で PDF にする (LibreOffice)
# 使い方: office_to_pdf_ja.sh <ファイル> [出力フォルダ]
#
# 何をするか(2026-10-26 作成):
#  1. メイリオ・ＭＳ ゴシック・游ゴシック等(Linux に無い字体)を Noto Sans CJK JP に当てる
#     → 当てないと中国語用の字体や DroidSansFallback に置き換わる
#  2. LibreOffice の言語(CJK)を日本語 ja-JP にした専用の設定で変換する
#     → これをしないと、日本語の字体を使っても「直」などが中国語の形で出る
# 変換したら pdf_visual_check.py で字形と切れを確かめ、画像でも全ページを見る。
set -euo pipefail
src="$1"; out="${2:-$(dirname "$src")}"
cfg="$HOME/.config/fontconfig/fonts.conf"
if ! grep -q "メイリオ" "$cfg" 2>/dev/null; then
  mkdir -p "$(dirname "$cfg")"
  cat > "$cfg" <<'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <alias binding="strong"><family>メイリオ</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>Meiryo</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>Meiryo UI</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>ＭＳ Ｐゴシック</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>ＭＳ ゴシック</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>MS PGothic</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>MS Gothic</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>游ゴシック</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>Yu Gothic</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias binding="strong"><family>ＭＳ 明朝</family><prefer><family>Noto Serif CJK JP</family></prefer></alias>
  <alias binding="strong"><family>ＭＳ Ｐ明朝</family><prefer><family>Noto Serif CJK JP</family></prefer></alias>
  <alias binding="strong"><family>游明朝</family><prefer><family>Noto Serif CJK JP</family></prefer></alias>
  <alias><family>sans-serif</family><prefer><family>Noto Sans CJK JP</family></prefer></alias>
  <alias><family>serif</family><prefer><family>Noto Serif CJK JP</family></prefer></alias>
</fontconfig>
EOF
  fc-cache -f >/dev/null 2>&1 || true
fi
prof="$HOME/.cache/lo_profile_ja"
mkdir -p "$prof/user"
cat > "$prof/user/registrymodifications.xcu" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Linguistic/General"><prop oor:name="DefaultLocale" oor:op="fuse"><value>ja-JP</value></prop></item>
<item oor:path="/org.openoffice.Office.Linguistic/General"><prop oor:name="DefaultLocale_CJK" oor:op="fuse"><value>ja-JP</value></prop></item>
<item oor:path="/org.openoffice.Setup/L10N"><prop oor:name="ooSetupSystemLocale" oor:op="fuse"><value>ja-JP</value></prop></item>
<item oor:path="/org.openoffice.Setup/L10N"><prop oor:name="ooLocale" oor:op="fuse"><value>ja-JP</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/I18N/CJK"><prop oor:name="CJKFont" oor:op="fuse"><value>true</value></prop></item>
</oor:items>
EOF
LANG=ja_JP.UTF-8 soffice -env:UserInstallation="file://$prof" --headless --convert-to pdf --outdir "$out" "$src"
