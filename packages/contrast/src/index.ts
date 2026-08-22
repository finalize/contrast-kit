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

/**
 * 色を `#rrggbb` 形式の文字列にする。
 * 文字列で渡した場合も 6 桁に正規化して返す。
 */
export function formatHex(color: ColorInput): string {
  const { r, g, b } = toRgb(color);
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
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

/**
 * CSS の文字列から、指定したセレクタのルール本体を取り出す。
 * ネストした波括弧は数えて対応づける。見つからなければ undefined。
 */
export function extractRuleBlock(css: string, selector: string): string | undefined {
  const index = css.indexOf(selector);
  if (index === -1) return undefined;

  const open = css.indexOf("{", index + selector.length);
  if (open === -1) return undefined;

  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const char = css[i];
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return undefined;
}

/**
 * CSS カスタムプロパティ（`--name: value;`）を名前と値の組に変換する。
 * 名前は `--` を含んだまま返す。コメントは無視する。
 */
export function parseCssVariables(css: string): Record<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const variables: Record<string, string> = {};

  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    variables[match[1]!] = match[2]!.trim();
  }
  return variables;
}

/** 検査したい前景色と背景色の組み合わせ */
export interface PairInput {
  /** 結果の表示に使う名前。省略時は "fg on bg" 形式で埋める */
  name?: string;
  fg: ColorInput;
  bg: ColorInput;
  large?: boolean;
}

/** 1組ぶんの検査結果 */
export interface PairResult {
  name: string;
  fg: ColorInput;
  bg: ColorInput;
  large: boolean;
  ratio: number;
  level: WcagLevel;
  /** AA 以上を満たしていれば true */
  passes: boolean;
}

/**
 * 複数の組み合わせをまとめて検査する。
 * 結果は入力の順序を保つ。
 */
export function auditPairs(pairs: readonly PairInput[]): PairResult[] {
  return pairs.map((pair) => {
    const large = pair.large ?? false;
    const ratio = contrastRatio(pair.fg, pair.bg);
    const level = wcagLevel(ratio, { large });
    return {
      name: pair.name ?? `${formatHex(pair.fg)} on ${formatHex(pair.bg)}`,
      fg: pair.fg,
      bg: pair.bg,
      large,
      ratio,
      level,
      passes: level !== "fail",
    };
  });
}

/** OKLab の座標。`L` は 0（黒）〜1（白）の知覚的な明度 */
export interface Oklab {
  L: number;
  a: number;
  b: number;
}

/**
 * sRGB を OKLab に変換する。
 *
 * `L` は知覚的に均等な明度で、`relativeLuminance()`（WCAG の線形光）とは別物。
 * 濃淡を等間隔の段階に割り当てたい用途（文字の濃淡ランプなど）ではこちらを使う。
 * 中間グレー `#808080` の場合、L は約 0.60 だが相対輝度は約 0.22 になる。
 */
export function toOklab(color: ColorInput): Oklab {
  const { r, g, b } = toRgb(color);
  const red = toLinear(r);
  const green = toLinear(g);
  const blue = toLinear(b);

  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab 空間でのユークリッド距離。0 に近いほど似た色 */
export function colorDistance(a: ColorInput, b: ColorInput): number {
  const first = toOklab(a);
  const second = toOklab(b);
  return Math.hypot(first.L - second.L, first.a - second.a, first.b - second.b);
}

/**
 * パレットの中から、対象に最も近い色を選ぶ。
 * 画像をサイトの配色に量子化するときなどに使う。
 */
export function nearestColor(target: ColorInput, palette: readonly ColorInput[]): string {
  const [first] = palette;
  if (first === undefined) {
    throw new TypeError("パレットが空です");
  }

  let best = first;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const distance = colorDistance(target, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return formatHex(best);
}
