---
title: Rust1.30で式形式の手続き的マクロを無理やり定義する
date: "2018-11-02"
tags: [ "rust", "proc-macro", "qiita" ]
categories: [ "programming" ]
---

<!-- more -->

Rust 1.30 から安定化して使えるようになった function-style の手続き的マクロだが、残念ながら次のように式 (expression) として展開される用途に用いることはできない（安定化されていないためコンパイルエラーとなる [^1]）。

```rust
let sql = sql!(SELECT * FROM posts WHERE id=1);
```

```
error[E0658]: procedural macros cannot be expanded to expressions (see issue #38356)
 --> src/main.rs:5:15
  |
5 |     let sql = sql!(SELECT * FROM posts WHERE id=1);
  |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

Rust 1.30 の時点で安定化された手続き的マクロは衛生的 (hygienic) ではなく、式として展開してしまうとスコープ内の識別子との整合性が取れなくなるので制限されている（と思われる）。実際、該当する feature gate に関連した議論は衛生性に関連したものとして展開されている[^2]。
とにかく、我々が望んでいる `format_args!()` のような procedural macro は現段階では（少なくとも安定版のコンパイラでは）使用することが出来ないことに注意が必要である。

[^1]: https://github.com/rust-lang/blog.rust-lang.org/issues/285
[^2]: https://github.com/rust-lang/rust/issues/54727

# `func!()` を無理やり定義する
というわけで意外と制約の多い手続き的マクロであるが、入力されるトークン列と出力される expression にいくつかの仮定を与えれば無理やり定義できなくもない。具体的には、次のような制限をマクロに課す。

* スコープ内の変数にアクセスしない
  - `sql!(SELECT * FROM USERS where id = i)` のように識別子を指定することは出来ない
* 出力される expression の正確な型（あるいは実装するトレイト）が既知であり、関数の戻り値型や定数の型として明示的に記述することが出来る

上記の制約を満たすとき、マクロの展開結果を例えば次のようにすることが出来る。まず、手続き的マクロを呼び出すためのダミーのユーザ定義型を用意する。手続き的マクロは expression, statement の位置で呼び出すことは出来ないが、impl 内であればスコープ内の識別子を用いることが出来ず衛生性に関する問題が生じないため呼び出すことが出来る。ここで `sql_impl!(..)` の生成する要素を impl の内部（例えば associated function の定義）として実装することで、手続き的マクロを statement 内で「呼び出す」ことが可能になる。最後に、生成した関数を呼び出すことで生成された式の値を呼び出し側に返す。

```rust
// このようなマクロの呼び出しが
let dsl = sql!(...);

// ...次のように展開されるようにする
let dsl = {
    // 展開結果を保持するためのダミー型
    enum Dummy {}
    impl Dummy {
        sql_impl!(...);
    }
    // 生成されたコードを値として返す
    Dummy::call()
}
```

---

上記の制約のもと、式として展開される手続き的マクロを実際に定義するための手順を具体的に説明する。まず、マクロの本体である手続き的マクロ側の実装は次のような見た目になる。

```rust proc-macro側
#[proc_macro]
pub fn sql_impl(input: TokenStream) -> TokenStream {
    // 生成されたトークン列
    let output = gen_output(input);

    quote::quote!(
        // 生成結果
        #[inline]
        fn output() -> impl sql_codegen::Sql {
            #output
        }
    ).into()
}
```

次に、ユーザに露出する公開用のマクロを次のように定義する。
ここで `local_inner_macros` という見慣れないものが `#[macro_export]` に付随しているが、これはマクロの内部で別のマクロを呼び出している場合に `use` 形式でのインポートを可能にするための仕組みである（説明は省略）。

```rust 公開側
// sql_codegen_impl で定義した手続き的マクロを
// クレートの「ルート」に再エクスポートする
extern crate codegen_impl;
#[doc(hidden)]
pub use sql_codegen_impl::*;

// 公開用のマクロ定義
#[macro_export(local_inner_macros)]
macro_rules! sql {
    ($($t:tt)*) => {{
        // sql_impl!() を呼び出すためのダミー型
        struct Dummy;
        impl Dummy {
            // このように呼び出すことで、展開結果を Dummy::output() という形で得ることが出来るようになる
            sql_impl!($($t)*);
        }

        Dummy::output()
    }}
}
```

なお、`edition = "2018"` が有効化されていれば次のようにクレート内の別マクロを `$crate` を用いて指定できるようになる。

```rust
#[doc(hidden)]
pub extern crate sql_codegen_impl as imp;

#[macro_export]
macro_rules! sql {
    ($($t:tt)*) => {{
        struct Dummy;
        impl Dummy {
            $crate::imp::sql_impl!($($t)*);
        }
        Dummy::output()
    }}
}
```

これで次のように式形式の（手続き的）マクロを提供することが出来る。

```rust usage
extern crate sql_codegen;

fn main() {
    let foo = sql_codegen::sql!(SELECT * FROM posts WHERE id=1);
}
```

# スコープ内の識別子にアクセスする

例として 次のようにパラメータを伴う SQL クエリ構築用のマクロを考える。このマクロは、次のようにスコープ内の変数にアクセスするようにしたい。

```rust
let id = get_user_id(request);
let s = sql!("SELECT * FROM users where id == {}", id);
```

前述したように手続き的マクロはスコープ内の識別子に直接アクセスすることは出来ないが、生成された関数の引数として間接的に用いることは可能である。そこで、次のようなコードに展開されるようなコードを実装する。

```rust
let s = {
    enum Dummy {}
    impl Dummy {
        fn call<T0>(id: T0) -> impl Sql
        where
            T0: IntoSqlArg,
        {
            ...
        }
    }
    Dummy::call(id)
};
```

ここで `id` の型は展開時には知ることが出来ない点に注意。したがって、引数は（展開結果のコードで要求されるトレイトを実装した）任意の型を取れるようにする必要がある。手続き的マクロ部分の実装を省略すると、最終的にマクロの実装は次のようになる。

```rust
#[macro_export(local_inner_macros)]
macro_rules! sql {
    ($s:expr, $($arg:expr),*) => {{
        enum Dummy {}
        impl Dummy {
            sql_impl!($s, $($arg),*);
        }
        Dummy::call($($arg),*)
    }};
}
```
