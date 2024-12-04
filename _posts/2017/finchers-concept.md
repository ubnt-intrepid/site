---
title: Finchers の設計思想、およびサンプル
date: "2017-12-20"
tags: [ "rust", "qiita" ]
categories: [ "programming" ]
---

**追記(2018-02-07:02:14)**

本記事の執筆以降に大幅な仕様変更があったため，本記事に記載されている内容の大部分は現行開発版と大きく食い違っています．基本的な設計思想などはそのまま引き継いでいますが，記事後半にあるサンプルコードは現行バージョンでは使用できません．

---

拙作の Web フレームワークである [Finchers] の紹介記事です[^1]．

本来ならば動作する状態で紹介記事を書きたかったのですが，数日前から大幅な改修を始めてしまいまだその収集が付いていないため不完全な状態での説明になってしまうことをご了承下さい…

# はじめに
Finchers [^2] は，Scala の Finch という HTTP ライブラリに触発された作成した Rust 用の HTTP ルーティングライブラリです．宣言的に型安全なルーティングの定義を記述出来るようにすることを目標にしています．大まかな特長は次の通りです．

* ゼロコスト抽象化
* 型安全かつ直感的なルーティング定義
* 非同期処理（futures, tokio) との親和性

サンプルコードは次のようになります．インタフェースは基本的に `combine` や `futures` など既存のクレートで用いられているを踏襲していますが，ルーティング向けの拡張がいくつか行われています．

```rust
fn main() {
    let endpoint = {
        // GET /:id
        let get_entry = get(param())
            .and_then(|id: u64| service::find_entry(id).map(ApiReturn::GetEntry));

        // GET /
        let list_entries = get(ok(()))
            .and_then(|_| service::all_entries().map(ApiReturn::AllEntries));
        ...

        // /api/v1/posts にマウント
        skip_all(vec!["api", "v1", "posts"]).with(
            get_entry
                .or(list_entries)
        )
    };

    Server::default()
        .serve(endpoint);
}
```

# 開発の動機

もともと作り始めたのが，既存のフレームワークのルーティング周りの仕様に不満を抱えていたからです．
例えば，Iron では次のようなシグネチャの関数を用いてリクエストハンドラを定義します [^3]．

```rust
fn handler(req: &mut Request) -> IronResult<Response> {
    // ...
}
```

ここで `Request` には受信したリクエストの情報の他に，各種ミドルウェアにより挿入される状態が格納されています．後続のプロジェクトも，基本的にはこのような仕組みを採用していることが多いと感じます [^4] ．

しかしこの方針には，ルーティングの結果を取り出すために煩雑な記述が必要になるという問題があります．例えば Iron の場合，次のようにしてマッチしたルートの結果を取り出す必要があります．

```rust
fn handler(req: &mut Request) -> IronResult<Response> {
    let router = req.extensions.get::<Router>().unwrap();
    let query = router.find("query").unwrap_or("/");

    ...
}
```

これは明らかに冗長であり面倒になってしまっています（~~そもそも Iron 限定のものなのに `router` なんて汎用的な名前で登録しちゃうんだゲフンゲフン~~）．また，ルーティングの定義（`Router` への登録）とパラメータの取り出しが分離してしまうため，コード変更のミスを「コンパイル時に」検出することが不可能になってしまいます．後発のフレームワークではルーティングをミドルウェアにするのではなく組み込みの機能として提供している場合が多いですが，どれも本質的には同じ問題を抱えてしまっています．

また，処理結果が（実質的に生の HTTP レスポンスである）`Response` として出力する必要があるという点も場合によっては問題となります．注意して書かないと， `Response` への変換処理があちこちに分散してしまいレスポンスの統一が困難になってしまいます．一応次のようにすることで回避することは可能ですが，出来ればこのようなコードを書かずに済むと嬉しいでしょう…

```rust
fn handler(req: &mut Request) -> IronResult<Response> {
    let result = handler_impl(req);
    respond(result, req) // これはすべてのルートのハンドラに付ける必要がある
}

fn handler_impl(req: &mut Request) -> Result<Value, Error> {
    // 本体の処理
}

fn respond(result: Result<Value, Error>, req: &mut Request) -> IronResult<Response> {
    // レスポンスへの変換
}
```

これらのライブラリの対極に位置するのが [Rocket] です．これは，custom attribute を用いたコード生成を行うことで「リクエストハンドラに紐付いた」ルートの定義を実現しています．

```rust
#[get("/hello/<name>/<id>")]
fn hello(name: String, id: u64) -> String {
    ...
}
```

