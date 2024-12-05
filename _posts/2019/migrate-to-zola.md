---
title: Zolaに移行した
published: 2019-12-01
tags: [ "blog", "zola" ]
categories: [ "general" ]
---

<!-- more -->

ブログの静的サイトジェネレータを [`zola`] に変更した。
当面は[旧ブログ](https://ubnt-intrepid.github.io/blog)を残しつつ、適当なタイミングで旧サイトのページをリダイレクトに置き換えていく。

>  ### `zola` [^1] について
>
> Rust製の静的サイトジェネレータであり、高速なレンダリングとシングルバイナリによる依存性の無さを売りにしているらしい。
>
> [^1]: 元々は `gutenberg` という名前で開発が進んでいたが、気が付いたら `zola` に改名されていた（[当時のツイート](https://twitter.com/ubnt_intrepid/status/1090666266757496832))。

`async`/`.await` の強調表示はまだ実装されていないっぽい。
[独自のsyntax定義ができるらしい](https://www.getzola.org/documentation/content/syntax-highlighting/)ので、そのうち対処しても良いかもしれない。

```rust
#[async_std::main]
async fn main() -> anyhow::Result<()> {
    async_std::println!("Hello").await;
    Ok(())
}
```

<!-- links -->

[`zola`]: https://www.getzola.org
