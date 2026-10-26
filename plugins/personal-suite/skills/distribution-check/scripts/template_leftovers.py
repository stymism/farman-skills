#!/usr/bin/env python3
"""型の残り物チェック (distribution-check 補助スクリプト)

Excel / Word / PowerPoint のファイルに、型(テンプレートや過去の資料)から
引き継いだ「目に見えにくい設定」が残っていないかを一覧にする。
検出するだけで、ファイルは書き換えない。

使い方:
    python3 template_leftovers.py <ファイル or フォルダ> [...]
    (フォルダを渡すと .xlsx/.xlsm/.docx/.pptx を全部見る)

外部ライブラリ不要(標準ライブラリだけ)。2026-10-26 作成。
"""
import html
import re
import sys
import zipfile
from pathlib import Path

EXTS = {".xlsx", ".xlsm", ".docx", ".pptx"}


def read(z, name):
    try:
        return z.read(name).decode("utf-8", "replace")
    except KeyError:
        return ""


def props(z):
    out = []
    core = read(z, "docProps/core.xml")
    app = read(z, "docProps/app.xml")
    for tag, label in [("dc:creator", "作成者"), ("cp:lastModifiedBy", "最終更新者"),
                       ("dc:title", "タイトル"), ("dc:subject", "件名"),
                       ("cp:keywords", "キーワード"), ("dc:description", "説明")]:
        m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", core, re.S)
        if m and m.group(1).strip():
            out.append(f"{label}: {m.group(1).strip()}")
    for tag, label in [("Company", "会社"), ("Manager", "管理者")]:
        m = re.search(rf"<{tag}>(.*?)</{tag}>", app, re.S)
        if m and m.group(1).strip():
            out.append(f"{label}: {m.group(1).strip()}")
    return out


