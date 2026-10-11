import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { loadDotEnvFiles, parseDotEnv, serializeDotEnv } from "./dotenv";

describe("parseDotEnv", () => {
  it("parses unquoted values, ignoring comments and blank lines", () => {
    const parsed = parseDotEnv(`
    # Ignored
    A=hello

    B=world   # inline comment
    C = spaced
    export D=exported
    E=url#fragment
    F=
    not a valid line
    `);
    expect(parsed).toEqual({ A: "hello", B: "world", C: "spaced", D: "exported", E: "url#fragment", F: "" });
  });

  it("parses double-quoted values with escapes and multiple lines", () => {
    const parsed = parseDotEnv('A="line1\\nline2 \\"q\\" # kept"\nB="multi\nline"\nC=after');
    expect(parsed).toEqual({ A: 'line1\nline2 "q" # kept', B: "multi\nline", C: "after" });
  });

  it("parses single-quoted values literally, except for \\' and \\\\", () => {
    const parsed = parseDotEnv("A='it\\'s \\\\ \\n'\nB='multi\nline'");
    expect(parsed).toEqual({ A: "it's \\ \\n", B: "multi\nline" });
  });

  it("never expands variables or runs commands", () => {
    const parsed = parseDotEnv('A=$(whoami)\nB="${HOME}"\nC=`id`');
    expect(parsed).toEqual({ A: "$(whoami)", B: "${HOME}", C: "`id`" });
  });

  it("handles CRLF line endings", () => {
    expect(parseDotEnv("A=1\r\nB='2'\r\n")).toEqual({ A: "1", B: "2" });
  });
});

describe("serializeDotEnv", () => {
  it("round-trips arbitrary values", () => {
    const vars = {
      A: "plain",
      B: "it's $(whoami) ${HOME} # not a comment",
      C: "back\\slash\\'q",
      D: "multi\nline",
      E: "",
      F: '"double"',
    };
    expect(parseDotEnv(serializeDotEnv(vars))).toEqual(vars);
  });
});

describe("loadDotEnvFiles", () => {
  it("gives precedence to earlier files and skips missing ones", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dotenv-spec-"));
    try {
      const first = path.join(dir, ".env.first");
      const second = path.join(dir, ".env.second");
      fs.writeFileSync(first, "A=first\nB=first");
      fs.writeFileSync(second, "B=second\nC=second");
      expect(loadDotEnvFiles([first, path.join(dir, "missing"), second])).toEqual({
        A: "first",
        B: "first",
        C: "second",
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
