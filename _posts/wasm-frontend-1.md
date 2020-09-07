+++
title = "Rust のフロントエンド開発に入門する (1)"
date = "2020-09-07T20:23:43+09:00"

[taxonomies]
tags = ["rust", "wasm", "wasm-bindgen"]
categories = ["programming"]
+++

Rust/WebAssembly によるフロントエンド開発がだいぶ楽になってそうだったので、今更ですが入門したいと思います。

この手の入門記事は和英問わず多く存在し、公式のドキュメントも充実しているため n 番煎じな感は否めませんが、気にせず自分のペースでのんびりと進めていきたいと思っています。

<!-- more -->

# Hello, WebAssembly!

手始めに、フレームワークの力を借りず [`wasm-bindgen`] を直接用いて簡単な Web アプリケーションを作成してみます。
開発環境は WSL2 上で動作する Ubuntu 20.04 LTS で、Rust は本記事の執筆時点で最新の安定板である 1.46.0 を使用します。

```shell-session
$ uname -a
Linux DESKTOP-******* 4.19.104-microsoft-standard #1 SMP Wed Feb 19 06:37:35 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux

$ lsb_release -a
No LSB modules are available.
Distributor ID: Ubuntu
Description:    Ubuntu 20.04.1 LTS
Release:        20.04
Codename:       focal

$ rustup show active-toolchain
stable-x86_64-unknown-linux-gnu (default)

$ rustc --version
rustc 1.46.0 (04488afe3 2020-08-24)
```

まず最初に、Cargo パッケージを初期化して必要な依存パッケージを `[dependencies]` セクションに追記します。
[`wasm-bindgen`] は JavaScript との間でのインポート・エクスポートを行うために必要なパッケージです。
[`web-sys`] はブラウザ側の API を Wasm 側で使用するためのバインディングですが、今回は `console.log` を用いるので `feature="console"` のみを有効化しておきます。

```shell-session
$ cargo new --lib seed-rs-getting-started
$ cd $_
```

<span class="px-2 py-1 rounded text-sm bg-gray-200"><code>Cargo.toml</code></span>

```toml
[package]
name = "wasm-bindgen-getting-started"
version = "0.0.0"
publish = false
edition = "2018"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"

[dependencies.web-sys]
version = "0.3"
features = [
    "console",
]
```

単純な例として、Wasm モジュールをロードしたらブラウザのデバッグコンソールにメッセージを表示するだけのアプリケーションを作ってみます。`#[wasm_bindgen(start)]` を指定することで、モジュールがロードされた時のエントリポイントを指定することが出来ます。

<span class="px-2 py-1 rounded text-sm bg-gray-200"><code>src/lib.rs</code></span>

```rust
use wasm_bindgen::prelude::*;
use web_sys::console;

#[wasm_bindgen(start)]
pub fn main() {
    console::log_1(&"Hello from Rust!".into());
}
```

`wasm32-unknown-unknown` ターゲットでビルドし、所望の `.wasm` ファイルが生成出来ていることを確認します (optional)。

```shell-session
$ cargo build --target wasm32-unknown-unknown

$ ls target/wasm32-unknown-unknown/debug/*.wasm
target/wasm32-unknown-unknown/debug/seed_rs_getting_started.wasm
```

上の例では `.wasm` ファイルを直接生成していますが、[`wasm-pack`] を用いることで JavaScript との連携が簡単に行えるようセットアップされた形でビルドした WebAssembly を使用することができるようになります。
`wasm-pack` のインストール方法は 公式のインストーラ、`cargo-install` 経由、`npm` 経由などいくつか存在するので自分の環境に応じて適切な方法を用いるとよいと思います。

`wasm-pack` をインストールしコマンドへのパスが通っていることを確認したら、`build` サブコマンドを実行して WebAssembly へのビルドと npm パッケージの生成を実行します。

```shell-session
$ wasm-pack --version
wasm-pack 0.9.1

$ OUT_DIR=./dist/pkg
$ wasm-pack build \
    --target web \           # ブラウザ向けにビルド
    --out-dir "${OUT_DIR}" \ # 成果物の出力先ディレクトリ（デフォルトは ${CARGO_MANIFEST_DIR}/pkg/）
    --dev                    # デバッグモードでビルド（デフォルトは --release）

$ ls $OUT_DIR
package.json                       wasm_bindgen_getting_started_bg.d.ts
wasm_bindgen_getting_started.d.ts  wasm_bindgen_getting_started_bg.wasm
wasm_bindgen_getting_started.js
```

最後に、生成された WebAssembly を HTML 側で読み込み、期待通りの実行が出来ているかどうか確認します。
適当な HTTP サーバで `dist/` を開き、ブラウザのデバッグコンソールに `Hello, from Rust!` と表示されていることを確認します。

<span class="px-2 py-1 rounded text-sm bg-gray-200"><code>dist/index.html</code></span>

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>Wasm Frontend Getting Started</title>
</head>
<body>
    <script type="module">
        import init from './pkg/wasm_bindgen_getting_started.js';
        init('./pkg/wasm_bindgen_getting_started_bg.wasm');
    </script>
</body>
</html>
```

```shell-session
$ python3 -m http.server -d dist/
```

# DOM を操作する

`web-sys` を用いて、WebAssembly 側から DOM を操作してみます。
まず、DOM 関連のバインディングを有効化するために `web-sys` の feature flag を次のように書き換えます（ついでに使用しない `"console"` を削除します）。

<span class="px-2 py-1 rounded text-sm bg-gray-200"><code>Cargo.toml</code></span>

```diff
[dependencies.web-sys]
version = "0.3"
features = [
-    "console",
+    "Document",
+    "Element",
+    "HtmlElement",
+    "Node",
+    "Window",
]
```

WebAssembly 側のコードは次のようになります。
基本的には JavaScript で提供されている API と同じような使い勝手で用いることが出来るようになっていますが、camelCase/snake_case やエラーの取り扱いなど若干異なるので注意する必要があります。

<span class="px-2 py-1 rounded text-sm bg-gray-200"><code>src/lib.rs</code></span>

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    let window = web_sys::window().ok_or("no global `window` exists")?;
    let document = window.document().ok_or("should have a document on window")?;

    let app = document.get_element_by_id("app").ok_or("missing `app` in document")?;
    app.set_inner_html("Hello from Rust!");

    Ok(())
}
```

HTML 側には、WebAssembly 側からアクセスするための `<div>` 要素を追加しておきます。

<span class="px-2 py-1 rounded text-sm bg-gray-200"><code>dist/index.html</code></span>

```diff
<body>
+    <div id="app"></div>
+
    <script type="module">
        import init from './pkg/wasm_bindgen_getting_started.js';
        init('./pkg/wasm_bindgen_getting_started_bg.wasm');
    </script>
</body>
```

# おわりに

Rust の WebAssembly 対応はここ最近はちゃんと追えていなかったのですが、流行り始めた初期と比べて格段に扱いやすくなっていると感じました。

次回からは、より実用的な Web アプリケーションを行うためのあれこれ（Webpack や適当なフレームワークの導入など）を試してみたいと思います。

<!-- links -->
[`wasm-bindgen`]: https://github.com/rustwasm/wasm-bindgen
[`wasm-pack`]: https://github.com/rustwasm/wasm-pack
[`web-sys`]: https://github.com/rustwasm/wasm-bindgen/tree/master/crates/web-sys
