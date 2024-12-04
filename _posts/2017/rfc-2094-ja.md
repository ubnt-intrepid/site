+++
title = "RFC 2094 (non-lexical lifetime) の非公式訳"
date = "2017-12-01T00:00:00Z"
tags = [ "rust", "rfc", "nll" ]
categories = [ "programming" ]
+++

本記事は [Rust Internal Advent Calendar 2017][adc] 第1日目の記事です。

今年の 9/30 に採択された non-lexical lifetimes の RFC である [RFC 2094][rfc] の非公式訳です。

[adc]: https://qiita.com/advent-calendar/2017/rust-internal
[rfc]: https://github.com/rust-lang/rfcs/pull/2094

<!-- more -->

---

- Feature Name: (fill me in with a unique ident, my_awesome_feature)
- Start Date: 2017-08-02
- RFC PR: https://github.com/rust-lang/rfcs/pull/2094
- Rust Issue: https://github.com/rust-lang/rust/issues/44928

---

<!--
# Summary
-->
# 概要
[summary]: #summary

<!--
Extend Rust's borrow system to support **non-lexical lifetimes** -- these are lifetimes that are based on the control-flow graph, rather than lexical scopes.
The RFC describes in detail how to infer these new, more flexible regions, and also describes how to adjust our error messages.
The RFC also describes a few other extensions to the borrow checker, the total effect of which is to eliminate many common cases where small, function-local code modifications would be required to pass the borrow check.
(The appendix describes some of the remaining borrow-checker limitations that are not addressed by this RFC.)
-->
Rust の借用システムにおける、**ノンレキシカル・ライフタイム** （レキシカルスコープではなく制御フローグラフに基づくライフタイム）対応への拡張。本 RFC では、この新しくより柔軟なリージョンの推論方法を詳細に説明し、さらにエラーメッセージにそれを順応させる方法についても述べる。同時に本 RFC では、借用チェッカーのいくつかの拡張についても述べる。この拡張は、借用チェックを通すために関数ローカルレベルの小さな変更が必要となる、多くの一般的なケースを取り除く効果を持つ。（付録では、本 RFC で取り上げられていない残りの借用チェッカーの制約について説明している。）

<!--
# Motivation
-->
# 動機
[motivation]: #motivation

<!--
## What is a lifetime?
-->
## ライフタイムとはなにか？

<!--
The basic idea of the borrow checker is that values may not be mutated or moved while they are borrowed, but how do we know whether a value is borrowed?
The idea is quite simple: whenever you create a borrow, the compiler assigns the resulting reference a **lifetime**.
This lifetime corresponds to the span of the code where the reference may be used.
The compiler will infer this lifetime to be the smallest lifetime that it can have that still encompasses all the uses of the reference.
-->
借用チェッカの基本的なアイデアは、値が借用されている間は変更や移動が出来ないということである。では、値が借用されていることはどのようにして分かるのだろうか？考え方は非常に単純である: 借用されるたび、コンパイラはその結果得られる参照に **ライフタイム** を割り当てる。このライフタイムは、参照が使用される可能性のあるコードの期間に対応する。コンパイラはこのライフタイムを、参照が使用されるすべての箇所を取り囲む最小のものとなるよう推論する。

<!--
Note that Rust uses the term lifetime in a very particular way.
In everyday speech, the word lifetime can be used in two distinct -- but similar -- ways:
-->
Rust ではライフタイムという用語は非常に特別な用途で用いることに注意されたい。日常的な会話において、ライフタイムという単語は2つの異なる、しかし非常に似通った用途で用いられる。

<!--
1. The lifetime of a **reference**, corresponding to the span of time in which that reference is **used**.
2. The lifetime of a **value**, corresponding to the span of time before that value gets **freed** (or, put another way, before the destructor for the value runs).
-->
1. 参照が **使用される** 期間に対応する、 **参照** のライフタイム
2. 値が **解放** されるまで（言い換えると、値のデストラクタが呼ばれるまで）の期間に対応する、 **値** のライフタイム

<!--
This second span of time, which describes how long a value is valid, is very important.
To distinguish the two, we refer to that second span of time as the value's **scope**.
Naturally, lifetimes and scopes are linked to one another.
Specifically, if you make a reference to a value, the lifetime of that reference cannot outlive the scope of that value.
Otherwise, your reference would be pointing into freed memory.
-->
値の有効期間を表すこの2つめの期間は非常に重要である。これら2つを区別するため、我々は2つめの期間のことを値の **スコープ** と呼んでいる。当然ながら、ライフタイムとスコープは互いに関連している。具体的に言うと、値の参照が作成されるとき、その参照のライフタイムはそれの指す値のスコープより長くなることはない。そうでなければ、その参照は解放されたメモリを指すことになるためである。

<!--
To better see the distinction between lifetime and scope, let's consider a simple example.
In this example, the vector `data` is borrowed (mutably) and the resulting reference is passed to a function `capitalize`.
Since `capitalize` does not return the reference back, the *lifetime* of this borrow will be confined to just that call.
The *scope* of data, in contrast, is much larger, and corresponds to a suffix of the fn body, stretching from the `let` until the end of the enclosing scope.
-->
ライフタイムとスコープの違いをより良く理解するために、簡単な例を考えてみることにする。この例では、ベクトル `data` は（可変的に）借用され、得られる参照は関数 `capitalize` へと渡される。`capitalize` は参照を返さないため、この借用の*ライフタイム*は単にこの呼び出しに閉じ込められる。それに対し data の*スコープ*は（この参照）よりはるかに大きく、`let` から始まり取り囲んでいるスコープの終端まで伸びる fn 本体の接尾部に対応する。

```rust
fn foo() {
    let mut data = vec!['a', 'b', 'c']; // --+ 'scope
    capitalize(&mut data[..]);          //   |
//  ^~~~~~~~~~~~~~~~~~~~~~~~~ 'lifetime //   |
    data.push('d');                     //   |
    data.push('e');                     //   |
    data.push('f');                     //   |
} // <---------------------------------------+

fn capitalize(data: &mut [char]) {
    // do something
}
```

<!--
This example also demonstrates something else.
Lifetimes in Rust today are quite a bit more flexible than scopes (if not as flexible as we might like, hence this RFC):
-->
この例は同時に別の事実を示している。今日の Rust におけるライフタイムはスコープよりも遥かに柔軟であるということである（我々が好むほど柔軟でないとしてもである。故に本 RFC がある）：

