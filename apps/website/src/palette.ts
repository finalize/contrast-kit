import { auditPairs, contrastRatio, formatHex, parseCssVariables } from "contrast-kit";
import type { PairResult } from "contrast-kit";

/** 画面に並べる1色ぶん */
export interface Swatch {
  /** `--accent` のような変数名。裸の色だけを貼られた場合は色そのもの */
  name: string;
  hex: string;
}

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

/** 行=前景 / 列=背景 のコントラスト比の表 */
export function buildMatrix(swatches: readonly Swatch[]): number[][] {
  return swatches.map((fg) => swatches.map((bg) => contrastRatio(fg.hex, bg.hex)));
}

/**
 * 同じ色どうしを除いた全組み合わせのうち、本文サイズで AA を満たさないもの。
 * 比の小さい順に返す。
 */
export function findIssues(swatches: readonly Swatch[]): PairResult[] {
  const pairs = [];
  for (let i = 0; i < swatches.length; i++) {
    for (let j = i + 1; j < swatches.length; j++) {
      const fg = swatches[i]!;
      const bg = swatches[j]!;
      pairs.push({ name: `${fg.name} / ${bg.name}`, fg: fg.hex, bg: bg.hex });
    }
  }
  return auditPairs(pairs)
    .filter((result) => !result.passes)
    .sort((a, b) => a.ratio - b.ratio);
}
