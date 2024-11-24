import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import toml from 'toml'

const postsDir = path.join(process.cwd(), '_posts')

export type Post = {
    slug: string 
    title?: string 
    date?: string
    tags?: string[]
    categories?: string[]
    rawContent: string
}

export const getPostSlugs = async () => {
    const rawSlugs = await fs.readdir(postsDir)
    const slugs = rawSlugs.map(slug => slug.replace(/\.md$/, ''))
    return slugs
}

export const getPosts = async () => {
    const slugs = await getPostSlugs()
    const posts = await Promise.all(
        slugs.map(async slug => await getPostBySlug(slug))
    )
    return posts.sort((a, b) => {
        if (!a.date) {
            return -1
        }
        if (!b.date) {
            return 1
        }
        return a.date < b.date ? 1 : -1
    })
}

export const getPostBySlug = async (slug: string) => {
    const fullPath = path.join(postsDir, `${slug}.md`)
    const fileContents = await fs.readFile(fullPath, 'utf8')

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
        title,
        date,
        tags: rawTags,
        categories: rawCategories,
        taxonomies,
    } = data as {
        title?: string
        date?: string 
        tags?: string[]
        categories?: string[]
        taxonomies?: {
            tags?: string[]
            categories?: string[]
        }
    }
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
