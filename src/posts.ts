import fs, { Dirent } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import toml from 'toml'

const postsDirectory = path.join(process.cwd(), 'posts')

export const getPostIds = () => (
    fs.readdirSync(postsDirectory)
        .map(fileName => fileName.replace(/\.md$/, ''))
)

export type Post = {
    id: string
    title?: string
    date?: string
    taxonomies?: Taxonomies
    contentRaw: string
}

export type PostMetadata = {
    id: string
    title?: string
    date?: string
    taxonomies?: Taxonomies
}

export type Taxonomies = {
    tags?: string[]
    categories?: string[]
}

export const getPostsMetadata = () => (
    getPostIds()
        .map(id => {
            const { date, title, taxonomies } = loadPost(id);
            return ({ id, date, title, taxonomies } as PostMetadata)
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1))
);

export const loadPost = (id: string) => {
    const fullPath = path.join(postsDirectory, `${id}.md`)
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const matterResult = matter(fileContents, {
        language: 'toml',
        delimiters: '+++',
        engines: {
            toml: {
                parse: toml.parse.bind(toml),
                stringify: function() {
                    throw new Error('cannot stringify to TOML');
                }
            },
        },
    })
    const { title, date, taxonomies } = matterResult.data
    return {
        id,
        title,
        date,
        taxonomies,
        contentRaw: matterResult.content,
    } as Post
}
