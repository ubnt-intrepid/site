import fs from 'fs'
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

export const getPostSlugs = () => (
    fs.readdirSync(postsDirectory)
        .map(slug => slug.replace(/\.md$/, ''))
)

export const getPosts = () => {
    const slugs = getPostSlugs()
    const posts = slugs.map(slug => getPostBySlug(slug))
        .sort((a, b) => a.date > b.date ? 1 : -1)
    return posts
}

export const getPostBySlug = (slug: string) => {
    const fullPath = path.join(postsDirectory, `${slug}.md`)
    const fileContents = fs.readFileSync(fullPath, 'utf8')

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
