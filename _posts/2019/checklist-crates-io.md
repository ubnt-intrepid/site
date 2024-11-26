+++
title = "crates.io でクレートを公開する際に気をつけることリスト"
date = "2019-12-02"
tags = [ "rust", "crates.io", "qiita" ]
categories = [ "programming" ]
+++

自作クレートを公開するにあたり気をつけている点をまとめておきます。自己流なものが多いので、問題がある場合はコメントなどで指摘してもらえると助かります…

<!-- more -->

# `html_root_url` を設定する

`cargo doc` には依存しているクレートのドキュメントを生成しない `--no-deps` というオプションがあります。これを用いた場合、外部クレートで定義された構造体やトレイトへの定義へのリンクはそのクレートに指定された `#![doc(html_root = "...")]` という属性の値を使用します。この値が設定されていない場合は正しくリンクが設定されないため、クレート作者はこの属性を設定するよう努めるべきです。

指定する URL は自由ですが、通常は [docs.rs](https://docs.rs) で生成されるドキュメントのリンクを貼っておくのが良いでしょう。

```rust src/lib.rs
#![doc(html_root_url = "https://docs.rs/finchers/0.13.2")]
// ...
```

`docs.rs` を用いる場合に限りますが、指定する URL に含まれるクレートのバージョンは省略出来ないのでバージョンを上げる度に lib.rs を書き換える必要があります。後述する `cargo-release` を用いることで、バージョンアップ時に URL の書き換えを忘れるミスを減らすことが可能です。

# Lint レベルを細かく設定する

デフォルトでは無効になっている Lint を有効化しておくことで、より品質の高いコードに維持しておくことが出来ます。`rustc -W help` で使用可能な lint の一覧とデフォルトでの設定レベルを確認することが出来ます。また、いくつかの lint はグループ化されており、関連するもののレベルをまとめて設定することも可能です。
個人的によく用いているのは次の項目です。ドキュメント周りはサボりがちですが…

* `missing_docs`
* `missing_debug_implementations`
* `unused`
* `nonstandard_style`
* `rust_2018_idioms`

# `#![deny(warnings)]` を使わない

他の人が作ったクレートのソースコードを眺めていると、たまにこの属性を設定していることがあります。この属性は字面通りすべての警告を強制的にエラーへと昇格させるもので、警告が残っている修正を CI で弾くことが目的で挿入されていることが多いように思います。

しかしこの設定は、非推奨な API の呼び出しなど一時的に許容されうる警告に対しても適用されてしまいます。厄介なことにこの属性による影響は使用側のクレートから制御することが出来ないので、クレートの作者が警告に対処しバージョンを上げない限りそれに依存するすべてのクレートを使用することが出来なくなる事態を引き起こします。実際、非公式のデザインパターンをまとめたカタログではアンチパターンであると[明記されています](https://github.com/rust-unofficial/patterns/blob/master/anti_patterns/deny-warnings.md)。

`#[deny(warnings)]` を用いることなく警告をエラーに持ち上げる方法として、上述したガイドでは次のものを挙げています。

* 環境変数 `RUSTFLAGS` を用いる
  - `RUSTFLAGS="-D warnings" cargo build`
* lint ごとに個別でレベルを設定する

他にも `#![cfg_attr(test, deny(warnings))]` としてテスト時のみ警告をエラーに昇格させるという方法が考えられます。個人的なプロジェクトではこの方法を採用していますが、細かな lint の設定が出来ないのでもう少し良い方法がないか模索しているところです。

# 使用しているツール・サービスなど

## [WIP]
プルリクエストのタイトルやコミットメッセージに "WIP" や "do not merge" などの文字列を含んでいる場合にマージを禁止するための GitHub App です。GitLab に標準で搭載されている機能を実現するためのものですが、事故防止のためにインストールしておくと良いと思います。

## [`skeptic`]

Markdown ファイル内の Rust コードブロックのテストを実行するためのクレートです。詳細は以前書いた記事を参照して下さい。

* [mdbookで自作クレートのドキュメントをテストする - Qiita](https://qiita.com/ubnt_intrepid/items/134d8a03cdaa25225cd5)

## [`cargo-release`]

`cargo publish` に伴う一連の操作を自動化するためのサブコマンドです。大まかには、`cargo release (major|minor|patch)` を実行することで次の動作が自動的に実行されます。

1. `Cargo.toml` のバージョンを書き換え、その時点での差分をコミットする
2. `cargo publish` を実行し、クレートを公開する
3. （上を実行した時点での）コミットにリリースしたバージョン名のタグを貼る
4. 追加したコミットとタグをリモートリポジトリにプッシュする

リリース前にフックスクリプトを仕込むなど、リリース時の挙動に関する細かい設定も可能です。また `Cargo.toml` 以外のファイル（`src/lib.rs` や `README.md` など）内のバージョンを置き換える機能もあり、「リリース後に README 内のバージョンが古いままだったことに気づく」などといったミスを防ぐことが出来ます。

## [`cargo-husky`]

`cargo test` 実行時に `.git/hooks` へ自動的に hook をインストールしてくれるクレートです（[作者の @Linda_pp 氏による解説記事](https://rhysd.hatenablog.com/entry/2018/10/08/205041)）。`[dev-dependencies]` に依存関係を追加しておくだけで有効化することが出来るので、共同で開発しているプロジェクトに予防接種として追加しておくと良さそうです。

```toml Cargo.toml
[dev-dependencies]
cargo-husky = "1"
```

一つはまった点として、`user-hooks` を使用する際にユーザ定義スクリプトを修正しても `.git/hooks` に再インストールされないというものがありました。スクリプトを再インストールするためには `cargo-husky` 自体をビルドし直す必要があるので、例えば次のようなスクリプトを用意すると良いと思います。

```shell-session 
#!/bin/sh
cargo clean -p cargo-husky
cargo check -p cargo-husky
```

一度導入してしまえばフックスクリプトの書き換える自体が稀になるので、通常この問題に悩まされる必要はありません。しかしその分気づきにくい問題ではあるので、フックを導入し始めた初期はフックの更新が正しく行われているか注意したほうが良いのかもしれません。

## その他（未検証）
* [bors]

<!-- Links -->

[WIP]: https://github.com/apps/wip
[`skeptic`]: https://crates.io/crates/skeptic
[`cargo-release`]: https://crates.io/crates/cargo-release
[`cargo-husky`]: https://crates.io/crates/cargo-husky
[bors]: https://github.com/bors-ng/bors-ng

