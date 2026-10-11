import fs from "fs";

/**
 * A minimal .env parser. Values are taken literally: there is no variable expansion and no command substitution.
 *
 * Supported syntax:
 *   KEY=value            unquoted; a ` #` starts an inline comment; surrounding whitespace is trimmed
 *   KEY="value"          double-quoted; supports \n \r \t \" \\ escapes; may span multiple lines
 *   KEY='value'          single-quoted; supports \' \\ escapes (same as python-dotenv); may span multiple lines
 *   export KEY=value     the `export` prefix is ignored
 *   # comment            full-line comments and blank lines are ignored
 */
export function parseDotEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const src = text.replace(/\r\n?/g, "\n");
  const lineStart = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*/;
  let pos = 0;

  while (pos < src.length) {
    const lineEnd = src.indexOf("\n", pos) === -1 ? src.length : src.indexOf("\n", pos);
    const match = lineStart.exec(src.slice(pos, lineEnd));
    if (!match) {
      pos = lineEnd + 1;
      continue;
    }
    const key = match[1];
    const valueStart = pos + match[0].length;
    const quote = src[valueStart];

    if (quote === '"' || quote === "'") {
      const { value, end } = readQuoted(src, valueStart + 1, quote);
      if (end !== -1) {
        result[key] = value;
        const nextLine = src.indexOf("\n", end);
        pos = nextLine === -1 ? src.length : nextLine + 1;
        continue;
      }
      // Unterminated quote: fall back to treating the rest of the line as an unquoted value
    }

    result[key] = src.slice(valueStart, lineEnd).replace(/(^|[ \t])#.*$/, "").trim();
    pos = lineEnd + 1;
  }
  return result;
}

function readQuoted(src: string, start: number, quote: string) {
  const doubleQuotedEscapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" };
  let value = "";
  for (let i = start; i < src.length; ++i) {
    const ch = src[i];
    if (ch === quote) return { value, end: i + 1 };
    if (ch === "\\" && i + 1 < src.length) {
      const next = src[i + 1];
      if (quote === "'" && (next === "'" || next === "\\")) {
        value += next;
        ++i;
        continue;
      }
      if (quote === '"' && doubleQuotedEscapes[next] !== undefined) {
        value += doubleQuotedEscapes[next];
        ++i;
        continue;
      }
    }
    value += ch;
  }
  return { value, end: -1 };
}

/** Serializes to single-quoted lines, which both parseDotEnv and python-dotenv read back losslessly */
export function serializeDotEnv(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}='${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`)
    .join("\n");
}

/** Loads the given .env files. When a key appears in multiple files, the first file wins. Missing files are skipped. */
export function loadDotEnvFiles(paths: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of paths) {
    if (!fs.existsSync(path)) continue;
    const parsed = parseDotEnv(fs.readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in result)) result[key] = value;
    }
  }
  return result;
}
