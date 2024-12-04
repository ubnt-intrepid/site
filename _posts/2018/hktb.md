---
title: 高階トレイト境界とうまく付き合う
date: "2018-10-07"
tags: [ "rust", "hktb", "tips", "qiita" ]
categories: [ "programming" ]
---

<!-- more -->

# 背景: HRTB

次のようなライフタイムパラメータをひとつ受け取るトレイトを考える。

```rust
trait Foo<'a> {
    type Out: 'a;

    fn call(&'a self) -> Self::Out;
}
```

このトレイトは関連型 `Out` を持ち、（トレイトのパラメータとして与えられた）`call()` のレシーバのライフタイム `'a` を制約として持っている。そのため、このトレイトの実装では `Out` として `Self` やフィールドへの参照を持つことが可能となる。

```rust
struct Value(String);

impl<'a> Foo<'a> for Value {
    type Out = &'a str;

    fn call(&'a self) -> Self::Out {
        self.0.as_str()
    }
}
```

上のトレイトを実装した型の値を受け取り何かしらの処理をする、ジェネリックな関数を実装することを考える。ここで、`Foo` に渡すライフタイムパラメータ `'a` を関数の定義でどう表すかという問題が生じる。

```rust
fn print_foo(x: impl Foo<'??>) {
    ...
}
```

`'a` は `foo.call()` を呼び出すときのレシーバの参照が持つライフタイムである。これは関数本体の内部で暗黙的に用いられるものであり、通常のトレイト境界を用いて `print_foo` の制約として表すことはできない。このような場合のために、Rust では次のようなトレイト境界の構文を用意している。

```rust
fn print_foo<T>(x: T)
where
    for<'a> T: Foo<'a>,
{
    ...
}

// universal impl Trait を用いると次のように簡略化出来る
fn print_foo(x: impl for<'a> Foo<'a>) {
    ...
}
```

ここで `for<'a> T: Foo<'a>` という見慣れない記法が `where` 句の中に登場している。これは **[高階トレイト境界 (Higher-Rank Trait Bounds)][HRTB]** と呼ばれるものであり、字面通り「任意のライフタイムパラメータ `'a` に対し `T` はトレイト `Foo<'a>` を実装する」という意味の制約となる。現在、`for` 内で受け取れるパラメータはライフタイムのみであり、任意の型パラメータに対し制約を課すことはできない。
実際に高階トレイト境界を記述するのは稀であるが、次のように（引数に参照を持つ）クロージャ内で暗黙的に使用されているので登場する機会は結構多かったりする（詳細は HRTB に関する nomicon の章などを参照してください）。

```rust
fn hoge(f: impl Fn(&i32)) { ... }

// 上の関数は次のように脱糖される
fn hoge<F>(f: F)
where
    for<'a> F: impl Fn<(&'a i32,)>,
{
    ...
}
```

[HRTB]: https://doc.rust-jp.rs/rust-nomicon-ja/hrtb.html

# 本題

`print_foo()` を実装するにあたり、関連型 `Out` に新たな制約を設定したい場合を考える。例えば上の例の場合、`x.call()` の結果を出力するためには `Out: Display` が満たされる必要がある。ここで `Foo<'a>` は他の場所でも使用されるため、できれば元の定義を弄ることなく制約を追加したい。

素朴に考えると、次のように記述することで所望の制約の追加が実現できると考えられる。

```rust
fn print_foo<T>(x: T)
where
    for<'a> T: Foo<'a>,
    for<'a> <T as Foo<'a>>::Out: Display,
{
    let out = x.call();
    println!("out = {}", out);
}
```

