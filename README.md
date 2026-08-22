# contrast-kit

WCAG のコントラスト比を計算・監査するライブラリと、それを使う Web ツール。Vite+ のモノレポで管理している。

```
packages/contrast   contrast-kit（npm 公開するライブラリ。依存ゼロ）
apps/website        CSS を貼ると全組み合わせのコントラスト比を出す Web ツール
```

## 開発

```bash
vp install        # 依存をインストール
vp run website#dev  # Web ツールを起動
vp check          # 整形・lint・型チェック
vp run -r test    # 全パッケージのテスト
vp run -r build   # 全パッケージのビルド
```

`apps/website` は `contrast-kit` のビルド結果を読むため、`test` と `build` は依存パッケージの `build` 後に走るよう `apps/website/vite.config.ts` の `dependsOn` で順序を指定している。

## ライブラリ

[packages/contrast/README.md](packages/contrast/README.md) を参照。

## メモ

- `vp` は公開24時間以内のパッケージをサプライチェーン検査で弾く。ロックファイルが古いと `pnpm-lock.yaml` を作り直す必要がある
- ルートの package 名とワークスペース内のパッケージ名が同じだと `vp run <name>#task` が曖昧になる
- `vite.config.ts` の `run.tasks` に書いたタスク名は、package.json の scripts と重複できない
