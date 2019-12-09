use futures::io::AsyncWrite;
use polyfuse::reply::{ReplyAttr, ReplyEntry};
use polyfuse::{Context, DirEntry, FileAttr, Filesystem, Operation};
use std::io;
use std::os::unix::ffi::OsStrExt;

const ROOT_INO: u64 = 1;

const HELLO_FILENAME: &str = "hello.txt";
const HELLO_CONTENT: &str = "Hello, world!\n";
const HELLO_INO: u64 = 2;

fn root_attr() -> FileAttr {
    let mut attr = FileAttr::default();
    attr.set_ino(ROOT_INO);
    attr.set_nlink(2);
    attr.set_mode(libc::S_IFDIR | 0o555);
    attr.set_uid(unsafe { libc::getuid() });
    attr.set_gid(unsafe { libc::getgid() });
    attr
}

fn hello_attr() -> FileAttr {
    let mut attr = FileAttr::default();
    attr.set_ino(HELLO_INO);
    attr.set_nlink(1);
    attr.set_size(HELLO_CONTENT.len() as u64);
    attr.set_mode(libc::S_IFREG | 0o444);
    attr.set_uid(unsafe { libc::getuid() });
    attr.set_gid(unsafe { libc::getgid() });
    attr
}

fn make_entries() -> Vec<DirEntry> {
    vec![
        DirEntry::dir(".", ROOT_INO, 1),
        DirEntry::dir("..", ROOT_INO, 2),
        DirEntry::file(HELLO_FILENAME, HELLO_INO, 3),
    ]
}

struct Hello;

#[polyfuse::async_trait]
impl<T> Filesystem<T> for Hello {
    async fn call<W: ?Sized>(&self, cx: &mut Context<'_, W>, op: Operation<'_, T>) -> io::Result<()>
    where
        W: AsyncWrite + Unpin + Send,
        T: Send + 'async_trait,
    {
        match op {
            Operation::Lookup(op) => match op.parent() {
                ROOT_INO => {
                    if op.name().as_bytes() == HELLO_FILENAME.as_bytes() {
                        op.reply(cx, ReplyEntry::new(hello_attr())).await
                    } else {
                        cx.reply_err(libc::ENOENT).await
                    }
                }
                HELLO_INO => cx.reply_err(libc::ENOTDIR).await,
                _ => cx.reply_err(libc::ENOENT).await,
            },

            Operation::Getattr(op) => match op.ino() {
                ROOT_INO => op.reply(cx, ReplyAttr::new(root_attr())).await,
                HELLO_INO => op.reply(cx, ReplyAttr::new(hello_attr())).await,
                _ => cx.reply_err(libc::ENOENT).await,
            },

            Operation::Readdir(op) => match op.ino() {
                ROOT_INO => {
                    let entries = make_entries();
                    let mut total_len = 0;
                    let entries: Vec<&[u8]> = entries
                        .iter()
                        .map(|entry| entry.as_ref())
                        .skip(op.offset() as usize)
                        .take_while(|entry| {
                            total_len += entry.len();
                            total_len <= op.size() as usize
                        })
                        .collect();
                    op.reply_vectored(cx, &entries[..]).await
                }
                HELLO_INO => cx.reply_err(libc::ENOTDIR).await,
                _ => cx.reply_err(libc::ENOENT).await,
            },

            Operation::Read(op) => match op.ino() {
                ROOT_INO => cx.reply_err(libc::EISDIR).await,
                HELLO_INO => {
                    let offset = op.offset() as usize;
                    if offset <= HELLO_CONTENT.len() {
                        let size = op.size() as usize;
                        let content = &HELLO_CONTENT.as_bytes()[offset..];
                        let content = &content[..std::cmp::min(content.len(), size)];
                        op.reply(cx, content).await
                    } else {
                        op.reply(cx, &[]).await
                    }
                }
                _ => cx.reply_err(libc::ENOENT).await,
            },

            _ => cx.reply_err(libc::ENOSYS).await,
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
    anyhow::ensure!(mountpoint.is_dir(), "the mountpoint must be a directory",);

    polyfuse_tokio::mount(Hello, &mountpoint, &[]).await?;
    Ok(())
}
