---
title: NLLのソースコードを読む (1)
published: 2017-12-03T23:46:22Z
tags: [ "rust", "nll" ]
categories: [ "programming" ]
---

本記事は [Rust Internal Advent Calendar 2017][adc] 第3日目の記事です．

[adc]: https://qiita.com/advent-calendar/2017/rust-internal

前回は NLL 全体の処理の流れを概観した．以降，各処理をソースコードを見ながら見ていきたいと思う．

<!-- more -->

繰り返しになるが，本記事で参照している実装は実験的なものであり，安定版までその内容が引き継がれる保証はないことに注意されたい．

なお簡単のため，しばらく関数の引数・戻り値に現れるライフタイムパラメータやクロージャのキャプチャ変数に関する処理は無視することにする．これは，RFC における Layer1 のみを視野に入れることを意味する．

# `RegionInferenceContext`
モジュール `nll::infer_regions` で定義されているのが，NLL 全体のコンテキストを保持する `RegionInferenceContext` である．今回の分析で主要なフィールドは以下の通りである．

* `inferred_values` - リージョン推論変数の計算結果
* `liveness_constraints` - 生存性 (liveness) 制約
* `constraints` - outlive 制約

生存性制約は `('a: {P}) @ P`の形で与えられ，ライフタイム `'a` が点 P で生存していることを意味する．outlive 制約は `('a: 'b) @ P` の形で与えられ，部分型付け制約および再借用制約から導かれる．これらの制約の詳細は [RFC] を参照されたい．

[RFC]: https://ubnt-intrepid.github.io/blog/rfc-2094-ja

生存性制約と outlive 制約でフィールドが独立しているのは，（RFC 内で言及されているように）前者が単にリージョン推論変数への点の挿入に置き換えることが可能であるためである．実際，あとで説明するように `liveness_constraints` の値が推論変数の初期値としてそのまま用いられる．

`liveness_constraints` の型は `infer_regions::value` で定義された `RegionValues` である．これは，次のように各リージョンの推論変数に含まれる CFG 内の点を格納する（この際， `BitMatrix` を用いた空間効率の良い表現が用いられている）．

```rust
pub(super) struct RegionValues {
    elements: Rc<RegionValueElements>,
    matrix: BitMatrix,
}
```

`RegionValueElements` は，`Mir` 側の位置情報 `Location` と `RegionValues` 内で保持される形式との対応関係を保持するために用いられる（詳細は省略）．

一方 `constraints` の型は `Vec<Constrsints>` であり，これは次のように単に outlive 制約をデコードしたものとなる（`RegionVid` は推論されるリージョンの識別子）．エラー発生時のメッセージ出力のため，制約が作られるコードのスパンが保持されることに注意されたい．

```rust
// 'sup: 'sub @ point
pub struct Constraint {
    sup: RegionVid,
    sub: RegionVid,
    point: Location,
    span: Span,
}
```

これらの制約はメソッド `add_live_point` および `add_outlives` を用いて `RegionInferenceContext` に登録される．MIR から制約を生成し登録する部分の詳細は次回以降に行う．

# 推論アルゴリズム
上で登録した制約をもとにライフタイムの推論を実行するのが，メソッド `solve()` である．この中では，概ね次のことを行っている．

* 各リージョンの点集合を固定点反復で求める （`propagate_constraints()`）
* universal region （関数のシグネチャに現れるライフタイム）の確認
* クロージャの場合は，キャプチャされている外部変数を確認する

後者2つについては，今回は説明を省略する．

固定点反復を実行するリージョン推論の核となる処理がメソッド  `propagate_constraints()` である．デバッグ出力などの詳細を省略すると，この実装は次のようになっている．

```rust
fn propagate_constraints(&mut self, mir: &Mir<'tcx>) {
    let mut changed = true;

    // 各リージョンの初期値は生存性制約で追加された点を使用する
    let mut inferred = self.liveness_constraints.clone();

    while changed {
        changed = false;
        for c in &self.constraints {
            // outlive 制約を満たすよう sup を更新する
            // 引数の順序が Constraint の定義と異なることに注意
            let added = self.copy(
                &mut inferred,
                mir,
                c.sub,
                c.sup,
                c.point,
            );
            // c.sup への点の追加がある場合は計算を続行する
            if added {
                changed = true;
            }
        }
    }

    // 推論結果をセット
    self.inferred_values = Some(inferred);
}
```

上では，指定した outlive 制約を満たすよう点を追加するためにメソッド `copy()` を呼び出している．このメソッドでは，点 `c.point` を始点として `mir` 内を（深さ優先探索で）走査し，それぞれの点が `c.sub` に含まれていればそれを `c.sup` に追加していく．

このメソッドの実装は次のようになる．簡単のため universal region に関する処理を削除しており，実際のものとは若干異なることに注意されたい．

```rust
fn copy(
    &self,
    inferred: &mut RegionValues,
    mir: &Mir<'tcx>,
    from_region: RegionVid,
    to_region: RegionVid,
    constraint_point: Location,
) -> bool {
    let mut changed = false;

    let mut stack = vec![];
    let mut visited = FxHashSet();

    // 始点を探索候補に追加する
    stack.push(constraint_point);

    while let Some(p) = stack.pop() {
        // 点が from_region に含まれているかどうかを確認する
        // 含まれなければ from_region はその点で「死んでいる」ことを意味し，それ以降のフローを見る必要はない
        // その場合は，探索点をスタックに戻さず破棄して次の探索に移る
        let i = self.elements.index(p);
        if !inferred.contains(from_region, i) {
            continue;
        }

        // 探索済みであればそのブランチの探索を終える（ループ対策）
        if !visited.insert(p) {
            continue;
        }

        // to_region に点を追加する
        let new = inferred_values.add(to_region, point_index);
        changed |= new;

        // 後続点をスタックに追加する
        // 基本ブロックの探索が完了していない場合は直近の点を，
        // そうでなければ端点から伸びるエッジから次の基本ブロックの始点を集める
        let block_data = &mir[p.block];
        let successor_points = if p.statement_index < block_data.statements.len() {
            vec![
                Location {
                    statement_index: p.statement_index + 1,
                    ..p
                },
            ]
        } else {
            block_data
                .terminator()
                .successors()
                .iter()
                .map(|&basic_block| {
                    Location {
                        statement_index: 0,
                        block: basic_block,
                     }
                })
                .collect::<Vec<_>>()
        };
        stack.extend(successor_points);
    }
    changed
}
```

これらを見るとわかるように，一度 MIR (CFG) とそこから得られる制約の集合が得られればリージョン推論は比較的単純なプロセスで計算することができる．また `copy()` で追加される点はすでに他のリージョンに含まれている点のみであり，生存性制約に含まれない点（すなわち，変数の型の中に明示的に含まれているライフタイムが「死んでいる」点）はこのアルゴリズム中に追加されることはないことに注意されたい．

計算されたリージョンの推論変数は CFG 内の点集合となり，その点においてライフタイムに紐付いた借用が有効である必要があることを意味している．

# おわりに
今回は，リージョン推論のために使用される制約の表現と，それらをもとにどのように推論が実行されるのかを見た．次回は，これらの制約が具体的にどのように MIR から生成されるのかを見ることにする．