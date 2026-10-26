#!/usr/bin/env python3
"""日本語 PDF の見た目チェック (distribution-check 補助スクリプト)

渡す前の PDF について、次の2つを機械で確かめる。検出するだけで書き換えない。
  1. 字形: 日本語と中国語で形が違う字(直・今・骨など)が、日本語の形で出ているか。
     ※ pdffonts で字体名が「CJKjp」でも、PDF にする道具の言語が中国語だと中国語の形が出る
       (2026-10-26 ボンディッシュ見積書の実例)。字体名ではなく、字の形そのものを画像で照らし合わせる。
  2. 切れ: 元の Excel(.xlsx)を渡したときは、文字の欄すべてが PDF に最後まで出ているか
     (セル幅が足りないと途中で切れる)。

使い方:
    python3 pdf_visual_check.py <PDF> [元の.xlsx]
終了コード: 問題なし 0 / NG あり 1

必要な物: pdftoppm・pdftotext(poppler-utils)、Pillow、Noto Sans CJK(fonts-noto-cjk)、
          元の .xlsx を渡すときは openpyxl。
2026-10-26 作成。v1.7(NG)と v1.8(OK)の両方で、NG を正しく出し分けることを確かめてから入れた。
"""
import glob
import os
import re
import subprocess
import sys
import tempfile
import unicodedata

from PIL import Image, ImageChops, ImageDraw, ImageFont

# 日本語と中国語(簡体字)で形が違い、日本語の書類によく出る字
TEST = "直今骨角写画者辺将化真具器歩望勝決鼻起強靴偏扇差即刃次述返遠過適連運"
DPI = 300


def find_cjk_font():
    for pat in ("/usr/share/fonts/**/NotoSansCJK-Regular.ttc",
                "/usr/share/fonts/**/NotoSansCJK*.ttc",
                "/System/Library/Fonts/**/NotoSansCJK*.ttc",
                "C:/Windows/Fonts/NotoSansCJK*.ttc"):
        hit = glob.glob(pat, recursive=True)
        if hit:
            return hit[0]
    return None


def face_index(font_path, lang):
    for i in range(10):
        try:
            name = ImageFont.truetype(font_path, 20, index=i).getname()[0]
        except OSError:
            break
        if name == f"Noto Sans CJK {lang}":
            return i
    return None


def norm(img):
    img = img.point(lambda v: 0 if v < 128 else 255)
    bb = ImageChops.invert(img).getbbox()
    return img.crop(bb).resize((64, 64)) if bb else None


def pixels(img):
    return list(img.get_flattened_data()) if hasattr(img, "get_flattened_data") else list(img.getdata())


def diff(a, b):
    return sum(x != y for x, y in zip(pixels(a), pixels(b)))


def words_of(pdf):
    out = subprocess.run(["pdftotext", "-bbox", pdf, "-"], capture_output=True, text=True).stdout
    page = 0
    words = []
    for line in out.splitlines():
        if "<page " in line:
            page += 1
        m = re.search(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)</word>', line)
        if m:
            words.append((page, float(m[1]), float(m[2]), float(m[3]), float(m[4]), m[5]))
    return words


def check_glyphs(pdf):
    font = find_cjk_font()
    if not font:
        print("[字形] Noto Sans CJK が無いので確かめられない(fonts-noto-cjk を入れる)")
        return None
    jp, sc = face_index(font, "JP"), face_index(font, "SC")
    ref = {}

    def glyph(ch, idx):
        key = (ch, idx)
        if key not in ref:
            f = ImageFont.truetype(font, 120, index=idx)
            g = Image.new("L", (170, 170), 255)
            ImageDraw.Draw(g).text((10, 0), ch, font=f, fill=0)
            ref[key] = norm(g)
        return ref[key]

    words = [w for w in words_of(pdf) if any(c in TEST for c in w[5])]
    if not words:
        print("[字形] 見分けに使える字が無い(検査対象 0 字)")
        return 0
    s = DPI / 72
    bad = checked = 0
    with tempfile.TemporaryDirectory() as td:
        pages = {}
        for page, x0, y0, x1, y1, w in words:
            if page not in pages:
                base = os.path.join(td, f"p{page}")
                subprocess.run(["pdftoppm", "-r", str(DPI), "-gray", "-png", "-f", str(page), "-l", str(page),
                                "-singlefile", pdf, base], check=True)
                pages[page] = Image.open(base + ".png").convert("L")
            im = pages[page]
            cw = (x1 - x0) / len(w)
            # 全角だけの語のときだけ1字ずつ切り出せる(半角が混じると位置がずれる)
            if any(unicodedata.east_asian_width(c) not in ("W", "F", "A") for c in w):
                continue
            for i, ch in enumerate(w):
                if ch not in TEST:
                    continue
                gj, gs = glyph(ch, jp), glyph(ch, sc)
                if diff(gj, gs) < 300:
                    continue
                c = norm(im.crop((int((x0 + i * cw) * s), int(y0 * s), int((x0 + (i + 1) * cw) * s), int(y1 * s))))
                if c is None:
                    continue
                dj, ds = diff(c, gj), diff(c, gs)
                checked += 1
                if dj >= ds:
                    bad += 1
                    print(f"[字形NG] {page}ページ「{ch}」(語: {w[:30]}) 日本語の形との差 {dj} / 中国語の形との差 {ds}")
    print(f"字形: {checked} 字を照合、NG {bad} 字")
    if checked == 0:
        print("  ※全角だけの語に見分けに使える字が無かった。目で見て確かめる")
    return bad


def check_cut(pdf, xlsx):
    import openpyxl
    nz = lambda t: re.sub(r"[\s\u3000]", "", t)
    text = nz(subprocess.run(["pdftotext", pdf, "-"], capture_output=True, text=True).stdout)
    wb = openpyxl.load_workbook(xlsx)
    bad = n = 0
    for ws in wb.worksheets:
        if ws.sheet_state != "visible":
            continue
        for row in ws.iter_rows():
            for c in row:
                v = c.value
                if isinstance(v, str) and not v.startswith("=") and nz(v):
                    n += 1
                    if nz(v) not in text:
                        bad += 1
                        print(f"[切れNG] {ws.title}!{c.coordinate}「{v[:40]}」が PDF に最後まで出ていない")
    print(f"切れ: 文字の欄 {n} 個を照合、NG {bad} 件")
    return bad


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    pdf = sys.argv[1]
    ng = check_glyphs(pdf) or 0
    if len(sys.argv) > 2:
        ng += check_cut(pdf, sys.argv[2])
    print("結果:", "NG あり" if ng else "NG なし(このあと画像でも全ページを見る)")
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())
