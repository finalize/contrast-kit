import { defineConfig } from "vite-plus";

// website は contrast-kit のビルド結果（dist）を読むため、
// test / build の前に依存パッケージの build を走らせる。
const afterDependencyBuild = [{ task: "build", from: "dependencies" }] as const;

export default defineConfig({
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
