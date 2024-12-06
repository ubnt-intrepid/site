---
title: GitHub ライクな callout を実装した
published: 2024-12-05
tags:
- blog
- nextjs
categories:
- general
---

`remark-directive` を入れたはいいが放置しておくのももったいないので、[GitHub でサポートされている形式](https://github.com/orgs/community/discussions/16925)風の callout を出力出来るように機能を追加してみた。

::::note
ここには理解の助けになる有益な情報が表示されます。
該当の項目に対する理解を深めたいのであれば、積極的に目を通すべきでしょう。

:::warning
このようにネストして使用することも出来ます。
過剰な強調は控えるようにしてください。
:::
::::

:::tip
ここに記述されている内容は飛ばしても構いませんが、意欲のある読者は目に留めておくと良い理解の助けになるでしょう。
:::

:::important
ここには重要な情報が記述されています。
後の章に進む前に、必ず読むようにしてください。
:::

:::warning
これは警告文です。
無視しても処理は続行されますが、開発者の意図しない不具合が生じる可能性があります。
:::

:::caution
これはエラーです。
このメッセージの内容をよく読んだ上、必ず修正してください。
:::

とは言っても積極的に使う機会は無さそう…

---

<figure>
  ![FUSE structure](https://upload.wikimedia.org/wikipedia/commons/0/08/FUSE_structure.svg)
  <figcaption>
    Copyright [Me](https://example.com), *as* <strong>foo</strong>
    <em>bar</em>
  </figcaption>
</figure>
<p>foo</p>
bar

baz
