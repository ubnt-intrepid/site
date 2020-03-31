+++
title = "cargo で npm-scripts 的なことをする"
date = 2019-11-20

[taxonomies]
tags = [ "rust", "cargo", "cargo-xtask", "qiita" ]
categories = [ "programming" ]
+++

<!-- more -->

Rust のパッケージマネージャ兼ビルドツールである `cargo` には、[`npm-scripts`](https://docs.npmjs.com/misc/scripts) のようにプロジェクト固有のタスクを定義する機能は（少なくとも完全には）提供されていません。[`.cargo/config` にエイリアスを登録することで](https://doc.rust-lang.org/cargo/reference/config.html#configuration-keys)プロジェクト固有のサブコマンドを追加することはできますが、あくまでサブコマンドの簡略化であり、任意のスクリプトを実行するようにはできていません。そのため、多くの Rust プロジェクトでは `make` や `cargo-make` などの外部で提供されるタスクランナーを併用しているのが現状だと思います。

本記事では、外部ツールに頼らないタスク定義の仕組みとして、matklad 氏の提案している [`cargo-xtask`] という枠組みを紹介します。

# `cargo-xtask`

端的に言うと、タスク実行用のパッケージをプロジェクトに追加し、先に述べた `.cargo/config` のエイリアスとして登録して実行してしまうという手法です。基本的に `cargo` の機能のみを使用し、外部ツールを導入することなく始めることが出来るという利点があります。

* `make` などの外部タスクランナーを別途インストールする必要がない
  - `target/` 下の書き込み権限さえあれば良いので、パッケージのインストールが制限されている CI/CD 環境などで有利
* Rust のソースとしてタスクを実装・管理することが出来る
  - シェルスクリプトなどと比較してプラットフォーム依存性が低い（うまく書けば）

公式に推奨されている方式というわけではなく、`build` や `test` などの既存のタスクを置き換えることが出来ないという制限があるので、OSS や複数人の関わるプロジェクトに導入する際には注意が必要です。また、現状だとタスクの実装は基本的に一から行う必要があるため、大規模なプロジェクトのタスクランナーを置き換えるのには不向きかもしれません。柔軟性が十分にある方式なので、少しずつ移行すると良いかもしれません。定義済みのタスクを共有する仕組みはありませんが、共通する処理をパッケージとして切り出して依存関係に追加してしまうと良いと思います。

# 適用例

まず、タスク実行用のパッケージである `xtask` をプロジェクト直下に作成します。

```shell-session
$ cargo new --bin xtask --name xtask
```

追加した `xtask` を実行するエイリアスを `.cargo/config` に追加します。プロジェクトが workspace を用いているかどうかで2つの書き方がありますが、プロジェクトに合った方を選択すると良いと思います（`--manifest-path` で直接指定する場合は `xtask` のビルドキャッシュを独立して管理できるが、`--package` を用いると合計のビルド時間を短縮できる、など）。

```toml
# .cargo/config

[alias]
xtask = "run --manifest-path ./xtask/Cargo.toml --"

# workspace を使用する場合（作業ディレクトリに依存しないのでこちらの方がベター）
xtask = "run --package xtask --"
```

次に、実行するタスクを記述してきます。基本的にはただの実行ファイルなのでどのように記述しても構わないと思いますが、実行するタスクを決定するため、少なくとも一つのコマンドライン引数を受け取れるようにする必要があります。
また、依存するパッケージを増やすと `xtask` 自体のビルド時間が大きくなってしまうので、起動時間を短縮したいのであれば標準ライブラリを用いるなどして可能な限り依存関係を小さくするのが望ましいです（workspace 側で使用しているパッケージを流用するのもよいかも）。


ここでは、次の 2 つのタスクを実装することを想定します（タスクの実装部は一部省略）。

* `generate-docs` - ドキュメントを生成し、指定されれば HTTP サーバを起動する
* `script` - `(project_root)/bin/` にパスを通した後、指定したコマンドを実行

```rust
// xtask/src/main.rs

use std::ffi::OsStr;
use std::env;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use anyhow::{anyhow, ensure};
use clap::{App, AppSettings, ArgMatches, SubCommand};

fn main() -> anyhow::Result<()> {
    let app = clap::App::new("xtask")
        .setting(AppSettings::SubcommandRequiredElseHelp)
        .subcommand(
            SubCommand::with_name("generate-docs")
                .arg(Arg::from_usage("-s, --serve 'Serve on 0.0.0.0:8000'"))
        )
        .subcommand(
            SubCommand::with_name("script")
                .arg(Arg::from_usage("<name>   'Script name'"))
                .arg(Arg::from_usage("[args].. 'Script arguments'"))
        );

    match app.get_matches() {
        ("generate-docs", Some(arg)) => {
            let serve = arg.is_present("serve");
            do_generate_docs(serve)?
        },
        ("script", Some(arg)) => {
            let name = arg.value_of_os("name").unwrap();
            let args = arg.values_of_os("args");
            do_run_script(name, args)?
        },
        _ => unreachable!(),
    }

    Ok(())
}

// Rust で実装されたドキュメント生成・HTTPサーバ実行タスク（省略）
fn do_generate_docs(serve: bool) -> anyhow::Result<()> { ... }

fn do_run_script(name: &OsStr, args: Option<clap::Values<'_>>) -> anyhow::Result<()> {
    let mut script = Command::new(name);
    script
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    if let Some(args) = args {
        script.args(args);
    }

    // <project-root>/bin があればパスの先頭に追加しておく
    let scripts_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR")).join("../bin");
    if scripts_dir.is_dir() {
        let scripts_dir = scripts_dir.canonicalize()?;
        if let Some(orig_path) = env::var_os("PATH") {
            let new_path = env::join_paths(
                Some(scripts_dir).into_iter().chain(env::split_paths(&orig_path))
            )?;
            script_command.env("PATH", new_path);
        }
    }

    let status = script_command.status()?;
    ensure!(status.success(), "script is failed with: {}", status);

    Ok(())
}
```

ここで `script` タスクを用意するのは cargo-xtask の目的と相反して本末転倒な気もしますが、既存のタスクから徐々に移行するためにしばらくはこのようにハイブリットな運用をしても良いと思います。上のように実装したタスクは、次のようにして呼び出すことが出来ます。

```shell-session
$ cargo xtask generate-docs
$ cargo xtask script install-git-hooks
```

必要であれば、追加のエイリアスを定義してタイプ量を削減させるのも良いかもしれません。

```diff:.cargo/config
[alias]
xtask = "run --manifest-path ./xtask/Cargo.toml --"
+xscript = "xtask script"
```

```shell-session
$ cargo xscript deploy
```

xtask 導入後のプロジェクト構成は次のようになっています。

```
.
├── bin
│   └── deploy
├── Cargo.lock
├── Cargo.toml
├── README.md
├── src
│   └── lib.rs
└── xtask
    ├── Cargo.toml
    └── src
        └── main.rs
```

# See also

* [Custom tasks in Cargo &middot; Aaron Turon](http://aturon.github.io/tech/2018/04/05/workflows/)
  - `cargo task` サブコマンドを追加し `Cargo.toml` に mix-in 用の `[tasks]` セクションを設けようというアイデア

<!-- links -->

[`cargo-xtask`]: https://github.com/matklad/cargo-xtask
[`cargo-make`]: https://github.com/sagiegurari/cargo-make

