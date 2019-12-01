+++
title = "Announcing polyfuse - A FUSE library for Rust -"
date = 2019-12-10
draft = true

[taxonomies]
tags = [ "rust", "fuse", "polyfuse", "async_await" ]
categories = [ "programming" ]
+++

[Rust Advent Calendar 2019](https://qiita.com/advent-calendar/2019/rust) 10日目の記事です。

前回は [`@cipepser`](https://qiita.com/cipepser) さんの「["untitled"](https://qiita.com)」でした。

本記事では、拙作の FUSE ライブラリである [`polyfuse`] を紹介します。

<!-- more -->

# FUSE の概略

[FUSE (Filesystem in Userspace)](https://en.wikipedia.org/wiki/Filesystem_in_Userspace) とは、ユーザ空間でファイルシステムを実装するための仕組みです。
本来ならカーネルモジュールとして実装する必要があるファイルシステムを（ユーザ空間で動作する）実行ファイルとして動作させることで、ファイルシステムを簡単に作成・配布することが出来るようになります。
同様の仕組みとして、NetBSD の [puffs](https://en.wikipedia.org/wiki/PUFFS_(NetBSD)) や、 WSL が Windows 側に rootfs を公開するためのプロトコルとして採用したことでも知られる [9P](https://en.wikipedia.org/wiki/9P_(protocol)) などがあります。
FUSE を用いたファイルシステムの実装として、SSH 経由でネットワーク越しにディレクトリをマウントする [SSHFS](https://github.com/libfuse/sshfs) などが知られています。
FUSE については下の記事が参考になるかもしれません。

* [FUSE を使用して独自のファイルシステムを開発する](https://www.ibm.com/developerworks/jp/linux/library/l-fuse/index.html)
* [FUSE - 覚えたら書く](https://blog.y-yuki.net/entry/2016/10/29/003000)

FUSE のアーキテクチャは下図のようになります。
FUSE はカーネル空間で動作し VFS との橋渡しを行う FUSE カーネルモジュール（図中左下にある緑色の四角）と、ユーザ空間で動作し実質的な処理を行う FUSE ファイルシステムデーモン（図中左上の四角）とが連携することでファイルシステムとしての動作を実現します。
FUSE カーネルモジュールとの接続の確立は、モジュールロード時に登録されるキャラクタデバイス `/dev/fuse` をオープンし `mount` システムコールを介してパラメータを指定することで行います（実際には、`mount` を呼び出す権限を持たない非特権ユーザに対応するために後述する回避策が取られます）。

<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/0/08/FUSE_structure.svg" alt="FUSE structure" />
  <p>
  <small>
    <a href="https://en.wikipedia.org/wiki/Filesystem_in_Userspace#/media/File:FUSE_structure.svg">FUSE structure.svg</a>
    @<a href="https://commons.wikimedia.org/wiki/User:Sven">Sven</a>
    (<a href="https://creativecommons.org/licenses/by-sa/3.0/">Licensed under CC BY-SA 3.0</a>)
  </small>
  </p>
</div>

プロセス（図中左上の四角）がシステムコールを呼び出す、カーネルがページキャッシュやディレクトリエントリキャッシュを更新するなどの理由で VFS に要求が発行されると、FUSE カーネルモジュールは FUSE ファイルシステムに対するリクエストを作成し、それをキューの末尾に追加します。
FUSE ファイルシステムデーモンは、キューに蓄えられたリクエストを先ほどオープンした `/dev/fuse` を `read`/`readv` することで逐次取り出し、それらに対する処理を実行します。
リクエストの処理結果は `/dev/fuse` に対し `write`/`writev` を呼び出すことでカーネルへと返され、その後の処理をFUSE カーネルモジュールが継続して行い、ファイルシステムとしての動作を完了します。

キャッシュやバックグラウンドでの動作などがが絡んでくるので、実際の挙動はもう少し複雑なものになります。
下の資料に FUSE カーネルモジュールの内部構造についての説明があるので、FUSE の内部実装に興味のある人は目を通すと良いかもしれません。

* (PDF) [To FUSE or Not to FUSE: Performance of User-Space File Systems](https://www.usenix.org/system/files/conference/fast17/fast17-vangoor.pdf)

# Rust の FUSE 事情

Rust で FUSE によるファイルシステム実装を行う場合、次に挙げる選択肢が上げられます。

## FUSE プロトコルを自力で実装する

原理的には、FUSE カーネルモジュールとの接続を確立し、その通信路に対する `read`/`write` さえ出来れば FUSE ファイルシステムの実装は可能です。
実装するファイルシステムの規模にもよりますが、移植性云々を無視するのであればカーネルとの通信部をフルスクラッチで実装してしまうのも一つの手だと思います（ほんとに？）。
FUSE のプロトコルに関する詳細は、（断片的ですが）以下の解説記事が参考になるかもしれません…

* [FUSE protocol tutorial for Linux 2.6 - pts.blog](http://ptspts.blogspot.com/2009/11/fuse-protocol-tutorial-for-linux-26.html)
* [The FUSE Wire Protocol](https://nuetzlich.net/the-fuse-wire-protocol/)
* [The FUSE Protocol - John Millikin](https://john-millikin.com/the-fuse-protocol)

## [`libfuse`] を FFI 経由で呼び出す

プロトコル部分の実装は車輪の再開発以外の何物でもないため、通常は、FUSE を扱うためのライブラリを併用し、ファイルシステムとして動作するために必要な処理のみを実装します。
`libfuse` は C 言語による FUSE ライブラリの参照実装であり、多くの言語の FUSE ライブラリは `libfuse` を FFI 経由で呼び出すラッパーとして FUSE の実装を実現しています。
Rust で `libfuse` をバインディングした FUSE ライブラリは（簡単に検索した限り）存在しないため、下の記事の例のように `bindgen` を併用するなどして直接 C の関数を呼び出す必要があります（以前に[Rust 向けの `libfuse` バインディングを作ろうとした](https://github.com/ubnt-intrepid/libfuse-rs)時期があったのですが、非同期処理への対応が難しく旨味がなさそうだったので開発を断念しました）。

* [Rust&#39;s Bindgen + Fuse in 2019 - DEV Community 👩‍💻👨‍💻](https://dev.to/kdrakon/rust-s-bindgen-fuse-in-2019-2e8l)

## [`fuse-rs`] を使用する

`fuse-rs`（旧 `rust-fuse`）は以前から存在していた Rust の FUSE ライブラリです。
`libfuse` を単純にバインディングするのではなく FUSE カーネルモジュールとの通信部を Rust で再実装することで、FFI によるオーバヘッドが生じない設計になっています（ただし、カーネルとの接続の確立に `libfuse` の API を使用しているためリンクが必要）。
`libfuse` における lowlevel API 相当の機能が実装されています。
`fuse-rs` については公式リポジトリや下記の記事を併せてご参照ください。

* [RustでFUSE - Qiita](https://qiita.com/hhatto/items/8bcb89d76eef69bc36ba)

# `polyfuse`

`polyfuse` は、`fuse-rs` と同様に `libfuse` を介さずに Rust の機能をフルで活用した FUSE によるファイルシステムを実装するためのライブラリです。
後発のライブラリということもあり、`fuse-rs` との差別化を図るため次のような点に重視して開発を進めています。

* `async`/`.await` への完全対応
* リクエスト処理の多重化
* ファイルシステムからカーネルへの通知をサポート
* `libfuse` へのリンクが不要

## Hello, polyfuse

手始めに、何もしないファイルシステムを作り、動作確認を行います。
まずはじめに、ファイルシステムのパッケージを作成します。

```shell-session
$ cargo new --bin hello
```

作成したパッケージに依存関係を追加していきます。
ファイルシステムを動かすためには、使用する非同期ランタイムに対応したサーバの実装を用いる必要があります。
現時点では `tokio` サポートのみを提供していますが、将来的には `async-std` への対応を追加したいと考えています（`tokio::io::PollEvented` 相当の API がないため現時点では対応できない）。

```toml
[dependencies]
polyfuse = "0.2"
polyfuse-tokio = "0.1"

anyhow = "1"
tokio = { version = "0.2", features = [ "full" ] }
tracing = "0.1"
tracing-subscriber = "0.1"
```

`rust-fuse` における[最小構成のコード](https://qiita.com/hhatto/items/8bcb89d76eef69bc36ba#%E6%9C%80%E5%B0%8F%E6%A7%8B%E6%88%90%E3%81%A7%E5%8B%95%E3%81%8B%E3%81%97%E3%81%A6%E3%81%BF%E3%82%8B)に相当するサンプルの実装は次のようになります。
ファイルシステム本体の実装するトレイト [`Filesystem`] は `async-trait` を用いて定義されているので本来であれば実装側にも `#[async_trait]` が必要になりますが、今回はデフォルト実装を用いるため不要です。
ログ出力には [`tracing`](https://crates.io/crates/tracing) を用いているため、`env_logger` ではなくこちらを使用します。

```rust
use polyfuse::Filesystem;

struct EmptyFS;

impl<T> Filesystem<T> for EmptyFS {}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let mountpoint = std::env::args_os()
        .nth(1)
        .map(std::path::PathBuf::from)
        .ok_or_else(|| anyhow::anyhow!("missing mountpoint"))?;
    anyhow::ensure!(
        mountpoint.is_dir(),
        "the mountpoint must be a directory",
    );

    polyfuse_tokio::mount(EmptyFS, &mountpoint, &[]).await?;
    Ok(())
}
```

適当な場所に空のディレクトリを作成し、その場所をマウントポイントにしてファイルシステムを起動します。例えば、`/tmp/emptyfs` をマウントポイントにする場合は次のように実行します。

```shell-session
$ mkdir /tmp/emptyfs
$ cargo run /tmp/emptyfs
```

> ファイルシステムを実行するためには `fuse` カーネルモジュールをロードする必要があります。
> 有効化されていない場合は、次のようにモジュールをあらかじめロードしておいてください。
> 正常にロードされていれば、`/dev/fuse` というキャラクタデバイスが追加されているはずです。
> また、コンテナ内でテストする場合はホスト側の `/dev/fuse` がコンテナ側にマウントされている必要があります。
>
> ```shell-session
> $ sudo modprobe fuse
> ```

> ファイルシステムの動作には `fusermount` という setuid ビットが付与された実行ファイルが必要になります。
> この実行ファイルは適切な権限（Linux では `CAP_SYS_ADMIN` ケーパビリティ）を持たない非特権ユーザが `mount` システムコールを呼び出すことなくファイルシステムのマウントを行うために用いられ、通常はディストリビューションが提供する `fuse` パッケージに同梱されています。
> 例えば Arch Linux の場合、次のようにしてパッケージをインストールすることができます（`fuse3` ではない点に注意）。
>
> ```shell-session
> $ sudo pacman -S fuse2 # Arch Linux
> ```

別途シェルを開き、先ほど指定したマウントポイントに対して適当な操作をしてみます。
現時点ではファイルシステムとして必要な機能が何も実装されていないので、次のように `ENOSYS` に相当するエラーメッセージが表示されるはずです。

```shell-session
$ stat /tmp/emptyfs
stat: cannot stat '/tmp/emptyfs': Function not implemented

$ ls /tmp/emptyfs
ls: cannot access '/tmp/emptyfs': Function not implemented
```

プロセスに `Ctrl+C` を送信するか `fusermount -u <mountpoint>` を実行することでファイルシステムを終了することが出来ます。

リポジトリの [`examples/`](https://github.com/ubnt-intrepid/polyfuse/tree/master/examples) ディレクトリにサンプルのファイルシステムをいくつか公開しているので、そちらも併せて参照してください（数は少ないですが…）。

# 今後の課題

本ライブラリの開発は数か月前に始めたものであり、`async`/`.await` の安定化に併せてリリースするために急いだ事もあっていくつかの機能に制限を設けています。

## FreeBSD/macOS 対応

FUSE 自体は FreeBSD や macOS でも利用することが出来ますが、使用するプロトコルのバージョンの関係上、現在のバージョンではそれらのサポートを（意図的に）除外しています。
特に macOS は、筆者が Apple の開発機を所持していないため現時点で行う予定はありません（ほんとはやりたいと思ってるんですよ。でも自分が使えない環境のサポートってモチベーションが(ry）。
協力者求む…

## バッファコピーの効率化

FUSE はユーザ空間でファイルシステムが動作するため、カーネル側からのデータ転送時にバッファコピーの追加コストが生じるという欠点があります。
カーネル空間とユーザ空間の間のコピーを抑えるための手段として [`splice(2)`](https://linuxjm.osdn.jp/html/LDP_man-pages/man2/splice.2.html) などが知られており、`libfuse` ではこのシステムコールを用いて不要なコピーが生じないようにしています。
`polyfuse` では現時点ではこの問題に対する対処をしていませんが、将来的にはサポートしたいと考えています（`fuse-rs` との差別化を目指すならばぜひ着手したいとは思っている）。

## inode ベースの高レベル API の実装

現時点では `fuse-rs` と同様に `libfuse` の lowlevel API 相当の機能しか実装できていませんが、これはファイルシステムを作成するにあたって非常に使いづらいものになっています。
[`go-fuse`](https://github.com/hanwen/go-fuse) などは高レベルの API を提供しているみたいなので、それを参考により使いやすい API を考えていくことが今後の課題になります。

# おわりに

駆け足ですが、FUSE ライブラリである `polyfuse` を紹介しました。

数日前から、実用的なファイルシステムを書くための実験として [`gist-fs`](https://github.com/ubnt-intrepid/gist-fs) の実装をはじめました。
今後はこいつをちまちま更新しつつ、より使いやすいライブラリにしていこうと思っています。

<!-- links -->

[`libfuse`]: https://github.com/libfuse/libfuse
[`fuse-rs`]: https://github.com/zargony/fuse-rs
[`polyfuse`]: https://github.com/ubnt-intrepid/polyfuse

[`Filesystem`]: https://docs.rs/polyfuse/0.2/polyfuse/trait.Filesystem.html
