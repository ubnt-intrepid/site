+++
title = "コンパイル時にツイートするマクロ"
date = "2017-10-20T22:37:29Z"

[taxonomies]
tags = [ "rust", "programming", "hobby" ]
categories = [ "programming" ]
+++

を作った。

<!-- more -->

{{ embedly(title="ubnt-intrepid/tweet-at-compile-time", url="https://github.com/ubnt-intrepid/tweet-at-compile-time") }}

# 使い方
※ compiler plugin を使用しているため nightly チャンネル必須

1. おもむろにクレートを作る
  ```command
  $ cargo new hoge --bin
  ```
2. 依存関係にプラグインを追加する
  ```command
  $ git clone https://github.com/ubnt-intrepid/tweet-at-compile-time.git tweet-at-compile-time
  ```
  ```toml
  [dependencies]
  tweet-at-compile-time = { path = "./tweet-at-compile-time/" }
  ```
3. Consumer Token, Consumer Secret, Access Token, Access Secret を手に入れ、`tweet-at-compile-time/keys` 以下に保存する
  ```command
  $ mkdir -p tweet-at-compile-time/keys
  $ echo xxxxx > tweet-at-compile-time/keys/consumer_key
  $ ...
  ```
4. `main.rs` を書き換える
  ```rust
  #![feature(plugin)]
  #![plugin(tweet_at_compile_time)]
  
  fn main() {
      tweet!("Hello!");
  }
  ```
5. コンパイルする
  ```command
  $ cargo build  # cargo run ではない点に注意
  ```

# 今後の展望
ネタなのでこれ以上手をかける気はないですが、トークンの読み込み周りが気に入らないのでそのうち直したい。
