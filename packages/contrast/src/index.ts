/** sRGB の各チャンネル（0-255） */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 色の指定方法。16進表記（#rgb / #rrggbb）か Rgb オブジェクト */
export type ColorInput = string | Rgb;

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * 16進表記を Rgb に変換する。`#1a7f37` と `#1a7` のどちらも受け付ける。
 * @throws 解釈できない文字列を渡した場合
 */
export function parseHex(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) {
    throw new TypeError(`色として解釈できません: ${JSON.stringify(hex)}`);
  }

  const digits = match[1]!;
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function toRgb(color: ColorInput): Rgb {
  return typeof color === "string" ? parseHex(color) : color;
}

/** sRGB のチャンネル値（0-255）を線形値に戻す */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * 相対輝度（WCAG 2.x の定義）。黒が 0、白が 1。
 */
export function relativeLuminance(color: ColorInput): number {
  const { r, g, b } = toRgb(color);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * 2色のコントラスト比。1（同色）から 21（黒と白）のあいだの値を返す。
 * 引数の順序は結果に影響しない。
 */
export function contrastRatio(a: ColorInput, b: ColorInput): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 判定に使う文字サイズ。large = 18pt 以上、または 14pt 以上の太字 */
export interface WcagOptions {
  large?: boolean;
}

/** 満たしている最も高い水準。どれも満たさない場合は "fail" */
export type WcagLevel = "AAA" | "AA" | "fail";

/** WCAG 2.x の要求値。[AA, AAA] の順 */
const THRESHOLDS = {
  normal: { AA: 4.5, AAA: 7 },
  large: { AA: 3, AAA: 4.5 },
} as const;

/**
 * コントラスト比が満たす水準を返す。
 * `contrastRatio()` の戻り値をそのまま渡す。
 */
export function wcagLevel(ratio: number, options: WcagOptions = {}): WcagLevel {
  const thresholds = options.large ? THRESHOLDS.large : THRESHOLDS.normal;
  if (ratio >= thresholds.AAA) return "AAA";
  if (ratio >= thresholds.AA) return "AA";
  return "fail";
}

/** 2色の組み合わせが AA を満たすか */
export function meetsAA(fg: ColorInput, bg: ColorInput, options: WcagOptions = {}): boolean {
  return wcagLevel(contrastRatio(fg, bg), options) !== "fail";
}
