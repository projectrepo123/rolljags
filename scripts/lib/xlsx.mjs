// Minimal .xlsx reader.
//
// An .xlsx is a zip of XML parts. Rather than pull in a spreadsheet library for
// what amounts to "read some cells", this walks the zip central directory and
// inflates entries with node's built-in zlib, then parses the handful of parts
// that matter: workbook.xml (tab names + order), workbook.xml.rels (tab -> file),
// sharedStrings.xml (the string pool cells point into), and each worksheet.
//
// Only what these workbooks actually use is supported: shared strings, inline
// strings, numbers, and booleans. Formulas are read via their cached <v> value.

import fs from "node:fs";
import zlib from "node:zlib";

// ---------------------------------------------------------------- zip reading

function findEndOfCentralDirectory(buf) {
  // The EOCD record is at the very end, but a zip comment can follow it, so
  // scan backwards for its signature. 0xFFFF is the max comment length.
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Not a zip file: no end-of-central-directory record");
}

function readEntries(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  let count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  // Zip64: the 32-bit fields saturate and the real values live in the zip64
  // EOCD record. These workbooks are small, but sharp/Excel can emit zip64.
  if (offset === 0xffffffff || count === 0xffff) {
    const locatorSig = 0x07064b50;
    for (let i = eocd - 20; i >= 0; i--) {
      if (buf.readUInt32LE(i) === locatorSig) {
        const zip64Eocd = Number(buf.readBigUInt64LE(i + 8));
        count = Number(buf.readBigUInt64LE(zip64Eocd + 32));
        offset = Number(buf.readBigUInt64LE(zip64Eocd + 48));
        break;
      }
    }
  }

  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);

    entries.set(name, { method, compressedSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, entries, name) {
  const entry = entries.get(name);
  if (!entry) return null;

  // The central directory's extra-field length can differ from the local
  // header's, so the data offset has to come from the local header.
  const lh = entry.localHeaderOffset;
  const nameLen = buf.readUInt16LE(lh + 26);
  const extraLen = buf.readUInt16LE(lh + 28);
  const start = lh + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return raw.toString("utf8");
  if (entry.method === 8) return zlib.inflateRawSync(raw).toString("utf8");
  throw new Error(`Unsupported zip compression method ${entry.method} for ${name}`);
}

// ---------------------------------------------------------------- xml reading

const XML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return XML_ENTITIES[code] ?? whole;
  });
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m ? decodeXml(m[1]) : null;
}

/**
 * Walks every `<tag>` element at any depth, yielding its open tag and inner XML.
 *
 * A regex alternation like `/<c[^>]*>.*?<\/c>|<c[^>]*\/>/` looks equivalent but
 * silently corrupts these files: against a self-closing `<c r="D1"/>` the first
 * branch matches the open tag and then runs on to the *next* cell's `</c>`,
 * swallowing everything between. Spreadsheets are full of self-closing cells for
 * styled-but-empty columns, so that shifts entire rows leftward. Scanning is
 * both correct and cheap. Assumes `tag` is never nested inside itself, which
 * holds for row/c/si/t.
 */
function* elements(xml, tag) {
  const opener = new RegExp(`<${tag}\\b`, "g");
  const closeTag = `</${tag}>`;
  let m;

  while ((m = opener.exec(xml)) !== null) {
    // Find the end of the open tag, ignoring '>' inside quoted attribute values.
    let i = m.index + m[0].length;
    let quoted = false;
    while (i < xml.length) {
      const ch = xml[i];
      if (ch === '"') quoted = !quoted;
      else if (ch === ">" && !quoted) break;
      i++;
    }

    const openTag = xml.slice(m.index, i + 1);
    if (xml[i - 1] === "/") {
      yield { openTag, inner: "" };
      opener.lastIndex = i + 1;
      continue;
    }

    const close = xml.indexOf(closeTag, i + 1);
    if (close === -1) {
      yield { openTag, inner: "" };
      return;
    }
    yield { openTag, inner: xml.slice(i + 1, close) };
    opener.lastIndex = close + closeTag.length;
  }
}

