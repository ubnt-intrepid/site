use polyfuse::{Context, Operation, Filesystem};
use futures::io::AsyncWrite;
use std::io;

struct Hello;

#[polyfuse::async_trait]
impl<T> Filesystem<T> for Hello {
    async fn call(&self, cx: &mut Context<'_, W>, op: Operation<'_, T>) -> io::Result<()> {
        match op {
            Operation::Getattr(op) => match op.ino() {
                1 => unimplemented!(),
                _ => cx.reply_err(libc::ENOENT).await,
            },
        }
    }
}

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

    polyfuse_tokio::mount(Hello, &mountpoint, &[]).await?;
    Ok(())
}
