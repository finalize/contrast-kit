import { expect, test } from "vite-plus/test";
import {
  auditPairs,
  contrastRatio,
  extractRuleBlock,
  formatHex,
  meetsAA,
  parseCssVariables,
  parseHex,
  relativeLuminance,
  wcagLevel,
} from "../src/index.ts";

test("黒と白のコントラスト比は 21", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
});

test("同じ色どうしは 1", () => {
  expect(contrastRatio("#eef1ee", "#eef1ee")).toBeCloseTo(1, 5);
});

test("引数の順序は結果に影響しない", () => {
  expect(contrastRatio("#1a7f37", "#eef1ee")).toBeCloseTo(contrastRatio("#eef1ee", "#1a7f37"), 10);
});

// 実例: portfolio のライトテーマで AA を割っていた組み合わせと、その修正後
test("4.5:1 をわずかに割る組み合わせを fail と判定する", () => {
  const ratio = contrastRatio("#1a7f37", "#eef1ee");
  expect(ratio).toBeCloseTo(4.46, 2);
  expect(wcagLevel(ratio)).toBe("fail");
});

test("修正後の色は AA を満たす", () => {
  const ratio = contrastRatio("#1a7e37", "#eef1ee");
  expect(ratio).toBeCloseTo(4.52, 2);
  expect(wcagLevel(ratio)).toBe("AA");
});

test("大きい文字なら 3:1 で AA", () => {
  const ratio = contrastRatio("#767676", "#ffffff");
  expect(wcagLevel(ratio, { large: true })).toBe("AAA");
  expect(wcagLevel(ratio)).toBe("AA");
});

test("3桁の16進表記を展開する", () => {
  expect(parseHex("#1a7")).toEqual({ r: 0x11, g: 0xaa, b: 0x77 });
  expect(parseHex("fff")).toEqual({ r: 255, g: 255, b: 255 });
});

test("解釈できない文字列は TypeError", () => {
  expect(() => parseHex("#12345")).toThrow(TypeError);
  expect(() => parseHex("rebeccapurple")).toThrow(TypeError);
});

test("相対輝度は黒が 0、白が 1", () => {
  expect(relativeLuminance("#000")).toBe(0);
  expect(relativeLuminance("#fff")).toBeCloseTo(1, 10);
});

test("Rgb オブジェクトも受け付ける", () => {
  expect(meetsAA({ r: 0, g: 0, b: 0 }, "#ffffff")).toBe(true);
});

test("セレクタのルール本体を取り出す", () => {
  const css = `:root { --bg: #fff; }\n:root[data-theme="light"] { --bg: #eee; }`;
  expect(extractRuleBlock(css, ':root[data-theme="light"]')?.trim()).toBe("--bg: #eee;");
  expect(extractRuleBlock(css, ".missing")).toBeUndefined();
});

test("カスタムプロパティを名前と値に分解する", () => {
  const css = `
    /* コメントは無視する */
    --bg: #0b0e0f;
    --font-mono: ui-monospace, Menlo, monospace;
    --accent:#7ee787;
  `;
  expect(parseCssVariables(css)).toEqual({
    "--bg": "#0b0e0f",
    "--font-mono": "ui-monospace, Menlo, monospace",
    "--accent": "#7ee787",
  });
});

test("複数の組み合わせをまとめて検査する", () => {
  const results = auditPairs([
    { name: "fg on bg", fg: "#1b2220", bg: "#eef1ee" },
    { name: "accent on bg", fg: "#1a7f37", bg: "#eef1ee" },
    { name: "accent on bg (large)", fg: "#1a7f37", bg: "#eef1ee", large: true },
  ]);

  expect(results.map((r) => r.passes)).toEqual([true, false, true]);
  expect(results[1]!.ratio).toBeCloseTo(4.46, 2);
  expect(results[2]!.level).toBe("AA");
});

test("name を省略すると色から自動で埋まる", () => {
  const [result] = auditPairs([{ fg: "#000", bg: "#fff" }]);
  expect(result!.name).toBe("#000000 on #ffffff");
});

test("formatHex は 3桁も Rgb も 6桁の hex にする", () => {
  expect(formatHex("#1a7")).toBe("#11aa77");
  expect(formatHex({ r: 26, g: 127, b: 55 })).toBe("#1a7f37");
});