// ------------------------------------------------------------- xlsx specifics

// "BC12" -> 54. Column letters are base-26 with A=1.
function columnIndex(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function textOf(xml) {
  let text = "";
  for (const t of elements(xml, "t")) text += decodeXml(t.inner);
  return text;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  // Each <si> is one string, but rich text splits it across multiple <t> runs
  // that have to be concatenated.
  for (const si of elements(xml, "si")) out.push(textOf(si.inner));
  return out;
}

function parseSheet(xml, shared) {
  const rows = [];

  for (const row of elements(xml, "row")) {
    const rowNum = parseInt(attr(row.openTag, "r") || "0", 10);
    const cells = [];
    let next = 0;

    for (const cell of elements(row.inner, "c")) {
      const ref = attr(cell.openTag, "r");
      const type = attr(cell.openTag, "t");
      const idx = ref ? columnIndex(ref) : next;

      let value = "";
      if (type === "inlineStr") {
        value = textOf(cell.inner);
      } else {
        const v = cell.inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        if (v) {
          const rawValue = decodeXml(v[1]);
          if (type === "s") value = shared[parseInt(rawValue, 10)] ?? "";
          else if (type === "b") value = rawValue === "1" ? "TRUE" : "FALSE";
          else value = rawValue;
        }
      }

      cells[idx] = value;
      next = idx + 1;
    }

    // Fill holes so callers can index by column position.
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    if (rowNum > 0) rows[rowNum - 1] = cells;
  }

  for (let i = 0; i < rows.length; i++) if (rows[i] === undefined) rows[i] = [];
  return rows;
}

/**
 * Reads a workbook into plain arrays.
 *
 * @returns {{name: string, rows: string[][]}[]} sheets in tab order; `rows` is
 *   0-indexed by row and column, with every cell a (possibly empty) string.
 */
export function readWorkbook(path) {
  const buf = fs.readFileSync(path);
  const entries = readEntries(buf);

  const shared = parseSharedStrings(readEntry(buf, entries, "xl/sharedStrings.xml"));

  // rId -> worksheet part, e.g. "rId3" -> "worksheets/sheet2.xml"
  const relsXml = readEntry(buf, entries, "xl/_rels/workbook.xml.rels") || "";
  const rels = new Map();
  for (const rel of elements(relsXml, "Relationship")) {
    rels.set(attr(rel.openTag, "Id"), attr(rel.openTag, "Target"));
  }

  const workbookXml = readEntry(buf, entries, "xl/workbook.xml");
  if (!workbookXml) throw new Error(`${path}: missing xl/workbook.xml`);

  const sheets = [];
  for (const sheetEl of elements(workbookXml, "sheet")) {
    const name = attr(sheetEl.openTag, "name");
    const rid = attr(sheetEl.openTag, "r:id") || attr(sheetEl.openTag, "id");
    const target = rels.get(rid);
    if (!target) continue;

    const part = target.replace(/^\/xl\//, "").replace(/^\//, "");
    const xml = readEntry(buf, entries, `xl/${part}`) || readEntry(buf, entries, part);
    if (!xml) continue;

    sheets.push({ name, rows: parseSheet(xml, shared) });
  }

  return sheets;
}

/** Looks up a sheet by name, tolerating the stray whitespace in these files. */
export function sheet(sheets, name) {
  const want = name.trim().toLowerCase();
  const found = sheets.find((s) => s.name.trim().toLowerCase() === want);
  if (!found) {
    throw new Error(`No sheet named "${name}". Available: ${sheets.map((s) => `"${s.name}"`).join(", ")}`);
  }
  return found;
}

/** True when every cell in the row is empty/whitespace. */
export function isBlankRow(row) {
  return !row || row.every((c) => String(c ?? "").trim() === "");
}
