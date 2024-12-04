---
title: Rust の文字列フォーマット回り (2)
published: "2017-10-06T16:48:57Z"
tags: [ "rust", "programming" ]
categories: [ "programming" ]
---

前回はフォーマット出力系のマクロの定義と呼び出している関数を確認した。
今回はそれらが実際に呼び出している `core::fmt::write()` の動作を見てみる。

<!-- more -->

# `Arguments`
`core::fmt::Arguments` の定義は次のようになっている。

[`src/libcore/fmt/mod.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/mod.rs#L388)
```rust
pub struct Arguments<'a> {
    pieces: &'a [&'a str],
    args: &'a [ArgumentV1<'a>],
    fmt: Option<&'a [rt::v1::Argument]>,
}
```

`pieces` はプレースホルダー（`"{}"`）の前後に挿入される文字列のスライス、`args` は 出力の対象となる変数への（型消去された）参照が格納された `ArgumentV1` のスライスが格納される。`fmt` には各プレースホルダーに対応したフォーマット用の設定が入る（`Option` なのは何もフォーマット指定がない時の最適化のため）。

`ArgumentV1` は次のように、対象となる変数への参照と出力用の関数で構成される。

[`src/libcore/fmt/mod.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/mod.rs#L259)
```rust
pub struct ArgumentV1<'a> {
    value: &'a Void,
    formatter: fn(&Void, &mut Formatter) -> Result,
}
```

これらの構造体はそれぞれコンストラクタ `Arguments::new_v1()`, `Arguments::new_v1::formatted()`, `ArgumentV1::new()` を持っているが、unstable 扱いでありドキュメントからは隠蔽されている。そもそもこれらの値は `format_args!()` により生成されるため、通常はユーザ側で意識する必要はない。

実行時に `Arguments` の値を生成したい場合はフィーチャ `fmt_internals` を有効にする必要がある。

[`playground`](https://play.rust-lang.org/?gist=164a619711842cb883510b30c2a8b648&version=nightly)
```rust
#![feature(fmt_internals)]

use std::{fmt, io};

fn my_format_string(s: &String, f: &mut fmt::Formatter) -> fmt::Result {
    f.write_str(s.as_str())
}

fn main() {
    let name = String::from("Alice");
    let suffix = String::from("!\n");

    // args.len() <= pieces.len() <= args.len() + 1 が満たされている必要がある
    let pieces = &["Hello, ", suffix.as_str()];
    let args = &[fmt::ArgumentV1::new(&name, my_format_string)];
    let format_args = fmt::Arguments::new_v1(pieces, args);

    print(format_args);
}

fn print(args: fmt::Arguments) {
    let _ = io::Write::write_all(&mut io::stdout(), fmt::format(args).as_bytes());
}
```

# `core::fmt::write()`
[`core::fmt::write(output, args)`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/mod.rs#L932) の中では大まかに次のような動作を行っている。

* `fmt::Formatter` のインスタンスを生成する
* `pieces[i]` と `args.arg[i].value` を交互に出力する

# おわりに
雑だが疲れたのでここまで。
