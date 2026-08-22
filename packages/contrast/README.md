# contrast-kit

WCAG 2.x のコントラスト比を計算し、配色が基準を満たしているかを判定する小さなライブラリ。依存なし。

```bash
npm i contrast-kit
```

```ts
import { contrastRatio, wcagLevel } from "contrast-kit";

const ratio = contrastRatio("#1a7f37", "#eef1ee");
// 4.462...

wcagLevel(ratio); // "fail"（本文には 4.5:1 が必要）
wcagLevel(ratio, { large: true }); // "AA"（大きい文字なら 3:1）
```

## API

| 関数                          | 説明                                                 |
| ----------------------------- | ---------------------------------------------------- |
| `contrastRatio(a, b)`         | 2色のコントラスト比（1〜21）。引数の順序は影響しない |
| `wcagLevel(ratio, { large })` | 満たす水準を `"AAA" \| "AA" \| "fail"` で返す        |
| `meetsAA(fg, bg, { large })`  | AA 以上を満たすか                                    |
| `relativeLuminance(color)`    | 相対輝度（黒 0 / 白 1）                              |
| `parseHex(hex)`               | `#rgb` / `#rrggbb` を `{ r, g, b }` に変換           |

色は 16進文字列でも `{ r, g, b }`（0-255）でも渡せる。

`large` は 18pt 以上、または 14pt 以上の太字を指す（AA 3:1 / AAA 4.5:1）。指定しない場合は本文扱い（AA 4.5:1 / AAA 7:1）。
