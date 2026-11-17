"""Fill the blank Session Capture Form template with fictional test data.

Usage: python3 -I fill_form.py <template.docx> <spec.json> <out.docx>
spec.json maps "table,row,col" -> text. Tables are counted from 0 in body order.
Optional "__replace__": {"old text": "new text"} rewrites text outside the cells
(the title and intro lines), so the Pillar 1 template can be turned into any pillar.
Regenerates the fixtures in ../fixtures; the client in them is fictional.
"""
import json, re, sys, zipfile
from xml.sax.saxutils import escape

tpl, spec_path, out = sys.argv[1:4]
spec = json.load(open(spec_path))
replace = spec.pop("__replace__", {})
zin = zipfile.ZipFile(tpl)
xml = zin.read("word/document.xml").decode()
for old_text, new_text in replace.items():
    xml = xml.replace(escape(old_text), escape(new_text))

def run(text):
    parts = text.split("\n")
    inner = '<w:br/>'.join(f'<w:t xml:space="preserve">{escape(p)}</w:t>' for p in parts)
    return f'<w:r><w:rPr><w:sz w:val="18"/></w:rPr>{inner}</w:r>'

def fill_cell(cell, text):
    m = re.search(r'<w:p(?:\s[^>]*)?>.*?</w:p>', cell, re.S)
    p = m.group(0)
    ppr = re.search(r'<w:pPr>.*?</w:pPr>', p, re.S)
    open_tag = re.match(r'<w:p(?:\s[^>]*)?>', p).group(0)
    newp = open_tag + (ppr.group(0) if ppr else '') + run(text) + '</w:p>'
    return cell[:m.start()] + newp + cell[m.end():]

tables = list(re.finditer(r'<w:tbl(?:\s[^>]*)?>.*?</w:tbl>', xml, re.S))
pieces, last = [], 0
for ti, tm in enumerate(tables):
    tbl = tm.group(0)
    rows = list(re.finditer(r'<w:tr(?:\s[^>]*)?>.*?</w:tr>', tbl, re.S))
    tparts, tlast = [], 0
    for ri, rm in enumerate(rows):
        row = rm.group(0)
        cells = list(re.finditer(r'<w:tc(?:\s[^>]*)?>.*?</w:tc>', row, re.S))
        rparts, rlast = [], 0
        for ci, cm in enumerate(cells):
            key = f"{ti},{ri},{ci}"
            cell = cm.group(0)
            if key in spec:
                cell = fill_cell(cell, spec[key])
            rparts += [row[rlast:cm.start()], cell]; rlast = cm.end()
        rparts.append(row[rlast:])
        tparts += [tbl[tlast:rm.start()], ''.join(rparts)]; tlast = rm.end()
    tparts.append(tbl[tlast:])
    pieces += [xml[last:tm.start()], ''.join(tparts)]; last = tm.end()
pieces.append(xml[last:])
new_xml = ''.join(pieces)

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = new_xml.encode() if item.filename == "word/document.xml" else zin.read(item.filename)
        zout.writestr(item, data)
