+++
title = "polyfuse で Gist as filesystem を実装する (1)"
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
ただし、実装の簡略化とユーザの全 Gist を間違えて消去してしまうような事故を防止するため、一度にマウントできる Gist は一つのみとします（ファイルシステムの起動時に該当 Gist の ID を指定する）。
また、現時点での `polyfuse` には `go-fuse` における `nodefs` に相当する機能は実装していないため、これのプロトタイプの実装も並行して行います。

# ファイルシステムの概観

```shell-session
$ gist-fs /path/to/mountpoint --gist-id <gist id>
```

ファイルシステムを起動すると、次のように Gist の内容がマウントポイントに公開されるようです。
Gist の一覧、および各 Gist の中身はディレクトリ・ファイルをオープンしたときに REST API を呼び出すことで取得しています（ただし、余計なリクエストを飛ばさないよう適当な時間間隔でキャッシュされる）。
ファイルの内容が変更された場合、`Flush` 時にその内容を PUSH します。

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

# Gist クライアントの実装
