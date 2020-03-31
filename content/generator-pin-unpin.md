+++
title = "ジェネレータと Pin/Unpin まとめ"
date = 2018-03-31

[taxonomies]
tags = [ "rust", "qiita" ]
categories = [ "programming" ]
+++

ジェネレータと自己参照周りの問題整理，および新しく提案された参照型 `Pin` と自動トレイト `Unpin` の概略。

あくまで自分の理解の範囲内でまとめたものなので正確性は保証しません。分からなくなったら `@withoutboats` 氏の解説を参照してください…

<!-- more -->

# 背景

## ジェネレータ・コルーチン (RFC 2033)

ジェネレータをサポートするための言語機能は [RFC 2033][rfc2033] で提案されている（この RFC は "Experimental RFC" という位置づけで採択されており，通常とは異なる開発体制をとっているらしい）。現在，`generators` と `generator_trait` という二つの feature gate が提供されており，それぞれ次の機能が解放される。

* `generators`
  - `yield` キーワードおよびジェネレータ定義用の構文を有効化する。
* `generator_trait`
  - ジェネレータの機能を実現するために定義されている標準ライブラリ内の型・トレイトを使用可能にする

ジェネレータ定義の構文はクロージャのものの拡張になっている。生成される匿名型は，ブロック内にキーワード `yield` が含まれている場合は `Generator` を，そうでなければ `Fn` / `FnMut` / `FnOnce` を実装する。

```rust
let mut gen = || {
    let mut count = 0;
    for i in 0..10 {
        // 処理の中断には yield 文を用いる
        yield process(&mut count);
    }

    if count == 0 {
        // 処理の完了には return 文を用いる
        return "Failed";
    }

    // クロージャと同じく，ブロックの末尾であれば単に式でも良い
    "Ok"
};
```

脱糖後のジェネレータの型が実装するトレイト [`Generator`][Generator] は `std::ops` (または `core::ops`) で定義されている。そのシグネチャは，現状の実装では次のようになっている。

```rust
/// `Generator::resume()` の戻り値を表す列挙型
pub enum GeneratorState<Y, R> {
    Yielded(Y),
    Complete(R),
}

pub trait Generator {
    // yield で返される値の型
    type Yield;

    // return で返される値の型（クロージャでいうところの Output）
    type Return;

    // unsafe になっているにはちゃんと理由がある
    unsafe fn resume(&mut self) -> GeneratorState<Self::Yield, Self::Return>;
}
```

この定義は `Iterator` や `Future` を一般化したものになっていることに注意されたい。例えば，次のようにして `Generator` を実装した型から `Iterator` や `Future` へのアダプタを作ることができる。

```rust
struct GenIterator<G>(G);

impl<G> Iterator for GenIterator<G>
where
    G: Generator<Return = ()>,
{
    type Item = G::Yield;

    fn next(&mut self) -> Option<Self::Item> {
        match unsafe { self.0.resume() } {
            Yielded(item) => Some(item),
            Complete(()) => None,
        }
    }
}
```

<!-- TODO: `futures-await` へのリンク -->

```rust
struct GenFuture<G>(G);

impl<G, T, E> Future for GenFuture<G>
where
    G: Generator<Yield = (), Return = Result<T, E>>,
{
    type Item = T;
    type Error = E;

    fn poll(&mut self) -> Result<Async<T>, E> {
        match unsafe { self.0.resume() } {
            Yielded(()) => Ok(Async::NotReady),
            Complete(Ok(ok)) => Ok(Async::Ready(ok)),
            Complete(Err(err)) => Err(err),
        }
    }
}
```

その他，詳細な仕様は [Unstable book][generators] を参照されたい。

## 自己参照構造体

ジェネレータ内で参照を扱う際に，自己参照 (self-referential) に関する問題を考える必要が出てくる。具体的な問題点は後述するとして，まずは自己参照について概略する。詳細は Rust フォーラム内のスレッドなどにある議論を参照されたい。

<!-- TODO: リンク -->

いま，次のように構造体内のあるフィールドへの参照を持つ仮想的な構造体を考えてみる。

```rust
struct Foo {
    x: u32,
    x_ref: &'?? u32,
}
```

ここで問題となるのが `x_ref` のライフタイムである。この参照により借用される `x` のライフタイムは，その参照を含んでいる構造体 `Foo` 自身の生存期間に対応する。このように，メンバ内にその構造体自身への参照を含んだ構造体は **self-referential struct** （直訳するなら「自己参照構造体」）と呼ばれている。現行バージョンのコンパイラではこのような構造体を定義する構文は提供されていないが，類似のデータ構造をコンパイラが生成することは十分考えられる。

