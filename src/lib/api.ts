import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import matter from 'gray-matter'
import { parseISO } from 'date-fns'
import { parseMarkdown } from '@/lib/markdown'
import mdast from 'mdast'

const postsDir = path.join(process.cwd(), '_posts')

export type Post = {
    id: string
    sourcePath: string
    title?: string 
    published: Date
    tags: string[]
    categories: string[]
    content: mdast.Node
}

export const getPosts = async () => {
    // FIXME: invalidate the cache when post(s) are modified
    return await _cachedPosts
}

const _cachedPosts: Promise<Post[]> = (async () => {
    const postPaths = await glob(postsDir + '/**/*.md')

    const posts: Post[] = []
    for (const filePath of postPaths) {
        const fileContents = await fs.readFile(filePath, 'utf8')
        const sourcePath = path.relative(postsDir, filePath)

        const { data, content: rawContent }: {
            data: {
                title?: string
                published?: string 
                tags?: string[]
                categories?: string[]
            }
            content: string
        } = matter(fileContents)

        const id = path.basename(filePath).replace(/\.md$/, '')
        if (posts.findIndex(post => post.id === id) != -1) {
            console.warn(`Ignored due to conflicting the post identifier: ${sourcePath}`)
            continue
        }

        if (!data.published) {
            throw Error(`${filePath}: missing 'date' in front matter.`)
        }
        const published = parseISO(data.published)
    
        const content = await parseMarkdown(rawContent, filePath)

        posts.push({
            id,
            sourcePath,
            title: data.title,
            published,
            tags: data.tags ?? [],
            categories: data.categories ?? [],    
            content
        })
    }

    posts.sort((a, b) => a.published < b.published ? 1 : -1)

    return posts
})()
