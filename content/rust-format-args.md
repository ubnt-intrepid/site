+++
title = "Rust の文字列フォーマット回り（改訂版）"
date = 2017-10-11T21:21:33Z

[taxonomies]
tags = [ "rust", "programming" ]
categories = [ "programming" ]
+++

まとめ直した

<!-- more -->

Rust では"型安全"かつユーザフレンドリな文字列フォーマットを実現するため、マクロを用いたフォーマット文字列の検証とコード生成を伴うコンパイル時チェックを行うAPIを提供している。<!--
-->このAPIを用いることで、ユーザは型安全なフォーマット出力を行うコードを直感的に記述することが出来るようになっている（そして初心者をしばしば混乱させる）。

様々なユースケースに対応するために、標準ライブラリにはフォーマット出力用にいくつかのマクロが用意されている。<!--
-->これらは `format_args!()` という（コンパイラ組み込みの）procedural macro により依存し、他のマクロの挙動は（出力先などの差異を除けば）これに支配される。<!--
-->本記事の目的は、これらの構成要素の実装を把握しその挙動を理解することである。<!--
-->マクロにより隠蔽された内部動作をある程度理解しておくことで、各マクロの正しい使い方などが知ることが出来るだろう。

> 本記事は 2017-10-09 時点での最新安定版である 1.20 のソースコードを元に書いた。

