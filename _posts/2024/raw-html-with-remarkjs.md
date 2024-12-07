---
title: remark/rehype における生 HTML を含む Markdown 文書の扱いについて
published: 2024-12-07
tags:
- javascript
- remarkjs
categories:
- programming
---

`remark` は `micromark` という CommonMark 準拠の Markdown パーサを使用しているため、文書内で HTML タグを含めることが出来る。
HTML タグが含まれる場合における `remark/rehype` の挙動について理解が足りていなかったので、調べたついでに備忘録としてまとめておく。

## HTML タグへの対処法
公式で提供されているプラグインのみを用いる場合、次のようにすることで HTML タグを文書内で用いることが出来る。

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'remark-raw'
import rehypeReact from 'remark-react'

const parsed = await unified()
    .use(remarkParse)   // Markdown テキストから mdast を構築する
    .use(remarkRehype, { allowDangerousHtml: true })  // mdast -> hast への変換
    .use(rehypeRaw)     // hast を一枚の HTML として再解釈し、hast を再度構築する
    .use(rehypeReact)   // ここは rehypeStringify でも何でも良い
    .process(content)
```

ここで重要なのが、`remark-rehype` に渡している `allowDangerousHtml` オプションと、`rehype-raw` による変換処理である。
まず、`remark-rehype` のオプションで `allowDangerousHtml` を有効化することにより、`mdast` から `hast` への変換時に HTML 要素が `{ type: 'raw', value: node.value }` という形式で `hast` 側に保持されるようになる。
例えば、次のような Markdown 文書を考える。

```markdown
これはMarkdownですが、
<p>
  このように、<strong>Markdown</strong>内に<code>HTML</code>が書けちゃうんです
</p>
```

この文書を `mdast` に変換すると、次のようになる。

```
root[2] (1:1-5:1, 0-87)
├─0 paragraph[1] (1:1-1:16, 0-15)
│   └─0 text "これはMarkdownですが、" (1:1-1:16, 0-15)
└─1 html "<p>\n  このように、<strong>Markdown</strong>内に<code>HTML</code>が書けちゃうんです\n</p>" (2:1-4:5, 16-86)
```

> `remark` を使用していると中間結果である `mdast` や `hast` の状態を可視化するのが面倒だったので、
> 上の実行結果は `remark/rehype` の内部で使用されている `mdast-util-from-markdown` などのパッケージが提供されている関数を直接使用することで生成した。
> 典型的なテストコードは次のような感じになる。
> 
> ```typescript
> import { readAll } from '@std/io/read-all'
> import { fromMarkdown } from 'npm:mdast-util-from-markdown'
> import { toHast } from 'npm:mdast-util-to-hast'
> import { raw } from 'npm:hast-util-raw'
> import { toHtml } from 'npm:hast-util-to-html'
> import { inspect } from 'npm:unist-util-inspect'
> 
> const markdown = await readAll(Deno.stdin)
>
> const mdast = fromMarkdown(markdown, 'utf-8', {})
> console.log(inspect(mdast))
>
> const hast = toHast(mdast, { allowDangerousHtml: true })
> console.log(inspect(hast))
> console.log(toHtml(hast))
>
> const hast2 = raw(hast)
> console.log(inspect(hast2))
> console.log(toHtml(hast2))
> ```

この `mdast` を `allowDangerousHtml` が有効化された状態で `hast` に変換すると、次のようになる。

```
root[3] (1:1-5:1, 0-87)
├─0 element<p>[1] (1:1-1:16, 0-15)
│   │ properties: {}
│   └─0 text "これはMarkdownですが、" (1:1-1:16, 0-15)
├─1 text "\n"
└─2 raw "<p>\n  このように、<strong>Markdown</strong>内に<code>HTML</code>が書けちゃうんです\n</p>" (2:1-4:5, 16-86)
```

上の結果を見ると、変換元の `mdast` で `type: 'html'` であったノードが `type: 'raw'` と変更された上でそのまま `hast` に変換されていることが確認できる。
この `hast` を HTML へと変換すると、次のようになる（XSS 対策などの理由で、デフォルトでは `raw` 要素のテキストは適切にサニタイズされて出力される）。

```html
<p>これはMarkdownですが、</p>
&#x3C;p>
  このように、&#x3C;strong>Markdown&#x3C;/strong>内に&#x3C;code>HTML&#x3C;/code>が書けちゃうんです
&#x3C;/p>
```

この状態でも `rehype-stringify` （あるいはその内部で使用されている `hast-util-to-html`）に `allowDangerousHtml = true` を指定することで所望の HTML を得ることは一応可能ではあるが、これはセキュリティ対策的な意味も含めてやるべきではないだろう。
また、`hast` のまま加工したい場合や `rehype-react` などを用いて HTML 以外の形式へと変換するユースケースではこの回避策は用いることが出来ない。

このような場合を想定して用いられるのが `rehype-raw` であり、大雑把に言えば与えられた `hast` の値を（`raw` 要素も含めて）一枚の HTML として再解釈し、構文木を再生成するように動作する。
上の例における `hast` を `rehype-raw` にかけた後の結果は次のようになる。

```
root[3]
│ data: {"quirksMode":false}
├─0 element<p>[1]
│   │ properties: {}
│   └─0 text "これはMarkdownですが、"
├─1 text "\n"
└─2 element<p>[5]
    │ properties: {}
    ├─0 text "\n  このように、"
    ├─1 element<strong>[1]
    │   │ properties: {}
    │   └─0 text "Markdown"
    ├─2 text "内に"
    ├─3 element<code>[1]
    │   │ properties: {}
    │   └─0 text "HTML"
    └─4 text "が書けちゃうんです\n"
