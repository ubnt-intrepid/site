import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import matter from 'gray-matter'
import toml from 'toml'

const postsDir = path.join(process.cwd(), '_posts')

export type Post = {
    slug: string
    mdPath: string
    title?: string 
    date?: string
    tags?: string[]
    categories?: string[]
    rawContent: string
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

    const { data, content: rawContent } = matter(fileContents, {
        language: 'toml',
        delimiters: '+++',
        engines: {
            toml: {
                parse: toml.parse.bind(toml),
                stringify: () => {
                    throw new Error('cannot stringify to TOML')
                }
            }
        }
    })
    const {
        slug: rawSlug,
        title,
        date,
        tags: rawTags,
        categories: rawCategories,
        taxonomies,
    } = data as {
        slug?: string
        title?: string
        date?: string 
        tags?: string[]
        categories?: string[]
        taxonomies?: {
            tags?: string[]
            categories?: string[]
        }
    }
    const slug = rawSlug ?? path.basename(filePath).replace(/\.md$/, '')
    let tags = rawTags ?? []
    let categories = rawCategories ?? []
    if (taxonomies) {
        tags = tags.concat(taxonomies.tags ?? [])
        categories = categories.concat(taxonomies.categories ?? [])
    }

    return {
        slug,
        title,
        date,
        tags,
        categories,
        rawContent
    } as Post
}
