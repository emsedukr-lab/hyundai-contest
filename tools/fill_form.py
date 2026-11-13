"""Fills section 02 of the official application DOCX from submission/기획서_초안.md.

Only the app name lines and the eight answer boxes are written; personal details, consent and signatures stay
blank for the applicants. The answer boxes are filled in document order (their internal aliases differ from the
visible headings, which are what reviewers read).

Each `## N.` section of the source goes into answer box N, written in a small markdown subset:

    ### 소제목                      bold navy subheading
    - 항목 / `  - 하위 항목`         bullets (a leading ①…⑳ replaces the bullet glyph)
    **굵게**, `API명`               bold / monospace runs
    > 요약                          shaded summary line with a navy bar
    | a | b | + |---|---|          table, header row first; an optional next line
    {cols: 30/70; caption: 설명}    sets column widths (%) and a "표 N." caption above it
    ![설명](figures/x.png){70%}     figure (PNG or JPEG) with a "그림 N." caption (optional narrower width)
    blank line                      paragraph break; any other line is a paragraph

The template's box is an inline plain-text content control, which cannot hold paragraphs, tables or pictures, so
the box's paragraph is replaced by a block-level rich-text control with the same alias/tag/id. Every answer row
may then break across pages (the template marks them cantSplit, which a box taller than a page cannot honour).

Usage: python3 tools/fill_form.py <official.docx> <out.docx>
"""
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "submission/기획서_초안.md"
FIGURE = re.compile(r"^!\[(.+?)\]\((.+?)\)(?:\{(\d+)%\})?\s*$")
TABLE_ATTRS = re.compile(r"^\{(.+)\}\s*$")
CIRCLED = re.compile(r"^(\*\*)?([①-⑳])\s*")
# The answer box is 9937 dxa wide with 110 dxa margins on each side; 1 dxa = 635 EMU.
MAX_EMU = (9866 - 220 - 40) * 635
TABLE_W = 9680

NAVY = "16324F"
GREY = "5B6574"
BODY = 20  # half-points (10pt)
SMALL = 18  # tables
LINE = 'w:line="288" w:lineRule="auto"'
BULLETS = 900  # numbering ids added to numbering.xml (template uses 0–13 / 1–15)


# ---------- source ----------

def sections(md: str) -> dict[str, list[str]]:
    out, key = {}, None
    for line in md.splitlines():
        m = re.match(r"^## (.+)$", line)
        if m:
            key = m.group(1).split(".")[0].strip()
            out[key] = []
        elif key:
            out[key].append(line.rstrip())
    return out


def cells(row: str) -> list[str]:
    return [c.strip() for c in row.strip().strip("|").split("|")]


def blocks(lines: list[str]) -> list[tuple]:
    out, i = [], 0
    while i < len(lines):
        line, st = lines[i], lines[i].strip()
        i += 1
        if not st:
            continue
        if f := FIGURE.match(st):
            out.append(("figure", f.group(1), f.group(2), int(f.group(3) or 100)))
        elif st.startswith("### "):
            out.append(("heading", st[4:].strip()))
        elif st.startswith("> "):
            out.append(("quote", st[2:].strip()))
        elif b := re.match(r"^( *)- (.+)$", line):
            out.append(("bullet", 1 if len(b.group(1)) < 2 else 2, b.group(2).strip()))
        elif st.startswith("|"):
            rows = [cells(st)]
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            rows = [r for r in rows if not all(re.fullmatch(r":?-+:?", c) for c in r)]
            attrs = {}
            if i < len(lines) and (a := TABLE_ATTRS.match(lines[i].strip())):
                for part in a.group(1).split(";"):
                    k, _, v = part.partition(":")
                    attrs[k.strip()] = v.strip()
                i += 1
            width = len(rows[0])
            if any(len(r) != width for r in rows):
                raise SystemExit(f"table rows differ in width: {rows[0]}")
            cols = [int(x) for x in attrs["cols"].split("/")] if "cols" in attrs else None
            if cols and len(cols) != width:
                raise SystemExit(f"cols {attrs['cols']} do not match {width} columns")
            out.append(("table", rows, cols, attrs.get("caption")))
        else:
            out.append(("para", st))
    return out


# ---------- runs ----------

