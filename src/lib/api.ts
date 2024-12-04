import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import matter from 'gray-matter'
import { parseISO } from 'date-fns'
import  { unified, Processor } from 'unified'
import mdast, { Node } from 'mdast'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import { filter } from 'unist-util-filter'

declare module 'unified' {
    interface CompileResultMap {
        Node: Node | undefined
    }
}

const postsDir = path.join(process.cwd(), '_posts')

export type Post = {
    id: string
    sourcePath: string
    title?: string 
    published: Date
    tags: string[]
    categories: string[]
    content: Node
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

        const { data, content }: {
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
    
        const parsed = await unified()
            .use(remarkParse, { fragment: true })
            .use(remarkDirective)
            .use(remarkGfm)
            .use(remarkMath)
            .use(remarkExport, { filePath })
            .process(content)

        posts.push({
            id,
            sourcePath,
            title: data.title,
            published,
            tags: data.tags ?? [],
            categories: data.categories ?? [],    
            content: parsed.result as Node
        })
    }

    posts.sort((a, b) => a.published < b.published ? 1 : -1)

    return posts
})()

function remarkExport(this: Processor, { filePath }: { filePath?: string }) {
    this.compiler = (tree) => {
        return filter(tree, (node) => {
            if (node.type === 'html') {
                const html = node as mdast.Html
                if (!html.value.trimStart().startsWith('<!--')) {
                    console.warn(`${filePath}@${node.position?.start?.line} raw HTML detected. Ignored due to XSS prevention`)
                }
                return false
            }

            return true
        })
    }
}
