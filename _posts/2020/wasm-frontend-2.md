---
title: Rust のフロントエンド開発に入門する (2)
date: "2020-09-10T17:42:51+09:00"
tags: ["wasm", "webpack"]
categories: ["programming"]
---

Rust/WebAssembly でフロントエンド開発に入門してみる記事です。
[前回](/wasm-frontend-1)の最後で予告した通り、今回は Webpack やフレームワークの導入を行っていきます。

<!-- more -->

<!--
<span class="px-2 py-1 rounded text-sm bg-gray-200"><code>src/lib.rs</code></span>
-->

# Webpack の導入

npm のエコシステムとうまく共存できるよう、Webpack を導入したプロジェクト構成に変更してみます。
Rust 単体で完結するのも魅力的ではあるのですが、現時点でそこまで無理する必要もないのかなぁとも思います。

Node.js のバージョン管理には [`fnm`] を使用しています。

```shell-session
$ fnm current
v14.9.0

$ npm --version
6.14.8
```

---

cargo と npm とでプロジェクトのルートディレクトリを共有するのが何となく嫌だったので、必須ではないですが cargo 側のファイル一式を `app/` に退避しておきます。

```shell-session
$ mkdir -p app
$ mv {src,Cargo.toml} app/
```

```toml Cargo.toml
[workspace]
members = [
    "app",
]
```

npm パッケージを初期化し、必要なパッケージを色々インストールしておきます。
Webpack 周りは良く知らないので、ググりながら適当にパッケージを選定しました。

```shell-session
$ npm init -y
$ npm i -D webpack webpack-cli webpack-dev-server html-webpack-plugin
$ npm i -D @wasm-tool/wasm-pack-plugin
$ npm i -D wasm-pack 
```