def check_xlsx(z):
    f = []
    wb = read(z, "xl/workbook.xml")
    rels = read(z, "xl/_rels/workbook.xml.rels")
    relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    relmap.update({a: b for b, a in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    sheets = re.findall(r"<sheet\b([^>]*)/?>", wb)
    f.append(f"シート数: {len(sheets)}")
    for s in sheets:
        name = re.search(r'name="([^"]*)"', s).group(1)
        state = re.search(r'state="([^"]*)"', s)
        if state and state.group(1) in ("hidden", "veryHidden"):
            f.append(f"[隠しシート] {name} ({state.group(1)})")
    names = re.findall(r'<definedName\b[^>]*name="([^"]+)"', wb)
    names = [n for n in names if not n.startswith("_xlnm.")]
    if names:
        f.append(f"[名前の定義] {', '.join(names)}")
    if any(n.startswith("xl/externalLinks/") for n in z.namelist()):
        f.append("[外部リンク] 他のファイルへのリンクがある")
    styles = read(z, "xl/styles.xml")
    fonts = re.findall(r"<font\b.*?</font>|<font/>", styles, re.S)
    colored = set()
    for i, ft in enumerate(fonts):
        c = re.search(r"<color\b([^>]*)/?>", ft)
        if not c:
            continue
        attr = c.group(1)
        rgb = re.search(r'rgb="([0-9A-Fa-f]{8})"', attr)
        if "theme=" in attr:
            th = re.search(r'theme="(\d+)"', attr).group(1)
            if th not in ("1",):   # theme 1 = 標準の文字色(黒)
                colored.add(i)
        elif rgb and rgb.group(1).upper()[2:] not in ("000000",):
            colored.add(i)
    xfs_block = re.search(r"<cellXfs\b.*?</cellXfs>", styles, re.S)
    xfs = re.findall(r"<xf\b[^>]*", xfs_block.group(0)) if xfs_block else []
    colored_xf = set()
    for i, x in enumerate(xfs):
        fm = re.search(r'fontId="(\d+)"', x)
        fl = re.search(r'fillId="(\d+)"', x)
        # 塗りのある欄(見出しの白文字など)は意図した色なので外す。塗りなしで色付きの文字だけ拾う
        if fm and int(fm.group(1)) in colored and (not fl or int(fl.group(1)) in (0, 1)):
            colored_xf.add(i)
    ss = read(z, "xl/sharedStrings.xml")
    strs = [html.unescape(re.sub(r"<[^>]+>", "", re.sub(r"<rPh\b.*?</rPh>", "", si, flags=re.S))) for si in re.findall(r"<si>(.*?)</si>", ss, re.S)]
    for s in sheets:
        name = re.search(r'name="([^"]*)"', s).group(1)
        rid = re.search(r'r:id="([^"]+)"', s).group(1)
        target = relmap.get(rid, "")
        path = "xl/" + target.lstrip("/").replace("xl/", "", 1) if not target.startswith("/xl/") else target[1:]
        x = read(z, path)
        if not x:
            continue
        tag = f"〈{name}〉"
        cf = re.findall(r'<conditionalFormatting\b[^>]*sqref="([^"]+)"', x)
        if cf:
            f.append(f"[条件付き書式]{tag} 範囲: {', '.join(cf)}  ← 縞模様・色付けが勝手に出る")
        dv = re.findall(r'<dataValidation\b[^>]*sqref="([^"]+)"', x)
        if dv:
            f.append(f"[入力規則]{tag} 範囲: {', '.join(dv)}")
        hr = re.findall(r'<row\b[^>]*r="(\d+)"[^>]*hidden="1"', x)
        if hr:
            f.append(f"[隠し行]{tag} {', '.join(hr[:20])}{' …' if len(hr) > 20 else ''}")
        hc = re.findall(r'<col\b[^>]*min="(\d+)"[^>]*max="(\d+)"[^>]*hidden="1"', x)
        if hc:
            f.append(f"[隠し列]{tag} {', '.join(a if a == b else a + '-' + b for a, b in hc)}")
        if re.search(r'<sheetView\b[^>]*state="hidden"', x):
            f.append(f"[隠しシート表示]{tag}")
        cells = re.findall(r'<c\b([^>]*)>(.*?)</c>', x, re.S)
        hits = []
        for attr, body in cells:
            sm = re.search(r'\bs="(\d+)"', attr)
            if not sm or int(sm.group(1)) not in colored_xf:
                continue
            ref = re.search(r'r="([A-Z]+\d+)"', attr).group(1)
            v = re.search(r"<v>(.*?)</v>", body, re.S)
            val = (v.group(1) if v else re.sub(r"<[^>]+>", "", body)).strip()
            if 't="s"' in attr and val.isdigit() and int(val) < len(strs):
                val = strs[int(val)]
            val = html.unescape(val)
            if val:
                hits.append(f"{ref}「{val[:20]}」")
        if hits:
            f.append(f"[黒以外の文字色]{tag} {' / '.join(hits[:15])}{' …' if len(hits) > 15 else ''}  ← 隣の欄と色が違わないか見る")
        crel = read(z, path.replace("worksheets/", "worksheets/_rels/") + ".rels")
        if "comments" in crel or "threadedComment" in crel:
            f.append(f"[コメント]{tag} コメント・メモがある")
        if "drawing" in crel:
            f.append(f"[図・画像]{tag} 図や画像がある(ロゴ・印影なら可。前の相手の物でないか見る)")
    return f


def check_docx(z):
    f = []
    doc = read(z, "word/document.xml")
    if read(z, "word/comments.xml"):
        n = len(re.findall(r"<w:comment\b", read(z, "word/comments.xml")))
        f.append(f"[コメント] {n} 件")
    ins, dele = len(re.findall(r"<w:ins\b", doc)), len(re.findall(r"<w:del\b", doc))
    if ins or dele:
        f.append(f"[変更履歴] 挿入 {ins} / 削除 {dele}(承諾か却下で消す)")
    if "<w:vanish/>" in doc:
        f.append("[隠し文字] 非表示の文字がある")
    for n in z.namelist():
        if re.match(r"word/(header|footer)\d*\.xml", n):
            t = re.sub(r"<[^>]+>", "", read(z, n)).strip()
            if t:
                f.append(f"[{'ヘッダー' if 'header' in n else 'フッター'}] 「{t[:40]}」")
    return f


def check_pptx(z):
    f = []
    pres = read(z, "ppt/presentation.xml")
    n_slides = len(re.findall(r"<p:sldId\b", pres))
    f.append(f"スライド数: {n_slides}")
    for n in sorted(z.namelist()):
        m = re.match(r"ppt/slides/slide(\d+)\.xml$", n)
        if m and re.search(r'<p:sld\b[^>]*show="0"', read(z, n)):
            f.append(f"[非表示スライド] {m.group(1)} 枚目")
        m = re.match(r"ppt/notesSlides/notesSlide(\d+)\.xml$", n)
        if m:
            t = re.sub(r"<[^>]+>", "", read(z, n)).strip()
            t = re.sub(r"\s+", " ", t)
            if len(t) > 3:
                f.append(f"[ノート] {m.group(1)}: 「{t[:40]}」")
    if any("comment" in n for n in z.namelist()):
        f.append("[コメント] コメントがある")
    return f


def check(path):
    with zipfile.ZipFile(path) as z:
        ext = path.suffix.lower()
        body = check_xlsx(z) if ext in (".xlsx", ".xlsm") else check_docx(z) if ext == ".docx" else check_pptx(z)
        return props(z), body


def main(args):
    files = []
    for a in args:
        p = Path(a)
        files += sorted(q for q in p.rglob("*") if q.suffix.lower() in EXTS) if p.is_dir() else [p]
    if not files:
        print("対象のファイルがありません(.xlsx/.xlsm/.docx/.pptx)")
        return 1
    for p in files:
        print(f"=== {p.name}")
        try:
            pr, body = check(p)
        except zipfile.BadZipFile:
            print("  (開けないファイル)")
            continue
        for line in pr:
            print(f"  [文書の情報] {line}  ← 前の作成者・相手先の名前が残っていないか")
        for line in body:
            print(f"  {line}")
        if not any(l.startswith("[") for l in body):
            print("  型の残り物: 検出なし")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
