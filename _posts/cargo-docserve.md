+++
title = "cargo でドキュメント生成とサーバ起動を行うコマンドを作った"
date = "2018-08-24"

[taxonomies]
tags = [ "rust", "announce", "qiita" ]
categories = [ "programming" ]
+++

WSL や仮想環境、VPS上で作業をする場合、`cargo doc --open` が使用できないので何かしらの手段で `target/doc` 内のコンテンツを配信する Web サーバを起動する必要があります。この手の簡易 HTTP サーバは探せばいくらでも出てくるのですが、`cargo doc` と組み合わせてコマンド一発で実行したかったので、`cargo` サブコマンド作成の練習がてらドキュメント生成とサーバが一つにまとまったコマンドを作ってみました。

<!-- more -->

https://github.com/ubnt-intrepid/cargo-docserve

現段階では次の機能を実装しています。

* ドキュメント生成後、`target/doc` 内のコンテンツを配信する HTTP サーバを起動する
* （`--watch` オプションをつけると）`src/` 内のファイル変更を監視しドキュメントの再生成とサーバの再起動を自動で行う

※ 正直言うと `cargo-watch` を使えばいい話なのですが、たまにサーバのプロセスが終了せず残ったりすることがあったので現在使用していません…

# 使い方

GitHub にソースコードを置いているので、`--git` オプションを用いて直接バイナリをインストールします。
`cargo` クレートに依存しているため `cmake` や `openssl` などがないとインストールに失敗する可能性があります。

```shell-session
$ cargo install --git https://github.com/ubnt-intrepid/cargo-docserve.git
```

`cargo docserve` と実行すると、ドキュメントを生成したあとHTTPサーバが起動します。ルートディレクトリに `target/doc` をルートにマウントした状態でサーバが起動します。

```shell-session
$ cargo docserve --host 127.0.0.1 --port 8000
...
    Docserve Generating the documentation
 Documenting cargo-docserve v0.0.1 (file:///home/ubnt-intrepid/work/ubnt-intrepid/cargo-docserve)
    Finished dev [unoptimized + debuginfo] target(s) in 1.86s
    Docserve Starting HTTP server listening on http://127.0.0.1:8000
```

`--watch` オプションをつけることで、`src/` 以下のファイルが更新されたときにドキュメント生成とサーバの再起動を行うようにできます。イベント通知用のクレートは [`notify`](https://crates.io/crates/notify) を使用しました。

```shell-session
$ cargo docserve --watch
```

# 反省点、今後の改善案など
* `cargo` に依存してしまっているのでビルドが面倒
* イベント検知後の処理が「HTTPサーバのシャットダウン → ドキュメントの再生成 → サーバの再起動」と雑

# See also

* [`cargo-docserve`](https://crates.io/crates/cargo-docserve)
* [`cargo-docserver`](https://crates.io/crates/cargo-docserver)

# Appendix: nightly でのドキュメント生成について
nightly 版の rustdoc を使用する場合、`mio` など一部のクレートで（クレート内で rustdoc の出す警告を lint error と解釈してしまい）ドキュメント生成が失敗することがあります[^1]。
おそらくこれは `cargo` のバージョンが `0.30.0` に更新されれば解決されますが、それまでは次のように `rustdoc` に渡すコマンドラインオプションを環境変数を介して設定することでドキュメントを生成することができます。

```shell-session
$ export RUSTDOCFLAGS="--cap-lints allow -Z unstable-features"
$ cargo docserve
```

[^1]: https://github.com/rust-lang/rust/issues/51468