残念ながら、これは期待した動作にならずコンパイルエラーとなる ([playground](http://play.rust-lang.org/?gist=f6c4a87beb803950f3a4605b7cc2b53c&version=stable&mode=debug&edition=2015))。

```
   Compiling playground v0.0.1 (file:///playground)
error[E0277]: `<_ as Foo<'a>>::Out` doesn't implement `std::fmt::Display`
  --> src/main.rs:27:5
   |
27 |     print_foo(a);
   |     ^^^^^^^^^ `<_ as Foo<'a>>::Out` cannot be formatted with the default formatter
   |
   = help: the trait `for<'a> std::fmt::Display` is not implemented for `<_ as Foo<'a>>::Out`
   = note: in format strings you may be able to use `{:?}` (or {:#?} for pretty-print) instead
...
```

このような状況において、希望する制約の追加をどのように実現するのかというのが本記事の趣旨である。

# 解決策

不安定な機能を用いないで採用することができる解決策として、所望する制約を設定したダミーのトレイトを用意するというものが挙げられる。
まず、次のような（`Foo<'a>` と似たシグネチャを持つ）トレイトを用意する。

```rust
trait DisplayableFoo<'a> {
    type Out: Display + 'a; // <- (1) Out に境界を追加

    // (2) `Foo::call` と同じシグネチャを持つメソッド
    fn call_displayable(&'a self) -> Self::Out;
}
```

このトレイトに対し、次のような branket impl を与える。これにより、`T` が所望する制約（今回の場合、`T: Foo<'a>` かつ `T::Out: Display`）を満たしている場合に `DisplayableFoo<'a>` の実装が自動的に導出される。

```rust
impl<'a, T> DisplayableFoo<'a> for T
where
    T: Foo<'a>,
    T::Out: Display,
{
    type Out = T::Out;

    fn call_displayable(&'a self) -> Self::Out {
        self.call()
    }
}
```

最後に、定義した `DisplayableFoo<'a>` を用いて `print_foo()` のトレイト境界を記述する。上記の branket impl により `Foo<'a>` かつ `Out: Display` であれば `DisplayableFoo` の実装が自動で行われるため、この関数は期待通りに動作する。

```rust
fn print_foo(x: impl for<'a> DisplayableFoo<'a>) {
    let out = x.call_displayable();
    println!("out = {}", out);
}
```

# Appendix.A

もう一つの回避策として、`print_foo` に渡す引数の型を参照に限定してしまい、ライフタイムパラメータを強制的に関数のシグネチャに明示するという方法が考えられる。上記のように余計なトレイトを用意する必要がないという利点がある。

```rust
fn print_foo<'a, F>(foo: &'a F)
where
    F: Foo<'a>,
    F::Out: Display,
{
    ...
}
```

注意点として、上のトレイト境界はあくまで引数として渡した `'a` においてのみ課せられるものであるという点がある。

# Appendix.B

[RFC 1598] では **Generic Associated Types (GAT)** という機能が提案されている。これは、関連型がパラメータを受け取れるようにする拡張であり、これを用いることで `'a` がパラメータに現れない形で `Foo` を定義することができるようになる。

```rust
trait Foo {
    type Out<'a>: 'a;

    fn call<'a>(&'a self) -> Self::Out<'a>;
}
```

```rust
fn print_foo<T>(x: T)
where
    T: Foo,
    for<'a> <T as Foo>::Out<'a>: Display,
{
    ...
}
```

本記事の内容も RFC 内で[言及されている][push-hktb]が、基本的に現在のトレイトの仕様に基づくワークアラウンドであるため GAT が実装され次第置き換えるべきである。

[RFC 1598]: https://github.com/rust-lang/rfcs/blob/master/text/1598-generic_associated_types.md

[push-hktb]: https://github.com/rust-lang/rfcs/blob/master/text/1598-generic_associated_types.md#push-hrtbs-harder-without-associated-type-constructors

# Appendix.C

上記のテクニックを関数の出力側にも適用することを考える。いま、戻り値の型が隠蔽された次のような関数を考える。

```rust
fn make_foo() -> impl for<'a> DisplayableFoo<'a> {
    ...
}
```

残念ながら、`Foo<'a>` -> `DisplayableFoo<'a>` への実装は自動で行われるがその逆は行われない。そのため、`DisplayableFoo<'a>` を実装した値から `Foo<'a>` を実装した型へと手動で変換する必要が生じる。具体的には、次のようにラップ型を用意する。

```rust
struct Lift<T>(T);

impl<'a, T> Foo<'a> for Lift<T>
where
    T: DisplayableFoo<'a>,
{
    type Out = T::Out;

    fn call(&'a self) -> Self::Out {
        self.0.call_displayable()
    }
}

// DisplableFoo の拡張メソッドとして変換器を持たせておくと便利
trait DisplayableFooExt<'a>: DisplayableFoo<'a> + Sized {
    fn lift(self) -> Lift<Self> {
        Lift(self)
    }
}
impl<'a, T: DisplayableFoo<'a>> DisplayableFooExt<'a> for T {}
```

`make_foo()` の使用側では、次のように `lift()` を明示的に呼び出す必要がある。

```rust
// foo: impl for<'a> Foo<'a>
let foo = make_foo().lift();
```

将来的に [trait alias][rfc-1733] が実装されれば必要なくなるかもしれないが、現状ではこのような手段を行いトレイトの実装に関する問題を回避する必要がある。

----

**追記 (2018-09-21 00:47):** 次のように `make_foo()` の戻り値型を変更すれば、使用側で `.lift()` を明示的に呼び出す必要はない。

```rust
fn make_foo() -> Lift<impl for<'a> DisplayableFoo<'a>> {
    let ret = ....;
    Lift(ret)
}
```

**追記おわり**

---

**追記 (2018-10-07 06:18):** 素直に

```rust
fn make_foo()
  -> impl for<'a> Foo<'a, Out = impl Display> {
    ...
}
```

と書いても良い（というよりこれが正解でした…）

ただしこの記法は戻り値型の指定にのみ有効であり、次のように入力側で使うことは出来ない。

```rust
fn print_foo(x: impl for<'a> Foo<'a, Out = impl Dislay>) 
}
```

**追記おわり**

[rfc-1733]: https://github.com/rust-lang/rfcs/blob/master/text/1733-trait-alias.md

