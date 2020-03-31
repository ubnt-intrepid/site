+++
title = "Rustの（FFIまわりの安全性を考慮した）プラグインシステム"
date = 2019-12-25

[taxonomies]
tags = [ "rust", "qiita" ]
categories = [ "programming" ]
+++

@dalance 氏の[記事](https://qiita.com/dalance/items/1593b56ad3744c469643)で紹介されているプラグインシステムの抱える、相互運用性まわりの問題点を解消した仕組みを考えてみました。プラグインシステム自体の動機や、提供される機能の詳細については元記事を参照してください。

成果物: https://github.com/ubnt-intrepid/rust-plugin-example

# 元システムにおける問題点の整理

元記事のプラグインシステムでは、プラグインのインスタンスを `Box<dyn Plugin>` に変換した上でローダ側に転送し、ローダ側は受け取った `Box<dyn Plugin>` のインスタンスをそのまま用いています。

```rust:プラグイン側
#[no_mangle]
pub unsafe extern "C" fn load_plugin() -> Box<dyn Plugin> {
    Box::new(PluginAdd::default()) // (1)
}
```

```rust:ローダ側
let plugin: Box<dyn Plugin> = unsafe {
    let load_plugin: Symbol<unsafe extern "C" fn() -> Box<dyn Plugin>> =
        lib.get(b"load_plugin")?;
    load_plugin()
};

let name: String = plugin.name();
println!("1 {} 2 = {}", plugin.operator(), plugin.calc(1, 2));

// drop(plugin); // (2)
```

上の方法でトレイトオブジェクトを扱うことは（コンパイルエラーを生じないため）一見問題ないように見えます。しかし、`load_plugin` の戻り値型を `Box` にしてしまっているせいで所有権がプラグインとローダ間で移動し、`(1)` において**プラグイン側の**アロケータを用いて確保されたヒープ領域のメモリが `(2)` において**ローダ側の**アロケータを用いて解放されます。双方が異なるアロケータを用いていた場合、メモリの解放が上手くいく保証はありません。プラグイン・ローダ側の両方でアロケータを共通なものにしてしまえば良い気もしますが、その場合プラグインシステム内で使用されるアロケータが今回のような用途で安全にメモリを解放できることを保証する必要があります。いずれにせよ `Box<T>` は FFI 境界を超えることを想定されていない（はず）ため、オブジェクトの転送は `Box::into_raw`/`Box::from_raw` を用いて raw pointer に変換した状態で行い、使用後のプラグインのインスタンスはプラグイン側に行うようにした方が安全です（これで問題が解決されたのかというとそういうわけではなく、drop 時に `release_plugin` のシンボル解決の失敗でリソースリークしないような対策を取る必要があります）。

```rust:プラグイン側
#[no_mangle]
pub unsafe extern "C" fn load_plugin() -> *mut dyn Plugin {
    let plugin: Box<dyn Plugin> = Box::new(PluginAdd::default());
    Box::into_raw(plugin)
}

#[no_mangle]
pub unsafe extern "C" fn release_plugin(plugin: *mut dyn Plugin) {
    let plugin: Box<dyn Plugin> = Box::from_raw(plugin);
    // drop(plugin);
}
```


さらに、トレイトオブジェクトの動的ディスパッチに関する問題が残されています。上の例においてローダ側で行われる `plugin.name()` などの動的ディスパッチは、実際には次のようなイメージで実行されています（[参考](https://brson.github.io/rust-anthology/1/all-about-trait-objects.html#all-about-trait-objects)）。

```rust
let plugin_obj: std::raw::TraitObject = mem::transmute(&plugin);
let plugin_vtable: &'static PluginVTable = plugin_obj.vtable;
(plugin_vtable.name)(plugin_obj.data)
```

ここで `PluginVTable` は、`Plugin` トレイトに紐づけられた仮想関数テーブルだとします。`plugin_obj.vtable`　には、通常であれば**ローダ側** のトレイトオブジェクト（仮にこれを `dyn_Plugin_Loader` とします）の仮想関数テーブルのレイアウトを持つ値を指しています。しかし今回の場合、`vtable` に格納されているポインタは**プラグイン側**で定義された仮想関数テーブルの値を指しています（このトレイトオブジェクトを `dyn_Plugin_Plugin` と呼ぶことにします）。`dyn_Plugin_Loader` と `dyn_Plugin_Plugin` は、（たまたま同じような見た目を持つ）全くの別物であり、それらの仮想関数テーブルのレイアウトが一致する保証はどこにもありません。したがって、`dyn_Plugin_Loader` の `name` フィールドだと思ってアクセスしたアドレスには有効な関数ポインタではない場所を指している可能性があり、その結果不正なメモリアクセスを引き起こす危険があります。

# カスタム vtable による解決法

[元記事へのコメント](https://qiita.com/dalance/items/1593b56ad3744c469643#comment-b0a5dad847d5d4488602)ではトレイトのメソッド毎にインタフェースとなる関数を公開するようにしていましたが、あとでカスタムの仮想関数テーブルを使用するとスマートかつオーバヘッドを抑えることが出来ると気づいたのでそれについて紹介します。

そもそも、トレイトオブジェクトではプラグイン側・ローダ側で仮想関数テーブルの互換性が保証されないことが問題なのでした。それならば、プラグインシステム側で仮想関数テーブルのレイアウトを定義してしまい、動的ディスパッチ部分を手作業で実装してしまえば良い訳です。そこで、次のように `Plugin` の仮想関数テーブルを定義します。

```rust
#[repr(C)]
pub struct PluginVTable {
    version: &'static str,
    name: unsafe extern "C" fn(*const c_void) -> StrSlice,
    operator: unsafe extern "C" fn(*const c_void) -> StrSlice,
    calc: unsafe extern "C" fn(*const c_void, u32, u32) -> u32,
    drop: unsafe extern "C" fn(*mut c_void),
}
```

`name`, `operator`, `calc`, `drop` にはそれぞれ、対応する `T: Plugin` のメソッドを呼び出すための関数ポインタが格納されます。`#[repr(C)]` が付いているのがミソで、これにより `PluginVTable` 自体を弄らない限り仮想関数テーブルのレイアウトが同じになることが保証されます。vtable 内に追加のデータを埋め込むことも可能であり、ここでは `version` というバージョン識別用の文字列を埋め込んでいます[^1]。`StrSlice` は `&str` のライフタイムを消去するための `iovec` みたいな型です（ここでは説明を省略します）。

[^1]: 本来であれば `&'static str` も隠ぺいすべきだと思われますが、`&str` のレイアウトが一致しなくなることはさすがにないだろうと仮定してここでは直接渡しています。

この仮想関数テーブルを用いて、各プラグインが実装する `load_plugin` 関数は次のように修正されます。トレイトオブジェクトとは異なり、仮想関数テーブルの初期化、fat pointer の作成はすべて手動で行う必要があります（`LoadPluginResult` はもう少し良い名前を付けるべきだった…）。ここでは行っていませんが、プラグインの初期化に失敗した場合は `ptr` フィールドをヌルポインタにすることでローダ側に通知する仕様になっています。

```rust
#[no_mangle]
pub unsafe extern "C" fn load_plugin() -> LoadPluginResult {
    lazy_static! {
        static ref VTABLE: PluginVTable = PluginVTable::new::<PluginAdd>();
    }

    LoadPluginResult {
        ptr: Box::into_raw(Box::new(PluginAdd::default())) as *mut c_void,
        vtable: &*VTABLE,
    }
}
```

```rust
#[repr(C)]
pub struct LoadPluginResult {
    pub ptr: *mut c_void,
    pub vtable: &'static PluginVTable,
}
```

ローダ側の実装を見ていきます。ここでは、あるプラグインをロードし、必要なデータを管理する `PluginProxy` という型を実装します。
`load_plugin` の実行部分は元システムとほぼ同じですが、戻り値である fat pointer は自作の型であるため、直接 `ptr` と `vtable`  の値を保持します。また、先ほど説明した `version` フィールドの値がローダ側と一致しているかを確認し、バージョンの差異による vtable レイアウトのミスマッチを防止しています。

```rust

struct PluginProxy {
    #[allow(dead_code)]
    lib: Library,
    ctx: NonNull<c_void>,
    vtable: &'static PluginVTable,
}

impl PluginProxy {
    pub fn load(path: impl AsRef<Path>) -> anyhow::Result<Self> {
        let lib = Library::new(path.as_ref())?;

        let ret = unsafe {
            let load_plugin: Symbol<unsafe extern "C" fn() -> LoadPluginResult> =
                lib.get("load_plugin".as_ref())?;
            load_plugin()
        };

        anyhow::ensure!(
            ret.vtable.version == crate::inner::VERSION_STR,
            "plugin version mismatched"
        );

        let ctx = ret
            .ctx
            .ok_or_else(|| anyhow::anyhow!("failed to load the plugin"))?;

        Ok(Self {
            lib,
            ctx,
            vtable: ret.vtable,
        })
    }
}
```

あとは、`ctx` と `vtable` に格納された値を用いて `Drop` と `Plugin` の実装をしていくだけです。コンパイラの助けは得られないため、動的ディスパッチは手作業で書いていく必要があります。

```rust
impl Drop for PluginProxy {
    fn drop(&mut self) {
        unsafe {
            (self.vtable.drop)(self.ctx.as_ptr());
        }
    }
}

impl Plugin for PluginProxy {
    fn name(&self) -> &str {
        unsafe { (self.vtable.name)(self.ctx.as_ref()).into_str() }
    }

    fn operator(&self) -> &str {
        unsafe { (self.vtable.operator)(self.ctx.as_ref()).into_str() }
    }

    fn calc(&self, lhs: u32, rhs: u32) -> u32 {
        unsafe { (self.vtable.calc)(self.ctx.as_ref(), lhs, rhs) }
    }
}
```

プラグインシステム全体の構成、および使用例はリポジトリを参照してください。

