"""Fills section 02 of the official application DOCX from submission/기획서_초안.md.

Only the app name lines and the eight answer boxes are written; personal details, consent and signatures stay
blank for the applicants. The answer boxes are plain-text content controls, filled in document order (their
internal aliases differ from the visible headings, which are what reviewers read).

A line `![caption](figures/x.png)` (optionally followed by `{60%}` for a narrower picture) under a section is a figure: it goes into the same answer box, after the text,
as an inline picture at the box's width with a "그림 N." caption under it. A plain-text control cannot hold a
picture, so figures are added as paragraphs of the box's table cell, and the box's row is allowed to break across
pages (the template marks it cantSplit, which a box taller than a page cannot honour).

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
# The answer box is 9866 dxa wide with 110 dxa margins on each side; 1 dxa = 635 EMU.
MAX_EMU = (9866 - 220 - 40) * 635


def sections(md: str) -> tuple[dict[str, list[str]], dict[str, list[tuple[str, str, int]]]]:
    out, figs, key = {}, {}, None
    for line in md.splitlines():
        m = re.match(r"^## (.+)$", line)
        if m:
            key = m.group(1).split(".")[0].strip()
            out[key] = []
            figs[key] = []
        elif key and line.strip():
            f = FIGURE.match(line.strip())
            if f:
                figs[key].append((f.group(1), f.group(2), int(f.group(3) or 100)))
            else:
                out[key].append(line.strip())
    return out, figs


def runs(lines: list[str]) -> str:
    parts = []
    for i, line in enumerate(lines):
        if i:
            parts.append("<w:r><w:br/></w:r>")
        parts.append(f'<w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r>')
    return "".join(parts)


def png_size(path: Path) -> tuple[int, int]:
    head = path.read_bytes()[:24]
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"not a PNG: {path}")
    return struct.unpack(">II", head[16:24])


def figure_xml(n: int, rid: str, path: Path, caption: str, pct: int = 100) -> str:
    w, h = png_size(path)
    cx = MAX_EMU * pct // 100
    cy = round(cx * h / w)
    cap = escape(caption)
    pic = (
        f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
        f'<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{9000 + n}" name="그림 {n}" descr="{cap}"/>'
        f'<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{9000 + n}" name="{escape(path.name)}" descr="{cap}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
        f'</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    )
    text = (
        f'<w:p><w:pPr><w:spacing w:before="0" w:after="160" w:line="260" w:lineRule="exact"/><w:jc w:val="center"/></w:pPr>'
        f'<w:r><w:rPr><w:b/><w:color w:val="16324F"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr><w:t xml:space="preserve">그림 {n}. </w:t></w:r>'
        f'<w:r><w:rPr><w:color w:val="5B6574"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr><w:t xml:space="preserve">{cap}</w:t></w:r></w:p>'
    )
    return pic + text


def fill(xml: str, s: dict[str, list[str]], figures: dict[str, list[tuple[str, str, int]]], media: list[tuple[str, Path]]) -> str:
    answers = [s[str(i)] for i in range(1, 9)]
    sdts = list(re.finditer(r"<w:sdt>.*?</w:sdt>", xml, re.S))
    if len(sdts) != 8:
        raise SystemExit(f"expected 8 answer boxes, found {len(sdts)}")
    # Number the figures in reading order before filling from the back (so offsets stay valid).
    numbered: dict[int, list[tuple[int, str, Path, int]]] = {}
    n = 0
    for k in range(8):
        for caption, rel, pct in figures.get(str(k + 1), []):
            n += 1
            path = (SOURCE.parent / rel).resolve()
            if not path.exists():
                raise SystemExit(f"figure not found: {rel}")
            numbered.setdefault(k, []).append((n, caption, path, pct))
    for k, (m, lines) in reversed(list(enumerate(zip(sdts, answers)))):
        block = m.group(0)
        block = re.sub(r"<w:text\s*/>", '<w:text w:multiLine="1"/>', block)
        block = re.sub(r"<w:sdtContent>.*?</w:sdtContent>", f"<w:sdtContent>{runs(lines)}</w:sdtContent>", block, flags=re.S)
        block = block.replace("<w:showingPlcHdr/>", "")
        xml = xml[: m.start()] + block + xml[m.end() :]
        figs = numbered.get(k)
        if not figs:
            continue
        # The figures follow the box's paragraph inside the same cell; the row may then break across pages.
        end_p = xml.index("</w:p>", m.start()) + len("</w:p>")
        parts = []
        for num, caption, path, pct in figs:
            rid = f"rIdFig{num}"
            media.append((rid, path))
            parts.append(figure_xml(num, rid, path, caption, pct))
        xml = xml[:end_p] + "".join(parts) + xml[end_p:]
        row_start = xml.rfind("<w:tr ", 0, m.start())
        trpr_end = xml.index("</w:trPr>", row_start)
        xml = xml[:row_start] + xml[row_start:trpr_end].replace("<w:cantSplit/>", "") + xml[trpr_end:]

    # "앱명 / 프로젝트명: ____" lines (sections 01, 02 and 04): keep the label, replace the blanks with the name.
    name = escape(s["앱명"][0])

    def name_line(p: re.Match) -> str:
        para = p.group(0)
        if "프로젝트명" not in "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", para)):
            return para
        para = re.sub(r"(<w:t[^>]*>[^<]*프로젝트명:\s*)_+", lambda q: q.group(1) + name, para, count=1)
        return re.sub(r"(<w:t[^>]*>)_+(</w:t>)", r"\1\2", para)

    return re.sub(r"<w:p [^>]*>(?:(?!</w:p>).)*앱명(?:(?!</w:p>).)*</w:p>", name_line, xml, flags=re.S)


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    s, figures = sections(SOURCE.read_text(encoding="utf-8"))
    media: list[tuple[str, Path]] = []
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "x"
        shutil.unpack_archive(src, work, "zip")
        for p in work.rglob("*"):
            if p.is_symlink():
                p.unlink()
        doc = work / "word/document.xml"
        doc.write_text(fill(doc.read_text(encoding="utf-8"), s, figures, media), encoding="utf-8")
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
            if 'Extension="png"' not in c:
                ct.write_text(c.replace("<Default Extension=\"xml\"", '<Default Extension="png" ContentType="image/png"/><Default Extension="xml"', 1), encoding="utf-8")
        dst.unlink(missing_ok=True)
        subprocess.run(["zip", "-XqrD", str(dst.resolve()), "."], cwd=work, check=True)
    print(f"written {dst} ({len(media)} figures)")


if __name__ == "__main__":
    main()
