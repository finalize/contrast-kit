import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus";

// website は contrast-kit のビルド結果（dist）を読むため、
// test / build の前に依存パッケージの build を走らせる。
const afterDependencyBuild = [{ task: "build", from: "dependencies" }] as const;

export default defineConfig({
  test: {
    projects: [
      {
        // 純粋な関数のテスト。Node で速く回す
        test: {
          name: "unit",
          include: ["tests/*.test.ts"],
        },
      },
      {
        // DOM と見た目のテスト。実物の Chromium で動かす
        test: {
          name: "browser",
          include: ["tests/browser/*.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // 表がビューポートに収まる幅にしておかないと、
            // スクリーンショットが途中で切れて比較の意味が薄くなる
            viewport: { width: 1280, height: 900 },
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
  run: {
    tasks: {
      build: {
        command: ["tsc", "vp build"],
        dependsOn: [...afterDependencyBuild],
      },
      test: {
        command: "vp test",
        dependsOn: [...afterDependencyBuild],
      },
    },
  },
});