<!--
- A scope generally corresponds to some block (or, more specifically, a *suffix* of a block that stretches from the `let` until the end of the enclosing block) \[[1](#temporaries)\].
- A lifetime, in contrast, can also span an individual expression, as this example demonstrates.
  The lifetime of the borrow in the example is confined to just the call to `capitalize`, and doesn't extend into the rest of the block.
  This is why the calls to `data.push` that come below are legal.
-->
- スコープは一般にあるブロック（あるいは、より具体的に述べれば `let` から始まりブロックの終端まで延びるブロックの *接尾部* ）に対応している \[[1](#temporaries)\]。
- 一方ライフタイムは、この例で示しているように個々の式 (expression) に及ぶことが出来る。この例における借用のライフタイムは `capitalize` の呼び出しに限定され、ブロックの残りの部分に及ぶことはない。これは、以後の `data.push` の呼び出しが正当な理由である。

<!--
So long as a reference is only used within one statement, today's lifetimes are typically adequate.
Problems arise however when you have a reference that spans multiple statements.
In that case, the compiler requires the lifetime to be the innermost expression (which is often a block) that encloses both statements, and that is typically much bigger than is really necessary or desired.
Let's look at some example problem cases.
Later on, we'll see how non-lexical lifetimes fix these cases.
-->
参照が単一の文 (statement) の中で使用される限り、通常の場合は今日のライフタイムは十分なものである。しかし、複数の文にまたがる参照があるときに問題が発生する。そのケースでは、コンパイラはライフタイムをそれら両方をすべて含む最も内側の式 (expression) となることを要求し（それはしばしばブロックとなる）、それは通常必要あるいは所望のものよりはるかに大きくなる。問題となる例をいくつか見てみることにする。その後、ノンレキシカル・ライフタイムがそれらの問題をどのように修正するのかを見ていく。

<!--
## Problem case #1: references assigned into a variable
-->
## 問題例 #1: 変数に代入された参照

<!--
One common problem case is when a reference is assigned into a variable.
Consider this trivial variation of the previous example, where the `&mut data[..]` slice is not passed directly to `capitalize`, but is instead stored into a local variable:
-->
基本的な問題のケースは、参照が変数に代入される場合である。スライス `&mut data[..]` を `capitalize` に直接渡すのではなく代わりにローカル変数に保存した、前の例の自明な変種を考える。

```rust
fn bar() {
    let mut data = vec!['a', 'b', 'c'];
    let slice = &mut data[..]; // <-+ 'lifetime
    capitalize(slice);         //   |
    data.push('d'); // ERROR!  //   |
    data.push('e'); // ERROR!  //   |
    data.push('f'); // ERROR!  //   |
} // <------------------------------+
```

<!--
The way that the compiler currently works, assigning a reference into a variable means that its lifetime must be as large as the entire scope of that variable.
In this case, that means the lifetime is now extended all the way until the end of the block.
This in turn means that the calls to `data.push` are now in error, because they occur during the lifetime of `slice`.
It's logical, but it's annoying.
-->
コンパイラが現在行っている方法では、このような参照の変数への代入はライフタイムがその変数のスコープ全体と同程度の大きさになる必要があることを意味する。この場合、ライフタイムがブロックの終端まで延長されることを意味する。これは、`data.push` の呼び出しが `slice` のライフタイムの間に発生するため現在はエラーとなることを意味する。これは論理的ではあるが、迷惑な挙動でもある。

<!--
In this particular case, you could resolve the problem by putting　`slice` into its own block:
-->
この特定の例では、`slice` をそれ自身のブロックに置くことでこの問題を解決することが出来る。

```rust
fn bar() {
    let mut data = vec!['a', 'b', 'c'];
    {
        let slice = &mut data[..]; // <-+ 'lifetime
        capitalize(slice);         //   |
    } // <------------------------------+
    data.push('d'); // OK
    data.push('e'); // OK
    data.push('f'); // OK
}
```

<!--
Since we introduced a new block, the scope of `slice` is now smaller, and hence the resulting lifetime is smaller.
Introducing a block like this is kind of artificial and also not an entirely obvious solution.
-->
新しいブロックを導入したことで、`slice` のスコープはより小さくなり、その結果得られるライフタイムが小さくなる。このようなブロックの導入は人工的であり、まったく明白な解決策でもない。

<!--
## Problem case #2: conditional control flow
-->
## 問題例 #2: 条件付きの制御フロー

<!--
Another common problem case is when references are used in only one given match arm (or, more generally, one control-flow path).
This most commonly arises around maps.
Consider this function, which, given some `key`, processes the value found in `map[key]` if it exists, or else inserts a default value:
-->
もう一つの主要な問題のケースは、参照がある match の腕（より一般的には、ある制御フローのパス）のみで用いられる場合である。これはマップ周りでよく現れる。次のような関数を考えてみる。ここでは `key` が与えられ、`map[key]` が存在すればその値を処理し、そうでなければデフォルト値を挿入する。

```rust
fn process_or_default() {
    let mut map = ...;
    let key = ...;
    match map.get_mut(&key) { // -------------+ 'lifetime
        Some(value) => process(value),     // |
        None => {                          // |
            map.insert(key, V::default()); // |
            //  ^~~~~~ ERROR.              // |
        }                                  // |
    } // <------------------------------------+
}
```

<!--
This code will not compile today.
The reason is that the `map` is borrowed as part of the call to `get_mut`, and that borrow must encompass not only the call to `get_mut`, but also the `Some` branch of the match.
The innermost expression that encloses both of these expressions is the match itself (as depicted above), and hence the borrow is considered to extend until the end of the match.
Unfortunately, the match encloses not only the `Some` branch, but also the `None` branch, and hence when we go to insert into the map in the `None` branch, we get an error that the `map` is still borrowed.
-->
このコードは現在コンパイルすることが出来ない。その理由は、`map` が `get_mut` の呼び出しの一部として借用され、その借用が `get_mut` の呼び出しだけでなく match 内の `Some` ブランチも取り囲む必要があるためである。これら2つの式を両方含む最小の式は（上記のように）match 自身であり、したがってこの借用は match 文の終端まで延長されているものとみなされる。残念ながら、match には `Some` ブランチのみでなく `None` ブランチも囲んでおり、`None` ブランチで map への挿入を行おうとしているため `map` がまだ借用中であるというエラーが出る。

<!--
This *particular* example is relatively easy to workaround.
In many cases, one can move the code for `None` out from the `match` like so:
-->
*特にこの* 例の場合では、比較的簡単にエラーを回避することが出来る。多くの場合、これは次のように `None` 内のコードを `match` の外部に移動することが出来る：

```rust
fn process_or_default1() {
    let mut map = ...;
    let key = ...;
    match map.get_mut(&key) { // -------------+ 'lifetime
        Some(value) => {                   // |
            process(value);                // |
            return;                        // |
        }                                  // |
        None => {                          // |
        }                                  // |
    } // <------------------------------------+
    map.insert(key, V::default());
}
```

<!--
When the code is adjusted this way, the call to `map.insert` is not part of the match, and hence it is not part of the borrow.
While this works, it is unfortunate to require these sorts of manipulations, just as it was when we introduced an artificial block in the previous example.
-->
このようにコードを調整すると、`map.insert` の呼び出しは match 文の一部ではなく、それ故に借用の一部でもなくなる。この例では上手くいくが、前の例で人工的にブロックを導入したのと同様、これらの操作が必要となることは残念である。

<!--
## Problem case #3: conditional control flow across functions
-->
## 問題例 #3: 関数をまたいだ条件付き制御フロー

<!--
While we were able to work around problem case #2 in a relatively simple, if irritating, fashion, there are other variations of conditional control flow that cannot be so easily resolved.
This is particularly true when you are returning a reference out of a function.
Consider the following function, which returns the value for a key if it exists, and inserts a new value otherwise (for the purposes of this section, assume that the `entry` API for maps does not exist):
-->
問題のケース #2 は腹立たしいが比較的簡単な方法で回避することが出来たが、一方でそのように簡単に解決することが出来ない条件付きの制御フローのバリエーションが他に存在する。これは特に、関数の外部へ参照を返す際に間違いなくそうなる。次の関数を考える。これは key の値が存在すればそれを返し、そうでなければ新しい値を挿入する（このセクションでは、マップに API `entry` が存在しないと仮定している）。

```rust
fn get_default<'r,K,V:Default>(map: &'r mut HashMap<K,V>,
                               key: K)
                               -> &'r mut V {
    match map.get_mut(&key) { // -------------+ 'r
        Some(value) => value,              // |
        None => {                          // |
            map.insert(key, V::default()); // |
            //  ^~~~~~ ERROR               // |
            map.get_mut(&key).unwrap()     // |
        }                                  // |
    }                                      // |
}                                          // v
```

<!--
At first glance, this code appears quite similar to the code we saw before, and indeed, just as before, it will not compile.
In fact, the lifetimes at play are quite different.
The reason is that, in the `Some` branch, the value is being **returned out** to the caller.
Since `value` is a reference into the map, this implies that the `map` will remain borrowed **until some point in the caller** (the point `'r`, to be exact).
To get a better intuition for what this lifetime parameter `'r` represents, consider some hypothetical caller of `get_default`: the lifetime `'r` then represents the span of code in which that caller will use the resulting reference:
-->
一見するとこのコードは前に見たものと非常によく似ているが、実際には同じようにコンパイルされない。実際のところ、動作中のライフタイムは全く異なっている。その理由は、 `Some` ブランチで値が呼び出し元に返されているためである。`value` は map の参照であるため、これは `map` が **呼び出し側のある点** （正確には `'r` の点）まで借用されたままになることを意味している。このライフタイム `'r` が表しているもののより良い直感を得るため、`get_default` の呼び出し側を仮に考えてみる：このときライフタイム `'r` は、呼び出し側が結果の参照を使用するコードの範囲を表している。

```rust
fn caller() {
    let mut map = HashMap::new();
    ...
    {
        let v = get_default(&mut map, key); // -+ 'r
          // +-- get_default() -----------+ //  |
          // | match map.get_mut(&key) {  | //  |
          // |   Some(value) => value,    | //  |
          // |   None => {                | //  |
          // |     ..                     | //  |
          // |   }                        | //  |
          // +----------------------------+ //  |
        process(v);                         //  |
    } // <--------------------------------------+
    ...
}
```

<!--
If we attempt the same workaround for this case that we tried in the previous example, we will find that it does not work:
-->
前の例で試したものと同じ回避策をこの問題で試みると、これは動作しないことに気づくだろう。

```rust
fn get_default1<'r,K,V:Default>(map: &'r mut HashMap<K,V>,
                                key: K)
                                -> &'r mut V {
    match map.get_mut(&key) { // -------------+ 'r
        Some(value) => return value,       // |
        None => { }                        // |
    }                                      // |
    map.insert(key, V::default());         // |
    //  ^~~~~~ ERROR (still)                  |
    map.get_mut(&key).unwrap()             // |
}                                          // v
```

<!--
Whereas before the lifetime of `value` was confined to the match, this new lifetime extends out into the caller, and therefore the borrow does not end just because we exited the match.
Hence it is still in scope when we attempt to call `insert` after the match.
-->
前の例では `value` のライフタイムは match 文に限定されていたのに対しこの新しいライフタイムは呼び出し元まで拡張しており、そのために match 文が終了した後も借用は終了しない。したがって、match 文の後に `insert` を呼び出すとそれは（参照の）スコープ内となる。

<!--
The workaround for this problem is a bit more involved.
It relies on the fact that the borrow checker uses the precise control-flow of the function to determine which borrows are in scope.
-->
この問題の回避策はもう少し複雑なものとなる。これは借用チェッカーが、どの借用がスコープ内にあるかどうかを判断するために関数の正確な制御フローを使用するという事実に依存する。


```rust
fn get_default2<'r,K,V:Default>(map: &'r mut HashMap<K,V>,
                                key: K)
                                -> &'r mut V {
    if map.contains(&key) {
    // ^~~~~~~~~~~~~~~~~~ 'n
        return match map.get_mut(&key) { // + 'r
            Some(value) => value,        // |
            None => unreachable!()       // |
        };                               // v
    }

    // At this point, `map.get_mut` was never
    // called! (As opposed to having been called,
    // but its result no longer being in use.)
    map.insert(key, V::default()); // OK now.
    map.get_mut(&key).unwrap()
}
```

<!--
What has changed here is that we moved the call to `map.get_mut` inside of an `if`, and we have set things up so that the if body unconditionally returns.
What this means is that a borrow begins at the point of `get_mut`, and that borrow lasts until the point `'r` in the caller, but the borrow checker can see that this borrow *will not have even started* outside of the `if`.
It does not consider the borrow in scope at the point where we call `map.insert`.
-->
ここでの変更点は、`map.get_mut` の呼び出しを `if` 内に移動し、if 本体で無条件にリターンするように設定したことである。これは、借用は `get_mut` を呼び出した点から始まり呼び出し側の点 `'r` まで続くが、同時にこの借用は `if` の外側では*まだ始まっていない*ということを借用チェッカが知ることが出来ることを意味する。`map.insert` を呼ぶ時点でのスコープにおける借用は考慮していない。

<!--
This workaround is more troublesome than the others, because the resulting code is actually less efficient at runtime, since it must do multiple lookups.
-->
結果として得られるコードは複数回の探索が必要であり実行時間において実際には効率的ではなくなるため、この回避策は他の例より厄介である。

<!--
It's worth noting that Rust's hashmaps include an `entry` API that one could use to implement this function today.
The resulting code is both nicer to read and more efficient even than the original version, since it avoids extra lookups on the "not present" path as well:
-->
現在 Rust のハッシュマップにはこの関数を実装するために使用できる `entry` という API が含まれており、注目に値する。生成されるコードは元のバージョンよりも読みやすく、同時に「存在しない」パス上での余計な探索を避けるためより効率的である。

```rust
fn get_default3<'r,K,V:Default>(map: &'r mut HashMap<K,V>,
                                key: K)
                                -> &'r mut V {
    map.entry(key)
       .or_insert_with(|| V::default())
}
```

<!--
Regardless, the problem exists for other data structures besides `HashMap`, so it would be nice if the original code passed the borrow checker, even if in practice using the `entry` API would be preferable.
(Interestingly, the limitation of the borrow checker here was one of the motivations for developing the `entry` API in the first place!)
-->
実用上は `entry` API を使用することが望ましいかもしれないが、それでも `HashMap` 以外の他のデータ構造にこの問題は存在するため、元のコードが借用チェッカーを通過することが出来れば嬉しいだろう。

<!--
## Problem case #4: mutating `&mut` references
-->
## 問題例 #4: `&mut` 参照の変更

<!--
The current borrow checker forbids reassigning an `&mut` variable `x` when the referent (`*x`) has been borrowed.
This most commonly arises when writing a loop that progressively "walks down" a data structure.
Consider this function, which converts a linked list `&mut List<T>` into a `Vec<&mut T>`:
-->
現在の借用チェッカーでは、参照の対象（`*x`）が借用されているときに `&mut` な変数 `x` に再代入することを禁止している。このような操作は、主にデータ構造を徐々に「歩いていく」ループを書くときに発生する。リンクリスト `&mut List<T>` を `Vec<&mut T>` へと変換する、次の例を考える。

```rust
struct List<T> {
    value: T,
    next: Option<Box<List<T>>>,
}

fn to_refs<T>(mut list: &mut List<T>) -> Vec<&mut T> {
    let mut result = vec![];
    loop {
        result.push(&mut list.value);
        if let Some(n) = list.next.as_mut() {
            list = &mut n;
        } else {
            return result;
        }
    }
}
```

<!--
If we attempt to compile this, we get an error (actually, we get multiple errors):
-->
これのコンパイルを試みると、エラーが発生する（実際には複数のエラーが発生する）。

```
error[E0506]: cannot assign to `list` because it is borrowed
  --> /Users/nmatsakis/tmp/x.rs:11:13
   |
9  |         result.push(&mut list.value);
   |                          ---------- borrow of `list` occurs here
10 |         if let Some(n) = list.next.as_mut() {
11 |             list = n;
   |             ^^^^^^^^ assignment to borrowed `list` occurs here
```

<!--
Specifically, what's gone wrong is that we borrowed `list.value` (or, more explicitly, `(*list).value`).
The current borrow checker enforces the rule that when you borrow a path, you cannot assign to that path or any prefix of that path.
In this case, that means you cannot assign to any of the following:
-->
具体的には、間違っているのは `list.value`（あるいは明示的に `(*list).value`）を借用していることである。現在の借用チェッカーでは、パスの借用が行われるとそのパスあるいはパスのプレフィックスへの代入が不可能であるというルールを施行する。このケースでは、次の例のいずれにおいても代入出来ないことを意味する:

- `(*list).value`
- `*list`
- `list`

<!--
As a result, the `list = n` assignment is forbidden.
These rules make sense in some cases (for example, if `list` were of type `List<T>`, and not `&mut List<T>`, then overwriting `list` would also overwrite `list.value`), but not in the case where we cross a mutable reference.
-->
結果として、`list = n` という代入は禁止となる。この規則はいくつかの場合で意味を成す（例えば `list` が `&mut List<T>` ではなく `List<T>` である場合、`list` の上書きは `list.value` の上書きを意味する）が、可変な参照が行き交う場合はそうではない。

<!--
As described in [Issue #10520][10520], there exist various workarounds for this problem.
One trick is to move the `&mut` reference into a temporary variable that you won't have to modify:
-->
[Issue #10520][10520] で言及されているように、この問題に対する様々な回避策が存在する。その一つは、`&mut` な参照を変更する必要のない一時変数に移動することである：

```rust
fn to_refs<T>(mut list: &mut List<T>) -> Vec<&mut T> {
    let mut result = vec![];
    loop {
        let list1 = list;
        result.push(&mut list1.value);
        if let Some(n) = list1.next.as_mut() {
            list = &mut n;
        } else {
            return result;
        }
    }
}
```

<!--
When you frame the program this way, the borrow checker sees that `(*list1).value` is borrowed (not `list`).
This does not prevent us from later assigning to `list`.
-->
このような方法でプログラムを枠組みすると、借用チェッカーは `(*list1).value` が借用されているとみなす（`list` ではなく）。これは、その後の `list` への代入を妨げるものではない。

<!--
Clearly this workaround is annoying.
The problem here, it turns out, is not specific to non-lexical lifetimes per se.
Rather, it is that the rules which the borrow checker enforces when a path is borrowed are too strict and do not account for the indirection inherent in a borrowed reference.
This RFC proposes a tweak to address that.
-->
明らかにこの回避策は苛立たしいものである。ここで明らかになった問題は「ノンレキシカル・ライフタイム」自体に固有の問題ではない。むしろ、パスが借用されたときに借用チェッカーが強制するルールが厳しすぎ、借用された参照における間接参照を考慮していないということである。本 RFC では、この問題に対処するための調整を提案する。

<!--
## The rough outline of our solution
-->
## 我々の解決策の概要

<!--
This RFC proposes a more flexible model for lifetimes.
Whereas previously lifetimes were based on the abstract syntax tree, we now propose lifetimes that are defined via the control-flow graph.
More specifically, lifetimes will be derived based on the [MIR][MIR-details] used internally in the compiler.
-->
本 RFC では、ライフタイムのより柔軟なモデルを提案する。以前のライフタイムが抽象構文木に基づいているのに対し、提案するライフタイムは制御フローグラフを介して定義される。より具体的に言うと、ライフタイムはコンパイラ内部で用いられている [MIR][MIR-details] に基づき導出される。

[MIR-details]: https://blog.rust-lang.org/2016/04/19/MIR.html

<!--
Intuitively, in the new proposal, the lifetime of a reference lasts only for those portions of the function in which the reference may later be used (where the reference is **live**, in compiler speak).
This can range from a few sequential statements (as in problem case #1) to something more complex, such as covering one arm in a match but not the others (problem case #2).
-->
直感的には、新しい提案では、参照のライフタイムはその参照が後に使用される可能性のある関数の一部分（コンパイラの記述における、参照が **生存** している部分）に対してのみ有効となる。これは、いくつかの連続したステートメント（問題 #1）から、match 内の一つの腕をカバーするがそれ以外はしない場合（問題 #2）のようなより複雑なものまで様々である。

<!--
However, in order to sucessfully type the full range of examples that we would like, we have to go a bit further than just changing lifetimes to a portion of the control-flow graph.
**We also have to take location into account when doing subtyping checks**.
This is in contrast to how the compiler works today, where subtyping relations
are "absolute".
That is, in the current compiler, the type `&'a ()` is a subtype of the type `&'b ()` whenever `'a` outlives `'b` (`'a: 'b`), which means that `'a` corresponds to a bigger portion of the function.
Under this proposal, subtyping can instead be established **at a particular point P**.
In that case, the lifetime `'a` must only outlive those portions of `'b` that are reachable from P.
-->
しかしながら、我々が所望するすべての例を正しく受容するためには、ライフタイムが制御フローグラフの一部分になるように変更するだけではなく、もう少し進める必要がある。それは、**部分型 (subtype) をチェックする際に位置情報を考慮する必要もある** ということである。これは、現在のコンパイラの動作とは対照的である。つまり、現在のコンパイラでは `'a` が `'b` よりライフタイムが長い場合（`'a: 'b`）`&'a ()` は常に `&'b ()` の派生型となる。これはすなわち、 `'a` は関数のより大きな一部分に対応することを意味する。本提案の下では、部分型付けは **特定の点** **P** **に対し** 設定される。このような場合、ライフタイム `'a` は点 P から到達可能な `'b` 内のある部分に対してのみ長く生存 (outlive) すれば良い。

<!--
The ideas in this RFC have been implemented in [prototype form][proto].
This prototype includes a simplified control-flow graph that allows one to create the various kinds of region constraints that can arise and implements the region inference algorithm which then solves those constraints.
-->
本 RFC のアイデアは[プロトタイプ形式][proto]で実装されている。このプロトタイプには発生する可能性のある様々な種類のリージョン制約を作るための簡略化された制御フローグラフが含まれており、さらにそれらの制約を解消するリージョン推論アルゴリズムが実装されている。

[proto]: https://github.com/nikomatsakis/nll

<!--
# Detailed design
-->
# 詳細設計
[design]: #detailed-design

<!--
## Layering the design
-->
## 設計の階層

<!--
We describe the design in "layers":
-->
我々は設計を次のような「階層」で表す：

<!--
1. Initially, we will describe a basic design focused on control-flow within one function.
2. Next, we extend the control-flow graph to better handle infinite loops.
3. Next, we extend the design to handle dropck, and specifically the `#[may_dangle]` attribute introduced by RFC 1327.
4. Next, we will extend the design to consider named lifetime parameters, like those in problem case 3.
5. Finally, we give a brief description of the borrow checker.
-->
1. まず始めに、一つの関数内における制御フローに着目した基本的な設計を示す。
2. 次に、無限ループをより適切に扱えるように制御フローグラフを拡張する。
3. 次に、dropck、具体的には RFC 1327 で導入された `#[may_dangle]` 属性を扱うために設計を拡張する。
4. 次に、問題のケース 3 のような命名されたライフタイム・パラメータを扱うために設計を拡張する。
5. 最後に、借用チェッカーの簡単な説明を行う。

<!--
## Layer 0: Definitions
-->
## 階層0: 定義

<!--
Before we can describe the design, we have to define the terms that we will be using.
The RFC is defined in terms of a simplified version of MIR, eliding various details that don't introduce fundamental complexity.
-->
設計を説明する前に、我々の使用する用語を定義する必要がある。本 RFC は、本質的な複雑さをもたらさない様々な詳細を省略した、MIR の簡略化したバージョンにおいて定義される。

<!--
**Lvalues**.
A MIR "lvalue" is a path that leads to a memory location.
The full MIR Lvalues are defined [via a Rust enum][lvaluecode] and contain a number of knobs, most of which are not relevant for this RFC.
We will present a simplified form of lvalues for now:
-->
**lvalue**。
MIR の "lvalue" は、メモリの場所を導くパスである。MIR Lvalues の全体は [Rust の列挙型として][lvaluecode]定義されており、いくつかの取手（訳注: ヴァリアント）を含んでいるが、そのほとんどは本 RFC とは関係ない。我々は lvalue の簡略形を、次のように与える。

<!--
```
LV = x       // local variable
   | LV.f    // field access
   | *LV     // deref
```
-->
```
LV = x       // ローカル変数
   | LV.f    // フィールドアクセス
   | *LV     // 参照外し
```

<!--
The precedence of `*` is low, so `*a.b.c` will deref `a.b.c`; to deref
just `a`, one would write `(*a).b.c`.
-->
`*` の優先順位は低く、`*a.b.c` は `a.b.c` の参照を外す。単に `a` の参照を外したい場合は `(*a).b.c` のように書く。

<!--
**Prefixes.**
We say that the prefixes of an lvalue are all the lvalues you get by stripping away fields and derefs.
The prefixes of `*a.b` would be `*a.b`, `a.b`, and `a`.
-->
**プレフィックス**。
フィールドと参照外しを取り除くことにより得られるすべての lvalue を、lvalue のプレフィックスと呼ぶ。`*a.b` のプレフィックスは `*a.b`、`a.b` および `a` となる。

[lvaluecode]: https://github.com/rust-lang/rust/blob/bf0a9e0b4d3a4dd09717960840798e2933ec7568/src/librustc/mir/mod.rs#L839-L851

<!--
**Control-flow graph.**
MIR is organized into a [control-flow graph][cfg] rather than an abstract syntax tree.
It is created in the compiler by transforming the "HIR" (high-level IR).
The MIR CFG consists of a set of [basic blocks][bbdata].
Each basic block has a series of [statements][stmt] and a [terminator][term].
Statements that concern us in this RFC fall into three categories:
-->
**制御フローグラフ (control-flow graph)**。
MIR は抽象構文木ではなく、[制御フローグラフ][cfg]により構成される。これはコンパイラにより、"HIR" (high-level IR) を変換することで作成される。MIR CFG は[基本ブロック (basic block)][bbdata] の集合で構成される。各基本ブロックは[文][stmt]の系列と[終端子][term]を持つ。本 RFC に関わる文は、次の3つのカテゴリに分類される:

<!--
- assignments like `x = y`; the RHS of such an assignment is called an [rvalue][].
  There are no compound rvalues, and hence each statement is a discrete action that executes instantaneously.
  For example, the Rust expression `a = b + c + d` would be compiled into two MIR instructions, like `tmp0 = b + c; a = tmp0 + d;`.
- `drop(lvalue)` deallocates an lvalue, if there is a value in it; in the limit, this requires runtime checks (a pass in mir, called elaborate drops, performs this transformation).
- `StorageDead(x)` deallocates the stack storage for `x`.
  These are used by LLVM to allow stack-allocated values to use the same stack slot (if their live storage ranges are disjoint).
  [Ralf Jung's recent blog post has more details.][rjung-sd]
-->
- `x = y` のような代入; このような代入における右辺は [rvalue] と呼ばれる。複合した rvalue は存在せず、そのため各文は即座に実行される分離した動作である。例えば、Rust の式 `a = b + c + d` は `tmp = b + c; a = tmp0 + d` のような 2 つの MIR の命令へとコンパイルされる。
- `drop(lvalue)` は 値がある場合に lvalue の割当てを解除する; ある制限内において、これは実行時チェックが必要となる（精巧なドロップ (elaborate drop) と呼ばれる MIR のパスでこの変換を実行する）。
- `StorageDead(x)` は `x` のスタック領域の割当を開放する。これらは、スタックに割り当てた値が（これらの生存した領域の範囲が分離しているとき）同じスタックの場所を使用できるようにするために、LLVM によって使用される。[Ralf Jung の最近の投稿により詳細な説明がある][rjung-sd]。

[rjung-sd]: https://www.ralfj.de/blog/2017/06/06/MIR-semantics.html
[rvalue]: https://github.com/rust-lang/rust/blob/bf0a9e0b4d3a4dd09717960840798e2933ec7568/src/librustc/mir/mod.rs#L1037-L1071
[bbdata]: https://github.com/rust-lang/rust/blob/bf0a9e0b4d3a4dd09717960840798e2933ec7568/src/librustc/mir/mod.rs#L443-L463
[stmt]: https://github.com/rust-lang/rust/blob/bf0a9e0b4d3a4dd09717960840798e2933ec7568/src/librustc/mir/mod.rs#L774-L814
[term]: https://github.com/rust-lang/rust/blob/bf0a9e0b4d3a4dd09717960840798e2933ec7568/src/librustc/mir/mod.rs#L465-L552
[cfg]: https://en.wikipedia.org/wiki/Control_flow_graph

<!--
## Layer 1: Control-flow within a function
-->
## 階層1: 関数内の制御フロー

<!--
### Running Example
-->
### 運用する例

<!--
We will explain the design with reference to a running example, called **Example 4**.
After presenting the design, we will apply it to the three problem cases, as well as a number of other interesting examples.
-->
**例 4**と称する運用例を参照しつつ、設計を説明していく。設計を提示した後、他の数多くの興味深い例とともに、それを 3 つの問題ケースに適用する。

```rust
let mut foo: T = ...;
let mut bar: T = ...;
let p: &T;

p = &foo;
// (0)
if condition {
    print(*p);
    // (1)
    p = &bar;
    // (2)
}
// (3)
print(*p);
// (4)
```

<!--
The key point of this example is that the variable `foo` should only be considered borrowed at points 0 and 3, but not point 1.
`bar`, in contrast, should be considered borrowed at points 2 and 3.
Neither of them need to be considered borrowed at point 4, as the reference `p` is not used there.
-->
この例におけるキーポイントは、変数 `foo` は点 0 と 3 でのみ借用されていると考えれば良く、点 1 においてはその必要がないということである。それに対し、`bar` は点 2 と 3 において借用されていると考える必要がある。参照 `p` が使用されないため、これらはいずれも点 4 では借用されていると考える必要はない。

<!--
We can convert this example into the control-flow graph that follows.
Recall that a control-flow graph in MIR consists of basic blocks containing a list of discrete statements and a trailing terminator:
-->
この例は次に示す制御フローグラフへと変換することが出来る。MIR における制御フローグラフは、分離した文のリストと末尾の終端子をを含む基本ブロックで構成されることを思い出してほしい。

```
// let mut foo: i32;
// let mut bar: i32;
// let p: &i32;

A
[ p = &foo     ]
[ if condition ] ----\ (true)
       |             |
       |     B       v
       |     [ print(*p)     ]
       |     [ ...           ]
       |     [ p = &bar      ]
       |     [ ...           ]
       |     [ goto C        ]
       |             |
       +-------------/
       |
C      v
[ print(*p)    ]
[ return       ]
```

<!--
We will use a notation like `Block/Index` to refer to a specific statement or terminate in the control-flow graph.
`A/0` and `B/4` refer to `p = &foo` and `goto C`, respectively.
-->
制御フローグラフ内の特定の文または終端を指し示すために `Block/Index` という記法を用いる。`A/0` と `B/4` はそれぞれ、`p = &foo` と `goto C` を指す。

<!--
### What is a lifetime and how does it interact with the borrow checker
-->
### ライフタイムとは何か、それは借用チェッカーとどう相互作用するのか

<!--
To start with, we will consider lifetimes as a **set of points in the control-flow graph**;
later in the RFC we will extend the domain of these sets to include "skolemized" lifetimes, which correspond to named lifetime parameters declared on a function.
If a lifetime contains the point P, that implies that references with that lifetime are valid on entry to P.
Lifetimes appear in various places in the MIR representation:
-->
まず、我々はライフタイムを **制御フローグラフ内の点集合** であると考える: RFC の後半ではこれらの集合の定義域を、関数上で宣言された名前付きのライフタイムパラメータに対応する「スコーレム化された」ライフタイムを含むように拡張する。ライフタイムが点 P を含む場合、そのライフタイムにおける参照が点 P に入るときに有効であることを意味する。ライフタイムは、MIR の表現内において様々な場所に現れる:

<!--
- The types of variables (and temporaries, etc) may contain lifetimes.
- Every borrow expression has a designated lifetime.
-->
- 変数（および一時変数など）の型にライフタイムを含めることが出来る。
- 任意の借用式 (borrow expression) には指定されたライフタイムが存在する。

<!--
We can extend our example 4 to include explicit lifetime names.
There are three lifetimes that result.
We will call them `'p`, `'foo`, and `'bar`:
-->
例 4 は、明示的なライフタイムの名前を含むように拡張することが出来る。その結果、3 つのライフタイムが現れる。これを `'p`、`'foo` そして `'bar` と呼ぶことにする:

```rust
let mut foo: T = ...;
let mut bar: T = ...;
let p: &'p T;
//      --
p = &'foo foo;
//   ----
if condition {
    print(*p);
    p = &'bar bar;
    //   ----
}
print(*p);
```

<!--
As you can see, the lifetime `'p` is part of the type of the variable `p`.
It indicates the portions of the control-flow graph where `p` can safely be dereferenced.
The lifetimes `'foo` and `'bar` are different: they refer to the lifetimes for which `foo` and `bar` are borrowed, respectively.
-->
ご覧のように、ライフタイム `'p` は変数 `p` の型の一部である。このライフタイムは、`p` を安全に参照外しすることが出来る制御フローグラフの一部分を指している。ライフタイム `'foo` と `'bar` はそれとは異なっており、それぞれ `foo` と `bar` が借用されたライフタイムを指す。

<!--
Lifetimes attached to a borrow expression, like `'foo` and `'bar`, are important to the borrow checker.
Those correspond to the portions of the control-flow graph in which the borrow checker will enforce its restrictions.
In this case, since both borrows are shared borrows (`&`), the borrow checker will prevent `foo` from being modified during `'foo` and it will prevent `bar` from being modified during `'bar`.
If these had been mutable borrows (`&mut`), the borrow checker would have prevented **all** access to `foo` and `bar` during those lifetimes.
-->
`'foo` や `'bar` のように、借用式に割り当てられたライフタイムは借用チェッカーにとって重要である。これらは、借用チェッカーによりその制限が強調される制御フローグラフの一部分に対応する。今回の場合、借用が両方とも共有借用 (shared borrow) (`&`) であるため、借用チェッカーは `'foo` の間 `'foo` が変更されることを防ぎ、同様に `'bar` 中に `bar` が変更することを防ぐ。これらが可変借用 (mutable borrow) (`&mut`) の場合、借用チェッカーはこれらのライフタイムの間 `foo` と `bar` への **すべての** 操作を防ぐ。

<!--
There are many valid choices one could make for `'foo` and `'bar`.
This RFC however describes an inference algorithm that aims to pick the **minimal** lifetimes for each borrow which could possibly work.
This corresponds to imposing the fewest restrictions we can.
-->
`'foo` と `'bar` には、多くの有効な選択肢が存在する。しかし本 RFC では、各借用に対し有効な **最小の** ライフタイムを選ぶことを目指した推論アルゴリズムを説明する。これは、設定が可能な最小限の制約を課すことに対応する。

<!--
In the case of example 4, therefore, we wish our algorithm to compute that `'foo` is `{A/1, B/0, C/0}`, which notably excludes the points B/1 through B/4.
`'bar` should be inferred to the set `{B/3, B/4, C/0}`.
The lifetime `'p` will be the union of `'foo` and `'bar`, since it contains all the points where the variable `p` is valid.
-->
したがって例 4 の場合、アルゴリズムは `'foo` を、特に B/1 から B/4 までを除外した `{A/1, B/0, C/0}` と計算することを要求する。`'bar` は集合 `{B/3, B/4, C/0}` として推論されるべきである。変数 `p` が有効なすべての点を含めるため、`'p` は `'foo` と `'bar` の和集合となる。

<!--
### Lifetime inference constraints
-->
### ライフタイム推論の制約

<!--
The inference algorithm works by analyzing the MIR and creating a series of **constraints**.
These constraints obey the following　grammar:
-->
推論アルゴリズムは、MIR を分析し **制約** の列を作成することで動作する。これらの制約は次の文法に従う:

<!--
```
// A constraint set C:
C = true
  | C, (L1: L2) @ P    // Lifetime L1 outlives Lifetime L2 at point P

// A lifetime L:
L = 'a
  | {P}
```
-->
```
// 制約集合 C:
C = true
  | C, (L1: L2) @ P    // 点 P においてライフタイム L1 は ライフタイム L2 よりも長い

// ライフタイム L:
L = 'a
  | {P}
```

<!--
Here the terminal `P` represents a point in the control-flow graph, and the notation `'a` refers to some named lifetime inference variable (e.g., `'p`, `'foo` or `'bar`).
-->
ここで端点 `P` は制御フローグラフ内の点を表し、記法 `'a` はある名前付きのライフライム推論変数 (lifetime inference variable) （すなわち、`'p` や `'foo` および `'bar` のこと）を指す。

<!--
Once the constraints are created, the **inference algorithm** solves the constraints.
This is done via fixed-point iteration:
each lifetime variable begins as an empty set and we iterate over the constaints, repeatedly growing the lifetimes until they are big enough to satisfy all constraints.
-->
制約が作られると、**推論アルゴリズム** によりこの制約が解かれる。これは不動点反復により行われる:各ライフタイム変数は空集合から始まり、すべての制約を満たすのに十分な大きさになるまでライフタイムを成長させていく。

<!--
(If you'd like to compare this to the prototype code, the file [`regionck.rs`] is responsible for creating the constraints, and [`infer.rs`] is responsible for solving them.)
-->
（これをプロトタイプコードと比較したいのであれば、ファイル [`regionck.rs`] が制約の作成を、[`infer.rs`] がその解決をそれぞれ担当している。）

[`regionck.rs`]: https://github.com/nikomatsakis/nll/blob/master/nll/src/regionck.rs
[`infer.rs`]: https://github.com/nikomatsakis/nll/blob/master/nll/src/infer.rs

<!--
### Liveness
-->
### 生存性

<!--
One key ingredient to understanding how NLL should work is understanding **liveness**.
The term "liveness" derives from compiler analysis, but it's fairly intuitive.
We say that **a variable is live if the current value that it holds may be used later**.
This is very important to Example 4:
-->
NLL がどう動作すべきなのかを理解するための主要な要素は、**生存性 (liveness)** を理解することである。「生存性」という用語はコンパイラの分析により導かれるが、これはとても直感的なものである。 **現在保持している値が後ほど使用される可能性のある場合、その変数は生存している** と呼ぶことにする。これは例 4 においてとても重要である:

```rust
let mut foo: T = ...;
let mut bar: T = ...;
let p: &'p T = &foo;
// `p` is live here: its value may be used on the next line.
if condition {
    // `p` is live here: its value will be used on the next line.
    print(*p);
    // `p` is DEAD here: its value will not be used.
    p = &bar;
    // `p` is live here: its value will be used later.
}
// `p` is live here: its value may be used on the next line.
print(*p);
// `p` is DEAD here: its value will not be used.
```

<!--
Here you see a variable `p` that is assigned in the beginning of the program, and then maybe re-assigned during the `if`.
The key point is that `p` becomes **dead** (not live) in the span before it is reassigned.
This is true even though the variable `p` will be used again, because the **value** that is in `p` will not be used.
-->
ここでは、変数 `p` がプログラムの最初に代入され、その後 `if` 内で再代入される可能性があることが確認できる。重要な点は、再代入される前の範囲で `p` が **死んでいる（生存していない）** ということである。これは変数 `p` が再び使用される場合さえでも同様であり、なぜなら `p` 内の **値** は使用されることがないためである。

<!--
Traditional compiler compute liveness based on variables, but we wish to compute liveness for **lifetimes**.
We can extend a variable-based analysis to lifetimes by saying that a lifetime L is live at a point P if there is some variable `p` which is live at P, and L appears in the type of `p`.
(Later on, when we cover the dropck, we will use a more selective notion of liveness for lifetimes 
in which *some* of the lifetimes in a variable's type may be live while others are not.)
So, in our running example, the lifetime `'p` would be live at precisely the same points that `p` is live.
The lifetimes `'foo` and `'bar` have no points where they are (directly) live, since they do not appear in the types of any variables.
-->
従来のコンパイラは変数に基づいて生存性を求めていたが、我々はこれを **ライフタイム** に基づき計算したい。次のようにすることで変数に基づく分析をライフタイムへと拡張することが出来る: 点 P において生存している変数 `p` が存在し、かつ L が `p` の型として現れるとき、ライフタイム L は点 P において生存していると言う。（後ほど dropck をカバーする際に、我々はライフタイムに対する生存性のより精選された考え方を用いる。そこでは、変数の型における*いくつかの*ライフタイムが他がそうでない場合でも生存している可能性がある。）したがって我々の動作例では、ライフタイム `'p` は `p` が生存している点とまさしく同じ点において生存している。ライフタイム `'foo` と `'bar` は、どの変数の型にも現れないため（直接的には）生存している点が存在しない。

<!--
 * However, this does not mean these lifetimes are irrelevant; as shown below, subtyping constraints introduced by subsequent analyses will eventually require `'foo` and `'bar` to *outlive* `'p`.
-->
* しかしこれは、これらのライフタイムが無関係であることを意味しない; 後ほど示すように、その次の分析により導出される部分型付け制約により `'foo` と `'bar` が `'p` よりも*長く生存する* ことが結果的に要求される。

<!--
#### Liveness-based constraints for lifetimes
-->
#### ライフタイムの生存性に基づく制約

<!--
The first set of constraints that we generate are derived from liveness.
Specifically, if a lifetime L is live at the point P, then we will introduce a constraint like:
(As we'll see later when we cover solving constraints, this constraint effectively just inserts `P` into the set for `L`.
In fact, the prototype doesn't bother to materialize such constraints, instead just immediately inserting `P` into `L`.)
-->
最初に我々が生成する制約の集合は生存性から導かれる。具体的には、ライフタイム L が点 P において生存しているとき次のような制約が導入される:

    (L: {P}) @ P

（後ほど制約の解法をカバーするときに見るように、この制約は単に `P` を `L` の集合に挿入することで効率化出来る。実際、プロトタイプではこのような制約の実現に悩まされておらず、その代わり `L` へ `P` を直ちに挿入するだけになっている。）

<!--
For our running example, this means that we would introduce the following liveness constraints:
-->
我々の動作例において、これは次に示す生存性制約 (liveness constraint) が導入されることを意味する:

    ('p: {A/1}) @ A/1
    ('p: {B/0}) @ B/0
    ('p: {B/3}) @ B/3
    ('p: {B/4}) @ B/4
    ('p: {C/0}) @ C/0

<!--
### Subtyping
-->
### 部分型付け

<!--
Whenever references are copied from one location to another, the Rust subtyping rules require that the lifetime of the source reference **outlives** the lifetime of the target location.
As discussed earlier, in this RFC, we extend the notion of subtyping to be **location-aware**, meaning that we take into account the point where the value is being copied.
-->
参照がある場所から他の場所へとコピーされるときは常に、Rust の部分型付けルールでは元の参照は対象である場所のライフタイムよりも **長く生存する (outlive)** ことが要求される。本 RFC の前半で議論したように、我々は部分型付けの考え方を **位置を認識する** ように拡張する。これは変数がコピーされる点を考慮することを意味している。

<!--
For example, at the point A/0, our running example contains a borrow expression `p = &'foo foo`.
In this case, the borrow expression will produce a reference of type `&'foo T`, where `T` is the type of `foo`.
This value is then assigned to `p`, which has the type `&'p T`.
Therefore, we wish to require that `&'foo T` be a subtype of `&'p T`.
Moreover, this relation needs to hold at the point A/1 -- the **successor** of the point A/0 where the assignment occurs (this is because the new value of `p` is first visible in A/1).
We write that subtyping constraint as follows:
-->
例えば点 A/0 において、我々の例は借用式 `p = &'foo foo` を含んでいる。この場合、この借用式は型 `&'foo T` の参照を生成する（ここで `T` は `foo` の型である）。その後、この値は `p` へと代入される（これは型 `&'p T` を持つ）。したがって、`&'foo T` は `&'p T` の部分型であることを要求したい。さらに、この関係は点 A/1 （すなわち、代入が生じた点 A/0 の **後続点**）で保持されることが必要である（これは、`p` の新しい値は A/1 で最初に露わになるためである）。この部分型付け制約を次のように書く:

    (&'foo T <: &'p T) @ A/1

<!--
The standard Rust subtyping rules (two examples of which are given below) can then "break down" this subtyping rule into the lifetime constraints we need for inference:
-->
標準的な Rust の部分型付けの規則により、推論のために要求されるライフタイム制約に含まれるこの部分型付けルールは次のように「分解」することが出来る:

<!--
    (T_a <: T_b) @ P
    ('a: 'b) @ P      // <-- a constraint for our inference algorithm
    ------------------------
    (&'a T_a <: &'b T_b) @ P

    (T_a <: T_b) @ P
    (T_b <: T_a) @ P  // (&mut T is invariant)
    ('a: 'b) @ P      // <-- another constraint
    ------------------------
    (&'a mut T_a <: &'b mut T_b) @ P
-->
    (T_a <: T_b) @ P
    ('a: 'b) @ P      // <-- 我々の推論アルゴリズムのための制約
    ------------------------
    (&'a T_a <: &'b T_b) @ P

    (T_a <: T_b) @ P
    (T_b <: T_a) @ P  // (&mut T は非変 (invariant))
    ('a: 'b) @ P      // <-- 他の制約
    ------------------------
    (&'a mut T_a <: &'b mut T_b) @ P

<!--
In the case of our running example, we generate the following subtyping constraints:
-->
我々の動作例の場合、次のような部分型付け制約が生成される:

    (&'foo T <: &'p T) @ A/1
    (&'bar T <: &'p T) @ B/3

<!--
These can be converted into the following lifetime constraints:
-->
これらは次のようなライフタイム制約へと変換することが出来る:

    ('foo: 'p) @ A/1
    ('bar: 'p) @ B/3

<!--
### Reborrow constraints
-->
### 再借用制約

<!--
There is one final source of constraints.
It frequently happens that we have a borrow expression that "reborrows" the referent of an existing reference:
-->
最終的な制約の要因があと一つ存在する。次のような、既存の参照の参照先を「再借用する」ような借用式が頻繁に生じる:

    let x: &'x i32 = ...;
    let y: &'y i32 = &*x;

<!--
In such cases, there is a connection between the lifetime `'y` of the borrow and the lifetime `'x` of the original reference.
In particular, `'x` must outlive `'y` (`'x: 'y`).
In simple cases like this, the relationship is the same regardless of whether the original reference `x` is a shared (`&`) or mutable (`&mut`) reference.
However, in more complex cases that involve multiple dereferences, the treatment is different.
-->
このような場合、借用のライフタイム `'y` と元の参照のライフタイム `'x` との間に関係が生じる。具体的には、`'x` は `'y` より長く生存する（`'x: 'y`）必要がある。このような簡単な場合、この関係は元の参照 `x` が共有リファレンス（`&`）か可変リファレンス（`&mut`）かどうかに関わらず同じである。しかし、その扱いは複数の参照外しを含むより複雑な場合において異なる。

<!--
**Supporting prefixes.**
To define the reborrow constraints, we first introduce the idea of supporting prefixes -- this definition will be useful in a few places.
The *supporting prefixes* for an lvalue are formed by stripping away fields and derefs, except that we stop when we reach the deref of a shared reference.
Inituitively, shared references are different because they are `Copy` -- and hence one could always copy the shared reference into a temporary and get an equivalent path.
Here are some examples of supporting prefixes:
-->
**支持プレフィックス。**
再借用制約を定義するために、我々はまず支持プレフィックス (supporting prefix) の考え方を導入する（この定義はいくつかの場所で有用となる）。lvalue の *支持プレフィックス* は、共有リファレンスの参照外しに到達すると止まることを除き、フィールドおよび参照外しを取り除くことで形成される。直感的には、共有リファレンスは `Copy` される（すなわち、常に一時コピーして等価なパスを得ることが出来る）ため（可変リファレンスとは）異なる。以下が支持プレフィックスのいくつかの例である:

<!--
```
let r: (&(i32, i64), (f32, f64));

// The path (*r.0).1 has type `i64` and supporting prefixes:
// - (*r.0).1
// - *r.0

// The path r.1.0 has type `f32` and supporting prefixes:
// - r.1.0
// - r.1
// - r

let m: (&mut (i32, i64), (f32, f64));

// The path (*m.0).1 has type `i64` and supporting prefixes:
// - (*m.0).1
// - *m.0
// - m.0
// - m
```
-->

```rust
let r: (&(i32, i64), (f32, f64));

// パス (*r.0).1 は型 `i64` を持ち、支持プレフィックスは:
// - (*r.0).1
// - *r.0

// パス r.1.0 は型 `f32` を持ち、支持プレフィックスは:
// - r.1.0
// - r.1
// - r

let m: (&mut (i32, i64), (f32, f64));

// パス (*m.0).1 は型 `i64` を持ち、支持プレフィックスは:
// - (*m.0).1
// - *m.0
// - m.0
// - m
```

<!--
**Reborrow constraints.**
Consider the case where we have a borrow (shared or mutable) of some lvalue `lv_b` for the lifetime `'b`:
-->
**再借用制約。**
ある lvalue `lv_b` の、ライフタイムが `'b` となる（共有または可変）借用を得る場合を考える:

<!--
    lv_l = &'b lv_b      // or:
    lv_l = &'b mut lv_b
-->
    lv_l = &'b lv_b      // または:
    lv_l = &'b mut lv_b

<!--
In that case, we compute the supporting prefixes of `lv_b`, and find every deref lvalue `*lv` in the set where `lv` is a reference with lifetime `'a`.
We then add a constraint `('a: 'b) @ P`, where `P` is the point following the borrow (that's the point where the borrow takes effect).
-->
この場合、`lv_b` の支持プレフィックスを求め、その集合から参照外しである lvalue `*lv` をすべて探索する。ここで `lv` はライフタイム `'a` を持つ参照である。次に制約 `('a: 'b) @ P` を加える。ここで `P` は借用の後の点（すなわち、借用が影響を与える点）である。

<!--
Let's look at some examples.
In each case, we will link to the corresponding test from the prototype implementation.
-->
いくつかの例を見ていくことにする。各ケースにおいて、プロトタイプの実装から対応するテストへのリンクが張られている。

<!--
[**Example 1.**][bck-rvwbi]
To see why this rule is needed, let's first consider a simple example involving a single reference:
-->
[**例 1.**][bck-rvwbi]
このルールがなぜ必要なのかを見るため、まずは一つの参照を含む簡単な例を考えてみる。

[bck-rvwbi]: https://github.com/nikomatsakis/nll/blob/master/test/borrowck-read-variable-while-borrowed-indirect.nll

```rust
let mut foo: i32     = 22;
let r_a: &'a mut i32 = &'a mut foo;
let r_b: &'b mut i32 = &'b mut *r_a;
...
use(r_b);
```

<!--
In this case, the supporting prefixes of `*r_a` are `*r_a` and `r_a` (because `r_a` is a mutable reference, we recurse).
Only one of those, `*r_a`, is a deref lvalue, and the reference `r_a` being dereferenced has the lifetime `'a`.
We would add the constraint that `'a: 'b`, thus ensuring that `foo` is considered borrowed so long as `r_b` is in use.
Without this constraint, the lifetime `'a` would end after the second borrow, and hence `foo` would be considered unborrowed, even though `*r_b` could still be used to access `foo`.
-->
この例において、`*r_a` の支持プレフィックスは `*r_a` と `r_a` である（`r_a` は可変リファレンスであるため再帰する）。これらの中で参照外しである lvalue は `*r_a` のみであり、参照外しの対象である参照 `r_a` はライフタイム `'a` を持つ。`'a: 'b` という制約を加えることで、`r_b` が使用されている限り `foo` が借用されることを保証する。この制約がない場合、ライフタイム `'a` は 2 つめの借用が終わった後に終了してしまうため `*r_b` が `foo` にアクセスするために使用されるのにも関わらず `foo` が借用されていないと解釈される。

<!--
[**Example 2.**][bck-wvare]
Consider now a case with a double indirection:
-->
[**例 2。**][bck-wvare]
2 つの参照外しを含む例を考える。

[bck-wvare]: https://github.com/nikomatsakis/nll/blob/master/test/borrowck-write-variable-after-ref-extracted.nll

```rust
let mut foo: i32     = 22;
let mut r_a: &'a i32 = &'a foo;
let r_b: &'b &'a i32 = &'b r_a;
let r_c: &'c i32     = &'c **r_b;
// What is considered borrowed here?
use(r_c);
```

<!--
Just as before, it is important that, so long as `r_c` is in use, `foo` is considered borrowed.
However, what about the variable `r_a`: should *it* considered borrowed?
The answer is no: once `r_c` is initialized, the value of `r_a` is no longer important, and it would be fine to (for example) overwrite `r_a` with a new value, even as `foo` is still considered borrowed.
This result falls out from our reborrowing rules: the supporting paths of `**r_b` is just `**r_b`.
We do not add any more paths because this path is already a dereference of `*r_b`, and `*r_b` has (shared reference) type `&'a i32`.
Therefore, we would add one reborrow constraint: that `'a: 'c`.
This constraint ensures that as long as `r_c` is in use, the borrow of `foo` remains in force, but the borrow of `r_a` (which has the lifetime `'b`) can expire.
-->
前の場合と同様、ここで重要なのは `r_c` が使用される間 `foo` の借用が考慮されるということである。しかし、変数 `r_a` についてはどうだろうか: *これ* は借用されていると考えるべきだろうか？ この答えは No である: 一度 `r_c` が初期化されれば `r_a` の値はもはや重要ではなく、`foo` が引き続き借用されていると考えるべきであっても（例えば） `r_a` を新しい値で上書きすることは問題ない。この結果は我々の再借用ルールへと書き下される: `**r_b` の支持パス (supporting path) は単に `**r_b` となる。このパスはすでに `*r_b` への参照外しであるため、我々はこれ以上新しい（支持）パスを追加することはなく、`*r_b` は（共有リファレンスとしての）型 `&'a i32` を持つ。したがって、一つの再借用制約（`'a: 'c`）が追加される。この制約は `r_c` が使用中の間 `foo` の借用が有効であることを保証するが、（ライフタイム `'b` を持つ）`r_a` の借用は期限を終了することが出来る。

<!--
[**Example 3.**][bck-rrwrmb]
The previous example showed how a borrow of a shared reference can expire once it has been dereferenced.
With mutable references, however, this is not safe.
Consider the following example:
-->
[**例 3。**][bck-rrwrmb]
前の例では、一度参照外しをした後に共有リファレンスの借用がどのように期限を終了するかを示した。しかしながら、可変リファレンスの場合これは安全ではない。次の例を考える:

[bck-rrwrmb]: https://github.com/nikomatsakis/nll/blob/master/test/borrowck-read-ref-while-referent-mutably-borrowed.nll

```rust
let foo = Foo { ... };
let p: &'p mut Foo = &mut foo;
let q: &'q mut &'p mut Foo = &mut p;
let r: &'r mut Foo = &mut **q;
use(*p); // <-- This line should result in an ERROR
use(r);
```

<!--
The key point here is that we create a reference `r` by reborrowing `**q`; `r` is then later used in the final line of the program.
This use of `r` must extend the lifetime of the borrows used to create *both* `p` *and* `q`.
Otherwise, one could access (and mutate) the same memory through both `*r` and `*p`.
(In fact, the real rustc did in its early days have a soundness bug much like this one.)
-->
ここでのキーポイントは、我々は再借用 `**q` により参照 `r` を作成している点である; `r` はその後プログラムの最終行で使用される。`r` の使用は、`p` *と* `q` を作るために行われる借用のライフタイムの *両方を* 拡張する必要がある。そうしない場合、`*r` と `*p` の両方を用いて同じメモリ領域にアクセス（および変更）することが出来てしまう。（実際のところ、初期の rustc ではこのような健常性 (soundness) に関するバグが存在した。）

<!--
Because dereferencing a mutable reference does not stop the supporting prefixes from being enumerated, the supporting prefixes of `**q` are `**q`, `*q`, and `q`.
Therefore, we add two reborrow constraints: `'q: 'r` and `'p: 'r`, and hence both borrows are indeed considered in scope at the line in question.
-->
可変リファレンスの参照外しにより支持プレフィックスの列挙が止まることはないため、`**q` の支持プレフィックスは `**q` 、`*q` および `q` となる。したがって、２つの再借用制約（`'q: 'r` および `'p: 'r`）が追加され、したがっていずれの借用も問題の行において実際に範囲内であるとみなされる。

<!--
As an alternate way of looking at the previous example, consider it like this.
To create the mutable reference `p`, we get a "lock" on `foo` (that lasts so long as `p` is in use).
We then take a lock on the mutable reference `p` to create `q`; this lock must last for as long as `q` is in use.
When we create `r` by borrowing `**q`, that is the last direct use of `q` -- so you might think we can release the lock on `p`, since `q` is no longer in (direct) use.
However, that would be unsound, since then `r` and `*p` could both be used to access the same memory.
The key is to recognize that `r` represents an indirect use of `q` (and `q` in turn is an indirect use of `p`), and hence so long as `r` is in use, `p` and `q` must also be considered "in use" (and hence their "locks" still enforced).
-->
前の例を見る他の方法として、次のように考えることが出来る。可変リファレンス `p` を作成するため、（`p` が使用される範囲において）`foo` のロックを得る。次に `q` を作るために可変リファレンス `p` のロックを取得する; このロックは `q` が使用される限り有効である必要がある。`**q` を借用することで `r` を作ると、それが最後の `q` の直接使用である。-- `q` が（直接）用いられることはなくなるため、`p` のロックを解除することが出来ると考えるかもしれない。しかしこれは、`r` と `*p` が同じメモリをアクセスするために用いることが出来るため健全ではなくなる (unsound)。重要なのは、`r` が `q` の間接的な使用を表現する（そして `q` は `p` の間接的な使用）ことを認識することであり、したがって `r` が使用される限り `p` と `q` も「使用中」である（またそのため、それらの「ロック」は引き続き有効である）と考える必要がある。

<!--
### Solving constraints
-->
### 制約の解法

<!--
Once the constraints are created, the **inference algorithm** solves the constraints.
This is done via fixed-point iteration: each lifetime variable begins as an empty set and we iterate over the constaints, repeatedly growing the lifetimes until they are big enough to satisfy all constraints.
-->
制約が作られると、**推論アルゴリズム**によりこの制約が解かれる。これは不動点反復により行われる:各ライフタイム変数は空集合から始まり、すべての制約を満たすのに十分な大きさになるまでライフタイムを成長させていく。

<!--
The meaning of a constraint like `('a: 'b) @ P` is that, starting from the point P, the lifetime `'a` must include all points in `'b` that are reachable from the point P.
The implementation [does a depth-first search starting from P][dfs]; the search stops if we exit the lifetime `'b`.
Otherwise, for each point we find, we add it to `'a`.
-->
`('a: 'b) @ P` のような制約が意味するのは、点 P から到達可能なライフタイム `'b` 内のすべての点がライフタイム `'a` に含まれる必要があるということである。これは[点 P を起点とする深さ優先探索][dfs]で実装される; 探索はライフタイム `'b` を脱すると終了する。それ以外では、点が見つかり次第それを `'a` に追加する。

<!--
In our example, the full set of constraints is:
-->
我々の例において、すべての制約は次のようになる:

    ('foo: 'p) @ A/1
    ('bar: 'p) @ B/3
    ('p: {A/1}) @ A/1
    ('p: {B/0}) @ B/0
    ('p: {B/3}) @ B/3
    ('p: {B/4}) @ B/4
    ('p: {C/0}) @ C/0

<!--
Solving these constraints results in the following lifetimes, which are precisely the answers we expected:
-->
これらの制約を解くことで次のようなライフタイムを得られ、これは我々の期待する答えと正確に一致する:

    'p   = {A/1, B/0, B/3, B/4, C/0}
    'foo = {A/1, B/0, C/0}
    'bar = {B/3, B/4, C/0}

> **[訳注]**
> この挙動を実際に確認してみる。
>
> Step 0:
> 制約の後半5つは単に `'p` への点の挿入で置き換えられることに注意すると、
> 初期設定は次のようになる。
> ```
> Lifetimes:
>   'p = { A/1, B/0, B/3, B/4, C/0 }
>   'foo = {}
>   'bar = {}
>
> Constraints:
>   (`foo: 'p) @ A/0
>   (`bar: 'p) @ B/3
> ```
>
> Step 1:
> `'p` のうち、点 A/0 および点 B/3 から到達可能なものを探索する。
>
> まず A/0 から開始した場合、A/1 を取り出した後 `condition` の値に応じて2つの分岐を処理する必要がある。
> * `condition = true` の場合:  
>   B/0 を取り出した後、点 B/1 で変数 `p` が死に探索が終了する。
> * `condition = false` の場合:  
>   C/0 を取り出した後、点 C/1 で変数 `p` が死に探索が終了する。
>
> したがって、A/0 から到達可能な `'p` の点は A/1, B/0 および C/0 となる。
>
> 一方 B/3 から探索を開始すると、B/3, B/4 を取り出した後分岐が合流し、C/0 を取り出し C/1 に到達して探索が終了する。
>
> 以上の結果をまとめると、`'foo` および `'bar` は次のように更新される:
> ```
> `foo = { A/1, C/0, B/0 }
> `bar = { B/3, B/4, C/0 }
> ```
>
> Step2:
> 前ステップで `'p` が更新されていないため、`'foo` と `'bar` の計算結果は変化しない。
> したがって、ここで計算は終了し以下の結果を得る:
>
> ```
> `p   = { A/1, B/0, B/3, B/4, C/0 }
> `foo = { A/1, C/0, B/0 }
> `bar = { B/3, B/4, C/0 }
> ```


[dfs]: https://github.com/nikomatsakis/nll/blob/1cff361c9aeb6f553b528078866f5717f1872dad/nll/src/infer.rs#L71-L113

<!--
### Intuition for why this algorithm is correct
-->
### アルゴリズムの正当性に関する直感的説明

<!--
For the algorithm to be correct, there is a critical invariant that we must maintain.
Consider some path H that is borrowed with lifetime L at a point P to create a reference R; this reference R (or some copy/move of it) is then later dereferenced at some point Q.
-->
このアルゴリズムが正当であるためには、維持しなければいけない重要な不変性が存在する。参照 R を作るために点 P においてライフタイム L で借用されるパス H を考える; この参照 R（またはそれをコピー・移動したもの）はその後、ある点 Q で参照外しされる。

<!--
We must ensure that the reference has not been invalidated: this means that the memory which was borrowed must not have been freed by the time we reach Q.
If the reference R is a shared reference (`&T`), then the memory must also not have been written (modulo `UnsafeCell`).
If the reference R is a mutable reference (`&mut T`), then the memory must not have been accessed at all, except through the reference R.
**To guarantee these properties, we must prevent actions that might affect the borrowed memory for all of the points between P (the borrow) and Q (the use).**
-->
この参照が無効になっていないことを保証する必要がある: これは、借用したメモリが点 Q に到達する前に解放されてはいけないことを意味する。参照 R が共有リファレンス（`&T`）の場合、メモリが書き込まれることも（`UnsafeCell` を法として）あってはいけない。参照 R が可変リファレンス（`&mut T`）の場合、参照 R を介したものを除きメモリへのアクセスはすべて行ってはいけない。**これらの性質を保証するためには、借用されたメモリに影響を与える可能性のあるすべての動作を点P（借用）から点 Q（使用）の間にあるすべての点で防ぐ必要がある。**

<!--
This means that L must at least include all the points between P and Q.
There are two cases to consider.
First, the case where the access at point Q occurs through the same reference R that was created by the borrow:
-->
これは、L が少なくとも P と Q の間のすべての点を含む必要があることを意味する。ここで、考慮すべき2つのケースが存在する。まず、点 Q でのアクセスが借用により作成された同じ参照 R を介して行われる場合である:

    R = &H; // point P
    ...
    use(R); // point Q

<!--
In this case, the variable R will be **live** on all the points between P and Q.
The liveness-based rules suffice for this case: specifically, because the type of R includes the lifetime L, we know that L must include all the points between P and Q, since R is live there.
-->
このケースでは、変数 R は P と Q の間のすべての点で **生存している**。このケースでは生存性に基づくルールで十分である: 具体的には、R の型がライフタイム L を含んでいるため、R が生存している P と Q 間のすべての点をL が 含んでいる必要があることが分かる。

<!--
The second case is when the memory referenced by R is accessed, but through an alias (or move):
-->
2つめは、R で参照されるメモリがエイリアス（あるいは移動）を介してアクセスされる場合である:

    R = &H;  // point P
    R2 = R;  // last use of R, point A
    ...
    use(R2); // point Q

<!--
In this case, the liveness rules alone do not suffice.
The problem is that the `R2 = R` assignment may well be the last use of R, and so the **variable** R is dead at this point.
However, the *value* in R will still be dereferenced later (through R2), and hence we want the lifetime L to include those points.
This is where the **subtyping constraints** come into play: the type of R2 includes a lifetime L2, and the assignment `R2 = R` will establish an outlives constraint `(L: L2) @ A` between L and L2.
Moreover, this new variable R2 must be live between the assignment and the ultimate use (that is, along the path A...Q).
Putting these two facts together, we see that L will ultimately include the points from P to A (because of the liveness of R) and the points from A to Q (because the subtyping requirement propagates the liveness of R2).
-->
この場合、生存性のルールのみでは不十分である。問題は、代入 `R2 = R` が R の最後の使用であり、その結果として **変数** R がこの点で死んでしまうことである。しかし R 内の *値* は後で（R2 を介して）参照外しされるまで有効であるため、ライフタイム L にこれらの点が含まれるようにしたい。これは **部分型付け制約** が出現する場所である: R2 の型はライフタイム L2 を含み、さらに代入 `R2 = R` は L と L2 との間に制約 `(L: L2) @ A` を設ける。さらに、この新しい変数 R2 は代入されてから最終的に使用されるまでの間（すなわちパス A...Q で）生存している必要がある。これら2つの事実により、L は最終的に P から A まで（R の生存性より）、および A から Q まで（部分型付けの要求が R2 の生存性に伝播するため）のすべての点を含むことが確認できる。

<!--
Note that it is possible for these lifetimes to have gaps.
This can occur when the same variable is used and overwritten multiple times:
-->
これらのライフタイムの間にはギャップが存在する可能性があることに注意されたい。これは、同じ変数が複数回上書きされるときに生じる可能性がある:

    let R: &L i32;
    let R2: &L2 i32;

    R = &H1; // point P1
    R2 = R;  // point A1
    use(R2); // point Q1
    ...
    R2 = &H2; // point P2
    use(R2);  // point Q2

<!--
In this example, the liveness constraints on R2 will ensure that L2 (the lifetime in its type) includes Q1 and Q2 (because R2 is live at those two points), but not the "..." nor the points P1 or P2.
Note that the subtyping relationship (`(L: L2) @ A1)`) at A1 here ensures that L also includes Q1, but doesn't require that L includes Q2 (even though L2 has point Q2).
This is because the value in R2 at Q2 cannot have come from the assignment at A1; if it could have done, then either R2 would have to be live between A1 and Q2 or else there would be a subtyping constraint.
-->
この例において、R2 上の生存性制約は L2（その型のライフタイム）が Q1 と Q2 をを含むことが保証されるが（R2 はこれら 2 つの点において生存しているため）、"..." や点 P1, P2 は含まない。ここにおける部分型付けの関係（`(L: L2) @ A1`）は L が Q1 も含むことを保証するが、Q2 を含むことは要求しないことに注意されたい（L2 が点 Q2 を含む場合においてもである）。これは、Q2 における R2 内の値が A1 における代入に起因するものではないためである; もしそれが可能であれば、R2 は A2 と Q2 の間で生存しているべきか、あるいは部分型付け制約が存在するだろう。

<!--
### Other examples
-->
### 他の例

<!--
Let us work through some more examples.
We begin with problem cases #1 and #2 (problem case #3 will be covered after we cover named lifetimes in a later section).
-->
より多くの例を見ることにする。まず問題例 #1 と #2 から始める（問題例 #3 は、後のセクションで名前付きライフタイムを取り扱った後に取り上げる）。

<!--
#### Problem case #1.
-->
#### 問題例 #1

<!--
Translated into MIR, the example will look roughly as follows:
-->
MIR へと変換すると、この例は大雑把に次のようになる:

```rust
let mut data: Vec<i32>;
let slice: &'slice mut i32;
START {
    data = ...;
    slice = &'borrow mut data;
    capitalize(slice);
    data.push('d');
    data.push('e');
    data.push('f');
}
```

<!--
The constraints generated will be as follows:
-->
生成される制約は次のようになる。

    ('slice: {START/2}) @ START/2
    ('borrow: 'slice) @ START/2

<!--
Both `'slice` and `'borrow` will therefore be inferred to START/2, and hence the accesses to `data` in START/3 and the following statements are permitted.
-->
これより `'slice` と `'borrow` は両方 START/2 と推論され、したがって START/3 および後続の文における `data` へのアクセスは可能である。

<!--
#### Problem case #2.
-->
#### 問題例 #2

<!--
Translated into MIR, the example will look roughly as follows (some irrelevant details are elided).
Note that the `match` statement is translated into a SWITCH, which tests the variant, and a "downcast", which lets us extract the contents out from the `Some` variant (this operation is specific to MIR and has no Rust equivalent, other than as part of a match).
-->
MIR へと変換すると、この例は大雑把に次のようになる（いくつかの重要でない詳細は省略した）。ここで、`match` 文はヴァリアントを検査する SWITCH と、`Some` から内容を抽出する「ダウンキャスト」に変換されていることに注意されたい（この操作は Rust における等価なものが存在せず、match の一部でもない MIR 特有のものである）。

```
let map: HashMap<K,V>;
let key: K;
let tmp0: &'tmp0 mut HashMap<K,V>;
let tmp1: &K;
let tmp2: Option<&'tmp2 mut V>;
let value: &'value mut V;

START {
/*0*/ map = ...;
/*1*/ key = ...;
/*2*/ tmp0 = &'map mut map;
/*3*/ tmp1 = &key;
/*4*/ tmp2 = HashMap::get_mut(tmp0, tmp1);
/*5*/ SWITCH tmp2 { None => NONE, Some => SOME }
}

NONE {
/*0*/ ...
/*1*/ goto EXIT;
}

SOME {
/*0*/ value = tmp2.downcast<Some>.0;
/*1*/ process(value);
/*2*/ goto EXIT;
}

EXIT {
}
```

<!--
The following liveness constraints are generated:
-->
生存性制約は次のように生成される:

    ('tmp0: {START/3}) @ START/3
    ('tmp0: {START/4}) @ START/4
    ('tmp2: {SOME/0}) @ SOME/0
    ('value: {SOME/1}) @ SOME/1

<!--
The following subtyping-based constraints are generated:
-->
部分型付けに基づく制約は次のようになる:

    ('map: 'tmp0) @ START/3
    ('tmp0: 'tmp2) @ START/5
    ('tmp2: 'value) @ SOME/1

<!--
Ultimately, the lifetime we are most interested in is `'map`, which indicates the duration for which `map` is borrowed.
If we solve the constraints above, we will get:
-->
最終的には、最も関心のあるライフタイムは `map` が借用される期間を指す `'map` である。上記の制約を解くことで、次を得る:

    'map == {START/3, START/4, SOME/0, SOME/1}
    'tmp0 == {START/3, START/4, SOME/0, SOME/1}
    'tmp2 == {SOME/0, SOME/1}
    'value == {SOME/1}

<!--
These results indicate that `map` **can** be mutated in the `None` arm; `map` could also be mutated in the `Some` arm, but only after `process()` is called (i.e., starting at SOME/2).
This is the desired result.
-->
これらの結果は、`map` が `None` 腕内で変更 **可能である** ということを示している; `map` は `Some` 腕内でも変更可能であるが、それは `process()` が呼ばれた以降（すなわち、SOME/2 から始まる点）のみである。これは望んだ結果である。

<!--
#### Example 4, invariant
-->
#### 例 4, 不変版

<!--
It's worth looking at a variant of our running example ("Example 4").
This is the same pattern as before, but instead of using `&'a T` references, we use `Foo<'a>` references, which are **invariant** with respect to `'a`.
This means that the `'a` lifetime in a `Foo<'a>` value cannot be approximated (i.e., you can't make it shorter, as you can with a normal reference).
Usually invariance arises because of mutability (e.g., `Foo<'a>` might have a field of type `Cell<&'a ()>`).
The key point here is that invariance actually makes **no difference at all** the outcome.
This is true because of location-based subtyping.
-->
我々の動作例（例 4）の変種を見る価値がある。これは前と同じパターンだが、参照 `&'a T` の代わりに '`a` に関して **不変** である `Foo<'a>` を用いる。これは `Foo<'a>` の値の中のライフタイム `'a` が近似できない（すなわち、通常の参照と同じようにそれを短くすることが出来ない）ことを意味する。通常、不変性 (invariance) は可変性 (mutability) が原因で発生する（例えば、`Foo<'a>` は `Cell<'a>` 型のフィールドを持つかもしれない）。ここでのキーポイントは、不変性は実際に得られる結果 **の全てに差を生じさせない** ことである。これは、位置ベースの部分型付けにより成り立つ。

```rust
let mut foo: T = ...;
let mut bar: T = ...;
let p: Foo<'a>;

p = Foo::new(&foo);
if condition {
    print(*p);
    p = Foo::new(&bar);
}
print(*p);
```

<!--
Effectively, we wind up with the same constraints as before, but where we only had `'foo: 'p`/`'bar: 'p` constraints before (due to subtyping), we now also have `'p: 'foo` and `'p: 'bar` constraints:
-->
実際のところ、元と同じ制約が適用されるが、前の例では `'foo: 'p` と `'bar: 'p` のみが課されていたのに対し、今回はそれに加えて `'p: 'foo` と `'p: 'bar` が追加される:

    ('foo: 'p) @ A/1
    ('p: 'foo) @ A/1
    ('bar: 'p) @ B/3
    ('p: 'bar) @ B/3
    ('p: {A/1}) @ A/1
    ('p: {B/0}) @ B/0
    ('p: {B/3}) @ B/3
    ('p: {B/4}) @ B/4
    ('p: {C/0}) @ C/0

<!--
The key point is that the new constraints don't affect the final answer: the new constraints were already satisfied with the older answer.
-->
重要な点は、これらの新しい制約が最終的な解に影響を与えないことである: 新しい制約は、以前の解ですでに満たされている。

#### vec-push-ref
<!--
In previous iterations of this proposal, the location-aware subtyping rules were replaced with transformations such as SSA form.
The vec-push-ref example demonstrates the value of location-aware subtyping in contrast to these approaches.
-->
本提案前の段階における反復では、位置認識の部分型付けルールは SSA 形式のようなもので置き換えられていた。この vec-push-ref の例では、これらのアプローチに対する位置認識の部分型付けの価値を実演する。

```rust
let foo: i32;
let vec: Vec<&'vec i32>;
let p: &'p i32;

foo = ...;
vec = Vec::new();
p = &'foo foo;
if true {
    vec.push(p);
} else {
    // Key point: `foo` not borrowed here.
    use(vec);
}
```

<!--
This can be converted to control-flow graph form:
-->
これは、次の制御フローグラフ形式に変換することが出来る:

```
block START {
    vec = Vec::new();
    p = &'foo foo;
    goto B C;
}

block B {
    vec.push(p);
    goto EXIT;
}

block C {
    // Key point: `foo` not borrowed here
    use(vec);
    goto EXIT;
}

block EXIT {
}
```

<!--
Here the relations from liveness are:
-->
ここで、生存性の関係は次のようになる:

    ('vec: {START/1}) @ START/1
    ('vec: {START/2}) @ START/2
    ('vec: {B/0}) @ B/0
    ('vec: {C/0}) @ C/0
    ('p: {START/2}) @ START/2
    ('p: {B/0}) @ B/0

<!--
Meanwhile, the call to `vec.push(p)` establishes this subtyping relation:
-->
一方、`vec.push(p)` の呼び出しにより次の部分型付け関係が確立される:

    ('p: 'vec) @ B/1
    ('foo: 'p) @ START/2

<!--
The solution is:
-->
解は次のようになる:

    'vec = {START/1, START/2, B/0, C/0}
    'p = {START/2, B/0}
    'foo = {START/2, B/0}

<!--
What makes this example interesting is that **the lifetime `'vec` must include both halves of the `if`** -- because it is used in both branches -- but `'vec` only becomes "entangled" with the lifetime `'p` on one path.
Thus even though `'vec` has to outlive `'p`, `'p` never winds up including the "else" branch thanks to location-aware subtyping.
-->
この例において興味深いのが、**ライフタイム `'vec` は `if` の両方の半分を含む必要がある**（両方の分岐で用いられるため）が、一方のパス上のライフタイム `'p` と「絡む」だけであるということである。したがって、`'vec` は `'p` よりも長く生存する必要があるにも関わらず、位置認識の部分型付けのおかげで `'p` は "else" ブランチを含めて巻き上げられることは決して無い。

<!--
## Layer 2: Avoiding infinite loops
-->
## 階層2: 無限ループの回避

<!--
The previous design was described in terms of the "pure" MIR control-flow graph.
However, using the raw graph has some undesirable properties around infinite loops.
In such cases, the graph has no exit, which undermines the traditional definition of reverse analyses like liveness.
To address this, when we build the control-flow graph for our functions, we will augment it with additional edges -- in particular, for every infinite loop (`loop { }`), we will add false "unwind" edges.
This ensures that the control-flow graph has a final exit node (the success of the RETURN and RESUME nodes) that postdominates all other nodes in the graph.
-->
前節では、「純粋な」MIR の制御フローグラフの観点で設計を説明した。しかしそのグラフをそのまま用いることは、無限ループ周りでいくつかの望ましくない性質を持つ。そのようなケースではグラフは出口を持たないため、生存性のような逆解析の従来の定義に悪影響を与える。これに対処するため、関数の制御フローグラフの構築時に追加のエッジで補強することにする -- 具体的には、すべての無限ループ（`loop {}`）に対し人工的な「巻き戻し」のエッジを追加する。これにより、制御フローグラフがグラフ内の他のノードを支配する (postdominate) 最終的な出口ノード（RETURN や RESUME ノード）を持つことを保証する。

<!--
If we did not add such edges, the result would also allow a number of surprising programs to type-check.
For example, it would be possible to borrow local variables with `'static` lifetime, so long as the function never returned:
-->
このようなエッジを追加しないと、多くの驚くべきプログラムが型チェックを通過することを許容してしまうことになる。例えば関数が決して戻らない場合、ローカル変数をライフタイム `'static` で借用することが可能になる:

```rust
fn main() {
    let x: usize;
    let y: &'static x = &x;
    loop { }
}
```

<!--
This would work because (as covered in detail under the borrow check section) the `StorageDead(x)` instruction would never be reachable, and hence any lifetime of borrow would be acceptable.
This further leads to other surprising programs that still type-check, such as this example which uses an (incorrect, but declared as unsafe) API for spawning threads:
-->
これは（借用チェックの節内で詳細に説明されるように）`StorageDead(x)` 命令に決して到達しないために機能し、そのため任意のライフタイムを持つ借用が受容される。これは更に他の驚くべきプログラムが型チェックを通過することにつながる。そのような例ではスレッドを作るための（間違っているが unsafe 宣言された）API を用いる:

```rust
let scope = Scope::new();
let mut foo = 22;

unsafe {
    // dtor joins the thread
    let _guard = scope.spawn(&mut foo);
    loop {
        foo += 1;
    }
    // drop of `_guard` joins the thread
}
```

<!--
Without the unwind edges, this code would pass the borrowck, since the drop of `_guard` (and `StorageDead` instruction) is not reachable, and hence `_guard` is not considered live (after all, its destructor will indeed never run).
However, this would permit the `foo` variable to be modified both during the infinite loop and by the thread launched by `scope.spawn()`, which was given access to an `&mut foo` reference (albeit one with a theoretically short lifetime).
-->
巻き戻しのエッジがないと、このコードは `_guard` のドロップ（および `StrageDead` 命令）へと到達しないため borrowck を通過する（結局のところ、そのデストラクタが実際に呼ばれることは決して無いためである）。しかし、これは無限ループと `scope.spawn()` により起動したスレッドの両方で参照 `&mut foo` を介した変数 `foo` の変更を（理論的にはどちらか一方がより短いライフタイムを持つにも関わらず）許可してしまうことになる。

<!--
With the false unwind edge, the compiler essentially always assumes that a destructor *may* run, since every scope may theoretically execute.
This extends the `&mut foo` borrow given to `scope.spawn()` to cover the body of the loop, resulting in a borrowck error.
-->
人工的な巻き戻しのエッジがある場合、すべてのスコープが理論的に実行される可能性があるため、コンパイラは本質的にデストラクタが走る *可能性がある* ことを常に仮定する。これは `scope.spawn()` により与えられる借用 `&mut foo` をループ本体を覆うように拡張し、結果として借用エラーとなる。

<!--
## Layer 3: Accommodating dropck
-->
## 層3: dropck への対処

<!--
MIR includes an action that corresponds to "dropping" a variable:
-->
MIR は、次に示す変数の「ドロップ」に対応する動作を持っている:

    DROP(variable)

<!--
Note that while MIR supports general drops of any lvalue, at the point where this analysis is running, we are always dropping entire variables at a time.
This operation executes the destructor for `variable`, effectively "de-initializing" the memory in which the value resides (if the variable -- or parts of the variable -- have already been dropped, then drop has no effect; this is not relevant to the current analysis).
-->
MIR は任意の lvalue に対する一般的なドロップに対応しているが、この解析の動作中におけるポイントは、変数全体を常に一度にドロップするということである。この操作は `variable` のデストラクタを実行することで行われ、値が存在するメモリを実質的に「初期化解除」する（変数またはその一部分がドロップ済みの場合、ドロップの効果はない; これは現在の分析とは関係がない）。

<!--
Interestingly, in many cases dropping a value does not require that the lifetimes in the dropped value be valid.
After all, dropping a reference of type `&'a T` or `&'a mut T` is defined as a no-op, so it does not matter if the reference points at valid memory.
In cases like this, we say that the lifetime `'a` **may dangle**.
This is inspired by the C term "dangling pointer" which means a pointer to freed or invalid memory.
-->
驚くべきことは、多くの場合において、値のドロップはドロップされる値のライフタイムが有効であることを要求しないということである。実際、型 `T` の参照 `&'a T` または `&'a mut T` のドロップは操作なし (no-op) として定義されるため、参照先が有効なメモリである必要はない。このような状況を、ライフタイム `'a` が**ぶら下がっている (dangle) 可能性がある**と呼ぶ。これは、ポインタが解放済みか無効なメモリを指していることを意味する C 言語の用語「ダングリング・ポインタ」から着想を得たものである。

<!--
However, if that same reference is stored in the field of a struct which implements the `Drop` trait, when the struct may, during its destructor, access the referenced value, so it's very important that the reference be valid in that case.
Put another way, if you have a value `v` of type `Foo<'a>` that implements `Drop`, then `'a` typically **cannot dangle** when `v` is dropped (just as `'a` would not be allowed to dangle for any other operation).
-->
しかし同様の参照が `Drop` を実装した構造体のフィールドに保存されているときは、デストラクタ内でその参照にアクセスする可能性があるため、その場合において参照が有効であることは非常に重要である。言い換えると、`Drop` を実装した型 `Foo<'a>` の値 `v` があるとき、通常 `'a` は（他の操作でそうであるように）`v` のドロップ時に**ぶら下がっていてはいけない (cannot dangle)**。

<!--
More generally, RFC 1327 defined specific rules for which lifetimes in a type may dangle during drop and which may not.
We integrate those rules into our liveness analysis as follows: the MIR instruction `DROP(variable)` is not treated like other MIR instructions when it comes to liveness.
In a sense, conceptually we run two distinct liveness analyses (in practice, the prototype uses two bits per variable):
-->
より一般的には、RFC 1327 で型中のライフタイムでぶら下がる可能性があるか否かを指定するためのルールが定義されている。これらのルールを、次のように生存性の分析に統合する: MIR 命令 `DROP(variable)` は、生存性に関しては他の MIR 命令と同じように扱わない。これは、概念的には 2 つの異なる生存性の分析が実行されることを意味する（実際のところ、プロトタイプでは変数ごとに2ビットを用いている）。

<!--
1. The first, which we've already seen, indicates when a variable's current value may be **used** in the future.
   This corresponds to "non-drop" uses of the variable in the MIR.
   Whenever a variable is live by this definition, all of the lifetimes in its type are live.
2. The second, which we are adding now, indicates when a variable's current value may be **dropped** in the future.
   This corresponds to "drop" uses of the variable in the MIR.
   Whenever a variable is live in *this* sense, all of the lifetimes in its type **except those marked as may-dangle** are live.
-->
1. まず、すでに見てきたように変数の現在値が将来的に **使用される** 可能性があることを示すもの。これは MIR 内の変数における「ドロップでない」使用に対応する。この定義により変数が生存している場合、その変数の型内にあるすべてのライフタイムは常に生存している。
2. 次に導入されるのが、変数の現在値が将来的に **ドロップされる** 可能性があることを示すもの。これは MIR 内の変数における「ドロップの」使用に対応する。変数が *この* 意味で生存している場合、その変数の型における **may-dangle** **がマークされているものを除いた** すべてのライフタイムは常に生存している。

<!--
Permitting lifetimes to dangle during drop is very important!
In fact, it is essential to even the most basic non-lexical lifetime examples, such as Problem Case #1.
After all, if we translate Problem Case #1 into MIR, we see that the reference `slice` will wind up being dropped at the end of the block:
-->
ドロップ中にライフタイムがぶら下がることを許可することは非常に重要である！実際これは、問題例 #1 のような基本的なノンレキシカル・ライフタイムの例においても不可欠なものである。問題例 #1 を MIR へと変換することで、結果的に参照 `slice` がブロックの終わりでドロップされていることが確認できる:

```rust
let mut data: Vec<i32>;
let slice: &'slice mut i32;
START {
    ...
    slice = &'borrow mut data;
    capitalize(slice);
    data.push('d');
    data.push('e');
    data.push('f');
    DROP(slice);
    DROP(data);
}
```

<!--
This poses no problem for our analysis, however, because `'slice` "may dangle" during the drop, and hence is not considered live.
-->
しかし `'slice` はドロップ時に「ぶら下がっている可能性」があり、ここで生存していると考える必要はない。したがって、我々の分析において問題は生じない。

<!--
## Layer 4: Named lifetimes
-->
## 層4: 名前付きライフタイム

<!--
Until now, we've only considered lifetimes that are confined to the extent of a function.
Often, we want to reason about lifetimes that begin or end after the current function has ended.
More subtly, we sometimes want to have lifetimes that sometimes begin and end in the current function, but which may (along some paths) extend into the caller.
Consider Problem Case #3 (the corresponding test case in the prototype is the [get-default] test):
-->
これまでの議論は、関数内に宣言されたライフタイムのみを考えていた。しばしば、現在の関数が終了したあとに開始あるいは終了するライフタイムについて推論したい。より微妙な場合では、あるときは関数内で開始・終了するが、（いくつかのパスで）呼び出し元へと広がるようなライフタイムを扱いたい。問題のケース #3 を考える（プロトタイプ内で対応するテストケースは [get-default] である）。

[get-default]: https://github.com/nikomatsakis/nll/blob/master/test/get-default.nll

```rust
fn get_default<'r,K,V:Default>(map: &'r mut HashMap<K,V>,
                               key: K)
                               -> &'r mut V {
    match map.get_mut(&key) { // -------------+ 'r
        Some(value) => value,              // |
        None => {                          // |
            map.insert(key, V::default()); // |
            //  ^~~~~~ ERROR               // |
            map.get_mut(&key).unwrap()     // |
        }                                  // |
    }                                      // |
}                                          // v
```

<!--
When we translate this into MIR, we get something like the following (this is "pseudo-MIR"):
-->
これを MIR へと変換すると、次のようになる（これは「擬似的な MIR」である）:

```
block START {
  m1 = &'m1 mut *map;  // temporary created for `map.get_mut()` call
  v = Map::get_mut(m1, &key);
  switch v { SOME NONE };
}

block SOME {
  return = v.as<Some>.0; // assign to return value slot
  goto END;
}

block NONE {
  Map::insert(&*map, key, ...);
  m2 = &'m2 mut *map;  // temporary created for `map.get_mut()` call
  v = Map::get_mut(m2, &key);
  return = ... // "unwrap" of `v`
  goto END;
}

block END {
  return;
}
```

<!--
The key to this example is that the first borrow of `map`, with the lifetime `'m1`, must extend to the end of the `'r`, but only if we branch to SOME.
Otherwise, it should end once we enter the NONE block.
-->
この例における重要な点は、ライフタイム `'m1` を持つ最初の借用 `map` は `'r` の終了まで拡張されるが、それは SOME ブランチのみであるということである。それ以外の場合、NONE ブロックに入ると終了するべきである。

<!--
To accommodate cases like this, we will extend the notion of a region so that it includes not only points in the control-flow graph, but also includes a (possibly empty) set of "end regions" for various named lifetimes.
We denote these as `end('r)` for some named region `'r`.
The region `end('r)` can be understood semantically as referring to some portion of the caller's control-flow graph (actually, they could extend beyond the end of the caller, into the caller's caller, and so forth, but that doesn't concern us).
This new region might then be denoted as the following (in pseudocode form):
-->
このような場合に対処するため、リージョンの概念を制御フローグラフ内の点のみでなく様々な名前付きのライフタイムの「終端リージョン (end region)」のセットを含むように拡張する（これは空の場合もある）。これは、名前付きのリージョン `'r` に対し `end('r)` と表記される。リージョン `end('r)` は、意味的には呼び出し側の制御フローグラフのある部分を参照していると理解することが出来る（実際には、呼び出し側の終端を超えてさらに上位の呼び出し側に及ぶなどといった可能性が考えられるが、ここではそれを気にする必要はない）。この新しいリージョンは次のように（疑似コード形式で）表記することが出来る:

```rust
struct Region {
  points: Set<Point>,
  end_regions: Set<NamedLifetime>,
}
```

<!--
In this case, when a type mentions a named lifetime, such as `'r`, that can be represented by a region that includes:
-->
このような場合、ある型に `'r` などの名前付きのライフタイムが含まれるとき、それは次を含むリージョンとして表現することが出来る:

<!--
- the entire CFG,
- and, the end region for that named lifetime (`end('r)`).
-->
- CFG 全体
- および、それら名前付きライフタイムの終端リージョン（`end('r)`）

<!--
Furthermore, we can **elaborate** the set to include `end('x)` for every named lifetime `'x` such that `'r: 'x`.
This is because, if `'r: 'x`, then we know that `'r` doesn't end up until `'x` has already ended.
-->
さらに `'r: 'x` を満たすすべての名前付きライフタイム `'x` に対し、その集合が `end('x)` を含むように **精緻化** することが出来る。これは、`'r: 'x` である場合は `'x` が終了するまで `'r` が終了しないことが分かっているためである。

<!--
Finally, we must adjust our definition of subtyping to accommodate this amended definition of a region, which we do as follows.
When we have an outlives relation 
-->
最後に、この修正されたリージョンの定義に合わせて部分型付けの定義を調整する必要がある。次のような関係があるとする。

    'b: 'a @ P

<!--    
where the end point of the CFG is reachable from P without leaving `'a`, the existing inference algorithm would simply add the end-point to `'b` and stop.
The new algorithm would also add any end regions that are included in `'a` to `'b` at that time.
(Expressed less operationally, `'b` only outlives `'a` if it also includes the end-regions that `'a` includes, presuming that the end point of the CFG is reachable from P).
The reason that we require the end point of the CFG to be reachable is because otherwise the data never escapes the current function, and hence `end('r)` is not reachable (since `end('r)` only covers the code in callers that executes *after* the return).
-->
ここで CFG の終了点は `'a` を残すことなく P から到達可能である。このとき、既存のアルゴリズムは単に `'b` に終了点を追加して停止する。新しいアルゴリズムではそれに加え、その時点で `'a` から `'b` に含まれる任意の終端リージョンも追加される。（操作がより少なくなるよう表現すると、A が含む終端リージョンを B も含む場合に限り、B は A よりも長く生存する。ここで CFG の終了点は P から到達可能であると仮定している）。到達可能な CFG の終了点が必要な理由は、それ以外の場合にデータは現在の関数を抜け出すことが決して無いため `end('r)` に到達できないためである（`end('r)` は関数を戻った *後* に実行される、呼び出し側のコードのみを覆うため）。

<!--
NB: This part of the prototype is partially implemented.
[Issue #12](https://github.com/nikomatsakis/nll/issues/12) describes the current status and links to the in-progress PRs.
-->
注意: プロトタイプにおけるこの部分は部分的に実装されている。[Issue #12](https://github.com/nikomatsakis/nll/issues/12) で現在の状態と進行中の PR へのリンクが説明されている。

<!--
## Layer 5: How the borrow check works
-->
## 層5: 借用チェッカーはどう動作するか

<!--
For the most part, the focus of this RFC is on the structure of lifetimes, but it's worth talking a bit about how to integrate these non-lexical lifetimes into the borrow checker.
In particular, along the way, we'd like to fix two shortcomings of the borrow checker:
-->
本 RFC の多くの部分ではライフタイムの構造について説明しているが、これらのノンレキシカルライフタイムが借用チェッカーにどのように統合されるのかについて話しておくことには価値がある。具体的には、統合される過程で借用チェッカーの2つの問題点を解決したいと考えている。

<!--
**First, support nested method calls like `vec.push(vec.len())`.**
Here, the plan is to continue with the `mut2` borrow solution proposed in [RFC 2025].
This RFC does not (yet) propose one of the type-based solutions described in RFC 2025, such as "borrowing for the future" or `Ref2`.
The reasons why are discussed in the Alternatives section.
For simplicity, this description of the borrow checker ignores [RFC 2025].
The extensions described here are fairly orthogonal to the changes proposed in [RFC 2025], which in effect cause the start of a borrow to be delayed.
-->
**まず、`vec.push(vec.len())` のようなネストしたメソッド呼び出しをサポートする。** ここでは、[RFC 2025] で提案されている `mut2` 借用の解決策を継続する予定である。本 RFC では、「将来の借用 (borrowing for the future)」や「Ref2」などの RFC 2025 で説明される型ベースの解決策の一つは（まだ）提案されていない。その理由は「代替案」の節で説明する。説明を簡単にするため、借用チェッカーに関するここでの説明では [RFC 2025] を無視する。ここで説明される拡張は [RFC 2025] で提案されている（実際に借用が開始されるのが遅延する原因となる）変更とかなり直交したものである。

> **[訳注]**
>
> RFC 2015 で提案されている **two-phase borrow** とは、直感的に言うと実際に使用されるまでは「共有借用」として振る舞う可変借用である。
> これは、`&mut` による借用が実際に変数に変更を加えることに対し「予約」を行っていると解釈される。
>
> 例えば、`vec.push(vec.len())` は次のような 擬似的な MIR に対応し、各参照はそれぞれ次のように振る舞うことになる:
> ```rust
> tmp0 = &mut2 vec;         // <-- vec への変更が「予約」される
> tmp1 = Vec::len(&vec);    // <-- ここで tmp0 は「実質的には」共有参照なので有効
> Vec::push(tmp0, tmp1);    // <-- tmp0 が「使用され」、これ以降は今まで通りに振る舞う
> ```
>
> 一度使用されると可変借用となるため、例えば次のような例は借用チェッカーを通らない:
> ```rust
> vec[0].push(vec.len());
> ```
> ```rust
> tmp0 = &mut2 vec;
> tmp1 = IndexMut::index(tmp0, 0);  // <-- ここで tmp0 は使用される
> tmp2 = Vec::len(&vec);            // <-- エラー
> Vec::push(tmp0, tmp2);
> ```

<!--
**Second, permit variables containing mutable references to be modified, even if their referent is borrowed.**
This refers to the "Problem Case #4" described in the introduction; we wish to accept the original program.
-->
**次に、参照の対象が借用されていても、可変リファレンスを保持した変数の変更を可能にする。**これは導入部で説明した「問題例 #4」を指しており、元のプログラムを受容したいと考えている。

<!--
### Borrow checker phase 1: computing loans in scope
-->
### 借用チェッカー フェーズ 1: スコープ内の貸付の計算

<!--
The first phase of the borrow checker computes, at each point in the CFG, the set of in-scope **loans**.
A "loan" is represented as a tuple `('a, shared|uniq|mut, lvalue)` indicating:
-->
借用チェッカーにおける最初のフェーズは、CFG 内の各点においてスコープ内の **貸付** **(loan)** の集合を計算することである。ここで「貸付」はタプル `('a, shared|uniq|mut, lvalue)` で表現され、それぞれ次を指す:

<!--
1. the lifetime `'a` for which the value was borrowed;
2. whether this was a shared, unique, or mutable loan;
    - "unique" loans are exactly like mutable loans, but they do not permit mutation of their referents.
      They are used only in closure desugarings and are not part of Rust's surface syntax.
3. the lvalue that was borrowed (e.g., `x` or `(*x).foo`).
-->
1. 値が借用されたライフタイム `'a`
2. それが共有、ユニーク、あるいは可変な貸付かどうか
    - 「ユニークな」貸付は厳密には可変な貸付と似ているが、参照先の変更が認められていない。
3. 借用された lvalue （`x`、`(*x).foo` など）

<!--
The set of in-scope loans at each point is found via a fixed-point dataflow computation.
We create a loan tuple from each borrow rvalue in the MIR (that is, every assignment statement like `tmp = &'a b.c.d`), giving each tuple a unique index `i`.
We can then represent the set of loans that are in scope at a particular point using a bit-set and do a standard forward data-flow propagation.
-->
各点におけるスコープ内貸付 (in-scope loan) の集合は、不動点データフロー計算 (fixed-point dataflow computation) を用いて求めることが出来る。MIR 内の借用された rvalue （すなわち、`tmp = &'a b.c.d` のような代入文）に対しそれぞれ貸付の組を作成し、各組に対し一意なインデックス `i` を与える。
その後、特定の点においてスコープ内にある貸付の集合をビットセットを用いて表現し、標準的な前向きのデータフローの伝播を実行することが出来る。

<!--
For a statement at point P in the graph, we define the "transfer function" -- that is, which loans it brings into or out of scope -- as follows:
-->
グラフ内の点 P における文に対し、「伝達関数 (transfer function)」 -- つまり、どの貸付が範囲内か範囲外か -- を次のように定義する:

<!--
- any loans whose region does not include P are killed;
- if this is a borrow statement, the corresponding loan is generated;
- if this is an assignment `lv = <rvalue>`, then any loan for some path P of which `lv` is a prefix is killed.
-->
- （残っている）貸付のうち、そのリージョンが P を含まないものはすべて死亡する
- 借用文 (borrow statement) のとき、対応した貸付が生成される
- 代入文 `lv = <rvalue>` のとき、パス P の プレフィックスが `lv` である貸出はすべて死亡する

<!--
The last point bears some elaboration.
This rule is what allows us to support cases like the one in Problem Case #4:
-->
最後の点は少し精巧なものになっている。このルールは、問題例 #4 のようなケースをサポートできるようにするためのものである:

```rust
let list: &mut List<T> = ...;
let v = &mut (*list).value;
list = ...; // <-- assignment
```

<!--
At the point of the marked assignment, the loan of `(*list).value` is in-scope, but it does not have to be considered in-scope afterwards.
This is because the variable `list` now holds a fresh value, and that new value has not yet been borrowed (or else we could not have produced it).
Specifically, whenever we see an assignment `lv = <rvalue>` in MIR, we can clear all loans where the borrowed path `lv_loan` has `lv` as a prefix.
(In our example, the assignment is to `list`, and the loan path `(*list).value` has `list` as a prefix.)
-->
代入とマークされた点において、`(*list).value` の借用はスコープ内だが、その後はスコープ内であることを考慮する必要はない。これは変数 `list` が新しい値を保持するようになり、その新しい値はまだ借用されていないためである（そうでなければ、この値を生成することは出来ない）。具体的に言うと、MIR が `lv = <rvalue>` を含むときは常に、借用されたパス `lv_loan` が `lv` をプレフィックスとして含むすべての貸付をクリアすることが出来る。（この例では、`list` への代入であり、借用のパス `(*list).value` は `list` をプレフィックスに持っている。）

<!--
**NB.**
In this phase, when there is an assignment, we always clear all loans that applied to the overwritten path; however, in some cases the **assignment itself** may be illegal due to those very loans.
In our example, this would be the case if the type of `list` had been `List<T>` and not `&mut List<T>`.
In such cases, errors will be reported by the next portion of the borrowck, described in the next section.
-->
**注釈。**
このフェーズでは、代入が存在するとき、上書きされるパスに適用されたすべての貸付をクリアする; しかしながら、場合によってはまさにその貸付のために **代入自体** が不正となる。我々の例では、これは `list` の型が `&mut List<T>` ではなく `List<T>` となった場合である。このような場合、次節で説明する borrowck の次の部分でエラーが報告される。

<!--
### Borrow checker phase 2: reporting errors
-->
### 借用チェッカー フェーズ2: エラーの報告

<!--
At this point, we have computed which loans are in scope at each point.
Next, we traverse the MIR and identify actions that are illegal given the loans in scope.
Rather than go through every kind of MIR statement, we can break things down into two kinds of actions that can be performed:
-->
この時点では、各点でどの貸付がスコープ内かどうかが計算されている。次に、MIR を走査し、与えられたスコープ内の借用から不正な走査を特定する。この時、MIR 文のすべてを読み上げるのではなく、実行可能な2種類の操作にそれらを分解することが出来る。

<!--
- Accessing an lvalue, which we categorize along two axes (shallow vs deep, read vs write)
- Dropping an lvalue
-->
- 2つの軸（浅い／深い、または読み込み／書き込み）に基づき分類された lvalue へのアクセス
- lvalue のドロップ

<!--
For each of these kinds of actions, we will specify below the rules that determine when they are legal, given the set of loans L in scope at the start of the action.
The second phase of the borrow check therefore consists of iterating over each statement in the MIR and checking, given the in-scope loans, whether the actions it performs are legal.
Translating MIR statements into actions is mostly straightforward:
-->
これらの種類の動作それぞれについて、それらの動作の開始時におけるスコープ内の貸付の集合 L が与えられたとして、合法であるかどうかを判断するための以下に述べるようなルールを定める。したがって借用チェックの第2フェーズでは、スコープ内の貸付を用いて、MIR 内の各文を繰り返し実行してその動作が合法であるかどうかをチェックする。MIR の文から動作への変換は、ほとんど直接的である:

<!--
- A `StorageDead` statement counts as a **shallow write**.
- An assignment statement `LV = RV` is a **shallow write** to `LV`;
- and, within the rvalue `RV`:
  - Each lvalue operand is either a **deep read** or a **deep write** action, depending on whether or not the type of the lvalue implements `Copy`.
    - Note that moves count as "deep writes".
  - A shared borrow `&LV` counts as a **deep read**.
  - A mutable borrow `&mut LV` counts as **deep write**.
-->
- `StorageDead` は **浅い書き込み** としてカウントされる。
- 代入文 `LV = RV` は `LV` への**浅い書き込み**として扱われ、
- さらに rvalue `RV` について
  - lvalue の各オペランドは、lvalue の型が `Copy` を実装しているかどうかによって **深い読み込み** か **深い書き込み** のいずれかとなる。
    - 移動は *深い書き込み* としてカウントされることに注意。
  - 共有借用 `&LV` は **深い読み込み** としてカウントされる。
  - 可変借用 `&mut LV` は **深い書き込み** としてカウントされる。

<!--
There are a few interesting cases to keep in mind:
-->
心に留めておくべきな、興味深いケースがいくつか存在する:

<!--
- MIR models discriminants more precisely.
  They should be thought of as a distinct *field* when it comes to borrows.
- In the compiler today, `Box` is still "built-in" to MIR.
  This RFC ignores that possibility and instead acts as though borrowed references (`&` and `&mut`) and raw pointers (`*const` and `*mut`) were the only sorts of pointers.
  It should be straight-forward to extend the text here to cover `Box`, though some questions arise around the handling of drop (see the section on drops for details).
-->
- MIR では（訳注: 列挙型の）判別式をより正確にモデル化している。借用された時、それらは別のフィールドとして考えるべきである。
- 現在のコンパイラでは、`Box` はまだ MIR 組み込みとなっている。本 RFC ではそれが用いられる可能性は無視し、代わりに借用された参照（`&` および `&mut`）と生ポインタ（`*const` and `*mut`）がポインタの唯一の種類であるとした。ここで `Box` をカバーするためにテキストを拡張するのは簡単であるが、ドロップの取り扱いに関していくつかの疑問が生じる（詳細はドロップの節を参照されたい）。

<!--
**Accessing an lvalue LV.**
When accessing an lvalue LV, there are two axes to consider:
-->
**lvalue LV へのアクセス。**
lvalue LV にアクセスするとき、考慮すべき2つの軸が存在する:

<!--
- The access can be SHALLOW or DEEP:
  - A *shallow* access means that the immediate fields reached at LV are accessed, but references or pointers found within are not dereferenced. 
    Right now, the only access that is shallow is an assignment like `x = ...`, which would be a **shallow write** of `x`.
  - A *deep* access means that all data reachable through a given lvalue may be invalidated or accessed by this action.
- The access can be a READ or WRITE:
  - A *read* means that the existing data may be read, but will not be changed.
  - A *write* means that the data may be mutated to new values or otherwise invalidated (for example, it could be de-initialized, as in a move operation).
-->
- アクセスが"浅い"か"深い"か:
  - *浅い* アクセスとは、LV で到達したフィールドの値に直ちにアクセスするが、その中にある参照やポインタの参照外しは行われないことを意味する。現在、浅いアクセスは `x = ...` のような代入が唯一のものであり、これは `x` の **浅い書き込み** となる。
  - *深い*アクセスとは、指定された lvalue を介して到達することの出来るすべてのデータが、この動作によって無効化されるかアクセスされる可能性のあることを意味する。
- アクセスが"読み込み"か"書き込み"か:
  - *読み込み* とは、既存のデータを読み取るが変更することがないことを意味する。
  - *書き込み* とは、データが新しい値に変更されるかまたは無効化される可能性のあることを意味する（例えばこれは、初期化解除や移動操作が当てはまる）。

<!--
"Deep" accesses are often deep because they create and release an alias, in which case the "deep" qualifier reflects what might happen through that alias.
For example, if you have `let x = &mut y`, that is considered a **deep write** of `y`, even though the **actual borrow** doesn't do anything at all, we create a mutable alias `x` that can be used to mutate anything reachable from `y`.
A move `let x = y` is similar: it writes to the shallow content of `y`, but then -- via the new name `x` -- we can access all other content accessible through `y`.
-->
「深い」アクセスはエイリアスの作成・解放を行うため深くなっていることがよくあり、その場合「深い」という修飾子がそのエイリアスで何が起こっているのかを反映している。例えば `let x = &mut y` 、すなわち `y` への **深い書き込み** とみなされる場合では、 **実際の借用** は何もしないが `y` から到達可能なものを変更するために使用することが可能なエイリアス `x` が作成される。移動 `let x = y` もこれに似ている: これは `y` の浅い内容が書き込まれるが、その後（新しい名前である `x` を介して）`y` でアクセス可能な他のすべての内容にアクセスすることが出来る。

<!--
The pseudocode for deciding when an access is legal looks like this:
-->
アクセスが合法であるかどうかを判断する疑似コードは次のようになる:

```
fn access_legal(lvalue, is_shallow, is_read) {
    let relevant_borrows = select_relevant_borrows(lvalue, is_shallow);

    for borrow in relevant_borrows {
        // shared borrows like `&x` still permit reads from `x` (but not writes)
        if is_read && borrow.is_read { continue; }
        
        // otherwise, report an error, because we have an access
        // that conflicts with an in-scope borrow
        report_error();
    }
}
```

<!--
As you can see, it works in two steps.
First, we enumerate a set of in-scope borrows that are relevant to `lvalue` -- this set is affected by whether this is a "shallow" or "deep" action, as will be described shortly.
Then, for each such borrow, we check if it conflicts with the action (i.e.,, if at least one of them is potentially writing), and, if so, we report an error.
-->
これを見ると分かるように、これは 2 つのステップで成り立っている。まず、`lvalue` に関連したスコープ内にある借用の集合を列挙する。この集合は、すぐ後に説明するように、「浅い」動作か「深い」動作かどうかによって影響を受ける。次にそのような借用ごとに、それが動作と競合するかどうか（すなわち、それらの少なくとも１つが潜在的に書き込みを行っているか）をチェックし、そうであればエラーを報告する。

<!--
For **shallow** accesses to the path `lvalue`, we consider borrows relevant if they meet one of the following criteria:
-->
パス `lvalue` への **浅い** アクセスに対しては、次のいずれかの基準を満たしていれば関連する借用を考慮する:

<!--
- there is a loan for the path `lvalue`;
  - so: writing a path like `a.b.c` is illegal if `a.b.c` is borrowed
- there is a loan for some prefix of the path `lvalue`;
  - so: writing a path like `a.b.c` is illegal if `a` or `a.b` is borrowed
- `lvalue` is a **shallow prefix** of the loan path
  - shallow prefixes are found by stripping away fields, but stop at any dereference
  - so: writing a path like `a` is illegal if `a.b` is borrowed
  - but: writing `a` is legal if `*a` is borrowed, whether or not `a` is a shared or mutable reference
-->
- パス `lvalue` への貸付が存在する
  - すなわち、`a.b.c` のようなパスへの書き込みは `a.b.c` が借用されている場合は違法である
- パス `lvalue` のプレフィックスのいずれかに対し貸付が存在する
  - すなわち、`a.b.c` のようなパスへの書き込みは `a.b` が借用されている場合は不正である
- `lvalue` は貸付パスの **浅いプレフィックス** である
  - 浅いプレフィックスは、フィールドを取り除いてき参照外しで止まることで探索することが出来る
  - すなわち、`a` のようなパスへの書き込みは `a.b` が借用されている場合は違法である。
  - しかし、`a` への書き込みは `a` が共有か可変かに関わらず `*a` が借用されている場合も合法である。

<!--
For **deep** accesses to the path `lvalue`, we consider borrows relevant if they meet one of the following criteria:
-->
`lvalue` への **深い** アクセスに対しては、次のいずれかの基準を満たしていれば関連する借用を考慮する:

<!--
- there is a loan for the path `lvalue`;
  - so: reading a path like `a.b.c` is illegal if `a.b.c` is mutably borrowed
- there is a loan for some prefix of the path `lvalue`;
  - so: reading a path like `a.b.c` is illegal if `a` or `a.b` is mutably borrowed
- `lvalue` is a **supporting prefix** of the loan path
  - supporting prefixes were defined earlier
  - so: reading a path like `a` is illegal if `a.b` is mutably borrowed, but -- in contrast with shallow accesses -- reading `a` is also illegal if `*a` is mutably borrowed
-->
- パス `lvalue` への貸付が存在する
  - すなわち、`a.b.c` のようなパスからの読み込みは `a.b.c` が可変的に借用されている場合は違法である
- パス `lvalue` のプレフィックスのいずれかに対し貸付が存在する
  - すなわち、`a.b.c` のようなパスからの読み込みは `a` や `a.b` が可変的に借用されている場合は違法である
- `lvalue` は貸付パスの **支持プレフィックス** である
  - 支持プレフィックスは前に定義した
  - すなわち、`a` のようなパスからの読み込みは `a.b` が可変的に借用されている場合は違法である。しかし、（浅いアクセスの場合とは異なり）`*a` が可変的に借用されていれば `a` からの呼び出しも不正である。

<!--
**Dropping an lvalue LV.**
Dropping an lvalue can be treated as a DEEP WRITE, like a move, but this is overly conservative.
The rules here are under active development, see [#40](https://github.com/nikomatsakis/nll-rfc/issues/40).
-->
**lvalue LV のドロップ。**
lvalue のドロップは、移動などのように"深い書き込み"として扱われるが、これは過度に控えめになっている。ここでのルールは活発的に開発中である。[#40](https://github.com/nikomatsakis/nll-rfc/issues/40) を参照されたい。

<!--
# How We Teach This
-->
# 教授方法
[how-we-teach-this]: #how-we-teach-this

<!--
## Terminology
-->
## 用語

<!--
In this RFC, I've opted to continue using the term "lifetime" to refer to the portion of the program in which a reference is in active use (or, alternatively, to the "duration of a borrow").
As the intro to the RFC makes clear, this terminology somewhat conflicts with an alternative usage, in which lifetime refers to the dynamic extent of a value (what we call the "scope").
I think that -- if we were starting over -- it might have been preferable to find an alternative term that is more specific.
However, it would be rather difficult to try and change the term "lifetime" at this point, and hence this RFC does not attempt do so.
To avoid confusion, however, it seems best if the error messages result from the region and borrow check avoid the term lifetime where possible, or use qualification to make the meaning more clear.
-->
本 RFC では「ライフタイム」を、参照がアクティブに使用されているプログラムの一部分（または「借用の期間」）を示す用語として選択した。RFC の導入部で明記しているように、この用語は値の動的な範囲（これは「スコープ」とも呼ばれる）を示す、ライフタイムの別の使用法と若干衝突する。やり直すことが出来るのであれば、より具体的な代替用語を見つけるのが望ましいだろう。しかし、この段階でそれを試みて「ライフタイム」という用語を変更するのは難しいため、本 RFC ではそれを試みていない。しかし混乱を避けるために、リージョン・借用チェックにより得られるエラーメッセージは可能な限りライフタイムという用語を避けるか、あるいは意味をより明確にするために条件付けるのが最善であろう。

<!--
## Leveraging intuition: framing errors in terms of points
-->
## 直感の活用: ポイントの面でのエラーのフレーム化

<!--
Part of the reason that Rust currently uses lexical scopes to determine lifetimes is that it was thought that they would be simpler for users to reason about.
Time and experience have not borne this hypothesis out: for many users, the fact that borrows are "artificially" extended to the end of the block is more surprising than not.
Furthermore, most users have a pretty intuitive understanding of control flow (which makes sense: you have to, in order to understand what your program will do).
-->
Rust が現在ライフタイムの決定にレキシカルスコープを用いている理由の一つは、ユーザが（その規則を）推測することが簡単になると考えられていたためである。時間と経験はこの仮説を裏付けない: 多くのユーザにとって、借用がブロックの終わりまで「人工的に」拡張されるという事実はそうでない場合と比べて驚くべきことである。さらに、ほとんどのユーザは（プログラムが何をするのかを理解するために必要な）制御フローに関する見事に直感的な理解を持っている。

<!--
We therefore propose to leverage this intution when explaining borrow and lifetime errors.
To the extent possible, we will try to explain all errors in terms of three points:
-->
そのため、借用とライフタイムのエラーを説明する際にこの直感を活用することを提案する。可能な範囲で、すべてのエラーを次の 3 つの点で説明することを試みる:

<!--
- The point where the borrow occurred (B).
- The point where the resulting reference is used (U).
- An intervening point that might have invalidated the reference (A).
-->
- 借用が発生した点 (B)
- 参照が使用される点 (U)
- 参照を無効化する必要がある可能性のある介入点 (A)

<!--
We should select three points such that B can reach A and A can reach U.
In general, the approach is to describe the errors in "narrative" form:
-->
B から A に到達し、さらに A から U に到達できるようにこれら 3 つの点を選ぶ必要がある。一般的には、このアプローチは次のような「物語」形式でエラーを説明する:

<!--
- First, value is borrowed occurs.
- Next, the action occurs, invalidating the reference.
- Finally, the next use occcurs, after the reference has been invalidated.
-->
- まず、値の借用が生じる。
- 次に、動作が生じ、参照が無効化される。
- 最後に、参照が無効化された後に次の使用が生じる。

<!--
This approach is similar to what we do today, but we often neglect to mention this third point, where the next use occurs.
Note that the "point of error" remains the *second* action -- that is, the error, conceptually, is to perform an invalidating action in between two uses of the reference (rather than, say, to use the reference after an invalidating action).
This actually reflects the definition of undefined behavior more accurately (that is, performing an illegal write is what causes undefined behavior, but the write is illegal because of the latter use).
-->
このアプローチは現在のものと類似しているが、次の使用が発生する 3 つめの点についてはしばしば無視している。ここで、エラーの点は *2 番目*の動作のままであることに注意されたい -- すなわち概念的には、このエラーは（無効化動作の後に参照を使用していることではなく）参照を使用する 2 点の間で無効化動作が実行されるということである。これは、実際には未定義動作の定義をより正確に反映している（つまり、不正な書き込みの実行は未定義動作を引き起こすが、書き込みが不正となる原因は後で（参照を）使用していることである）。

<!--
To see the difference, consider this erroneous program:
-->
この違いを見るため、次のようなエラーを含むプログラムを考える:

```rust
fn main() {
    let mut i = 3;
    let x = &i;
    i += 1;
    println!("{}", x);
}
```

<!--
Currently, we emit the following error:
-->
現在は、次のようなエラーが出力される:

```
error[E0506]: cannot assign to `i` because it is borrowed
 --> <anon>:4:5
   |
 3 |     let x = &i;
   |              - borrow of `i` occurs here
 4 |     i += 1;
   |     ^^^^^^ assignment to borrowed `i` occurs here
```

<!--
Here, the points B and A are highlighted, but not the point of use U.
Moreover, the "blame" is placed on the assignment.
Under this RFC, we would display the error as follows:
-->
ここで点 B と A についてはハイライトされるが、U についてはそうではない。さらに、ここでの「言及」は代入に着目している。本 RFC の下では、出力されるエラーは次のようになる:

```
error[E0506]: cannot write to `i` while borrowed
 --> <anon>:4:5
   |
 3 |     let x = &i;
   |              - (shared) borrow of `i` occurs here
 4 |     i += 1;
   |     ^^^^^^ write to `i` occurs here, while borrow is still active
 5 |     println!("{}", x);
   |                    - borrow is later used here
```

<!--
Another example, this time using a `match`:
-->
他の例として、次のような `match` を使用した場合を考える:

```rust
fn main() {
    let mut x = Some(3);
    match &mut x {
        Some(i) => {
            x = None;
            *i += 1;
        }
        None => {
            x = Some(0); // OK
        }
    }
}
```

<!--
The error might be:
-->
エラーは次のようになる:

```
error[E0506]: cannot write to `x` while borrowed
 --> <anon>:4:5
   |
 3 |     match &mut x {
   |           ------ (mutable) borrow of `x` occurs here
 4 |         Some(i) => {
 5 |              x = None;
   |              ^^^^^^^^ write to `x` occurs here, while borrow is still active
 6 |              *i += 1;
   |              -- borrow is later used here
   |
```

<!--
(Note that the assignment in the `None` arm is not an error, since the borrow is never used again.)
-->
（借用が再び用いられることがないため、`None` 腕内での代入はエラーではないことに注意されたい。）

<!--
## Some special cases
-->
## いくつかの特殊なケース

<!--
There are some cases where the three points are not all visible in the user syntax where we may need some careful treatment.
-->
ユーザの構文で 3 つの点が表示されず、注意深い処置が必要となる場合が存在する。

<!--
### Drop as last use
-->
### Drop as last use

<!--
There are times when the last use of a variable will in fact be its destructor.
Consider an example like this:
-->
変数が最後に使用されるのがデストラクタであるような場合。次のような例を考える:


```rust
struct Foo<'a> { field: &'a u32 }
impl<'a> Drop for Foo<'a> { .. }

fn main() {
    let mut x = 22;
    let y = Foo { field: &x };
    x += 1;
}
```

<!--
This code would be legal, but for the destructor on `y`, which will implicitly execute at the end of the enclosing scope.
The error message might be shown as follows:
-->
このコードは正当であるが、`y` のデストラクタは囲まれているスコープの終わりで暗黙的に呼び出される。エラーメッセージは次のように表示されるだろう:

```
error[E0506]: cannot write to `x` while borrowed
 --> <anon>:4:5
   |
 6 |     let y = Foo { field: &x };
   |                          -- borrow of `x` occurs here
 7 |     x += 1;
   |     ^ write to `x` occurs here, while borrow is still active
 8 | }
   | - borrow is later used here, when `y` is dropped
```

<!--
### Method calls
-->
### メソッドの呼び出し

<!--
One example would be method calls:
-->
ある例はメソッドの呼び出しである:

```rust
fn main() {
    let mut x = vec![1];
    x.push(x.pop().unwrap());
}
```

<!--
We propose the following error for this sort of scenario:
-->
この種のシナリオでは、次のようなエラーを提案する:

```
error[E0506]: cannot write to `x` while borrowed
 --> <anon>:4:5
   |
 3 |     x.push(x.pop().unwrap());
   |     - ---- ^^^^^^^^^^^^^^^^
   |     | |    write to `x` occurs here, while borrow is still in active use
   |     | borrow is later used here, during the call
   |     `x` borrowed here
```

<!--
If you are not using a method, the error would look slightly different, but be similar in concept:
-->
メソッドを使用しない場合、エラーは若干異なるものとなるがコンセプトは似たようなものとなる:

```
error[E0506]: cannot assign to `x` because it is borrowed
 --> <anon>:4:5
   |
 3 |     Vec::push(&mut x, x.pop().unwrap());
   |     --------- ------  ^^^^^^^^^^^^^^^^
   |     |         |       write to `x` occurs here, while borrow is still in active use
   |     |         `x` borrowed here
   |     borrow is later used here, during the call
```

<!--
We can detect this scenario in MIR readily enough by checking when the point of use turns out to be a "call" terminator.
We'll have to tweak the spans to get everything to look correct, but that is easy enough.
-->
使用ポイントが「呼び出し」であることが判明したときにチェックすることで、このシナリオは MIR 側で容易に検出することが出来る。すべてを正確に見せるためにスパンの調整が必要となるが、それは十分簡単なものである。

<!--
### Closures
-->
### クロージャ

<!--
As today, when the initial borrow is part of constructing a closure, we wish to highlight not only the point where the closure is constructed, but the point *within* the closure where the variable in question is used.
-->
今日のように、最初の借用がクロージャ構築の一部だった場合、クロージャの構築される点のみでなく問題の変数が使用されるクロージャ*内*の点も強調したい。

<!--
## Borrowing a variable for longer than its scope
-->
## スコープより長い変数の借用

<!--
Consider this example:
-->
次の例を考える:

```rust
let p;
{
    let x = 3;
    p = &x;
}
println!("{}", p);
```

<!--
In this example, the reference `p` refers to `x` with a lifetime that exceeds the scope of `x`.
In short, that portion of the stack will be popped with `p` still in active use.
In today's compiler, this is detected during the borrow checker by a special check that computes the "maximal scope" of the path being borrowed (`x`, here).
This makes sense in the existing system since lifetimes and scopes are expressed
in the same units (portions of the AST).
In the newer, non-lexical formulation, this error would be detected somewhat differently.
As described earlier, we would see that a `StorageDead` instruction frees the slot for `x` while `p` is still in use.
We can thus present the error in the same "three-point style":
-->
この例では、参照 `p` は `x` のスコープを超えるライフタイムで `x` を指している。要は、 `p` がまだアクティブに使用されている間にスタックの一部分がポップされる。今日のコンパイラでは、これは借用チェック中に借用されているパス（今回は `x`）の「最大スコープ」を計算することで特別にチェックされている。これはライフタイムとスコープが（AST の）同じ単位となるため、現状のシステムにおいて理にかなっている。新しいノンレキシカルな方式では、このエラーは少し異なったかたちで検出される。先述したように、 `p` がまだ使用されている間に `StrageDead` 命令によって `x` のスロットが解放される。したがって、（上の例と）同じように「3点方式」でエラーを表示することができる:

```
error[E0506]: variable goes out of scope while still borrowed
 --> <anon>:4:5
   |
 3 |     p = &x;
   |          - `x` borrowed here
 4 | }
   | ^ `x` goes out of scope here, while borrow is still in active use
 5 | println!("{}", p);
   |                - borrow used here, after invalidation
```

<!--
## Errors during inference
-->
## 推論中のエラー

<!--
The remaining set of lifetime-related errors come about primarily due to the interaction with function signatures.
For example:
-->
ライフタイムに関連した残りのエラーのセットは、主に関数のシグネチャとの相互作用に起因したものである。
例:

```rust
impl Foo {
    fn foo(&self, y: &u8) -> &u8 {
        x
    }
}
```

<!--
We already have work-in-progress on presenting these sorts of errors in a better way (see [issue 42516] for numerous examples and details), all of which should be applicable here.
In short, the name of the game is to identify patterns and suggest changes to improve the function signature to match the body (or at least diagnose the problem more clearly).
-->
この種のエラーをより良い方法で提示するための作業はすでに進行中であるが（多くの例と詳細は [issue 42516] を参照されたい）、それらはすべてここで適用が可能となるべきである。要は、最も重要なことはパターンを識別し、関数シグネチャを本体にマッチさせるよう改善させるための変更点を提示することである（あるいは、少なくとも問題をより明白に診断する）。

[issue 42516]: https://github.com/rust-lang/rust/issues/42516

<!--
Whenever possible, we should leverage points in the control-flow and try to explain errors in "narrative" form.
-->
可能であれば、制御フローグラフ内の点を活用し、「説明」形式でエラーを表示するべきである。

<!--
# Drawbacks
-->
# 欠点
[drawbacks]: #drawbacks

<!--
There are very few drawbacks to this proposal.
The primary one is that the **rules** for the system become more complex.
However, this permits us to accept a larger number of programs, and so we expect that **using Rust** will feel simpler.
Moreover, experience has shown that -- for many users -- the current scheme of tying reference lifetimes to lexical scoping is confusing and surprising.
-->
本提案における欠点は非常に僅かなものである。主なものは、（借用）システムの **規則** がより複雑になることである。しかし、この規則により多くのプログラムを受け入れることが可能になるため、**Rust を使用する**ことがより簡単になると期待できる。さらに言えば、（多くのユーザにとって）参照のライフタイムをレキシカルスコープに紐付ける現在の方針は混乱し意外なものであるということが経験的に示されている。

<!--
# Alternatives
-->
# 代替案
[alternatives]: #alternatives

<!--
### Alternative formulations of NLL
-->
### NLL の他の定式化

<!--
During the runup to this RFC, a number of alternate schemes and approaches to describing NLL were tried and discarded.
-->
本 RFC の立ち上げの間、NLL を記述するためのいくつかの代替案とアプローチが施行され、破棄された。

<!--
**RFC 396.**
[RFC 396][] defined lifetimes to be a "prefix" of the dominator tree -- roughly speaking, a single-entry, multiple-exit region of the control-flow graph.
Unlike our system, this definition did not permit gaps or holes in a lifetime.
Ensuring continuous lifetimes was meant to guarantee soundness; in this RFC, we use the liveness constraints to achieve a similar effect.
This more flexible setup allows us to handle cases like Problem Case #3, which RFC 396 would not have accepted.
RFC 396 also did not cover dropck and a number of other complications.
-->
**RFC 396。**
[RFC 396][] では、ライフタイムを支配木 (dominator tree) の「プレフィックス」と定義している（大まかに言うと、制御フローグラフの単一入力な複数出口を持つリージョンである）。本 RFC とは異なり、この定義ではライフタイムにギャップや穴が存在することが許されなかった。継続的なライフタイムの保証は、健全性 (soundness) を保証することを意図したものであった; 本 RFC では生存性制約を用いることで同様の効果が得られる。このより柔軟な設定により、RFC 396 では受け入れられなかった問題例 #3 のような場合を処理することが出来る。また RFC 396 では、dropck と他の多くの合併症をカバーしていなかった。

<!--
**SSA or SSI transformation.**
Rather than incorporating the "current location" into the subtype check, we also considered formulations that first applied an SSA transformation to the input program, and then gave each of those variables a distinct type.
This does allow some examples to type-check that wouldn't otherwise, but it is not flexible enough for the `vec-push-ref` example covered earlier.
-->
**SSA/SSI 変換。**
部分型のチェックに「現在位置」を組み込むのではなく、まず入力されたプログラムに SSA 変換を適用し、その後これらの変数にそれぞれ異なる型を与えるものも考慮された。これは実際、ここにはない場合の型チェックの例のいくつかを可能にするが、前に述べた vec-push-ref の例に対しては十分柔軟ではない。

<!--
Using SSA also introduces other complications.
Among other things, Rust permits variables and temporaries to be borrowed and mutated　indirectly (e.g., via `&mut`).
If we were to apply SSA to MIR in a naive fashion, then, it would ignore these assignments when creating numberings.
For example:
-->
SSA の使用は他の合併症も引き起こす。とりわけ、Rust は変数および一時変数を（例えば `&mut` を介して）間接的に借用し変更することを許可している。素朴な方法で MIR に SSA を適用する場合、（SSA の）ナンバリングをする際にこれらの代入を無視してしまう。
例:

```rust
let mut x = 1;      // x0, has value 1
let mut p = &mut x; // p0
*p += 1;
use(x);             // uses `x0`, but it now has value 2
```

<!--
Here, the value of `x0` changed due to a write from `p`.
Thus this is not a true SSA form.
Normally, SSA transformations achieve this by making local variables like `x` and `p` be pointers into stack slots, and then lifting those stack slots into locals when safe.
MIR was intentionally not done using SSA form precisely to avoid the need for such contortions (we can leave that to the optimizing backend).
-->
ここで、 `x0` の値は `p` から書き込まれることで変更される。したがって、これは真の SSA 形式ではない。通常の SSA 変換では、`x` や `p` のようなローカル変数をスタックスロットへのポインタにし、安全なときにこれらのスタックスロットをローカルに持ち上げることでこれを実現する。そのような捻じ曲げの必要性を避けるため、MIR では意図的に SSA 形式を用いなかった（これは最適化のバックエンドに任せることが出来る）。

<!--
**Type per program point.**
Going further than SSA, one can accommodate `vec-push-ref` through a scheme that gives each variable a distinct type at each point in the CFG (similar to what Ericson2314 describes in the [stateful MIR for Rust][smr]) and applies transformations to the lifetimes on every edge.
During the rustc design sprint, the compiler team also enumerated such a design.
The author believes this RFC to be a roughly equivalent analysis, but with an alternative, more familiar formulation that still uses one type per variable (rather than one type per variable per point).
-->
**プログラムの点ごとの型。**
SSA をさらに進め、CFG の各点において各変数に異なる型を与え（これは Ericson2314 が [stateful MIR for Rust][smr] で説明しているものと類似する）エッジ毎のライフタイムに変換する方針を取ることで、vec-push-ref の例に対処することが出来る。rustc 設計のスプリントの間、コンパイラチームでもそのような設計が列挙された。筆者は、本 RFC がほぼ等価な分析であると考えているが、それは（各変数・各点ごとに一つの型を割り当てるのではなく）各変数ごとに一つの型を継続して用いる、代替的でより使い慣れた手法となっている。

<!--
There are several advantages to the design enumerated here.
For one thing, it involves far fewer inference variables (if each variable has many types, each of those types needs distinct inference variables at each point) and far fewer constraints (we don't need constraints just for connecting the type of a variable between distinct points).
It is also a more natural fit for the surface language, in which variables have a single type.
-->
ここで列挙した設計にはいくつかの利点がある。その一つは、推論すべき変数はるかに少なくなること（各変数に多くの型を割り当てる場合、それぞれの型で異なる変数を推論する必要がある）、および制約がはるかに少なくなること（それらの異なる型を接続するための制約は必要なくなる）である。また変数が単一の型を持つため、より自然に表面の言語（訳注：AST）に適合する。

<!--
### Different "lifetime roles"
-->
### 異なる「ライフタイムの役割」

<!--
In the discussion about nested method calls ([RFC 2025], and the discussions that led up to it), there were various proposals that were aimed at accepting the naive desugaring of a call like `vec.push(vec.len())`:
-->
ネストしたメソッド呼び出しに関する議論（[RFC 2025] および採択までのもの）では、`vec.push(vec.len())` のような呼び出しのナイーブな脱糖を受け入れるための様々な提案がなされた。

```rust
let tmp0 = &mut vec;
let tmp1 = vec.len(); // does a shared borrow of vec
Vec::push(tmp0, tmp1);
```

<!--
The alternatives to RFC 2025 were focused on augmenting the type of references to have distinct "roles" -- the most prominent such proposal was `Ref2<'r, 'w>`, in which mutable references change to have two distinct lifetimes, a "read" lifetime (`'r`) and a "write" lifetime (`'w`), where read encompasses the entire span of the reference, but write only contains those points where writes are occuring.
This RFC does not attempt to change the approach to nested method calls, rather continuing with the RFC 2025 approach (which affects only the borrowck handling).
However, if we did wish to adopt a `Ref2`-style approach in the future, it could be done backwards compatibly, but it would require modifying (for example) the liveness requirements.
For example, currently, if a variable `x` is live at some point P, then all lifetimes in the type of `x` must contain P -- but in the `Ref2` approach, only the read lifetime would have to contain P.
This implies that lifetimes are treated differently depending on their "role".
It seems like a good idea to isolate such a change into a distinct RFC.
-->
RFC 2025 に対する代替案では、異なる「役割」を持つ参照型を増やすことに焦点が当てられている。このような提案のうち著名なのが `Ref2<'r, 'w>` である。これは可変リファレンスが「読み込み」(`'r`) と「書き込み」(`'w`) の区別された2つのライフタイムを持つよう変更され、読み込みは参照の範囲全体を含むが書き込みはそれが発生する点のみを含むというものである。本 RFC ではネストしたメソッド呼び出しへのアプローチは変更せず、むしろ RFC 2025 のアプローチ（これは borrowck の処理にのみ影響する）を継続している。しかし、将来的に "Ref2" 形式のアプローチを採用したい場合、後方互換性を維持することは可能だが、（例えば）生存性に関する要件を修正する必要が生じる可能性がある。例えば、現在では変数 `x` がある点 P で生存している場合、`x` の型内のすべてのライフタイムは P を含む必要がある。しかし `Ref2` のアプローチでは、読み込みに関するライフタイムのみが P を含んでいれば良い。これは、ライフタイムがその「役割」によって異なった扱いを受けることを意味する。このような変更は、独立した RFC に分離するのがよいだろう。

<!--
# Unresolved questions
-->
# 未解決問題
[unresolved]: #unresolved-questions

<!--
None at present.
-->
現在はない。

<!--
# Appendix: What this proposal will not fix
-->
# 付録: 本提案で修正しないもの

<!--
It is worth discussing a few kinds of borrow check errors that the current RFC will **not** eliminate.
These are generally errors that cross procedural boundaries in some form or another.
-->
本 RFC で除去されることの **ない** 借用チェックのエラーの種類を議論することは価値がある。これらは、いくつかの手続き的な境界をまたぐ一般的なエラーである。

<!--
**Closure desugaring.**
The first kind of error has to do with the closure desugaring.
Right now, closures always capture local variables, even if the closure only uses some sub-path of the variable internally:
-->
**クロージャの脱糖。**
最初の種類のエラーは、クロージャの脱糖に関連したものである。現在、クロージャは、内部的には変数のサブパスを用いる場合でも常にローカル変数をキャプチャする:

```rust
let get_len = || self.vec.len(); // borrows `self`, not `self.vec`
self.vec2.push(...); // error: self is borrowed
```

<!--
This was discussed on [an internals thread][tc].
It is possible to fix this [by making the closure desugaring smarter][cc].
-->
これは[内部スレッド][tc]で議論された。[クロージャの脱糖をより賢くすることで][cc]この問題を修正できる可能性がある。

[tc]: https://internals.rust-lang.org/t/borrow-the-full-stable-name-in-closures-for-ergonomics/5387
[cc]: https://internals.rust-lang.org/t/borrow-the-full-stable-name-in-closures-for-ergonomics/5387/11?u=nikomatsakis

<!--
**Disjoint fields across functions.**
Another kind of error is when you have one method that only uses a field `a` and another that only uses some field `b`; right now, you can't express that, and hence these two methods cannot be used "in parallel" with one another:
-->
**関数をまたいで分離したフィールド。**
他の種類のエラーは、フィールド `a` のみを用いるメソッドと `b` のみを用いるメソッドがある場合である; 現在はそれを表現することは出来ないため、これら2つのメソッドは互いに「並行して」用いることは出来ない:

```rust
impl Foo {
    fn get_a(&self) -> &A { &self.a }
    fn inc_b(&mut self) { self.b.value += 1; }
    fn bar(&mut self) {
        let a = self.get_a();
        self.inc_b(); // Error: self is already borrowed
        use(a);
    }
}
```

<!--
The fix for this is to refactor so as to expose the fact that the methods operate on disjoint data.
For example, one can factor out the methods into methods on the fields themselves:
-->
これに対する修正は、メソッドがそれぞれ分離したデータを操作するという事実を明確にするためにリファクタリングすることである。例えば、上のメソッドは次のようにフィールド自身のメソッドに分離することが出来る:

```rust
fn bar(&mut self) {
    let a = self.a.get();
    self.b.inc();
    use(a);
}
```

<!--
This way, when looking at `bar()` alone, we see borrows of `self.a` and `self.b`, rather than two borrows of `self`.
Another technique is to introduce "free functions" (e.g., `get(&self.a)` and `inc(&mut self.b)`) that expose more clearly which fields are operated upon, or to inline the method bodies.
This is a non-trivial bit of design and is out of scope for this RFC.
See [this comment on an internals thread][cpb] for further thoughts.
-->
ここでは、`bar()` のみを見ると `self` の借用が2つあるのではなく `self.a` と `self.b` それぞれの借用がされている。もう一つの方法は、どのフィールドが操作されているのかをより明確に示す（`get(&self.a)` や `inc(&mut self.b)` などの）「フリー関数」を導入するか、メソッドをインライン化することである。
これは設計における重要な点ではなく、本 RFC の対象外である。より進んだ思索については[内部スレッド内のこのコメント][cpb]を参照されたい。

[cpb]: https://internals.rust-lang.org/t/partially-borrowed-moved-struct-types/5392/2

<!--
**Self-referential structs.**
The final limitation we are not fixing yet is the inability to have "self-referential structs".
That is, you cannot have a struct that stores, within itself, an arena and pointers into that arena, and then move that struct around.
This comes up in a number of settings.
There are various workarounds: sometimes you can use a vector with indices, for example, or [the `owning_ref` crate](https://crates.io/crates/owning_ref).
The latter, when combined with [associated type constructors][ATC], might be an adequate solution for some uses cases, actually (it's basically a way of modeling "existential lifetimes" in library code).
For the case of futures especially, [the `?Move` RFC][?Move] proposes another lightweight and interesting approach.
-->
**自己参照を持つ構造体。**
我々がまだ修正していない最後の制限は、"自己参照を持つ構造体"を持つことが出来ないことである。
すなわち、それ自身の中に　Arena とその Arena へのポインタを保持し、それを移動するような構造体を持つことは出来ない。これは、いくつかの設定で見られる。これに対しては様々な回避策が存在する; いくつかの場合でインデックス付きのベクトルを用いることが出来る。あるいは、[`owning_ref` クレート](https://crates.io/crates/owning_ref) を用いることが出来る。後者は、[関連型コンストラクタ][ATC]と組み合わせることで、いくつかの場合に適切な解決策となる可能性がある（実際には、これはライブラリのコードにおける「実存的なライフタイム」をモデリングするための基本的な方法である）。特殊な場合においては、特に[`?Move` RFC][?Move] が軽量かつ興味深いアプローチを提案している。

[?Move]: https://github.com/rust-lang/rfcs/pull/1858

<!--
# Endnotes
-->
# 注釈

<!-- <a name="temporaries"></a> -->

<!--
**1.** Scopes always correspond to blocks with one exception: the scope of a temporary value is sometimes the enclosing statement.
-->
**1.** スコープはある例外を除き、常にブロックに対応する：一時的な値のスコープは、それを囲むステートメントとなる場合がある。

[RFC 396]: https://github.com/rust-lang/rfcs/pull/396
[RFC 2025]: https://github.com/rust-lang/rfcs/pull/2025
[smr]: https://github.com/Ericson2314/a-stateful-mir-for-rust
[10520]: https://github.com/rust-lang/rust/issues/10520
[ATC]: https://github.com/rust-lang/rfcs/pull/1598
