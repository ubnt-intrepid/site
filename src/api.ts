import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import toml from 'toml'

export type Post = {
    slug: string
    title?: string
    date?: string
    tags?: string[]
    categories?: string[]
    content: string
}

const postsDirectory = path.join(process.cwd(), '_posts')

export const getPostSlugs = async () => {
    const rawSlugs = await fs.readdir(postsDirectory)
    return rawSlugs.map(slug => slug.replace(/\.md$/, ''))
}

export const getPosts = async () => {
    const slugs = await getPostSlugs()
    const posts = await Promise.all(
        slugs.map(async slug => await getPostBySlug(slug))
    )
    return posts.sort((a, b) => a.date < b.date ? 1 : -1)
}

export const getPostBySlug = async (slug: string) => {
    const fullPath = path.join(postsDirectory, `${slug}.md`)
    const fileContents = await fs.readFile(fullPath, 'utf8')

    const { data, content } = matter(fileContents, {
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

    const {
        title,
        date,
        taxonomies: {
            tags: tagsRaw,
            categories: categoriesRaw,
        },
    } = data as {
        title?: string
        date?: string
        taxonomies?: {
            tags?: string[]
            categories?: string[]
        }
    }
    const tags = tagsRaw ?? []
    const categories = categoriesRaw ?? []

    return {
        slug,
        title,
        date,
        tags,
        categories,
        content,
    } as Post
}
