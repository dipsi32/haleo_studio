import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// useEffect(() => something()) returns whatever something() returns, and React
// calls a returned value as the cleanup. When a library made window.scrollTo
// return a value, the demo crashed to a blank page on unmount (Nov 2026).
// Effects always get a block body.
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });

describe("effects", () => {
  it("never use an expression body", () => {
    const bad = files(join(process.cwd(), "src")).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => !/^\s*(\/\/|\*)/.test(line) && /useEffect\(\s*\(\)\s*=>\s*[^{\s]/.test(line)),
    );
    expect(bad.map((b) => `${b.f.replace(process.cwd(), "")}:${b.i}`)).toEqual([]);
  });
});
