+++
title = "polyfuse で Gist as filesystem を実装する"
date = 2019-12-14
draft = true

[taxonomies]
categories = [ "programming" ]
tags = [ "rust", "fuse", "polyfuse", "gist-fs" ]
+++

[前回の記事の最後でも言及しましたが](../polyfuse/#owarini)、`polyfuse` のサンプルとして Gist をマウントするファイルシステムを実装していきます。

<!-- more -->

# 概要

元ネタは次の記事で紹介されている [`gist-fs`](https://github.com/ueokande/gist-fs) です。
[`go-fuse`](https://github.com/hanwen/go-fuse) を使用した Go 製のファイルシステムであり、Gist 一覧の取得、Gist 内のファイルの取得・更新が実装されています。

* [Gistをファイルシステムとしてマウントする - Qiita](https://qiita.com/ueokande/items/95eb4098d776ffc02b01)

今回は、上のファイルシステムを `polyfuse` で実装していきます。
現時点で `polyfuse` には `go-fuse` における `nodefs` に相当する機能は提供していないため、これのプロトタイプの実装も並行して行うことにします（というより、このプロトタイプの実装が主要な目的のひとつ）。

# ファイルシステムの概観

基本的には、上のファイルシステムの実装を参考にします。
ただし、実装を簡略化すること、およびユーザの全 Gist を間違えて消去してしまうような事故を防止することを考慮し、一度にマウントできる Gist は一つのみとします。
次のように、ファイルシステムを起動する時に ID を指定するようにします。

```shell-session
$ gist-fs /path/to/mountpoint --gist-id <gist id>
```

ファイルシステムが起動されると、次のように Gist の内容がマウントポイントに公開されます。
`.gist` は Gist のメタデータを公開するためのディレクトリであり、REST API のレスポンスの一部を公開するために使用します。

```
/gist
  ├── .gist
  │    ├── description
  │    ├── id
  │    └── public
  ├── file1.txt
  └── file2.txt
      ...
```

Gist の内容は [REST API](https://developer.github.com/v3/gists/#get-a-single-gist) を用いて取得します。
この API の呼び出しは、次のタイミングで行われるようにします（ただし、指定した時間間隔でキャッシュするようにする）。

* ファイルシステムの起動時
* ルートディレクトリ（上図における `/gist`）に対し `FUSE_OPENDIR` が呼ばれたとき

ファイルの内容は上で用いた API のレスポンスにも含まれますが、サイズが大きい場合 `truncated: true` がセットされ省略される可能性があります。
その場合、ファイルのオブジェクトが持つ `raw_url` フィールドの URL に直接コンテンツを取得する必要があります。
この時のリクエストの発行・内容の取得は該当ファイルに対し `FUSE_OPEN` が呼ばれた時に行うものとします。
`open` の呼び出しがブロックすることになりますが、その辺は今回は妥協することにします（上手くポーリング周りを実装すれば良い気がするがそこまでの気力はない）。

変更されたファイルの送信は、元ネタと同様に該当ファイルに対し `FUSE_FLUSH` が呼ばれた時に行います。
[API では複数のファイルに対する変更を同時に送信出来るようですが](https://developer.github.com/v3/gists/#edit-a-gist)、今回はそのような最適化は行いません。

ファイルの追加・削除は出来なくはないと思いますが、そこまで考えてしまうと書き込み対象のファイルが（外的要因で）削除され存在しないときにカーネルへの通知が必要になってしまい面倒なので、今回は対象外とします。
良いパフォーマンスになるため、余裕があれば対応したいと思います。