[`@wasm-tool/wasm-pack-plugin`](https://github.com/wasm-tool/wasm-pack-plugin) は Webpack 側で WebAssembly を扱うためのプラグインであり、これにより Webpack 側で `wasm-pack` による cargo パッケージのビルドやコードの変更監視などを行えるようになります。

`wasm-pack-plugin` を使用するためには `wasm-pack` が `$PATH` に通っている必要があり、通常は `wasm-pack` のインストールを別途行う必要があります。
npm パッケージとして公開されている [`wasm-pack`](https://www.npmjs.com/package/wasm-pack) を使用することでプロジェクトローカルにコマンドのインストールを行うことができるため、今回はこれを追加でインストールすることにします。
こういうローカルにコマンドをインストールして使用する仕組みが `cargo` に無いのが若干不満で、将来的に近い仕組みが導入されれば良いなぁと思っています[^1]。

[^1]: `cargo-make` を使えばいい気もするが…

Webpack の設定は次のようにしました。
後述する `seed` が提供している Webpack 向けのテンプレートである [`seed-quickstart-webpack`](https://github.com/seed-rs/seed-quickstart-webpack) を参考にしましたが、使用するプラグインが可能な限り少なくなるよう簡略化しています。

```javascript webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

const appDir = path.resolve(__dirname, 'app');
const srcDir = path.resolve(__dirname, 'src');
const distDir = path.resolve(__dirname, 'dist');

module.exports = {
    entry: path.resolve(srcDir, 'index.js'),

    output: {
        publicPath: '/',
        path: distDir,
        filename: '[name].[contenthash].js',
    },

    plugins: [
        // Build and pack WebAssembly artifact
        new WasmPackPlugin({
            crateDirectory: appDir,
            extraArgs: '--no-typescript',
            outName: 'index',
            outDir: path.resolve(srcDir, 'app'),
        }),

        // Generate HTML files
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: path.resolve(srcDir, 'index.html'),
        }),
    ],

    devServer: {
        contentBase: distDir,
        port: 8080,
    },
};
```

`src/` 下には必要なソースファイルを配置しておきます。
`index.html` は `html-webpack-plugin` が面倒を見てくれるので削除してしまっても良いですが、今回はテンプレートとしてそのまま残すことにしました。`<script>` タグの挿入は `dist/` へ出力されるとき自動的に行われるので、重複しないように削除しておきます。

```diff dist/index.html → src/index.html
 <body>
     <div id="app"></div>
-
-    <script type="module">
-        import init from './pkg/wasm_bindgen_getting_started.js';
-        init('./pkg/wasm_bindgen_getting_started_bg.wasm');
-    </script>
 </body>
```

```javascript src/index.js
import('./app/index.js');
```

あとは `webpack` を npm-scripts 経由で実行できるよう、適当なショートカットを用意しておきます。

```diff package.json
   "scripts": {
     ...
+    "build": "webpack",
+    "dev": "webpack-dev-server"
   },
```

# フレームワークの導入

前回は、`web-sys` を用いて直接 DOM を操作しました。
実際のアプリケーションでは、直接 DOM を操作するよりも適当なフレームワークを導入した上で DOM の管理を任せてしまった方が様々な理由で大きなメリットがあります。

本記事の執筆時点では Rust で使用することのできるフロントエンド向けのフレームワークはそれなりに存在し、その多くは React や Elm architecture などの著名なライブラリを参考にしているようです。
著名なのが [`yew`] ですが、他のフレームワークもおおざっぱに見ると 似通った API を持っていると感じたので、今回は（主に個人的な趣味で）使用するフレームワークを選定したいと思います[^2]。

[^2]: `yew` の解説記事は大量に存在し、今手を出してもあまり旨味を感じないというのも理由にあります（？）

というわけで、今回は [`draco`] を使用することにします。
フレームワークとしては必要最小限の機能に留まっておりほかのライブラリとの連携が楽そうだったこと、および view での仮想 DOM 構築にマクロを使わず Builder スタイルで構築していく API を個人的に気に入ったのが選定の主な理由です。
`yew` などと比較するとドキュメントが整備されていないのが心配ですが、サンプルコードをななめ読みすればまぁ何とかなるでしょう（多分）。

使用するフレームワークが決まったので WebAssembly 側のパッケージを書き換えていきます。
crates.io に上がっている `draco` の最新バージョンは 0.1.2 ですが、すでに開発版に大幅な変更を加えられているようなので今回はそちらを使用することにします。

```diff app/Cargo.toml
 [dependencies]
+draco = { git = "https://github.com/utkarshkukreti/draco.git", rev = "32419ec" }
 wasm-bindgen = "0.2"
```

```diff app/src/lib.rs
+use draco::{Application, VNode};
 use wasm_bindgen::prelude::*;
 
+struct MyApp;
+
+impl Application for MyApp {
+    type Message = ();
+
+    fn view(&self) -> VNode<Self::Message> {
+        "Hello from Rust!".into()
+    }
+}
+
 #[wasm_bindgen(start)]
 pub fn main() -> Result<(), JsValue> {
    ...
     let app = document
         .get_element_by_id("app")
         .ok_or("missing `app` in document")?;
-    app.set_inner_html("Hello from Rust!");
+
+    // draco が指定したノード自体を置き換えてしまうので、#app が消失しないようダミーの子ノードを直下に作っておく
+    let node = document.create_element("div")?;
+    app.append_child(&node)?;
+
+    let _mailbox = draco::start(MyApp, node.into());

     Ok(())
 }
```

> `draco::start` によってアプリケーションを実行する際、`#app` に子ノードを生成してから渡すようにしています。
> これは、`#app` を直接渡してしまうと仮想 DOM の上書きによって DOM 自体が消失してしまう挙動になっているためです。

Dev サーバを起動し、ビルドと DOM の更新が期待通りに行われているかどうかを確認したら完了です。

```shell-session
$ npm run dev
```

# おわりに

今回は、Webpack の導入を行い、フレームワークとして `draco` を使用するところまでをやりました。

先述したように `draco` は比較的小規模なプロジェクトであり、`yew` など他のフレームワークと比べると積極的に開発が進んでいないように感じます。
そのため、初心者向けのドキュメントなどもあまり整備されていませんが、基本的には他のものと同じような API なため[リポジトリに置いてあるサンプルコード](https://github.com/utkarshkukreti/draco/tree/master/examples)を参考にすれば簡単なアプリケーションぐらいであれば作れるのではないかと思います。

次回は、まだ決めていませんが [TodoMVC] あたりを実装してみたいと思います。

<!-- links -->
[`fnm`]: https://github.com/Schniz/fnm
[`yew`]: https://github.com/yewstack/yew
[`seed`]: https://github.com/seed-rs/seed
[`draco`]: https://github.com/utkarshkukreti/draco
[TodoMVC]: http://todomvc.com/
