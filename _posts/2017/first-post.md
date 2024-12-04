---
title: 立ち上げました
date: "2017-10-05"
tags: [ "hexo" ]
categories: [ "general" ]
---

Hugo で MathJaX の設定をしようと思ったら良くわからなかったので Hexo で作り直しました。
Hugo の方はまだ今度トライします…

<!-- more -->

# ブログ立ち上げの作業手順
作業メモです。

## プロジェクトの初期化
適当なディレクトリを作ったあと `hexo init` で初期化出来る。
```bash
$ mkdir -p /path/to/blog && cd $_
$ git init
$ hexo init
```

あとは `_config.yml` いじったり `hexo server` で確認しつつ記事を書く。
Hugo とは異なり `--watch` なしでも変更を追跡してくれるみたい。

## Disqus の設定
[こちら](https://azriton.github.io/2017/02/26/Hexo%E3%81%AB%E3%82%B3%E3%83%A1%E3%83%B3%E3%83%88%E6%AC%84%E3%81%AEDisqus%E3%82%92%E8%A8%AD%E7%BD%AE/)の設定を参考にしつつ Disqus のアカウントを作成し、
リポジトリ直下の `_config.yml` に Disqus のショートネームを追記する

```yaml
# _config.yml
...
disqus_shortname: [shortname]
```

## Google Analytics の設定
[こちら](https://azriton.github.io/2016/12/20/Hexo%E3%81%ABGoogle-Analytics%E3%82%92%E8%A8%AD%E7%BD%AE%E3%81%99%E3%82%8B/)を参考にしつつ Google Analytics のアカウントを作成し、Tracking ID を__テーマ直下の__ `_config.yml` に記述する。

```yaml
...
google_analytics: UA-xxxxxxxxx-x
```

## GitHub Pages へのデプロイ
`hexo deploy` が使えるので便利。

まず、使用するプラグインをインストールしておく（要らないかもしれない）。

```
$ npm install --save hexo-deployer-git
```

デプロイ用の設定は次のようにする。

```yaml
...
deploy:
  type: git
  repo: https://github.com/ubnt-intrepid/blog.git
  branch: gh-pages
  message: Hexo deploy
```

# おわりに
そんじゃーね