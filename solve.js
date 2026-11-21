// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Same answers as csv-reader on every input, reached a different way: the
// reference walks the text one character at a time, building each field with
// string appends; this reader jumps between field boundaries with indexOf
// and cuts fields out with slice, so the common case (a plain field, a
// quoted field with no line breaks inside) costs a few native scans instead
// of a JavaScript loop per character. Nothing is cached between calls: each
// run(input) reads its own text from scratch and returns a fresh answer.
//
// Policy, as csv-reader defines it:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field opening with a quote runs to the next quote that is not doubled,
//     "" inside is one quote, each CRLF or lone CR inside reads as LF; what
//     follows the closing quote up to the next comma or line break is appended
//     as it stands (quote_junk, when the field ends); a quote that never
//     closes is a literal and the text after it is re-read as unquoted
//     (unterminated_quote);
//   - a quote inside an unquoted field is a literal;
//   - fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds
//     the records after it, each padded (short_row, with fields: its count)
//     or cut (long_row, with extra: the cut fields) to the first record's
//     width; each error is {code, line, row}, line the 1-based line its
//     record starts on, row its index in rows (null for the header).

const END_COMMA = 0;
const END_BREAK = 1;
const END_EOF = 2;

const C_COMMA = 44; // ,
const C_QUOTE = 34; // "
const C_LF = 10; // \n
const C_CR = 13; // \r
const C_BOM = 0xfeff;

