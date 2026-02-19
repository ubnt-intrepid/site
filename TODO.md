# TODO

コードレビューで発見された修正候補リスト。

## 解決済み

- [x] React を RC 版から正式リリース版へ更新 — react@19.2.4（安定版）に更新済み
- [x] `@types/react`, `@types/react-dom` を v19 に更新 — @types/react@19.2.14, @types/react-dom@19.2.3 に更新済み
- [x] `eslint-config-next` を Next.js 16 に合わせて更新 — eslint-config-next@16.1.6 に更新済み

## 優先度：高

- [ ] GFM テーブル用コンポーネント（`table`/`tableRow`/`tableCell`）の追加 — `src/components/Markdown.tsx`
  - GFM 拡張は `markdown.ts` で有効だが、レンダラ側に対応するコンポーネントがない。テーブルを含む記事があると `unknown nodeType: table` と表示される
- [ ] Link の非推奨 `as` prop を `href` に置き換え — `src/components/PostList.tsx`, `src/components/ColoredLink.tsx`
  - `PostList.tsx:17-18`: `href="/[id]" as={...}` → `href={`/${post.id}`}` に変更
  - `ColoredLink.tsx`: `as` prop の定義も併せて削除する
- [ ] コードブロックタイトルの文字色クラスが typo — `src/components/Code.tsx:48`
  - `text-orange-5` は Tailwind に存在しないクラス。`text-orange-50` の誤りと思われる

## 優先度：中

- [ ] h6 の `text-2xl` を適切なサイズに修正 — `src/components/Markdown.tsx:91`
  - h6 が h2 と同じ `text-2xl` になっている。`text-base` や `text-lg` が妥当
- [ ] 脚注ラベルの表示形式 `1)` を見直し — `src/components/Markdown.tsx:79`
  - 現状 `{node.label})` で「1)」と表示される。一般的な脚注表記は `[1]` や上付き数字
- [ ] Comments を `@giscus/react` に移行（FIXME 解消） — `src/components/Comments.tsx`
  - 現在は `document.createElement('script')` で giscus を動的挿入している
- [ ] 著作権表示の年を動的に生成 — `src/app/layout.tsx:44`
  - `2019-2024` がハードコードされており、既に古くなっている（現在 2026 年）
- [ ] KaTeX CSS バージョンを npm パッケージと連動させる — `src/app/layout.tsx:33`
  - CDN の URL は `katex@0.16.11` だが、インストール済みパッケージは `katex@0.16.28`。バージョン不一致

## 優先度：低

- [ ] 画像の固定サイズ（480x320）を見直し — `src/components/Markdown.tsx:103-104`
- [ ] 冗長な null チェックの削除 — 複数ファイル
  - `post.tags ?? []`, `post.categories ?? []`: `Post` 型では既に `string[]` なので `?? []` は不要 — `src/app/tags/page.tsx:18`, `src/app/tags/[tag]/page.tsx:16`, `src/app/categories/page.tsx:18`, `src/app/categories/[category]/page.tsx:16`
  - `post.tags ? post.tags.includes(tag) : false` → `post.tags.includes(tag)` に簡略化可 — `src/app/tags/[tag]/page.tsx:32`, `src/app/categories/[category]/page.tsx:32`
- [ ] `==` を `===` に統一 — 複数ファイル
  - `src/lib/post.ts:44`: `findIndex(...) != -1` → `!== -1`
  - `src/app/[id]/page.tsx:27`: `post.id == id` → `post.id === id`
  - `src/components/Markdown.tsx:86-91`: heading の `node.depth == N` → `=== N`
- [ ] `.reduce((acc, val) => acc.concat(val), [])` を `.flatMap(x => x)` に簡略化 — `src/app/tags/page.tsx:19`, `src/app/tags/[tag]/page.tsx:17`, `src/app/categories/page.tsx:19`, `src/app/categories/[category]/page.tsx:17`
- [ ] 開発時のキャッシュ無効化（FIXME 解消） — `src/lib/post.ts:21`
- [ ] `node?.url` の不要な optional chaining — `src/components/Markdown.tsx:121`
  - `node` は必ず存在するため `?.` は不要
