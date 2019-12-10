+++
title = "Markdown 内の Rust コードをテストするためのクレートを作った"
date = 2018-10-11

[taxonomies]
tags = [ "rust", "doctest", "announce", "qiita" ]
categories = [ "programming" ]
+++

以前から Markdown 内の Rust コードブロックのテストをするためのクレートとして [`skeptic`] を推していたのですが、コンパイラのバージョンが更新された場合などにクレートの参照が上手くいかなくなる問題があったので、代用としてコードブロックのテスト用のクレートを作ってみました。

<!-- more -->

* https://github.com/ubnt-intrepid/doubter

# 仕組み

`skeptic` は、`build.rs` 内で Markdown 内のコードブロックを抽出し、それをもとに生成したテストコードを `rustc` に渡すことでコードブロックをテストしています。このときに依存しているクレートを指定するためのオプションの計算は（`cargo` が提供する機能を用いず）[自力で行っています](https://github.com/budziq/rust-skeptic/blob/6448bb02d4ba3fc73b533cc861cc38fae55e5d05/src/skeptic/lib.rs#L764-L810)。`cargo` のソースを詳しく読んだことがないため詳細は不明ですがおそらくこの部分の処理が現在 `cargo` 内部で用いられているものと食い違っており、その結果 `target/` 内に異なるバージョンのコンパイラでビルドされた成果物が残っていると使用するクレートの解決が失敗することがあります。これは主に CI でキャッシュを有効化しているときに頻繁に発生し、その度にキャッシュを削除してすべての依存クレートをビルドし直す必要が生じることになります。

一方、`rustdoc` には `#[doc(include = "...")]` という属性を用いることで外部の Markdown ファイルをドキュメンテーションコメントとして取り込んでくれる機能があります。残念ながら現時点では不安定な機能ですが[^1]、これを使用することで Markdown ファイル内のコードブロックを `cargo test --doc` 時に検査することが可能になります。このときコードブロックをテストするために用いられるのは `cargo` そのものであり、前述した問題が発生する可能性はかなり低くなると期待できます（当然ゼロではありませんが、公式に配布されるものなのでまず放置されることはないでしょう…）。

`doubter` では、この `#[doc(include = "...")]` を手続き的マクロを用いてエミュレートし、Markdown ファイルをドキュメンテーションコメントとして取り込むことでコードブロックのテストを実現しています。具体的には、次のようにマクロを呼び出すことで指定した Markdown ファイルの内容をドキュメンテーションコメントとして持つダミーの定数定義がコードに挿入されます。

```rust
#[macro_use]
extern crate doubter;

// これが
doubter! {
    file = "README.md",
    file = "docs/getting-started.md",
    ...
}

// ↓ 次のように展開される

mod readme_md {
  #![doc = "... (README.md の中身) ..."]
}

mod docs {
  mod getting_started {
    #![doc = "... (docs/getting-started.md の中身) ..."]
  }
}
```

~~現在の仕様では、テストしたい Markdown ファイルへの相対パスを一つずつ記述する必要があります。glob pattern への対応などは将来的にサポートする予定です。~~

**(追記: 2018-10-13):** v0.0.5 で glob pattern に対応しました。

# 使い方

あるクレートの `README.md` 内のコードブロックをテストすることを考えます。ディレクトリ構成は次のようになっていると仮定します。

```
.
├── Cargo.toml
├── README.md
└── src
    └── lib.rs

1 directory, 3 files
```

`doubter` は Markdown ファイルをコメントとして展開するため、それをテストとして実行するためのクレートを別途用意する必要があります。`target/` を共有するため、テスト対象のクレートの `Cargo.toml` を編集し、追加したクレートを `[workspace.members]` に追加しておきます。


```shell-session:create-doctest-crate
$ cargo new --lib testcrates/test_markdown_files
$ edit Cargo.toml
```

```toml:Cargo.toml
...

[workspace]
members = [
    "testcrates/test_markdown_files",
]
```

テスト用のクレートの依存関係に `doubter` とテスト対象のクレートを追加し、`src/lib.rs` を編集してテスト対象となる Markdown ファイルへの（`src/lib.rs` の属するクレートの `Cargo.toml` が置かれた場所から見た）相対パスを記述していきます。

```toml:testcrates/test_markdown_files/Cargo.toml
[dependencies]
doubter = "0.0.3"

[dev-dependencies]
foo = { path = "../.." }
```

```rust:testcrates/test_markdown_files/src/lib.rs
#[macro_use]
extern crate doubter;

doubter! {
    file = "README.md",
}
```

最後に、作成したクレートのテストを実行して正しくテストが実行されているかどうかを確認したら完了です。

```shell-session
$ cargo test -p test_markdown_files
```

<!-- footnotes -->

[^1]: `#![feature(external_doc)]` で有効化出来る

<!-- links -->

[`skeptic`]: https://github.com/budziq/rust-skeptic

