+++
title = "cargo-version-sync の紹介"
date = "2018-10-30"
tags = [ "rust", "announce", "qiita" ]
categories = [ "programming" ]
+++

`crates.io` に自作のクレートを公開する際、`README.md` などに記載しているクレートのバージョンをリリース時に書き換えることを忘れてしまうことが稀によくあります。以前はこのような事故を防ぐために `cargo-release` で提供されている機能を使用していたのですが、リリース時にしか実行できない点などいまいち自分の好みと合わなかったので、バージョン番号のチェック・書き換えの部分だけを行う cargo サブコマンドを新しく作りました。

<!-- more -->

* https://github.com/ubnt-intrepid/cargo-version-sync

# 使い方

バージョン番号を書き換える対象となるファイルは、次のように `Cargo.toml` 内のメタデータとして指定します。このあたりの使用は `cargo-release` で用いられていたものを参考にしました。

```toml Cargo.toml
# package.metadata.version-sync.replacements という配列にバージョン番号を同期させたいターゲットを指定する（長い）。
[[package.metadata.version-sync.replacements]]
file = "README.md" # `CARGO_MANIFEST_DIR` からの相対パスを指定する
# ファイルの内容を書き換えるための replacer を指定する
# 将来的には潤沢させたい
replacers = [
  # 組み込みの replacer
  # target に指定可能な値は (0.0.2 時点では) 次の通り:
  #   - "markdown" : '{{package.name}} = "{{package.version}}"' というパターンを置き換える
  #   - "html-root-url" : docs.rs への URL を置き換える
  { type = "builtin", target = "markdown" },
]

[[package.metadata.version-sync.replacements]]
file = "src/lib.rs"
replacers = [
  # 正規表現を用いた replacer
  # 'search' には置換の対象となる正規表現、 'replace' には置換後の文字列を指定する
  # 記述を簡略化するためのいくつかのプレースホルダーが使用可能:
  #   - {{name}} : Cargo.toml から抽出した package.name の値 ('search' と 'replace' 両方で使用可能）
  #   - {{version}} : クレートのバージョン ('replace' のみ)
  #   - {{date}} : コマンドの実行日時 ('replace' のみ)
  { type = "regex", search = "https://docs.rs/foo/[0-9a-z\\.-]+", replace = "https://docs.rs/foo/{{version}}" },
]
```

`cargo-version-sync` を実行することでバージョン番号の更新を実行します。

```shell-session
$ cargo version-sync [--verbose]
```

## `cargo test` との連携
`cargo test` 実行時にバージョン番号の更新が行われているかを確認する方法です。後述する Git のカスタムフックと組み合わせることで、バージョン番号が更新されていない変更を誤ってコミット・マージしてしまうミスを防ぐことが出来ます。

```toml Cargo.toml
[dev-dependencies]
cargo-version-sync = { version = "0.0.1", default-features = false }
```

```rust tests/version_sync.rs
extern crate cargo_version_sync;

#[test]
fn test_version_sync() {
    cargo_version_sync::assert_sync();
}
```

## `cargo-husky` との連携

Git のカスタムフックを用いてコミット前にバージョン番号の更新を確認する方法です。ちょうど [`cargo-husky`](https://crates.io/crates/cargo-husky`) という便利なクレートがあるので、これを併用してフックスクリプトのインストールを自動化してしまいます。

```toml Cargo.toml
[dev-dependencies.cargo-husky]
version = "1"
default-features = false
features = ["user-hooks"]
```

`cargo version-sync` には `--check` というオプションが用意されており、これをつけて実行することでバージョン番号が全て更新されているかどうかをシェルスクリプト内で確認することが出来ます。例として、`cargo-fmt` によるフォーマットチェックと併用したスクリプトは次のようになります。

```sh .cargo-husky/hooks/pre-commit
#!/bin/bash

set -e

if cargo fmt --version >/dev/null 2>&1; then
    cargo fmt -- --check
fi

if cargo version-sync --version >/dev/null 2>&1; then
    cargo version-sync --check
fi
```

