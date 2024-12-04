---
title: Rust のマクロ・構文拡張，および Macros 2.0 について
date: "2017-12-10T19:07:51Z"
tags: [ "rust", "advent calendar", "macros" ]
categories: [ "programming" ]
---

本記事は [Rust Internal Advent Calendar 2017][adc] 第10日目の記事です．

[adc]: https://qiita.com/advent-calendar/2017/rust-internal

本記事では，Rust の主要な機能の一つである「マクロ」および「構文拡張」についての現状認識と，将来的な導入のために検討が進んでいる Macros 2.0 についての概略をまとめる．
記事執筆時における情報をもとに記述しているため，将来的にその仕様が（大幅に）変更される可能性があることに注意されたい．

<!-- more -->

# はじめに

## Rust のマクロ・構文拡張

Rust は，構文解析後に抽象構文木 (AST) を書き換える操作を注入するために **マクロ (macro)** および **構文拡張 (syntax extension)** という仕組みを提供している．

Rust のマクロは，それが構文解析後に行われるという点で C や C++ におけるプリプロセッサとは対照的なものである．マクロの仕様に関する詳細は Rust 公式の [ドキュメント] や，こちらの記事を参照されたい．

まとめると，Rust で使用できるコード生成を行うための仕組みは次の3つに大別できる．

※ cargo の使用を前提とすれば `build.rs` を用いてコード生成を行うことも可能であるが今回は対象としない．

**マクロ**

関数形式で呼び出し，引数として与えられたトークン列を元にコードを生成する．

```rust
foo!(a + b)
```

関数形式のマクロは，宣言的な (declative) ものと手続き的な (procedural) ものの 2 種類存在する（これらの違いをマクロの使用時に気にする必要はない）．
宣言的なものは例示によるマクロ (macro by example) などと呼ばれ，独自の構文を持ちパターンマッチ形式でマクロ定義を記述する．
一方，手続き的マクロ (procedural macro) は Rust のコードとして記述するマクロであり，コンパイル時に rustc によって呼び出される．例えば，組み込みのマクロ `format_args!()` は手続き的マクロにより定義されている（[参考]）．

**カスタム属性 (custom attribute)**

