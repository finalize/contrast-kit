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

## デプロイ

`apps/website` は Cloudflare Workers の静的アセットとして配信する。main にマージされると CI が自動でデプロイする。

必要なシークレット（リポジトリに登録する）:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo finalize/contrast-kit
gh secret set CLOUDFLARE_ACCOUNT_ID --repo finalize/contrast-kit
```

手元から流したいときは `cd apps/website && pnpm exec wrangler deploy`（初回だけ `wrangler login`）。

## テスト

| 種類                     | 場所                                             | 何を見るか                          |
| ------------------------ | ------------------------------------------------ | ----------------------------------- |
| unit                     | `packages/contrast/tests` / `apps/website/tests` | 純粋な関数。Node で動く             |
| browser                  | `apps/website/tests/browser`                     | 実物の Chromium で DOM の挙動を見る |
| ビジュアルリグレッション | 同上                                             | 表を画像として比較する              |

`apps/website/vite.config.ts` の `test.projects` で unit と browser を分けている。ブラウザテストには Chromium が必要なので、初回だけ次を実行する。

```bash
cd apps/website && pnpm exec playwright install chromium
```

### 基準画像について

表の中身は「色そのもの」なので、`expect(ratio).toBeCloseTo(4.46)` が通っても、セルに背景色を当て忘れていたり前景と背景を取り違えていたりすると気づけない。そこで表を画像として比較している。

基準画像は撮影したプラットフォームごとに別ファイルになる（`matrix-chromium-darwin.png` / `matrix-chromium-linux.png`）。CI は Linux なので、**見た目を意図的に変えたときは両方を更新する**。

```bash
# macOS 用（手元で）
vp run website#test -u

# Linux 用（CI で作らせて持ち帰る）
gh workflow run update-screenshots.yml
gh run download <run-id> -n screenshots -D /tmp/shots
cp /tmp/shots/app.test.ts/matrix-chromium-linux.png apps/website/tests/browser/__screenshots__/app.test.ts/
```

## ライブラリ

[packages/contrast/README.md](packages/contrast/README.md) を参照。

## メモ

- `vp` は公開24時間以内のパッケージをサプライチェーン検査で弾く。ロックファイルが古いと `pnpm-lock.yaml` を作り直す必要がある
- ルートの package 名とワークスペース内のパッケージ名が同じだと `vp run <name>#task` が曖昧になる
- `vite.config.ts` の `run.tasks` に書いたタスク名は、package.json の scripts と重複できない
