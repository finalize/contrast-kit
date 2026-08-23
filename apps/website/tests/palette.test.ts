import { expect, test } from "vite-plus/test";
import { contrastRatio, formatHex } from "contrast-kit";
import {
  buildMatrix,
  findIssues,
  formatMetric,
  readSwatches,
  simulateSwatches,
  toCssFix,
} from "../src/palette.ts";

test("カスタムプロパティから色だけを拾う", () => {
  const swatches = readSwatches(`
    --bg: #0b0e0f;
    --font-mono: ui-monospace, Menlo, monospace;
    --accent: #7ee787;
  `);
  expect(swatches).toEqual([
    { name: "--bg", hex: "#0b0e0f" },
    { name: "--accent", hex: "#7ee787" },
  ]);
});

test("3桁の色は6桁に展開して同じ色として扱う", () => {
  expect(readSwatches("--a: #fff; --b: #ffffff;")).toEqual([{ name: "--a", hex: "#ffffff" }]);
});

test("裸の16進表記も読み取る", () => {
  expect(readSwatches("#000000 #ffffff")).toEqual([
    { name: "#000000", hex: "#000000" },
    { name: "#ffffff", hex: "#ffffff" },
  ]);
});

test("行列は対称で、対角は 1", () => {
  const swatches = readSwatches("--a: #000; --b: #fff;");
  const matrix = buildMatrix(swatches);
  expect(matrix[0]![0]).toBeCloseTo(1, 10);
  expect(matrix[0]![1]).toBeCloseTo(matrix[1]![0]!, 10);
  expect(matrix[0]![1]).toBeCloseTo(21, 5);
});

test("AA を満たさない組み合わせを比の小さい順に返す", () => {
  const swatches = readSwatches("--bg: #eef1ee; --accent: #1a7f37; --fg: #1b2220;");
  const issues = findIssues(swatches);

  // 濃い緑は、明るい背景の上でも暗い文字色の上でも本文には足りない
  expect(issues.map((issue) => issue.name)).toEqual(["--accent / --fg", "--bg / --accent"]);
  expect(issues[0]!.ratio).toBeCloseTo(3.19, 2);
  expect(issues[1]!.ratio).toBeCloseTo(4.46, 2);
});

test("問題がなければ空になる", () => {
  expect(findIssues(readSwatches("--a: #000; --b: #fff;"))).toEqual([]);
});

test("失敗した組には修正候補が付く", () => {
  const swatches = readSwatches("--bg: #eef1ee; --accent: #1a7f37;");
  const [issue] = findIssues(swatches);
  expect(issue!.suggestion).toBeDefined();
  expect(issue!.suggestion!.ratio).toBeGreaterThanOrEqual(4.5);
});

test("修正候補を CSS にまとめる", () => {
  const issues = findIssues(readSwatches("--bg: #eef1ee; --accent: #1a7f37;"));
  const css = toCssFix(issues);
  expect(css).toContain(":root {");
  expect(css).toMatch(/--(bg|accent): #[0-9a-f]{6};/u);
});

test("同じ変数が矛盾した値で複数回出ない", () => {
  // --fg-dim が複数の組で失敗する配色
  const swatches = readSwatches(
    "--bg-elev: #131819; --fg-dim: #8b9a93; --accent: #7ee787; --accent-2: #79c0ff; --accent-3: #ffa657;",
  );
  const css = toCssFix(findIssues(swatches));

  const names = [...css.matchAll(/^\s*(--[\w-]+):/gmu)].map((match) => match[1]);
  expect(names.length).toBe(new Set(names).size);
});

test("出力した色は、その変数が関わる失敗した組をすべて満たす", () => {
  const swatches = readSwatches(
    "--bg-elev: #131819; --fg-dim: #8b9a93; --accent: #7ee787; --accent-2: #79c0ff;",
  );
  const issues = findIssues(swatches);
  const css = toCssFix(issues);

  for (const [, name, color] of css.matchAll(/^\s*(--[\w-]+): (#[0-9a-f]{6});/gmu)) {
    const related = issues.filter((issue) => issue.fgName === name);
    for (const issue of related) {
      expect(contrastRatio(color!, formatHex(issue.bg))).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("APCA 指標では別の値になる", () => {
  const swatches = readSwatches("--a: #000000; --b: #ffffff;");
  expect(buildMatrix(swatches, "wcag")[0]![1]).toBeCloseTo(21, 5);
  expect(buildMatrix(swatches, "apca")[0]![1]).toBeCloseTo(106.04, 1);
  expect(formatMetric(106.04, "apca")).toBe("106");
  expect(formatMetric(4.4623, "wcag")).toBe("4.46");
});

test("色覚特性を通すと色が置き換わり、なしなら素通し", () => {
  const swatches = readSwatches("--r: #ff0000; --g: #00ff00;");
  expect(simulateSwatches(swatches, "normal")).toEqual(swatches);

  const deutan = simulateSwatches(swatches, "deuteranopia");
  expect(deutan.map((s) => s.name)).toEqual(["--r", "--g"]);
  expect(deutan[0]!.hex).not.toBe("#ff0000");
});