# Rust の文字列フォーマット API
まず、Rustが文字列フォーマットのために提供している API がどのように実装されているのかを見てみることにする。<!--
-->API自体の詳細な使用方法などはモジュール [`std::fmt`](https://doc.rust-lang.org/std/fmt/) のドキュメントを参照されたい。

文字列フォーマットのために提供されているマクロは以下の通りである。
* `print!()`, `println!()` - 標準出力への出力
* `eprint!()`, `eprintln!()` - 標準エラー出力への出力
* `write!()`, `writeln!()` - `core::fmt::Write` を実装した型（ファイルなど）への出力
* `format!()` - `String` への変換

これらのマクロは、内部で `format_args!()` を用いた（通常の意味での）マクロとして定義されており、その挙動は以下の2つの処理に要約することができる。
* `format_args!()` による `Arguments` の構築
* `core::fmt::write()` による（対応する出力先への）フォーマット出力

このことを実際に確認してみる。<!--
-->いま、各マクロの定義は次のように定義されている（`println!()` などは `concat!()` を用いて改行を付与するだけなので無視した）。

[`src/libstd/macros.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libstd/macros.rs#L119)
```rust
macro_rules! print {
    ($($arg:tt)*) => ($crate::io::_print(format_args!($($arg)*)));
}
```

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

マクロの展開後に用いられる各関数・メソッドの定義は以下のようになっている。<!--
-->重要なのは、これらの関数は最終的にトレイト `core::fmt::Write` のメソッド `Write::fmt()` を呼びだしているという点である。

[`src/libstd/io/stdio.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libstd/io/stdio.rs#L673)
```rust
fn print_to<T>(args: fmt::Arguments,
               local_s: &'static LocalKey<RefCell<Option<Box<Write+Send>>>>,
               global_s: fn() -> T,
               label: &str) where T: Write {
    let result = match local_s.state() {
        LocalKeyState::Uninitialized |
        LocalKeyState::Destroyed => global_s().write_fmt(args),
        LocalKeyState::Valid => {
            local_s.with(|s| {
                if let Ok(mut borrowed) = s.try_borrow_mut() {
                    if let Some(w) = borrowed.as_mut() {
                        return w.write_fmt(args);
                    }
                }
                global_s().write_fmt(args)
            })
        }
    };
    if let Err(e) = result {
        panic!("failed printing to {}: {}", label, e);
    }
}
```

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

`write!()` 内で呼ばれているメソッド `$dst.write_fmt()` はトレイト `core::fmt::Write` と `std::io::Write` で定義されているメソッドのいずれかが用いられる（使用時に該当のトレイトをインポートしておく必要がある）。<!--
-->実際のところ、`std::io::Write::write_fmt()` のデフォルト実装は `core::fmt::Write::write_fmt()` を呼び出すためのラッパでしかない。

要するに、文字列フォーマット処理の実体は `core::fmt::Write` のメソッドである `Write::write_fmt()` である。<!--
-->このメソッドのデフォルト実装は次のようになっており、`$dst` を適当な構造体にラップした後 `core::fmt::write()` を呼んでいるだけである。

[`src/libcore/fmt/mod.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/mod.rs#L185)
```rust
    fn write_fmt(&mut self, args: Arguments) -> Result {
        // self: &mut Self は Sized を実装しない（トレイトオブジェクトに変換できない）のでその対応策
        struct Adapter<'a,T: ?Sized +'a>(&'a mut T);
        impl<'a, T: ?Sized + Write> Write for Adapter<'a, T> { /* ... */ }

        write(&mut Adapter(self), args)
    }
```

`core::fmt::write()` の詳細は後述する。

# `format_args!()`
`format_args!()` は、与えられたフォーマット文字列と引数群から `core::fmt::Arguments` を構築するコードを生成する、コンパイラ組み込みのマクロである。<!--
-->このマクロは第1引数にフォーマット文字列、それ以降にフォーマット出力の対象となる変数を取る。<!--
-->このマクロの評価時に行われる処理は、大雑把に次のように要約できる。

1. 第1引数に与えられる文字列リテラルの構文解析を実行し、プレースホルダー（`"{}"`）とそれ以外の文字列に分割する
2. プレースホルダ部と残りの引数の整合性（個数、名前など）を検証し、コード生成に必要な情報を作る
3. 得られた情報を元に `Arguments` のコード生成を実行する

フォーマット文字列はコード生成時に解析する必要があるため、必ず文字列_リテラル_である必要がある。

`format_args!()` により生成されるコードは、例えば次のようになる。

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

## `core::fmt::Arguments`
`Arguments` は `format_args!()` により生成される、フォーマット出力に必要な情報を格納した構造体である。<!--
-->この構造体はモジュール `core::fmt` で定義されており、その定義は次のようになっている。

[`src/libcore/fmt/mod.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/mod.rs#L388)
```rust
pub struct Arguments<'a> {
    pieces: &'a [&'a str],
    fmt: Option<&'a [rt::v1::Argument]>,
    args: &'a [ArgumentV1<'a>],
}
```

`fmt` には各プレースホルダの位置・フォーマット指定子の情報が入る。<!--
-->`args` は `format_args!()` の第2引数以降で渡される、フォーマットの対象となる式への参照が入る。<!--
-->`pieces` はプレースホルダ間に挿入される文字列のスライスである。

`ArgumentV1` は `format_args!()` の第2引数以降で渡されるフォーマット対象の参照を保持するための構造体であり、モジュール `core::fmt` 内で次のように定義されている。

[`src/libcore/fmt/mod.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/mod.rs#L259)
```rust
pub struct ArgumentV1<'a> {
    value: &'a Void,
    formatter: fn(&Void, &mut Formatter) -> Result,
}
```

`value` には対象となる値への参照である（`Void` は型消去のためのダミー構造体）。<!--
-->`formatter` は `value` を出力するための関数のポインタを保持する。<!--
-->この関数ポインタのシグネチャに適合する関数は、`core::fmt::Display::fmt` などが該当する。

`rt::v1::Argument` はフォーマット文字列内の各プレースホルダに対応する情報を格納する構造体である。<!--
-->これは `core::fmt::rt::v1` 内で次のように定義されている。

[`src/libcore/fmt/rt/v1.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/rt/v1.rs)
```rust
pub struct Argument {
    pub position: Position,
    pub format: FormatSpec,
}
```
`position` は表示する変数の位置、`format` にはそのプレースホルダにおける書式設定がそれぞれ格納される。<!--
-->各プレースホルダの出力処理が行われる際、`format` の値に基づきフォーマッタの内部状態が変更されるようになっている（具体的な処理は後述）。

## マクロ実装の詳細
`format_args!()` は [`syntax_ext`](https://github.com/rust-lang/rust/tree/1.20.0/src/libsyntax_ext) というクレートで定義された procedural macro である。<!--
-->その実体は [`expand_format_args()`](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L676) という関数で定義されている。<!--
-->このクレートには `format_args!()` の他に、`concat!()` などの組み込みマクロや `Clone`, `Display` など基本的なトレイト実装の導出をするための処理が定義されている。

`expand_format_args()` の中では、概ね次のことを行っている。

1. トークン列の解析  
まず、マクロの引数として与えられるトークン列を解析し、フォーマット文字列と引数部の情報を取り出す。<!--
-->これは [`parse_args()`](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L124) で行っている。

2. 文字列リテラルの解析  
トークン列の解析が完了すると [`expand_preparsed_format_args()`](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L691) が呼ばれる。<!--
-->第1引数が文字数リテラルであることを確認した後、その文字列の値を読み取り構文解析を実行する。<!--
-->文字列リテラルの解析処理は [`fmt_macros`](https://github.com/rust-lang/rust/tree/1.20.0/src/libfmt_macros) というクレートに独立して定義されている。<!--
-->`fmt_macros::Parser` を用いてフォーマット文字列を `fmt_macros::Piece` の系列に変換した後、各要素を検証しつつ集計する（[該当場所](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L729-L745)）。

3. 引数との整合性検証  
フォーマット文字列の解析結果と残りの引数との整合性を検証し、コード生成に必要な情報を取り出す。<!--
-->このとき、引数の数が多い場合は間違ったフォーマット指定子（printf形式など）を使用していないか検査され、<!--
-->使用している場合はエラーメッセージに反映される（[該当箇所](https://github.com/rust-lang/rust/blob/1.20.0/src/libsyntax_ext/format.rs#L809-L859)）。

4. コード生成  
解析が完了したら `Context::into_expr()` を呼び出し、生成されたコードの AST を吐き出す。

# `core::fmt::write()`
`Arguments` の値を元に実際の文字列フォーマット処理を行うのが、モジュール `core::fmt` で定義されている関数 `write()` である。<!--
-->この中では、大まかに次の動作を行う。
* フォーマッタ `core::fmt::Formatter` のインスタンスを構築
* 以下を交互に実行する
  - `formatter.write_str(pieces[i])`
  - (`args.fmt` が `Some(fmt_args)` の場合) `formatter.run(fmt_args[i])`
    + `fmt_args[i].format` に従い `formatter` の内部状態を設定
    + `fmt_args[i].position` と `formatter.args`, `formatter.curarg` から引数の位置を特定する => `arg`
    + `(arg.formatter)(arg.value, &mut formatter)`
  - (`args.fmt` が `None` の場合) `(args[i].formatter)(args[i].value, &mut formatter)`

`Formatter` の定義は以下の通りである。

[`src/libcore/fmt/mod.rs`](https://github.com/rust-lang/rust/blob/1.20.0/src/libcore/fmt/mod.rs#L231)

```rust
pub struct Formatter<'a> {
    // フォーマット指定 (rt::v1::FormatSpec の値が上書きされる）
    flags: u32,
    fill: char,
    align: rt::v1::Alignment,
    width: Option<usize>,
    precision: Option<usize>,

    // 出力先
    buf: &'a mut (Write + 'a),

    args: &'a [ArgumentV1<'a>],   
    // "{}" の指す位置を追跡するためのイテレータ
    curarg: slice::Iter<'a, ArgumentV1<'a>>,
}
```

# 具体例
コード生成部分の処理を詳細に読み込んでいく前に力尽きてしまったので、<!--
-->最後に `format_args!()` の生成するコードを実際に見てみることにする。

マクロ展開後のソースコードを見るためには次のようにする（不安定版の機能を用いるため nightly チャンネルの rustc を使う）。

```console
$ rustup run nightly -Z unstable-options --pretty=expanded program.rs
```

可読性のため、以後のコードでは次のコードが予め挿入されていると仮定する。

```rust
#![feature(fmt_internals)]
use std::fmt::*;
use std::fmt::rt::v1::*;
```

## 単純な場合
```rust
format_args!("foo => {}, bar => {:?}\n", foo, bar)
```
```rust
Arguments::new_v1(
    &["foo => ", ", bar => ", "\n"],
    &match (&foo, &bar) {
        (__arg0, __arg1) => [
            // フォーマット指定に対応した関数ポインタが渡される
            ArgumentV1::new(__arg0, Display::fmt),
            Argumentv1::new(__arg1, Debug::fmt),
        ],
    },
    // プレースホルダの個数・位置と渡された引数が合致するため
    // `Arguments::fmt` は使用されない
)
```

## `Arguments::fmt` が非 `None` となる場合
```rust
let width = 10;
let precision = 2;
format_args!("{0} {1} {:06.1} {0:02$.3$}", 42.14, "Hello", width, precision)
```
```rust
Arguments::new_v1_formatted(
    &["", " ", " ", " "],
    &match (&42.14, &"Hello", &width, &precision) {
        (__arg0, __arg1, __arg2, __arg3) => [
            ArgumentV1::new(__arg0, Display::fmt),
            ArgumentV1::new(__arg1, Display::fmt),
            ArgumentV1::from_usize(__arg2),
            ArgumentV1::from_usize(__arg3),
        ],
    },
    &[
        // デフォルトのフォーマット指定が用いられるが、
        // 他のプレースホルダに合わせて `rt::v1::Argument` が用いられる
        Argument {
            position: Position::At(0usize),
            format: FormatSpec {
                fill: ' ',
                align: Alignment::Unknown,
                flags: 0u32,
                precision: Count::Implied,
                width: Count::Implied,
            },
        },
        Argument {
            position: Position::At(1usize),
            format: FormatSpec {
                fill: ' ',
                align: Alignment::Unknown,
                flags: 0u32,
                precision: Count::Implied,
                width: Count::Implied,
            },
        },

        Argument {
            position: Position::At(0usize),   // 引数の位置はコンパイル時に解決される
            format: FormatSpec {
                fill: ' ',
                align: Alignment::Unknown,
                flags: 8u32,
                precision: Count::Is(1usize), // 指定された width, precision が
                width: Count::Is(6usize),     // 使用される
            },
        },

        Argument {
            position: Position::At(0usize),
            format: FormatSpec {
                fill: ' ',
                align: Alignment::Unknown,
                flags: 8u32,
                precision: Count::Param(3usize),  // width, precision の値は
                width: Count::Param(2usize),      // 引数から動的に決定される
            },
        },
    ],
)
```

余談だが、`format_args!()` により生成されるコードは十分に最適化されていないことがあり、<!--
-->次のような単純な場合でも `Arguments::fmt` が使用されることがある。

```rust
format_args!("{0}{0:?}", x)
```

```rust
Arguments::new_v1_formatted(
    &["", ""],
    &match (&x,) {
        (__arg0,) => [
            ArgumentV1::new(__arg0, Display::fmt),
            ArgumentV1::new(__arg0, Debug::fmt),
        ],
    },
    &[
        Argument {
            position: Position::At(0usize),
            format: FormatSpec {
                fill: ' ',
                align: Alignment::Unknown,
                flags: 0u32,
                precision: Count::Implied,
                width: Count::Implied,
            },
        },
        Argument {
            position: Position::At(1usize),
            format: FormatSpec {
                fill: ' ',
                align: Alignment::Unknown,
                flags: 0u32,
                precision: Count::Implied,
                width: Count::Implied,
            },
        },
    ],
)
```
このコードは、本来こう展開されるのが望ましい。
```rust
Arguments::new_v1(
    &["", ""],
    &[
        ArgumentV1::new(&x, Display::fmt),
        ArgumentV1::new(&x, Debug::fmt),
    ],
)
```

若干面倒になるが、次のようにすることで「最適化」されたコードを生成させることが出来る。
```rust
format_args!("{0}{1:?}", x, x)  // プレースホルダの個数・順序と引数の個数を合わせる
```
```rust
::std::fmt::Arguments::new_v1(
    &["", ""],
    &match (&x, &x) {
        (__arg0, __arg1) => [
            ::std::fmt::ArgumentV1::new(__arg0, ::std::fmt::Display::fmt),
            ::std::fmt::ArgumentV1::new(__arg1, ::std::fmt::Debug::fmt),
        ],
    },
)
```

同様の現象は、プレースホルダの順番"のみ"が異なる場合などにも生じ、パフォーマンスを極限まで高めたい場合には注意が必要である。<!--
-->まぁ実際には気にする必要はない気もするが…

# おわりに
本記事では、マクロにより隠蔽された Rust の文字列フォーマットの詳細を見てみた。<!--
-->実際にコーディングする上ではあまり気にすることない領域の話ではあるが、実装の詳細に立ち返って<!--
-->見ることで新たな発見を見つけることが出来、良い経験にはなったと思う。<!--
-->
