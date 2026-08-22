import { formatHex } from "contrast-kit";
import { buildMatrix, findIssues, readSwatches } from "./palette.ts";
import type { Swatch } from "./palette.ts";

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

function renderIssues(area: HTMLElement, swatches: readonly Swatch[]): void {
  const issues = findIssues(swatches);

  if (swatches.length < 2) {
    area.innerHTML = `<p class="empty">色を2つ以上入力してください。</p>`;
    return;
  }
  if (issues.length === 0) {
    area.innerHTML = `<p class="ok">すべての組み合わせが AA を満たしています。</p>`;
    return;
  }

  area.innerHTML = `<ul class="issues">${issues
    .map(
      (issue) => `
      <li>
        <span class="issue-swatch" style="background:${escapeHtml(formatHex(issue.bg))};color:${escapeHtml(formatHex(issue.fg))}">Aa</span>
        <span class="issue-name">${escapeHtml(issue.name)}</span>
        <span class="issue-ratio">${issue.ratio.toFixed(2)}:1</span>
      </li>`,
    )
    .join("")}</ul>`;
}

function renderMatrix(table: HTMLTableElement, swatches: readonly Swatch[]): void {
  if (swatches.length === 0) {
    table.innerHTML = "";
    return;
  }

  const matrix = buildMatrix(swatches);
  const head = `<thead><tr><th scope="col"><span class="visually-hidden">前景色</span></th>${swatches
    .map((swatch) => `<th scope="col"><code>${escapeHtml(swatch.name)}</code></th>`)
    .join("")}</tr></thead>`;

  const rows = swatches
    .map((fg, row) => {
      const cells = swatches
        .map((bg, column) => {
          if (row === column) return `<td class="same" aria-label="同じ色">—</td>`;
          const ratio = matrix[row]![column]!;
          const label = `${fg.name} を ${bg.name} の上に置くと ${ratio.toFixed(2)} 対 1`;
          return `<td style="background:${escapeHtml(bg.hex)};color:${escapeHtml(fg.hex)}" title="${escapeHtml(label)}">
            <span aria-hidden="true">${ratio.toFixed(2)}</span>
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
  </section>

  <section class="panel" aria-labelledby="issues-heading">
    <h2 id="issues-heading">本文サイズで AA を満たさない組み合わせ</h2>
    <p class="hint">すべての組み合わせを機械的に並べています。背景色どうしなど、実際には重ねない組は読み飛ばしてください。</p>
    <div id="issues" aria-live="polite"></div>
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
  const matrixTable = root.querySelector<HTMLTableElement>("#matrix")!;

  const update = (): void => {
    const swatches = readSwatches(source.value);
    renderIssues(issuesArea, swatches);
    renderMatrix(matrixTable, swatches);
  };

  source.value = SAMPLE;
  source.addEventListener("input", update);
  update();
}