ここで重要な点は，上のように自己参照をもつ構造体は**移動によって未定義動作を生む可能性をはらんでいる**ということである。Rust における変数の「移動」とは単にスタック上の値の `memcpy` であり，コピー先の変数の位置するアドレスとコピーした参照のアドレスがさす位置が異なるためこのままでは未定義動作になってしまう。
例えば下の例の場合，`y` へ移動する際に `x` の中身（すなわち `x` の値と `x.x` のアドレス）が `y` にコピーされるが，`y.ref_x` のアドレスはあくまで `x.x` のものであり `y.x` を指していない。そのため，`y` に所有権が移動した時点で `y.ref_x` はダングリングポインタになってしまう。

```rust
// このような構文はない
let x = Foo { x: 42, ref_x: &self.x };

let y = x; // ここで y.ref_x がダングリングポインタになる
```

このような未定義動作を防ぐためには，自己参照を持つ構造体の値を移動しないようにすることが重要である。この問題は，本来であれば型システム・借用チェッカーレベルで解決すべき問題だが，今のところ十分に合意のとれた解決策はないようである。そのため現状は `unsafe` を駆使しつつ，未定義動作を起こさないよう十分注意しながらコードを書くことが要求される（具体的な対処法は後述）。

<!-- TODO: `?Move` -->

## ジェネレータと自己参照

ジェネレータの場合，中断点（すなわち `yield` 文）をまたいだローカル変数の借用が現れると自己参照が現れる。例えば，次のようなジェネレータを考える [^1]。

[^1]: `static` キーワードの意味については https://github.com/rust-lang/rust/pull/45337 などを参照

```rust
static || {
                    // (0)
    let x = 1u64;
    let ref_x = &x;
    yield 0;        // (1)
    yield *ref_x;   // (2)
    return ();      // (3)
}
```

ここでコメントしている番号は `resume()` の呼び出しにより遷移するブロック上の停止点である。(2) の時点で `ref_x` の参照外しが行われており，それまで `ref_x` （およびその参照元である `x`）を保持する必要があることに注意されたい。

このジェネレータの状態は，大雑把に次のような列挙型で表すことができる（TODO: 検証）。点 (1) および (2) における状態を表す構造体 （`State1` と `State2`）が自己参照構造体になる [^2]。

[^2]: NLL が有効化されていれば `State2` が `ref_x` を持つ必要はなくなるが（点 (3) が評価されるまで `ref_x` を保持する必要がないことがわかるため），依然として `State1` は自己参照構造体となる。

```rust
enum MakeGenState {
    // (0) 初期状態
    State0,
    // (1) 実行直後
    State1(State1),
    // (2) 実行直後
    State2(State2),
    // (3) 実行直後（すなわち return 直後）
    State3,
}

struct State1 {
    x: u64,
    ref_x: &'?? u64,
}

struct State2 {
    x: u64,
    ref_x: &'?? u64,
}
```

ここで，上の状態が自己参照を持つ可能性があるのは `State1` 以降，すなわち最初に `resume()` を呼びだした「後」であることに注意されたい。これは，ジェネレータを起動するまではジェネレータの値を自由に移動しても良いことを意味している。したがって，`resume()` を呼び出した後に移動しないことに注意すれば，ジェネレータの値の移動による未定義動作を心配する必要は（基本的には）ないということがわかる。

ジェネレータの値が移動可能なタイミングを把握しておくことは重要である。例えば，`Future` や `Iterator` はコンビネータを用いて複数の操作を組み合わせるときに変数の移動を行う。また，Tokio runtime 内で使用されているスレッドプールは work stealing アルゴリズムを採用しているが，タスクを「盗む」ためには対象である `Future` が移動可能であることは必須条件である。より基本的な話だと，構築したイテレータや Future をトレイトオブジェクトに変換するためには対象をヒープに「移動」する必要がある。上述した点を踏まえると，これらの移動が伴う操作はジェネレータを起動する「前」であれば問題なく実行できるため，既存のエコシステムに与える影響は十分小さい。

# `Pin` / `Unpin`
上述の概要をまとめると，自己参照を含むジェネレータに対し未定義動作を起こさないように保証が必要なポイントは大まかに次の2つである。

* `resume()` 呼び出し後の移動がない
* `resume()` において，レシーバとして受け取った可変参照 (`&mut self`) を用いた移動操作（`mem::replace` や `mem::swap` など）がない

二点目は `resume()` の呼び出し元で保証する必要があり，これを要求するためには例えば `resume()` が `unsafe` にすることが考えられる。しかし，この方法だとメソッド内すべてが `unsafe` となってしまい，メソッド内で別の安全でない操作を `unsafe` ブロックを介することなく記述することが出来てしまう。これは，メソッド全体で未定義動作を起こさないことをプログラマ側が保証しなければならないことを意味する。これは自己参照を持たない（すなわち `&mut self` の使用による未定義動作の可能性がない）型の実装に対しても影響を与えてしまう。