パスの定義と値の取り出しが正しいことが「静的に」保証するという特長が魅力的です．また，戻り値も `Response`（相当の型）ではなくハンドラ内の処理結果をそのまま返しています．これは [`Responder`][responder] というトレイトにより実現されています．
残念ながら custom attribute がまだ不安定であり安定版のコンパイラで使えないという問題がありますが，このようにコンパイル時に実装のバグを検出できるようにするフレームワークが今後増えていくのではないかと思います（そうあって欲しいという願いがあり，故に Finchers の構想が生まれたのですが）．

また，Tokio の台頭により非同期ベースのフレームワークへの移行が徐々に進んでいくと考えられます．Hyper もバージョン 0.11 から tokio ベースの非同期 IO に移行し，それベースの WAF が今年に入って次々と登場してきています:

* [`actix`](https://github.com/actix/actix-web)
* [`gotham`](https://gotham.rs/)
* [`shio`](https://github.com/mehcode/shio-rs)
* ([`susanoo`](https://github.com/ubnt-intrepid/susanoo))

---

以上の点を踏まえ，目指すべきフレームワークの満たすべき要件は次のようになりました．

* 可能な限り「静的」で「型安全」なルーティングの実現
* 安定版でも使える（不安定な機能に依存しない）
* 非同期処理に対応し，futures や tokio との親和性がある

この目標を満たすため，その時作っていた Susanoo というフレームワーク用のルーティング周りの仕様を変えようと多言語のフレームワークを物色していたところ，Finch の存在を知り感銘を受けたのが開発の動機です．当初は簡単な実装にして Susanoo のルーティング部に使用する予定だったのですが，既存の枠組みから大幅に方針転換する必要があると気づいたため独立したフレームワークになっています（そのため，Susanoo の開発は現在中断しています [^5]）．

## アプリケーションの構造
Finchers では，次のような 3 層構造でリクエストが処理されます．

```txt
(hyper::Request)
       |
       v
  [ Endpoint ]
       |
       | Task<Item = T, Error = E>
       v
    [ Task ] poll()
       |
       | Result<T, E>
       v
  [ Responder ]
       |
       | respond_to()
       v
(hyper::Response)
```

各層は，それぞれ次のような役割を持っています．すべての層が完全に分離されているかというそういうわけではなく，リクエストなどの情報は各層でアクセス可能なコンテキストを介して共有されます（現状の実装ではリクエストのみですが）．

* `Endpoint` - ルーティング，リクエストからの「即時的な」値の読み込みなど
* `Task` - ルート確定「後」に行う処理（DBへのアクセスなど）
* `Responder` - 処理結果の HTTP レスポンスへの変換


## `Endpoint` 
この層では，受信したリクエストを元にルーティングを実行します．このルーティングの結果は「直ちに」確定し その後の処理は `Task` を実装した型に引き継がれます．この層で行われる処理はトレイト `Endpoint` として抽象化され，その定義は次のようになります．

```rust
trait Endpoint {
    type Item;
    type Error;
    // ルート確定時に返す Task を表す関連型
    type Task: Task<Item = Self::Item, Error = Self::Error>;

    fn apply(&self, ctx: &mut EndpointContext) -> Result<Self::Task, EndpointError>;

    // ...
}
```

ここで `EndpointContext` はルーティングに必要な情報の格納された構造体です．`Endpoint` には他にもメソッドが定義されており，それを用いて他のエンドポイントと「組みあわせる」ことでルーティングを構築していきます．

## `Task`
この層では，エンドポイントによりルートが確定した「後」の処理を担当します．これはトレイト `Task` により抽象化されており，その定義は次のようになります（要は `Future` なんですが，内部でリクエストの情報にアクセス出来るように `poll()` のシグネチャが変更されています）．

```rust
trait Task {
    type Item;
    type Error;

    fn poll(&mut self, ctx: &mut TaskContext) -> Poll<Self::Item, Self::Error>;
}
```

`poll()` の引数として渡されている `TaskContext` には，ルート確定「後」にアクセス可能なリクエストの情報などが格納されています．この引数が存在する理由は，次のようにタスクの構築後にリクエスト情報を使用したいというニーズに対応するためです．

```rust
fn authorize(id: u64, req: &Request) -> impl Task {
   ...
}

get(segment("foo").with(param())).and_then(|id: u64| {
    // lazy は FnOnce(&mut Context) -> R からタスクを構築するヘルパ関数
    lazy(|ctx: &mut Context| {
        authorize(id, ctx.request())
            .and_then(|info| Ok(format!("admin_info: {}", info)))
    })
})
```

定義から明らかなように `Future` を実装した型は `Task` を実装を自明に持つことが出来，そのため `Future` を返す API との相性はそこまで悪くないようになっています．次のようにすることで，外部の API からの戻り値である `Future` を「そのまま」使用することが出来るようになります．

```rust
fn get_user_info_async() -> impl Future<Item = String, Error = String> + 'static {
    ...
}

get(segment("foo").with(param())).and_then(|id: u64| {
    future(get_user_info_async(id)) // FutureTask<F: Future> というタスクを構築する
})
```

## `Responder`
`Responder` は HTTP レスポンスへの変換を抽象化するためのトレイトです．元々は Rocket で用いられていた考え方であり，次のような利点を持っていたため輸入しました．

* レスポンスに変換する「前の」処理結果を取得できる．これにより，例えばテストが容易になる．
* 実装の関心を「リクエストの処理」と「レスポンスの整形」とで分離することが出来る．

これらの利点は気をつけて使えば Iron など他のフレームワークでも実現可能ですが，こっちのほうが好みなので今後普及していくと嬉しいですね．`Responder` の定義は次のようになります．

```rust
trait Responder {
    fn respond_to(&mut self, ctx: &mut ResponderContext) -> Response;
}
```

# 使用例
説明だけだとあれなので，Finchers を使用して簡単な Web アプリケーションを作る例を書き留めておきたいと思います．

本来ならば実際に動作するコードを持ってくるべきなのですが，リリースが間に合わなかずここに記載されている内容はあくまで「仮想的なものである」点に注意して下さい（煮詰めないといけない仕様が残っていたため公開は断念した）．リリースが完了次第情報を修正します．

## API の仕様
RESTful な ToDo アプリケーションを作ってみます．URI は `/api/v1` をプレフィックスに持ち，各ルートはそれぞれ次のようなパスを取るものとします．

* `GET /todos/:id` - 指定した ID のエントリを取得する
* `GET /todos` - すべてのエントリを取得する
* `POST /todos` - エントリを追加する
* `DELETE /todos/:id` - 指定した ID のエントリを削除する
* `PUT /todos/:id` - 指定した ID のエントリを上書きする

## モデル・コントローラの実装
モデルの定義は次のようにします．DB 側と Web 側で適切に分けるべきかもしれないですが，簡単のため今回は同じ定義を流用することにします．

```rust
#[derive(Clone, Deserialize)]
struct Entry {
    id: u64,
    title: String,
    completed: bool,
}

#[derive(Serialize)]
struct NewEntry {
    title: String,
}

#[derive(Serialize)]
struct EntryPatch {
    title: Option<String>,
    completed: Option<bool>,
}
```

サービス層の実装は次のようになりました．今回は用いませんでしたが，本来は適切に抽象化して依存性注入できるようにすべきですね．各メソッドの戻り値には `Result` を用いていますが，非同期なら `impl Future` なり `Box<Future<...>>` なりが来ます．

```rust
error_chain! {
    types { TodoError, TodoErrorKind, TodoResult; }
}

struct InMemoryTodoRepository {
    entries: Vec<Entry>,
    counter: u64,
}

#[derive(Clone)]
struct TodoService {
    repo: Arc<RwLock<InMemoryTodoRepository>>,
}

impl TodoService {
    fn find_entry_by_id(&self, id: u64) -> TodoResult<Option<Entry>> {
        ...
    }

    fn all_entries(&self) -> TodoResult<Vec<Entry>> {
        ...
    }

    fn add_new_entry(&self, new_entry: NewEntry) -> TodoResult<Entry> {
        ...
    }

    fn modify_entry(&self, patch: EntryPatch) -> TodoResult<Entry> {
        ...
    }
}
```

## レスポンス型・エラー型の定義
API の返すレスポンスを定義します．まず，正常値を表す列挙型 `ApiValue` を次のように定義します．

```rust
enum ApiValue {
    TheTodo { is_new: bool, entry: Option<Entry> },
    AllTodos(Vec<Todo>),
}
```

エラー型は次のようになります．今回は横着して `error-chain` を用いています．
注意が必要なのが，finchers 側から送出されるエラー型からの（`From` による）変換を可能にしておく必要があるという点です．これは，Finchers 内部ではエラーハンドリングを基本的には行わず，レスポンスの構築は原則ユーザ側に委ねる方針を取っているためです．

```rust
error_chain! {
    types {
        ApiError, ApiErrorKind, ApiResult;
    }

    foreign_links {
        Routing(EndpointError);
        ReadingBody(BodyError);
        ParsingBody(serde_json::Error);
    }
}
```

型が定義できたら，HTTP のレスポンスに変換するために `Responder` を実装します．
次のように `Responder` を実装する型を用意することで余計なクローンを防止することが出来ます．

```rust
struct ApiValueResponder(Option<ApiValue>);

impl Responder for ApiValueResponder {
    fn respond_to(&mut self, _: &mut ResponderContext) -> Response {
        let value = self.0.take().expect("cannot respond twice");
        match value {
            TheTodo { is_new, entry } => { ... },
            AllTodos(entries) => { ... }
        }
    }
}

impl IntoResponder for ApiValue {
    type Responder = ApiValueResponder;
    fn into_responder(self) -> Self::Responder {
        ApiValueResponder(Some(self))
    }
}
```

エラー型側の `Responder` の実装は次のようになります．せっかく `error-chain` を使い `std::fmt::Display` と `std::error::Error` が実装されているので，これらのトレイトから得られる情報を載せることにします．

```rust
impl ApiError {
    fn status_code(&self) -> StatusCode { ... }
    fn error_type(&self) -> &str { ... }
    fn response_body(&self) -> String {
        json!({
            "error_type": self.error_type(),
            "description": error::Error::description(self),
            "message": self.to_string(),
        }).to_string()
    }
}

impl Responder for ApiError {
    fn respond_to(&mut self, _: &mut ResponderContext) -> Response {
        ResponderBuilder::default()
            .status(self.status_code())
            .body(self.response_body())
            .finish()
    }
}
```


## エンドポイントの構築

エンドポイントを構築する関数を次のように定義します．説明のためここでは impl Trait を使用しましたが，安定版のコンパイラで使うことは出来ないのでクロージャを使うかトレイトオブジェクトへの変換をする必要があります．

```rust
fn build_endpoint(service: TodoService)
    -> impl Endpoint<Item = ApiValue, Error = ApiError> + 'static
{
    // GET /:id
    let find_entry = get(param()).and_then({
        let service = service.clone();
        move |id| -> ApiResult<_> {
            let entry = service.find_entry_by_id(id)?;
            Ok(TheEntry { is_new: false, entry })
        }
    });

    // GET /
    let all_entries = get(ok(())).and_then({
        let service = service.clone();
        move |_| -> ApiResult<_> {
            let entries = service.all_entries()?;
            Ok(AllEntries(entries))
        }
    });

    // POST /
    let add_entry = post(body()).and_then({
        let service = service.clone();
        move |Json(new_entry)| {
            let entry = service.add_entry(new_entry)?;
            Ok(TheEntry {
                is_new: true,
                entry: Some(entry),
            })
        }
    });

    // DELETE /:id
    let delete_entry = delete(param()).and_then(|id| { ... });

    // PUT /:id
    let modify_entry = put((param(), body())).and_then(|(id, Json(patch))| { ... });

    // /api/v1/todos にマウント
    skip_all(vec!["api", "v1", "todos"])
        .with(
            // ここは choice() とか用意しておくと良さそう
            find_entry
                .or(all_entries)
                .or(add_entry)
                .or(delete_entry)
                .or(modify_entry)
        )
}
```

## サーバの起動

```rust
fn main() {
    let service = TodoService::new();
    let endpoint = build_endpoint(service);

    Server::default()
        .bind("0.0.0.0:4000")
        .serve(endpoint);
}
```


# 未解決問題
現状，汎用的な Web フレームワークとして実用性が十分あるとは言い難く，多くの機能が不足しています．思いつくものを列挙すると次のような感じですかね．

* レイヤー間，リクエスト間の状態の共有
* Cookie・セッション管理
* Streaming
* 認証
* SSL/TLS
* HTTP 2.0
* WebSocket
* ロギング

他のフレームワークに漏れず，Finchers でも拡張性は重視したいと考えています．そのため，組み込みの機能として提供する必要性のないものについては外部クレートとして提供する方針を取りたいと考えています．

また現状ではドキュメントが圧倒的に不足しているため，時間を見つけつつ書き足さないといけないなぁと思っています（と言いながら放置している）．

# おわりに
Finchers の紹介でした．コメントは随時募集していますので，この記事を読み賛同していただけたのであれば是非コメントなどいただけたのであれば PR および Issue 報告していただけると嬉しいです．

[^1]: 当初はもう少しこじんまりとしたライブラリにする予定だったが，数日前に方針を変更した

[^2]: Organization は[こちら][organization]

[^3]: 正確には `Handler` というトレイトで抽象化されている

[^4]: これは Susanoo も例外ではない

[^5]: susanoo の開発状況ですが，コンセプトが定まらずフラフラしている間に `gotham` や `shio` が登場してしまい「なんか，もう良いや…」と意欲がなくなってしまった結果絶賛放置中です．[それなりに注目してもらっているので][medium] 何とか開発を再開したいとは思っているのですが…

[Finchers]: https://github.com/finchers-rs/finchers
[organization]: https://github.com/finchers-rs
[Rocket]: https://rocket.rs
[responder]: https://api.rocket.rs/rocket/response/trait.Responder.html
[medium]: https://medium.com/@fafhrd91/web-frameworks-benchmarks-bf0d32cc034e

