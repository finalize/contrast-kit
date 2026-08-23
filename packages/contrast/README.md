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

## 直し方まで出す

「足りない」だけでなく「ではどうするか」を返します。色相と彩度を保ったまま明度だけを動かし、基準を満たす最も近い色を二分探索します。

```ts
suggestAccessible("#1a7f37", "#eef1ee");
// { color: "#197e37", ratio: 4.52, level: "AA", distance: 0.0033 }
```

sRGB の色域外に出た場合も、丸めたあとの色で測り直すので結果は正しいままです。届かない場合は `undefined` を返します。

## APCA

WCAG 2.x のコントラスト比は暗い背景で実感とずれることが知られています。WCAG 3 で検討されている APCA の Lc 値も出せます。

```ts
apcaContrast("#000000", "#ffffff"); //  106.04（明るい背景に暗い文字）
apcaContrast("#ffffff", "#000000"); // -107.88（暗い背景に明るい文字）
```

引数の順序に意味があり、入れ替えると符号が変わります。目安は本文で絶対値 75 以上、大きい文字で 60 以上。実装は [apca-w3 0.1.9](https://github.com/Myndex/apca-w3) に準拠し、公表されている参照値と一致することをテストで固定しています。**仕様は策定中**である点に注意してください。

## 色覚特性

```ts
simulateColorVision("#ff0000", "deuteranopia"); // "#a39000"
distancesAcrossVision("#ff0000", "#00ff00")[0]; // { type: "deuteranopia", distance: 0.223 }
```

コントラスト比は輝度で決まるため、色覚特性ではほとんど変わりません。これが効くのは**色で意味を区別している場面**（グラフの系列色、状態表示）で、区別がつかなくなっていないかを確かめる用途です。行列は Machado, Oliveira & Fernandes (2009) の重症度 1.0、線形 RGB に適用しています。

## 明度の2種類

`relativeLuminance()` は WCAG の相対輝度（線形光）で、コントラスト比の計算に使う。
`toOklab().L` は知覚的に均等な明度で、濃淡を等間隔の段階に割り当てる用途に使う。

```ts
relativeLuminance("#808080"); // 0.216  線形光では 2 割強
toOklab("#808080").L; // 0.600  見た目には半分くらい
```

濃淡を段階に割り当てるときに相対輝度を使うと、暗い側に段階が偏る。
