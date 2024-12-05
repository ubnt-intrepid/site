---
title: Tokioで1チャンネル双方向通信可能なMessagePack-RPCのライブラリを作った
published: 2017-12-20
tags: [ "rust", "tokio", "announce", "qiita" ]
categories: [ "programming" ]
---

少し前に作った双方向の MessagePack-RPC 実装に関する知見をまとめておきます．

成果物は以下の通り．

https://github.com/ubnt-intrepid/msgpack-rpc-rs

<!-- more -->

# はじめに

## MessagePack-RPC について
[MessagePack-RPC][rpc] は MessagePack を使用した RPC であり，JSON や XML ベースのものと比較し非常にコンパクトなフォーマットで通信を行うことが出来る．各メッセージは MessagePack の配列として表現され，それぞれ次のような要素を持つ．

* Request = `[0, msgid, method, params]`
  - `msgid`: integer
  - `method`: string
  - `params`: array
* Response = `[1, msgid, error, result]`
  - `msgid` : integer
  - `error`, `result` : value | nil
* Notification = `[2, method, params]`
  - `method`: string
  - `params`: array

Request と Response に含まれる msgid は，通信の多重化を行うために用いられる．また， Notification はレスポンスを受け取らない単発のメッセージを表現するものであり，イベントの通知などに用いることが出来る．

[rpc]: https://github.com/msgpack-rpc/msgpack-rpc/blob/master/spec.md

ここで重要な MessagePack-RPC の特長は以下の通りである（ここに記載している内容は MessagePack-RPC 公式の Specification に明示されていないものが含まれることに注意されたい）：

* **多重化通信が出来る．** すなわち，サーバからレスポンスを返す際に受け取ったリクエストの順序を気にする必要がなく，リクエスト毎に非同期にレスポンスを受信して即座に処理することが出来る．
* **単一のチャンネルで双方向に通信が出来る．** これは仕様には明記されていない（そのはず）が，各ノードから別のノードに主体的に送信するのが Request/Notification のみであるため，（適切に処理さえすれば）双方向から同じチャンネルを通じて通信しても問題ない．

2つめの特長については，（帯域の節約などの利点も考えられるが）そもそも複数のチャンネルを持つことが出来ない（標準入出力などの）通信路での双方向通信が可能になるというメリットがある．

## Tokio における多重化通信

