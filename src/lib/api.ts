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
    slug: string
    mdPath: string
    title?: string 
    date: Date
    tags: string[]
    categories: string[]
    content: Node
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

    posts.sort((a, b) => a.date < b.date ? 1 : -1)

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

    if (!data.date) {
        throw Error(`${filePath}: missing 'date' in front matter.`)
    }

    const parsed = await unified()
        .use(remarkParse, { fragment: true })
        .use(remarkDirective)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkExport, { filePath })
        .process(content)

    return {
        slug: path.basename(filePath).replace(/\.md$/, ''),
        title: data.title,
        date: parseISO(data.date),
        tags: data.tags ?? [],
        categories: data.categories ?? [],
        content: parsed.result
    } as Post
}

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
