+++
title = "polyfuse で Gist as filesystem を実装する"
date = 2019-12-14
draft = true

[taxonomies]
categories = [ "programming" ]
tags = [ "rust", "fuse", "polyfuse", "gist-fs" ]
+++

[前回の記事の最後でも言及しましたが](../polyfuse/#owarini)、`polyfuse` のサンプルとして Gist をマウントするファイルシステムを実装していきます。

リポジトリ: [`ubnt-intrepid/gist-fs`](https://github.com/ubnt-intrepid/gist-fs)

<!-- more -->

# gist-fs の概要

元ネタは次の記事で紹介されている [`gist-fs`](https://github.com/ueokande/gist-fs) です。
[`go-fuse`](https://github.com/hanwen/go-fuse) を使用した Go 製のファイルシステムであり、Gist 一覧の取得、Gist 内のファイルの取得・更新が実装されています。

* [Gistをファイルシステムとしてマウントする - Qiita](https://qiita.com/ueokande/items/95eb4098d776ffc02b01)

今回は、上のファイルシステムの実装を参考にしつつ、`polyfuse` を用いて Rust に移植していく方針を取ります。
ただし、実装を簡略化すること、およびユーザの全 Gist を間違えて消去してしまうような事故を防止することを考慮し、一度にマウントできる Gist は一つのみとします。
また、現時点で `polyfuse` には `go-fuse` における `nodefs` に相当する機能は実装されていないため、inode の管理は自前で行います。

Gist の ID およびアクセストークンは、次のようにファイルシステム起動時に渡すことにします。

```shell-session
$ export GITHUB_TOKEN=xxxxxxxx
$ gist-fs /path/to/mountpoint --gist-id <gist id>
```

ファイルシステムの起動後、まず Gist の内容を GitHub から取得し、それらを次のような形でマウントポイントに公開します。
`.gist` は Gist のメタデータを公開するためのディレクトリであり、REST API のレスポンスの一部を公開するために使用します。
簡便化のため、各ノードの inode 番号はファイルシステム起動時に一意に割り当てられ実行中にノードの変動はないものと仮定します。

```
/path/to/mountpoint     - ino = 1
  ├── .gist             - ino = 2
  │    ├── description  - ino = 3
  │    ├── id           - ino = 4
  │    └── public       - ino = 5
  │        ...
  ├── file1.txt         - ino = offset
  └── file2.txt         - ino = offset + 1
      ...
```

Gist の内容は [REST API](https://developer.github.com/v3/gists/#get-a-single-gist) を用いて
ルートディレクトリ（上図における `/path/to/mountpoint`）がオープンされたタイミングで
取得するようにします。
ただし、必要以上にリクエストを飛ばすのを防ぐため、レスポンスは指定した時間間隔でキャッシュするようにします。

## ファイルの読み込み

本体のデータ自体は上で取得したレスポンスにも含まれていますが、このデータはファイルのサイズが大きい場合省略される可能性があります（`truncated: true` がセットされる）。
そのため、ファイル本体のデータは該当する inode がオープンされたタイミングで `raw_url` で指定された URL から直接取得するようにします。
`open` の呼び出し側がブロックしてしまうことになりますが、その辺は今回は妥協することにします（`poll` の実装を併用して上手くポーリングすると良いですが、そこまでの気力はないので今回はスルーします）。

## ファイルの書き込み

変更されたファイルデータは、該当するファイルの inode が閉じるタイミングで GitHub に送信するものとします。
[API では複数のファイルに対する変更を同時に送信出来るようですが](https://developer.github.com/v3/gists/#edit-a-gist)、今回はそのような最適化は行いません。

## ファイルの追加・削除

ノードを追加・削除するときの inode 番号を管理するのが面倒なので、今回はファイルシステムの実行中に Gist 内のファイルが追加・削除されないものと仮定し、`mknod`/`unlink` などの実装は対象外とします。
