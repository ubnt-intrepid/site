import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import matter from 'gray-matter'

const postsDir = path.join(process.cwd(), '_posts')

export type Post = {
    slug: string
    mdPath: string
    title?: string 
    date?: string
    tags: string[]
    categories: string[]
    content: string
}

export const getPosts = async () => {
    const postPaths = await glob(postsDir + '/**/*.md')
    const posts: Post[] = []
    for (const filePath of postPaths) {
        const mdPath = path.relative(postsDir, filePath)
        const post = await readPost(filePath)
        if (posts.findIndex(p => p.slug === post.slug) != -1) {
            console.warn(`Ignored due to conflicting the slug: ${mdPath}`)
            continue
        }
        post.mdPath = mdPath
        posts.push(post)
    }

    posts.sort((a, b) => {
        if (!a.date) {
            return -1
        }
        if (!b.date) {
            return 1
        }
        return a.date < b.date ? 1 : -1
    })

    return posts
}

const readPost = async (filePath: string) => {
    const fileContents = await fs.readFile(filePath, 'utf8')

    const { data, content }: {
        data: {
            title?: string
            date?: string 
            tags?: string[]
            categories?: string[]
        }
        content: string
    } = matter(fileContents)

    return {
        slug: path.basename(filePath).replace(/\.md$/, ''),
        title: data.title,
        date: data.date,
        tags: data.tags ?? [],
        categories: data.categories ?? [],
        content
    } as Post
}
