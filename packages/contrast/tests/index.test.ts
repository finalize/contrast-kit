import { expect, test } from "vite-plus/test";
import {
  auditPairs,
  contrastRatio,
  extractRuleBlock,
  apcaContrast,
  colorDistance,
  fromOklab,
  formatHex,
  nearestColor,
  distancesAcrossVision,
  simulateColorVision,
  suggestAccessible,
  toOklab,
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

test("OKLab は黒が 0、白が 1", () => {
  expect(toOklab("#000").L).toBeCloseTo(0, 10);
  expect(toOklab("#fff").L).toBeCloseTo(1, 6);
  expect(toOklab("#fff").a).toBeCloseTo(0, 6);
  expect(toOklab("#fff").b).toBeCloseTo(0, 6);
});

test("知覚的な明度は相対輝度と別物", () => {
  // 中間グレーは、見た目には「半分の明るさ」だが線形光では 2 割強しかない
  expect(toOklab("#808080").L).toBeCloseTo(0.6, 2);
  expect(relativeLuminance("#808080")).toBeCloseTo(0.216, 3);
});

test("同じ色の距離は 0、白と黒は離れている", () => {
  expect(colorDistance("#1a7f37", "#1a7f37")).toBe(0);
  expect(colorDistance("#000", "#fff")).toBeCloseTo(1, 6);
  expect(colorDistance("#1a7f37", "#1a7e37")).toBeLessThan(0.01);
});

test("パレットから最も近い色を選ぶ", () => {
  const palette = ["#0b0e0f", "#cfd8d3", "#7ee787", "#79c0ff"];
  expect(nearestColor("#80ee88", palette)).toBe("#7ee787");
  expect(nearestColor("#101314", palette)).toBe("#0b0e0f");
  expect(() => nearestColor("#fff", [])).toThrow(TypeError);
});

test("APCA は公表されている参照値と一致する", () => {
  // https://github.com/Myndex/apca-w3 の参照値
  expect(apcaContrast("#000000", "#ffffff")).toBeCloseTo(106.04, 2);
  expect(apcaContrast("#ffffff", "#000000")).toBeCloseTo(-107.88, 2);
  expect(apcaContrast("#888888", "#ffffff")).toBeCloseTo(63.06, 2);
});

test("APCA は前景と背景を入れ替えると符号が変わる", () => {
  const dark = apcaContrast("#111111", "#eeeeee");
  const light = apcaContrast("#eeeeee", "#111111");
  expect(dark).toBeGreaterThan(0);
  expect(light).toBeLessThan(0);
});

test("APCA は同じ色なら 0", () => {
  expect(apcaContrast("#7ee787", "#7ee787")).toBe(0);
});

test("OKLab は往復しても元の色に戻る", () => {
  for (const color of ["#1a7f37", "#eef1ee", "#000000", "#ffffff", "#79c0ff"]) {
    expect(formatHex(fromOklab(toOklab(color)))).toBe(color);
  }
});

test("基準を満たしていれば元の色をそのまま返す", () => {
  const result = suggestAccessible("#1b2220", "#eef1ee");
  expect(result!.color).toBe("#1b2220");
  expect(result!.distance).toBe(0);
});

test("足りない色には、基準を満たす最も近い色を提案する", () => {
  // 今日このサイトで実際に 4.46 で落ちた組み合わせ
  const result = suggestAccessible("#1a7f37", "#eef1ee")!;
  expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  expect(result.level).toBe("AA");
  // 色相を保ったまま明度だけを動かすので、変化はごくわずか
  expect(result.distance).toBeLessThan(0.02);
});

test("大きい文字や AAA では目標値が変わる", () => {
  const aa = suggestAccessible("#1a7f37", "#eef1ee")!;
  const aaa = suggestAccessible("#1a7f37", "#eef1ee", { level: "AAA" })!;
  expect(aaa.ratio).toBeGreaterThanOrEqual(7);
  expect(aaa.distance).toBeGreaterThan(aa.distance);
  // 大きい文字なら 3:1 でよいので、元の色のままで通る
  expect(suggestAccessible("#1a7f37", "#eef1ee", { large: true })!.distance).toBe(0);
});

test("明度を振り切っても届かない場合は undefined", () => {
  // 中間グレーの背景に対して AAA（7:1）は、明度をどちらに振っても届かない
  expect(suggestAccessible("#808080", "#808080", { level: "AAA" })).toBeUndefined();
});

test("色覚シミュレーションで無彩色は変わらない", () => {
  // 行列の各行の合計が 1 なので、無彩色はそのまま通る
  for (const type of ["protanopia", "deuteranopia", "tritanopia"] as const) {
    expect(simulateColorVision("#808080", type)).toBe("#808080");
    expect(simulateColorVision("#000000", type)).toBe("#000000");
    expect(simulateColorVision("#ffffff", type)).toBe("#ffffff");
  }
});

test("1型・2型では赤と緑が近づき、3型では近づかない", () => {
  const normal = colorDistance("#ff0000", "#00ff00");
  const deutan = colorDistance(
    simulateColorVision("#ff0000", "deuteranopia"),
    simulateColorVision("#00ff00", "deuteranopia"),
  );
  const tritan = colorDistance(
    simulateColorVision("#ff0000", "tritanopia"),
    simulateColorVision("#00ff00", "tritanopia"),
  );

  expect(deutan).toBeLessThan(normal / 2);
  // 3型は青黄の特性なので、赤と緑の区別は保たれる
  expect(tritan).toBeGreaterThan(deutan);
});

test("最も見分けづらくなる特性を先頭に返す", () => {
  const [worst] = distancesAcrossVision("#ff0000", "#00ff00");
  expect(worst!.type).toBe("deuteranopia");

  const results = distancesAcrossVision("#000000", "#ffffff");
  expect(results).toHaveLength(4);
  // 白黒はどの特性でも変わらないので、距離は全部同じ
  expect(new Set(results.map((r) => r.distance.toFixed(6))).size).toBe(1);
});