```

元々の `hast` 内にあった `raw` 要素の HTML も含めて、適切に `hast` の木構造に反映されているのが確認できる。
したがって、この結果を `allowDangerousHtml` オプションなしで HTML に出力したり、`rehype-react` によって JSX へと変換することが出来るようになった。


## 生 HTML 内に空白行がある場合の挙動
CommonMark では、一部のタグで途中に空白行がある場合、その後のパラグラフを独立して解釈するという仕様になっている。
そのため、HTML タグ内で不必要に改行を入れると意図しない出力結果となる可能性がある。
例えば、次のような Markdown が与えられたとする。

```markdown
<p>foo bar <strong>
baz</strong>
</p>hoge
fuga

hello
```

この Markdown に対し、`rehype-raw` まで適用した後の `hast` は次のようになる。

```
root[3]
│ data: {"quirksMode":false}
├─0 element<p>[3]
│   │ properties: {}
│   ├─0 text "foo bar "
│   ├─1 element<strong>[1]
│   │   │ properties: {}
│   │   └─0 text "\nbaz"
│   └─2 text "\n"
├─1 text "hoge\nfuga\n"
└─2 element<p>[1]
    │ properties: {}
    └─0 text "hello"
```

所々に改行が残されている点や `hoge\nfuga\n` がパラグラフではなく `text` として認識されていることに目をつぶれば、上の結果は元の Markdown の内容を適切に HTML へと変換することが出来ている。
一方、この Markdown に次のように空白行を挿入した場合を考える。

```markdown
<p>
foo bar <strong>

baz</strong>
</p>hoge
fuga

hello
```

HTML として素朴に解釈すれば、上のテキストにおける `<strong> ... </strong>` はひとかたまりの要素として扱われることが期待される。
しかし、これは次のような `mdast` として解釈される。

```
root[4] (1:1-9:1, 0-56)
├─0 html "<p>\nfoo bar <strong>" (1:1-2:17, 0-20)
├─1 paragraph[2] (4:1-4:13, 22-34)
│   ├─0 text "baz" (4:1-4:4, 22-25)
│   └─1 html "</strong>" (4:4-4:13, 25-34)
├─2 html "</p>hoge\nfuga" (5:1-6:5, 35-48)
└─3 paragraph[1] (8:1-8:6, 50-55)
    └─0 text "hello" (8:1-8:6, 50-55)
```

まず、`foo ...` の後の空行がパラグラフの終了であると解釈され、その後の `baz` から始まるものとは別の要素として解釈されているのが確認できる。
そのため、`</p>` に到達する前で中断され、それ以降が別のパラグラフとして処理されてしまっている。
また、`</strong>` が `... bar <strong>` と同じ階層になっていないことも分かる。
`</p>` の後の文字列も、HTML 的に解釈するのであれば `<p> ... </p>` とは別の要素として扱ってほしいが分離されていない。

`<script>` や `<pre>` などの例外を除き、多くのタグがこの仕様に則り解析され、HTML としての木構造は無視されることになる。
そのため、単に `html` 要素を逐次的に `hast` に変換すると文書作成者が本来意図していたものとは異なる木構造になる可能性がある。
上の `mdast` を `hast` に変換した場合、および `rehype-raw` をかけた後での `hast` はそれぞれ次のようになる。

```txt rehype-raw 適用前
root[7] (1:1-9:1, 0-56)
├─0 raw "<p>\nfoo bar <strong>" (1:1-2:17, 0-20)
├─1 text "\n"
├─2 element<p>[2] (4:1-4:13, 22-34)
│   │ properties: {}
│   ├─0 text "baz" (4:1-4:4, 22-25)
│   └─1 raw "</strong>" (4:4-4:13, 25-34)
├─3 text "\n"
├─4 raw "</p>hoge\nfuga" (5:1-6:5, 35-48)
├─5 text "\n"
└─6 element<p>[1] (8:1-8:6, 50-55)
    │ properties: {}
    └─0 text "hello" (8:1-8:6, 50-55)
```

```txt rehype-raw 適用後
root[6]
│ data: {"quirksMode":false}
├─0 element<p>[2]
│   │ properties: {}
│   ├─0 text "\nfoo bar "
│   └─1 element<strong>[1]
│       │ properties: {}
│       └─0 text "\n"
├─1 element<p>[1]
│   │ properties: {}
│   └─0 element<strong>[1]
│       │ properties: {}
│       └─0 text "baz"
├─2 text "\n"
├─3 element<p>[0]
│     properties: {}
├─4 text "hoge\nfuga\n"
└─5 element<p>[1]
    │ properties: {}
    └─0 text "hello"
```

この記事を書き始める前は、このような場合でも `rehype-raw` の出力結果は空白行を入れる前と（改行文字の有無を除いて）等しくなると思い込んでいた。
しかし、実際にはこのように生成される結果は異なったものとなった。
これは少し考えてみれば当然の振舞いで、`mdast` から `hast` への変換の際に空白行の前後のパラグラフを強引に `<p>...</p>` の子ノードとして変換しているので、この挿入された `<p>` タグの存在を前提とした上で再度 HTML として解析すると元々のマークアップと一致しなくなるという動作になっている。
ここでの結果は CommonMark の仕様から導き出されるものであり、`remark` 以外の（CommonMark 準拠な） Markdown 処理系を扱う際にも注意が必要となる。

## おわりに
書いたは良いけど、大した情報ではない気がする…
