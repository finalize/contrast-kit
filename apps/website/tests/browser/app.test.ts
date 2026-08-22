import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import "../../src/style.css";
import { mount } from "../../src/app.ts";

function render(): void {
  document.body.innerHTML = "";
  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  mount(root);
}

test("初期表示でサンプルの配色が表になる", async () => {
  render();
  // --fg を --bg-elev の上に置いた組み合わせが表に出る
  await expect
    .element(page.getByRole("cell", { name: /^--fg を --bg-elev の上に置くと 12\.30/ }))
    .toBeVisible();
});

test("貼り付け直すと表が組み直される", async () => {
  render();
  await page
    .getByLabelText("CSS カスタムプロパティ、または色のリスト")
    .fill("--a: #000000; --b: #ffffff;");
  await expect
    .element(page.getByRole("cell", { name: /^--a を --b の上に置くと 21\.00/ }))
    .toBeVisible();
  await expect.element(page.getByText("すべての組み合わせが AA を満たしています。")).toBeVisible();
});

test("色が1つだけなら促す", async () => {
  render();
  await page.getByLabelText("CSS カスタムプロパティ、または色のリスト").fill("--only: #123456;");
  await expect.element(page.getByText("色を2つ以上入力してください。")).toBeVisible();
});

test("表の見た目が変わっていない", async () => {
  render();
  // 数値のアサーションでは「正しい色で描画されたか」を確認できないため、
  // 表そのものを画像として比較する
  await expect.element(page.getByRole("table")).toMatchScreenshot("matrix");
});
