import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import yaml from 'js-yaml'
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

        const { matter, node: content } = await parseMarkdown(fileContents, filePath)
        const data = yaml.load(matter) as {
            title?: string
            published?: Date | string
            tags?: string[]
            categories?: string[]
        }

        const id = path.basename(filePath).replace(/\.md$/, '')
        if (posts.findIndex(post => post.id === id) != -1) {
            console.warn(`Ignored due to conflicting the post identifier: ${sourcePath}`)
            continue
        }

        if (!data.published) {
            assert.fail(`${filePath}: missing \`date\` in front matter.`)
        }
        if (typeof data.published === 'string') {
            assert.fail(`${filePath}: the type of \`date\` must be timestamp.`)
        }

        posts.push({
            id,
            sourcePath,
            title: data.title,
            published: data.published,
            tags: data.tags ?? [],
            categories: data.categories ?? [],
            content
        })
    }

    posts.sort((a, b) => a.published < b.published ? 1 : -1)

    return posts
})()