今回考慮するべき問題は「自己参照を持つ型」が「可変参照を使用した何かしらの操作を行う」場合の安全性の保証である。自己参照を持たない型に与える影響を最小限にするためには，可変参照に対し次のような制約を付与した参照型を用意すれば良い。

* 自己参照を持たない場合は安全に `&mut T` を取得できる
* 自己参照を持つ場合は `unsafe` な方法で `&mut T` を取得する必要がある

そのような意図で導入されるのが，[RFC 2349][rfc2349] で提案された `Pin` である。これは `std::mem` または `core::mem` で提供され，次のように可変参照のラッパ型になる。

```rust
struct Pin<'a, T: ?Sized + 'a> {
    data: &'a mut T,
}
```

RFC 内では提供される API が詳細に説明されているが，ここでは省略する。重要なのは，借用ルールにより可変借用は一つしか存在できないため，`T` の値を変更するためには `Pin` の API を経由して `&mut T` を取得する必要があるという点である。

また，この構造体の挙動を制御するための自動トレイト `Unpin` が導入される。このトレイトは（少なくとも現状では）コンパイラ内で特別な意味[^3]を持たず，上述の `Pin` が提供する API の挙動を制御するために用いられる。

[^3]: 変数の移動を特別視するなど

```rust
unsafe auto trait Unpin {}
```

`Unpin` は自動トレイトであり，基本的にはすべての型に対し実装される。ジェネレータが移動できない場合（すなわち，`static` キーワード付きで定義された場合）に限り，`Unpin` の否定実装（`!Unpin`）が行われる。

このトレイトを用いて，例えば `Deref` / `DerefMut` の実装を次のように制御することができる。

```rust
impl<'a, T: ?Sized> Deref for Pin<'a, T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        self.0 // coercion
    }
}

// Unpin を実装していれば「安全に」変更できる
impl<'a, T: ?Sized + Unpin> DerefMut for Pin<'a, T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        unsafe { Pin::get_mut(self) }
    }
}
```

---

TODO: `PinBox`

# `Pin` とジェネレータ
`Pin` を用いると `Generator` の定義は次のように修正することができる（これには `arbitrary_self_types` フィーチャを有効化する必要がある）。

```rust
trait Generator {
    type Yield;
    type Return;

    fn resume(self: Pin<Self>) -> GeneratorState<Self::Yield, Self::Return>;
}
```

移動可能であれば，実装の変更は次のように最小限にすることができる。

```rust
struct SomeMovableType {
    count: u32,
}

impl Generator for SomeMovableType {
    type Yield = u32;
    type Return = ();

    fn resume(self: Pin<Self>) -> GeneratorState<Self::Yield, Self::Return> {
        self.count += 1;
        if self.count > 10 {
            GeneratorState::Complete(())
        } else {
            GeneratorState::Yielded(self.count)
        }
    }
}
```


# 現状

* フィーチャ `pin` がすでに実装されている。このフィーチャを有効化すると `Pin` と `Unpin` が使用可能になる。
* `futures` のリポジトリ内に `futures-stable` という名前のクレートが作成されている。このクレートでは `&mut self` の代わりに `Pin<Self>` を用いた `StableFuture` などを提供している。元の `Future` の定義を変えないのは，おそらく互換性のためだと思われる（0.3 で切り替わる？）

# 参考文献
* [RFC 2033][rfc2033]
* [RFC 2349][rfc2349]
* [`generators` および `generator_trait` のドキュメント][generators]
* `@withoutboats` 氏の一連の記事
  * https://boats.gitlab.io/blog/post/2018-01-25-async-i-self-referential-structs/
  * https://boats.gitlab.io/blog/post/2018-01-30-async-ii-narrowing-the-scope/
  * https://boats.gitlab.io/blog/post/2018-01-30-async-iii-moving-forward/
  * https://boats.gitlab.io/blog/post/2018-02-07-async-iv-an-even-better-proposal/
  * https://boats.gitlab.io/blog/post/2018-02-08-async-v-getting-back-to-the-futures/
  * https://boats.gitlab.io/blog/post/2018-03-20-async-vi/

[rfc2033]: http://rust-lang.github.io/rfcs/2033-experimental-coroutines.html
[rfc2094]: http://rust-lang.github.io/rfcs/2094-nll.html
[rfc2349]: https://rust-lang.github.io/rfcs/2349-pin.html

[generators]: https://doc.rust-lang.org/unstable-book/language-features/generators.html
[Generator]: https://doc.rust-lang.org/nightly/std/ops/trait.Generator.html

