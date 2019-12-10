+++
title = "NLLのソースコードを読む (0)"
date = 2017-12-02T18:12:06Z

[taxonomies]
tags = [ "rust", "nll", "reading" ]
categories = [ "programming" ]
+++

本記事は [Rust Internal Advent Calendar 2017][adc] 第2日目の記事です．

[adc]: https://qiita.com/advent-calendar/2017/rust-internal

RFC 読んだだけだと何やっているのかよくわからんので，実装を眺めながら理解を深めていこうと思います．

ソースは [こちら](https://github.com/nikomatsakis/rust/tree/3eb4284c35ff8c484699b753bcd924da62772b1e)（nll-master ブランチの最新版）をベースにします．
NLL は現在絶賛開発中なため，ここに記載されている内容は将来的に大幅に変更される可能性があることに注意して下さい（というか，まだ読んで良い状態なのかどうかすら分からないですが…）．

<!-- more -->

# NLL の実装状況について
[Issue #43234][tracking-issue] に開発状況がまとめられている．

[tracking-issue]: https://github.com/rust-lang/rust/issues/43234

# 読む

まず，NLL関連の実装は `src/librustc_mir/borrowcheck/nll` に配置されている（`rust-lang/rust` では `transform` 下にあったが移動したらしい）．このモジュールのトップレベルでは以下の関数が定義されている．

* `replace_regions_in_mir()`  
  後に NLL を計算するために必要な前処理
* `compute_regions()`  
  NLL の計算本体

これらは `borrow_check` のトップレベルで定義される `do_mir_borrowck()` 内で用いられ，コンパイル時に `-Znll` がセットされている場合に呼び出される．

借用チェック自体は従来の（レキシカルスコープベースの）ライフタイムと共通らしい．そちらのライフタイム推論を読めていないので後で確認する必要がある．

## `compute_regions()`
与えられた MIR を元に NLL の推論を行っているのがここである．
ここでは `RegionInferenceContext` のインスタンスを生成し，MIR を調査して必要な制約（RFC 2094 の Layer 1 で説明されているもの）を登録した後，メソッド `solve()` を呼び出すことで推論を実行する．
制約の登録に用いられているのが次の通り:

* `subtype_constraint_generation::generate()` - (位置認識型の）部分型付け制約
* `constraint_generation::generate()` - それ以外（生存性に基づく制約，再借用制約など）

これらの関数は，それぞれ内部で `RegionInferenceContext` のメソッドである `add_live_point()` と `add_outlives(span, sup, sub, point)` を呼び出し制約を登録する．
RFC 内で言及されているように， `add_live_point(v, p)` の実体は単にリージョン `v` に対し点 `p` を追加するのみである．一方 `add_outlives(span, sup, sub, point)` は `'a: 'b @P` の形で現れる制約を追加する（`span` はおそらくエラー表示のため）．

## `RegionInferenceContext::solve()`
`solve()` 内では，おおむね次のことを行っている．

1. 固定点反復に基づき各リージョンを計算 (`propagate_constraints()`）
2. 終端リージョンのチェック (`check_universal_region()`)

`RegionInferenceContext::solve()` 内で実質的に推論の計算（固定点反復）を実行しているのがメソッド `propagate_constraints()` である．この中では

1. 推論変数の初期化（ここでは `self.livenss_constraints` をコピーするだけ）
2. 変化がなくなるまで，制約を満たすように各リージョンに点を追加
3. 推論した結果を `self.inferred_values` に上書き

を行っている．

# おわりに
失速したので今回はここまで