/** csv-reader 1.0.0's answer for one case's input, {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === C_BOM) pos = 1;

  // The record being read: the line it starts on, its index in rows.
  let recLine = 1;
  let recRow = null;

  // The field just read, written by readPlain / readQuoted so the hot loop
  // allocates nothing per field. fAdded counts the characters readPlain kept
  // beyond the string it started with (a dropped stray CR adds none).
  let fValue = '';
  let fEnded = END_EOF;
  let fAdded = 0;

  // A quoted segment's converted text and how many lines it held, written
  // by convertSegment.
  let segText = '';
  let segLines = 0;

  function pushErr(code) {
    errors.push({ code, line: recLine, row: recRow });
  }

  // The text in [a, b) with each CRLF or lone CR read as one LF; segLines
  // counts the line breaks it held. The usual segment holds no line break
  // at all and is returned as one slice.
  function convertSegment(a, b) {
    const s = text.slice(a, b);
    if (s.indexOf('\r') === -1 && s.indexOf('\n') === -1) {
      segText = s;
      segLines = 0;
      return;
    }
    const parts = s.split(/\r\n|\r|\n/);
    segLines = parts.length - 1;
    segText = parts.join('\n');
  }

  // Read an unquoted field starting at pos, with `first` already in it:
  // a comma, a line break or the end of the text ends it. A CR not followed
  // by LF is dropped and reported (stray_cr); the scan resumes after it.
  // Only the comma is searched for outright; whether a line break comes
  // before it is read off the stretch the comma ends, so no search ever
  // runs past the field (in a file of LF breaks the next CR could be
  // thousands of characters away).
  function readPlain(first) {
    let parts = null; // value built across dropped CRs, null while untouched
    let seg = pos; // start of the unscanned stretch
    for (;;) {
      const ci = text.indexOf(',', seg);
      if (ci !== -1) {
        const s = text.slice(seg, ci);
        const ni = s.indexOf('\n');
        const ri = s.indexOf('\r');
        if (ni === -1 && ri === -1) {
          fValue = parts === null ? (first ? first + s : s) : parts + s;
          fAdded = fValue.length - first.length;
          pos = ci + 1;
          fEnded = END_COMMA;
          return;
        }
        if (ni !== -1) {
          // A line break comes before the comma: the field ends there, a CR
          // just before it being the break's CRLF.
          const end = ni > 0 && s.charCodeAt(ni - 1) === C_CR ? ni - 1 : ni;
          if (ri !== -1 && ri < end) {
            pushErr('stray_cr');
            parts = parts === null ? (first ? first + s.slice(0, ri) : s.slice(0, ri)) : parts + s.slice(0, ri);
            pos = seg + ri + 1;
            seg = seg + ri + 1;
            continue;
          }
          const v = s.slice(0, end);
          fValue = parts === null ? (first ? first + v : v) : parts + v;
          fAdded = fValue.length - first.length;
          pos = seg + ni + 1;
          line += 1;
          fEnded = END_BREAK;
          return;
        }
        // Only a CR before the comma: a stray one, dropped.
        pushErr('stray_cr');
        parts = parts === null ? (first ? first + s.slice(0, ri) : s.slice(0, ri)) : parts + s.slice(0, ri);
        pos = seg + ri + 1;
        seg = seg + ri + 1;
        continue;
      }
      // No comma ahead: the field ends at a line break or the end of the text.
      const li = text.indexOf('\n', seg);
      if (li === -1) {
        const s = text.slice(seg);
        const ri = s.indexOf('\r');
        if (ri === -1) {
          fValue = parts === null ? (first ? first + s : s) : parts + s;
          fAdded = fValue.length - first.length;
          pos = n;
          fEnded = END_EOF;
          return;
        }
        pushErr('stray_cr');
        parts = parts === null ? (first ? first + s.slice(0, ri) : s.slice(0, ri)) : parts + s.slice(0, ri);
        pos = seg + ri + 1;
        seg = seg + ri + 1;
        continue;
      }
      const end = li > seg && text.charCodeAt(li - 1) === C_CR ? li - 1 : li;
      const s = text.slice(seg, end);
      const ri = s.indexOf('\r');
      if (ri === -1) {
        fValue = parts === null ? (first ? first + s : s) : parts + s;
        fAdded = fValue.length - first.length;
        pos = li + 1;
        line += 1;
        fEnded = END_BREAK;
        return;
      }
      pushErr('stray_cr');
      parts = parts === null ? (first ? first + s.slice(0, ri) : s.slice(0, ri)) : parts + s.slice(0, ri);
      pos = seg + ri + 1;
      seg = seg + ri + 1;
    }
  }

  // Read a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    let acc = null; // converted value built across doubled quotes
    let seg = pos + 1; // start of the unscanned stretch inside the quotes
    let lineDelta = 0; // lines held by the stretches scanned so far
    let p = pos + 1;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal, and the text after it is
        // read again as unquoted. The lines the failed scan crossed are
        // un-counted (line was never moved) and counted again by the re-read.
        pos = open + 1;
        pushErr('unterminated_quote');
        readPlain('"');
        return;
      }
      if (text.charCodeAt(q + 1) === C_QUOTE) {
        // A doubled quote: one quote in the value, and the scan goes on.
        convertSegment(seg, q);
        acc = acc === null ? segText + '"' : acc + segText + '"';
        lineDelta += segLines;
        p = q + 2;
        seg = q + 2;
        continue;
      }
      convertSegment(seg, q);
      const value = acc === null ? segText : acc + segText;
      line += lineDelta + segLines;
      pos = q + 1;
      if (pos >= n) {
        fValue = value;
        fEnded = END_EOF;
        fAdded = 0;
        return;
      }
      const c = text.charCodeAt(pos);
      if (c === C_COMMA) {
        pos += 1;
        fValue = value;
        fEnded = END_COMMA;
        fAdded = 0;
        return;
      }
      if (c === C_LF) {
        pos += 1;
        line += 1;
        fValue = value;
        fEnded = END_BREAK;
        fAdded = 0;
        return;
      }
      if (c === C_CR && text.charCodeAt(pos + 1) === C_LF) {
        pos += 2;
        line += 1;
        fValue = value;
        fEnded = END_BREAK;
        fAdded = 0;
        return;
      }
      // What follows the closing quote is appended as it stands, up to the
      // next comma or line break.
      readPlain(value);
      if (fAdded > 0) pushErr('quote_junk');
      return;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === C_LF) {
        pos += 1;
        line += 1;
      } else if (c === C_CR && text.charCodeAt(pos + 1) === C_LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recLine = line;
    recRow = header && columns === null ? null : rows.length;

    // Fast path: when the record's line holds no quote at all, no quoted
    // field can open on it, so the whole record is this line's comma-separated
    // fields. A trailing CR is the line's CRLF, except at the end of the
    // text, where it is a lone CR and is dropped (stray_cr).
    const nl = text.indexOf('\n', pos);
    const e = nl === -1 ? n : nl;
    const bodyEnd = e > pos && text.charCodeAt(e - 1) === C_CR ? e - 1 : e;
    const lineStr = text.slice(pos, bodyEnd);
    let fields;
    if (lineStr.indexOf('"') === -1 && lineStr.indexOf('\r') === -1) {
      if (lineStr === '') {
        if (nl === -1 && bodyEnd < e) pushErr('stray_cr');
        pos = nl === -1 ? n : nl + 1;
        if (nl !== -1) line += 1;
        continue;
      }
      if (nl === -1 && bodyEnd < e) pushErr('stray_cr');
      fields = lineStr.split(',');
      pos = nl === -1 ? n : nl + 1;
      if (nl !== -1) line += 1;
    } else {
      fields = [];
      let quoted = false;
      for (;;) {
        quoted = text.charCodeAt(pos) === C_QUOTE;
        if (quoted) readQuoted();
        else readPlain('');
        fields.push(fValue);
        if (fEnded !== END_COMMA) break;
      }

      // A line that held only stray CRs is left with no characters: no record
      // (its stray_cr errors stay).
      if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    }

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