AST 内の任意の [項目 (item)](https://doc.rust-lang.org/nightly/reference/items.html) に付随し，項目自体の書き換えや追加のコードの生成を行う．
例えば，著名な HTTP フレームワークである [Rocket] では，custom attribute を用いて Python の Flask に似た直感的なルーティングの定義を実現している:

```rust
#[get("/")]
pub fn index() -> &'static str {
    "Hello, world"
}
```

### custom derive
見た目は custom attribute と類似するが，こちらは構造体・列挙型の定義に付随して対応するトレイト実装のコード生成を行う．トレイトの実装を導出する目的で用いるのが通例だがそれ以外の要素を生成することもできる．

```rust
#[derive(Foo)]
struct Foo {
    #[foo(name = "bar")]
    pub baz: i32,
}
```

## 定義方法
上記の構文拡張を用いるためには，現行のバージョンでは以下の2つの手段のいずれかを用いる必要がある．なお，本稿で説明するのは概略のみてあり，具体的な使用方法などは Rust 公式のドキュメントなどを参照されたい（あまりないですが…）．

### `macro_rules!`
`macro_rules!` はソースコード中に宣言形式でマクロを定義するための構文である．次のようにパターンマッチ形式でマクロの定義を記述する．

```rust
macro_rules! swap {
    ($a:ident, $b:ident) => {
        let tmp = $a;
        $b = $a;
        $a = tmp;
    };
}
```

この `macro_rules` 自体も（特殊なシグネチャを持つ）マクロとして登録されている．


### コンパイラ・プラグイン
コンパイラ・プラグインは，文字通り `rustc` の機能を拡張するために用いられている仕組みである．
構文拡張を登録するための API が提供されており，これを用いることで手続き的マクロを定義することが出来る．

コンパイラ・プラグインは独立したクレートとしてコンパイルされ，コンパイル時に動的ライブラリとして rustc により読み込まれることでマクロが登録される．
プラグインの基本形は次のようになる．

```rust
#![crate-type = "dylib"]

// 属性 #[plugin_registrar] を有効にする
#![feature(plugin_registrar)]

// rustc_plugin, syntax クレートへのアクセスを有効にする
#![feature(rustc_private)]

extern crate syntax;
extern crate rustc_plugin;

use rustc_plugin::Registry;

// コンパイラ・プラグインの読み込み時に呼び出される関数．ここで手続き的マクロを登録する
#[plugin_registrar]
pub fn registrar(registry: &mut Registry) {
    ...
}
```

## 現行システムの問題点

現行のマクロは，関数や構造体など他の要素とは異なる[独自の名前解決の体系][^1]を持っている．特に手続き的マクロはモジュール化の仕組みを「全く」持っておらず，通常の（`macro_rules!`）マクロもモジュールシステムのサポートは（非常に）部分的なものに留まっている．

[^1]: `#[macro_export]` や `$crate` など

また，手続き的マクロの登録にコンパイラプラグインを用いる（そして，rustc 内部のクレートに直接依存する）という事実は，マクロの定義がコンパイラ内部の構造（抽象構文木の定義など）に強く依存してしまうことを意味する．そのためマクロの実装者は，ドキュメントが十分整備されていないコンパイラの内部構造に対する理解を深めなければいけない．また，コンパイラプラグインはその特性上安定化させることが不可能であるため（安定化してしまうと，コンパイラの内部構造を書き換えることが実質不可能になってしまう），「手続き的マクロを使う」だけのためにマクロの使用者に nightly 版のコンパイラの使用を強制することになる．

# Macros 2.0
上記の問題を踏まえ，現在 Rust 開発チームでは Macros 2.0 という新しいマクロの構想を立ち上げ，これらの問題の改善に取り組んでいる．それらの RFC の概略を説明する（ここに記載されている内容は，安定化に伴い変更される可能性がある）．

## マクロの命名とモジュール化 ([RFC 1561]), 宣言的マクロ (Declarative Macro) ([RFC 1584])
独自の体系を持つマクロの名前解決の仕組みを，他の第一級オブジェクト（関数・トレイトなど）と同じにしようという提案．この提案により，次のことが可能になる（予定である）．

* マクロ定義，および展開の順序は重要ではなくなる．すなわち，マクロ定義を使用した「後に」行うことが可能になる．
* マクロが，（他の要素と同じように）`::` で区切られたパスを用いて名前付けすることが可能になる．
* マクロのインポートが他の要素と同じ手順で行えるようになる（`#[macro_use]` が不要になる）．

```rust
fn foo() {
    // 定義する前にマクロを使用することが出来る
    foo!();
    macro! foo { ... }
}
```

```rust
mod foo {
    macro! bar { ... }
}

fn main() {
    foo::bar!(); // 通常の関数のようにモジュール化される
}
```

```rust
// 属性形式についても同様
#[::foo:bar(baz)]
fn hoge() { ... }
```

```rust
extern crate foo;   // #[macro_use] は不要

use foo::bar::baz;  // 他の要素と同じように取り込む (!は不要)

fn main() {
    baz!();
    
    {
        macro! baz { ... }  // 他の要素と同様，マクロもシャドウイングされる
                            // 変数や型とは異なる名前空間が与えられる
        baz!();
    }
}
```

この RFC では，適用されるのが従来の `macro_rules!` とは異なることを明示するために `macro!` という新しいマクロが導入されている（これは新しいマクロシステムが構文拡張として導入されることを意図したものと考えられる）．
しかし，後に採択された [RFCこれは `macro` キーワードに置き換えられている．これは，プライバシーを含む構文 (`pub macro! foo { ...}`) の解析が容易ではないためだと考えられる．新しい構文は基本的には従来の `macro_rules!` と同じように用いることが出来る．

```rust
pub macro foo {
    ($x:expr, $y:expr) => {
        $x + $y
    }
}
```

```rust
// マッチするパターンが一つの場合は次のように簡略化出来る
macro foo($a: ident) => {
    $a + 1
}
```

## 手続き的マクロ ([RFC 1566], [RFC 1681])
`rustc` の内部実装に依存することなく手続き的マクロを定義するための仕組みと API が整備された上で安定版に提供される．具体的には次のことが行われる（あるいはすでに行われている）．

* 手続き的マクロのための（安定化を視野に入れた）APIの提供．従来のように `libsyntax` を直接用いるのではなく，マクロの構築に必要なものだけをラップした `proc_macro` という名前のクレートを用意し，この中で API を提供するようにする．
* トークンベースの仕組みの採用．AST ノードを直接扱うのではなく，それらを抽象化した「トークン列」としてやり取りすることで AST の内部実装の変化に対する剛健性を持たせる．直接 AST を扱う場合と比較すると，一度トークン列を介してしまうため多少のオーバヘッドが生じる．また，可能なコード生成に制限が追加される（例えば，`asm!()` のように具象構文に存在しない AST のノードを挿入することが出来ないなど）が，多くの用途では影響はないだろう．
* 手続き的マクロ用のクレートの種類 `proc-macro` の追加．これは，そのクレートが手続き的マクロのためのものである（すなわち，`rustc` により読み込まれコンパイル時に内部の関数が呼び出される）ことを注釈するものである．現在，手続き的マクロ以外の要素（トレイトの定義など）はエクスポート出来ないように制限がかかっているが，これを緩和される案が挙がっている（これが実現することで `serde` と `serde_derive` のように別々にクレートを用意する手間が省ける）．

`proc-macro` に基づく手続き的マクロの宣言は次のような枠組みとなる．

```rust
#![feature(proc_macro)]

extern crate proc_macro;

use proc_macro::TokenStream;

// 関数形式のマクロ
#[proc_macro]
pub fn foo(input: TokenStream) -> TokenStream {
    ...
}

// 属性形式のマクロ
#[proc_macro_attribute]
pub fn foo(attr: TokenStream, item: TokenStream) -> TokenStream {
    ...
}

// custom derive
#[proc_macro_derive(Foo)]
pub fn register_derivation_foo(input: TokenStream) -> TokenStream {
    ...
}
```

# 実装状況
宣言的マクロは，フィーチャ `decl_macro` を有効にすることで使用することが出来る．
  - https://github.com/rust-lang/rust/pull/40847

手続き的マクロはいくつかの機能（custom derive）がすでに安定版で利用可能である．フィーチャ `proc_macro` を有効にすることで不安定な機能を有効化することが出来る．

# その他
手続き的マクロにおいて「健全な (hygiene)」コード生成やパターンマッチを用いる API を導入する案が挙がっているが，進行状況は不明である．

# 参考リンク
## Issue など
* [Tracking issue for RFC 1566: Procedural macros](https://github.com/rust-lang/rust/issues/38356)
  - [Roadmap](https://github.com/rust-lang/rust/issues/38356#issuecomment-274377210)
* [Tracking issue for "Macros 1.1" (RFC #1681)](https://github.com/rust-lang/rust/issues/35900)
* [Tracking issue: declarative macros 2.0](https://github.com/rust-lang/rust/issues/39412)
  - [Roadmap](https://github.com/rust-lang/rust/issues/39412#issuecomment-277867338)
* https://github.com/jseyfried/rfcs/blob/hygiene/text/0000-hygiene.md
  - declarative macros 2.0 の衛生 (hygiene) に関する仕様

## `@nrc` のブログ記事
* [Macro plans, overview](https://ncameron.org/blog/macro-plans-overview/) <!-- 2015/11/24 -->
* [Macro plans - syntax](https://ncameron.org/blog/macro-plans-syntax/) <!-- 2015/12/07 -->
* [Procedural macros, framework](https://ncameron.org/blog/procedural-macros-framework/) <!-- 2015/12/16 -->
* [Libmacro](https://ncameron.org/blog/libmacro/) <!-- 2016/01/18 -->
* [Macros and name resolution](https://www.ncameron.org/blog/name-resolution/) <!-- 2016/01/27 -->

[RFC 1561]: https://github.com/rust-lang/rfcs/blob/master/text/1561-macro-naming.md
[RFC 1566]: https://github.com/rust-lang/rfcs/blob/master/text/1566-proc-macros.md
[RFC 1584]: https://github.com/rust-lang/rfcs/blob/master/text/1584-macros.md
[RFC 1681]: https://github.com/rust-lang/rfcs/blob/master/text/1681-macros-1.1.md