+++
title = "Twitterシェアのフォームにタイトルを挿入する"
date = 2017-10-06T00:08:37Z

[taxonomies]
tags = [ "hexo" ]
categories = [ "general" ]
+++

デフォルトのテーマである `landspace` ではシェアするときにページのタイトルが挿入されないので、出来るように修正した。

<!-- more -->

Twitter のシェアフォーム (`twitter.com/intent/tweet`) ではパラメータ `text` に渡した文字列を URL の前に挿入してくれるのでそれを用いる。

`themes/landscape/source/js/script.js`
```diff
@@ -39,7 +39,9 @@
 
     var $this = $(this),
       url = $this.attr('data-url'),
+      title = $('title').html() + '\n',
       encodedUrl = encodeURIComponent(url),
+      encodedTitle = encodeURIComponent(title),
       id = 'article-share-box-' + $this.attr('data-id'),
       offset = $this.offset();
 
@@ -55,7 +57,7 @@
         '<div id="' + id + '" class="article-share-box">',
           '<input class="article-share-input" value="' + url + '">',
           '<div class="article-share-links">',
-            '<a href="https://twitter.com/intent/tweet?url=' + encodedUrl + '" class="article-share-twitter" target="_blank" title="Twitter"></a>',
+            '<a href="https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedTitle + '" class="article-share-twitter" target="_blank" title="Twitter"></a>',
             '<a href="https://www.facebook.com/sharer.php?u=' + encodedUrl + '" class="article-share-facebook" target="_blank" title="Facebook"></a>',
             '<a href="http://pinterest.com/pin/create/button/?url=' + encodedUrl + '" class="article-share-pinterest" target="_blank" title="Pinterest"></a>',
             '<a href="https://plus.google.com/share?url=' + encodedUrl + '" class="article-share-google" target="_blank" title="Google+"></a>',
```

単純に JQuery でページのタイトルを持ってきてパラメータ渡すときに挿入するだけ。
もう少し賢い解決策があれば教えてください…