tokio-proto では，まさしく多重化通信を行うための方法が[サポートされている](https://tokio.rs/docs/going-deeper-tokio/multiplex/)．多重化通信の方法自体は公式のドキュメントが大変詳しいのでそちらを参照されたい．

ただし，現在 tokio-proto でサポートされる（多重化）通信には以下の制約がある．

* クライアント・サーバモデルのプロトコルのみに対応している．単一チャンネルでの双方向通信には対応しない．
* 多重化された通信とそうでない（リクエストと同じ順序でレスポンスを受け取る）通信のいずれかを選ぶ必要がある．すなわち，それらが混合したプロトコルは使用できない．
* 原則としてレスポンスを常に受け取ることを前提とするため，（Notification のような）単発のメッセージを送ることは出来ない．
  
1つ目の問題は，クライアント側とサーバ側で独立した通信路を確立することで対処出来る．しかし前述したように，標準入出力を介した場合など本質的に複数の通信路を確保できない状況などが考えられる．

3つめの問題については Notification を受信して処理したあとにダミーのレスポンスを送信するなどを考えたが，これはプロトコル自体に手を加えるのでやりたくない．

---

上記問題への対処方法はいくつか考えられる．例えば [rmp-rpc] では， tokio-proto に依存せずに独自にプロトコル部分の実装を行っている．これを tokio-proto の枠組みで何とかしようというのが，本記事の趣旨である．

[rmp-rpc]: https://github.com/little-dude/rmp-rpc

# 方法

考え方は非常にシンプルなものである．つまり，IO と tokio-proto の間でやり取りするデータを分配器に通し，tokio-proto 側でサポートしている形式になるよう「整形」された通信路を人工的に作るという方針である．

大雑把に図示すると次のようになる．

```
                      +----------------(Notification)----------------+
                      |                                              |
                      |               +-------------------+          o
                      |  +------------|--(u64, Response)--|---> +----------+
                      |  |            |                   |     |  Client  |
                      |  |  +---------|--(u64, Request)---|---o +----------+
                      |  |  |         +-------------------+
                      v  |  v            ClientTransport
                    +---------+
               +---o|   Mux   |<--+
+---+          |    +---------+   |
|   | <--------+         |        |   +-------------------+
|I/O| (Message)          o        +---|--(u64, Response)--|---o +--------- +
|   | o--------+    +---------+       |                   |     | Endpoint |
+---+          +--->|  Demux  |o------|--(u64, Request) --|---> +----------+
                    +---------+       +-------------------+          ^
                         o              EndpointTransport            |
                         |                                           |
                         +-------------(Notification)----------------+
```

I/O には `AsyncRead` と `AsyncWrite` を実装した「生の」通信路が入る．これは `FramedRead` / `FramedWrite` を介することで，（分配前の）`DecoderMessage` の `Stream` / `Sink` に一度変換される．分配器（`Mux` / `Demux`）を通ることで「濾過」されたチャンネルは対応するチャンネルごとに束ねられ，利用側（`Client` / `Endpoint`）内で Transport として用いられる．
Notification ようのチャンネルは tokio-proto の枠組みでは扱えないため，別途対処する．

## 分配器の設計
分配器 `Demux` と `Mux` は，IOから受信し（`Framed` を通じエンコード・デコードされた）たメッセージを，各メッセージのタイプに該当するチャンネルに受け流す役割を持つ．

`Demux` は IO から受信した（`FramedRead` を通した）メッセージを各チャンネルに分配するためのデマルチプレクサであり，その定義は以下で与えらている．

```rust
struct Demux<T> {
    stream: Option<T>,
    buffer: Option<DecoderMessage>,
    tx0: UnboundedSender<(u64, Request)>,
    tx1: UnboundedSender<(u64, Response)>,
    tx2: UnboundedSender<Notification>,
}
```

`stream` は（分配前の）データを受け取るためのストリームである．`tx0` から `tx2` は分配後のデータを受け流すための `futures::mpsc::UnboundedSender` である．

`Demux<T>` は `Future` を実装し，バックグラウンドで `stream` から読み取ったメッセージを各チャンネルに転送するタスクとして振る舞う．試行錯誤の結果，この実装は次のようになった．

```rust
impl<T> Future for Demux<T>
where
    T: Stream<Item = DecoderMessage>
{
    type Item = ();
    type Error = ();

    fn poll(&mut self) -> Poll<(), ()> {
        // バッファにメッセージが残っている場合，対応するチャンネルに受け流す
        // 送信するチャンネルの状態によってはデータを渡せないので，その場合は再びバッファに戻す（下記参照）
        if let Some(item) = self.buffer.take() {
            try_ready!(self.try_start_send(item))
        }

        loop {
            match self.stream_mut().poll().map_err(|_| ())? {
                Async::Ready(Some(item)) => try_ready!(self.try_start_send(item)),
                Async::Ready(None) => {
                    try_ready!(self.tx0.close().map_err(|_| ()));
                    try_ready!(self.tx1.close().map_err(|_| ()));
                    try_ready!(self.tx2.close().map_err(|_| ()));
                    self.stream = None;
                    return Ok(Async::Ready(()));
                }
                Async::NotReady => {
                    try_ready!(self.tx0.poll_complete().map_err(|_| ()));
                    try_ready!(self.tx1.poll_complete().map_err(|_| ()));
                    try_ready!(self.tx2.poll_complete().map_err(|_| ()));
                    return Ok(Async::NotReady);
                }
            }
        }
    }
}

impl<T> Demux<T>
where
    T: Stream<Item = DecoderMessage>
{
    fn stream_mut(&mut self) -> &mut T {
        self.stream.as_mut().take().unwrap()
    }

    // item を対応するチャンネルに送信する
    // 失敗した場合は，次の poll() の呼び出しまでその値を buffer に保持する
    fn try_start_send(&mut self, item: DecoderMessage) -> Poll<(), ()> {
        match item {
            DecoderMessage::Request(id, req) => {
                if let AsyncSink::NotReady((id, req)) =
                    self.tx0.start_send((id, req)).map_err(|_| ())?
                {
                    self.buffer = Some(DecoderMessage::Request(id, req));
                    return Ok(Async::NotReady);
                }
            }
            DecoderMessage::Response(id, res) => {
                if let AsyncSink::NotReady((id, res)) =
                    self.tx1.start_send((id, res)).map_err(|_| ())?
                {
                    self.buffer = Some(DecoderMessage::Response(id, res));
                    return Ok(Async::NotReady);
                }
            }
            DecoderMessage::Notification(not) => {
                if let AsyncSink::NotReady(not) = self.tx2.start_send(not).map_err(|_| ())? {
                    self.buffer = Some(DecoderMessage::Notification(not));
                    return Ok(Async::NotReady);
                }
            }
        }
        Ok(Async::Ready(()))
    }
}
```

一方，`Mux` は相手ノードに送信するパケットを一つの通信路に合流させるためのマルチプレクサであり，次のように与えられる．

```rust
struct Mux<U> {
    sink: U,
    buffer: VecDeque<EncoderMessage>,
    rx0: UnboundedReceiver<(u64, Request)>,
    rx1: UnboundedReceiver<(u64, Response)>,
    rx2: UnboundedReceiver<(Notification, oneshot::Sender<()>)>,
}
```

```rust
impl<U> Future for Mux<U>
where
    U: Sink<SinkItem = EncoderMessage>
{
    type Item = ();
    type Error = ();

    fn poll(&mut self) -> Poll<(), ()> {
        loop {
            try_ready!(self.start_send());
            debug_assert!(self.buffer.len() == 0);

            match self.try_recv()? {
                Async::Ready(Some(buf)) => {
                    self.buffer.extend(buf);
                }
                Async::Ready(None) => {
                    try_ready!(self.sink.close().map_err(|_| ()));
                    return Ok(Async::Ready(()));
                }
                Async::NotReady => {
                    try_ready!(self.sink.poll_complete().map_err(|_| ()));
                    return Ok(Async::NotReady);
                }
            }
        }
    }
}

impl<U: Sink<SinkItem = EncoderMessage>> Mux<U> {
    fn try_recv(&mut self) -> Poll<Option<Vec<EncoderMessage>>, ()> {
        let mut buf = Vec::with_capacity(3);
        let done0 = match self.rx0.poll()? {
            Async::Ready(Some((id, req))) => {
                buf.push(EncoderMessage::Request(id, req));
                false
            }
            Async::Ready(None) => true,
            Async::NotReady => false,
        };
        let done1 = match self.rx1.poll()? {
            Async::Ready(Some((id, res))) => {
                buf.push(EncoderMessage::Response(id, res));
                false
            }
            Async::Ready(None) => true,
            Async::NotReady => false,
        };
        let done2 = match self.rx2.poll()? {
            Async::Ready(Some((not, sender))) => {
                buf.push(EncoderMessage::Notification(not, sender));
                false
            }
            Async::Ready(None) => true,
            Async::NotReady => false,
        };

        if done0 && done1 && done2 {
            Ok(Async::Ready(None))
        } else if buf.len() > 0 {
            Ok(Async::Ready(Some(buf)))
        } else {
            Ok(Async::NotReady)
        }
    }

    fn start_send(&mut self) -> Poll<(), ()> {
        while let Some(item) = self.buffer.pop_front() {
            if let AsyncSink::NotReady(item) = self.sink.start_send(item).map_err(|_| ())? {
                self.buffer.push_front(item);
                return Ok(Async::NotReady);
            }
        }
        Ok(Async::Ready(()))
    }
}
```

これらの分配器は `Future` を実装しており，`Handle` により `spawn()` されることによりバックグランドで並行に実行される．`Demux` および `Mux` の構築と起動は次のように記述した．ここで余っているチャンネルの `Sender` と `Receiver` は対応するものごとにまとめられ，次に説明する transport によって tokio-proto と紐付ける．

```rust
let (read, write) = io.split();

// create wires.
let stream = FramedRead::new(read, Codec);
let sink = FramedWrite::new(write, Codec);
let (d_tx0, d_rx0) = mpsc::unbounded();
let (d_tx1, d_rx1) = mpsc::unbounded();
let (d_tx2, d_rx2) = mpsc::unbounded();
let (m_tx0, m_rx0) = mpsc::unbounded();
let (m_tx1, m_rx1) = mpsc::unbounded();
let (m_tx2, m_rx2) = mpsc::unbounded();

// start multiplexer/demultiplexer.
handle.spawn(Demux::new(stream, d_tx0, d_tx1, d_tx2));
handle.spawn(Mux::new(sink, m_rx0, m_rx1, m_rx2));

...
```

## Transport の設計
tokio-proto 側で扱うデータは（デコード済みの）メッセージであり，（生のバイト列を扱う）`AsyncRead + AsyncWrite` を実装した IO を直接使う場合と異なる対処が必要となる．詳細は [こちらの記事][transport] を参照されたい．

[transport]: https://tokio.rs/docs/going-deeper-tokio/transports/

基本的にはクライアント側とサーバ側とで同じ実装になるが，ここではサーバ側について説明する．上で余っているチャンネルをまとめた `EndpointTransport` を次のように定義する．これは，単に各チャンネルの入出力をラップし `Stream` と `Sink` を実装しているだけである．

```rust
struct EndpointTransport {
    stream: UnboundedReceiver<(u64, Request)>,
    sink: UnboundedSender<(u64, Response)>,
}

impl Stream for EndpointTransport {
    type Item = (u64, Request);
    type Error = io::Error;

    fn poll(&mut self) -> Poll<Option<Self::Item>, Self::Error> {
        self.stream.poll().map_err(
            |_| io_error("EndpontTransport::poll()"),
        )
    }
}

impl Sink for EndpointTransport {
    type SinkItem = (u64, Response);
    type SinkError = io::Error;

    fn start_send(&mut self, item: Self::SinkItem) -> StartSend<Self::SinkItem, Self::SinkError> {
        self.sink.start_send(item).map_err(|_| {
            io_error("EndpontTransport::start_send()")
        })
    }

    fn poll_complete(&mut self) -> Poll<(), Self::SinkError> {
        self.sink.poll_complete().map_err(|_| {
            io_error("EndpontTransport::poll_complete()")
        })
    }
}
```

この Transport を `BindServer` で用いるために，`EndpointProto` の定義を行う．これは単に次のようにすれば良い．

```rust
struct EndpointProto;

impl ::tokio_proto::multiplex::ServerProto<EndpointTransport> for EndpointProto {
    type Request = Request;
    type Response = Response;
    type Transport = EndpointTransport;
    type BindTransport = io::Result<Self::Transport>;
    fn bind_transport(&self, transport: Self::Transport) -> Self::BindTransport {
        Ok(transport)
    }
}
```

あとは `Demux` と `Mux` の構築時に余ったチャンネルを用いて `EndpointTransport` のインスタンスを作り，通常通り `BindServer::bind_server()` を実行すれば良い．ここでは， `Handler` というトレイトを用いて Notification 用のサービスも定義できるようにしている．

```rust
let transport = EndpointTransport {
    stream: self.rx_req,
    sink: self.tx_res,
};

let service = Arc::new(HandleService(handler, self.client.clone()));

EndpointProto.bind_server(&handle, transport, service.clone());

handle.spawn(self.rx_not.for_each(move |not| service.call_not(not)));
```

詳細はソースコードを参照されたい．

# おわりに
* `UnboundedSender` / `UnboundedReceiver` を介しているため，オーバヘッドがある気がする


