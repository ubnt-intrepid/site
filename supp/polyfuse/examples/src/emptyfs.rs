use polyfuse::Filesystem;

struct EmptyFS;

impl<T> Filesystem<T> for EmptyFS {}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let mountpoint = std::env::args_os()
        .nth(1)
        .map(std::path::PathBuf::from)
        .ok_or_else(|| anyhow::anyhow!("missing mountpoint"))?;
    anyhow::ensure!(mountpoint.is_dir(), "the mountpoint must be a directory",);

    polyfuse_tokio::mount(EmptyFS, &mountpoint, &[]).await?;
    Ok(())
}
