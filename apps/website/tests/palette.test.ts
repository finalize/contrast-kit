import { expect, test } from "vite-plus/test";
import { buildMatrix, findIssues, readSwatches } from "../src/palette.ts";

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
