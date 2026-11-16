// Minimal .docx reader: pulls word/document.xml out of the zip and returns
// the body as an ordered list of paragraphs and tables. No dependency; the
// Session Capture Form only needs text, paragraphs and table cells.

import { inflateRawSync } from "node:zlib";

export type DocxBlock = { kind: "p"; text: string } | { kind: "table"; rows: string[][] };

const MAX_XML_BYTES = 20 * 1024 * 1024;

export function readZipEntry(buf: Buffer, name: string): Buffer {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a .docx file: no zip directory found");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error("Not a .docx file: corrupt zip directory");
    }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const entryName = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (entryName === name) {
      const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES });
      throw new Error(`Unsupported zip compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`Not a .docx file: ${name} missing`);
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

const PARAGRAPH = /<w:p(?:\s[^>]*?)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;

function paragraphText(p: string): string {
  let out = "";
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  for (const m of p.matchAll(re)) {
    if (m[1] !== undefined) out += decodeXml(m[1]);
    else out += m[0] === "<w:tab/>" ? " " : "\n";
  }
  return out.trim();
}

function cellText(cell: string): string {
  return (cell.match(PARAGRAPH) ?? [])
    .map(paragraphText)
    .filter((t) => t.length > 0)
    .join("\n");
}

export function parseDocumentXml(xml: string): DocxBlock[] {
  const bodyStart = xml.indexOf("<w:body>");
  const body = bodyStart >= 0 ? xml.slice(bodyStart) : xml;
  const blocks: DocxBlock[] = [];
  const re = /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*?)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  for (const m of body.matchAll(re)) {
    const b = m[0];
    if (b.startsWith("<w:tbl")) {
      const rows = (b.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) ?? []).map((r) =>
        (r.match(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g) ?? []).map(cellText),
      );
      blocks.push({ kind: "table", rows });
    } else {
      const text = paragraphText(b);
      if (text) blocks.push({ kind: "p", text });
    }
  }
  return blocks;
}

export function readDocx(buf: Buffer): DocxBlock[] {
  return parseDocumentXml(readZipEntry(buf, "word/document.xml").toString("utf8"));
}