def rpr(size: int = BODY, bold: bool = False, color: str | None = None, code: bool = False) -> str:
    # rPr children in schema order: rFonts, b, bCs, color, sz, szCs, shd.
    parts = []
    if code:
        parts.append('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>')
    if bold:
        parts.append("<w:b/><w:bCs/>")
    if color:
        parts.append(f'<w:color w:val="{color}"/>')
    parts.append(f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>')
    if code:
        parts.append('<w:shd w:val="clear" w:color="auto" w:fill="EEF1F5"/>')
    return f"<w:rPr>{''.join(parts)}</w:rPr>"


def run(text: str, **kw) -> str:
    return f'<w:r>{rpr(**kw)}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def inline(text: str, size: int = BODY, bold: bool = False, color: str | None = None) -> str:
    out = []
    for piece in re.split(r"(\*\*.+?\*\*|`[^`]+`)", text):
        if not piece:
            continue
        if piece.startswith("**") and piece.endswith("**") and len(piece) > 4:
            out.append(run(piece[2:-2], size=size, bold=True, color=color or NAVY))
        elif piece.startswith("`") and piece.endswith("`") and len(piece) > 2:
            out.append(run(piece[1:-1], size=max(size - 2, 16), color="1F3A5F", code=True))
        else:
            out.append(run(piece, size=size, bold=bold, color=color))
    return "".join(out)


def para(content: str, before: int = 0, after: int = 80, head: str = "", extra: str = "", ind: str = "",
         line: str = LINE, jc: str = "") -> str:
    # pPr children in schema order: keepNext/numPr (head), pBdr/shd (extra), spacing, ind, jc.
    return f'<w:p><w:pPr>{head}{extra}<w:spacing w:before="{before}" w:after="{after}" {line}/>{ind}{jc}</w:pPr>{content}</w:p>'


# ---------- blocks ----------

def heading_xml(text: str, first: bool) -> str:
    # Keep-with-next on the first paragraph of the answer cell makes Word move the whole answer row to the next
    # page, so the opening heading goes without it (the content that follows it is in the same cell anyway).
    keep = "" if first else "<w:keepNext/>"
    return para(inline(text, size=22, bold=True, color=NAVY), before=40 if first else 220, after=80, head=keep)


def bullet_xml(level: int, text: str) -> str:
    c = CIRCLED.match(text)
    if c and level == 1:
        # The circled number is the marker: hanging indent, number, tab to the text column.
        rest = (c.group(1) or "") + text[c.end():]
        content = run(c.group(2), bold=True, color=NAVY) + "<w:r><w:tab/></w:r>" + inline(rest)
        return para(content, after=60, ind='<w:ind w:left="300" w:hanging="300"/>')
    num = f'<w:numPr><w:ilvl w:val="{level - 1}"/><w:numId w:val="{BULLETS}"/></w:numPr>'
    return para(inline(text), after=40 if level == 2 else 60, head=num)


def quote_xml(text: str) -> str:
    border = f'<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="{NAVY}"/></w:pBdr>'
    shade = '<w:shd w:val="clear" w:color="auto" w:fill="F1F4F8"/>'
    return para(inline(text), before=40, after=140, extra=border + shade, ind='<w:ind w:left="160" w:right="60"/>')


def caption_xml(kind: str, n: int, text: str, before: int, after: int, keep: bool) -> str:
    content = run(f"{kind} {n}. ", size=17, bold=True, color=NAVY) + run(text, size=17, color=GREY)
    return para(content, before=before, after=after, head="<w:keepNext/>" if keep else "",
                line='w:line="260" w:lineRule="exact"', jc='<w:jc w:val="center"/>')


def widths(rows: list[list[str]], cols: list[int] | None) -> list[int]:
    if cols:
        pct = cols
    else:
        longest = [max(len(r[c]) for r in rows) for c in range(len(rows[0]))]
        total = sum(longest)
        pct = [min(max(100 * x / total, 15), 50) for x in longest]
    scale = sum(pct)
    w = [round(TABLE_W * p / scale) for p in pct]
    w[-1] += TABLE_W - sum(w)
    return w


def table_xml(rows: list[list[str]], cols: list[int] | None) -> str:
    w = widths(rows, cols)
    edge = 'w:val="single" w:sz="4" w:space="0" w:color="C8D0DA"'
    borders = "".join(f"<w:{s} {edge}/>" for s in ("top", "left", "bottom", "right", "insideH", "insideV"))
    tblpr = (
        f'<w:tblPr><w:tblW w:w="{TABLE_W}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>{borders}</w:tblBorders>'
        '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="110" w:type="dxa"/>'
        '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar>'
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>'
    )
    grid = "<w:tblGrid>" + "".join(f'<w:gridCol w:w="{x}"/>' for x in w) + "</w:tblGrid>"
    trs = []
    for r, row in enumerate(rows):
        header = r == 0
        tcs = []
        for c, text in enumerate(row):
            shade = '<w:shd w:val="clear" w:color="auto" w:fill="E8EDF4"/>' if header else ""
            content = inline(text, size=SMALL, bold=header or c == 0, color=NAVY if header or c == 0 else None)
            # Keep-with-next on every row but the last keeps a short table on one page.
            p = para(content, after=0, line='w:line="250" w:lineRule="auto"', head="<w:keepNext/>" if r < len(rows) - 1 else "")
            tcs.append(f'<w:tc><w:tcPr><w:tcW w:w="{w[c]}" w:type="dxa"/>{shade}<w:vAlign w:val="center"/></w:tcPr>{p}</w:tc>')
        trpr = "<w:trPr><w:cantSplit/>" + ("<w:tblHeader/>" if header else "") + "</w:trPr>"
        trs.append(f"<w:tr>{trpr}{''.join(tcs)}</w:tr>")
    return f"<w:tbl>{tblpr}{grid}{''.join(trs)}</w:tbl>"


def image_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:2] == b"\xff\xd8":
        # Walk the JPEG segments to the first start-of-frame marker, which holds height and width.
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            length = struct.unpack(">H", data[i + 2 : i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack(">HH", data[i + 5 : i + 9])
                return w, h
            i += 2 + length
    raise SystemExit(f"not a PNG or JPEG: {path}")


def figure_xml(n: int, rid: str, path: Path, caption: str, pct: int = 100) -> str:
    w, h = image_size(path)
    cx = MAX_EMU * pct // 100
    cy = round(cx * h / w)
    cap = escape(caption)
    pic = (
        f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
        f'<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{9000 + n}" name="그림 {n}" descr="{cap}"/>'
        f'<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{9000 + n}" name="{escape(path.name)}" descr="{cap}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
        f'</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    )
    return pic + caption_xml("그림", n, caption, before=0, after=180, keep=False)


class Counter:
    def __init__(self):
        self.figure = 0
        self.table = 0


def render(bs: list[tuple], count: Counter, media: list[tuple[str, Path]]) -> str:
    out = []
    for k, b in enumerate(bs):
        kind = b[0]
        if kind == "heading":
            out.append(heading_xml(b[1], first=k == 0))
        elif kind == "para":
            out.append(para(inline(b[1])))
        elif kind == "bullet":
            out.append(bullet_xml(b[1], b[2]))
        elif kind == "quote":
            out.append(quote_xml(b[1]))
        elif kind == "table":
            _, rows, cols, caption = b
            if caption:
                count.table += 1
                out.append(caption_xml("표", count.table, caption, before=120, after=60, keep=True))
            out.append(table_xml(rows, cols))
            # A paragraph after the table keeps a following table or figure apart from it.
            out.append(para("", after=60, line='w:line="160" w:lineRule="exact"'))
        elif kind == "figure":
            _, caption, rel, pct = b
            path = (SOURCE.parent / rel).resolve()
            if not path.exists():
                raise SystemExit(f"figure not found: {rel}")
            count.figure += 1
            rid = f"rIdFig{count.figure}"
            media.append((rid, path))
            out.append(figure_xml(count.figure, rid, path, caption, pct))
    return "".join(out)


# ---------- document ----------

def fill(xml: str, s: dict[str, list[str]], media: list[tuple[str, Path]]) -> str:
    sdts = list(re.finditer(r"<w:sdt>.*?</w:sdt>", xml, re.S))
    if len(sdts) != 8:
        raise SystemExit(f"expected 8 answer boxes, found {len(sdts)}")
    # Render in reading order so figures and tables are numbered as read, then splice from the back.
    count = Counter()
    bodies = [render(blocks(s[str(i)]), count, media) for i in range(1, 9)]
    for m, body in reversed(list(zip(sdts, bodies))):
        pr = re.search(r"<w:sdtPr>.*?</w:sdtPr>", m.group(0), re.S).group(0)
        keep = "".join(re.findall(r"<w:(?:alias|tag|id) [^>]*/>", pr))
        p_start = max(xml.rfind("<w:p ", 0, m.start()), xml.rfind("<w:p>", 0, m.start()))
        p_end = xml.index("</w:p>", m.end()) + len("</w:p>")
        if re.search(r"<w:r[ >]", xml[p_start : m.start()]) or "<w:r" in xml[m.end() : p_end]:
            raise SystemExit("answer box paragraph holds more than the content control")
        tail = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr></w:p>'
        rich = f"<w:sdt><w:sdtPr>{keep}</w:sdtPr><w:sdtContent>{body}</w:sdtContent></w:sdt>{tail}"
        xml = xml[:p_start] + rich + xml[p_end:]
        row_start = xml.rfind("<w:tr ", 0, p_start)
        trpr_end = xml.index("</w:trPr>", row_start)
        xml = xml[:row_start] + xml[row_start:trpr_end].replace("<w:cantSplit/>", "") + xml[trpr_end:]

    # "앱명 / 프로젝트명: ____" lines (sections 01, 02 and 04): keep the label, replace the blanks with the name.
    name = escape(next(x.strip() for x in s["앱명"] if x.strip()))

    def name_line(p: re.Match) -> str:
        line = p.group(0)
        if "프로젝트명" not in "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", line)):
            return line
        line = re.sub(r"(<w:t[^>]*>[^<]*프로젝트명:\s*)_+", lambda q: q.group(1) + name, line, count=1)
        return re.sub(r"(<w:t[^>]*>)_+(</w:t>)", r"\1\2", line)

    return re.sub(r"<w:p [^>]*>(?:(?!</w:p>).)*앱명(?:(?!</w:p>).)*</w:p>", name_line, xml, flags=re.S)


def bullet_numbering(xml: str) -> str:
    font = '<w:rFonts w:ascii="맑은 고딕" w:eastAsia="맑은 고딕" w:hAnsi="맑은 고딕" w:hint="eastAsia"/>'

    def lvl(i: int, glyph: str, left: int, color: str) -> str:
        return (
            f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="{glyph}"/><w:lvlJc w:val="left"/>'
            f'<w:pPr><w:ind w:left="{left}" w:hanging="220"/></w:pPr><w:rPr>{font}<w:color w:val="{color}"/></w:rPr></w:lvl>'
        )

    abstract = (
        f'<w:abstractNum w:abstractNumId="{BULLETS}"><w:multiLevelType w:val="hybridMultilevel"/>'
        + lvl(0, "•", 300, NAVY) + lvl(1, "–", 560, GREY) + "</w:abstractNum>"
    )
    num = f'<w:num w:numId="{BULLETS}"><w:abstractNumId w:val="{BULLETS}"/></w:num>'
    first = xml.index("<w:num w:")
    xml = xml[:first] + abstract + xml[first:]
    last = xml.rindex("</w:num>") + len("</w:num>")
    return xml[:last] + num + xml[last:]


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    s = sections(SOURCE.read_text(encoding="utf-8"))
    media: list[tuple[str, Path]] = []
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "x"
        shutil.unpack_archive(src, work, "zip")
        for p in work.rglob("*"):
            if p.is_symlink():
                p.unlink()
        doc = work / "word/document.xml"
        doc.write_text(fill(doc.read_text(encoding="utf-8"), s, media), encoding="utf-8")
        numbering = work / "word/numbering.xml"
        numbering.write_text(bullet_numbering(numbering.read_text(encoding="utf-8")), encoding="utf-8")
        if media:
            (work / "word/media").mkdir(exist_ok=True)
            rels = work / "word/_rels/document.xml.rels"
            r = rels.read_text(encoding="utf-8")
            add = ""
            for rid, path in media:
                target = f"media/{path.name}"
                shutil.copyfile(path, work / "word" / target)
                add += f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{target}"/>'
            rels.write_text(r.replace("</Relationships>", add + "</Relationships>"), encoding="utf-8")
            ct = work / "[Content_Types].xml"
            c = ct.read_text(encoding="utf-8")
            for ext, mime in (("png", "image/png"), ("jpg", "image/jpeg")):
                if f'Extension="{ext}"' not in c and any(p.suffix == f".{ext}" for _, p in media):
                    c = c.replace('<Default Extension="xml"', f'<Default Extension="{ext}" ContentType="{mime}"/><Default Extension="xml"', 1)
            ct.write_text(c, encoding="utf-8")
        dst.unlink(missing_ok=True)
        subprocess.run(["zip", "-XqrD", str(dst.resolve()), "."], cwd=work, check=True)
    print(f"written {dst} ({len(media)} figures)")


if __name__ == "__main__":
    main()
