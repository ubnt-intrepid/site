---
title: 非同期処理で書き込むメモリを（ちゃんと）守るためのエトセトラ (2)
date: "2020-06-10T02:48:34"
tags: ["rust", "futures"]
categories: ["programming"]
---

[前回](/memory-safety-in-async-1)は、非同期 I/O の futures バインディングにおいて、future の早期 drop によりデータ競合が生じてしまうこと、およびそれを防ぐためのキャンセル処理を実装すると future が drop されたときにスレッド全体がブロックしてしまう問題について説明しました。また、デストラクタによるクリーンアップ処理の実装は `mem::forget` を用いることで容易に回避できてしまうので、データ競合を防止するための解決策としては実質的には無意味なものであるということも最後に説明しました。
今回は、これらの問題点を踏まえつつ、データ競合の危険がない安全な方法を検討していきます。

<!-- more -->

# シグネチャの見直し

`read` のシグネチャを再検討してみましょう。
今回の場合、バッファの所有権は `read` の呼び出し側にあり、`read` はその可変借用を受け取ることで I/O が完了するまで他の場所でのバッファへのアクセスを禁止しています。
ところが、この借用は `read` が返す future 自身を削除・リークさせることで「安全に」無効化することができてしまいます。
これは、今回のような状況では（可変）借用によってバッファの書き込みを制限することがそもそも不適当だったという解釈をすることが出来ます。

I/O 側の動作を見直してみると、バッファの所有権は `start_read` にポインタを渡した時点で I/O 側に移り、`wait_complete` によって完了を確認するまで I/O 側で管理されているという見方をすることができます。
そこでここでは考え方を改め、`read` の呼び出し時にバッファを参照ではなく所有権ごと引き渡すようにするようにしてみます。使用済みのバッファは、future の戻り値として返すことにします。

```rust
use std::io;
use std::os::unix::prelude::*;
use futures::future::Future;
use tokio::task::spawn_blocking;

pub async fn read(fd: &impl AsRawFd, mut buf: Vec<u8>) -> (Vec<u8>, io::Result<usize>) {
    let token = unsafe {
        sys::start_read(
            fd.as_raw_fd(),
            buf.as_mut_ptr().cast::<c_void>(),
            buf.len(),
        )
    };

    spawn_blocking(move || {
        // バッファの所有権は spawn_blocking に渡すクロージャに移される

        let rc = unsafe { sys::wait_complete(token) };
        let result = if rc >= 0 {
            Ok(rc as usize)
        } else {
            Err(io::Error::from_raw_os_error(-rc))
        };

        // 書き込み済みのバッファを呼び出し側に返す
        (buf, result)
    })
    .unwrap_or_else(|join_err| Err(io::Error::new(io::ErrorKind::Other, join_err)))
}
```

上のようなシグネチャを採用することで、データ競合が起こりうるアクセスが（少なくとも unsafe を使わない限りは）できないことを確認します。バッファの所有権は `read` を呼び出した時点で移動し、future が完了しない限りアクセスすることはできず、コンパイルエラーとして検出されます。
バッファに再びアクセスするためには、future を評価しその戻り値を受け取る必要があります。
移動した `buf` の所有権を明示的に受け取る必要があるのでコードが若干不格好になってしまいますが、その点については今回は目をつぶることにします。

```rust
let buf = vec![0u8; 1024];

// buf の所有権は read が返す future に移動する
let mut future = read(&file, buf);

// buf の所有権は future に移動しているので、ここではアクセスできない
// buf.copy_from_slice(&other);
// ^~ error[E0382]: borrow of moved value: `buf`

// 書き込まれたバッファは future を評価することで返される
let (buf, res) = future.await;
res?;
```

future が途中で破棄された場合はどうでしょうか？
前述したように呼び出し側がバッファに再びアクセスするためには future を評価するしかないので、`drop` または `forget` をした時点でバッファへアクセスするための手段は失われます。そのため、I/O との書き込みが競合したり、I/O 実行前にバッファを drop してしまう可能性を排除することができています。

```rust
let buf = vec![0u8; 1024];

// buf の所有権は read が返す future に移動する
let mut future = Box::pin(read(&file, buf));

pin_mut!(future.as_mut());
mem::forget(future);

// buf.copy_from_slice(&other);
// ^~ error[E0382]: borrow of moved value: `buf`
```

drop 時のキャンセル処理についても、future が I/O 側の完了を待機する必要がなくなるので単に `cancel` を呼び出して終了することができます。

```rust
struct CancelOnDrop {
    token: sys::token_t,
}

impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        unsafe {
            let _ = sys::cancel(self.token);
        }

        // メモリ保護のためにブロックする必要はない
    }
}

pub async fn read(fd: &impl AsRawFd, buf: Vec<u8>) -> (Vec<u8>, io::Result<usize>) {
    let token = unsafe {
        sys::start_read(
            fd.as_raw_fd(),
            buf.as_mut_ptr().cast::<c_void>(),
            buf.len(),
        )
    };

    let join = spawn_blocking(move || {
        let rc = unsafe { sys::wait_complete(token) };
        let result = if rc >= 0 {
            Ok(rc as usize)
        } else {
            Err(io::Error::from_raw_os_error(-rc))
        };

        (buf, result)
    });

    let guard = CancelOnDrop { token };
    let ret = join.await;
    mem::forget(guard);

    ret.expect("join error")
}
```

# おわりに

今回はもう少し込み入った話をする予定でしたが、改めて考えを整理すると単純な対処法で実現できることに気づいたので当初計画したものよりあっさりした内容になりました。
これは、最初に想定した非同期 I/O ライブラリの仕様が単純すぎるというのも理由にあり、io_uring や GPU アクセスなどの実際のユースケースでは上記のような対策を適用することが困難であると考えられます。

そのため、次回はもう少し現実に沿ったものになるように問題設定を見直した上で、改めてメモリ保護について検討していきたいと思います。
