---
title: Rust の文字列フォーマット回り (1)
date: "2017-10-05T11:55:39Z"
tags: [ "rust", "programming" ]
categories: [ "programming" ]
---

気になったのでメモ。

<!-- more -->

* 2017-10-06T15:05 - リンク先の修正 + `format!()` の説明を追加

# Rust におけるフォーマット出力（おさらい）
Rust では、フォーマット付きの出力・文字列変換を実現するためにいくつかのマクロが提供されている。
* `print!()`, `println!()` - 標準出力への出力
* `eprint!()`, `eprintln!()` - 標準エラー出力への出力
* `write!()`, `writeln!()` - `core::io::Write` または `core::fmt::Write` を実装した型（ファイルなど）への出力
* `format!()` - `String` への変換
* `format_args!()` - `Arguments` の生成
これらのうち、 `format_args!()` はコンパイラ組み込みで、それ以外は通常の Rust のマクロとして定義されている。例えば、 `write!()`, `format!()` はそれぞれ次のように定義されている。

[`src/libcore/macros.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/macros.rs#L407)
```rust
macro_rules! write {
    ($dst:expr, $($arg:tt)*) => ($dst.write_fmt(format_args!($($arg)*)))
}
```

[`src/liballoc/macros.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/liballoc/macros.rs#L90)
```rust
macro_rules! format {
    ($($arg:tt)*) => ($crate::fmt::format(format_args!($($arg)*)))
}
```

`write!()` 内で呼び出されているメソッド `$dst.write_fmt(args)` は `core::fmt::Write` と `std::io::Write` が該当し、使用する側のトレイトを予めインポートしておく必要がある。
両者の違いは戻り値のエラー型に現れ、簡単に言うと `fmt::Write` の方はフォーマット関連のエラーのみを扱うのに対し `io::Write` はそれ以外の（IO関連の）エラーを返す可能性を持っている。まぁ通常は `io::Write` の方を使うことがほとんどだと思うが。

* `core::fmt::Write::write_fmt()` - `core::fmt::Result`
* `std::io::Write::write_fmt()` - `io::Result<()>`

エラー処理回りを除けば、両トレイトのデフォルト実装では最終的に `core::fmt::write(f, args)` を呼び出し、指定されたフォーマットで出力が実行される。

一方 `format!()` の方だが、これは内部で空 `String` を用意して `write_fmt()` を呼んでいるだけである。

[`src/liballoc/fmt.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/liballoc/fmt.rs#L527)
```rust
pub fn format(args: Arguments) -> string::String {
    let capacity = args.estimated_capacity();
    let mut output = string::String::with_capacity(capacity);
    output.write_fmt(args)
          .expect("a formatting trait implementation returned an error");
    output
}
```

# おわりに
`core::fmt::write()` と `format_args!()` の挙動がわかれば文字列のフォーマット周りの理解は出来そう。

疲れたので今回はここまで。次回は `format_args!()` と `core::fmt::Arguments` の定義回りを見たい。

TODO:
- [ ] `core::fmt::Arguments` の説明
- [ ] `format_args!()` の定義と使い方
- [ ] `core::fmt::write()` の中身を見る
