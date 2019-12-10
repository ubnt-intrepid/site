+++
title = "Tsukuyomi 0.5 -Yet Another Web Framework for Rust-"
date = 2018-12-22

[taxonomies]
tags = [ "rust", "announce", "qiita" ]
categories = [ "programming" ]
+++

先日、自作の Web アプリケーションフレームワークである Tsukuyomi の最新版である 0.5.0 を公開したのでその紹介です。

<!-- more -->

<div align="center">
    <a href="https://github.com/tsukuyomi-rs/tsukuyomi">
        <img src="https://tsukuyomi-rs.github.io/images/tsukuyomi-header.png"
             alt="header"
             style="width: 500px;">
    </a>
</div>

# Hello, Tsukuyomi

> `rustc 1.31` 以降のツールチェインを前提とします。

簡単な例として、単純に `"Hello, world."` と返す Web アプリケーションを作成します。まず、次のようにプロジェクトを初期化します。

```shell-session 
$ cargo new --bin hello_tsukuyomi
$ cd hello_tsukuyomi
$ cargo add tsukuyomi=0.5 tsukuyomi-server=0.2
```

`Cargo.toml` が次のようになっていることを確認してください。

```toml
# Cargo.toml
[package]
...
edition = "2018"

[dependencies]
tsukuyomi = "0.5"
tsukuyomi-server = "0.2"
```

さくっと書きます。

```rust
// src/main.rs
use {
    tsukuyomi::{
        App,
        config::prelude::*,
    },
    tsukuyomi_server::Server,
};

fn main() -> tsukuyomi_server::Result<()> {
    let app = App::create(
        path!("/")
            .to(endpoint::reply("Hello, world.\n"))
    )?;

    Server::new(app).run()
}
```

サーバを起動し、`http://127.0.0.1:4000` へのリクエストに対し所望のレスポンスが返されることを確認します。

```shell-session:run_server
$ cargo run
```

```shell-session:client
$ curl http://127.0.0.1:4000
Hello, world.
```

# Routing

`App::create` に `Config` を実装した型の値を渡すことで Web アプリケーションを構築します。
ルーティングを行う例は次のようになります。ここで `chain!()` は [`Chain`](https://docs.rs/tsukuyomi/0.5/tsukuyomi/util/struct.Chain.html) を作るためのヘルパーマクロです。

```rust
App::create(chain![
    // 経路の定義
    path!("/").to(
        endpoint::reply("Hello, world\n")
    ),

    // 指定したパスの経路が見つからなかったときに呼ばれるデフォルトの経路。
    path!("*").to(
        endpoint::reply(not_found)
    )

    // プレフィックス /api/v1/ を持つスコープの定義
    mount("/api/v1/").with(chain![

        // mount() はネスト可能
        mount("/posts").with(chain![

            // chain!() を用いて複数のエンドポイントを指定することができる。
            path!("/").to(chain![
                endpoint::get().reply("list_posts"), // <-- GET /api/v1/posts
                endpoint::post().reply("add_post"),  // <-- POST /api/v1/posts
                endpoint::reply("other methods"),    // <-- {PUT, DELETE, ...} /api/v1/posts
            ]),

            // パラメータ抽出の例。
            // セグメントの接頭辞を ':' にすることでセグメントをひとつ抽出するパラメータとなる
            // path!() に指定した文字列リテラル内のパラメータ数と
            // クロージャの引数の個数が異なる場合はコンパイルエラーになる
            path!("/:id").to(endpoint::call(|id: i32| {
                format!("get_post(id = {})", id)
            })),
        ]),
    ]),

    // セグメントの接頭辞を '*' にすることで複数個のセグメントを取り出すパラメータとなる。
    path!("/static/*path").to(
        endpoint::get().call(|path: PathBuf| {
            tsukuyomi::fs::NamedFile::open(path)
        })
    ),
])
```

# Extracting Data from Request

リクエストからのデータ抽出は、`Extractor` というトレイトを実装した型を用いて行います。
説明は省略しますが、次のようにデータを取り出すエンドポイントを記述することが出来ます。

```rust
#[derive(Debug, serde::Deserialize)]
struct NewPost {
    title: String,
    text: String,
    #[serde(default)]
    tags: Option<Vec<String>>,
}

let acquire_db_connection = { ... };

path!("/api/v1/posts").to(
    endpoint::get()
        .extract(extractor::body::json())
        .extract(acquire_db_connection)
        .call_async(|new_post: NewPost, conn: r2d2::PooledConnection<_>| {
            ...
        })
)
```

# Template

`tsukuyomi-askama` というクレートを用いることで、 [`askama::Template`] を実装している型をレスポンスに変換することが出来るようになります。テンプレートを有効化する方式としては[`IntoResponse` の実装を導出する方式](https://docs.rs/tsukuyomi-askama/0.2/tsukuyomi_askama/fn.into_respons.html)と[ミドルウェアによる形式](https://docs.rs/tsukuyomi-askama/0.2/tsukuyomi_askama/fn.renderer.html)の2つをサポートしています。前者を用いた例は次のようになります。

```rust
use tsukuyomi::output::IntoResponse;

#[derive(Template, IntoResponse)]
#[template(source = "hello, {{name}}", ext = "html")]
#[response(with = "tsukuyomi_askama::into_response")]
struct Index {
    name: String,
}

path!("/:name")
    .to(endpoint::call(|name| Index { name }))
    .modify(tsukuyomi_askama::renderer())
```

[`askama::Template`]: https://docs.rs/askama/0.7/askama/trait.Template.html

# WebSocket

`tungstenite` という WebSocket ライブラリを使用した [`tsukuyomi-tungstenite`](https://github.com/tsukuyomi-rs/tsukuyomi/tree/master/tsukuyomi-tungstenite) というクレートを用意しています。現在はハンドシェイクと `WebSocketStream` への変換を行うだけですが、将来的にはより高レベルな API を提供する予定です。

```rust
use tsukuyomi_tungstenite::{Ws, Message, WebSocketStream};

fn ws_echo(stream: WebSocketStream)
    -> impl Future<Item = (), Error = ()> + Send + 'static
{
    let (tx, rx) = stream.split();
    rx.filter_map(|m| {
        match m {
            Message::Ping(p) => Some(Message::Pong(p)),
            Message::Pong(_) => None,
            m => Some(m),
        }
    })
    .forward(tx)
    .then(|_| Ok(()))
}

path!("/ws").to(
    endpoint::get()
        .reply(Ws::new(ws_echo))
    )
)
```

# その他

今回は説明しませんが、次の機能を追加するためのクレートも併せて提供しています。

* [CORS サポート](https://github.com/tsukuyomi-rs/tsukuyomi/tree/master/tsukuyomi-cors)
* [Juniper](https://github.com/graphql-rust/juniper) を用いた[GraphQLサポート](https://github.com/tsukuyomi-rs/tsukuyomi/tree/master/tsukuyomi-juniper)
* [セッション管理](https://github.com/tsukuyomi-rs/tsukuyomi/tree/master/tsukuyomi-session)

まだまだ未成熟なライブラリなので実用するためには不便なところも多くありますが、興味のあるかたはぜひお試しください…
