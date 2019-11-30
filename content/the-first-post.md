+++
title = "The first post"
date = 2019-12-01

[taxonomies]
tags = [ "blog", "rust" ]
categories = [ "programming" ]
+++

ブログの静的サイトジェネレータとして [`zola`] を使用するテスト。
当面は[旧ブログ](https://ubnt-intrepid.github.io/blog)を残しつつ、適当なタイミングでリダイレクトするようにしておく。

# コードブロック

`async_await` の強調表示はまだ実装されていないっぽい。
[独自の syntax を定義できるっぽい](https://www.getzola.org/documentation/content/syntax-highlighting/)ので、そのうち対処しても良いかもしれない。

```rust
#[async_std::main]
async fn main() -> anyhow::Result<()> {
    async_std::println!("Hello").await;
    Ok(())
}
```

[`zola`]: https://github.com/getzola/zola
