+++
title = "非同期処理で書き込むメモリを（ちゃんと）守るためのエトセトラ (1)"
date = "2020-06-08T03:04:39"

[taxonomies]
tags = ["rust", "futures"]
categories = ["programming"]
+++

@termoshtt 氏の記事にあるライフタイムによる制限が期待通りに機能しない理由を解説してみたいと思います。

* 元記事: https://qiita.com/termoshtt/items/0db8d1ba81445892d0de

僕自身も完全に理解できているわけではないので、初歩的な間違いを含んでいる可能性がありますがご了承ください。

<!-- more -->

# 問題設定

例として、次のような仮想的な非同期 I/O ライブラリの futures バインディングを作ることを考えます。
このライブラリは、使用したい I/O の要求を発行すると対応するトークンを生成し、そのトークンを用いることで実行結果を非同期的に取得するような方式を採用しています。
例えば、`read(2)` に対応する `start_read` を呼び出すと内部で I/O 要求がキューに登録され、結果を受け取るためのトークンがアプリケーション側に返されます。
アプリケーションが `wait_complete` を呼び出すとトークンに対応する I/O が完了するまで現在のスレッドをブロックし、その結果を待機します。
また、アプリケーションは `cancel` によって I/O のキャンセルを行うことができます。指定するトークンが完了していない場合、その結果は `-ECANCELLED` を返すものとします。

```c
typedef int token_t;

/* fd から buf への読み込みを開始する。*/
token_t start_read(int fd, void* buf, size_t len) {
    /* ... */
}

/* 指定したトークンの I/O の完了を待機する。*/
/* 戻り値が負の場合は -errno が格納されている。 */
int wait_complete(token_t token) {
    /* ... */
}

/* 指定したトークンの I/O をキャンセルする */
void cancel(token_t token) {
    /* ... */
}
```

上記 API を呼び出すための FFI バインディングは次のようにしておけば良いでしょう。

```rust
mod sys {
    use std::os::unix::io::RawFd;
    use libc::{c_int, c_void};

    type token_t = c_int;

    extern "C" {
        pub fn start_read(fd: RawFd, buf: *mut c_void, len: usize) -> token_t;
        pub fn wait_complete(token: token_t) -> c_int;
        pub fn cancel(token: token_t);
    }
}
```

この非同期 I/O ライブラリを安全に扱うための Rust バインディングを考えていきましょう。
今回は、[`std::io::Read::read`] を参考にして、次のように書き込む対象となるバッファのスライスを渡すインタフェースを採用することにします。
少々形式が異なりますが、ここにおける `read` は、元記事における lifetime 付与版の `Memcpy::copy_from` に概ね対応しています。

[`std::io::Read::read`]: https://doc.rust-lang.org/stable/std/io/trait.Read.html#tymethod.read

```rust
use std::io;
use std::os::unix::prelude::*;
use futures::future::Future;
use tokio::task::spawn_blocking;

pub async fn read(fd: &impl AsRawFd, buf: &mut [u8]) -> io::Result<usize> {
    // I/O 要求を発行する
    let token = unsafe {
        sys::start_read(
            fd.as_raw_fd(),
            buf.as_mut_ptr().cast::<c_void>(),
            buf.len(),
        )
    };

    // wait_complete はブロックするため、別スレッドに退避させて実行する
    let join = spawn_blocking(move || unsafe { sys::wait_complete(token) });

    match join.await {
        Ok(rc) if rc >= 0 => Ok(rc as usize),
        Ok(rc)            => Err(io::Error::from_raw_os_error(-rc)),
        Err(join_err)     => Err(io::Error::new(io::ErrorKind::Other, join_err)),
    }
}
```

`read` は async なので、その戻り値は `Future` を実装した匿名型になります。
この future は `buf` の可変借用を保持しているため、`.await` で消費される前に `buf` にアクセスするとコンパイルエラーとなり、データ競合となる可能性のあるアクセスを禁止しています。

```rust
let file = File::open("/path/to/file")?;
let mut buf = vec![0u8; 1024];

let future = read(&file, &mut buf[..]);

// future が buf の mutable reference を持っているので外からアクセスできない
// buf.extend_from_slice(&other);
// ^~ error[E0499]: cannot borrow `buf` as mutable more than once at a time

let n = future.await?;

// I/O が完了したので安全に書き込める
buf.extend_from_slice(&other);
```

# そのfuture、正しくキャンセルできてる？

上の例ではキャンセル処理について無視していましたが、実際には future のキャンセルを考慮しないとデータ競合を引き起こしてしまう危険があります。

Rust の非同期タスクでは、future が `Poll::Ready` を返す前に `poll` の呼び出しをやめることでタスクの駆動が中断される可能性を考慮に入れる必要があります。
今回の場合、次のように `read` が返す future が中途半端に駆動された状態で drop することで I/O が完了する前に buf へのアクセスが可能な状況を作ることができてしまいます。

