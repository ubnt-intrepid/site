---
title: Rust の文字列フォーマット周り (3)
published: "2017-10-08T20:29:46Z"
tags: [ "rust", "programming" ]
categories: [ "programming" ]
---

前回は `format_args!()` が出力する `core::fmt::Arguments` の詳細を見てみた。
今回はコード生成周りを概観する。

* 2017-10-09T21:26: 少し説明を追加

<!-- more -->

# `format_args!()`
`format_args!()` は、与えられたフォーマット文字列と引数群から `core::fmt::Arguments` を構築するコードを生成する、コンパイラ組み込みのマクロである。<!--
-->このマクロは第1引数にフォーマット文字列、それ以降にフォーマット出力の対象となる変数を取る。<!--
-->フォーマット文字列はコード生成時に解析する必要があるため、必ず文字列_リテラル_である必要がある。<!--
-->生成されるコードは、例えば次のようになる。

```rust
let name1 = "Alice";
let name2 = "Bob";
let args = format_args!("Hello, {0} and {1}!\n", name1, name2);
```

```rust
let name1 = "Alice";
let name2 = "Bob";
let args = ::std::fmt::Arguments::new_v1(
    &["Hello, ", " and ", "!\n"],
    &match (&name1, &name2,) {
        (__arg0, __arg1) => [
            ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Display::fmt),
            ::std::fmt::ArgumentV1::new(__arg1, ::std::fmt::Display::fmt),
        ],
    },
);
```


