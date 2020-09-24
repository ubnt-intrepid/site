---
title: "Rust のライフタイム周りのエラーメッセージを読み解く"
emoji: "🦀"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["rust"]
published: false
---

Zenn アカウントを作ったので GitHub リポジトリとの連携をテストしようと思ったのですが、特に差し迫ったネタが思いつかなかったので[先日 Teratail で行った回答](https://teratail.com/questions/293080?reply=true#reply-414922)の中で用いたサンプルを少し変更し、Rust コンパイラが出力するライフタイム周りのエラーを読み解く話をしたいと思います。

「良くわからないコンパイルエラーが出た」とパニックにならず、落ち着いてメッセージを読み解くことで修正の方針を見定めることが出来るようになりましょう。

# 問題設定

つぎのようなコードを考えます（[Playground](https://play.rust-lang.org/?version=stable&mode=debug&edition=2018&gist=ed2b4a9dc7e22afa2600056f39db0bb9)）。ここで、`A<'a>` は`x` とその参照を保持するための `x_ref` というメンバを持っており、`set()` メソッドを呼び出すことで `x_ref` に `x` への参照を設定することが出来ます。また、`A` は `Drop` を実装し、破棄するときに `x_ref` の中身を表示するようにしています。

```rust
struct A<'a> {
    x: i32,
    x_ref: Option<&'a i32>,
}

impl<'a> A<'a> {
    fn set<'b>(&'b mut self) {
        let x_ref = &self.x;
        self.x_ref = Some(x_ref);
    }
}

impl Drop for A<'_> {
    fn drop(&mut self) {
        println!("x_ref = {:?}", self.x_ref);
    }
}

fn main() {
    let mut a = A { x: 42, x_ref: None };

    let a_ref = &mut a;
    a_ref.set();
}
```

このコードをコンパイルしようとすると、次のようなエラーメッセージが出て失敗します。

```
error[E0495]: cannot infer an appropriate lifetime for borrow expression due to conflicting requirements
 --> src/lib.rs:8:21
  |
8 |         let x_ref = &self.x;
  |                     ^^^^^^^
  |
note: first, the lifetime cannot outlive the lifetime `'b` as defined on the method body at 7:12...
 --> src/lib.rs:7:12
  |
7 |     fn set<'b>(&'b mut self) {
  |            ^^
note: ...so that reference does not outlive borrowed content
 --> src/lib.rs:8:21
  |
8 |         let x_ref = &self.x;
  |                     ^^^^^^^
note: but, the lifetime must be valid for the lifetime `'a` as defined on the impl at 6:6...
 --> src/lib.rs:6:6
  |
6 | impl<'a> A<'a> {
  |      ^^
note: ...so that the expression is assignable
 --> src/lib.rs:9:22
  |
9 |         self.x_ref = Some(x_ref);
  |                      ^^^^^^^^^^^
  = note: expected `std::option::Option<&'a i32>`
             found `std::option::Option<&i32>`
````
