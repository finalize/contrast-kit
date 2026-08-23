import { formatHex } from "contrast-kit";
import {
  buildMatrix,
  findIssues,
  formatMetric,
  readSwatches,
  simulateSwatches,
  toCssFix,
} from "./palette.ts";
import type { Metric, Swatch, Vision } from "./palette.ts";

export const SAMPLE = `:root {
  --bg: #0b0e0f;
  --bg-elev: #131819;
  --fg: #cfd8d3;
  --fg-dim: #8b9a93;
  --accent: #7ee787;
  --accent-2: #79c0ff;
  --accent-3: #ffa657;
  --border: #223028;
}`;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!,
  );
}

function renderIssues(area: HTMLElement, fixArea: HTMLElement, swatches: readonly Swatch[]): void {
  if (swatches.length < 2) {
    area.innerHTML = `<p class="empty">色を2つ以上入力してください。</p>`;
    fixArea.innerHTML = "";
    return;
  }

  const issues = findIssues(swatches);
  if (issues.length === 0) {
    area.innerHTML = `<p class="ok">すべての組み合わせが AA を満たしています。</p>`;
    fixArea.innerHTML = "";
    return;
  }

  area.innerHTML = `<ul class="issues">${issues
    .map((issue) => {
      const fix =
        issue.suggestion === undefined
          ? `<span class="issue-fix issue-fix--none">明度を振り切っても届きません</span>`
          : `<span class="issue-fix"><span class="issue-swatch" style="background:${escapeHtml(formatHex(issue.bg))};color:${escapeHtml(issue.suggestion.color)}">Aa</span><code>${escapeHtml(issue.suggestion.color)}</code> なら ${issue.suggestion.ratio.toFixed(2)}:1</span>`;
      return `<li>
        <span class="issue-swatch" style="background:${escapeHtml(formatHex(issue.bg))};color:${escapeHtml(formatHex(issue.fg))}">Aa</span>
        <span class="issue-name">${escapeHtml(issue.name)}</span>
        <span class="issue-ratio">${issue.ratio.toFixed(2)}:1</span>
        ${fix}
      </li>`;
    })
    .join("")}</ul>`;

  const css = toCssFix(issues);
  fixArea.innerHTML =
    css === ""
      ? ""
      : `<p class="hint">修正候補（色相と彩度はそのまま、明度だけ動かしています）</p><pre class="fix-css">${escapeHtml(css)}</pre>`;
}

function renderMatrix(table: HTMLTableElement, swatches: readonly Swatch[], metric: Metric): void {
  if (swatches.length === 0) {
    table.innerHTML = "";
    return;
  }

  const matrix = buildMatrix(swatches, metric);
  const head = `<thead><tr><th scope="col"><span class="visually-hidden">前景色</span></th>${swatches
    .map((swatch) => `<th scope="col"><code>${escapeHtml(swatch.name)}</code></th>`)
    .join("")}</tr></thead>`;

  const rows = swatches
    .map((fg, row) => {
      const cells = swatches
        .map((bg, column) => {
          if (row === column) return `<td class="same" aria-label="同じ色">—</td>`;
          const value = matrix[row]![column]!;
          const label =
            metric === "apca"
              ? `${fg.name} を ${bg.name} の上に置くと Lc ${value.toFixed(0)}`
              : `${fg.name} を ${bg.name} の上に置くと ${value.toFixed(2)} 対 1`;
          return `<td style="background:${escapeHtml(bg.hex)};color:${escapeHtml(fg.hex)}" title="${escapeHtml(label)}">
            <span aria-hidden="true">${formatMetric(value, metric)}</span>
            <span class="visually-hidden">${escapeHtml(label)}</span>
          </td>`;
        })
        .join("");
      return `<tr><th scope="row"><code>${escapeHtml(fg.name)}</code></th>${cells}</tr>`;
    })
    .join("");

  table.innerHTML = `${head}<tbody>${rows}</tbody>`;
}

export function mount(root: HTMLElement): void {
  root.innerHTML = `
<header class="site-header">
  <h1>contrast-kit</h1>
  <p>配色を貼り付けると、全組み合わせのコントラスト比と WCAG の判定を出します。</p>
</header>

<main>
  <section class="panel">
    <label class="field-label" for="source">CSS カスタムプロパティ、または色のリスト</label>
    <textarea id="source" spellcheck="false" rows="12"></textarea>
    <p class="hint"><code>--name: #hex;</code> でも、<code>#hex</code> を並べるだけでも読み取ります。</p>

    <div class="controls">
      <div class="field">
        <label for="metric">指標</label>
        <select id="metric">
          <option value="wcag">コントラスト比（WCAG 2.x）</option>
          <option value="apca">Lc（APCA / WCAG 3 検討中）</option>
        </select>
      </div>
      <div class="field">
        <label for="vision">色覚特性</label>
        <select id="vision">
          <option value="normal">なし</option>
          <option value="protanopia">1型（赤が見えにくい）</option>
          <option value="deuteranopia">2型（緑が見えにくい）</option>
          <option value="tritanopia">3型（青が見えにくい）</option>
        </select>
      </div>
    </div>
  </section>

  <section class="panel" aria-labelledby="issues-heading">
    <h2 id="issues-heading">本文サイズで AA を満たさない組み合わせ</h2>
    <p class="hint">すべての組み合わせを機械的に並べています。背景色どうしなど、実際には重ねない組は読み飛ばしてください。</p>
    <div id="issues" aria-live="polite"></div>
    <div id="fix"></div>
  </section>

  <section class="panel" aria-labelledby="matrix-heading">
    <h2 id="matrix-heading">全組み合わせ</h2>
    <p class="hint">行が前景色、列が背景色。数値はコントラスト比です。</p>
    <div class="table-scroll">
      <table id="matrix"></table>
    </div>
  </section>
</main>

<footer class="site-footer">
  <a href="https://github.com/finalize/contrast-kit">GitHub</a>
  <a href="https://www.npmjs.com/package/contrast-kit">npm</a>
</footer>
`;

  const source = root.querySelector<HTMLTextAreaElement>("#source")!;
  const issuesArea = root.querySelector<HTMLDivElement>("#issues")!;
  const fixArea = root.querySelector<HTMLDivElement>("#fix")!;
  const matrixTable = root.querySelector<HTMLTableElement>("#matrix")!;
  const metricSelect = root.querySelector<HTMLSelectElement>("#metric")!;
  const visionSelect = root.querySelector<HTMLSelectElement>("#vision")!;

  const update = (): void => {
    const metric: Metric = metricSelect.value === "apca" ? "apca" : "wcag";
    // 色覚特性を通した見え方に置き換えてから、そのまま検査・表示する
    const swatches = simulateSwatches(readSwatches(source.value), visionSelect.value as Vision);
    renderIssues(issuesArea, fixArea, swatches);
    renderMatrix(matrixTable, swatches, metric);
  };

  source.value = SAMPLE;
  for (const control of [source, metricSelect, visionSelect]) {
    control.addEventListener("input", update);
  }
  update();
}