`format_args!()` の実体は [`syntax_ext`](https://github.com/rust-lang/rust/tree/1.20.0/src/libsyntax_ext) というクレートで定義された [`expand_format_args()`](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L676) という関数である。<!--
-->その中では、概ね次のことを行っている。
1. トークン列の解析
2. 文字列リテラルの解析
3. 引数との整合性検証
4. コード生成

## トークンの解析
まず、マクロの引数として与えられるトークン列を解析し、フォーマット文字列と引数部の情報を取り出す。<!--
-->これは [`parse_args()`](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L124) で行っている。

## 文字列リテラルの解析
トークン列の解析が完了すると [`expand_preparsed_format_args()`](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L691) が呼ばれる。<!--
-->第1引数が文字数リテラルであることを確認した後、その文字列の値を読み取り構文解析を実行する。<!--
-->文字列リテラルの解析処理は [`fmt_macros`](https://github.com/rust-lang/rust/tree/1.20.0/src/libfmt_macros) というクレートに独立して定義されている。<!--
-->`fmt_macros::Parser` を用いてフォーマット文字列を `fmt_macros::Piece` の系列に変換した後、各要素を検証しつつ集計する（[該当場所](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L729-L745)）。

## 引数との整合性検証
フォーマット文字列の解析結果と残りの引数との整合性を検証し、コード生成に必要な情報を取り出す。<!--
-->このとき、引数の数が多い場合は間違ったフォーマット指定子（printf形式など）を使用していないか検査され、<!--
-->使用している場合はエラーメッセージに反映される（[該当箇所](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L809-L859)）。

## コード生成
解析が完了したら `Context::into_expr()` を呼び出し、生成されたコードの AST を吐き出す。

# `format_args!()` のコード生成
コード生成部分の処理を詳細に読み込んでいく前に力尽きてしまったので、休憩も兼ねて `format_args!()` の生成するコードを見てみることにする。

マクロ展開後のソースコードを見るためには次のようにする（不安定版の機能を用いるため nightly チャンネルの rustc を使う）。
```console
$ rustup run nightly rustc -Z unstable-options --pretty=expanded hoge.rs
```

## `new_v1()`

* まずは単純な例
  ```rust
  format_args!("Hello, {0} and {1}!\n", "Alice", "Bob")
  ```

  ```rust
  ::std::fmt::Arguments::new_v1(
      &["Hello, ", " and ", "!\n"],
      &match (&"Alice", &"Bob",) {
          (__arg0, __arg1) => [
              ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Display::fmt),
              ::std::fmt::ArgumentV1::new(__arg1, ::std::fmt::Display::fmt),
          ],
      },
  )
  ```

* 名前付き引数
  ```rust
  format_args!(
      "id => {0}, name => {name}, address => {address}",
      42,
      name="Alice",
      address="Nagoya",
  )
  ```

  ```rust
  ::std::fmt::Arguments::new_v1(
      &["id => ", ", name => ", ", address => "],
      &match (&42, &"Alice", &"Nagoya") {
          (__arg0, __arg1, __arg2) => [
              ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Display::fmt),
              ::std::fmt::ArgumentV1::new(__arg1, ::std::fmt::Display::fmt),
              ::std::fmt::ArgumentV1::new(__arg2, ::std::fmt::Display::fmt),
          ],
      },
  )
  ```

* 出力用のトレイト変更
  ```rust
  format_args!("Hello, I'm {:?} and 0x{:x} years old!", "Alice", 42)
  ```

  ```rust
  ::std::fmt::Arguments::new_v1(
      &["Hello, I'm ", " and 0x", " years old!"],
      &match (&"Alice", &42) {
          (__arg0, __arg1,) => [
              ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Debug::fmt),
              ::std::fmt::ArgumentV1::new(__arg1, ::std::fmt::LowerHex::fmt),
          ],
      },
  )
  ```

## `new_v1_formatted()`
引数の順序が入れ替わったり追加のパラメータが設定されたりすると `new_v1_formatted()` が用いられる。

* 2番目の例の引数の順序を入れ替えてみる
  ```rust
  format_args!(
      "id => {0}, name => {name}, address => {address}",
      42,
      address="Nagoya", // <-
      name="Alice",     // <- 引数の順序を入れ替えただけ
  )
  ```
  ```rust
  ::std::fmt::Arguments::new_v1_formatted(
      &["id => ", ", name => ", ", address => "],
      &match (&42, &"Nagoya", &"Alice") {
          (__arg0, __arg1, __arg2) => [
              ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Display::fmt),
              ::std::fmt::ArgumentV1::new(__arg1, ::std::fmt::Display::fmt),
              ::std::fmt::ArgumentV1::new(__arg2, ::std::fmt::Display::fmt),
          ],
      },
      &[
          ::std::fmt::rt::v1::Argument {
              position: ::std::fmt::rt::v1::Position::At(0usize),
              format: ::std::fmt::rt::v1::FormatSpec {
                  fill: ' ',
                  align: ::std::fmt::rt::v1::Alignment::Unknown,
                  flags: 0u32,
                  precision: ::std::fmt::rt::v1::Count::Implied,
                  width: ::std::fmt::rt::v1::Count::Implied,
              },
          },
          ::std::fmt::rt::v1::Argument {
              position: ::std::fmt::rt::v1::Position::At(2usize),
              format: ::std::fmt::rt::v1::FormatSpec {
                  fill: ' ',
                  align: ::std::fmt::rt::v1::Alignment::Unknown,
                  flags: 0u32,
                  precision: ::std::fmt::rt::v1::Count::Implied,
                  width: ::std::fmt::rt::v1::Count::Implied,
              },
          },
          ::std::fmt::rt::v1::Argument {
              position: ::std::fmt::rt::v1::Position::At(1usize),
              format: ::std::fmt::rt::v1::FormatSpec {
                  fill: ' ',
                  align: ::std::fmt::rt::v1::Alignment::Unknown,
                  flags: 0u32,
                  precision: ::std::fmt::rt::v1::Count::Implied,
                  width: ::std::fmt::rt::v1::Count::Implied,
              },
          },
      ],
  )
  ```
  `Arguments` のコンストラクタが `new_v1` から `new_v1_formatted` に変更されている。


* 複数のフォーマットを使い分ける
  ```rust
  format_args!("Display => {0}, Debug => {0:?}", 42)
  ```
  ```rust
  ::std::fmt::Arguments::new_v1_formatted(
      &["Display => ", ",  Debug => "],
      &match (&42,) {
          (__arg0,) => [
              ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Display::fmt),
              ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Debug::fmt),
          ],
      },
      &[
          ::std::fmt::rt::v1::Argument {
              position: ::std::fmt::rt::v1::Position::At(0usize),
              format: ::std::fmt::rt::v1::FormatSpec {
                  fill: ' ',
                  align: ::std::fmt::rt::v1::Alignment::Unknown,
                  flags: 0u32,
                  precision: ::std::fmt::rt::v1::Count::Implied,
                  width: ::std::fmt::rt::v1::Count::Implied,
              },
          },
          ::std::fmt::rt::v1::Argument {
              position: ::std::fmt::rt::v1::Position::At(1usize),
              format: ::std::fmt::rt::v1::FormatSpec {
                  fill: ' ',
                  align: ::std::fmt::rt::v1::Alignment::Unknown,
                  flags: 0u32,
                  precision: ::std::fmt::rt::v1::Count::Implied,
                  width: ::std::fmt::rt::v1::Count::Implied,
              },
          },
      ],
  )
  ```

* [フォーマットのパラメータ](https://doc.rust-lang.org/std/fmt/#formatting-parameters)を設定
  ```rust
  format_args!("{:0x}", 42)
  ```
  ```rust
  ::std::fmt::Arguments::new_v1_formatted(
      &[""],
      &match (&42,) {
          (__arg0,) => [
              ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::LowerHex::fmt),
          ],
      },
      &[
          ::std::fmt::rt::v1::Argument {
              position: ::std::fmt::rt::v1::Position::At(0usize),
              format: ::std::fmt::rt::v1::FormatSpec {
                  fill: ' ',
                  align: ::std::fmt::rt::v1::Alignment::Unknown,
                  flags: 8u32,
                  precision: ::std::fmt::rt::v1::Count::Implied,
                  width: ::std::fmt::rt::v1::Count::Implied,
              },
          },
      ],
  )
  ```
