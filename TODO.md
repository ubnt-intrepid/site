# TODO

コードレビューで発見された修正候補リスト。

## 優先度：高

- [ ] GFM テーブル用コンポーネント（`table`/`tableRow`/`tableCell`）の追加 — `src/components/Markdown.tsx`
- [ ] Link の非推奨 `as` prop を `href` に置き換え — `src/components/PostList.tsx`
- [ ] React を RC 版から正式リリース版へ更新 — `package.json`
- [ ] `@types/react`, `@types/react-dom` を v19 に更新 — `package.json`
- [ ] `eslint-config-next` を Next.js 16 に合わせて更新 — `package.json`

## 優先度：中

- [ ] h6 の `text-2xl` を適切なサイズに修正 — `src/components/Markdown.tsx`
- [ ] 脚注ラベルの表示形式 `1)` を見直し — `src/components/Markdown.tsx`
- [ ] Comments を `@giscus/react` に移行（FIXME 解消） — `src/components/Comments.tsx`
- [ ] 著作権表示の年を動的に生成 — `src/app/layout.tsx`
- [ ] KaTeX CSS バージョンを npm パッケージと連動させる — `src/app/layout.tsx`

## 優先度：低

- [ ] 画像の固定サイズ（480x320）を見直し — `src/components/Markdown.tsx`
- [ ] `post.tags ?? []` の冗長な null チェックを削除 — `src/app/tags/page.tsx` 他
- [ ] `findIndex` の `!=` を `!==` に統一 — `src/lib/post.ts`
- [ ] `.reduce(concat)` を `.flatMap()` に簡略化 — `src/app/tags/page.tsx`, `src/app/categories/page.tsx` 他
- [ ] 開発時のキャッシュ無効化（FIXME 解消） — `src/lib/post.ts`
