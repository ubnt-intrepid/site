+++
title = "Tsukuyomi + Juniper で GraphQL サーバを作る"
date = "2018-07-11"
tags = [ "rust", "graphql", "juniper", "qiita" ]
categories = [ "programming" ]
+++

Rust では，GraphQL サーバ向けのライブラリとして [Juniper][juniper] というクレートが公開されています。少し前に自作の Web フレームワークである [Tsukuyomi][tsukuyomi] でこのライブラリを使用するためのライブラリを[公開した][tsukuyomi-juniper]ので， Tsukuyomi 自体の紹介もかねて簡単なチュートリアルを記しておきます。

[juniper]: https://github.com/graphql-rust/juniper
[tsukuyomi]: https://github.com/tsukuyomi-rs/tsukuyomi
[tsukuyomi-juniper]: https://crates.io/crates/tsukuyomi-juniper

なお，本記事で作成した Web アプリケーションのソースコード全体は以下の URL に置いておきましたので，そちらも併せてご参照ください。

* https://gitlab.com/ubnt-intrepid/tutorial-tsukuyomi-graphql

# Tsukuyomi について

[![header](https://raw.githubusercontent.com/tsukuyomi-rs/tsukuyomi/v0.2.2/tsukuyomi-header.png)](https://github.com/tsukuyomi-rs/tsukuyomi)

Hyper 0.12 ベースの非同期 Web フレームワークです。もともと開発していた Susanoo というプロジェクトの後継にあたり，既存の非同期 WAF (Gotham, Actix-web など）の設計に影響を受けつつ使いやすいフレームワークとなることを目指しています。

Tsukuyomi 自体の詳細は公式リポジトリも併せてご参照ください。

* https://github.com/tsukuyomi-rs/tsukuyomi

# Step1: プロジェクトの初期化 + Tsukuyomi の動作確認

`tsukuyomi` は stable channel のコンパイラで動作確認をしていますが，比較的新しめの言語機能（impl Trait など）に依存しているため `rustc` のバージョンが 1.26 以上が必要になります。今回は，本記事を執筆している時点における最新版である 1.27 を想定します。

```shell-session
$ rustc --version
rustc 1.27.0 (3eda71b00 2018-06-19)
```

`cargo` コマンドでプロジェクトを作成した後，依存関係に `tsukuyomi` を追加します。例えば，`cargo-edit` を使用する場合は次のようにコマンドを実行して下さい。

```shell-session
$ cargo new --bin tsukuyomi-graphql-tutorial
$ cd tsukuyomi-graphql-tutorial
$ cargo add tsukuyomi@0.2
```

動作確認のため，まずはシンプルな Web アプリケーションを作ります。ソースコードは以下の通りです。（ルーティング関連の API は `tsukuyomi-juniper` により隠蔽されているため，今回は説明を省略します。興味のある方は API ドキュメントや公式リポジトリのサンプルコードなどを参照してください…）

```rust src/main.rs
extern crate tsukuyomi;

use tsukuyomi::{App, Input, Handler};

// ハンドラー関数の定義
fn handler(_: &mut Input) -> &'static str {
    "Hello, Tsukuyomi.\n"
}

fn main() -> tsukuyomi::AppResult<()> {
    // アプリケーションの構築
    let app = App::builder()
        // ルートの追加
        .mount("/", |m| {
            m.get("/")
             .handle(Handler::new_ready(handler));
        })
        .finish()?;
    tsukuyomi::run(app)
}
```

プロジェクトを実行し，正しくレスポンスが返ってくれば動作確認は完了です。デフォルトでは，アドレスは `127.0.0.1:4000` に設定されています。

```shell-session server
$ cargo run
```

```shell-session client
$ curl -i http://127.0.0.1:4000/
HTTP/1.1 200 OK
...

Hello, Tsukuyomi.
```

# Step2: Juniper の動作確認

次に，Juniper を用いた GraphQL サーバの動作確認を行います。まず，次のように `juniper` と `tsukuyomi-juniper` を依存関係に追加します。

```shell-session
$ cargo add juniper@0.9 tsukuyomi-juniper@0.1
```

ソースコードは次のようになります。ここでは，`Query` のみを持つシンプルな GraphQL サーバを想定しています。

```rust src/main.rs
extern crate tsukuyomi;
#[macro_use]
extern crate juniper;
extern crate tsukuyomi_juniper;

mod schema;

use tsukuyomi::App;
use tsukuyomi_juniper::{
    GraphQLState,
    AppGraphQLExt as _AppGraphQLExt,
};
use juniper::{RootNode, EmptyMutation};

// Query root
struct Query {}

graphql_object!(Query: () |&self| {
    field apiVersion() -> &'static str {
        "1.0"
    }
});

fn main() -> tsukuyomi::AppResult<()> {
    // Tsukuyomi で GraphQL のリクエストを処理するための状態。
    // 第1引数に Juniper で使用されるコンテキスト値，第2引数に RootNode の値を指定する。
    // この状態はワーカースレッド間で共有されることに注意。
    let state = GraphQLState::new((), RootNode::new(Query {}, EmptyMutation::new()));

    let app = App::builder()
         // GraphQL のリクエストを処理するためのエンドポイントを追加する。
         // 具体的には，GET, POST リクエストに対するハンドラーが登録される。
         // 各リクエストの詳細な仕様は後述。
        .graphql("/graphql", state)
         // GraphiQL (GraphQL 用のインブラウザ IDE) を生成して返すエンドポイントを追加する。
        .graphiql("/graphiql", "http://127.0.0.1:4000/graphql")
        .finish()?;

    tsukuyomi::run(app)
}
```

ビルドに成功したらサーバを起動し，次のクエリを用いて動作確認を行います。

```graphql test-query
{ apiVersion }
```

HTTP を介して GraphQL のリクエストを送信するためには，`GET` か `POST` のいずれかの形式を用いる必要があります（詳細は[こちらのドキュメント](https://graphql.org/learn/serving-over-http/)などを参照してください）。今回の場合，以下のいずれかの方法でクエリを送信する必要があります。波括弧（`{`, `}`）を直接クエリ文字列に指定することはできないため，使用する HTTP クライアントに応じた方法を用いて GraphQL のクエリをエンコードする必要がある点に注意してください。

```http get-request
GET /graphql?query=%7BapiVersion%7D HTTP/1.1
Host: 127.0.0.1:4000
```

```http post-request
POST /graphql HTTP/1.1
Host: 127.0.0.1:4000
Content-Type: application/json
...

{
  "query": "{ apiVersion }"
}
```

上のようなリクエストに対し，次のようなレスポンスが返ってくれば動作確認は完了です。

```http query-result
HTTP/1.1 200 OK
Content-Type: application/json
...

{
  "data": {
    "apiVersion":"1.0"
  }
}
```

Juniper では GraphiQL というインブラウザ IDE を使用するための HTML を生成するヘルパー関数が用意されており，`tsukuyomi-juniper` ではこれに対応しています。今回の場合，`http://127.0.0.1:4000/graphiql` にアクセスすることで GraphiQL を起動することが出来ます。

# Step3: ToDo アプリの実装

GraphQL サーバのひな形は出来上がったので，あとはゴリゴリ実装していきます。
今回は簡単な例として ToDo 管理を行う Web アプリケーションを実装していきます。

まず，スキーマ定義で時刻型と UUID を扱いたいので次のように依存関係を更新します。`failure` は必須ではないですが

```toml Cargo.toml
[dependencies]
...
failure = "0.1.1"
chrono = "0.4"
uuid = { version = "0.5.1", features = ["v4"] }
```

作成する ToDo アプリのスキーマ定義は次のようになります[^1]。GraphQL 自体の詳細な解説はここでは省略しますが，普段 Scala や TypeScript などを使用していると何となく理解できるような文法になっていますね。型の末尾に `!` が付いていると Required で，そうでなければ Optional です。

[^1]: [こちら](https://github.com/haikyuu/graphql-todo-list/blob/master/api/presentation/schema.js)をベースにしました。

```graphql schema
type TimeStamp {} # = chrono::DateTime<chrono::Utc>
type Uuid {} # = uuid::Uuid

enum Priority {
    LOW
    MEDIUM
    HIGH
}

type Todo {
    id: Uuid!
    text: String!
    priority: Priority
    dueDate: TimeStamp
    completed: Boolean
}

type Query {
    todos: [Todo]!
    todo(id: Uuid!): Todo
}

input AddTodoInput {
    text: String!
    priority: Priority
    dueDate: TimeStamp    
}

input EditTodoInput {
    text: String
    priority: Priority
    dueDate: TimeStamp
    completed: Boolean
}

type Mutation {
    addTodo(todo: AddTodoInput!): String!
    editTodo(id: Uuid!, todo: EditTodoInput): Todo
    deleteTodo(id: Uuid!): Int!
}

schema {
    query: Query
    mutation: Mutation
}
```

上のスキーマを愚直に Rust コードに書き下すと次のようになりました。状況にもよりますが，基本的には単純な読み替えをしていけばスキーマを Rust コードに書き下すことが可能です。フィールド名は Juniper 側で自動的に `snake_case` から `camelCase` に変換されるので，基本的には Rust の流儀で名前を付けていきます。

```rust src/schema.rs
use chrono::{DateTime, Utc};
use juniper::{FieldResult, RootNode};
use uuid::Uuid;

use context::Context;

pub type TimeStamp = DateTime<Utc>;

#[derive(Debug, Copy, Clone, GraphQLEnum)]
pub enum Priority {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, GraphQLObject)]
pub struct Todo {
    pub id: Uuid,
    pub text: String,
    pub priority: Option<Priority>,
    pub due_date: Option<TimeStamp>,
    pub completed: bool,
}

#[derive(Debug)]
pub struct Query {
    _priv: (),
}

graphql_object!(Query: Context |&self| {
    field apiVersion() -> &'static str {
        "1.0"
    }

    field todos(&executor) -> FieldResult<Vec<Todo>> {
        executor.context().load_all().map_err(Into::into)
    }

    field todo(&executor, id: Uuid) -> FieldResult<Option<Todo>> {
        executor.context().load(id).map_err(Into::into)
    }
});

#[derive(Debug, GraphQLInputObject)]
pub struct AddTodoInput {
    pub text: String,
    pub priority: Option<Priority>,
    pub due_date: Option<TimeStamp>,
}

#[derive(Debug, GraphQLInputObject)]
pub struct EditTodoInput {
    pub text: Option<String>,
    pub priority: Option<Priority>,
    pub due_date: Option<TimeStamp>,
    pub completed: Option<bool>,
}

#[derive(Debug)]
pub struct Mutation {
    _priv: (),
}

graphql_object!(Mutation: Context |&self| {
    field addTodo(&executor, todo: AddTodoInput) -> FieldResult<Uuid> {
        executor.context().add_todo(todo).map_err(Into::into)
    }

    field editTodo(&executor, id: Uuid, todo: Option<EditTodoInput>) -> FieldResult<Option<Todo>> {
        executor.context().edit_todo(id, todo).map_err(Into::into)
    }

    field deleteTodo(&executor, id: Uuid) -> FieldResult<i32> {
        executor.context().delete_todo(id).map_err(Into::into)
    }
});

pub type Schema = RootNode<'static, Query, Mutation>;

pub fn create_schema() -> Schema {
    RootNode::new(Query { _priv: () }, Mutation { _priv: {} })
}
```

上のコード内で使用されている `Context` は，GraphQL オブジェクト内でアクセス可能なコンテキスト情報（DBのコネクションプールや認証情報など）を格納した型です。本来であれば diesel などと組み合わせて真面目にデータベースとやり取りするべきなのでしょうが，今回は横着して簡単な実装にしました。コンテキスト値はリクエスト間で共有されるため，`RwLock` を用いて排他制御を行っています。

```rust src/context.rs
use juniper;
use std::sync::RwLock;
use uuid::Uuid;

use schema::{AddTodoInput, EditTodoInput, Todo};

pub type Result<T> = ::std::result::Result<T, ::failure::Error>;

#[derive(Debug)]
pub struct Context(RwLock<Inner>);

#[derive(Debug)]
struct Inner {
    todos: Vec<Todo>,
}

impl juniper::Context for Context {}

impl Context {
    pub fn load_all(&self) -> Result<Vec<Todo>> {
        self.with_read(|cx| cx.todos.clone())
    }

    pub fn load(&self, id: Uuid) -> Result<Option<Todo>> {
        self.with_read(|cx| cx.todos.iter().find(|todo| todo.id == id).cloned())
    }

    pub fn add_todo(&self, input: AddTodoInput) -> Result<Uuid> {
        self.with_write(|cx| {
            let id = Uuid::new_v4();
            let new_todo = Todo {
                id: id,
                text: input.text,
                priority: input.priority,
                due_date: input.due_date,
                completed: false,
            };
            cx.todos.push(new_todo);
            id
        })
    }

    pub fn edit_todo(&self, id: Uuid, input: Option<EditTodoInput>) -> Result<Option<Todo>> {
        self.with_write(|cx| {
            cx.todos.iter_mut().find(|todo| todo.id == id).map(|todo| {
                if let Some(input) = input {
                    if let Some(text) = input.text {
                        todo.text = text;
                    }
                    if let Some(priority) = input.priority {
                        todo.priority = Some(priority);
                    }
                    if let Some(due_date) = input.due_date {
                        todo.due_date = Some(due_date);
                    }
                    if let Some(completed) = input.completed {
                        todo.completed = completed;
                    }
                };
                todo.clone()
            })
        })
    }

    pub fn delete_todo(&self, id: Uuid) -> Result<i32> {
        self.with_write(|cx| {
            let new_todos: Vec<_> = cx.todos.drain(..).filter(|todo| todo.id != id).collect();
            let num_affected_rows = cx.todos.len() - new_todos.len();
            cx.todos = new_todos;
            num_affected_rows as i32
        })
    }

    fn with_read<R>(&self, f: impl FnOnce(&Inner) -> R) -> Result<R> {
        let inner = self.0.read().map_err(|e| format_err!("{}", e))?;
        Ok(f(&*inner))
    }

    fn with_write<R>(&self, f: impl FnOnce(&mut Inner) -> R) -> Result<R> {
        let mut inner = self.0.write().map_err(|e| format_err!("{}", e))?;
        Ok(f(&mut *inner))
    }
}

pub fn create_context() -> Context {
    Context(RwLock::new(Inner { todos: vec![] }))
}
```

`main` 関数内で `GraphQLState` の構築を行っている箇所を上に定義した `create_context` と `create_schema` で置き換えた後サーバを起動してそれっぽく動いていれば成功です。

# おわりに

以上，駆け足気味ですが `tsukuyomi-juniper` の紹介でした。実用するためには

* 認証
* DBとの連携（モッキングなど）
* フロントエンド

あたりの問題をクリアする必要がありますが，今回は実装を省略しました。そのうち手を付けるかもしれませんが…