```rust
use futures::pin_mut;

let future = Box::pin(read(&file, &mut buf[..]));

// 中途半端に駆動された状態を再現するため、ここでは future を一回だけ polling した後 drop する
pin_mut!(future.as_mut())
drop(future);
// ^~ この時点で future が保持する buf の可変借用が解放される

// この時点で I/O が完了していないため、書き込みが競合する可能性がある
buf.copy_from_slice(&other);
```

`epoll` + ノンブロッキング I/O のような、利用可能になるまで待機したあとに I/O を実行するケースではこのような問題が生じることは余りありません。（単に I/O 要求が発行されずに中断するため）
今回の例のような I/O 要求を発行したあとその完了を非同期的に待機するようなケースでこのような問題が発生することは Rust コミュニティにおいて割と前から知られており（下記リンクなどを参照）、Linux の io_uring や Windows の IOCP などの非同期 I/O に対する futures バインディングを作成する際の大きな課題となっています。

* https://gist.github.com/Matthias247/ffc0f189742abf6aa41a226fe07398a8
* https://boats.gitlab.io/blog/post/io-uring/

# ドロップによるキャンセル処理（およびその問題点）

ここでは、`read` のシグネチャを変えることなく、future が キャンセルされた際に適切なクリーンアップ処理を実行し、drop された後の buf へのアクセスがデータ競合を起こさないような実装を考えてみます。
先に述べておくと、ここでの対処は本質的な解決にはなっていません。

今回の場合、キャンセル時に行うべき処理は次のようになります。

1. 非同期 I/O のキャンセルを `cancel` を用いてライブラリに通知する
2. I/O が中断されたことが分かるまで待機する

これらの処理を `drop` に行う型を用意し、`spawn_blocking` が返す future の `.await` 前後で生存するよう初期化しておけば良さそうです。
別スレッドからの通知を受け取るまでブロックするための方法は条件変数を使うのが一般的ですが、ここでは `crossbeam` が提供している `Parker` を使用します（内部で `Condvar` を使っているので実質的には同じ）。

* https://docs.rs/crossbeam/0.7.3/crossbeam/sync/struct.Parker.html

```rust
use crossbeam::sync::Parker;

struct CancelOnDrop {
    token: sys::token_t,
    parker: Option<Parker>,
}

impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        if let Some(parker) = self.parker.take() {
            unsafe {
                let _ = sys::cancel(token);
            }

            // Unparker からの通知があるまで待機する
            parker.park();
        }
    }
}

pub async fn read(fd: &impl AsRawFd, buf: &mut [u8]) -> io::Result<usize> {
    let token = unsafe {
        sys::start_read(
            fd.as_raw_fd(),
            buf.as_mut_ptr().cast(),
            buf.len(),
        )
    };

    let parker = Parker::new();
    let unparker = parker.unparker().clone();

    let join = spawn_blocking(move || {
        let rc = unsafe { sys::wait_complete(token) };

        // Parker に I/O の完了を通知する
        unparker.unpark();

        rc
    });

    // ドロップ時に cancel を実行するための RAII ガード
    let mut guard = CancelOnDrop { token, parker: Some(parker), };

    // wait_complete の結果を待機する
    // .await で中断している間に future が drop されると、上述の guard によりキャンセル処理が実行される
    let result = join.await;

    // I/O は完了済みなので、これ以降キャンセル処理が走らないようにする
    let _ = guard.pair.take();

    match result {
        Ok(rc) if rc >= 0 => Ok(rc as usize),
        Ok(rc)            => Err(io::Error::from_raw_os_error(-rc)),
        Err(join_err)     => Err(io::Error::new(io::ErrorKind::Other, join_err)),
    }
}
```

この実装の明らかな問題点は、`drop` によって使用側の future を実行するスレッドがブロックしてしまい、同じスレッドで管理されているタスクの実行を妨げてしまうことです。
本来他の仕事をするための futures バインディングなのにスレッドごとブロックしてしまうのは本末転倒であり、パフォーマンスが大幅に低下してしまう可能性があります。

また drop の実行は `std::mem::forget` によって（安全に）抑制できてしまうので、上記キャンセル処理が期待通りに走る保証は残念ながらありません。
Rust において drop の抑制は安全性に関する保証の対象外であり、ライブラリの作者はユーザが  `mem::forget` や `ManuallyDrop` を使用することによってデータ競合が生じないよう注意して設計する必要があります。
`std::mem::forget` が unsafe でない理由については下記も参照してください。

* https://doc.rust-lang.org/stable/std/mem/fn.forget.html#safety
* https://qnighy.hatenablog.com/entry/2017/04/14/070000

# おわりに

本記事では、Rust による非同期 I/O の futures バインディングと、そのキャンセルに関わるデータ競合の問題点について述べました。
次回は（あれば）、データ競合の回避を考慮しつつキャンセル時のブロックを伴わないような方法を検討してみます。
