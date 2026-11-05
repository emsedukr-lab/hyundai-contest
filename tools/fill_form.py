"""Fills section 02 of the official application DOCX from submission/기획서_초안.md.

Only the app name lines and the eight answer boxes are written; personal details, consent and signatures stay
blank for the applicants. The answer boxes are plain-text content controls, filled in document order (their
internal aliases differ from the visible headings, which are what reviewers read).

Usage: python3 tools/fill_form.py <official.docx> <out.docx>
"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "submission/기획서_초안.md"


def sections(md: str) -> dict[str, list[str]]:
    out, key = {}, None
    for line in md.splitlines():
        m = re.match(r"^## (.+)$", line)
        if m:
            key = m.group(1).split(".")[0].strip()
            out[key] = []
        elif key and line.strip():
            out[key].append(line.strip())
    return out


def runs(lines: list[str]) -> str:
    parts = []
    for i, line in enumerate(lines):
        if i:
            parts.append("<w:r><w:br/></w:r>")
        parts.append(f'<w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r>')
    return "".join(parts)


def fill(xml: str, s: dict[str, list[str]]) -> str:
    answers = [s[str(i)] for i in range(1, 9)]
    sdts = list(re.finditer(r"<w:sdt>.*?</w:sdt>", xml, re.S))
    if len(sdts) != 8:
        raise SystemExit(f"expected 8 answer boxes, found {len(sdts)}")
    for m, lines in reversed(list(zip(sdts, answers))):
        block = m.group(0)
        block = re.sub(r"<w:text\s*/>", '<w:text w:multiLine="1"/>', block)
        block = re.sub(r"<w:sdtContent>.*?</w:sdtContent>", f"<w:sdtContent>{runs(lines)}</w:sdtContent>", block, flags=re.S)
        block = block.replace("<w:showingPlcHdr/>", "")
        xml = xml[: m.start()] + block + xml[m.end() :]

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
    s = sections(SOURCE.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "x"
        shutil.unpack_archive(src, work, "zip")
        for p in work.rglob("*"):
            if p.is_symlink():
                p.unlink()
        doc = work / "word/document.xml"
        doc.write_text(fill(doc.read_text(encoding="utf-8"), s), encoding="utf-8")
        dst.unlink(missing_ok=True)
        subprocess.run(["zip", "-Xqr", str(dst.resolve()), "."], cwd=work, check=True)
    print(f"written {dst}")


if __name__ == "__main__":
    main()
