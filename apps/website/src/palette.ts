import {
  apcaContrast,
  auditPairs,
  contrastRatio,
  formatHex,
  parseCssVariables,
  simulateColorVision,
  suggestAccessible,
} from "contrast-kit";
import type { ColorVisionType, PairResult, Suggestion } from "contrast-kit";

/** 画面に並べる1色ぶん */
export interface Swatch {
  /** `--accent` のような変数名。裸の色だけを貼られた場合は色そのもの */
  name: string;
  hex: string;
}

/** 表示に使う指標 */
export type Metric = "wcag" | "apca";

/** 「なし」を含む色覚特性の選択 */
export type Vision = "normal" | ColorVisionType;

const BARE_HEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;

/**
 * 貼り付けられたテキストから色を読み取る。
 * `--name: #hex;` 形式を優先し、拾えなかった裸の `#hex` も後ろに足す。
 * 同じ色は最初に現れた名前でまとめる。
 */
export function readSwatches(input: string): Swatch[] {
  const found = new Map<string, string>();

  for (const [name, value] of Object.entries(parseCssVariables(input))) {
    try {
      const hex = formatHex(value);
      if (!found.has(hex)) found.set(hex, name);
    } catch {
      // 色以外のカスタムプロパティ（フォント指定など）は読み飛ばす
    }
  }

  for (const match of input.matchAll(BARE_HEX)) {
    const hex = formatHex(match[0]);
    if (!found.has(hex)) found.set(hex, hex);
  }

  return [...found].map(([hex, name]) => ({ name, hex }));
}

/** 色覚特性を通した見え方に置き換える。`normal` ならそのまま */
export function simulateSwatches(swatches: readonly Swatch[], vision: Vision): Swatch[] {
  if (vision === "normal") return [...swatches];
  return swatches.map((swatch) => ({
    name: swatch.name,
    hex: simulateColorVision(swatch.hex, vision),
  }));
}

/** 行=前景 / 列=背景 の表。指標によって中身が変わる */
export function buildMatrix(swatches: readonly Swatch[], metric: Metric = "wcag"): number[][] {
  return swatches.map((fg) =>
    swatches.map((bg) =>
      metric === "apca" ? apcaContrast(fg.hex, bg.hex) : contrastRatio(fg.hex, bg.hex),
    ),
  );
}

/** 表示用に整形した値 */
export function formatMetric(value: number, metric: Metric): string {
  return metric === "apca" ? value.toFixed(0) : value.toFixed(2);
}

export interface Issue extends PairResult {
  fgName: string;
  bgName: string;
  /** 基準を満たす、最も近い前景色。届かない場合は undefined */
  suggestion?: Suggestion;
}

/**
 * 同じ色どうしを除いた全組み合わせのうち、本文サイズで AA を満たさないもの。
 * 比の小さい順に返し、それぞれに修正候補を付ける。
 */
export function findIssues(swatches: readonly Swatch[]): Issue[] {
  const pairs: { name: string; fg: string; bg: string; fgName: string; bgName: string }[] = [];
  for (let i = 0; i < swatches.length; i++) {
    for (let j = i + 1; j < swatches.length; j++) {
      const fg = swatches[i]!;
      const bg = swatches[j]!;
      pairs.push({
        name: `${fg.name} / ${bg.name}`,
        fg: fg.hex,
        bg: bg.hex,
        fgName: fg.name,
        bgName: bg.name,
      });
    }
  }

  return auditPairs(pairs)
    .map((result, index) => ({
      ...result,
      fgName: pairs[index]!.fgName,
      bgName: pairs[index]!.bgName,
      suggestion: suggestAccessible(result.fg, result.bg),
    }))
    .filter((result) => !result.passes)
    .sort((a, b) => a.ratio - b.ratio);
}

/**
 * 修正候補を CSS カスタムプロパティの形にまとめる。
 *
 * 同じ変数が複数の組で失敗している場合、組ごとに別々の色を出すと
 * 同じ変数が矛盾した値で並んでしまう。ここでは変数ごとに候補をまとめ、
 * **その変数が関わるすべての失敗した組を同時に満たす色**だけを出す。
 * どの候補でも全部は満たせない場合、その変数は出力しない。
 */
export function toCssFix(issues: readonly Issue[]): string {
  const byVariable = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!issue.fgName.startsWith("--") || issue.suggestion === undefined) continue;
    byVariable.set(issue.fgName, [...(byVariable.get(issue.fgName) ?? []), issue]);
  }

  const lines: string[] = [];
  for (const [name, group] of byVariable) {
    const backgrounds = group.map((issue) => formatHex(issue.bg));
    const best = group
      .map((issue) => issue.suggestion!)
      .filter((suggestion) =>
        backgrounds.every((background) => contrastRatio(suggestion.color, background) >= 4.5),
      )
      .sort((first, second) => first.distance - second.distance)[0];

    if (best === undefined) continue;
    const worst = Math.min(
      ...backgrounds.map((background) => contrastRatio(best.color, background)),
    );
    lines.push(`  ${name}: ${best.color}; /* 最小 ${worst.toFixed(2)}:1 */`);
  }

  if (lines.length === 0) return "";

  // 一覧には実際には重ねない組も含まれる。そのまま全部適用すると配色が平坦になるので、
  // コピー先で気づけるように生成物自体へ注意を書いておく
  const caution = [
    "/* 一覧に出ているすべての組を同時に満たす値です。",
    "   背景色どうしなど、実際には重ねない組まで含むため、",
    "   そのまま適用すると配色が平坦になります。必要な行だけ使ってください。 */",
  ].join("\n");

  return `${caution}\n:root {\n${lines.join("\n")}\n}`;
}
