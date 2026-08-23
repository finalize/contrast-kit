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

/** OKLab から sRGB に戻す。`toOklab()` の逆変換 */
export function fromOklab({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const toSrgb = (channel: number): number => {
    const value = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, value)) * 255);
  };

  return {
    r: toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/** 目標にする水準 */
export type TargetLevel = "AA" | "AAA";

export interface SuggestOptions extends WcagOptions {
  /** 目標水準。既定 "AA" */
  level?: TargetLevel;
}

export interface Suggestion {
  /** 提案する色（#rrggbb） */
  color: string;
  ratio: number;
  level: WcagLevel;
  /** 元の色からの OKLab 距離。0 なら変更不要 */
  distance: number;
}

/**
 * 基準を満たす、元の色に最も近い色を提案する。
 *
 * 色相と彩度（OKLab の a, b）はそのままに、明度 `L` だけを動かす。
 * 背景から遠ざかる方向に二分探索し、**実際に sRGB に戻した色で測り直した比**で
 * 判定するので、色域外に飛んで丸められた場合も結果は正しい。
 *
 * すでに基準を満たしていれば元の色をそのまま返す。
 * 明度を振り切っても届かない場合は `undefined`。
 */
export function suggestAccessible(
  fg: ColorInput,
  bg: ColorInput,
  options: SuggestOptions = {},
): Suggestion | undefined {
  const large = options.large ?? false;
  const thresholds = large ? THRESHOLDS.large : THRESHOLDS.normal;
  const target = thresholds[options.level ?? "AA"];

  const source = toOklab(fg);
  const current = contrastRatio(fg, bg);
  if (current >= target) {
    return {
      color: formatHex(fg),
      ratio: current,
      level: wcagLevel(current, { large }),
      distance: 0,
    };
  }

  const measure = (lightness: number): { color: string; ratio: number } => {
    const color = formatHex(fromOklab({ ...source, L: lightness }));
    return { color, ratio: contrastRatio(color, bg) };
  };

  /** 明度を limit 方向へ動かし、基準を満たす最も手前の色を二分探索する */
  const search = (limit: 0 | 1): Suggestion | undefined => {
    if (measure(limit).ratio < target) return undefined;

    let near = source.L;
    let far: number = limit;
    let best = measure(limit);
    // 40 回も回せば 8bit の精度には十分届く
    for (let i = 0; i < 40; i++) {
      const middle = (near + far) / 2;
      const candidate = measure(middle);
      if (candidate.ratio >= target) {
        best = candidate;
        far = middle;
      } else {
        near = middle;
      }
    }
    return {
      color: best.color,
      ratio: best.ratio,
      level: wcagLevel(best.ratio, { large }),
      distance: colorDistance(fg, best.color),
    };
  };

  // 明るくする / 暗くする の両方を試し、元の色に近い方を採る。
  // 片方だけ試すと、背景とわずかに明暗が違うだけの色で「届かない」と誤判定する
  const candidates = [search(1), search(0)].filter((found) => found !== undefined);
  return candidates.sort((first, second) => first.distance - second.distance)[0];
}

/**
 * APCA（WCAG 3 で検討されている知覚コントラスト指標）の定数。
 * 出典: apca-w3 0.1.9（https://github.com/Myndex/apca-w3）
 */
const APCA = {
  mainTrc: 2.4,
  rCo: 0.2126729,
  gCo: 0.7151522,
  bCo: 0.072175,
  normBg: 0.56,
  normTxt: 0.57,
  revTxt: 0.62,
  revBg: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scale: 1.14,
  offset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
} as const;

/** APCA が使う画面輝度。WCAG の相対輝度とは指数も係数も違う */
function apcaLuminance(color: ColorInput): number {
  const { r, g, b } = toRgb(color);
  return (
    APCA.rCo * (r / 255) ** APCA.mainTrc +
    APCA.gCo * (g / 255) ** APCA.mainTrc +
    APCA.bCo * (b / 255) ** APCA.mainTrc
  );
}

function softClamp(luminance: number): number {
  return luminance > APCA.blkThrs
    ? luminance
    : luminance + (APCA.blkThrs - luminance) ** APCA.blkClmp;
}

/**
 * APCA の Lc 値を返す。
 *
 * WCAG 2.x のコントラスト比は暗い背景で実感とずれることが知られており、
 * APCA は前景と背景の役割を区別して知覚的な差を測る。
 * 引数の順序に意味があり、入れ替えると符号が変わる。
 *
 * - 正の値: 明るい背景に暗い文字
 * - 負の値: 暗い背景に明るい文字
 * - 目安: 本文には絶対値 75 以上、大きい文字で 60 以上
 *
 * `contrastRatio()` と違い、こちらは仕様がまだ策定中である点に注意。
 */
export function apcaContrast(text: ColorInput, background: ColorInput): number {
  const textY = softClamp(apcaLuminance(text));
  const bgY = softClamp(apcaLuminance(background));

  if (Math.abs(bgY - textY) < APCA.deltaYmin) return 0;

  if (bgY > textY) {
    const signal = (bgY ** APCA.normBg - textY ** APCA.normTxt) * APCA.scale;
    return signal < APCA.loClip ? 0 : (signal - APCA.offset) * 100;
  }

  const signal = (bgY ** APCA.revBg - textY ** APCA.revTxt) * APCA.scale;
  return signal > -APCA.loClip ? 0 : (signal + APCA.offset) * 100;
}

/** 再現できる色覚特性 */
export type ColorVisionType = "protanopia" | "deuteranopia" | "tritanopia";

type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

/**
 * 色覚特性の再現に使う行列（重症度 1.0）。
 * 出典: Machado, Oliveira & Fernandes (2009)。線形 RGB に適用する。
 * どの行も合計が 1 なので、無彩色は無彩色のまま保たれる。
 */
const CVD_MATRICES: Record<ColorVisionType, Matrix3> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};

function fromLinear(channel: number): number {
  const value = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

/**
 * その色覚特性を持つ人にどう見えるかを再現した色を返す。
 *
 * 文字と背景のコントラスト比は輝度で決まるため、色覚特性でほとんど変わらない。
 * この関数が効くのは、グラフの系列色や状態表示など**色で意味を区別している**場面で、
 * 「区別がつかなくなっていないか」を確かめる用途。
 */
export function simulateColorVision(color: ColorInput, type: ColorVisionType): string {
  const { r, g, b } = toRgb(color);
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = CVD_MATRICES[type];
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  return formatHex({
    r: fromLinear(m0 * lr + m1 * lg + m2 * lb),
    g: fromLinear(m3 * lr + m4 * lg + m5 * lb),
    b: fromLinear(m6 * lr + m7 * lg + m8 * lb),
  });
}

export interface VisionDistance {
  /** "normal" は色覚特性なしの場合 */
  type: "normal" | ColorVisionType;
  distance: number;
}

/**
 * 2色が、どの色覚特性のときに最も見分けづらくなるかを返す。
 * 距離が小さい順（危ない順）に並べて返す。
 *
 * パレットを設計するときは、先頭の距離が十分あるかを見ればよい。
 */
export function distancesAcrossVision(a: ColorInput, b: ColorInput): VisionDistance[] {
  const types: VisionDistance["type"][] = ["normal", "protanopia", "deuteranopia", "tritanopia"];
  return types
    .map((type) => ({
      type,
      distance:
        type === "normal"
          ? colorDistance(a, b)
          : colorDistance(simulateColorVision(a, type), simulateColorVision(b, type)),
    }))
    .sort((first, second) => first.distance - second.distance);
}
